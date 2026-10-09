import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Dictionary, pinyinMarks, MAX_TEXT_LENGTH, MAX_SELECTION_LENGTH, hasHan, normalizeText, validSavedState, tokensWithOverrides } from '../reader/dictionary.mjs';
import { WordLevels, frequencyBand } from '../reader/levels.mjs';
import { MAX_TRANSLATION_LENGTH } from '../reader/translation.mjs';

const rows = [
  ['银行', 'yin2 hang2', 'bank', '銀行'], ['银', 'yin2', 'silver', '銀'],
  ['行', 'hang2', 'line of business', '行'], ['行', 'xing2', 'to walk/to go', '行'],
  ['政府', 'zheng4 fu3', 'government', '政府'], ['出台', 'chu1 tai2', 'to officially launch (a policy)/to appear on stage', '出臺'],
  ['措施', 'cuo4 shi1', 'measure/step', '措施'], ['了', 'le5', 'completed action particle', '了'],
  ['不约而同', 'bu4 yue1 er2 tong2', 'by chance without prior agreement', '不約而同'],
  ['人', 'ren2', 'person', '人'], ['绿', 'lu:4', 'green', '綠'], ['学习', 'xue2 xi2', 'to study', '學習'],
];
const fixture = new Dictionary(rows);
const levelData = { meta: { format: 1, hskEdition: 'HSK 3.0 (2021)' }, entries: [
  ['银行', 2, 5.34], ['政府', 4, 5.71], ['出台', 7, 4.32], ['措施', 5, 4.83],
  ['不约而同', 7, 3.11], ['行', 1, 5.86], ['辱', null, 3.56], ['侮辱', 7, 4.26],
] };
const html = readFileSync(new URL('../reader/index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../reader/app.mjs', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
const KEY = 'yiming-chinese-reader-v1';

async function app(t, { stored, failFetch = false, failSave = false, mobile = false, failLevels = false, invalidLevels = false, deferLevels = false } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM(html, { url: 'https://reader.test/reader/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  t.after(() => dom.window.close());
  const { window } = dom;
  const requests = [];
  let requestsFail = failFetch;
  let levelsFail = failLevels;
  let releaseLevels;
  const levelGate = deferLevels ? new Promise((resolve) => { releaseLevels = resolve; }) : Promise.resolve();
  Object.assign(window, { Dictionary, WordLevels, frequencyBand, MAX_TEXT_LENGTH, MAX_SELECTION_LENGTH, hasHan, normalizeText, validSavedState, tokensWithOverrides, MAX_TRANSLATION_LENGTH,
    LocalTranslator: class { supported() { return false; } } });
  window.matchMedia = () => ({ matches: mobile });
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.confirm = () => true;
  if (stored !== undefined) window.localStorage.setItem(KEY, typeof stored === 'string' ? stored : JSON.stringify(stored));
  window.localStorage.setItem('hanzi-study-stars-v1', '["100:实"]');
  if (failSave) window.Storage.prototype.setItem = () => { throw new Error('Quota exceeded'); };
  window.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === './data/levels.json?v=1') {
      await levelGate;
      if (levelsFail) throw new Error('levels offline');
      return { ok: true, json: async () => invalidLevels ? { meta: {} } : levelData };
    }
    assert.equal(url, './data/dictionary.json');
    if (requestsFail) throw new Error('offline');
    return { ok: true, json: async () => ({ meta: { format: 1 }, entries: rows }) };
  };
  const tools = new Map();
  window.document.modelContext = { registerTool: (tool) => tools.set(tool.name, tool) };
  const context = dom.getInternalVMContext();
  vm.runInContext(source, context);
  await vm.runInContext('loadPromise', context);
  if (!deferLevels) await vm.runInContext('levelsPromise', context);
  const get = (id) => window.document.getElementById(id);
  return {
    window, get, errors, requests, tools,
    run: (code) => vm.runInContext(code, context),
    recoverFetch: () => { requestsFail = false; },
    recoverLevels: () => { levelsFail = false; },
    async finishLevels() { releaseLevels(); await vm.runInContext('levelsPromise', context); },
    open(text = '政府出台了措施。银行学习。', title = 'Test reading') {
      get('source-text').value = text; get('article-title').value = title;
      get('text-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    },
    select(text) { return tools.get('look_up_reader_text').execute({ text }); },
    clickWord(text) {
      const word = [...get('article').querySelectorAll('.word')].find((word) => word.querySelector('.source-text').textContent === text);
      assert.ok(word, `Word ${text} exists`); word.click();
    },
    sourceText() { return [...get('article').querySelectorAll('.source-text')].map((node) => node.textContent).join(''); },
  };
}

test('tone marks handle placement, ü, neutral tones, capitals, and syllabic nasals', () => {
  for (const [input, expected] of [
    ['yin2 hang2', 'yín háng'], ['lu:4 nv3', 'lǜ nǚ'], ['shui3 liu2 gui4', 'shuǐ liú guì'],
    ['Bei3 jing1', 'Běi jīng'], ['ma5 r5', 'ma r'], ['ou3 ai4', 'ǒu ài'], ['m2 ng3', 'ḿ nǧ'],
  ]) assert.equal(pinyinMarks(input), expected);
});

test('dictionary preserves word readings and all alternatives for ambiguous characters', () => {
  assert.equal(fixture.lookup('银行')[0].pinyin, 'yín háng');
  assert.deepEqual(fixture.lookup('行').map((entry) => entry.pinyin), ['háng', 'xíng']);
  assert.equal(fixture.lookup('not-in-dictionary').length, 0);
  assert.equal(fixture.selection('政府出台措施').exact.length, 0);
  assert.equal(fixture.selection('不约而同').exact.length, 1);
});

test('segmentation preserves punctuation, whitespace, mixed text and surrogate pairs', () => {
  for (const dict of [fixture, new Dictionary(rows, { useSegmenter: false })]) {
    const text = '政府出台了措施。\n\n银行 — AI 2026 😀 𠮷';
    const tokens = dict.segment(text);
    assert.equal(tokens.map((token) => token.text).join(''), text);
    for (const token of tokens) assert.equal(text.slice(token.start, token.end), token.text);
    assert.ok(tokens.some((token) => token.text === '银行'));
  }
  assert.equal(normalizeText('一\r\n二\r三'), '一\n二\n三');
});

test('saved-state validation rejects oversized content and removes invalid or overlapping pins', () => {
  assert.equal(validSavedState({ text: 'x'.repeat(MAX_TEXT_LENGTH + 1) }), null);
  assert.equal(validSavedState({ text: 5 }), null);
  const value = validSavedState({ text: '银行学习', fontSize: 500, pins: [
    { start: 0, end: 2, pinyin: 'yín háng' }, { start: 1, end: 3, pinyin: 'bad overlap' }, { start: -1, end: 4, pinyin: 'bad range' },
  ] });
  assert.equal(value.pins.length, 1);
  assert.equal(value.fontSize, 26);
});

test('pinned / selected ranges preserve exact original text', () => {
  const text = '银行不约而同学习';
  const tokens = tokensWithOverrides(text, fixture, [{ start: 2, end: 6 }]);
  assert.equal(tokens.map((token) => token.text).join(''), text);
  assert.ok(tokens.some((token) => token.text === '不约而同'));
});

test('saved translations reject mismatched, overlapping, huge, and half-surrogate ranges', () => {
  const text = '银行𠮷学习';
  const saved = validSavedState({ text, translations: [
    { start: 0, end: 2, source: '银行', english: 'Bank', visible: false },
    { start: 1, end: 2, source: '行', english: 'Overlapping' },
    { start: 2, end: 3, source: text.slice(2, 3), english: 'Half character' },
    { start: 4, end: 6, source: 'Wrong', english: 'Wrong source' },
    { start: 4, end: 6, source: '学习', english: 'x'.repeat(20001) },
    null,
  ] });
  assert.deepEqual(saved.translations, [{ start: 0, end: 2, source: '银行', english: 'Bank', visible: false }]);
  assert.deepEqual(validSavedState({ text }).translations, []);
});

test('arrow navigation advances across fragments when a translation splits a dictionary word', async (t) => {
  const a = await app(t, { stored: { text: '银行政府。', translations: [{ start: 1, end: 2, source: '行', english: 'Banking', visible: true }] } });
  const words = [...a.get('article').querySelectorAll('.word')];
  assert.equal(words[0].dataset.start, words[1].dataset.start);
  words[0].focus();
  words[0].dispatchEvent(new a.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  assert.equal(a.window.document.activeElement, words[1]);
  words[1].dispatchEvent(new a.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  assert.equal(a.window.document.activeElement, words[2]);
});

test('paste and read is pinyin-free initially; tapping reveals pinyin before English', async (t) => {
  const a = await app(t); a.open();
  assert.equal(a.get('reading').hidden, false);
  assert.equal(a.get('article').querySelectorAll('.pronunciation').length, 0);
  a.clickWord('银行');
  assert.equal(a.get('lookup-pinyin').textContent, 'yín háng');
  assert.equal(a.get('meanings').hidden, true);
  assert.equal(a.get('meanings').textContent, '');
  assert.equal(a.get('article').querySelectorAll('.pronunciation').length, 1);
  a.get('show-meaning').click();
  assert.equal(a.get('meanings').hidden, false);
  assert.match(a.get('meanings').textContent, /bank/);
  a.clickWord('政府');
  assert.equal(a.get('meanings').textContent, '');
  assert.equal(a.get('meanings').hidden, true);
  assert.deepEqual(a.errors, []);
});

test('pins survive reload and hide/show toggles without deleting pins', async (t) => {
  const a = await app(t); a.open(); a.select('银行'); a.get('pin-hint').click();
  a.select('出台');
  assert.equal(a.get('article').querySelectorAll('.pronunciation').length, 2);
  a.get('toggle-hints').click();
  assert.equal(a.get('article').querySelectorAll('.pronunciation').length, 0);
  assert.equal(a.get('pin-count').textContent, '1');
  a.get('toggle-hints').click();
  const b = await app(t, { stored: a.window.localStorage.getItem(KEY) });
  assert.equal(b.get('reading').hidden, false);
  assert.equal(b.get('pin-count').textContent, '1');
  assert.equal(b.get('article').querySelector('.pronunciation').textContent, 'yín háng');
  assert.equal(b.get('lookup-result').hidden, true);
});

test('phrase lookup uses exact entries or explicitly labeled component definitions', async (t) => {
  const a = await app(t); a.open('政府出台措施。不约而同。');
  a.select('政府出台措施');
  assert.match(a.get('lookup-note').textContent, /not a sentence translation/);
  assert.equal(a.get('breakdown').querySelectorAll('.breakdown-item').length, 3);
  assert.equal(a.get('breakdown').querySelectorAll('.definitions').length, 0);
  a.get('show-meaning').click();
  assert.match(a.get('breakdown').textContent, /government/);
  assert.equal(a.get('pin-hint').disabled, true);
  a.select('不约而同');
  assert.equal(a.get('lookup-pinyin').textContent, 'bù yuē ér tóng');
  assert.equal(a.get('pin-hint').disabled, false);
});

test('native phrase selection excludes displayed pinyin and preserves offsets', async (t) => {
  const a = await app(t); a.open('银行出台措施。'); a.select('银行'); a.get('pin-hint').click();
  const spans = [...a.get('article').querySelectorAll('.source-text')];
  const start = spans.find((node) => node.textContent === '银行').firstChild;
  const end = spans.find((node) => node.textContent === '措施').firstChild;
  const range = a.window.document.createRange(); range.setStart(start, 0); range.setEnd(end, 2);
  a.window.getSelection().removeAllRanges(); a.window.getSelection().addRange(range);
  a.run('updateSelection()');
  assert.equal(a.get('lookup-selection').disabled, false);
  a.get('lookup-selection').click();
  assert.equal(a.get('lookup-word').textContent, '银行出台措施');
  assert.equal(a.sourceText(), '银行出台措施。');
});

test('native selection inside a compound looks up only the chosen character', async (t) => {
  const a = await app(t); a.open('银行。'); a.select('银行');
  const node = a.get('article').querySelector('.source-text').firstChild;
  const range = a.window.document.createRange(); range.setStart(node, 1); range.setEnd(node, 2);
  a.window.getSelection().removeAllRanges(); a.window.getSelection().addRange(range); a.run('updateSelection()'); a.get('lookup-selection').click();
  assert.equal(a.get('lookup-word').textContent, '行');
  assert.equal(a.get('reading-choices').hidden, false);
  a.get('pronunciation-choice').value = '1';
  a.get('pronunciation-choice').dispatchEvent(new a.window.Event('change'));
  assert.equal(a.get('lookup-pinyin').textContent, 'xíng');
});

test('manual dictionary search is local and outside words cannot be pinned onto an article', async (t) => {
  const a = await app(t); a.open('政府。');
  a.get('lookup-input').value = '银行';
  a.get('lookup-form').dispatchEvent(new a.window.Event('submit', { cancelable: true }));
  assert.equal(a.get('lookup-word').textContent, '银行');
  assert.equal(a.get('pin-hint').disabled, true);
  assert.deepEqual(a.requests, [{ url: './data/dictionary.json', options: undefined }, { url: './data/levels.json?v=1', options: undefined }]);
});

test('punctuation stays with words; repeated-word pins affect only the chosen occurrence', async (t) => {
  const a = await app(t); a.open('银行，银行。');
  assert.equal(a.get('article').querySelectorAll('.word-tail').length, 2);
  assert.equal(a.sourceText(), '银行，银行。');
  const words = a.get('article').querySelectorAll('.word'); words[1].click();
  a.get('pin-hint').click(); a.get('close-lookup').click();
  const pin = JSON.parse(a.window.localStorage.getItem(KEY)).pins[0];
  assert.equal(pin.start, 3);
  assert.equal(a.get('article').querySelectorAll('.pronunciation').length, 1);
});

test('empty, excessive, and unknown text have safe, explicit outcomes', async (t) => {
  const a = await app(t); a.open(' ');
  assert.match(a.get('app-message').textContent, /Paste some Chinese/);
  a.open('人'.repeat(MAX_TEXT_LENGTH + 1));
  assert.match(a.get('app-message').textContent, /under 30,000/);
  a.open('𠮷。'); a.clickWord('𠮷');
  assert.match(a.get('breakdown').textContent, /No entry/);
  assert.equal(a.get('pin-hint').disabled, true);
});

test('untrusted pasted HTML and titles are rendered as text, never as markup or network calls', async (t) => {
  const a = await app(t);
  const text = '<img src="https://attacker.invalid/secret" onerror="alert(1)">银行<script>evil()</script>';
  a.open(text, '<svg onload=evil()>');
  assert.equal(a.sourceText(), text);
  assert.equal(a.get('article').querySelector('img,script,svg'), null);
  assert.equal(a.get('reading-title').querySelector('svg'), null);
  assert.equal(a.requests.length, 2);
  assert.match(html, /connect-src 'self'/);
  assert.doesNotMatch(source, /firebase|googleapis|innerHTML|outerHTML|eval\(/);
});

test('storage failure and dictionary fetch failure produce actionable messages', async (t) => {
  const a = await app(t, { failSave: true }); a.open('银行。');
  assert.match(a.get('save-status').textContent, /storage is unavailable/);
  assert.equal(a.get('reading').hidden, false);
  const b = await app(t, { failFetch: true });
  assert.equal(b.get('start-reading').disabled, true);
  assert.equal(b.get('retry-dictionary').hidden, false);
  b.recoverFetch(); await b.run('loadDictionary()');
  assert.equal(b.get('start-reading').disabled, false);
  assert.equal(b.get('retry-dictionary').hidden, true);
});

test('new readings clear stale pins; forgetting the reader never touches flashcard storage', async (t) => {
  const a = await app(t); a.open('银行。'); a.select('银行'); a.get('pin-hint').click();
  a.open('政府。'); assert.equal(a.get('pin-count').textContent, '0');
  a.window.confirm = () => false; a.get('forget-reading').click();
  assert.ok(a.window.localStorage.getItem(KEY));
  a.window.confirm = () => true; a.get('forget-reading').click();
  assert.equal(a.window.localStorage.getItem(KEY), null);
  assert.equal(a.window.localStorage.getItem('hanzi-study-stars-v1'), '["100:实"]');
  assert.equal(a.get('editor').hidden, false);
});

test('keyboard lookup, font bounds, character breakdown, and mobile close state work', async (t) => {
  const a = await app(t, { mobile: true }); a.open('银行。');
  const word = a.get('article').querySelector('.word');
  word.dispatchEvent(new a.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(a.get('lookup-word').textContent, '银行');
  assert.equal(a.get('lookup-panel').classList.contains('has-lookup'), true);
  a.get('character-mode').click();
  assert.equal(a.get('breakdown').querySelectorAll('.part-button').length, 2);
  a.get('close-lookup').click();
  assert.equal(a.window.document.body.classList.contains('lookup-open'), false);
  for (let i = 0; i < 10; i++) a.get('font-larger').click();
  assert.equal(a.get('article').dataset.size, '34');
  assert.equal(a.get('font-larger').disabled, true);
});

test('bundled production dictionary includes provenance and real simplified word readings', () => {
  const data = JSON.parse(readFileSync(new URL('../reader/data/dictionary.json', import.meta.url), 'utf8'));
  assert.equal(data.meta.entries, data.entries.length);
  assert.ok(data.entries.length > 100000);
  assert.equal(data.meta.license, 'CC BY-SA 4.0');
  const dictionary = new Dictionary(data.entries);
  assert.equal(dictionary.lookup('银行')[0].pinyin, 'yín háng');
  assert.ok(dictionary.lookup('出台').some((entry) => entry.meanings.some((meaning) => meaning.includes('policy'))));
  const text = '政府出台了一系列促进消费的措施。';
  assert.equal(dictionary.segment(text).map((part) => part.text).join(''), text);
});

test('ratings require exact word matches and valid, edition-tagged values', () => {
  const levels = new WordLevels(levelData);
  assert.deepEqual(levels.lookup('银行'), { hsk: 2, zipf: 5.34 });
  assert.deepEqual(levels.lookup('银行政府'), { hsk: null, zipf: null });
  assert.deepEqual(levels.lookup('__proto__'), { hsk: null, zipf: null });
  for (const [score, band] of [[6, 'Extremely common'], [5, 'Very common'], [4, 'Common'], [3, 'Less common'], [2.99, 'Rare'], [0, null], [null, null], [NaN, null]]) assert.equal(frequencyBand(score), band);
  assert.throws(() => new WordLevels({ ...levelData, meta: { format: 1, hskEdition: 'HSK 2.0' } }));
  for (const row of [['字', 8, 4], ['字', 1, 0], ['字', 1, '4'], ['字', 1]]) assert.throws(() => new WordLevels({ ...levelData, entries: [row] }));
});

test('word levels are visible before English; advanced band and details are explicit', async (t) => {
  const a = await app(t); a.open('银行不约而同。'); a.select('银行');
  assert.match(a.get('level-badges').textContent, /HSK 3.0 · 2/);
  assert.match(a.get('level-badges').textContent, /Freq · Very common/);
  assert.match(a.get('level-exact-note').textContent, /Zipf 5.34/);
  assert.match(a.get('level-details').textContent, /2021 vocabulary standard/);
  assert.equal(a.get('meanings').hidden, true);
  assert.equal(a.get('meanings').textContent, '');
  a.get('level-details').open = true;
  a.select('不约而同');
  assert.equal(a.get('level-details').open, false);
  assert.match(a.get('level-badges').textContent, /HSK 3.0 · 7–9/);
  a.get('show-meaning').click(); a.get('pin-hint').click();
  assert.match(a.get('level-badges').textContent, /Less common/);
  assert.equal(a.get('pin-count').textContent, '1');
});

test('unlisted is not advanced, unknown frequency is not rare, and breakdowns rate their own words', async (t) => {
  const a = await app(t); a.open('辱。政府出台措施。𠮷。'); a.select('辱');
  assert.match(a.get('level-badges').textContent, /HSK · Not listed/);
  assert.match(a.get('level-badges').textContent, /Less common/);
  a.select('政府出台措施');
  assert.match(a.get('level-badges').textContent, /Frequency · Unknown/);
  assert.doesNotMatch(a.get('level-badges').textContent, /HSK 3.0 · \d|Rare/);
  const parts = [...a.get('breakdown').querySelectorAll('.breakdown-item')];
  assert.match(parts[0].textContent, /政府.*HSK 3.0 · 4/);
  assert.match(parts[1].textContent, /出台.*HSK 3.0 · 7–9/);
  assert.equal(a.get('breakdown').querySelector('.definitions'), null);
  a.select('𠮷');
  assert.match(a.get('level-badges').textContent, /Frequency · Unknown/);
});

test('slow word-level loading does not block reading or change existing pins', async (t) => {
  const a = await app(t, { deferLevels: true }); a.open('银行。'); a.select('银行');
  assert.equal(a.get('start-reading').disabled, false);
  assert.match(a.get('level-status').textContent, /Loading word levels/);
  a.get('pin-hint').click(); a.get('show-meaning').click();
  const saved = a.window.localStorage.getItem(KEY);
  await a.finishLevels();
  assert.match(a.get('level-badges').textContent, /HSK 3.0 · 2/);
  assert.equal(a.get('meanings').hidden, false);
  assert.equal(a.get('pin-count').textContent, '1');
  assert.equal(a.window.localStorage.getItem(KEY), saved);
});

test('ratings network or format errors leave dictionary usable and offer retry', async (t) => {
  for (const options of [{ failLevels: true }, { invalidLevels: true }]) {
    const a = await app(t, options); a.open('银行。'); a.select('银行');
    assert.equal(a.get('lookup-pinyin').textContent, 'yín háng');
    assert.match(a.get('level-status').textContent, /unavailable/);
    assert.equal(a.get('retry-levels').hidden, false);
    assert.equal(a.get('level-badges').textContent, '');
    if (options.failLevels) {
      a.recoverLevels(); await a.run('loadLevels()');
      assert.equal(a.get('retry-levels').hidden, true);
      assert.match(a.get('level-badges').textContent, /HSK 3.0 · 2/);
    }
    assert.deepEqual(a.errors, []);
  }
});

test('production ratings carry licenses and do not conflate character, word, or HSK editions', () => {
  const data = JSON.parse(readFileSync(new URL('../reader/data/levels.json', import.meta.url), 'utf8'));
  assert.equal(data.meta.entries, data.entries.length);
  assert.ok(data.entries.length > 80000);
  assert.match(data.meta.hsk.license, /MIT License/);
  assert.match(data.meta.frequency.originalDocumentationAndAttribution, /SUBTLEX/);
  assert.match(data.meta.frequency.originalDocumentationAndAttribution, /Robyn Speer/);
  const levels = new WordLevels(data);
  assert.deepEqual(levels.lookup('辱'), { hsk: null, zipf: 3.56 });
  assert.deepEqual(levels.lookup('侮辱'), { hsk: 7, zipf: 4.26 });
  assert.deepEqual(levels.lookup('银行'), { hsk: 2, zipf: 5.34 });
  assert.deepEqual(levels.lookup('政府出台措施'), { hsk: null, zipf: null });
});
