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
  saveTransactionsSnapshot,
  getUid,
  setShareUid,
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
const realtimeState = {
  unsubscribes: [],
  uid: null,
};

// Firebase goals の既知IDセット（差分削除の判定に使用）
const goalSyncState = {
  knownIds: new Set(),
};

const goalServerState = {
  snapshot: [],
};

let goalIdSeed = Date.now();

function sanitizeGoalSnapshot(goal, fallback = {}) {
  try {
    const src = goal && typeof goal === "object" ? goal : {};
    const base = fallback && typeof fallback === "object" ? fallback : {};
    let id = src.id != null ? String(src.id).trim() : "";
    if (!id) id = base.id != null ? String(base.id).trim() : "";
    if (!id) {
      goalIdSeed += 1;
      id = `g_${goalIdSeed}`;
    }
    const name = typeof src.name === "string" && src.name.trim()
      ? src.name.trim()
      : typeof base.name === "string"
      ? base.name
      : "";
    const targetCandidate = Number(src.target);
    const savedCandidate = Number(src.saved);
    const target = Number.isFinite(targetCandidate)
      ? Math.max(0, Math.round(targetCandidate))
      : Math.max(0, Math.round(Number(base.target) || 0));
    const saved = Number.isFinite(savedCandidate)
      ? Math.max(0, Math.round(savedCandidate))
      : Math.max(0, Math.round(Number(base.saved) || 0));
    const updatedCandidate = Number(src.updatedAt);
    const baseUpdated = Number(base.updatedAt);
    const updatedAt = Number.isFinite(updatedCandidate) && updatedCandidate > 0
      ? Math.round(updatedCandidate)
      : Number.isFinite(baseUpdated) && baseUpdated > 0
      ? Math.round(baseUpdated)
      : Date.now();
    return { id, name, target, saved, updatedAt };
  } catch (err) {
    console.warn("sanitizeGoalSnapshot failed", err);
    return null;
  }
}

function updateServerGoalSnapshot(goals, options = {}) {
  try {
    const sanitized = (Array.isArray(goals) ? goals : [])
      .map((goal) => sanitizeGoalSnapshot(goal))
      .filter((goal) => goal && goal.id);

    if (options && options.merge) {
      const map = new Map();
      (Array.isArray(goalServerState.snapshot) ? goalServerState.snapshot : []).forEach((goal) => {
        if (goal && goal.id) map.set(String(goal.id), { ...goal });
      });
      sanitized.forEach((goal) => {
        if (!goal || !goal.id) return;
        map.set(goal.id, { ...goal });
      });
      const removalSet = new Set();
      (Array.isArray(options.removals) ? options.removals : []).forEach((raw) => {
        const id = raw != null ? String(raw).trim() : "";
        if (id) removalSet.add(id);
      });
      removalSet.forEach((id) => map.delete(id));
      goalServerState.snapshot = Array.from(map.values());
    } else {
      goalServerState.snapshot = sanitized.map((goal) => ({ ...goal }));
    }
    try {
      window.__latestServerGoalsSnapshot = goalServerState.snapshot.map((goal) => ({ ...goal }));
    } catch {}
  } catch (err) {
    console.warn("updateServerGoalSnapshot failed", err);
  }
}

function getServerGoalSnapshot() {
  try {
    return (Array.isArray(goalServerState.snapshot) ? goalServerState.snapshot : []).map((goal) => ({ ...goal }));
  } catch {
    return [];
  }
}

function buildGoalsPayload(sourceGoals, removalIds = []) {
  const merged = new Map();

  getServerGoalSnapshot().forEach((goal) => {
    if (!goal || !goal.id) return;
    merged.set(goal.id, { ...goal });
  });

  (Array.isArray(sourceGoals) ? sourceGoals : []).forEach((goal) => {
    const existing = goal && goal.id != null ? merged.get(String(goal.id)) : undefined;
    const sanitized = sanitizeGoalSnapshot(goal, existing);
    if (!sanitized || !sanitized.id) return;
    merged.set(sanitized.id, sanitized);
  });

  const removalSet = new Set();
  (Array.isArray(removalIds) ? removalIds : []).forEach((raw) => {
    const id = raw != null ? String(raw).trim() : "";
    if (id) removalSet.add(id);
  });

  removalSet.forEach((id) => merged.delete(id));

  const payload = Array.from(merged.values()).map((goal) => ({ ...goal }));
  return { payload, removals: Array.from(removalSet) };
}

