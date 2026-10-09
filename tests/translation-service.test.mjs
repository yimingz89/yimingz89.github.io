import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalTranslator, MAX_TRANSLATION_LENGTH } from '../reader/translation.mjs';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function install(t, api) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Translator');
  Object.defineProperty(globalThis, 'Translator', { configurable: true, writable: true, value: api });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'Translator', original);
    else delete globalThis.Translator;
  });
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Translation must never fetch source text or call a remote fallback.'); });
}

function native(t, { availability = 'available', output = 'The bank is open.' } = {}) {
  const translated = [];
  const created = [];
  let destroyed = 0;
  const instance = {
    translate(text, options) { translated.push({ text, options }); return Promise.resolve(output); },
    destroy() { destroyed++; },
  };
  const api = {
    availability: () => Promise.resolve(availability),
    create(options) { created.push(options); return Promise.resolve(instance); },
  };
  install(t, api);
  return { api, instance, translated, created, get destroyed() { return destroyed; } };
}

test('construction and feature detection do not create a model or check availability', (t) => {
  let checked = 0, created = 0;
  install(t, { availability() { checked++; }, create() { created++; } });
  const service = new LocalTranslator();
  assert.equal(service.supported(), true);
  assert.equal(checked, 0);
  assert.equal(created, 0);
});

test('unsupported browsers receive an explicit error', async (t) => {
  install(t, undefined);
  const service = new LocalTranslator();
  assert.equal(service.supported(), false);
  await assert.rejects(service.translate('银行'), /not available in this browser/);
  globalThis.Translator = {};
  assert.equal(service.supported(), false);
});

test('input validation rejects empty, invalid, and oversized requests before model creation', async (t) => {
  const mock = native(t);
  const service = new LocalTranslator();
  assert.equal(MAX_TRANSLATION_LENGTH, 1500);
  for (const text of ['', ' \n\t', null, 42]) await assert.rejects(service.translate(text), /Choose some Chinese text/);
  await assert.rejects(service.translate('字'.repeat(1501)), /1,500 characters/);
  await assert.rejects(service.translate('𠮷'.repeat(1501)), /1,500 characters/);
  assert.equal(mock.created.length, 0);
  await service.translate('𠮷'.repeat(1500));
  assert.equal(mock.translated[0].text, '𠮷'.repeat(1500));
});

test('create starts synchronously before availability resolves to retain user activation', async (t) => {
  const gate = deferred();
  const mock = native(t, { output: '  The bank is open. \n' });
  mock.api.availability = (languages) => {
    assert.deepEqual(languages, { sourceLanguage: 'zh', targetLanguage: 'en' });
    return gate.promise;
  };
  const pending = new LocalTranslator().translate(' 银行开门。 ');
  assert.equal(mock.created.length, 1);
  assert.equal(mock.created[0].sourceLanguage, 'zh');
  assert.equal(mock.created[0].targetLanguage, 'en');
  assert.equal(mock.created[0].signal.aborted, false);
  assert.equal(mock.translated.length, 0);
  gate.resolve('available');
  assert.equal(await pending, 'The bank is open.');
  assert.equal(mock.translated[0].text, ' 银行开门。 ');
});

test('successful instances are reused and a finished request signal cannot destroy them', async (t) => {
  const mock = native(t);
  const service = new LocalTranslator();
  const controller = new AbortController();
  await service.translate('银行开门。', { signal: controller.signal });
  controller.abort();
  assert.equal(mock.created[0].signal.aborted, false);
  assert.equal(mock.destroyed, 0);
  await service.translate('银行。');
  assert.equal(mock.created.length, 1);
  assert.equal(mock.translated.length, 2);
});

for (const [availability, message] of [
  ['available', /model ready/],
  ['downloadable', /first use may take a few minutes/],
  ['downloading', /model is downloading/],
]) {
  test(`${availability} models report their status and translate`, async (t) => {
    native(t, { availability });
    const messages = [];
    assert.equal(await new LocalTranslator().translate('银行开门。', { onProgress: (message) => messages.push(message) }), 'The bank is open.');
    assert.ok(messages.some((value) => message.test(value)));
    assert.equal(messages.at(-1), 'Translating on this device…');
  });
}

