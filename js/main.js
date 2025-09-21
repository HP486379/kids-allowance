// ====== アプリ内データ ======
let appData = {
  balance: 0,
  goals: []
};

// ====== 画面に反映 ======
function updateBalanceDisplay() {
  const el = document.getElementById("balance");
  if (el) el.textContent = appData.balance;
}

// ====== 残高を増やす ======
async function increaseBalance(amount) {
  appData.balance += amount;
  updateBalanceDisplay();
  try {
    await saveData(appData);
    console.log("GitHubに保存完了");
  } catch (err) {
    console.error(err);
    alert("保存に失敗しました");
  }
}

// ====== 残高を減らす ======
async function decreaseBalance(amount) {
  appData.balance -= amount;
  if (appData.balance < 0) appData.balance = 0;
  updateBalanceDisplay();
  try {
    await saveData(appData);
    console.log("GitHubに保存完了");
  } catch (err) {
    console.error(err);
    alert("保存に失敗しました");
  }
}

// ====== ページロード時 ======
window.addEventListener("load", async () => {
  try {
    appData = await loadData();
    // 読み込みはログのみ（UI描画はapp.jsに委譲）
    console.log("GitHubからデータ読込完了", appData);
  } catch (err) {
    console.error(err);
    // 初回など404時は既定値で開始
    appData = { balance: 0, goals: [] };
  }
});

// ====== app.js からの保存フック ======
// 頻繁な保存を避けるために簡易デバウンス
let syncTimer = null;
window.kidsAllowanceSync = function syncToGitHub(state) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      // app.jsのstateから最低限のサマリを保存
      const balance = (state.transactions || []).reduce((sum, t) => {
        if (t.type === 'income' || t.type === 'chore') return sum + t.amount;
        if (t.type === 'expense' || t.type === 'goal') return sum - t.amount;
        return sum;
      }, 0);
      const summary = {
        balance,
        goals: state.goals || []
      };
      await saveData(summary);
      if (typeof window.toast === 'function') {
        window.toast('GitHubへ同期完了');
      }
      console.log("GitHubへ同期完了", summary);
    } catch (e) {
      console.warn("GitHub同期に失敗", e);
      if (typeof window.toast === 'function') {
        window.toast('GitHub同期に失敗しました');
      }
    }
  }, 500);
};
