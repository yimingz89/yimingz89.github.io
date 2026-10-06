import { firebaseConfig } from './firebase-config.js';
import { SyncState, backupToRecords, recordsToBackup } from './sync-state.mjs';

const panel = document.querySelector('#cloud-panel');
const status = document.querySelector('#cloud-status');
const signInError = document.querySelector('#cloud-signin-error');
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
let authKnown = false;
let signInAttempt = null;
let operationChain = Promise.resolve();
let queueSafe = false;
let connectionTimer = null;
let connectionSlow = false;
let syncError = null;
const CONNECTION_TIMEOUT_MS = 15000;

function show(message, isError = false) {
  status.textContent = message;
  panel.classList.toggle('is-error', isError);
}

function friendlyError(error) {
  if (error.code === 'permission-denied') return 'Cloud access denied. Publish the owner-only Firestore rules and use your authorized Google account, then Retry.';
  if (error.code === 'auth/unauthorized-domain') return `This address (${window.location.hostname}) is not authorized for sign-in. Add ${window.location.hostname} to Firebase Authentication → Settings → Authorized domains, or use the hosted app at yimingz89.github.io/flashcards/.`;
  if (error.code === 'auth/operation-not-allowed') return 'Enable the Google provider in Firebase Authentication.';
  if (error.code === 'auth/popup-blocked') return 'Allow the Google sign-in popup for this website, then try again.';
  if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') return 'Sign-in canceled. Your saved cards are unchanged.';
  if (error.code === 'auth/web-storage-unsupported') return 'Allow browser storage for this website to save your sign-in.';
  if (error.code === 'auth/network-request-failed') return 'Google sign-in could not communicate with Firebase. This can be a blocked request or an interrupted connection; your saved cards are unchanged. Try again and share the error code below if it persists.';
  if (error.code === 'unavailable') return 'Connection unavailable. Saved local changes will sync when you reconnect.';
  return 'Cloud sync couldn’t finish. Your local data is still available. Check your connection and browser storage, then Retry.';
}

function errorCode(error) {
  // Error messages/customData may contain credentials. Expose only a safe code.
  return typeof error?.code === 'string' && /^(?:auth\/)?[a-z][a-z0-9-]{0,80}$/.test(error.code)
    ? error.code : 'unknown-error';
}

function clearSignInError() {
  signInError.textContent = '';
  signInError.classList.add('hidden');
}

function updateSignInButton() {
  const waiting = !!signInAttempt && !signInAttempt.slow;
  login.disabled = !authKnown || waiting;
  login.textContent = waiting ? 'Waiting for Google…'
    : signInError.textContent ? 'Retry Google sign-in' : 'Sign in with Google';
  login.setAttribute('aria-busy', String(waiting));
}

function showSignInError(error) {
  signInError.textContent = `${friendlyError(error)} Error code: ${errorCode(error)}.`;
  signInError.classList.remove('hidden');
  console.warn('Hanzi Google sign-in:', errorCode(error));
}

function clearConnectionTimer() {
  if (connectionTimer !== null) window.clearTimeout(connectionTimer);
  connectionTimer = null;
}

function report(error, current = session, storageFailure = false) {
  if (current !== session) return;
  clearConnectionTimer();
  stopped = true;
  syncError = error;
  if (storageFailure) queueSafe = false;
  retry.classList.remove('hidden');
  recover.disabled = true;
  api?.setCloudEditable(!user || queueSafe);
  if (user) paintStatus();
  else show(friendlyError(error), true);
  console.warn('Hanzi cloud sync:', errorCode(error));
}

function serial(operation, uid = user?.uid || 'signed-out') {
  const run = () => navigator.locks
    ? navigator.locks.request(`hanzi-state:${uid}`, operation)
    : operation();
  const result = operationChain.then(run);
  // A rejected operation must not prevent later recovery or another user's queue.
  operationChain = result.catch(() => {});
  return result;
}

