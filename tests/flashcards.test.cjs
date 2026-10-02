const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appRoot = path.join(__dirname, '../flashcards');
const html = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(appRoot, 'app.js'), 'utf8');
const deck = JSON.parse(fs.readFileSync(path.join(appRoot, 'data/hanzi_top2000_cards.json'), 'utf8'));
const progressKey = 'hanzi-study-progress-v1';
const starKey = 'hanzi-study-stars-v1';
const learningKey = 'hanzi-study-learning-v1';

async function loadApp(saved = {}) {
  const storage = new Map(Object.entries(saved));
  const nodes = new Map();
  const errors = [];
  const downloads = [];
  const callbacks = {};
  let blob;
  let confirm = true;
  let failKey;
  const makeNode = () => {
    const classes = new Set();
    return {
      value: '', textContent: '', style: {}, disabled: true, files: [], handlers: {},
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        toggle: (name, force) => force ? classes.add(name) : classes.delete(name),
        contains: (name) => classes.has(name),
      },
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, callback) { this.handlers[name] = callback; },
      focus() {}, remove() {},
      click() { this.handlers.click?.(); },
    };
  };
  for (const [, id] of html.matchAll(/id="([^"]+)"/g)) nodes.set(id, makeNode());
  nodes.get('deck-select').value = 'core';
  nodes.get('level-select').value = 'all';
  const context = vm.createContext({
    console: { error: (...args) => errors.push(args) },
    Blob,
    URL: { createObjectURL: (value) => { blob = value; return 'blob:test'; }, revokeObjectURL() {} },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        if (key === failKey) { failKey = undefined; throw new Error('Quota exceeded'); }
        storage.set(key, String(value));
      },
      removeItem: (key) => storage.delete(key),
    },
    document: {
      activeElement: null,
      querySelector: (selector) => nodes.get(selector.slice(1)),
      addEventListener: (name, callback) => { callbacks[name] = callback; },
      body: { append() {} },
      createElement: () => ({ click() { downloads.push({ filename: this.download, blob }); }, remove() {} }),
    },
    window: { setTimeout() {}, confirm: () => confirm },
    fetch: async (url) => {
      assert.equal(url, './data/hanzi_top2000_cards.json');
      return { ok: true, json: async () => deck };
    },
  });
  vm.runInContext(source, context);
  await new Promise(setImmediate);
  assert.deepEqual(errors, []);
  return {
    run: (code) => vm.runInContext(code, context), nodes, storage, downloads, context, callbacks,
    failNextSave: (key) => { failKey = key; },
    setConfirmation: (value) => { confirm = value; },
    async importFile(text, size = text.length) {
      nodes.get('import-file').files = [{ size, text: async () => text }];
      await nodes.get('import-file').handlers.change();
    },
  };
}

const backup = (overrides = {}) => ({
  app: 'hanzi-study', version: 1, progress: {}, keepFresh: [], learning: [], ...overrides,
});

test('relative-path deployment loads all cards and keeps card jumps/reveal working', async () => {
  const app = await loadApp();
  assert.equal(app.run('state.coreCards.length'), 2000);
  assert.equal(app.run('state.supplementCards.length'), 138);
  assert.equal(app.run('state.filteredCards.length'), 2000);
  assert.equal(app.run('jumpToRank(100).character'), '实');
  app.nodes.get('reveal-button').handlers.click();
  assert.equal(app.run('state.revealed'), true);
  assert.equal(app.nodes.get('export-progress').disabled, false);
  assert.match(html, /href="\.\/styles.css\?v=11"/);
  assert.match(html, /src="\.\/app.js\?v=11"/);
  assert.throws(() => app.run('jumpToRank(-1)'), /whole card number/);
});

