// Firebase SDK 繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・ｋ蜑肴署 (index.html 縺ｫ script 繧ｿ繧ｰ縺ゅｊ)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, push, onValue, set } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// 縺ゅ↑縺溘・ Firebase 險ｭ螳・const firebaseConfig = {
  apiKey: "AIzaSyAF2m74NGvgrjd9eh5zVrfrxVO3ZC8aUww",
  authDomain: "kids-allowance-51817.firebaseapp.com",
  databaseURL: "https://kids-allowance-51817-default-rtdb.asia-southeast1.firebasedatabase.app", // 竊・霑ｽ蜉蠢・茨ｼ・  projectId: "kids-allowance-51817",
  storageBucket: "kids-allowance-51817.appspot.com",
  messagingSenderId: "946782238727",
  appId: "1:946782238727:web:45e384ccdfc47aacaa92a2"
};

// Firebase 蛻晄悄蛹・const app = initializeApp(firebaseConfig);
// 譏守､ｺ逧・↓ DB 縺ｮURL繧呈欠螳夲ｼ亥慍蝓溘し繝悶ラ繝｡繧､繝ｳ蜷ｫ繧豁｣縺励＞URL縺ｫ縺励※縺上□縺輔＞・・const db = getDatabase(app, firebaseConfig.databaseURL);

// ===== 蜷榊燕繧剃ｿ晏ｭ・=====
export function saveName(name) {
  const namesRef = ref(db, "names/");
  push(namesRef, {
    value: name,
    timestamp: Date.now()
  });
}

// ===== 蜷榊燕荳隕ｧ繧偵Μ繧｢繝ｫ繧ｿ繧､繝縺ｧ蜿門ｾ・=====
export function listenNames(callback) {
  const namesRef = ref(db, "names/");
  onValue(namesRef, (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.values(data).map(item => item.value);
    callback(list);
  });
}

// ===== 繧｢繝励Μ縺ｮ繧ｵ繝槭Μ菫晏ｭ假ｼ・ata.json 莉｣譖ｿ・・=====
export async function saveSummary(summary) {
  const node = push(ref(db, "summaries/"));
  await set(node, { ...summary, timestamp: Date.now() });
}