function updateKnownGoalIds(goals) {
  try {
    const nextIds = new Set();
    (Array.isArray(goals) ? goals : []).forEach((goal) => {
      if (!goal) return;
      const id = goal.id != null ? String(goal.id) : "";
      if (id) nextIds.add(id);
    });
    goalSyncState.knownIds = nextIds;
  } catch (err) {
    console.warn("updateKnownGoalIds failed", err);
  }
}

function ensureGoalRemovalQueue() {
  try {
    const queue = window.__goalRemovalQueue;
    if (Array.isArray(queue)) {
      return;
    }
    if (queue && typeof queue.forEach === "function") {
      const seen = new Set();
      queue.forEach((id) => {
        const str = id != null ? String(id).trim() : "";
        if (str) seen.add(str);
      });
      window.__goalRemovalQueue = [...seen];
      return;
    }
    window.__goalRemovalQueue = [];
  } catch (err) {
    console.warn("ensureGoalRemovalQueue failed", err);
    try { window.__goalRemovalQueue = []; } catch {}
  }
}

function getPendingGoalRemovalIds() {
  try {
    ensureGoalRemovalQueue();
    const queue = window.__goalRemovalQueue;
    if (!Array.isArray(queue) || queue.length === 0) return [];
    const seen = new Set();
    const ids = [];
    queue.forEach((raw) => {
      const str = raw != null ? String(raw).trim() : "";
      if (!str || seen.has(str)) return;
      seen.add(str);
      ids.push(str);
    });
    return ids;
  } catch (err) {
    console.warn("getPendingGoalRemovalIds failed", err);
    return [];
  }
}

function acknowledgeGoalRemovals(ids) {
  try {
    if (!Array.isArray(ids) || ids.length === 0) return;
    ensureGoalRemovalQueue();
    const queue = window.__goalRemovalQueue;
    if (!Array.isArray(queue) || queue.length === 0) return;
    const removalSet = new Set(ids.map((id) => (id != null ? String(id) : "")));
    window.__goalRemovalQueue = queue.filter((raw) => {
      const str = raw != null ? String(raw) : "";
      return str && !removalSet.has(str);
    });
  } catch (err) {
    console.warn("acknowledgeGoalRemovals failed", err);
  }
}

function pruneGoalRemovalQueueByServer(goals) {
  try {
    ensureGoalRemovalQueue();
    const queue = window.__goalRemovalQueue;
    if (!Array.isArray(queue) || queue.length === 0) return;
    const present = new Set();
    (Array.isArray(goals) ? goals : []).forEach((goal) => {
      const id = goal?.id != null ? String(goal.id) : "";
      if (id) present.add(id);
    });
    window.__goalRemovalQueue = queue.filter((raw) => {
      const str = raw != null ? String(raw) : "";
      return str && present.has(str);
    });
  } catch (err) {
    console.warn("pruneGoalRemovalQueueByServer failed", err);
  }
}

function updateActiveSyncUid(uid) {
  realtimeState.uid = uid;
  try { window.__activeSyncUid = uid; } catch {}
  try {
    const display = document.getElementById("syncIdDisplay");
    if (display && display.value !== uid) display.value = uid;
  } catch {}
  if (typeof window.debugLog === "function") {
    window.debugLog({ type: "active_uid", uid });
  }
}

function fingerprintGoals(goals) {
  try {
    if (!Array.isArray(goals)) return null;
    const normalized = goals
      .map((goal) => ({
        id: goal?.id ? String(goal.id) : "",
        name: goal?.name ? String(goal.name) : "",
        target: Number(goal?.target) || 0,
        saved: Number(goal?.saved) || 0,
      }))
      .sort((a, b) => {
        if (a.id !== b.id) return a.id < b.id ? -1 : 1;
        if (a.name !== b.name) return a.name < b.name ? -1 : 1;
        if (a.target !== b.target) return a.target - b.target;
        return a.saved - b.saved;
      });
    return JSON.stringify(normalized);
  } catch (err) {
    console.warn("fingerprintGoals failed", err);
    return null;
  }
}

function cleanupRealtimeListeners() {
  realtimeState.unsubscribes.forEach((fn) => {
    try {
      if (typeof fn === "function") fn();
    } catch (e) {
      console.warn("realtime listener cleanup failed", e);
    }
  });
  realtimeState.unsubscribes = [];
}

function trackRealtimeUnsubscribe(fn) {
  if (typeof fn === "function") realtimeState.unsubscribes.push(fn);
}

