// Phase B: cross-device sync via Firebase Firestore (offline-first, per-key last-write-wins).
// Model: users/{uid}/state/{name} = { value: <JSON string>, updatedAt: serverTimestamp }.
// Value stored as a STRING to sidestep Firestore field-name/nested-array/undefined constraints.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, getDocs, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
// Конфиг вынесен в firebaseConfig.js (в .gitignore — не попадает в репозиторий).
// Для нового окружения: cp firebaseConfig.example.js firebaseConfig.js и впиши свои значения.
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (e) {
  db = initializeFirestore(app, {}); // fallback if IndexedDB persistence unavailable
}

export const LIFEOS_KEYS = [
  'lifeos:days', 'lifeos:dailyTasks', 'lifeos:ongoingTasks', 'lifeos:tags', 'lifeos:goals',
  'lifeos:study', 'lifeos:notes', 'lifeos:categories', 'lifeos:budgets', 'lifeos:recurringBills',
  'lifeos:finance', 'lifeos:meta', 'lifeos:incomePlans', 'lifeos:settings', 'lifeos:achievements', 'lifeos:habits',
  'lifeos:goalsArchive', 'lifeos:habitsArchive', 'lifeos:taskTemplates', 'lifeos:studyArchive',
  'lifeos:antiTags',
];
const keyToName = (k) => k.replace(/^lifeos:/, '');
const nameToKey = (n) => 'lifeos:' + n;

export function onAuth(cb) { return onAuthStateChanged(auth, cb); }

// Вход через Google.
// - В браузере: обычный signInWithPopup.
// - В нативном приложении (Android/iOS через Capacitor): signInWithPopup в WebView не работает,
//   поэтому берём idToken нативным Google Sign-In (@capacitor-firebase/authentication) и логиним
//   им ИМЕННО web-SDK (getAuth), которым пользуется Firestore — через signInWithCredential (без попапа).
export async function login() {
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential && result.credential.idToken;
    if (!idToken) throw new Error('Не удалось получить idToken от Google');
    const credential = GoogleAuthProvider.credential(idToken);
    return signInWithCredential(auth, credential);
  }
  return signInWithPopup(auth, provider);
}

export async function logout() {
  if (Capacitor.isNativePlatform()) {
    try { await FirebaseAuthentication.signOut(); } catch (e) { /* ignore */ }
  }
  return fbSignOut(auth);
}

// one-shot read of the whole cloud state -> { 'lifeos:key': valueString }
export async function getCloudState(uid) {
  const out = {};
  const snap = await getDocs(collection(db, 'users', uid, 'state'));
  snap.forEach((d) => { const v = d.data(); if (v && typeof v.value === 'string') out[nameToKey(d.id)] = v.value; });
  return out;
}

// push one key's stringified value up (SDK queues it while offline)
export async function pushKey(uid, key, valueString) {
  if (!uid) return;
  try {
    await setDoc(doc(db, 'users', uid, 'state', keyToName(key)), {
      value: valueString, updatedAt: serverTimestamp(),
    });
  } catch (e) { /* offline / transient — the persistent cache will retry */ }
}

// live subscription; calls onRemote(key, valueString) for remote changes only
// (skips our own optimistic writes echoing back via hasPendingWrites)
export function subscribe(uid, onRemote) {
  return onSnapshot(collection(db, 'users', uid, 'state'), (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed') return;
      if (ch.doc.metadata.hasPendingWrites) return;
      const v = ch.doc.data();
      if (v && typeof v.value === 'string') onRemote(nameToKey(ch.doc.id), v.value);
    });
  });
}
