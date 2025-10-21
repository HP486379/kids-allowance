import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  set,
  onChildAdded,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyAF2m74NGvgrjd9eh5zVrfrxVO3ZC8aUww",
  authDomain: "kids-allowance-51817.firebaseapp.com",
  databaseURL:
    "https://kids-allowance-51817-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kids-allowance-51817",
  storageBucket: "kids-allowance-51817.appspot.com",
  messagingSenderId: "946782238727",
  appId: "1:946782238727:web:45e384ccdfc47aacaa92a2",
};

// Firebase 初期化
const app = initializeApp(firebaseConfig);
const db = getDatabase(app, firebaseConfig.databaseURL);

// ===== ユーザー識別（ローカルのプロフィールIDを使用） =====
export function getUid() {
  try {
    // 1) URL クエリ優先（?uid=xxxx または ?code=xxxx）
    try {
      const params = new URLSearchParams(location.search || "");
      const q = params.get("uid") || params.get("code");
      if (q) return String(q);
    } catch {}

    // 2) 共有コード（設定/コンソールで保存可能）
    try {
      const share = localStorage.getItem("kid-allowance:share-code");
      if (share) return String(share);
    } catch {}

    // 3) プロファイルの currentId（従来どおり）
    const m = JSON.parse(localStorage.getItem("kid-allowance:meta") || "{}");
    return String(m.currentId || "guest");
  } catch (e) {
    console.warn("getUid parse error", e);
    return "guest";
  }
}

// 共有コードの設定ヘルパー（必要に応じて UI から呼び出し）
export function setShareUid(uid) {
  try { localStorage.setItem("kid-allowance:share-code", String(uid || "")); } catch {}
}

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
    const list = Object.values(data).map((item) => item.value);
    callback(list);
  });
}

// ===== アプリのサマリ保存（data.json 代替） =====
export async function saveSummary(summary) {
  const node = push(ref(db, "summaries/"));
  await set(node, { ...summary, timestamp: Date.now() });
}

// ===== プロフィール保存/購読 =====
export async function saveProfile(profile) {
  const uid = getUid();
  await set(ref(db, `users/${uid}/profile`), {
    ...profile,
    timestamp: Date.now(),
  });
}

export function listenProfile(callback) {
  const uid = getUid();
  return onValue(ref(db, `users/${uid}/profile`), (snap) => {
    callback(snap.val() || {});
  });
}

// ===== 残高保存/購読 =====
export async function updateBalance(balance) {
  const uid = getUid();
  await set(ref(db, `users/${uid}/balance`), {
    value: Number(balance) || 0,
    timestamp: Date.now(),
  });
}

export function listenBalance(callback) {
  const uid = getUid();
  return onValue(ref(db, `users/${uid}/balance`), (snap) => {
    const v = snap.val();
    callback(v && typeof v.value !== "undefined" ? v.value : null);
  });
}

// ===== 取引履歴: 保存/購読 =====
export async function addTransaction(tx) {
  const uid = getUid();
  const txRef = ref(db, `users/${uid}/transactions`);
  const payload = {
    type: tx?.type || "add",
    amount: Number(tx?.amount) || 0,
    label: tx?.label ?? tx?.note ?? "",
    timestamp: tx?.timestamp || Date.now(),
    id: tx?.id ? String(tx.id) : undefined,
  };
  return push(txRef, payload);
}

export function listenTransactions(callback) {
  const uid = getUid();
  const txRef = ref(db, `users/${uid}/transactions`);
  return onChildAdded(txRef, (snapshot) => {
    callback?.(snapshot.key, snapshot.val());
  });
}

// ===== 全件読み込み（初期ロード用） =====
export function loadAllTransactions(callback) {
  const uid = getUid();
  const txRef = ref(db, "users/" + uid + "/transactions");
  return onValue(txRef, (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.entries(data).map(([key, val]) => ({ id: key, ...val }));
    callback?.(list);
  });
}

// ===== Goals / Chores 保存・購読 =====
// 改善点：保存時に配列→オブジェクトへ正規化し、購読時に常に配列を返すようにする。
// これにより端末間での保存フォーマット差による不整合を防ぐ。

function makeIdIfMissing(item) {
  if (item && item.id) return String(item.id);
  return `g_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export async function saveGoals(goals) {
  const uid = getUid();
  const node = ref(db, "users/" + uid + "/goals");
  const arr = Array.isArray(goals) ? goals : [];
  const payload = {};
  arr.forEach((g) => {
    const id = makeIdIfMissing(g);
    // 既存のプロパティはそのまま保持。id を埋める。
    payload[id] = { ...(g || {}), id };
  });
  // 空であれば空オブジェクトとして保存（配列だと穴が生じるため）
  await set(node, Object.keys(payload).length ? payload : {});
  console.debug("saveGoals -> saved", uid, payload);
}

export async function saveChores(chores) {
  const uid = getUid();
  const node = ref(db, "users/" + uid + "/chores");
  const arr = Array.isArray(chores) ? chores : [];
  const payload = {};
  arr.forEach((c) => {
    const id = c && c.id ? String(c.id) : `c_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    payload[id] = { ...(c || {}), id };
  });
  await set(node, Object.keys(payload).length ? payload : {});
  console.debug("saveChores -> saved", uid, payload);
}

function normalizeSnapshotToArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    // 配列の場合は index を id にするが、配列穴を削除
    return val
      .map((v, i) => (v ? { id: v.id || String(i), ...v } : null))
      .filter(Boolean);
  }
  // オブジェクトの場合はキーを id にして配列化
  return Object.entries(val).map(([k, v]) => ({ id: k, ...(v || {}) }));
}

export function listenGoals(callback) {
  const uid = getUid();
  return onValue(ref(db, "users/" + uid + "/goals"), (snap) => {
    const val = snap.val();
    const arr = normalizeSnapshotToArray(val);
    console.debug("listenGoals -> received", uid, arr);
    callback?.(arr);
  });
}

export function listenChores(callback) {
  const uid = getUid();
  return onValue(ref(db, "users/" + uid + "/chores"), (snap) => {
    const val = snap.val();
    const arr = normalizeSnapshotToArray(val);
    console.debug("listenChores -> received", uid, arr);
    callback?.(arr);
  });
}
function sanitizeTxKey(key, fallback) {
  const raw = String(key ?? fallback ?? `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  return raw.replace(/[.#$/[\]]/g, "_");
}

export async function saveTransactionsSnapshot(transactions) {
  const uid = getUid();
  const node = ref(db, `users/${uid}/transactions`);
  const arr = Array.isArray(transactions) ? transactions : [];
  const payload = {};
  arr.forEach((tx, index) => {
    if (!tx || typeof tx !== "object") return;
    const key = sanitizeTxKey(tx.id, `tx_${index}`);
    const amount = Number(tx.amount) || 0;
    const label = tx.note ?? tx.label ?? "";
    let ts = Number(tx.timestamp);
    if (!Number.isFinite(ts) && tx.dateISO) {
      const parsed = Date.parse(tx.dateISO);
      if (Number.isFinite(parsed)) ts = parsed;
    }
    if (!Number.isFinite(ts)) ts = Date.now();
    payload[key] = {
      id: tx.id ? String(tx.id) : undefined,
      type: tx.type || "add",
      amount,
      label,
      timestamp: ts,
      dateISO: typeof tx.dateISO === "string" ? tx.dateISO : "",
    };
  });
  await set(node, payload);
}
