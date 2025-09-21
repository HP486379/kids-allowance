import { saveName, listenNames, saveSummary } from "./firebase.js";

// ====== Firebase 簡易UI連携 ======
window.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("addNameBtn");
  const nameInput = document.getElementById("nameInput");
  const listEl = document.getElementById("nameList");
  if (addBtn && nameInput) {
    addBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (name) {
        saveName(name);
        nameInput.value = "";
      }
    });
  }
  if (listEl) {
    listenNames((names) => {
      listEl.innerHTML = "";
      names.forEach((n) => {
        const li = document.createElement("li");
        li.textContent = n;
        listEl.appendChild(li);
      });
    });
  }
});

// ====== app.js からの保存フック ======
// 頻繁な保存を避けるために簡易デバウンス
let syncTimer = null;
window.kidsAllowanceSync = function syncToFirebase(state) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const balance = (state.transactions || []).reduce((sum, t) => {
        if (t.type === 'income' || t.type === 'chore') return sum + t.amount;
        if (t.type === 'expense' || t.type === 'goal') return sum - t.amount;
        return sum;
      }, 0);
      const summary = { balance, goals: state.goals || [] };
      await saveSummary(summary);
      if (typeof window.toast === 'function') window.toast('Firebaseへ同期完了');
      console.log('Firebaseへ同期完了', summary);
    } catch (e) {
      console.warn('Firebase同期に失敗', e);
      if (typeof window.toast === 'function') window.toast('Firebase同期に失敗しました');
    }
  }, 500);
};

// 起動ログ（data.jsonは使わない）
window.addEventListener('load', () => {
  console.log('Firebase mode: data.json fetch is disabled');
});

