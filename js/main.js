import { saveSummary, saveProfile, listenProfile, updateBalance, listenBalance, addTransaction, listenTransactions } from "./firebase.js";

// ====== Firebase 連携（購読） ======
window.addEventListener("DOMContentLoaded", () => {
  try {
    listenProfile((p) => {
      if (!p) return;
      if (typeof p.name === 'string') {
        const el = document.getElementById('childName');
        if (el) el.value = p.name;
        const s = document.getElementById('settingsName');
        if (s) s.value = p.name;
      }
      if (typeof p.avatar === 'string') {
        const b = document.getElementById('avatarButton');
        if (b) b.textContent = p.avatar;
      }
      if (typeof p.theme === 'string') {
        const t = document.getElementById('themeSelect');
        if (t) t.value = p.theme;
        document.body.classList.toggle('theme-adventure', p.theme === 'adventure');
        document.body.classList.toggle('theme-cute', p.theme !== 'adventure');
      }
    });
  } catch {}

  try {
    listenBalance((bal) => {
      if (bal == null) return;
      const el = document.getElementById('balance');
      if (el) el.textContent = `\\${Number(bal).toLocaleString('ja-JP')}`;
    });
  } catch {}

  try {
    listenTransactions((key, tx) => {
      try { if (window.kidsAllowanceOnCloudTx) window.kidsAllowanceOnCloudTx(key, tx); }
      catch (e) { console.warn('onCloudTx hook failed', e); }
      console.log('Firebase: new transaction', key, tx);
    });
  } catch {}
});

// ====== app.js からの保存フック ======
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

// ===== UI から直接呼び出すフック =====
let profTimer = null;
window.kidsAllowanceSaveProfile = function (state) {
  if (profTimer) clearTimeout(profTimer);
  profTimer = setTimeout(async () => {
    try { await saveProfile({ name: state.childName, avatar: state.avatar, theme: state.theme }); }
    catch (e) { console.warn('profile save failed', e); }
  }, 300);
};

// 取引追加時のフック: app.js の addTx から呼ぶ
window.kidsAllowanceAddTx = async function (t) {
  try {
    const mapped = {
      type: (t?.type === 'income' || t?.type === 'chore') ? 'add' : 'subtract',
      amount: Number(t?.amount) || 0,
      label: t?.note || '',
      timestamp: Date.parse(t?.dateISO || '') || Date.now()
    };
    await addTransaction(mapped);
  } catch (e) { console.warn('addTransaction failed', e); }
};

// 残高の更新（おこづかい加減時）
let balTimer = null;
window.kidsAllowanceUpdateBalance = function (state) {
  if (balTimer) clearTimeout(balTimer);
  balTimer = setTimeout(async () => {
    const balance = (state.transactions || []).reduce((sum, t) => {
      if (t.type === 'income' || t.type === 'chore') return sum + t.amount;
      if (t.type === 'expense' || t.type === 'goal') return sum - t.amount;
      return sum;
    }, 0);
    try { await updateBalance(balance); }
    catch (e) { console.warn('balance update failed', e); }
  }, 200);
};

