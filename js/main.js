import {
  saveSummary,
  saveProfile,
  listenProfile,
  updateBalance,
  listenBalance,
  addTransaction,
  listenTransactions,
  loadAllTransactions,
  saveGoals,
  saveChores,
  listenGoals,
  listenChores,
  saveTransactionsSnapshot
} from "./firebase.js";

// デバッグパネル（明示的に有効化した時のみ表示）
(function createDebugPanel() {
  let enabled = false;
  try {
    const qs = new URLSearchParams(location.search || "");
    const qv = (qs.get("debug") || "").toLowerCase();
    if (qv === "1" || qv === "true" || qv === "on") enabled = true;
    const ls = (localStorage.getItem("kid-allowance:debug") || "").toLowerCase();
    if (ls === "1" || ls === "true" || ls === "on") enabled = true;
  } catch {}

  if (!enabled) { window.debugLog = function () {}; return; }
  if (document.getElementById("syncDebug")) return;
  const d = document.createElement("div");
  d.id = "syncDebug";
  d.style.position = "fixed";
  d.style.right = "12px";
  d.style.bottom = "12px";
  d.style.width = "320px";
  d.style.maxHeight = "40vh";
  d.style.overflow = "auto";
  d.style.background = "rgba(0,0,0,0.7)";
  d.style.color = "#fff";
  d.style.fontSize = "12px";
  d.style.lineHeight = "1.2";
  d.style.padding = "8px";
  d.style.borderRadius = "8px";
  d.style.zIndex = 99999;
  d.style.whiteSpace = "pre-wrap";
  d.innerText = "sync debug:\n";
  document.addEventListener("DOMContentLoaded", () => {
    try { document.body.appendChild(d); } catch (e) {}
  });
  window.debugLog = function (msg) {
    try {
      const el = document.getElementById("syncDebug");
      const time = new Date().toLocaleTimeString();
      const text = typeof msg === "string" ? msg : JSON.stringify(msg);
      el.innerText = el.innerText + "\n[" + time + "] " + text;
      el.scrollTop = el.scrollHeight;
    } catch (e) { /* ignore */ }
  };
})();

