import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Dictionary, MAX_TEXT_LENGTH, MAX_SELECTION_LENGTH, hasHan, normalizeText, validSavedState, tokensWithOverrides } from '../reader/dictionary.mjs';
import { WordLevels, frequencyBand } from '../reader/levels.mjs';
import { MAX_TRANSLATION_LENGTH } from '../reader/translation.mjs';

const KEY = 'yiming-chinese-reader-v1';
const rows = [
  ['银行', 'yin2 hang2', 'bank', '銀行'], ['银', 'yin2', 'silver', '銀'],
  ['行', 'hang2', 'line of business', '行'], ['行', 'xing2', 'to walk/to go', '行'],
  ['政府', 'zheng4 fu3', 'government', '政府'], ['出台', 'chu1 tai2', 'to launch', '出臺'],
  ['措施', 'cuo4 shi1', 'measure', '措施'], ['学习', 'xue2 xi2', 'to study', '學習'],
  ['人', 'ren2', 'person', '人'],
];
const levelData = { meta: { format: 1, hskEdition: 'HSK 3.0 (2021)' }, entries: [['银行', 2, 5.34]] };
const html = readFileSync(new URL('../reader/index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../reader/app.mjs', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function app(t, { stored, supported = true } = {}) {
  const calls = [];
  const responses = [];
  const requests = [];
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM(html, { url: 'https://reader.test/reader/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  t.after(() => dom.window.close());
  const { window } = dom;
  class LocalTranslator {
    supported() { return supported; }
    async translate(text, options = {}) {
      calls.push({ text, ...options });
      const response = responses.shift();
      return typeof response === 'function' ? response(text, options) : response ?? `English for ${text}`;
    }
  }
  Object.assign(window, {
    Dictionary, WordLevels, frequencyBand, MAX_TEXT_LENGTH, MAX_SELECTION_LENGTH,
    MAX_TRANSLATION_LENGTH, LocalTranslator, hasHan, normalizeText, validSavedState, tokensWithOverrides,
  });
  window.matchMedia = () => ({ matches: false });
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.confirm = () => true;
  if (stored !== undefined) window.localStorage.setItem(KEY, typeof stored === 'string' ? stored : JSON.stringify(stored));
  window.localStorage.setItem('hanzi-study-stars-v1', '["100:实"]');
  window.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === './data/levels.json?v=1') return { ok: true, json: async () => levelData };
    assert.equal(url, './data/dictionary.json', 'Only the local reader datasets may be fetched');
    return { ok: true, json: async () => ({ meta: { format: 1 }, entries: rows }) };
  };
  const context = dom.getInternalVMContext();
  const run = (code) => vm.runInContext(code, context);
  vm.runInContext(source, context);
  await run('loadPromise');
  await run('levelsPromise');
  const get = (id) => window.document.getElementById(id);
  const saved = () => JSON.parse(window.localStorage.getItem(KEY));
  return {
    window, get, run, calls, responses, requests, errors, saved,
    open(text = '银行出台措施。政府学习。') {
      get('source-text').value = text;
      get('article-title').value = 'Translation reading';
      get('text-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    },
    select(start, end) {
      const spans = [...get('article').querySelectorAll('.source-text')];
      const first = spans.find((node) => Number(node.dataset.start) <= start && Number(node.dataset.start) + node.textContent.length > start);
      const last = spans.find((node) => Number(node.dataset.start) < end && Number(node.dataset.start) + node.textContent.length >= end);
      assert.ok(first && last, `Source nodes exist for range ${start}–${end}`);
      const range = window.document.createRange();
      range.setStart(first.firstChild, start - Number(first.dataset.start));
      range.setEnd(last.firstChild, end - Number(last.dataset.start));
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      run('updateSelection()');
    },
    async translate(start, end, english) {
      if (english !== undefined) responses.push(english);
      this.select(start, end);
      await run('translateSelection()');
    },
    clearSelection() { window.getSelection().removeAllRanges(); },
    sourceText() { return [...get('article').querySelectorAll('.source-text')].map((node) => node.textContent).join(''); },
    annotations() { return [...get('article').querySelectorAll('.translation-span')]; },
  };
}

test('a native sentence selection receives a saved English annotation above its exact source', async (t) => {
  const a = await app(t); a.open();
  await a.translate(0, 7, 'The bank introduced measures.');
  assert.equal(a.calls.length, 1);
  assert.equal(a.calls[0].text, '银行出台措施。');
  const [annotation] = a.annotations();
  assert.ok(annotation);
  assert.equal(annotation.querySelector('.translation-text').textContent, 'The bank introduced measures.');
  assert.equal(annotation.querySelector('.translation-source').querySelectorAll('.source-text').length > 0, true);
  assert.equal(annotation.firstElementChild.classList.contains('translation-annotation'), true);
  assert.deepEqual(a.saved().translations, [{ start: 0, end: 7, source: '银行出台措施。', english: 'The bank introduced measures.', visible: true }]);
  assert.equal(a.sourceText(), '银行出台措施。政府学习。');
  assert.deepEqual(a.errors, []);
});

test('the Translate selection button starts the model from the native selection', async (t) => {
  const a = await app(t); a.open('银行。'); a.select(0, 3);
  const pending = deferred(); a.responses.push(() => pending.promise);
  a.get('translate-selection').click();
  assert.equal(a.calls.length, 1);
  assert.equal(a.calls[0].text, '银行。');
  assert.equal(a.get('translate-selection').disabled, true);
  a.calls[0].onProgress('Downloading the local language pack: 50%.');
  assert.match(a.get('translation-status').textContent, /50%/);
  pending.resolve('The bank.');
  await new Promise((resolve) => a.window.setTimeout(resolve, 0));
  assert.equal(a.get('article').querySelector('.translation-text').textContent, 'The bank.');
  assert.equal(a.get('cancel-translation').hidden, true);
});

test('translation selection is independent of the dictionary 120-character limit and counts Unicode code points', async (t) => {
  const a = await app(t);
  a.open('人'.repeat(MAX_SELECTION_LENGTH + 1));
  a.select(0, MAX_SELECTION_LENGTH + 1);
  assert.equal(a.get('lookup-selection').disabled, true);
  assert.equal(a.get('translate-selection').disabled, false);
  await a.run('translateSelection()');
  assert.equal(a.calls[0].text.length, MAX_SELECTION_LENGTH + 1);

  const atLimit = '𠮷'.repeat(MAX_TRANSLATION_LENGTH);
  a.open(atLimit); a.select(0, atLimit.length);
  assert.equal(a.get('translate-selection').disabled, false);
  await a.run('translateSelection()');
  assert.equal([...a.calls[1].text].length, MAX_TRANSLATION_LENGTH);
  a.open(`${atLimit}𠮷`); a.select(0, atLimit.length + 2);
  assert.equal(a.get('translate-selection').disabled, true);
  await a.run('translateSelection()');
  assert.equal(a.calls.length, 2);
});

test('native selections crossing English and pinyin annotations retain original source offsets', async (t) => {
  const a = await app(t); a.open();
  a.clearSelection(); a.get('article').querySelector('.word').click(); a.get('pin-hint').click();
  await a.translate(2, 6, 'Introduced measures');
  assert.ok(a.get('article').querySelector('.pronunciation'));
  await a.translate(0, 9, 'A longer translation');
  assert.equal(a.calls[1].text, '银行出台措施。政府');
  assert.deepEqual(a.saved().translations.map(({ start, end, source }) => ({ start, end, source })), [{ start: 0, end: 9, source: '银行出台措施。政府' }]);
  a.select(0, 6); a.get('lookup-selection').click();
  assert.equal(a.get('lookup-word').textContent, '银行出台措施');
  assert.equal(a.sourceText(), '银行出台措施。政府学习。');
});

test('partial-word translation keeps the selected character and pinyin controls functional', async (t) => {
  const a = await app(t); a.open('银行。');
  await a.translate(1, 2, 'business');
  assert.equal(a.saved().translations[0].source, '行');
  assert.equal(a.sourceText(), '银行。');
  a.select(1, 2); a.get('lookup-selection').click();
  assert.equal(a.get('lookup-word').textContent, '行');
  assert.equal(a.get('lookup-pinyin').textContent, 'háng');
  a.get('pronunciation-choice').value = '1';
  a.get('pronunciation-choice').dispatchEvent(new a.window.Event('change'));
  assert.equal(a.get('lookup-pinyin').textContent, 'xíng');
  a.get('pin-hint').click();
  assert.equal(a.saved().pins[0].start, 1);
  assert.equal(a.get('article').querySelector('.pronunciation').textContent, 'xíng');
  assert.equal(a.annotations().length, 1);
});

test('annotation text or pinyin alone cannot become translation source', async (t) => {
  const a = await app(t); a.open('银行。');
  a.clearSelection(); a.get('article').querySelector('.word').click(); a.get('pin-hint').click();
  await a.translate(0, 2, 'bank');
  for (const selector of ['.translation-text', '.pronunciation']) {
    a.run('selectionReset()');
    const node = a.get('article').querySelector(selector);
    assert.ok(node);
    const range = a.window.document.createRange(); range.selectNodeContents(node);
    a.clearSelection(); a.window.getSelection().addRange(range); a.run('updateSelection()');
    assert.equal(a.get('translate-selection').disabled, true);
    await a.run('translateSelection()');
  }
  assert.equal(a.calls.length, 1);
});

test('hide/show state survives reload and removing an annotation preserves source and pinyin', async (t) => {
  const a = await app(t); a.open('银行。');
  a.get('article').querySelector('.word').click(); a.get('pin-hint').click();
  await a.translate(0, 3, 'The bank.');
  a.clearSelection(); a.get('article').querySelector('.translation-toggle').click();
  assert.equal(a.saved().translations[0].visible, false);
  assert.equal(a.get('article').querySelector('.translation-toggle').textContent, 'Show translation');
  const b = await app(t, { stored: a.window.localStorage.getItem(KEY) });
  assert.equal(b.calls.length, 0);
  assert.equal(b.get('article').querySelector('.translation-toggle').textContent, 'Show translation');
  assert.equal(b.saved().translations[0].visible, false);
  b.get('article').querySelector('.translation-toggle').click();
  assert.equal(b.saved().translations[0].visible, true);
  assert.equal(b.get('article').querySelector('.translation-toggle').textContent, 'Hide translation');
  b.get('article').querySelector('.translation-remove').click();
  assert.deepEqual(b.saved().translations, []);
  assert.equal(b.annotations().length, 0);
  assert.equal(b.sourceText(), '银行。');
  assert.equal(b.get('article').querySelector('.pronunciation').textContent, 'yín háng');
});

test('reselecting an exact saved range reuses its translation without another model call', async (t) => {
  const a = await app(t); a.open();
  await a.translate(0, 7, 'Saved translation');
  a.clearSelection(); a.get('article').querySelector('.translation-toggle').click();
  await a.translate(0, 7);
  assert.equal(a.calls.length, 1);
  assert.equal(a.annotations().length, 1);
  assert.equal(a.saved().translations[0].visible, true);
  assert.equal(a.get('article').querySelector('.translation-text').textContent, 'Saved translation');
});

test('disjoint translations coexist and overlapping ones are replaced only when the new translation succeeds', async (t) => {
  const a = await app(t); a.open();
  await a.translate(0, 2, 'bank');
  await a.translate(7, 9, 'government');
  const pending = deferred(); a.responses.push(() => pending.promise); a.select(0, 6);
  const work = a.run('translateSelection()');
  assert.deepEqual(a.saved().translations.map((item) => item.english), ['bank', 'government']);
  assert.equal(a.get('translate-selection').disabled, true);
  assert.equal(a.get('cancel-translation').hidden, false);
  await a.run('translateSelection()');
  assert.equal(a.calls.length, 3, 'A second submit must not launch a concurrent translation');
  pending.resolve('The bank introduced measures'); await work;
  assert.deepEqual(a.saved().translations.map((item) => item.english).sort(), ['The bank introduced measures', 'government']);
  assert.equal(a.annotations().length, 2);
  assert.equal(a.get('cancel-translation').hidden, true);
});

test('failed and cancelled replacement requests leave existing annotations intact', async (t) => {
  const a = await app(t); a.open();
  await a.translate(0, 2, 'bank');
  a.responses.push(() => { throw new Error('The translation model could not download.'); });
  await a.translate(0, 6);
  assert.equal(a.saved().translations[0].english, 'bank');
  assert.equal(a.annotations().length, 1);
  assert.match(a.get('translation-status').textContent, /could not|failed|unavailable|error/i);
  const pending = deferred(); a.responses.push(() => pending.promise); a.select(0, 6);
  const work = a.run('translateSelection()');
  a.get('cancel-translation').click();
  assert.equal(a.calls.at(-1).signal.aborted, true);
  pending.resolve('Late cancelled result'); await work;
  assert.equal(a.saved().translations[0].english, 'bank');
  assert.equal(a.annotations().length, 1);
  assert.doesNotMatch(a.get('article').textContent, /Late cancelled result/);
});

test('a cancelled request cannot overwrite progress or completion of a subsequent request', async (t) => {
  const a = await app(t); a.open();
  const old = deferred(); a.responses.push(() => old.promise); a.select(0, 2);
  const oldWork = a.run('translateSelection()');
  a.get('cancel-translation').click();
  const fresh = deferred(); a.responses.push(() => fresh.promise); a.select(7, 9);
  const freshWork = a.run('translateSelection()');
  a.calls[1].onProgress('Current request downloading.');
  a.calls[0].onProgress('Stale request downloading.');
  assert.equal(a.get('translation-status').textContent, 'Current request downloading.');
  old.resolve('Stale result'); await oldWork;
  assert.equal(a.get('translate-selection').disabled, true);
  assert.equal(a.get('cancel-translation').hidden, false);
  fresh.resolve('government'); await freshWork;
  assert.deepEqual(a.saved().translations.map((item) => item.english), ['government']);
  assert.equal(a.get('cancel-translation').hidden, true);
});

for (const action of ['edit', 'new reading', 'forget']) {
  test(`${action} aborts in-flight translation and ignores its late result`, async (t) => {
    const a = await app(t); a.open();
    await a.translate(0, 2, 'bank');
    const pending = deferred(); a.responses.push(() => pending.promise); a.select(0, 6);
    const work = a.run('translateSelection()');
    if (action === 'edit') a.get('edit-text').click();
    else if (action === 'new reading') a.open('政府学习。');
    else a.get('forget-reading').click();
    assert.equal(a.calls.at(-1).signal.aborted, true);
    pending.resolve('Stale result'); await work;
    if (action === 'edit') {
      a.get('resume-reading').click();
      assert.deepEqual(a.saved().translations.map((item) => item.english), ['bank']);
    } else if (action === 'new reading') {
      assert.deepEqual(a.saved().translations, []);
      assert.equal(a.annotations().length, 0);
      assert.equal(a.sourceText(), '政府学习。');
    } else {
      assert.equal(a.window.localStorage.getItem(KEY), null);
      assert.equal(a.get('reading').hidden, true);
      assert.equal(a.window.localStorage.getItem('hanzi-study-stars-v1'), '["100:实"]');
    }
    assert.doesNotMatch(a.get('article').textContent, /Stale result/);
  });
}

test('an unsupported browser shows an explicit local-translation limit without making a fallback request', async (t) => {
  const a = await app(t, { supported: false }); a.open(); a.select(0, 7);
  assert.equal(a.get('translate-selection').disabled, true);
  assert.match(a.get('translation-status').textContent, /not available|unavailable|not support|unsupported|Chrome|Edge/i);
  await a.run('translateSelection()');
  assert.equal(a.calls.length, 0);
  assert.equal(a.annotations().length, 0);
  assert.deepEqual(a.requests.map((request) => request.url), ['./data/dictionary.json', './data/levels.json?v=1']);
  a.select(0, 2); a.get('lookup-selection').click();
  assert.equal(a.get('lookup-pinyin').textContent, 'yín háng');
});

test('translation results and restored annotations are rendered as literal text', async (t) => {
  const a = await app(t); a.open('银行。');
  const english = '<img src="https://attacker.invalid/secret" onerror="alert(1)"><script>evil()</script> bank';
  await a.translate(0, 3, english);
  assert.equal(a.get('article').querySelector('.translation-text').textContent, english);
  assert.equal(a.get('article').querySelector('img,script,svg'), null);
  const b = await app(t, { stored: a.window.localStorage.getItem(KEY) });
  assert.equal(b.get('article').querySelector('.translation-text').textContent, english);
  assert.equal(b.get('article').querySelector('img,script,svg'), null);
  assert.equal(b.requests.length, 2);
  assert.equal(b.sourceText(), '银行。');
});
