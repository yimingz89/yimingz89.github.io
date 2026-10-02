import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp, onSnapshot, writeBatch } from 'firebase/firestore';

let environment;
const ownerUid = 'test-owner';
const ownerEmail = 'owner@example.com';
const ownerClaims = { email: ownerEmail, email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const card = (database, id = '100:实', uid = ownerUid) => doc(database, 'users', uid, 'cards', id);
const payload = (extra = {}) => ({ star: 'learning', updatedAt: serverTimestamp(), ...extra });

before(async () => {
  const rules = readFileSync(new URL('../firebase/firestore.rules.example', import.meta.url), 'utf8').replaceAll('OWNER_GOOGLE_EMAIL', ownerEmail);
  environment = await initializeTestEnvironment({ projectId: 'demo-hanzi-study', firestore: { rules } });
});
beforeEach(async () => { await environment.clearFirestore(); });
after(async () => { await environment?.cleanup(); });

test('owner can save, list and update cards while preserving independent fields', async () => {
  const db = environment.authenticatedContext(ownerUid, ownerClaims).firestore();
  await assertSucceeds(setDoc(card(db), payload()));
  await assertSucceeds(setDoc(card(db), { rating: 'learned', updatedAt: serverTimestamp() }, { merge: true }));
  const result = await assertSucceeds(getDoc(card(db)));
  assert.equal(result.data().star, 'learning');
  assert.equal(result.data().rating, 'learned');
  await assertSucceeds(getDocs(collection(db, 'users', ownerUid, 'cards')));
  await assertSucceeds(setDoc(card(db), payload({ star: 'none', rating: 'unrated' })));
});

test('anonymous, other accounts, unverified emails, and non-Google providers are denied', async () => {
  const contexts = [
    environment.unauthenticatedContext(),
    environment.authenticatedContext('intruder', { ...ownerClaims, email: 'intruder@example.com' }),
    environment.authenticatedContext(ownerUid, { ...ownerClaims, email_verified: false }),
    environment.authenticatedContext(ownerUid, { ...ownerClaims, firebase: { sign_in_provider: 'password' } }),
  ];
  for (const context of contexts) {
    await assertFails(getDoc(card(context.firestore())));
    await assertFails(setDoc(card(context.firestore()), payload()));
  }
});

test('owner cannot write other users, unrelated collections, or invalid documents', async () => {
  const db = environment.authenticatedContext(ownerUid, ownerClaims).firestore();
  await assertFails(setDoc(card(db, '100:实', 'other-user'), payload()));
  await assertFails(setDoc(doc(db, 'settings', 'private'), payload()));
  await assertFails(setDoc(card(db, 'invalid-id'), payload()));
  for (const invalid of [
    payload({ star: 'bad' }), payload({ rating: ['learned'] }), payload({ extra: true }),
    payload({ updatedAt: 123 }), { updatedAt: serverTimestamp() }, { star: 'learning' },
  ]) await assertFails(setDoc(card(db), invalid));
  await assertSucceeds(setDoc(card(db), payload()));
  await assertFails(deleteDoc(card(db)));
});

test('a second signed-in device receives cloud changes and removals', async () => {
  const first = environment.authenticatedContext(ownerUid, ownerClaims).firestore();
  const second = environment.authenticatedContext(ownerUid, ownerClaims).firestore();
  let unsubscribe;
  let timeout;
  const observed = new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error('Second-device listener did not receive the update')), 10000);
    unsubscribe = onSnapshot(card(second), (snapshot) => {
      if (snapshot.data()?.star === 'none' && snapshot.data()?.rating === 'learned') resolve();
    }, reject);
  });
  try {
    const batch = writeBatch(first);
    batch.set(card(first), payload({ star: 'keep-fresh', rating: 'learned' }));
    await batch.commit();
    await setDoc(card(first), payload({ star: 'none' }), { merge: true });
    await observed;
  } finally { clearTimeout(timeout); unsubscribe?.(); }
});
