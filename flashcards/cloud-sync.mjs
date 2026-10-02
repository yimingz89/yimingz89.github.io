import { firebaseConfig } from './firebase-config.js';
import { SyncState, backupToRecords, recordsToBackup } from './sync-state.mjs';

const panel = document.querySelector('#cloud-panel');
const status = document.querySelector('#cloud-status');
const account = document.querySelector('#cloud-account');
const login = document.querySelector('#cloud-login');
const logout = document.querySelector('#cloud-logout');
const retry = document.querySelector('#cloud-retry');
const recover = document.querySelector('#cloud-recover');
const sdkBase = 'https://www.gstatic.com/firebasejs/12.19.0/';
let api;
let auth;
let db;
let user = null;
let engine = null;
let unsubscribe = null;
let session = 0;
let ready = false;
let flushing = false;
let stopped = false;
let operationChain = Promise.resolve();

function show(message, isError = false) {
  status.textContent = message;
  panel.classList.toggle('is-error', isError);
}

function friendlyError(error) {
  if (error.code === 'permission-denied') return 'Cloud access denied. Publish the owner-only Firestore rules and use your authorized Google account, then Retry.';
  if (error.code === 'auth/unauthorized-domain') return 'Add yimingz89.github.io to Firebase Authentication → Settings → Authorized domains.';
  if (error.code === 'auth/operation-not-allowed') return 'Enable the Google provider in Firebase Authentication.';
  if (error.code === 'auth/popup-blocked') return 'Allow the Google sign-in popup for this website, then try again.';
  if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') return 'Sign-in canceled. Your saved cards are unchanged.';
  if (error.code === 'auth/web-storage-unsupported') return 'Allow browser storage for this website to save your sign-in.';
  if (error.code === 'unavailable' || error.code === 'auth/network-request-failed') return 'Connection unavailable. Saved local changes will sync when you reconnect.';
  return 'Cloud sync couldn’t finish. Your local data is still available. Check your connection and browser storage, then Retry.';
}

function report(error) {
  stopped = true;
  show(friendlyError(error), true);
  retry.classList.remove('hidden');
  // Don’t allow unqueued changes to be overwritten by a later server snapshot.
  api?.setCloudEditable(!user);
  console.warn('Hanzi cloud sync:', error.code || error.message);
}

function serial(operation) {
  const run = () => navigator.locks
    ? navigator.locks.request(`hanzi-state:${user?.uid || 'signed-out'}`, operation)
    : operation();
  operationChain = operationChain.then(run).catch(report);
  return operationChain;
}

function paintStatus() {
  if (stopped || !user) return;
  const count = engine?.pendingCount || 0;
  if (!navigator.onLine) show(`Offline · ${count} card${count === 1 ? '' : 's'} waiting to sync on this device`);
  else if (!ready) show('Connecting to your saved cloud data…');
  else if (count || flushing) show(`Saving to cloud…${count ? ` (${count} cards)` : ''}`);
  else show('Synced to cloud · available on your other signed-in devices');
}

async function flush() {
  if (!user || !engine || !ready || stopped || flushing || !navigator.onLine) return;
  const current = session;
  const uid = user.uid;
  const queue = engine;
  flushing = true;
  paintStatus();
  const send = async () => {
    while (current === session && !stopped && navigator.onLine) {
      let items;
      await serial(() => { if (current === session) items = queue.nextBatch(); });
      if (!items?.length) break;
      const batch = db.writeBatch();
      for (const item of items) batch.set(db.card(uid, item.id), { ...item.patch, updatedAt: db.serverTimestamp() }, { merge: true });
      await batch.commit();
      await serial(() => {
        // Preserve the old user's queue when sign-out interrupts a request.
        if (current !== session) return;
        queue.acknowledge(items);
      });
    }
  };
  try {
    // Serialize cloud writes between tabs without blocking their local edit queues.
    if (navigator.locks) await navigator.locks.request(`hanzi-send:${uid}`, send);
    else await send();
  } catch (error) {
    if (current === session) report(error);
  } finally {
    if (current === session) {
      flushing = false;
      paintStatus();
      // An edit can arrive while the final empty batch is releasing its lock.
      if (!stopped && ready && navigator.onLine && queue.pendingCount) void flush();
    }
  }
}

function backupKey(uid) { return `hanzi-before-cloud-v1:${uid}`; }