function applyPendingGoalsAfterSync() {
  try {
    if (!Array.isArray(window.__pendingGoalsAfterSync)) return false;
    const pending = window.__pendingGoalsAfterSync;
    const pendingVersion = Number(window.__pendingGoalsVersion || 0);
    const latestVersion = Number(window.__latestServerGoalsVersion || 0);
    const pendingKey = fingerprintGoals(pending);
    const latestKey = typeof window.__latestServerGoalsKey === "string" && window.__latestServerGoalsKey
      ? window.__latestServerGoalsKey
      : null;

    if (
      pendingVersion &&
      latestVersion &&
      pendingVersion < latestVersion &&
      pendingKey &&
      latestKey &&
      pendingKey !== latestKey
    ) {
      if (typeof window.debugLog === "function") {
        window.debugLog({
          type: "applyPendingGoalsAfterSync_skip",
          reason: "stale_mismatch",
          pendingVersion,
          latestVersion,
          pendingKey,
          latestKey,
        });
      }
      return false;
    }

    delete window.__pendingGoalsAfterSync;
    delete window.__pendingGoalsVersion;

    if (typeof window.debugLog === "function") {
      window.debugLog({
        type: "applyPendingGoalsAfterSync_apply",
        pendingVersion,
        latestVersion,
        pendingKey,
        latestKey,
      });
    }

    if (typeof window.kidsAllowanceApplyGoals === "function") {
      try { window.__goalsDirty = false; } catch {}
      if (pendingKey) window.__currentGoalsKey = pendingKey;
      try { window.__incomingGoalsVersion = pendingVersion || latestVersion || 0; } catch {}
      window.kidsAllowanceApplyGoals(pending);
    } else {
      window.__pendingGoals = pending;
      if (pendingVersion) window.__pendingGoalsVersion = pendingVersion;
    }

    return true;
  } catch (err) {
    console.warn("applyPendingGoalsAfterSync failed", err);
    if (typeof window.debugLog === "function") {
      window.debugLog({ type: "applyPendingGoalsAfterSync_failed", error: String(err) });
    }
    return false;
  }
}

