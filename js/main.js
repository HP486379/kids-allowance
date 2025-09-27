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
  listenChores
} from "./firebase.js";

// 繝・ヰ繝・げ繝代ロ繝ｫ・・Phone 遲峨〒繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ縺御ｽｿ縺医↑縺・ｴ蜷医↓逕ｻ髱｢陦ｨ遉ｺ・・
(function createDebugPanel(){ window.debugLog = function(){}; return; })();;

// ====== Firebase 蛻晄悄蛹・======
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
      if (el) el.textContent = "ﾂ･" + Number(bal).toLocaleString("ja-JP");
    });
  } catch (e) {
    console.warn("listenBalance failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "listenBalance_failed", e: String(e) });
  }

  // ====== Firebase 蜈ｨ蜿門ｼ輔・逶ｮ讓吶・縺頑焔莨昴＞蜷梧悄 ======
  try {
    listenGoals((arr) => {
      try {
        if (typeof window.debugLog === "function") window.debugLog({ type: "listenGoals", data: arr });

        // 蜿嶺ｿ｡繝・・繧ｿ繧・localStorage 縺ｫ菫晏ｭ假ｼ磯≦蟒ｶ繝上Φ繝峨Λ蟇ｾ遲厄ｼ・
        try { localStorage.setItem("kids-allowance:goals", JSON.stringify(arr || [])); } catch (e) {}

        // 繧ｫ繧ｹ繧ｿ繝繧､繝吶Φ繝医ｒ dispatch・・pp.js 遲峨〒逶｣隕悶〒縺阪ｋ繧医≧縺ｫ・・
        try { window.dispatchEvent(new CustomEvent("goalsUpdated", { detail: arr || [] })); } catch (e) {}

        // 譌｢蟄倥・ UI 譖ｴ譁ｰ繝輔ャ繧ｯ縺後≠繧後・蜻ｼ縺ｶ
        if (typeof window.kidsAllowanceApplyGoals === "function") {
          try { window.kidsAllowanceApplyGoals(arr || []); } catch (e) { console.warn("applyGoals hook error", e); }
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
});

// ====== app.js 縺九ｉ蜻ｼ縺ｰ繧後ｋ繝輔ャ繧ｯ ======
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

      // goals 繧帝・蛻励↓豁｣隕丞喧・医が繝悶ず繧ｧ繧ｯ繝医ｄ null 縺ｫ繧ょｯｾ蠢懶ｼ・
      const goals = Array.isArray(state.goals)
        ? state.goals
        : state.goals
        ? Object.values(state.goals)
        : [];

      const summary = { balance, goals };

      // 繝・ヰ繝・げ: 菫晏ｭ伜燕縺ｫ陦ｨ遉ｺ
      if (typeof window.debugLog === "function") window.debugLog({ type: "sync_saving_goals", goals });
      console.debug("Sync -> saving goals:", goals);

      // users/{uid}/goals 縺ｫ菫晏ｭ假ｼ・istenGoals 縺悟渚蠢懊☆繧九ヮ繝ｼ繝会ｼ・
      try {
        await saveGoals(goals);
        console.debug("saveGoals -> saved");
        if (typeof window.debugLog === "function") window.debugLog("saveGoals -> saved");
      } catch (e) {
        console.warn("saveGoals failed", e);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveGoals_failed", e: String(e) });
      }

      // 蠕捺擂騾壹ｊ summaries 繝弱・繝峨↓繧ゆｿ晏ｭ・
      try {
        await saveSummary(summary);
        console.debug("saveSummary -> saved", summary);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveSummary_saved", summary });
      } catch (e) {
        console.warn("saveSummary failed", e);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveSummary_failed", e: String(e) });
      }

      try { if (window.toast) window.toast("Firebase縺ｸ蜷梧悄螳御ｺ・); } catch {}
      console.log("Firebase縺ｸ蜷梧悄螳御ｺ・, summary);
    } catch (e) {
      console.warn("Firebase蜷梧悄縺ｫ螟ｱ謨・, e);
      if (typeof window.debugLog === "function") window.debugLog({ type: "sync_failed", e: String(e) });
      try { if (window.toast) window.toast("Firebase蜷梧悄縺ｫ螟ｱ謨励＠縺ｾ縺励◆"); } catch {}
    }
  }, 500);
};

// data.json 縺ｯ菴ｿ繧上↑縺・Δ繝ｼ繝・
window.addEventListener("load", () => {
  console.log("Firebase mode: data.json fetch is disabled");
});

// ====== 繝励Ο繝輔ぅ繝ｼ繝ｫ菫晏ｭ・======
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

// ====== 蜿門ｼ穂ｿ晏ｭ・======
window.kidsAllowanceAddTx = async function (t) {
  try {
    const mapped = {
      type: t?.type === "income" || t?.type === "chore" ? "add" : "subtract",
      amount: Number(t?.amount) || 0,
      label: t?.note || "",
      timestamp: Date.parse(t?.dateISO || "") || Date.now(),
    };
    await addTransaction(mapped);
  } catch (e) {
    console.warn("addTransaction failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "addTx_failed", e: String(e) });
  }
};

// ====== 谿矩ｫ俶峩譁ｰ ======
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