test('download progress is reported and its listener is cleaned up after completion', async (t) => {
  const gate = deferred();
  const monitor = new EventTarget();
  const remove = t.mock.method(monitor, 'removeEventListener');
  const mock = native(t, { availability: 'downloadable' });
  mock.api.create = (options) => { options.monitor(monitor); return gate.promise; };
  const messages = [];
  const pending = new LocalTranslator().translate('银行。', { onProgress: (message) => messages.push(message) });
  const event = new Event('downloadprogress');
  Object.defineProperty(event, 'loaded', { value: 0.4 });
  monitor.dispatchEvent(event);
  assert.ok(messages.some((message) => /40%/.test(message)));
  gate.resolve(mock.instance);
  await pending;
  assert.equal(remove.mock.calls.length, 1);
  const count = messages.length;
  monitor.dispatchEvent(event);
  assert.equal(messages.length, count);
});

test('unavailable language pairs fail explicitly and dispose a model that resolves after failure', async (t) => {
  const gate = deferred();
  const mock = native(t, { availability: 'unavailable' });
  let creationSignal;
  mock.api.create = (options) => { creationSignal = options.signal; return gate.promise; };
  await assert.rejects(new LocalTranslator().translate('银行。'), /Chinese-to-English translation is not available/);
  assert.equal(creationSignal.aborted, true);
  assert.equal(mock.translated.length, 0);
  gate.resolve(mock.instance);
  await Promise.resolve();
  assert.equal(mock.destroyed, 1);
});

test('failed model downloads reset initialization and permit a successful retry', async (t) => {
  const mock = native(t);
  const create = mock.api.create;
  let first = true;
  mock.api.create = (options) => {
    if (first) { first = false; return Promise.reject(new DOMException('offline', 'NetworkError')); }
    return create(options);
  };
  const service = new LocalTranslator();
  await assert.rejects(service.translate('银行。'), /model could not be prepared.*Check your connection/);
  assert.equal(await service.translate('银行。'), 'The bank is open.');
});

test('synchronous browser failures are converted to actionable errors', async (t) => {
  const mock = native(t);
  const service = new LocalTranslator();
  mock.api.create = () => { throw new DOMException('User activation required', 'NotAllowedError'); };
  await assert.rejects(service.translate('银行。'), /Click Translate again/);
  mock.api.create = () => { throw new DOMException('Language unavailable', 'NotSupportedError'); };
  await assert.rejects(service.translate('银行。'), /Chinese-to-English translation is not available/);
});

test('availability failures and malformed model results cannot silently become translations', async (t) => {
  const mock = native(t);
  const service = new LocalTranslator();
  mock.api.availability = () => Promise.reject(new Error('availability failed'));
  await assert.rejects(service.translate('银行。'), /model could not be prepared/);
  assert.equal(mock.destroyed, 1);
  mock.api.availability = () => Promise.resolve('unexpected-status');
  await assert.rejects(service.translate('银行。'), /could not check local translation availability/);
  mock.api.availability = () => Promise.resolve('available');
  mock.api.create = () => Promise.resolve({});
  await assert.rejects(service.translate('银行。'), /could not prepare local translation/);
});

test('translation errors discard the cached instance so retry creates a fresh one', async (t) => {
  const mock = native(t);
  const service = new LocalTranslator();
  await service.translate('银行。');
  mock.instance.translate = () => Promise.reject(new Error('model failure'));
  await assert.rejects(service.translate('银行。'), /Local translation failed/);
  assert.equal(mock.destroyed, 1);
  mock.instance.translate = () => Promise.resolve('A fresh translation.');
  assert.equal(await service.translate('银行。'), 'A fresh translation.');
  assert.equal(mock.created.length, 2);
});