async function connect(nextUser) {
  const current = ++session;
  unsubscribe?.();
  unsubscribe = null;
  user = nextUser;
  ready = false;
  flushing = false;
  stopped = false;
  engine = null;
  retry.classList.add('hidden');
  recover.classList.add('hidden');
  login.classList.toggle('hidden', !!user);
  logout.classList.toggle('hidden', !user);
  api.setCloudEditable(!user);
  api.setCloudSignedIn(!!user);
  if (!user) {
    account.textContent = '';
    show('Signed out · changes are saved only in this browser. Sign in to sync across devices.');
    return;
  }
  account.textContent = user.email || 'Signed in';
  try {
    const uid = user.uid;
    const original = api.getBackup();
    if (!localStorage.getItem(backupKey(uid))) localStorage.setItem(backupKey(uid), JSON.stringify(original));
    recover.classList.remove('hidden');
    engine = new SyncState({ storage: localStorage, uid, validIds: api.getCardIds() });
    engine.readPending();
    paintStatus();
    let first = true;
    unsubscribe = db.listen(uid, (snapshot) => {
      if (current !== session || stopped || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      void serial(() => {
        if (current !== session || stopped) return;
        const records = {};
        snapshot.forEach((document) => { records[document.id] = document.data(); });
        if (first) {
          const linkedKey = `hanzi-cloud-linked-v1:${uid}`;
          // Seed only a genuinely empty cloud on this browser's first successful link.
          // Never union old local lists into an existing cloud: that revives removed stars.
          if (snapshot.empty && !localStorage.getItem(linkedKey) && !engine.pendingCount) {
            const seed = backupToRecords(original);
            if (Object.keys(seed).length) engine.enqueue(seed);
          }
          localStorage.setItem(linkedKey, 'true');
          first = false;
        }
        api.applyCloudBackup(recordsToBackup(engine.acceptRemote(records)));
        ready = true;
        api.setCloudEditable(true);
        paintStatus();
      }).then(flush);
    }, (error) => { if (current === session) report(error); });
  } catch (error) { if (current === session) report(error); }
}

async function start() {
  api = window.hanziStudy;
  if (!api) throw new Error('Study app did not initialize');
  if (!await api.ready) throw new Error('Study deck could not load');
  const [appSdk, authSdk, firestore] = await Promise.all([
    import(`${sdkBase}firebase-app.js`),
    import(`${sdkBase}firebase-auth.js`),
    import(`${sdkBase}firebase-firestore.js`),
  ]);
  const app = appSdk.initializeApp(firebaseConfig);
  auth = authSdk.getAuth(app);
  const store = firestore.initializeFirestore(app, { localCache: firestore.memoryLocalCache() });
  db = {
    card: (uid, id) => firestore.doc(store, 'users', uid, 'cards', id),
    writeBatch: () => firestore.writeBatch(store),
    serverTimestamp: firestore.serverTimestamp,
    listen: (uid, success, failure) => firestore.onSnapshot(
      firestore.collection(store, 'users', uid, 'cards'), { includeMetadataChanges: true }, success, failure,
    ),
  };
  login.disabled = false;
  login.addEventListener('click', async () => {
    login.disabled = true;
    show('Opening Google sign-in…');
    try {
      const provider = new authSdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await authSdk.signInWithPopup(auth, provider);
    } catch (error) {
      show(friendlyError(error), true);
    } finally { login.disabled = false; }
  });
  logout.addEventListener('click', async () => {
    if (engine?.pendingCount && !window.confirm('Some changes are not yet synced. They will stay queued on this device for this account. Sign out anyway?')) return;
    try { await authSdk.signOut(auth); } catch (error) { report(error); }
  });
  retry.addEventListener('click', () => { void connect(auth.currentUser); });
  recover.addEventListener('click', () => {
    if (!user || !ready || stopped) return;
    const backup = JSON.parse(localStorage.getItem(backupKey(user.uid)) || 'null');
    if (!backup) return;
    const count = backup.keepFresh.length + backup.learning.length;
    if (!window.confirm(`Merge the ${count} stars and ${Object.keys(backup.progress).length} progress marks saved before cloud setup? Those marks will win for matching cards and sync to your other devices.`)) return;
    api.mergeBackup(backup);
  });
  api.subscribe((changes) => {
    if (!user || !engine) return;
    const current = session;
    void serial(() => {
      if (current !== session) return;
      engine.enqueue(changes);
      paintStatus();
    }).then(flush);
  });
  window.addEventListener('online', () => { paintStatus(); void flush(); });
  window.addEventListener('offline', paintStatus);
  window.addEventListener('storage', (event) => {
    if (!engine || event.key !== engine.key || !ready || stopped) return;
    paintStatus();
    void flush();
  });
  authSdk.onAuthStateChanged(auth, (nextUser) => { void connect(nextUser); }, report);
}

start().catch(() => {
  show('Cloud sign-in could not load. You can still study locally. Check your connection or content blocker and refresh.', true);
});