// ====== Firebase 初期化 ======
window.addEventListener("DOMContentLoaded", () => {
  try {
    listenProfile((p) => {
      if (!p) return;
      if (typeof p.name === "string") {
        const el = document.getElementById("childName");
        if (el) el.value = p.name;
        const s = document.getElementById("settingsName");
        if (s) s.value = p.name;
      }
      if (typeof p.avatar === "string") {
        const b = document.getElementById("avatarButton");
        if (b) b.textContent = p.avatar;
      }
      if (typeof p.theme === "string") {
        const t = document.getElementById("themeSelect");
        if (t) t.value = p.theme;
        document.body.classList.toggle("theme-adventure", p.theme === "adventure");
        document.body.classList.toggle("theme-cute", p.theme !== "adventure");
      }
    });
  } catch (e) {
    console.warn("listenProfile failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "listenProfile_failed", e: String(e) });
  }

  try {
    listenBalance((bal) => {
      if (bal == null) return;
      const el = document.getElementById("balance");
      if (el) el.textContent = "¥" + Number(bal).toLocaleString("ja-JP");
    });
  } catch (e) {
    console.warn("listenBalance failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "listenBalance_failed", e: String(e) });
  }

  // ====== Firebase 全取引・目標・お手伝い同期 ======
  try {
    listenGoals((arr) => {
      try {
        if (typeof window.debugLog === "function") window.debugLog({ type: "listenGoals", data: arr });

        // 受信データを localStorage に保存（遅延ハンドラ対策）
        try { localStorage.setItem("kids-allowance:goals", JSON.stringify(arr || [])); } catch (e) {}

        // カスタムイベントを dispatch（app.js 等で監視できるように）
        try { window.dispatchEvent(new CustomEvent("goalsUpdated", { detail: arr || [] })); } catch (e) {}

        // 既存の UI 更新フックがあれば呼ぶ
        if (typeof window.kidsAllowanceApplyGoals === "function") {
          try { window.kidsAllowanceApplyGoals(arr || []); } catch (e) { console.warn("applyGoals hook error", e); }
        } else {
          window.__pendingGoals = arr || [];
        }
      } catch (inner) {
        console.warn("applyGoals hook failed", inner);
      }
    });
  } catch (e) {
    console.warn("listenGoals failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "listenGoals_failed", e: String(e) });
  }

  try {
    listenChores((arr) => {
      try {
        if (typeof window.debugLog === "function") window.debugLog({ type: "listenChores", data: arr });
        if (window.kidsAllowanceApplyChores) window.kidsAllowanceApplyChores(arr);
        else window.__pendingChores = arr || [];
      } catch (inner) {
        console.warn("applyChores hook failed", inner);
        if (typeof window.debugLog === "function") window.debugLog({ type: "applyChores_failed", e: String(inner) });
      }
    });
  } catch (e) {
    console.warn("listenChores failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "listenChores_failed", e: String(e) });
  }

  try {
    listenTransactions((key, tx) => {
      try {
        if (window.kidsAllowanceOnCloudTx) window.kidsAllowanceOnCloudTx(key, tx);
      } catch (e) {
        console.warn("onCloudTx hook failed", e);
      }
      console.log("Firebase: new transaction", key, tx);
      if (typeof window.debugLog === "function") window.debugLog({ type: "cloudTx", key, tx });
    });
  } catch (e) {
    console.warn("listenTransactions failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "listenTransactions_failed", e: String(e) });
  }

  try {
    loadAllTransactions((list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        if (typeof window.debugLog === "function") window.debugLog({ type: "loadAllTransactions", count: arr.length });
        window._cloudSeen = window._cloudSeen || new Set();
        arr.forEach((item) => {
          if (item && item.id) window._cloudSeen.add(item.id);
        });
        const payload = arr.map((item) => ({
          id: item?.id,
          type: item?.type || "add",
          amount: item?.amount,
          label: item?.label ?? item?.note ?? "",
          timestamp: item?.timestamp,
          dateISO: item?.dateISO || "",
        }));
        if (typeof window.kidsAllowanceApplyTransactions === "function") {
          window.kidsAllowanceApplyTransactions(payload);
        } else {
          window.__pendingTransactions = payload;
        }
      } catch (err) {
        console.warn("loadAllTransactions handler failed", err);
        if (typeof window.debugLog === "function") window.debugLog({ type: "loadAllTransactions_failed", e: String(err) });
      }
    });
  } catch (e) {
    console.warn("loadAllTransactions failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "loadAllTransactions_failed_outer", e: String(e) });
  }
});

// ====== app.js から呼ばれるフック ======
let syncTimer = null;
window.kidsAllowanceSync = function syncToFirebase(state) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const balance = (state.transactions || []).reduce((sum, t) => {
        if (t.type === "income" || t.type === "chore") return sum + t.amount;
        if (t.type === "expense" || t.type === "goal") return sum - t.amount;
        return sum;
      }, 0);

      // goals を配列に正規化（オブジェクトや null にも対応）
      const goals = Array.isArray(state.goals)
        ? state.goals
        : state.goals
        ? Object.values(state.goals)
        : [];

      const transactions = Array.isArray(state.transactions)
        ? state.transactions.map((tx) => ({
            id: tx?.id,
            type: tx?.type,
            amount: tx?.amount,
            note: tx?.note,
            dateISO: tx?.dateISO,
            timestamp: tx?.timestamp,
          }))
        : [];

      const summary = { balance, goals };

      // デバッグ: 保存前に表示
      if (typeof window.debugLog === "function") window.debugLog({ type: "sync_saving_goals", goals });
      console.debug("Sync -> saving goals:", goals);

      // users/{uid}/goals に保存（listenGoals が反応するノード）
      try {
        await saveGoals(goals);
        console.debug("saveGoals -> saved");
        if (typeof window.debugLog === "function") window.debugLog("saveGoals -> saved");
        try{
          window.__goalsDirty = false;
          if(Array.isArray(window.__pendingGoalsAfterSync)){
            const pending = window.__pendingGoalsAfterSync;
            delete window.__pendingGoalsAfterSync;
            if(typeof window.kidsAllowanceApplyGoals === "function"){
              window.kidsAllowanceApplyGoals(pending);
            }
          }
        }catch{}
      } catch (e) {
        console.warn("saveGoals failed", e);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveGoals_failed", e: String(e) });
      }

      try {
        await saveTransactionsSnapshot(transactions);
        console.debug("saveTransactionsSnapshot -> saved", transactions.length);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveTransactions_saved", count: transactions.length });
        try {
          window._cloudSeen = window._cloudSeen || new Set();
          transactions.forEach((tx) => {
            if (tx && tx.id) window._cloudSeen.add(String(tx.id));
          });
        } catch {}
      } catch (e) {
        console.warn("saveTransactionsSnapshot failed", e);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveTransactions_failed", e: String(e) });
      }

      // 従来通り summaries ノードにも保存
      try {
        await saveSummary(summary);
        console.debug("saveSummary -> saved", summary);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveSummary_saved", summary });
      } catch (e) {
        console.warn("saveSummary failed", e);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveSummary_failed", e: String(e) });
      }

      try { if (window.toast) window.toast("Firebaseへ同期完了"); } catch {}
      console.log("Firebaseへ同期完了", summary);
    } catch (e) {
      console.warn("Firebase同期に失敗", e);
      if (typeof window.debugLog === "function") window.debugLog({ type: "sync_failed", e: String(e) });
      try { if (window.toast) window.toast("Firebase同期に失敗しました"); } catch {}
    }
  }, 500);
};

// data.json は使わないモード
window.addEventListener("load", () => {
  console.log("Firebase mode: data.json fetch is disabled");
});

// ====== プロフィール保存 ======
let profTimer = null;
window.kidsAllowanceSaveProfile = function (state) {
  if (profTimer) clearTimeout(profTimer);
  profTimer = setTimeout(async () => {
    try {
      await saveProfile({
        name: state.childName,
        avatar: state.avatar,
        theme: state.theme,
      });
    } catch (e) {
      console.warn("profile save failed", e);
      if (typeof window.debugLog === "function") window.debugLog({ type: "saveProfile_failed", e: String(e) });
    }
  }, 300);
};

// ====== 目標の保存（直接呼び出し + イベント対応）======
let goalsTimer = null;
window.kidsAllowanceSaveGoals = function (goals) {
  if (goalsTimer) clearTimeout(goalsTimer);
  goalsTimer = setTimeout(async () => {
    try {
      const arr = Array.isArray(goals) ? goals : [];
      await saveGoals(arr);
      if (typeof window.debugLog === 'function') window.debugLog({ type: 'saveGoals_direct', count: arr.length });
    } catch (e) {
      console.warn('saveGoals failed', e);
      if (typeof window.debugLog === 'function') window.debugLog({ type: 'saveGoals_direct_failed', e: String(e) });
    }
  }, 300);
};

// app.js 側が new CustomEvent('goalsUpdated', { detail: goals }) を dispatch した場合に保存 + UI 反映
window.addEventListener('goalsUpdated', (e) => {
  try {
    const goals = (e && e.detail) ? e.detail : [];
    if (typeof window.kidsAllowanceApplyGoals === 'function') {
      try { window.kidsAllowanceApplyGoals(goals); } catch (_) {}
    } else {
      window.__pendingGoals = goals;
    }
    window.kidsAllowanceSaveGoals(goals);
  } catch (err) {
    console.warn('goalsUpdated handler failed', err);
    if (typeof window.debugLog === 'function') window.debugLog({ type: 'goalsUpdated_failed', e: String(err) });
  }
});

// ====== 取引保存 ======
window.kidsAllowanceAddTx = async function (t) {
  try {
    const mapped = {
      type: t?.type === "income" || t?.type === "chore" ? "add" : "subtract",
      amount: Number(t?.amount) || 0,
      label: t?.note || "",
      timestamp: Date.parse(t?.dateISO || "") || Date.now(),
      id: t?.id,
    };
    await addTransaction(mapped);
  } catch (e) {
    console.warn("addTransaction failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "addTx_failed", e: String(e) });
  }
};

// ====== 残高更新 ======
let balTimer = null;
window.kidsAllowanceUpdateBalance = function (state) {
  if (balTimer) clearTimeout(balTimer);
  balTimer = setTimeout(async () => {
    const balance = (state.transactions || []).reduce((sum, t) => {
      if (t.type === "income" || t.type === "chore") return sum + t.amount;
      if (t.type === "expense" || t.type === "goal") return sum - t.amount;
      return sum;
    }, 0);
    try {
      await updateBalance(balance);
    } catch (e) {
      console.warn("balance update failed", e);
      if (typeof window.debugLog === "function") window.debugLog({ type: "updateBalance_failed", e: String(e) });
    }
  }, 200);
};