test('empty and non-string model output have explicit errors', async (t) => {
  const mock = native(t);
  const service = new LocalTranslator();
  for (const result of ['', ' \n\t', undefined, { text: 'unexpected object' }]) {
    mock.instance.translate = () => Promise.resolve(result);
    await assert.rejects(service.translate('银行。'), /returned no English text/);
  }
  assert.equal(mock.destroyed, 4);
});

test('an already-aborted request never starts a model', async (t) => {
  const mock = native(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(new LocalTranslator().translate('银行。', { signal: controller.signal }), { name: 'AbortError', message: 'Translation cancelled.' });
  assert.equal(mock.created.length, 0);
});

test('cancellation during model setup settles even if the browser ignores its signal and permits retry', async (t) => {
  const gate = deferred();
  const mock = native(t);
  const create = mock.api.create;
  let creationSignal;
  mock.api.create = (options) => { creationSignal = options.signal; return gate.promise; };
  const controller = new AbortController();
  const service = new LocalTranslator();
  const pending = service.translate('银行。', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(creationSignal.aborted, true);
  gate.resolve(mock.instance);
  await Promise.resolve();
  assert.equal(mock.destroyed, 1);
  mock.api.create = create;
  assert.equal(await service.translate('银行。'), 'The bank is open.');
});

test('cancellation during translation stops the request and discards late output', async (t) => {
  const gate = deferred();
  const started = deferred();
  const mock = native(t);
  let translationSignal;
  mock.instance.translate = (_text, { signal }) => { translationSignal = signal; started.resolve(); return gate.promise; };
  const controller = new AbortController();
  const pending = new LocalTranslator().translate('银行。', { signal: controller.signal });
  await started.promise;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(translationSignal.aborted, true);
  assert.equal(mock.destroyed, 1);
  gate.resolve('This stale output must not be returned.');
});

test('a newer request cancels the earlier request without destroying the new instance', async (t) => {
  const gate = deferred();
  const mock = native(t);
  const create = mock.api.create;
  mock.api.create = () => gate.promise;
  const service = new LocalTranslator();
  const first = service.translate('第一段。');
  const cancelledFirst = assert.rejects(first, { name: 'AbortError' });
  mock.api.create = create;
  assert.equal(await service.translate('第二段。'), 'The bank is open.');
  await cancelledFirst;
  assert.equal(mock.created[0].signal.aborted, false);
  let staleDestroyed = false;
  gate.resolve({ translate: () => 'stale', destroy() { staleDestroyed = true; } });
  await Promise.resolve();
  assert.equal(staleDestroyed, true);
  await service.translate('第三段。');
  assert.equal(mock.created.length, 1);
});

test('cancellation queued as native output resolves still suppresses stale results', async (t) => {
  const mock = native(t);
  const controller = new AbortController();
  mock.instance.translate = () => ({
    then(resolve) {
      resolve('Stale translation.');
      queueMicrotask(() => controller.abort());
    },
  });
  await assert.rejects(new LocalTranslator().translate('银行。', { signal: controller.signal }), { name: 'AbortError' });
});

test('model preparation is bounded by a timeout and can retry', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const mock = native(t);
  const create = mock.api.create;
  let creationSignal;
  mock.api.create = (options) => { creationSignal = options.signal; return new Promise(() => {}); };
  const service = new LocalTranslator();
  const pending = service.translate('银行。');
  const rejected = assert.rejects(pending, /model took too long to load/);
  t.mock.timers.tick(180000);
  await rejected;
  assert.equal(creationSignal.aborted, true);
  mock.api.create = create;
  assert.equal(await service.translate('银行。'), 'The bank is open.');
});

test('translation is bounded by a timeout and releases model resources', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const started = deferred();
  const mock = native(t);
  let translationSignal;
  mock.instance.translate = (_text, { signal }) => { translationSignal = signal; started.resolve(); return new Promise(() => {}); };
  const pending = new LocalTranslator().translate('银行。');
  const rejected = assert.rejects(pending, /translation took too long/);
  await started.promise;
  t.mock.timers.tick(30000);
  await rejected;
  assert.equal(translationSignal.aborted, true);
  assert.equal(mock.destroyed, 1);
});
