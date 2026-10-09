// Count Unicode code points: a supplementary Han character counts as one.
export const MAX_TRANSLATION_LENGTH = 1500;

const LANGUAGES = { sourceLanguage: 'zh', targetLanguage: 'en' };
const MODEL_TIMEOUT_MS = 180000;
const TRANSLATION_TIMEOUT_MS = 30000;

class TranslationError extends Error {}

function cancelled() {
  const error = new TranslationError('Translation cancelled.');
  error.name = 'AbortError';
  return error;
}

function attempt(callback) {
  try { return Promise.resolve(callback()); }
  catch (error) { return Promise.reject(error); }
}

function destroy(instance) {
  try { instance?.destroy?.(); } catch { /* Cleanup must not hide the original error. */ }
}

function dispose(session) {
  if (!session || session.disposed) return;
  session.disposed = true;
  session.controller.abort();
  destroy(session.instance);
}

// Also settle when a browser implementation fails to honor AbortSignal.
function waitFor(promise, operation, timeout, timeoutMessage) {
  return new Promise((resolve, reject) => {
    let timer;
    const signal = operation.controller.signal;
    const finish = (callback, value) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => finish(reject, signal.reason || cancelled());
    Promise.resolve(promise).then((value) => finish(resolve, value), (error) => finish(reject, error));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => operation.cancel(new TranslationError(timeoutMessage)), timeout);
  });
}

/** On-device Chinese → English translation. Constructing this class does no work. */
export class LocalTranslator {
  #session = null;
  #active = null;

  supported() { return typeof globalThis.Translator?.create === 'function'; }

  /** Call directly from a user gesture. A new request cancels an unfinished one. */
  async translate(text, { onProgress = () => {}, signal } = {}) {
    if (signal?.aborted) throw cancelled();
    if (typeof text !== 'string' || !text.trim()) throw new TranslationError('Choose some Chinese text to translate.');
    if ([...text].length > MAX_TRANSLATION_LENGTH) throw new TranslationError('Choose up to 1,500 characters to translate at a time.');
    if (!this.supported()) throw new TranslationError('Local translation is not available in this browser. Try a recent desktop version of Chrome.');

    this.#active?.cancel();
    const operation = { controller: new AbortController(), session: this.#session, cleanups: [] };
    operation.cancel = (reason = cancelled()) => {
      if (operation.controller.signal.aborted) return;
      operation.controller.abort(reason);
      dispose(operation.session);
      if (this.#session === operation.session) this.#session = null;
    };
    this.#active = operation;
    const abort = () => operation.cancel();
    signal?.addEventListener('abort', abort, { once: true });
    const report = (message) => {
      if (!operation.controller.signal.aborted && this.#active === operation) onProgress(message);
    };
    let phase = 'model';
    try {
      if (!operation.session) {
        report('Preparing local translation…');
        const api = globalThis.Translator;
        const session = { controller: new AbortController(), instance: null, disposed: false };
        operation.session = session;
        // Start BOTH calls before the first await, preserving the click's user
        // activation for create(). availability() itself can be asynchronous.
        const availability = attempt(() => api.availability?.(LANGUAGES));
        const creation = attempt(() => api.create({
          ...LANGUAGES,
          signal: session.controller.signal,
          monitor(monitor) {
            const progress = (event) => {
              if (phase !== 'model') return;
              const loaded = Number(event.loaded);
              const percent = Number.isFinite(loaded) ? Math.round(Math.max(0, Math.min(1, loaded)) * 100) : null;
              report(percent === null ? 'Downloading the local translation model…' : `Downloading the local translation model… ${percent}%`);
            };
            monitor.addEventListener('downloadprogress', progress);
            operation.cleanups.push(() => monitor.removeEventListener('downloadprogress', progress));
          },
        })).then((instance) => {
          if (session.disposed) { destroy(instance); throw cancelled(); }
          session.instance = instance;
          if (typeof instance?.translate !== 'function') throw new TranslationError('The browser could not prepare local translation. Please try again.');
          return instance;
        });
        const checkedAvailability = availability.then((status) => {
          if (operation.controller.signal.aborted) throw operation.controller.signal.reason;
          if (status === 'unavailable') throw new TranslationError('Chinese-to-English translation is not available in this browser. Try opening the reader in an up-to-date desktop Google Chrome.');
          if (status === 'downloadable') report('Downloading the local translation model. The first use may take a few minutes…');
          else if (status === 'downloading') report('The local translation model is downloading…');
          else if (status === 'available') report('Local translation model ready.');
          else if (status !== undefined) throw new TranslationError('The browser could not check local translation availability. Please try again.');
        });
        await waitFor(Promise.all([checkedAvailability, creation]), operation, MODEL_TIMEOUT_MS,
          'The local translation model took too long to load. Check your connection and try again.');
        if (operation.controller.signal.aborted) throw operation.controller.signal.reason;
        this.#session = session;
      }
      phase = 'translation';
      report('Translating on this device…');
      const result = await waitFor(attempt(() => operation.session.instance.translate(text, {
        signal: operation.controller.signal,
      })), operation, TRANSLATION_TIMEOUT_MS, 'Local translation took too long. Please try again.');
      if (operation.controller.signal.aborted) throw operation.controller.signal.reason;
      if (typeof result !== 'string' || !result.trim()) throw new TranslationError('The local translator returned no English text. Please try again.');
      return result.trim();
    } catch (error) {
      dispose(operation.session);
      if (this.#session === operation.session) this.#session = null;
      if (operation.controller.signal.aborted) throw operation.controller.signal.reason || cancelled();
      if (error instanceof TranslationError) throw error;
      if (error?.name === 'AbortError') throw cancelled();
      if (error?.name === 'NotSupportedError') throw new TranslationError('Chinese-to-English translation is not available in this browser. Try opening the reader in an up-to-date desktop Google Chrome.');
      if (phase === 'model' && error?.name === 'NotAllowedError') {
        throw new TranslationError('Chrome could not start local translation. Click Translate again and allow the model download if prompted.');
      }
      throw new TranslationError(phase === 'model'
        ? 'The local translation model could not be prepared. Check your connection and try again.'
        : 'Local translation failed. Please try again.');
    } finally {
      signal?.removeEventListener('abort', abort);
      for (const cleanup of operation.cleanups) cleanup();
      if (this.#active === operation) this.#active = null;
    }
  }
}
