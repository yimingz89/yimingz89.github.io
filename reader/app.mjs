import { Dictionary, MAX_TEXT_LENGTH, MAX_SELECTION_LENGTH, hasHan, normalizeText, validSavedState } from './dictionary.mjs?v=3';
import { WordLevels, frequencyBand } from './levels.mjs';
import { LocalTranslator, MAX_TRANSLATION_LENGTH } from './translation.mjs?v=1';
import { getContextPinyin } from './pinyin.mjs?v=1';

const $ = (id) => document.getElementById(id);
const KEY = 'yiming-chinese-reader-v1';
const SAMPLE = '周末，城市慢了下来\n\n周六早上，我走进家附近的一家小书店。窗边坐着几位读者，有人看小说，有人读报纸。店里很安静，只有翻书的声音。\n\n最近，市政府出台了一系列促进消费的措施。一些商店延长了营业时间，银行也推出了新的服务。不过，对我来说，周末最好的安排不是购物，而是找一个安静的地方读书。\n\n读到不认识的词时，我会先试着猜它的意思，再查词典。这样虽然慢一点，却能记得更清楚。学习语言不必着急，每天进步一点就很好。';
const state = { dictionary: null, text: '', title: '', pins: [], showPins: true, fontSize: 26, current: null, pending: null, reading: false, translations: [] };
const localTranslator = new LocalTranslator();
let translationRequest = null;
let loadPromise;
let levelsPromise;
let wordLevels = null;
let levelsStatus = 'loading';
let selectionTimer;
let lastWordFocus = 0;

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function message(text = '', error = false) { $('app-message').textContent = text; $('app-message').dataset.error = String(error); }
function overlapping(a, b) { return a.start < b.end && b.start < a.end; }
function inArticle(lookup) { return lookup && lookup.start >= 0 && state.text.slice(lookup.start, lookup.end) === lookup.text; }
function activeEntry() { return state.current?.exact[state.current.reading || 0]; }

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ text: state.text, title: state.title, pins: state.pins, showPins: state.showPins, fontSize: state.fontSize, translations: state.translations }));
    $('save-status').textContent = 'Saved on this device.';
  } catch {
    $('save-status').textContent = 'Browser storage is unavailable. Keep a copy of your text before closing.';
    message('You can still read, but this browser could not save your text and hints.', true);
  }
}
function restore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const saved = validSavedState(JSON.parse(raw));
    if (!saved) { message('The saved reading could not be restored. Paste your text to start a new reading.', true); return; }
    Object.assign(state, saved);
    // Keep legacy pins in storage, but pronunciation is now shown only as part
    // of a translation. Old dictionary pins must not override contextual pinyin.
    $('source-text').value = state.text;
    $('article-title').value = state.title;
    updateCount();
    if (state.text.trim()) showReading(false);
  } catch { message('Saved reading is unavailable. You can still paste and read without saving.', true); }
}
function updateCount() { $('text-count').textContent = `${$('source-text').value.length.toLocaleString()} / 30,000`; }

function selectionReset() {
  state.pending = null;
  $('lookup-selection').disabled = true;
  $('lookup-selection').textContent = 'Look up selection';
  updateTranslationControls();
}

