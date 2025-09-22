// main.js

document.addEventListener("DOMContentLoaded", () => {
  renderAll();

  // --- Firebase購読セットアップ ---
  try {
    listenProfile((prof) => {
      try {
        if (window.kidsAllowanceApplyProfile) {
          window.kidsAllowanceApplyProfile(prof);
        }
      } catch {}
    });
  } catch {}

  try {
    listenBalance((bal) => {
      if (bal == null) return;
      const el = document.getElementById("balance");
      if (el) el.textContent = `¥${Number(bal).toLocaleString("ja-JP")}`;
    });
  } catch {}

  try {
    listenTransactions((key, tx) => {
      try {
        if (window.kidsAllowanceOnCloudTx)
          window.kidsAllowanceOnCloudTx(key, tx);
      } catch (e) {
        console.warn("onCloudTx hook failed", e);
      }
      console.log("Firebase: new transaction", key, tx);
    });
  } catch {}

  try {
    listenGoals((arr) => {
      try {
        if (window.kidsAllowanceApplyGoals)
          window.kidsAllowanceApplyGoals(arr);
      } catch (e) {
        console.warn("applyGoals failed", e);
      }
    });
  } catch {}

  try {
    listenChores((arr) => {
      try {
        if (window.kidsAllowanceApplyChores)
          window.kidsAllowanceApplyChores(arr);
      } catch (e) {
        console.warn("applyChores failed", e);
      }
    });
  } catch {}
});

// --- Firebaseフック定義 ---

// プロフィール保存
try {
  window.kidsAllowanceSaveProfile = function (st) {
    try {
      saveProfile({
        childName: st.childName,
        avatar: st.avatar,
        currency: st.currency,
        theme: st.theme,
      });
    } catch (e) {
      console.warn("saveProfile failed", e);
    }
  };
} catch {}

// 残高保存
try {
  window.kidsAllowanceUpdateBalance = function (st) {
    try {
      saveBalance(computeBalance());
    } catch (e) {
      console.warn("saveBalance failed", e);
    }
  };
} catch {}

// 取引保存
try {
  window.kidsAllowanceAddTx = function (t) {
    try {
      addTransaction({
        type: t.type === "income" || t.type === "chore" ? "add" : "subtract",
        amount: t.amount,
        label: t.note,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn("addTransaction failed", e);
    }
  };
} catch {}

// ゴール保存
try {
  window.kidsAllowanceSaveGoals = function (arr) {
    try {
      saveGoals(arr);
    } catch (e) {
      console.warn("saveGoals failed", e);
    }
  };
} catch {}

// ゴール適用
try {
  window.kidsAllowanceApplyGoals = function (arr) {
    try {
      state.goals = Array.isArray(arr) ? arr : [];
      save();
      renderGoals();
    } catch (e) {
      console.warn("applyGoals failed", e);
    }
  };
} catch {}

// おてつだい保存
try {
  window.kidsAllowanceSaveChores = function (arr) {
    try {
      saveChores(arr);
    } catch (e) {
      console.warn("saveChores failed", e);
    }
  };
} catch {}

// おてつだい適用
try {
  window.kidsAllowanceApplyChores = function (arr) {
    try {
      state.chores = Array.isArray(arr) ? arr : [];
      save();
      renderChores();
    } catch (e) {
      console.warn("applyChores failed", e);
    }
  };
} catch {}

// クラウド取引 → UI/stateに反映
try {
  window.kidsAllowanceOnCloudTx = function (key, tx) {
    try {
      if (!tx) return;
      window._cloudSeen = window._cloudSeen || new Set();
      if (window._cloudSeen.has(key)) return;
      window._cloudSeen.add(key);
      const t = {
        id: id(),
        type: tx.type === "add" ? "income" : "expense",
        amount: Math.round(Number(tx.amount) || 0),
        note: tx.label || "",
        dateISO: new Date(tx.timestamp || Date.now()).toISOString(),
      };
      const recent = state.transactions.slice(-5);
      const dup = recent.some(
        (u) =>
          u.type === t.type &&
          u.amount === t.amount &&
          u.note === t.note &&
          Math.abs(new Date(u.dateISO) - new Date(t.dateISO)) < 2000
      );
      if (dup) return;
      state.transactions.push(t);
      save();
      renderHome();
      renderTransactions();
    } catch (e) {
      console.warn("kidsAllowanceOnCloudTx failed", e);
    }
  };
} catch {}
