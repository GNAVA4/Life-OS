// Phase B: cross-device sync via Firebase Firestore (offline-first, per-key last-write-wins).
// Model: users/{uid}/state/{name} = { value: <JSON string>, updatedAt: serverTimestamp }.
// Value stored as a STRING to sidestep Firestore field-name/nested-array/undefined constraints.
//
// ⚡ SDK грузится ЛЕНИВО (session 036). Раньше firebase импортировался статически и его чанк (~791 КБ,
// половина стартового кода) парсился при КАЖДОМ запуске — даже если пользователь никогда не входил.
// Теперь: пока в localStorage нет флага «уже входил», firebase не грузится вообще; при входе — грузится
// по требованию. Обёртки onAuth/subscribe обязаны возвращать функцию отписки СИНХРОННО (App.jsx
// использует их результат прямо в useEffect), поэтому они отдают заглушку и доцепляются, когда SDK готов.
//
// ⚠️ Capacitor-плагин (@capacitor-firebase/authentication) импортируется СТАТИЧЕСКИ — ленивый import()
// плагинов в WebView виснет (session 014). Это нативный мост, веса он почти не добавляет.
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

// Флаг «этот пользователь уже входил» — единственное, что читается на старте вместо всего SDK.
// Хранит ровно '1', никаких данных.
const SIGNED_KEY = 'lifeos:signedIn';

let _fb = null; // Promise<{auth, db, a: authModule, f: firestoreModule}>
function fb(){
  if(!_fb) _fb = (async () => {
    const [appMod, a, f, cfg] = await Promise.all([
      import('firebase/app'), import('firebase/auth'), import('firebase/firestore'),
      // Конфиг вынесен в firebaseConfig.js (в .gitignore — не попадает в репозиторий).
      // Для нового окружения: cp firebaseConfig.example.js firebaseConfig.js и впиши свои значения.
      import('./firebaseConfig.js'),
    ]);
    const app = appMod.initializeApp(cfg.firebaseConfig);
    const auth = a.getAuth(app);
    let db;
    try {
      db = f.initializeFirestore(app, {
        localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }),
      });
    } catch (e) {
      db = f.initializeFirestore(app, {}); // fallback if IndexedDB persistence unavailable
    }
    return { auth, db, a, f };
  })();
  return _fb;
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

// ---- слушатель авторизации ----
let _authCb = null;
let _authUnsub = null;
async function attachAuth(){
  if(_authUnsub || !_authCb) return;
  const { auth, a } = await fb();
  if(!_authCb) return;                       // отписались, пока грузился SDK
  _authUnsub = a.onAuthStateChanged(auth, _authCb);
}

// Возвращает функцию отписки СИНХРОННО. Если пользователь ни разу не входил — сообщаем «не авторизован»
// и не трогаем SDK вовсе; слушатель доцепится позже, из login().
export function onAuth(cb){
  _authCb = cb;
  if(localStorage.getItem(SIGNED_KEY)) attachAuth().catch(() => cb(null));
  else cb(null);
  return () => { _authCb = null; if(_authUnsub){ _authUnsub(); _authUnsub = null; } };
}

// Вход через Google.
// - В браузере: обычный signInWithPopup.
// - В нативном приложении (Android/iOS через Capacitor): signInWithPopup в WebView не работает,
//   поэтому берём idToken нативным Google Sign-In (@capacitor-firebase/authentication) и логиним
//   им ИМЕННО web-SDK (getAuth), которым пользуется Firestore — через signInWithCredential (без попапа).
export async function login() {
  const { auth, a } = await fb();
  let res;
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential && result.credential.idToken;
    if (!idToken) throw new Error('Не удалось получить idToken от Google');
    res = await a.signInWithCredential(auth, a.GoogleAuthProvider.credential(idToken));
  } else {
    res = await a.signInWithPopup(auth, new a.GoogleAuthProvider());
  }
  // со следующего запуска слушатель авторизации поднимется сам (и SDK будет загружен на старте)
  try { localStorage.setItem(SIGNED_KEY, '1'); } catch (e) {}
  await attachAuth();
  return res;
}

export async function logout() {
  try { localStorage.removeItem(SIGNED_KEY); } catch (e) {}
  if (Capacitor.isNativePlatform()) {
    try { await FirebaseAuthentication.signOut(); } catch (e) { /* ignore */ }
  }
  const { auth, a } = await fb();
  return a.signOut(auth);
}

// one-shot read of the whole cloud state -> { 'lifeos:key': valueString }
export async function getCloudState(uid) {
  const { db, f } = await fb();
  const out = {};
  const snap = await f.getDocs(f.collection(db, 'users', uid, 'state'));
  snap.forEach((d) => { const v = d.data(); if (v && typeof v.value === 'string') out[nameToKey(d.id)] = v.value; });
  return out;
}

// push one key's stringified value up (SDK queues it while offline)
export async function pushKey(uid, key, valueString) {
  if (!uid) return;
  try {
    const { db, f } = await fb();
    await f.setDoc(f.doc(db, 'users', uid, 'state', keyToName(key)), {
      value: valueString, updatedAt: f.serverTimestamp(),
    });
  } catch (e) { /* offline / transient — the persistent cache will retry */ }
}

// live subscription; calls onRemote(key, valueString) for remote changes only
// (skips our own optimistic writes echoing back via hasPendingWrites).
// Отписку возвращаем СИНХРОННО — App.jsx присваивает результат и зовёт его в cleanup.
export function subscribe(uid, onRemote) {
  let unsub = null, cancelled = false;
  fb().then(({ db, f }) => {
    if (cancelled) return;
    unsub = f.onSnapshot(f.collection(db, 'users', uid, 'state'), (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') return;
        if (ch.doc.metadata.hasPendingWrites) return;
        const v = ch.doc.data();
        if (v && typeof v.value === 'string') onRemote(nameToKey(ch.doc.id), v.value);
      });
    });
  }).catch(() => {});
  return () => { cancelled = true; if (unsub) unsub(); };
}
