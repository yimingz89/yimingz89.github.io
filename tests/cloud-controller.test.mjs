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

async function harness({ local = empty(), remote = {}, stored = new Map(), online = true, denyRead = false,
  readMode = 'server', outboxWritable = true, mockLocks = false, deferAuth = false, hostname = 'yimingz89.github.io' } = {}) {
  const nodes = new Map();
  const localEvents = new Map();
  const listeners = [];
  const warnings = [];
  const commits = [];
  const popups = [];
  const timers = new Map();
  let timerId = 0;
  let now = 0;
  let readError = denyRead ? 'permission-denied' : null;
  const auth = { currentUser: null };
  const cloud = structuredClone(remote);
  let authChange;
  let gate;
  let rejectWrite;
  let backup = structuredClone(local);
  let subscription;
  let changeSaver;
  let editable = true;
  let signedIn = false;
  const storage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => {
      if (!outboxWritable && key.startsWith('hanzi-cloud-outbox-v1:')) throw new Error('Storage quota exhausted');
      stored.set(key, String(value));
    },
    removeItem: (key) => { stored.delete(key); },
  };
  const api = {
    ready: Promise.resolve(true),
    getBackup: () => structuredClone(backup),
    getCardIds: () => ['1:的', '2:一', '100:实'],
    applyCloudBackup: (value) => { backup = structuredClone(value); },
    setCloudEditable: (value) => { editable = value; },
    setCloudSignedIn: (value) => { signedIn = value; },
    subscribe: (value) => { subscription = value; },
    setChangeSaver: (value) => { changeSaver = value; },
    mergeBackup() {},
  };
  const element = (id) => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, { textContent: '', disabled: true, events: {},
        classList: { add: (x) => classes.add(x), remove: (x) => classes.delete(x), toggle: (x, v) => v ? classes.add(x) : classes.delete(x), contains: (x) => classes.has(x) },
        setAttribute() {},
        addEventListener(name, fn) { this.events[name] = fn; },
      });
    }
    return nodes.get(id);
  };
  const navigator = { onLine: online };
  const lockTails = new Map();
  const lockGates = new Map();
  if (mockLocks) navigator.locks = {
    request(name, operation) {
      const previous = lockTails.get(name) || Promise.resolve();
      const requested = previous.then(async () => {
        if (lockGates.has(name)) await lockGates.get(name);
        return operation();
      });
      lockTails.set(name, requested.catch(() => {}));
      return requested;
    },
  };
  const emit = () => {
    for (const listener of listeners.filter((item) => item.active)) {
      if (readError) {
        listener.active = false;
        listener.failure({ code: readError });
        continue;
      }
      if (readMode === 'silent') continue;
      const entries = Object.entries(cloud[listener.uid] || {});
      listener.success({
        empty: entries.length === 0,
        metadata: { fromCache: readMode === 'cache' || !navigator.onLine, hasPendingWrites: false },
        forEach: (fn) => entries.forEach(([id, value]) => fn({ id, data: () => structuredClone(value) })),
      });
    }
  };
  const sdk = {
    app: { initializeApp: () => ({}) },
    auth: {
      getAuth: () => auth,
      GoogleAuthProvider: class { setCustomParameters() {} },
      onAuthStateChanged: (_, callback) => { authChange = callback; if (!deferAuth) callback(null); },
      signInWithPopup: () => new Promise((resolve, reject) => popups.push({ resolve, reject })),
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
    window: {
      hanziStudy: api, confirm: () => true, location: { hostname },
      addEventListener: (name, callback) => localEvents.set(name, callback),
      setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay, due: now + delay }); return id; },
      clearTimeout: (id) => timers.delete(id),
    },
  });
  vm.runInContext(source, context);
  await settle();
  return {
    stored, cloud, commits, warnings, nodes, emit, popups, timers, listeners,
    async clickSignIn() {
      const button = nodes.get('#cloud-login');
      if (!button.disabled) void button.events.click({ preventDefault() {} });
      await settle();
    },
    async authSignedOut() { authChange(null); await settle(); },
    async advanceTimers(milliseconds = Infinity) {
      const target = milliseconds === Infinity ? Math.max(now, ...Array.from(timers.values(), (timer) => timer.due)) : now + milliseconds;
      for (const [id, timer] of Array.from(timers)) {
        if (timer.due > target) continue;
        timers.delete(id);
        timer.callback();
      }
      now = target;
      await settle();
    },
    get backup() { return backup; }, get editable() { return editable; }, get signedIn() { return signedIn; },
    async signIn(uid = 'owner') { auth.currentUser = { uid, email: `${uid}@example.com` }; authChange(auth.currentUser); await settle(); },
    async signOut() { await sdk.auth.signOut(); await settle(); },
    async edit(changes) {
      assert.equal(editable, true);
      const applyLocal = () => {
        const records = backupToRecords(backup);
        for (const [id, patch] of Object.entries(changes)) records[id] = { ...records[id], ...patch };
        backup = recordsToBackup(records);
        subscription?.(changes);
      };
      if (changeSaver) await changeSaver(changes, applyLocal);
      else applyLocal();
      await settle();
    },
    async retry() { nodes.get('#cloud-retry').events.click(); await settle(); },
    async releaseReads() { readMode = 'server'; readError = null; emit(); await settle(); },
    async failReads(code) { readError = code; emit(); await settle(); },
    setOutboxWritable(value) { outboxWritable = value; },
    blockState(uid = 'owner') {
      assert.equal(mockLocks, true);
      const name = `hanzi-state:${uid}`;
      let release;
      lockGates.set(name, new Promise((resolve) => { release = resolve; }));
      return () => { lockGates.delete(name); release(); };
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
  assert.equal(next.editable, true);
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
  assert.equal(app.editable, true);
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

test('sign-in waits for initial auth and immediately shows a busy state on click', async () => {
  const app = await harness({ deferAuth: true });
  assert.equal(app.nodes.get('#cloud-login').disabled, true);
  await app.clickSignIn();
  assert.equal(app.popups.length, 0);
  await app.authSignedOut();
  await app.clickSignIn();
  assert.equal(app.popups.length, 1);
  assert.equal(app.nodes.get('#cloud-login').disabled, true);
  assert.match(app.nodes.get('#cloud-login').textContent, /Waiting for Google/);
  assert.match(app.nodes.get('#cloud-status').textContent, /Opening Google/);
});

test('popup failure stays visible after an auth callback and never exposes credentials', async () => {
  const app = await harness({ local: { ...empty(), learning: ['2:一'] } });
  const before = structuredClone(app.backup);
  await app.clickSignIn();
  app.popups[0].reject({ code: 'auth/network-request-failed', message: 'secret-token', customData: { credential: 'secret-token' } });
  await settle();
  await app.authSignedOut();
  const error = app.nodes.get('#cloud-signin-error');
  assert.match(error.textContent, /auth\/network-request-failed/);
  assert.equal(error.classList.contains('hidden'), false);
  assert.doesNotMatch(error.textContent, /secret-token|will sync when/);
  assert.doesNotMatch(JSON.stringify(app.warnings), /secret-token/);
  assert.equal(app.nodes.get('#cloud-login').disabled, false);
  assert.match(app.nodes.get('#cloud-login').textContent, /Retry/);
  assert.deepEqual(app.backup, before);
  assert.equal(app.commits.length, 0);
});

test('stalled popup allows retry; old failures cannot overwrite a new attempt', async () => {
  const app = await harness();
  await app.clickSignIn();
  await app.advanceTimers();
  assert.match(app.nodes.get('#cloud-signin-error').textContent, /sign-in-pending/);
  assert.equal(app.nodes.get('#cloud-login').disabled, false);
  await app.clickSignIn();
  assert.equal(app.popups.length, 2);
  app.popups[0].reject({ code: 'auth/cancelled-popup-request' });
  await settle();
  assert.equal(app.nodes.get('#cloud-signin-error').classList.contains('hidden'), true);
  assert.equal(app.nodes.get('#cloud-login').disabled, true);
  assert.match(app.nodes.get('#cloud-status').textContent, /Opening Google/);
  await app.signIn();
  app.popups[1].resolve({ user: { uid: 'owner' } });
  await settle();
  await app.advanceTimers();
  assert.equal(app.nodes.get('#cloud-signin-error').classList.contains('hidden'), true);
  assert.match(app.nodes.get('#cloud-status').textContent, /Synced to cloud/);
});

test('a late successful sign-in still connects after the slow-popup notice', async () => {
  const app = await harness();
  await app.clickSignIn();
  await app.advanceTimers();
  await app.signIn();
  app.popups[0].resolve({ user: { uid: 'owner' } });
  await settle();
  assert.equal(app.nodes.get('#cloud-signin-error').classList.contains('hidden'), true);
  assert.equal(app.signedIn, true);
  assert.match(app.nodes.get('#cloud-status').textContent, /Synced to cloud/);
});

test('local unauthorized-domain error names the actual host', async () => {
  const app = await harness({ hostname: '127.0.0.1' });
  await app.clickSignIn();
  app.popups[0].reject({ code: 'auth/unauthorized-domain' });
  await settle();
  assert.match(app.nodes.get('#cloud-signin-error').textContent, /Add 127\.0\.0\.1 to Firebase/);
  assert.match(app.nodes.get('#cloud-signin-error').textContent, /auth\/unauthorized-domain/);
});

for (const readMode of ['cache', 'silent']) {
  test(`${readMode}-only initial connection permits durable edits and exposes a slow-connection retry`, async () => {
    const local = { ...empty(), keepFresh: ['1:的'] };
    const app = await harness({ local, readMode });
    await app.signIn();
    assert.equal(app.editable, true, 'A healthy local queue must not wait for the first server response');
    assert.deepEqual(app.backup, local, 'An unconfirmed cached snapshot must not replace local stars');
    assert.equal(app.commits.length, 0, 'Do not seed or write until the server snapshot is known');
    await app.edit({ '2:一': { star: 'learning' } });
    assert.equal(JSON.parse(app.stored.get('hanzi-cloud-outbox-v1:owner'))['2:一'].star.value, 'learning');
    assert.equal(app.commits.length, 0);
    await app.advanceTimers(14000);
    assert.equal(app.nodes.get('#cloud-retry').classList.contains('hidden'), true);
    await app.advanceTimers(2000);
    assert.equal(app.nodes.get('#cloud-retry').classList.contains('hidden'), false);
    assert.match(app.nodes.get('#cloud-status').textContent, /local|device|browser/i);
    assert.match(app.nodes.get('#cloud-status').textContent, /waiting|pending|connect|sync|retry/i);
    assert.doesNotMatch(app.nodes.get('#cloud-status').textContent, /Synced to cloud/);
    assert.equal(app.editable, true);
  });
}

test('initial-connection edits and multi-card imports win only for touched fields on reconnect', async () => {
  const app = await harness({ readMode: 'cache',
    local: { ...empty(), keepFresh: ['1:的', '2:一'], progress: { '1:的': 'learned' } },
    remote: { owner: { '1:的': { star: 'none', rating: 'review' },
      '2:一': { star: 'keep-fresh', rating: 'review' }, '100:实': { star: 'none' } } },
  });
  await app.signIn();
  // The same multi-card patch shape is produced by Import progress.
  await app.edit({ '2:一': { star: 'learning' }, '100:实': { star: 'keep-fresh', rating: 'learned' } });
  assert.equal(app.commits.length, 0);
  await app.releaseReads();
  assert.deepEqual(app.backup.keepFresh, ['100:实'], 'Untouched stale star on 1:的 must not be revived');
  assert.deepEqual(app.backup.learning, ['2:一']);
  assert.equal(app.backup.progress['1:的'], 'review', 'Untouched stale local rating must not win');
  assert.equal(app.backup.progress['2:一'], 'review', 'Star-only edit preserves the server rating');
  assert.equal(app.backup.progress['100:实'], 'learned');
  assert.equal(app.cloud.owner['2:一'].star, 'learning');
  assert.equal(app.cloud.owner['100:实'].star, 'keep-fresh');
  assert.deepEqual(JSON.parse(app.stored.get('hanzi-cloud-outbox-v1:owner')), {});
  assert.match(app.nodes.get('#cloud-status').textContent, /Synced to cloud/);
  assert.equal(app.nodes.get('#cloud-retry').classList.contains('hidden'), true);
});

test('first link to an empty cloud seeds untouched local marks without undoing early edits', async () => {
  const app = await harness({ readMode: 'cache',
    local: { ...empty(), keepFresh: ['1:的'], learning: ['2:一'], progress: { '1:的': 'review' } },
  });
  await app.signIn();
  await app.edit({ '1:的': { star: 'none' }, '100:实': { star: 'keep-fresh' } });
  await app.releaseReads();
  assert.deepEqual(app.backup.keepFresh, ['100:实']);
  assert.deepEqual(app.backup.learning, ['2:一'], 'Untouched initial stars still migrate to a genuinely empty cloud');
  assert.equal(app.backup.progress['1:的'], 'review');
  assert.equal(app.cloud.owner['1:的'].star, 'none', 'A queued explicit removal must beat initial seed data');
  assert.equal(app.cloud.owner['1:的'].rating, 'review');
  assert.equal(app.cloud.owner['2:一'].star, 'learning');
});

test('edits before the initial snapshot survive reload and repeated Retry', async () => {
  const first = await harness({ readMode: 'silent', local: { ...empty(), keepFresh: ['1:的'] } });
  await first.signIn();
  await first.edit({ '1:的': { star: 'none' }, '2:一': { star: 'learning' } });
  const queued = first.stored.get('hanzi-cloud-outbox-v1:owner');
  const next = await harness({ readMode: 'cache', local: first.backup, stored: first.stored,
    remote: { owner: { '1:的': { star: 'keep-fresh' }, '100:实': { star: 'keep-fresh' } } },
  });
  await next.signIn();
  assert.equal(next.editable, true);
  await next.advanceTimers(16000);
  await next.retry();
  assert.equal(next.stored.get('hanzi-cloud-outbox-v1:owner'), queued);
  assert.equal(next.editable, true);
  await next.advanceTimers(16000);
  await next.retry();
  assert.equal(next.stored.get('hanzi-cloud-outbox-v1:owner'), queued);
  await next.releaseReads();
  assert.deepEqual(next.backup.keepFresh, ['100:实']);
  assert.deepEqual(next.backup.learning, ['2:一']);
  assert.equal(next.cloud.owner['1:的'].star, 'none');
  assert.equal(next.cloud.owner['2:一'].star, 'learning');
});

test('read failure keeps edits available and pending until a successful retry', async () => {
  const app = await harness({ readMode: 'silent', remote: { owner: { '1:的': { star: 'keep-fresh' } } } });
  await app.signIn();
  await app.failReads('unavailable');
  assert.equal(app.editable, true);
  assert.equal(app.nodes.get('#cloud-retry').classList.contains('hidden'), false);
  await app.edit({ '2:一': { star: 'learning' } });
  assert.equal(JSON.parse(app.stored.get('hanzi-cloud-outbox-v1:owner'))['2:一'].star.value, 'learning');
  assert.equal(app.commits.length, 0);
  await app.releaseReads();
  await app.retry();
  assert.equal(app.cloud.owner['2:一'].star, 'learning');
  assert.deepEqual(app.backup.keepFresh, ['1:的']);
  assert.match(app.nodes.get('#cloud-status').textContent, /Synced to cloud/);
});

test('write network failure preserves the queue and allows further edits before retry', async () => {
  const app = await harness();
  await app.signIn();
  app.failWrites('unavailable');
  await app.edit({ '1:的': { star: 'learning' } });
  assert.equal(app.editable, true);
  assert.equal(app.nodes.get('#cloud-retry').classList.contains('hidden'), false);
  await app.edit({ '1:的': { star: 'none' }, '2:一': { star: 'keep-fresh' } });
  const pending = JSON.parse(app.stored.get('hanzi-cloud-outbox-v1:owner'));
  assert.equal(pending['1:的'].star.value, 'none');
  assert.equal(pending['2:一'].star.value, 'keep-fresh');
  assert.doesNotMatch(app.nodes.get('#cloud-status').textContent, /Synced to cloud/);
  app.failWrites(null);
  await app.retry();
  assert.deepEqual(app.backup.keepFresh, ['2:一']);
  assert.deepEqual(app.backup.learning, []);
  assert.deepEqual(JSON.parse(app.stored.get('hanzi-cloud-outbox-v1:owner')), {});
});

test('a malformed initial outbox fails closed without replacing or sending local state', async () => {
  const local = { ...empty(), learning: ['2:一'] };
  const stored = new Map([['hanzi-cloud-outbox-v1:owner', '{bad JSON']]);
  const app = await harness({ local, stored, readMode: 'cache' });
  await app.signIn();
  assert.equal(app.editable, false);
  assert.deepEqual(app.backup, local);
  assert.equal(app.stored.get('hanzi-cloud-outbox-v1:owner'), '{bad JSON');
  assert.equal(app.commits.length, 0);
  assert.equal(app.nodes.get('#cloud-retry').classList.contains('hidden'), false);
  await app.advanceTimers(16000);
  assert.equal(app.editable, false);
});

test('an unwritable initial outbox fails closed until storage is writable and Retry succeeds', async () => {
  const local = { ...empty(), learning: ['2:一'] };
  const app = await harness({ local, outboxWritable: false, readMode: 'silent' });
  await app.signIn();
  assert.equal(app.editable, false);
  assert.deepEqual(app.backup, local);
  assert.equal(app.commits.length, 0);
  assert.equal(app.nodes.get('#cloud-retry').classList.contains('hidden'), false);
  app.setOutboxWritable(true);
  await app.retry();
  assert.equal(app.editable, true);
  await app.edit({ '1:的': { star: 'keep-fresh' } });
  assert.equal(JSON.parse(app.stored.get('hanzi-cloud-outbox-v1:owner'))['1:的'].star.value, 'keep-fresh');
});

test('outbox write failure during use locks editing and preserves already queued edits', async () => {
  const app = await harness({ readMode: 'cache' });
  await app.signIn();
  await app.edit({ '1:的': { star: 'learning' } });
  const queued = app.stored.get('hanzi-cloud-outbox-v1:owner');
  const backup = structuredClone(app.backup);
  app.setOutboxWritable(false);
  try { await app.edit({ '2:一': { star: 'keep-fresh' } }); } catch { /* A durability failure may also reject the edit API. */ }
  await settle();
  assert.equal(app.editable, false);
  assert.deepEqual(app.backup, backup, 'An undurable edit must not be applied to the local UI');
  assert.equal(app.stored.get('hanzi-cloud-outbox-v1:owner'), queued);
  assert.equal(app.commits.length, 0);
  assert.doesNotMatch(app.nodes.get('#cloud-status').textContent, /Synced to cloud/);
});

test('old connection timers and listener errors cannot overwrite a later account session', async () => {
  const app = await harness({ readMode: 'silent', remote: { second: { '2:一': { star: 'learning' } } } });
  await app.signIn();
  const oldTimers = [...app.timers.values()];
  assert.ok(oldTimers.length, 'The initial connection needs a slow-connection timer');
  const oldListener = app.listeners.at(-1);
  await app.signOut();
  await app.releaseReads();
  await app.signIn('second');
  const before = structuredClone(app.backup);
  for (const timer of oldTimers) timer.callback();
  oldListener.failure({ code: 'permission-denied' });
  await settle();
  assert.equal(app.editable, true);
  assert.deepEqual(app.backup, before);
  assert.match(app.nodes.get('#cloud-status').textContent, /Synced to cloud/);
  assert.equal(app.nodes.get('#cloud-retry').classList.contains('hidden'), true);
  assert.equal(app.nodes.get('#cloud-account').textContent, 'second@example.com');
});

test('a snapshot waiting on the state lock cannot erase a subsequently requested local edit', async () => {
  const app = await harness({ mockLocks: true, remote: { owner: { '1:的': { star: 'keep-fresh' } } } });
  await app.signIn();
  const release = app.blockState();
  app.cloud.owner['1:的'].star = 'none';
  app.emit();
  const editing = app.edit({ '1:的': { star: 'learning' } });
  await settle();
  release();
  await editing;
  await settle();
  assert.deepEqual(app.backup.keepFresh, []);
  assert.deepEqual(app.backup.learning, ['1:的']);
  assert.equal(app.cloud.owner['1:的'].star, 'learning');
});

for (const action of ['retry', 'signOut']) {
  test(`an edit waiting on the state lock remains in its original account queue across ${action}`, async () => {
    const app = await harness({ mockLocks: true, readMode: 'cache' });
    await app.signIn();
    const release = app.blockState();
    const editing = app.edit({ '1:的': { star: 'learning' }, '2:一': { rating: 'review' } });
    await settle();
    await app[action]();
    const before = structuredClone(app.backup);
    release();
    await editing;
    await settle();
    const pending = JSON.parse(app.stored.get('hanzi-cloud-outbox-v1:owner'));
    assert.equal(pending['1:的'].star.value, 'learning');
    assert.equal(pending['2:一'].rating.value, 'review');
    if (action === 'signOut') {
      assert.equal(app.signedIn, false);
      assert.deepEqual(app.backup, before, 'An old account edit must not mutate the signed-out session');
      await app.signIn();
    }
    await app.releaseReads();
    assert.deepEqual(app.backup.learning, ['1:的']);
    assert.equal(app.backup.progress['2:一'], 'review');
  });
}