function paintStatus() {
  if (!user) return;
  if (!queueSafe) {
    show('Browser storage could not safely save your changes. Editing is paused. Export your progress before troubleshooting, then Retry. Do not clear site data.', true);
    return;
  }
  let count;
  try { count = engine.pendingCount; }
  catch (error) { report(error, session, true); return; }
  const local = count
    ? `${count} card${count === 1 ? '' : 's'} saved on this device, waiting to sync.`
    : 'You can keep editing and importing on this device.';
  retry.classList.toggle('hidden', !(stopped || connectionSlow || !navigator.onLine));
  if (stopped) show(`${friendlyError(syncError)} ${local}`, true);
  else if (!navigator.onLine) show(`Offline · ${local}`);
  else if (!ready && connectionSlow) show(`Cloud connection is taking longer than expected. ${local} Retry to reconnect.`, true);
  else if (!ready) show(`Connecting to your saved cloud data… ${local}`);
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
      await serial(() => { if (current === session) items = queue.nextBatch(); }, uid)
        .catch((error) => { report(error, current, true); });
      if (!items?.length) break;
      const batch = db.writeBatch();
      for (const item of items) batch.set(db.card(uid, item.id), { ...item.patch, updatedAt: db.serverTimestamp() }, { merge: true });
      await batch.commit();
      await serial(() => {
        // Preserve the old user's queue when sign-out interrupts a request.
        if (current !== session) return;
        queue.acknowledge(items);
      }, uid).catch((error) => { report(error, current, true); });
    }
  };
  try {
    // Serialize cloud writes between tabs without blocking their local edit queues.
    if (navigator.locks) await navigator.locks.request(`hanzi-send:${uid}`, send);
    else await send();
  } catch (error) {
    report(error, current);
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
  clearConnectionTimer();
  unsubscribe?.();
  unsubscribe = null;
  user = nextUser;
  ready = false;
  flushing = false;
  stopped = false;
  queueSafe = false;
  connectionSlow = false;
  syncError = null;
  engine = null;
  retry.classList.add('hidden');
  recover.classList.add('hidden');
  recover.disabled = true;
  login.classList.toggle('hidden', !!user);
  logout.classList.toggle('hidden', !user);
  api.setCloudEditable(!user);
  api.setCloudSignedIn(!!user);
  if (!user) {
    account.textContent = '';
    show(signInAttempt ? 'Waiting for Google sign-in. Complete the separate Google window if it opened.'
      : 'Signed out · changes are saved only in this browser. Sign in to sync across devices.');
    return;
  }
  account.textContent = user.email || 'Signed in';
  try {
    const uid = user.uid;
    const original = api.getBackup();
    if (!localStorage.getItem(backupKey(uid))) localStorage.setItem(backupKey(uid), JSON.stringify(original));
    const queue = new SyncState({ storage: localStorage, uid, validIds: api.getCardIds() });
    engine = queue;
    // Validate and test persistence before allowing edits. Local commits and
    // snapshots share this lock, so a snapshot cannot overwrite an unqueued edit.
    await serial(() => {
      queue.enqueue({});
      if (current !== session) return;
      api.applyCloudBackup(recordsToBackup(queue.acceptRemote(backupToRecords(original))));
    }, uid);
    if (current !== session) return;
    queueSafe = true;
    api.setCloudEditable(true);
    paintStatus();
    connectionTimer = window.setTimeout(() => {
      if (current !== session || ready || stopped) return;
      connectionTimer = null;
      connectionSlow = true;
      paintStatus();
    }, CONNECTION_TIMEOUT_MS);
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
          if (snapshot.empty && !localStorage.getItem(linkedKey)) {
            const seed = backupToRecords(original);
            const pending = queue.readPending();
            // Preserve the initial migration, but never replace newer local
            // edits (including explicit star/rating removals) with the seed.
            for (const [id, fields] of Object.entries(seed)) {
              for (const field of Object.keys(fields)) if (pending[id]?.[field]) delete fields[field];
              if (!Object.keys(fields).length) delete seed[id];
            }
            if (Object.keys(seed).length) queue.enqueue(seed);
          }
          localStorage.setItem(linkedKey, 'true');
          first = false;
        }
        api.applyCloudBackup(recordsToBackup(queue.acceptRemote(records)));
        ready = true;
        connectionSlow = false;
        clearConnectionTimer();
        api.setCloudEditable(true);
        recover.classList.remove('hidden');
        recover.disabled = false;
        paintStatus();
      }, uid).then(flush).catch((error) => report(error, current, true));
    }, (error) => report(error, current));
  } catch (error) { report(error, current, true); }
}