test('star categories stay exclusive; filters and shuffle never include unstarred cards', async () => {
  const app = await loadApp();
  app.run('toggleStar(); moveCard(1); toggleLearning();');
  app.run('toggleStarFilter("keep-fresh")');
  assert.equal(app.run('state.filteredCards.length'), 1);
  assert.equal(app.run('state.filteredCards[0].rank'), 1);
  app.run('toggleStarFilter("learning"); shuffleStarredCards();');
  assert.equal(app.run('state.filteredCards.length'), 2);
  assert.equal(app.run('state.filteredCards.every(isInStarredDeck)'), true);
  app.run('backToFullDeck();');
  assert.equal(app.run('state.filteredCards.length'), 2000);
  assert.equal(app.run('state.filteredCards[99].rank'), 100);
  assert.equal(app.run('state.shuffled'), false);
  app.run('toggleLearning();');
  assert.equal(app.run('state.starred.size'), 0);
  assert.equal(app.run('state.learning.size'), 2);
});

test('export includes legacy learning stars, both categories and progress; round-trip persists', async () => {
  const app = await loadApp({
    [starKey]: JSON.stringify(['1:的']),
    'hanzi-study-easy-v1': JSON.stringify(['2:一']),
    [progressKey]: JSON.stringify({ '1:的': 'learned', '2:一': 'review' }),
  });
  app.nodes.get('export-progress').handlers.click();
  assert.equal(app.downloads.length, 1);
  assert.match(app.downloads[0].filename, /^hanzi-study-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const text = await app.downloads[0].blob.text();
  const parsed = JSON.parse(text);
  assert.deepEqual(parsed.keepFresh, ['1:的']);
  assert.deepEqual(parsed.learning, ['2:一']);
  assert.deepEqual(parsed.progress, { '1:的': 'learned', '2:一': 'review' });
  const destination = await loadApp();
  await destination.importFile(text);
  assert.match(destination.nodes.get('backup-status').textContent, /Imported successfully/);
  const reloaded = await loadApp(Object.fromEntries(destination.storage));
  assert.equal(reloaded.run('state.starred.has("1:的")'), true);
  assert.equal(reloaded.run('state.learning.has("2:一")'), true);
  assert.equal(reloaded.run('state.progress["1:的"]'), 'learned');
});

test('confirmed import merges without losing unrelated cards and backup categories win', async () => {
  const app = await loadApp({
    [starKey]: JSON.stringify(['1:的', '100:实']),
    [learningKey]: JSON.stringify(['2:一']),
    [progressKey]: JSON.stringify({ '1:的': 'review', '100:实': 'learned' }),
  });
  await app.importFile(JSON.stringify(backup({ keepFresh: ['2:一'], learning: ['1:的'], progress: { '1:的': 'learned' } })));
  assert.deepEqual(JSON.parse(app.storage.get(starKey)), ['100:实', '2:一']);
  assert.deepEqual(JSON.parse(app.storage.get(learningKey)), ['1:的']);
  assert.deepEqual(JSON.parse(app.storage.get(progressKey)), { '1:的': 'learned', '100:实': 'learned' });
  assert.equal(app.nodes.get('import-file').value, '');
});

test('malformed, oversized, unknown-card and conflicting-category imports change nothing', async () => {
  const app = await loadApp({ [starKey]: JSON.stringify(['1:的']) });
  const before = Array.from(app.storage);
  for (const text of [
    'not json', 'null', JSON.stringify(deck.meta),
    JSON.stringify(backup({ version: 2 })),
    JSON.stringify(backup({ progress: { '__proto__:x': 'learned' } })),
    JSON.stringify(backup({ progress: { '1:的': 'invalid' } })),
    JSON.stringify(backup({ keepFresh: ['999999:未知'] })),
    JSON.stringify(backup({ keepFresh: ['1:的'], learning: ['1:的'] })),
  ]) {
    await app.importFile(text);
    assert.equal(app.nodes.get('backup-status').classList.contains('is-error'), true);
    assert.deepEqual(Array.from(app.storage), before);
  }
  await app.importFile('{}', 1024 * 1024 + 1);
  assert.match(app.nodes.get('backup-status').textContent, /too large/);
  assert.deepEqual(Array.from(app.storage), before);
});

test('canceling a valid import preserves data', async () => {
  const app = await loadApp({ [starKey]: JSON.stringify(['1:的']) });
  const before = Array.from(app.storage);
  app.setConfirmation(false);
  await app.importFile(JSON.stringify(backup({ learning: ['1:的'] })));
  assert.deepEqual(Array.from(app.storage), before);
  assert.match(app.nodes.get('backup-status').textContent, /canceled/);
});

test('a failed save rolls back partial writes and leaves memory unchanged', async () => {
  const app = await loadApp({ [starKey]: JSON.stringify(['1:的']) });
  const before = Array.from(app.storage);
  app.failNextSave(learningKey);
  await app.importFile(JSON.stringify(backup({ learning: ['1:的'], progress: { '2:一': 'review' } })));
  assert.deepEqual(Array.from(app.storage), before);
  assert.equal(app.run('state.starred.has("1:的")'), true);
  assert.equal(app.run('state.learning.size'), 0);
  assert.equal(app.run('Object.keys(state.progress).length'), 0);
  assert.match(app.nodes.get('backup-status').textContent, /couldn’t save/);
});

test('backup buttons and disclosure keyboard interaction do not trigger card shortcuts', async () => {
  const app = await loadApp();
  let prevented = false;
  for (const active of [app.nodes.get('export-progress'), app.nodes.get('import-progress'), { tagName: 'SUMMARY' }, { tagName: 'A' }]) {
    app.context.document.activeElement = active;
    app.callbacks.keydown({ code: 'Space', preventDefault() { prevented = true; } });
    assert.equal(app.run('state.revealed'), false);
  }
  assert.equal(prevented, false);
});

test('cloud bridge emits only changed fields; cloud snapshots do not echo writes', async () => {
  const app = await loadApp();
  const changes = [];
  app.context.window.hanziStudy.subscribe((value) => changes.push(JSON.parse(JSON.stringify(value))));
  app.run('toggleStar(); toggleLearning(); rateCard("learned");');
  assert.deepEqual(changes, [
    { '1:的': { star: 'keep-fresh' } },
    { '1:的': { star: 'learning' } },
    { '1:的': { rating: 'learned' } },
  ]);
  app.run('jumpToRank(100); setRevealed(true)');
  app.context.window.hanziStudy.applyCloudBackup(backup({ keepFresh: ['100:实'], progress: { '1:的': 'review' } }));
  assert.equal(changes.length, 3);
  assert.equal(app.run('state.filteredCards[state.index].rank'), 100);
  assert.equal(app.run('state.revealed'), true);
  assert.equal(app.run('state.starred.has("100:实")'), true);
  assert.equal(app.run('state.learning.size'), 0);
  assert.deepEqual(JSON.parse(app.storage.get(progressKey)), { '1:的': 'review' });
});

test('cloud connection guard blocks mutations; reset syncs rating removals without clearing stars', async () => {
  const app = await loadApp({ [starKey]: '["1:的"]', [progressKey]: '{"1:的":"learned"}' });
  const changes = [];
  app.context.window.hanziStudy.subscribe((value) => changes.push(JSON.parse(JSON.stringify(value))));
  app.context.window.hanziStudy.setCloudEditable(false);
  const before = Array.from(app.storage);
  app.run('toggleStar(); toggleLearning(); rateCard("review"); resetProgress()');
  assert.deepEqual(Array.from(app.storage), before);
  assert.throws(() => app.context.window.hanziStudy.mergeBackup(backup()), /Wait for cloud sync/);
  assert.equal(app.nodes.get('import-progress').disabled, true);
  assert.deepEqual(changes, []);
  app.context.window.hanziStudy.setCloudEditable(true);
  app.run('resetProgress()');
  assert.deepEqual(changes, [{ '1:的': { rating: 'unrated' } }]);
  assert.equal(app.run('state.starred.has("1:的")'), true);
});