function translationStatus(text, error = false) {
  $('translation-status').textContent = text;
  $('translation-status').dataset.error = String(error);
}
function updateTranslationControls() {
  const count = state.pending ? [...state.text.slice(state.pending.start, state.pending.end)].length : 0;
  const cached = state.pending && state.translations.some((item) => item.start === state.pending.start && item.end === state.pending.end);
  $('translate-selection').disabled = !!translationRequest || !count || count > MAX_TRANSLATION_LENGTH || (!cached && !localTranslator.supported());
  $('translate-selection').textContent = translationRequest ? 'Translating…' : count > MAX_TRANSLATION_LENGTH ? 'Select up to 1,500 characters' : cached ? 'Show translation' : `Translate selection${count ? ` (${count})` : ''}`;
  $('cancel-translation').hidden = !translationRequest;
}
function cancelTranslation({ quiet = false } = {}) {
  if (!translationRequest) return;
  const request = translationRequest;
  translationRequest = null;
  request.controller.abort();
  updateTranslationControls();
  if (!quiet) translationStatus('Translation canceled. Your reading and saved translations are unchanged.');
}
async function translateSelection() {
  if (translationRequest || !state.reading || !state.pending) return;
  const { start, end } = state.pending;
  const source = state.text.slice(start, end);
  if (!source.trim() || [...source].length > MAX_TRANSLATION_LENGTH) { translationStatus('Select up to 1,500 characters to translate.', true); return; }
  const cached = state.translations.find((item) => item.start === start && item.end === end);
  if (cached) {
    cached.visible = true;
    selectionReset(); persist(); renderArticle();
    translationStatus('Showing saved English and contextual pinyin. No new translation was needed.');
    return;
  }
  if (!localTranslator.supported()) { translationStatus('On-device translation needs a supported desktop Chrome browser. Dictionary and pinyin still work; no text is uploaded.', true); return; }
  if (state.translations.filter((item) => !overlapping(item, { start, end })).length >= 100) { translationStatus('This reading has 100 saved translations. Remove one with × before adding another.', true); return; }
  const request = { controller: new AbortController(), text: state.text, start, end };
  translationRequest = request;
  updateTranslationControls();
  translationStatus('Preparing on-device translation… First use may download a language pack.');
  try {
    // Start in the click handler: Chrome requires user activation to download its model.
    const english = await localTranslator.translate(source, {
      signal: request.controller.signal,
      onProgress: (text) => { if (translationRequest === request) translationStatus(text); },
    });
    if (translationRequest !== request || state.text !== request.text || !state.reading) return;
    if (typeof english !== 'string' || !english.trim() || english.length > 20000) throw new Error('No usable translation was returned. Select a shorter passage and try again.');
    // Only replace overlaps after a successful result; failed requests keep existing hints.
    state.translations = state.translations.filter((item) => !overlapping(item, request));
    state.translations.push({ start, end, source, english: english.trim(), visible: true });
    selectionReset(); persist(); renderArticle();
    translationStatus('English and pinyin shown above your selection. Hide translation hides both. Pronunciation uses the surrounding text; names and ambiguous readings can still be imperfect.');
  } catch (error) {
    if (translationRequest === request) translationStatus(error.name === 'AbortError' ? 'Translation canceled.' : error.message || 'On-device translation failed. Please try again.', error.name !== 'AbortError');
  } finally {
    if (translationRequest === request) { translationRequest = null; updateTranslationControls(); }
  }
}
function choose(start, end, { focus = false } = {}) {
  const text = state.text.slice(start, end);
  if (!text.trim() || text.length > MAX_SELECTION_LENGTH) { message('Select a word or short phrase, up to 120 characters.', true); return; }
  selectionReset();
  $('level-details').open = false;
  const selected = state.dictionary.selection(text, start);
  state.current = { ...selected, meaning: false, reading: 0, characters: false };
  message();
  renderArticle();
  renderLookup();
  $('lookup-panel').scrollTop = 0;
  if (focus) focusWord(start);
  if (window.matchMedia('(max-width: 850px)').matches) {
    window.requestAnimationFrame(() => {
      const word = $('article').querySelector(`.word[data-start="${start}"]`);
      if (word) {
        const rect = word.getBoundingClientRect();
        const toolbarBottom = document.querySelector('.toolbar').getBoundingClientRect().bottom;
        if (rect.top < Math.max(0, toolbarBottom) || rect.bottom > $('lookup-panel').getBoundingClientRect().top) word.scrollIntoView({ block: 'center' });
      }
    });
  }
}
function search(text) {
  const query = text.trim();
  if (!query) { message('Enter a Chinese word or phrase to look up.', true); return; }
  if (query.length > MAX_SELECTION_LENGTH) { message('Look up at most 120 characters at a time.', true); return; }
  const index = state.text.indexOf(query);
  if (index >= 0) choose(index, index + query.length);
  else {
    $('level-details').open = false;
    state.current = { ...state.dictionary.selection(query, -1), meaning: false, reading: 0, characters: false };
    selectionReset(); message(); renderArticle(); renderLookup(); $('lookup-panel').scrollTop = 0;
  }
}
function focusWord(start) {
  const words = [...$('article').querySelectorAll('.word')];
  const target = words.find((node) => Number(node.dataset.start) === start) || words[0];
  for (const word of words) word.tabIndex = word === target ? 0 : -1;
  target?.focus({ preventScroll: true });
}
function renderArticle() {
  const tokens = state.dictionary.segment(state.text);
  const fragment = document.createDocumentFragment();
  let firstWord = true;
  function appendTokens(parent, start, end, translation = null) {
  // Compute from the surrounding reading, not from individual dictionary words
  // or the selected substring. Only render syllables inside this annotation.
  const pronunciations = translation ? new Map(getContextPinyin(state.text, start, end).map((part) => [part.start, part])) : null;
  function appendSource(parent, token) {
    let offset = token.start;
    for (const text of token.text) {
      const source = el('span', text, 'source-text');
      source.dataset.start = String(offset);
      const reading = pronunciations?.get(offset)?.pinyin;
      if (reading) {
        const ruby = el('ruby', undefined, 'pinyin-character');
        const hint = el('rt', reading, 'pronunciation');
        hint.lang = 'zh-Latn-pinyin';
        hint.hidden = !translation.visible;
        hint.setAttribute('aria-hidden', 'true');
        ruby.append(source, hint); parent.append(ruby);
      } else parent.append(source);
      offset += text.length;
    }
  }
  for (const original of tokens) {
    if (original.end <= start || original.start >= end) continue;
    const token = { ...original, start: Math.max(start, original.start), end: Math.min(end, original.end) };
    token.text = state.text.slice(token.start, token.end);
    if (!token.interactive) {
      // Keep closing punctuation with the preceding word at narrow widths.
      const previous = parent.lastElementChild;
      if (/^[，。！？；：、）】」』》〉〕〗〙〛”’…]+$/u.test(token.text) && previous?.matches('.word, .word-tail')) {
        let group = previous;
        if (previous.matches('.word')) {
          group = el('span', undefined, 'word-tail'); previous.replaceWith(group); group.append(previous);
        }
        appendSource(group, token);
      } else appendSource(parent, token);
      continue;
    }
    const word = el('span', undefined, 'word');
    word.dataset.start = String(original.start);
    word.dataset.end = String(original.end);
    word.setAttribute('role', 'button');
    word.tabIndex = firstWord ? 0 : -1;
    firstWord = false;
    const selected = inArticle(state.current) && token.start < state.current.end && token.end > state.current.start;
    word.classList.toggle('is-active', !!selected);
    appendSource(word, token);
    word.setAttribute('aria-label', token.text);
    word.setAttribute('aria-pressed', String(!!selected));
    parent.append(word);
  }
  }
  let cursor = 0;
  for (const item of state.translations.slice().sort((a, b) => a.start - b.start)) {
    appendTokens(fragment, cursor, item.start);
    const group = el('span', undefined, 'translation-span');
    group.dataset.start = String(item.start); group.dataset.end = String(item.end);
    const annotation = el('span', undefined, 'translation-annotation');
    annotation.lang = 'en';
    const english = el('span', item.english, 'translation-text');
    english.id = `translation-${item.start}-${item.end}`;
    english.hidden = !item.visible;
    const controls = el('span', undefined, 'translation-actions');
    const toggle = el('button', item.visible ? 'Hide translation' : 'Show translation', 'translation-toggle');
    toggle.type = 'button'; toggle.setAttribute('aria-expanded', String(item.visible)); toggle.setAttribute('aria-controls', english.id);
    toggle.addEventListener('click', () => {
      item.visible = !item.visible; english.hidden = !item.visible;
      for (const hint of original.querySelectorAll('.pronunciation')) hint.hidden = !item.visible;
      toggle.textContent = item.visible ? 'Hide translation' : 'Show translation';
      toggle.setAttribute('aria-expanded', String(item.visible)); persist();
    });
    const remove = el('button', '×', 'translation-remove');
    remove.type = 'button'; remove.setAttribute('aria-label', `Remove translation for ${item.source}`);
    remove.addEventListener('click', () => {
      state.translations = state.translations.filter((entry) => entry !== item);
      selectionReset(); persist(); renderArticle(); $('translate-selection').focus();
    });
    controls.append(toggle, remove); annotation.append(english, controls);
    const original = el('span', undefined, 'translation-source');
    original.id = `translation-source-${item.start}-${item.end}`;
    toggle.setAttribute('aria-controls', `${english.id} ${original.id}`);
    toggle.title = 'Show or hide English and pinyin together';
    appendTokens(original, item.start, item.end, item);
    group.append(annotation, original); fragment.append(group);
    cursor = item.end;
  }
  appendTokens(fragment, cursor, state.text.length);
  $('article').replaceChildren(fragment);
  $('article').dataset.size = String(state.fontSize);
  $('font-label').textContent = `${state.fontSize} px`;
  $('font-smaller').disabled = state.fontSize === 22;
  $('font-larger').disabled = state.fontSize === 34;
}
function definitions(entries, parent) {
  const list = el('ol', undefined, 'definitions');
  for (const definition of [...new Set(entries.flatMap((entry) => entry.meanings))]) list.append(el('li', definition));
  parent.append(list);
}
function lookupParts() {
  const current = state.current;
  if (!current.characters) return current.parts;
  const parts = [];
  let index = 0;
  for (const character of current.text) {
    if (hasHan(character)) parts.push({ text: character, start: current.start + index, end: current.start + index + character.length });
    index += character.length;
  }
  return parts;
}
function appendLevelBadges(parent, text, { compact = false } = {}) {
  if (!wordLevels) return;
  const { hsk, zipf } = wordLevels.lookup(text);
  if (hsk !== null || !compact) {
    const badge = el('span', hsk === null ? 'HSK · Not listed' : `HSK 3.0 · ${hsk === 7 ? '7–9' : hsk}`, `level-badge hsk-badge${hsk === null ? ' is-unlisted' : ''}`);
    badge.title = hsk === null ? 'No exact entry in the HSK 3.0 (2021) vocabulary list; this does not mean advanced.' : `HSK 3.0 (2021) vocabulary ${hsk === 7 ? 'band 7–9' : `level ${hsk}`}. Exact word, not character level.`;
    parent.append(badge);
  }
  if (zipf !== null || !compact) {
    const badge = el('span', zipf === null ? 'Frequency · Unknown' : `Freq · ${frequencyBand(zipf)}`, `level-badge frequency-badge${zipf === null ? ' is-unlisted' : ''}`);
    badge.title = zipf === null ? 'No exact token in the frequency data. No score is inferred from component words.' : `Zipf ${zipf.toFixed(2)} · approximate word frequency; higher means more frequent.`;
    parent.append(badge);
  }
}
function renderLevelMetadata() {
  $('level-badges').replaceChildren();
  $('level-status').textContent = levelsStatus === 'loading' ? 'Loading word levels…' : levelsStatus === 'error' ? 'Word levels unavailable. Dictionary lookup still works.' : '';
  $('level-status').hidden = levelsStatus === 'ready';
  $('retry-levels').hidden = levelsStatus !== 'error';
  $('level-details').hidden = !wordLevels || !state.current;
  if (!state.current || !wordLevels) return;
  appendLevelBadges($('level-badges'), state.current.text);
  const { zipf } = wordLevels.lookup(state.current.text);
  $('level-exact-note').textContent = `Ratings are for “${state.current.text}” as a whole.${zipf === null ? ' No exact frequency record.' : ` Frequency: Zipf ${zipf.toFixed(2)} (higher = more frequent).`}`;
}
function renderLookup() {
  const current = state.current;
  $('lookup-empty').hidden = !!current;
  $('lookup-result').hidden = !current;
  $('close-lookup').hidden = !current;
  $('lookup-panel').classList.toggle('has-lookup', !!current);
  document.body.classList.toggle('lookup-open', !!current);
  $('meanings').replaceChildren();
  $('breakdown').replaceChildren();
  renderLevelMetadata();
  if (current) {
    const exact = current.exact.length > 0 && !current.characters;
    $('lookup-word').textContent = current.text;
    $('lookup-kind').textContent = exact ? 'Dictionary entry' : current.characters ? 'Character breakdown' : 'Phrase breakdown';
    $('lookup-pinyin').textContent = exact ? activeEntry().pinyin : '';
    $('lookup-pinyin').hidden = !exact;
    $('reading-choices').hidden = !exact || current.exact.length < 2;
    $('pronunciation-choice').replaceChildren();
    current.exact.forEach((entry, index) => {
      const option = el('option', `${entry.pinyin}${current.exact.filter((item) => item.pinyin === entry.pinyin).length > 1 ? ` · entry ${index + 1}` : ''}`);
      option.value = String(index);
      $('pronunciation-choice').append(option);
    });
    $('pronunciation-choice').value = String(current.reading);
    $('lookup-note').textContent = exact
      ? current.exact.length > 1 ? 'Dictionary alternatives are listed here. Use Translate selection for inline pinyin chosen from the surrounding text.' : 'Try recalling the meaning before revealing it.'
      : current.characters ? 'Character meanings do not always add up to the meaning of the whole word.' : 'No exact dictionary entry for this selection. These are individual word lookups—not a sentence translation.';
    $('show-meaning').textContent = current.meaning ? 'Hide meaning' : exact ? 'Show meaning' : 'Show meanings';
    $('show-meaning').setAttribute('aria-expanded', String(current.meaning));
    $('meanings').hidden = !current.meaning || !exact;
    $('character-mode').hidden = !hasHan(current.text) || [...current.text].length < 2;
    $('character-mode').textContent = current.characters ? 'Back to word / phrase' : 'Look at individual characters';
    $('character-mode').setAttribute('aria-pressed', String(current.characters));
    if (exact && current.meaning) definitions([activeEntry()], $('meanings'));
    if (!exact) {
      const parts = lookupParts();
      if (!parts.length) $('breakdown').append(el('p', 'No Chinese dictionary matches found. Try selecting a shorter Chinese word.', 'fine-print'));
      for (const part of parts) {
        const row = el('div', undefined, 'breakdown-item');
        const button = el('button', part.text, 'part-button');
        button.type = 'button';
        button.lang = 'zh-Hans';
        button.addEventListener('click', () => inArticle(current) ? choose(part.start, part.end) : search(part.text));
        row.append(button);
        const entries = state.dictionary.lookup(part.text);
        row.append(el('span', entries.length ? [...new Set(entries.map((entry) => entry.pinyin))].join(' / ') : 'No entry', 'part-pinyin'));
        const badges = el('div', undefined, 'level-badges part-levels');
        appendLevelBadges(badges, part.text, { compact: true });
        if (badges.childNodes.length) row.append(badges);
        if (current.meaning && entries.length) definitions(entries, row);
        $('breakdown').append(row);
      }
    }
  }
}
function closeLookup({ focus = false } = {}) {
  const start = state.current?.start ?? lastWordFocus;
  state.current = null;
  selectionReset(); renderArticle(); renderLookup();
  if (focus) focusWord(start);
}
// Count only original source spans in a DOM selection; visible pinyin is never
// copied into the lookup, even when a selection crosses a translation annotation.
function sourceOffset(container, offset) {
  const range = document.createRange();
  range.selectNodeContents($('article'));
  range.setEnd(container, offset);
  return [...range.cloneContents().querySelectorAll('.source-text')].reduce((sum, node) => sum + node.textContent.length, 0);
}
function updateSelection() {
  if (!state.reading) return;
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) {
    // Keep the captured range while keyboard focus moves to a selection action.
    if (!['lookup-selection', 'translate-selection'].includes(document.activeElement?.id)) selectionReset();
    return;
  }
  const range = selection.getRangeAt(0);
  if (!$('article').contains(range.startContainer) || !$('article').contains(range.endContainer)) { selectionReset(); return; }
  const isHint = (node) => (node.nodeType === 1 ? node : node.parentElement)?.closest('.pronunciation, .translation-annotation');
  if (isHint(range.startContainer) || isHint(range.endContainer)) { selectionReset(); return; }
  let start = sourceOffset(range.startContainer, range.startOffset);
  let end = sourceOffset(range.endContainer, range.endOffset);
  while (start < end && /\s/u.test(state.text[start])) start++;
  while (end > start && /\s/u.test(state.text[end - 1])) end--;
  // Never send a partial surrogate pair if a DOM range bisects a Unicode character.
  if (start > 0 && /[\uDC00-\uDFFF]/u.test(state.text[start]) && /[\uD800-\uDBFF]/u.test(state.text[start - 1])) start--;
  if (end < state.text.length && /[\uDC00-\uDFFF]/u.test(state.text[end]) && /[\uD800-\uDBFF]/u.test(state.text[end - 1])) end++;
  if (start === end) { selectionReset(); return; }
  state.pending = { start, end };
  $('lookup-selection').disabled = end - start > MAX_SELECTION_LENGTH;
  $('lookup-selection').textContent = end - start > MAX_SELECTION_LENGTH ? 'Select up to 120 characters' : `Look up selection (${[...state.text.slice(start, end)].length})`;
  updateTranslationControls();
}
function showReading(focus = true) {
  state.reading = true;
  $('editor').hidden = true; $('reading').hidden = false; $('forget-reading').hidden = false;
  $('reading-title').textContent = state.title || 'Untitled reading';
  $('reading-count').textContent = `${[...state.text].filter((character) => hasHan(character)).length.toLocaleString()} Chinese characters`;
  renderArticle(); renderLookup();
  if (focus) { $('reading-title').focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }
}
function startReading() {
  if (!state.dictionary) { message('The dictionary is still loading. Please try again in a moment.', true); return; }
  const text = normalizeText($('source-text').value);
  if (!text.trim()) { message('Paste some Chinese text first, or try the sample.', true); $('source-text').focus(); return; }
  if (text.length > MAX_TEXT_LENGTH) { message('Please keep each reading under 30,000 characters.', true); return; }
  if (text !== state.text) { cancelTranslation({ quiet: true }); state.pins = []; state.current = null; state.showPins = true; state.translations = []; resetTranslationStatus(); }
  state.text = text; state.title = $('article-title').value.trim().slice(0, 120);
  selectionReset(); message(); persist(); showReading();
}
function bindEvents() {
  $('text-form').addEventListener('submit', (event) => { event.preventDefault(); startReading(); });
  $('source-text').addEventListener('input', updateCount);
  $('source-text').addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); startReading(); } });
  $('sample').addEventListener('click', () => {
    if ($('source-text').value.trim() && !window.confirm('Replace the text in the paste box with the sample? Your current reading remains available until you start the new one.')) return;
    $('article-title').value = '周末，城市慢了下来'; $('source-text').value = SAMPLE; updateCount(); $('source-text').focus();
  });
  $('edit-text').addEventListener('click', () => {
    cancelTranslation({ quiet: true }); selectionReset(); resetTranslationStatus();
    state.reading = false; $('reading').hidden = true; $('editor').hidden = false; document.body.classList.remove('lookup-open');
    $('source-text').value = state.text; $('article-title').value = state.title; $('resume-reading').hidden = false; updateCount(); window.scrollTo({ top: 0 }); $('source-text').focus();
  });
  $('resume-reading').addEventListener('click', () => showReading());
  $('forget-reading').addEventListener('click', () => {
    if (!window.confirm('Forget the reader’s saved text, pinned hints, and translations on this browser? Your flashcards are not affected.')) return;
    try { localStorage.removeItem(KEY); } catch { message('This browser could not remove the saved reading.', true); return; }
    cancelTranslation({ quiet: true });
    Object.assign(state, { text: '', title: '', pins: [], current: null, pending: null, reading: false, showPins: true, translations: [] });
    selectionReset(); resetTranslationStatus();
    $('source-text').value = ''; $('article-title').value = ''; $('reading').hidden = true; $('editor').hidden = false;
    $('forget-reading').hidden = true; $('resume-reading').hidden = true; document.body.classList.remove('lookup-open'); updateCount(); message('Saved reading removed from this browser.');
  });
  $('article').addEventListener('click', (event) => {
    if (event.target.closest('.translation-annotation')) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && $('article').contains(selection.anchorNode)) { updateSelection(); return; }
    const word = event.target.closest('.word');
    if (word) choose(Number(word.dataset.start), Number(word.dataset.end));
  });
  $('article').addEventListener('keydown', (event) => {
    const word = event.target.closest('.word');
    if (!word || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(Number(word.dataset.start), Number(word.dataset.end), { focus: true }); }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); const words = [...$('article').querySelectorAll('.word')]; const index = words.indexOf(word);
      const next = words[index + (event.key === 'ArrowRight' ? 1 : -1)];
      if (next) {
        lastWordFocus = Number(next.dataset.start);
        // Split source fragments may share dictionary offsets; focus this DOM
        // fragment rather than finding the first fragment of the original word.
        for (const item of words) item.tabIndex = item === next ? 0 : -1;
        next.focus({ preventScroll: true });
      }
    }
  });
  document.addEventListener('selectionchange', () => { window.clearTimeout(selectionTimer); selectionTimer = window.setTimeout(updateSelection, 40); });
  $('article').addEventListener('pointerup', updateSelection);
  $('lookup-selection').addEventListener('mousedown', (event) => event.preventDefault());
  $('lookup-selection').addEventListener('click', () => { if (state.pending) choose(state.pending.start, state.pending.end); });
  $('translate-selection').addEventListener('mousedown', (event) => event.preventDefault());
  $('translate-selection').addEventListener('click', () => { void translateSelection(); });
  $('cancel-translation').addEventListener('click', () => cancelTranslation());
  $('lookup-form').addEventListener('submit', (event) => { event.preventDefault(); search($('lookup-input').value); });
  $('close-lookup').addEventListener('click', () => closeLookup({ focus: !window.matchMedia('(max-width:850px)').matches }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.current && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) closeLookup({ focus: true }); });
  $('show-meaning').addEventListener('click', () => { if (state.current) { state.current.meaning = !state.current.meaning; renderLookup(); } });
  $('character-mode').addEventListener('click', () => { if (state.current) { state.current.characters = !state.current.characters; state.current.meaning = false; renderArticle(); renderLookup(); } });
  $('pronunciation-choice').addEventListener('change', () => {
    if (!state.current) return;
    state.current.reading = Number($('pronunciation-choice').value);
    renderArticle(); renderLookup();
  });
  for (const [id, delta] of [['font-smaller', -4], ['font-larger', 4]]) $(id).addEventListener('click', () => { state.fontSize = Math.max(22, Math.min(34, state.fontSize + delta)); renderArticle(); persist(); });
  $('retry-dictionary').addEventListener('click', () => loadDictionary());
  $('retry-levels').addEventListener('click', () => loadLevels());
}
function resetTranslationStatus() {
  translationStatus(localTranslator.supported()
    ? 'Select text, then Translate selection for English + contextual pinyin. Both stay on your device. First use downloads Chrome’s language pack; no account or API charges.'
    : 'On-device translation is unavailable in this browser. Use a supported desktop Chrome browser. Dictionary, pinyin, and saved translations still work.');
}
function registerTools() {
  const context = document.modelContext || navigator.modelContext;
  if (!context?.registerTool) return;
  const tools = [{
    name: 'look_up_reader_text', title: 'Look up text in Chinese Reader',
    description: 'Select a word or phrase already in the current reading and reveal its dictionary pinyin, keeping English hidden.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute({ text }) {
      if (!state.reading || typeof text !== 'string' || !text.trim() || text.length > MAX_SELECTION_LENGTH) throw new Error('Open a reading and choose up to 120 characters.');
      const index = state.text.indexOf(text);
      if (index < 0) throw new Error('The selected text is not in this reading.');
      choose(index, index + text.length);
      return { text: state.current.text, pinyin: activeEntry()?.pinyin || null, exactEntry: state.current.exact.length > 0, meaningVisible: false };
    },
  }];
  for (const tool of tools) { try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch {} }
}
async function loadDictionary() {
  if (loadPromise) return loadPromise;
  $('retry-dictionary').hidden = true; $('start-reading').disabled = true;
  $('dictionary-status').textContent = 'Loading dictionary…';
  loadPromise = (async () => {
    try {
      const response = await fetch('./data/dictionary.json');
      if (!response.ok) throw new Error(`Dictionary HTTP ${response.status}`);
      const data = await response.json();
      if (data.meta?.format !== 1 || !Array.isArray(data.entries) || !data.entries.length) throw new Error('Invalid dictionary');
      state.dictionary = new Dictionary(data.entries);
      $('dictionary-status').textContent = `${data.entries.length.toLocaleString()} dictionary entries · ready`;
      $('start-reading').disabled = false;
      message(); restore(); registerTools();
    } catch {
      $('dictionary-status').textContent = 'Dictionary unavailable'; $('retry-dictionary').hidden = false;
      message('The dictionary could not load. Check your connection and choose Retry dictionary. Your text has not been uploaded.', true);
    } finally { loadPromise = null; }
  })();
  return loadPromise;
}
async function loadLevels() {
  if (levelsPromise) return levelsPromise;
  levelsStatus = 'loading'; renderLevelMetadata();
  levelsPromise = (async () => {
    try {
      const response = await fetch('./data/levels.json?v=1');
      if (!response.ok) throw new Error(`Word levels HTTP ${response.status}`);
      wordLevels = new WordLevels(await response.json());
      levelsStatus = 'ready';
    } catch {
      wordLevels = null; levelsStatus = 'error';
    } finally {
      levelsPromise = null;
      renderLookup();
    }
  })();
  return levelsPromise;
}
bindEvents();
resetTranslationStatus();
updateTranslationControls();
void loadDictionary();
void loadLevels();
