// 데이터 저장소: Firebase가 설정돼 있으면 온라인, 아니면 '연습 모드'(이 브라우저 안의 탭끼리만)
import { firebaseConfig } from './config.js?v=6';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export async function openStore() {
  if (firebaseConfig && firebaseConfig.databaseURL) {
    try {
      return await firebaseStore(firebaseConfig);
    } catch (e) {
      console.error(e);
      alert('Firebase 연결에 실패했어요. 설정을 확인해 주세요.\n' + e.message);
      throw e;
    }
  }
  return localStore();
}

async function firebaseStore(cfg) {
  const { initializeApp } = await import(FB + 'firebase-app.js');
  const { getAuth, signInAnonymously } = await import(FB + 'firebase-auth.js');
  const d = await import(FB + 'firebase-database.js');
  const app = initializeApp(cfg);
  await signInAnonymously(getAuth(app));
  const db = d.getDatabase(app);
  return {
    mode: 'online',
    set: (p, v) => d.set(d.ref(db, p), v),
    update: (p, v) => d.update(d.ref(db, p), v),
    remove: (p) => d.remove(d.ref(db, p)),
    on: (p, cb) => d.onValue(d.ref(db, p), (s) => cb(s.val())),
  };
}

function localStore() {
  const KEY = 'helpnote-demo';
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
  const parts = (p) => p.split('/').filter(Boolean);
  const getAt = (obj, p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), obj) ?? null;
  const listeners = new Set();
  const emit = () => {
    const s = read();
    listeners.forEach((l) => l.cb(clone(getAt(s, l.p))));
  };
  function write(p, fn) {
    const s = read();
    const ks = parts(p);
    let o = s;
    for (const k of ks.slice(0, -1)) {
      if (typeof o[k] !== 'object' || o[k] === null) o[k] = {};
      o = o[k];
    }
    fn(o, ks[ks.length - 1]);
    localStorage.setItem(KEY, JSON.stringify(s));
    emit();
  }
  window.addEventListener('storage', (e) => { if (e.key === KEY) emit(); });
  return {
    mode: 'demo',
    set: async (p, v) => write(p, (o, k) => { if (v == null) delete o[k]; else o[k] = clone(v); }),
    update: async (p, v) => write(p, (o, k) => { o[k] = Object.assign({}, o[k], clone(v)); }),
    remove: async (p) => write(p, (o, k) => { delete o[k]; }),
    on: (p, cb) => {
      const l = { p, cb };
      listeners.add(l);
      cb(clone(getAt(read(), p)));
      return () => listeners.delete(l);
    },
  };
}