function initRealtimeListeners() {
  cleanupRealtimeListeners();
  const uid = getUid();
  updateActiveSyncUid(uid);
  goalSyncState.knownIds = new Set();
  ensureGoalRemovalQueue();
  try { setShareUid(uid); } catch {}
  try { window.__latestServerGoalsVersion = 0; } catch {}
  try {
    window._cloudSeen = new Set();
  } catch {}
  if (typeof window.debugLog === "function") window.debugLog({ type: "realtime_listeners_init", uid });

  try {
    const unsub = listenProfile((p) => {
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
    trackRealtimeUnsubscribe(unsub);
  } catch (e) {
    console.warn("listenProfile failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "listenProfile_failed", e: String(e) });
  }

  try {
    const unsub = listenBalance((bal) => {
      if (bal == null) return;
      const el = document.getElementById("balance");
      if (el) el.textContent = "¥" + Number(bal).toLocaleString("ja-JP");
    });
    trackRealtimeUnsubscribe(unsub);
  } catch (e) {
    console.warn("listenBalance failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "listenBalance_failed", e: String(e) });
  }

  // ====== Firebase 全取引・目標・お手伝い同期 ======
  try {
    const unsub = listenGoals((arr) => {
      try {
        const goalsArray = Array.isArray(arr) ? arr : [];
        try { updateServerGoalSnapshot(goalsArray); } catch {}
        const version = Number(window.__latestServerGoalsVersion || 0) + 1;
        window.__latestServerGoalsVersion = version;
        if (typeof window.debugLog === "function") {
          window.debugLog({ type: "listenGoals", data: goalsArray, version });
        }
        try { window.__latestServerGoalsKey = fingerprintGoals(goalsArray); } catch {}
        updateKnownGoalIds(goalsArray);
        pruneGoalRemovalQueueByServer(goalsArray);
        let appliedImmediately = false;
        try {
          if (typeof window.kidsAllowanceHydrateGoals === 'function') {
            window.__incomingGoalsVersion = version;
            window.kidsAllowanceHydrateGoals(goalsArray);
            appliedImmediately = true;
          } else if (typeof window.kidsAllowanceApplyGoals === 'function') {
            window.__incomingGoalsVersion = version;
            window.kidsAllowanceApplyGoals(goalsArray);
            appliedImmediately = true;
          } else if (typeof window.applyGoalsDirectly === 'function') {
            window.applyGoalsDirectly(goalsArray);
            appliedImmediately = true;
          }
        } catch (applyErr) {
          console.warn('applyGoalsDirectly failed', applyErr);
        } finally {
          try { delete window.__incomingGoalsVersion; } catch {}
        }

        // 受信データを localStorage に保存（遅延ハンドラ対策）
        try { localStorage.setItem("kids-allowance:goals", JSON.stringify(goalsArray)); } catch (e) {}

        // カスタムイベントを dispatch（app.js 等で監視できるように）
        try {
          window.__incomingGoalsVersion = version;
          window.dispatchEvent(new CustomEvent("goalsUpdated", { detail: goalsArray }));
        } catch (e) {
          if (typeof window.debugLog === "function") {
            window.debugLog({ type: "goalsUpdated_dispatch_failed", error: String(e) });
          }
        } finally {
          try { delete window.__incomingGoalsVersion; } catch {}
        }

        // 既存の UI 更新フックがあれば呼ぶ
        if (!appliedImmediately && typeof window.kidsAllowanceHydrateGoals === "function") {
          try {
            window.__incomingGoalsVersion = version;
            window.kidsAllowanceHydrateGoals(goalsArray);
          } catch (e) {
            console.warn("applyGoals hook error", e);
          } finally {
            try { delete window.__incomingGoalsVersion; } catch {}
          }
        } else if (!appliedImmediately && typeof window.kidsAllowanceApplyGoals === "function") {
          try {
            window.__incomingGoalsVersion = version;
            window.kidsAllowanceApplyGoals(goalsArray);
          } catch (e) {
            console.warn("applyGoals hook error", e);
          } finally {
            try { delete window.__incomingGoalsVersion; } catch {}
          }
        } else {
          window.__pendingGoals = goalsArray;
          window.__pendingGoalsVersion = version;
        }
      } catch (inner) {
        console.warn("applyGoals hook failed", inner);
      }
    });
    trackRealtimeUnsubscribe(unsub);
  } catch (e) {
    console.warn("listenGoals failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "listenGoals_failed", e: String(e) });
  }

  try {
    const unsub = listenChores((arr) => {
      try {
        if (typeof window.debugLog === "function") window.debugLog({ type: "listenChores", data: arr });
        if (window.kidsAllowanceApplyChores) window.kidsAllowanceApplyChores(arr);
        else window.__pendingChores = arr || [];
      } catch (inner) {
        console.warn("applyChores hook failed", inner);
        if (typeof window.debugLog === "function") window.debugLog({ type: "applyChores_failed", e: String(inner) });
      }
    });
    trackRealtimeUnsubscribe(unsub);
  } catch (e) {
    console.warn("listenChores failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "listenChores_failed", e: String(e) });
  }

  try {
    const unsub = listenTransactions((key, tx) => {
      try {
        if (window.kidsAllowanceOnCloudTx) window.kidsAllowanceOnCloudTx(key, tx);
      } catch (e) {
        console.warn("onCloudTx hook failed", e);
      }
      console.log("Firebase: new transaction", key, tx);
      if (typeof window.debugLog === "function") window.debugLog({ type: "cloudTx", key, tx });
    });
    trackRealtimeUnsubscribe(unsub);
  } catch (e) {
    console.warn("listenTransactions failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "listenTransactions_failed", e: String(e) });
  }

  try {
    const unsub = loadAllTransactions((list) => {
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
    trackRealtimeUnsubscribe(unsub);
  } catch (e) {
    console.warn("loadAllTransactions failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "loadAllTransactions_failed_outer", e: String(e) });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initRealtimeListeners();
});

window.kidsAllowanceReloadSync = function reloadRealtimeListeners(force = false) {
  try {
    const uid = getUid();
    if (!force && uid === realtimeState.uid) return;
    initRealtimeListeners();
    if (typeof window.debugLog === "function") window.debugLog({ type: "realtime_listeners_reloaded", uid: realtimeState.uid });
  } catch (e) {
    console.warn("kidsAllowanceReloadSync failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "reloadSync_failed", e: String(e) });
  }
};

window.kidsAllowanceSetShareUid = function setShareCode(uid, options = {}) {
  const normalized = typeof uid === "string" ? uid.trim() : "";
  try {
    setShareUid(normalized);
  } catch (e) {
    console.warn("setShareUid failed", e);
    if (typeof window.debugLog === "function") window.debugLog({ type: "setShareUid_failed", e: String(e) });
  }
  if (options && options.silent) {
    updateActiveSyncUid(normalized || getUid());
    return;
  }
  try {
    if (typeof window.kidsAllowanceReloadSync === "function") {
      window.kidsAllowanceReloadSync(true);
    } else {
      initRealtimeListeners();
    }
  } catch (e) {
    console.warn("shareUid reload failed", e);
  }
};

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
      const rawLocalGoals = Array.isArray(state.goals)
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

      // デバッグ: 保存前に表示
      if (typeof window.debugLog === "function") window.debugLog({ type: "sync_saving_goals", goals: rawLocalGoals });
      console.debug("Sync -> saving goals:", rawLocalGoals);

      let syncOk = true;
      const syncStatus = { goals: true, transactions: true, summary: true };

      // users/{uid}/goals に保存（listenGoals が反応するノード）
      const removedGoalIds = getPendingGoalRemovalIds();
      const { payload: goalsForSave, removals: appliedRemovals } = buildGoalsPayload(rawLocalGoals, removedGoalIds);
      if (typeof window.debugLog === "function") {
        window.debugLog({ type: "saveGoals_request", count: goalsForSave.length, removed: appliedRemovals });
      }
      const summary = { balance, goals: goalsForSave };
      try {
        await saveGoals(goalsForSave, appliedRemovals);
        console.debug("saveGoals -> saved");
        if (typeof window.debugLog === "function") window.debugLog("saveGoals -> saved");
        try { window.__lastSyncedGoalsKey = fingerprintGoals(goalsForSave); } catch {}
        try { updateKnownGoalIds(goalsForSave); } catch {}
        try { acknowledgeGoalRemovals(appliedRemovals); } catch {}
        try { updateServerGoalSnapshot(goalsForSave, { merge: true, removals: appliedRemovals }); } catch {}
        try {
          window.__goalsDirty = false;
          applyPendingGoalsAfterSync();
        } catch {}
      } catch (e) {
        syncOk = false;
        syncStatus.goals = false;
        console.warn("saveGoals failed", e);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveGoals_failed", e: String(e) });
        try { window.__goalsDirty = false; } catch {}
        try {
          const applied = applyPendingGoalsAfterSync();
          if (!applied && typeof window.debugLog === "function") {
            window.debugLog({ type: "pendingGoals_apply_skipped" });
          }
        } catch {}
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
        syncOk = false;
        syncStatus.transactions = false;
        console.warn("saveTransactionsSnapshot failed", e);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveTransactions_failed", e: String(e) });
      }

      // 従来通り summaries ノードにも保存
      try {
        await saveSummary(summary);
        console.debug("saveSummary -> saved", summary);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveSummary_saved", summary });
      } catch (e) {
        syncOk = false;
        syncStatus.summary = false;
        console.warn("saveSummary failed", e);
        if (typeof window.debugLog === "function") window.debugLog({ type: "saveSummary_failed", e: String(e) });
      }

      if (syncOk) {
        if (typeof window.debugLog === "function") window.debugLog({ type: "sync_success" });
        try { if (window.toast) window.toast("Firebaseへ同期完了"); } catch {}
        console.log("Firebaseへ同期完了", summary);
      } else {
        if (typeof window.debugLog === "function") window.debugLog({ type: "sync_partial_failure", status: syncStatus });
        try { if (window.toast) window.toast("Firebase同期に失敗しました"); } catch {}
        console.warn("Firebase同期の一部が失敗", syncStatus);
      }
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
      const removedGoalIds = getPendingGoalRemovalIds();
      const { payload: goalsForSave, removals: appliedRemovals } = buildGoalsPayload(arr, removedGoalIds);
      await saveGoals(goalsForSave, appliedRemovals);
      try { updateKnownGoalIds(goalsForSave); } catch {}
      try { acknowledgeGoalRemovals(appliedRemovals); } catch {}
      try { updateServerGoalSnapshot(goalsForSave, { merge: true, removals: appliedRemovals }); } catch {}
      if (typeof window.debugLog === 'function') window.debugLog({ type: 'saveGoals_direct', count: goalsForSave.length, removed: appliedRemovals });
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
    if (typeof window.kidsAllowanceHydrateGoals === 'function') {
      try { window.kidsAllowanceHydrateGoals(goals); }
      catch (_) {
        try { window.kidsAllowanceApplyGoals ? window.kidsAllowanceApplyGoals(goals) : null; } catch {}
      }
    } else if (typeof window.kidsAllowanceApplyGoals === 'function') {
      try { window.kidsAllowanceApplyGoals(goals); }
      catch (_) {
        try { window.applyGoalsDirectly ? window.applyGoalsDirectly(goals) : null; } catch {}
      }
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
