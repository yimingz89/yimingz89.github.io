import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncState, backupToRecords, recordsToBackup } from '../flashcards/sync-state.mjs';

function harness(uid = 'owner', store = new Map()) {
  let serial = 0;
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  const queue = new SyncState({ uid, storage, validIds: ['1:的', '2:一', '100:实'], token: () => `${uid}-${++serial}` });
  return { queue, store, storage };
}

test('backup round-trip keeps separate stars and ratings; explicit removals are omitted', () => {
  const original = { app: 'hanzi-study', version: 1, keepFresh: ['1:的'], learning: ['2:一'], progress: { '1:的': 'learned' } };
  assert.deepEqual(recordsToBackup(backupToRecords(original)), original);
  assert.deepEqual(recordsToBackup({ '1:的': { star: 'none', rating: 'unrated' } }), { ...original, keepFresh: [], learning: [], progress: {} });
});

test('outbox survives reload and applies only edited fields over new remote data', () => {
  const { queue, store } = harness();
  queue.enqueue({ '1:的': { star: 'learning' } });
  const restored = harness('owner', store).queue;
  const view = restored.acceptRemote({ '1:的': { star: 'none', rating: 'review' }, '2:一': { star: 'keep-fresh' } });
  assert.deepEqual(view, { '1:的': { star: 'learning', rating: 'review' }, '2:一': { star: 'keep-fresh' } });
});

test('late acknowledgement cannot lose a newer toggle or a new rating', () => {
  const { queue } = harness();
  queue.enqueue({ '1:的': { star: 'keep-fresh' } });
  const sent = queue.nextBatch();
  queue.enqueue({ '1:的': { star: 'none', rating: 'learned' } });
  queue.acknowledge(sent);
  assert.equal(queue.pendingCount, 1);
  assert.deepEqual(queue.nextBatch()[0].patch, { star: 'none', rating: 'learned' });
  queue.acknowledge(queue.nextBatch());
  assert.equal(queue.pendingCount, 0);
});

test('acknowledging a star does not resend it when only a rating remains pending', () => {
  const { queue } = harness();
  queue.enqueue({ '1:的': { star: 'keep-fresh' } });
  const sent = queue.nextBatch();
  queue.enqueue({ '1:的': { rating: 'learned' } });
  queue.acknowledge(sent);
  assert.deepEqual(queue.nextBatch()[0].patch, { rating: 'learned' });
});

test('explicit removal remains removed after another device sends a snapshot', () => {
  const { queue } = harness();
  queue.acceptRemote({ '1:的': { star: 'keep-fresh' } });
  queue.enqueue({ '1:的': { star: 'none' } });
  const view = queue.acceptRemote({ '1:的': { star: 'keep-fresh' }, '2:一': { star: 'learning' } });
  assert.deepEqual(recordsToBackup(view).keepFresh, []);
  assert.deepEqual(recordsToBackup(view).learning, ['2:一']);
});

test('account queues stay isolated and invalid cards cannot enter the queue', () => {
  const { queue, store } = harness();
  queue.enqueue({ '1:的': { star: 'learning' } });
  assert.equal(harness('other-user', store).queue.pendingCount, 0);
  assert.throws(() => queue.enqueue({ '999:fake': { star: 'none' } }), /Unknown card/);
  assert.throws(() => queue.enqueue({ '1:的': { star: 'invalid' } }), /Invalid sync/);
  assert.throws(() => queue.enqueue({ '1:的': { star: 'none', malicious: true } }), /Invalid sync/);
});

test('shared outbox incorporates other tabs and acknowledges only its own writes', () => {
  const { queue, store } = harness();
  queue.enqueue({ '1:的': { star: 'keep-fresh' } });
  const sent = queue.nextBatch();
  const second = harness('owner', store).queue;
  second.token = () => 'second-tab';
  second.enqueue({ '1:的': { star: 'learning' }, '2:一': { rating: 'review' } });
  queue.acknowledge(sent);
  assert.equal(queue.pendingCount, 2);
  assert.deepEqual(queue.nextBatch()[0].patch, { star: 'learning' });
});

test('malformed storage fails closed and batches are bounded', () => {
  const { queue, store } = harness();
  queue.enqueue({ '1:的': { star: 'none' }, '2:一': { star: 'learning' } });
  assert.equal(queue.nextBatch(1).length, 1);
  store.set(queue.key, 'bad JSON');
  assert.throws(() => queue.readPending());
});

test('storage write failure leaves previously queued changes intact', () => {
  const { queue, storage } = harness();
  queue.enqueue({ '1:的': { star: 'learning' } });
  storage.setItem = () => { throw new Error('Quota'); };
  assert.throws(() => queue.enqueue({ '2:一': { star: 'keep-fresh' } }), /Quota/);
  assert.equal(queue.pendingCount, 1);
});
