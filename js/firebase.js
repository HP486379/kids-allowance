// Firebase SDK を読み込んでいる前提 (index.html に script タグあり)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, push, onValue, set, onChildAdded } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyAF2m74NGvgrjd9eh5zVrfrxVO3ZC8aUww",
  authDomain: "kids-allowance-51817.firebaseapp.com",
  databaseURL: "https://kids-allowance-51817-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kids-allowance-51817",
  storageBucket: "kids-allowance-51817.appspot.com",
  messagingSenderId: "946782238727",
  appId: "1:946782238727:web:45e384ccdfc47aacaa92a2"
};

// Firebase 初期化
const app = initializeApp(firebaseConfig);
// 地域付きURLを明示指定
const db = getDatabase(app, firebaseConfig.databaseURL);

// ===== 名前を保存 =====
export function saveName(name) {
  const namesRef = ref(db, "names/");
  push(namesRef, { value: name, timestamp: Date.now() });
}

// ===== 名前一覧をリアルタイムで取得 =====
export function listenNames(callback) {
  const namesRef = ref(db, "names/");
  onValue(namesRef, (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.values(data).map(item => item.value);
    callback(list);
  });
}

// ===== アプリのサマリ保存（data.json 代替） =====
export async function saveSummary(summary) {
  const node = push(ref(db, "summaries/"));
  await set(node, { ...summary, timestamp: Date.now() });
}

// ===== ユーザー識別（ローカルのプロフィールIDを使用） =====
function getUid() {
  try {
    const m = JSON.parse(localStorage.getItem('kid-allowance:meta') || '{}');
    return m.currentId || 'guest';
  } catch {
    return 'guest';
  }
}

// ===== プロフィール保存/購読 =====
export async function saveProfile(profile) {
  const uid = getUid();
  await set(ref(db, `users/${uid}/profile`), { ...profile, timestamp: Date.now() });
}

export function listenProfile(callback) {
  const uid = getUid();
  onValue(ref(db, `users/${uid}/profile`), (snap) => {
    callback(snap.val() || {});
  });
}

// ===== 残高保存/購読 =====
export async function updateBalance(balance) {
  const uid = getUid();
  await set(ref(db, `users/${uid}/balance`), { value: Number(balance) || 0, timestamp: Date.now() });
}

export function listenBalance(callback) {
  const uid = getUid();
  onValue(ref(db, `users/${uid}/balance`), (snap) => {
    const v = snap.val();
    callback(v && typeof v.value !== 'undefined' ? v.value : null);
  });
}

// ===== 取引履歴: 保存/購読 =====
export async function addTransaction(tx) {
  const uid = getUid();
  const txRef = ref(db, `users/${uid}/transactions`);
  const payload = {
    type: tx?.type || 'add',
    amount: Number(tx?.amount) || 0,
    label: tx?.label ?? tx?.note ?? '',
    timestamp: tx?.timestamp || Date.now()
  };
  return push(txRef, payload);
}

export function listenTransactions(callback) {
  const uid = getUid();
  const txRef = ref(db, `users/${uid}/transactions`);
  onChildAdded(txRef, (snapshot) => {
    callback?.(snapshot.key, snapshot.val());
  });
}