function saveChanges(changes, applyLocal) {
  if (!user) return applyLocal();
  const current = session;
  const uid = user.uid;
  const queue = engine;
  if (!queueSafe || !queue) throw new Error('Browser storage is not ready. Export your progress and Retry.');
  return serial(() => {
    // Keep accepted edits for their original account even if Retry/sign-out
    // runs while this operation is waiting for another tab's storage lock.
    queue.enqueue(changes);
    if (current === session) {
      applyLocal();
      paintStatus();
    }
  }, uid).then(() => {
    if (current === session) void flush();
  }).catch((error) => {
    report(error, current, true);
    throw new Error('Your browser couldn’t safely save the change. Export your progress and check browser storage before retrying.', { cause: error });
  });
}

async function start() {
  api = window.hanziStudy;
  if (!api) throw new Error('Study app did not initialize');
  if (!await api.ready) throw new Error('Study deck could not load');
  api.setChangeSaver(saveChanges);
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
  login.addEventListener('click', async (event) => {
    event.preventDefault();
    if (!authKnown || (signInAttempt && !signInAttempt.slow)) return;
    // Firebase cancels the previous popup operation when a retry starts. Ignore
    // that old promise's rejection so it cannot erase the new attempt's status.
    if (signInAttempt) window.clearTimeout(signInAttempt.timer);
    const attempt = { slow: false, timer: null };
    signInAttempt = attempt;
    clearSignInError();
    updateSignInButton();
    show('Opening Google sign-in… Complete the separate Google window if it appears.');
    attempt.timer = window.setTimeout(() => {
      if (signInAttempt !== attempt) return;
      attempt.slow = true;
      signInError.textContent = 'Google sign-in is still waiting. Finish it in the Google window, or click Retry Google sign-in to start again. Your cards are unchanged. Diagnostic: sign-in-pending.';
      signInError.classList.remove('hidden');
      updateSignInButton();
    }, 20000);
    try {
      const provider = new authSdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await authSdk.signInWithPopup(auth, provider);
    } catch (error) {
      if (signInAttempt === attempt) {
        show('Sign-in did not finish. Your cards remain saved in this browser.', true);
        showSignInError(error);
      }
    } finally {
      window.clearTimeout(attempt.timer);
      if (signInAttempt === attempt) {
        signInAttempt = null;
        updateSignInButton();
      }
    }
  });
  logout.addEventListener('click', async () => {
    if (engine?.pendingCount && !window.confirm('Some changes are not yet synced. They will stay queued on this device for this account. Sign out anyway?')) return;
    try { await authSdk.signOut(auth); } catch (error) { report(error); }
  });
  retry.addEventListener('click', () => { void connect(auth.currentUser); });
  recover.addEventListener('click', async () => {
    if (!user || !ready || stopped) return;
    const current = session;
    try {
      const backup = JSON.parse(localStorage.getItem(backupKey(user.uid)) || 'null');
      if (!backup) return;
      const count = backup.keepFresh.length + backup.learning.length;
      if (!window.confirm(`Merge the ${count} stars and ${Object.keys(backup.progress).length} progress marks saved before cloud setup? Those marks will win for matching cards and sync to your other devices.`)) return;
      await api.mergeBackup(backup);
    } catch {
      // The saver already reports real storage failures. A busy/invalid backup
      // must not disable a healthy queue or affect a different signed-in user.
      if (current === session && queueSafe) show('Backup merge did not finish. Wait for any local save to complete and try again, or import a valid exported backup.', true);
    }
  });
  window.addEventListener('online', () => {
    if (user && queueSafe && (stopped || !ready)) void connect(auth.currentUser);
    else { paintStatus(); void flush(); }
  });
  window.addEventListener('offline', paintStatus);
  window.addEventListener('storage', (event) => {
    if (!engine || event.key !== engine.key || !ready || stopped) return;
    paintStatus();
    void flush();
  });
  authSdk.onAuthStateChanged(auth, (nextUser) => {
    authKnown = true;
    if (nextUser) {
      if (signInAttempt) window.clearTimeout(signInAttempt.timer);
      signInAttempt = null;
      clearSignInError();
    }
    updateSignInButton();
    void connect(nextUser);
  }, (error) => {
    showSignInError(error);
    report(error);
  });
}

start().catch((error) => {
  showSignInError(error);
  show('Cloud sign-in could not load. You can still study locally. Check your connection or content blocker and refresh.', true);
});
