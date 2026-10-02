import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { SyncState, backupToRecords, recordsToBackup } from '../flashcards/sync-state.mjs';

const source = readFileSync(new URL('../flashcards/cloud-sync.mjs', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '')
  .replace('import(`${sdkBase}firebase-app.js`)', 'Promise.resolve(sdk.app)')
  .replace('import(`${sdkBase}firebase-auth.js`)', 'Promise.resolve(sdk.auth)')
  .replace('import(`${sdkBase}firebase-firestore.js`)', 'Promise.resolve(sdk.firestore)');
assert.ok(!source.includes('import('), 'All network SDK imports must be mocked');
const empty = () => ({ app: 'hanzi-study', version: 1, keepFresh: [], learning: [], progress: {} });
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(setImmediate); };

async function harness({ local = empty(), remote = {}, stored = new Map(), online = true, denyRead = false } = {}) {
  const nodes = new Map();
  const localEvents = new Map();
  const listeners = [];
  const warnings = [];
  const commits = [];
  const auth = { currentUser: null };
  const cloud = structuredClone(remote);
  let authChange;
  let gate;
  let rejectWrite;
  let backup = structuredClone(local);
  let subscription;
  let editable = true;
  let signedIn = false;
  const storage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => { stored.set(key, String(value)); },
  };
  const api = {
    ready: Promise.resolve(true),
    getBackup: () => structuredClone(backup),
    getCardIds: () => ['1:的', '2:一', '100:实'],
    applyCloudBackup: (value) => { backup = structuredClone(value); },
    setCloudEditable: (value) => { editable = value; },
    setCloudSignedIn: (value) => { signedIn = value; },
    subscribe: (value) => { subscription = value; },
    mergeBackup() {},
  };
  const element = (id) => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, { textContent: '', disabled: true, events: {},
        classList: { add: (x) => classes.add(x), remove: (x) => classes.delete(x), toggle: (x, v) => v ? classes.add(x) : classes.delete(x) },
        addEventListener(name, fn) { this.events[name] = fn; },
      });
    }
    return nodes.get(id);
  };
  const navigator = { onLine: online };
  const emit = () => {
    for (const listener of listeners.filter((item) => item.active)) {
      if (denyRead) { listener.failure({ code: 'permission-denied' }); continue; }
      const entries = Object.entries(cloud[listener.uid] || {});
      listener.success({
        empty: entries.length === 0,
        metadata: { fromCache: !navigator.onLine, hasPendingWrites: false },
        forEach: (fn) => entries.forEach(([id, value]) => fn({ id, data: () => structuredClone(value) })),
      });
    }
  };
  const sdk = {
    app: { initializeApp: () => ({}) },
    auth: {
      getAuth: () => auth,
      GoogleAuthProvider: class { setCustomParameters() {} },
      onAuthStateChanged: (_, callback) => { authChange = callback; callback(null); },
      signOut: async () => { auth.currentUser = null; authChange(null); },
    },
    firestore: {
      initializeFirestore: () => ({}), memoryLocalCache: () => ({}), serverTimestamp: () => 'server-time',
      doc: (_, __, uid, ___, id) => ({ uid, id }),
      collection: (_, __, uid) => ({ uid }),
      onSnapshot: ({ uid }, _, success, failure) => {
        const listener = { uid, success, failure, active: true };
        listeners.push(listener);
        queueMicrotask(emit);
        return () => { listener.active = false; };
      },
      writeBatch: () => {
        const writes = [];
        return {
          set: (ref, value, options) => { assert.equal(options.merge, true); writes.push({ ...ref, value }); },
          commit: async () => {
            commits.push(structuredClone(writes));
            if (gate) await gate;
            if (rejectWrite) throw { code: rejectWrite };
            for (const { uid, id, value } of writes) {
              cloud[uid] ||= {};
              cloud[uid][id] = { ...cloud[uid][id], ...value };
            }
            emit();
          },
        };
      },
    },
  };
  const context = vm.createContext({
    SyncState, backupToRecords, recordsToBackup, sdk, firebaseConfig: {},
    localStorage: storage, navigator, crypto: { randomUUID },
    console: { warn: (...args) => warnings.push(args) },
    document: { querySelector: (id) => element(id) },
    window: { hanziStudy: api, confirm: () => true, addEventListener: (name, callback) => localEvents.set(name, callback) },
  });
  vm.runInContext(source, context);
  await settle();
  return {
    stored, cloud, commits, warnings, nodes, emit,
    get backup() { return backup; }, get editable() { return editable; }, get signedIn() { return signedIn; },
    async signIn(uid = 'owner') { auth.currentUser = { uid, email: 'owner@example.com' }; authChange(auth.currentUser); await settle(); },
    async signOut() { await sdk.auth.signOut(); await settle(); },
    async edit(changes) {
      assert.equal(editable, true);
      const records = backupToRecords(backup);
      for (const [id, patch] of Object.entries(changes)) records[id] = { ...records[id], ...patch };
      backup = recordsToBackup(records);
      subscription(changes);
      await settle();
    },
    async connectivity(value) { navigator.onLine = value; localEvents.get(value ? 'online' : 'offline')(); emit(); await settle(); },
    blockWrites() { let release; gate = new Promise((resolve) => { release = resolve; }); return () => { gate = null; release(); }; },
    failWrites(code) { rejectWrite = code; },
  };
}

