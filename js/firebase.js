// Firebase SDK を読み込んでいる前提 (index.html に script タグあり)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, push, onValue, set } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// あなたの Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyAF2m74NGvgrjd9eh5zVrfrxVO3ZC8aUww",
  authDomain: "kids-allowance-51817.firebaseapp.com",
  databaseURL: "https://kids-allowance-51817-default-rtdb.firebaseio.com", // ← 追加必須！
  projectId: "kids-allowance-51817",
  storageBucket: "kids-allowance-51817.appspot.com",
  messagingSenderId: "946782238727",
  appId: "1:946782238727:web:45e384ccdfc47aacaa92a2"
};

// Firebase 初期化
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== 名前を保存 =====
export function saveName(name) {
  const namesRef = ref(db, "names/");
  push(namesRef, {
    value: name,
    timestamp: Date.now()
  });
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