test('first sign-in seeds an empty cloud, keeps a private backup, and reports synced only after save', async () => {
  const initial = { ...empty(), keepFresh: ['1:的'], learning: ['2:一'], progress: { '1:的': 'learned' } };
  const app = await harness({ local: initial });
  await app.signIn();
  assert.equal(app.cloud.owner['1:的'].star, 'keep-fresh');
  assert.equal(app.cloud.owner['2:一'].star, 'learning');
  assert.equal(app.cloud.owner['1:的'].rating, 'learned');
  assert.deepEqual(JSON.parse(app.stored.get('hanzi-before-cloud-v1:owner')), initial);
  assert.match(app.nodes.get('#cloud-status').textContent, /Synced to cloud/);
});

test('existing cloud wins over stale local stars without losing the pre-sync backup', async () => {
  const app = await harness({ local: { ...empty(), keepFresh: ['1:的'] }, remote: { owner: { '1:的': { star: 'none' }, '2:一': { star: 'learning' } } } });
  await app.signIn();
  assert.deepEqual(app.backup.keepFresh, []);
  assert.deepEqual(app.backup.learning, ['2:一']);
  assert.equal(app.commits.length, 0);
  assert.deepEqual(JSON.parse(app.stored.get('hanzi-before-cloud-v1:owner')).keepFresh, ['1:的']);
});

test('offline edits stay queued across reload and merge with other-device changes on reconnect', async () => {
  const first = await harness({ remote: { owner: { '1:的': { star: 'keep-fresh' } } } });
  await first.signIn();
  await first.connectivity(false);
  await first.edit({ '1:的': { star: 'none' } });
  assert.match(first.nodes.get('#cloud-status').textContent, /Offline/);
  const next = await harness({ local: first.backup, stored: first.stored, online: false,
    remote: { owner: { '1:的': { star: 'keep-fresh' }, '2:一': { star: 'learning' } } } });
  await next.signIn();
  assert.equal(next.editable, false);
  await next.connectivity(true);
  assert.equal(next.cloud.owner['1:的'].star, 'none');
  assert.deepEqual(next.backup.keepFresh, []);
  assert.deepEqual(next.backup.learning, ['2:一']);
  assert.equal(JSON.parse(next.stored.get('hanzi-cloud-outbox-v1:owner'))['1:的'], undefined);
});

test('rapid edits during a slow request end with the latest star, not the acknowledged old star', async () => {
  const app = await harness();
  await app.signIn();
  const release = app.blockWrites();
  await app.edit({ '1:的': { star: 'keep-fresh' } });
  await app.edit({ '1:的': { star: 'learning' }, '2:一': { rating: 'review' } });
  assert.match(app.nodes.get('#cloud-status').textContent, /Saving/);
  release();
  await settle();
  assert.equal(app.cloud.owner['1:的'].star, 'learning');
  assert.equal(app.cloud.owner['2:一'].rating, 'review');
  assert.match(app.nodes.get('#cloud-status').textContent, /Synced/);
});

test('access-denied cannot erase or upload local data', async () => {
  const local = { ...empty(), learning: ['2:一'] };
  const app = await harness({ local, denyRead: true });
  await app.signIn();
  assert.deepEqual(app.backup, local);
  assert.equal(app.commits.length, 0);
  assert.equal(app.editable, false);
  assert.match(app.nodes.get('#cloud-status').textContent, /Cloud access denied/);
  await app.signOut();
  assert.equal(app.editable, true);
});

test('failed writes stay queued, show a failure, and never report synced', async () => {
  const app = await harness();
  await app.signIn();
  app.failWrites('permission-denied');
  await app.edit({ '1:的': { star: 'learning' } });
  assert.equal(JSON.parse(app.stored.get('hanzi-cloud-outbox-v1:owner'))['1:的'].star.value, 'learning');
  assert.match(app.nodes.get('#cloud-status').textContent, /Cloud access denied/);
});

test('signing out during an in-flight request cannot apply old-user snapshots', async () => {
  const app = await harness();
  await app.signIn();
  const release = app.blockWrites();
  await app.edit({ '1:的': { star: 'keep-fresh' } });
  await app.signOut();
  await app.edit({ '2:一': { star: 'learning' } });
  const local = structuredClone(app.backup);
  release();
  await settle();
  assert.deepEqual(app.backup, local);
  assert.equal(app.signedIn, false);
  assert.match(app.nodes.get('#cloud-status').textContent, /Signed out/);
});
