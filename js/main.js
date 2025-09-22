import { saveSummary, saveProfile, listenProfile, updateBalance, listenBalance, addTransaction, listenTransactions, loadAllTransactions, saveGoals, saveChores, listenGoals, listenChores } from "./firebase.js";

// ====== Firebase 騾｣謳ｺ・郁ｳｼ隱ｭ・・======
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
    if (el) el.textContent = `¥${Number(bal).toLocaleString('ja-JP')}`;
  });

  // 鏡映情報: Firebase 全取引をロードして同期
  } catch {}\r\n\r\n  try { listenGoals((arr)=>{ try{ if(window.kidsAllowanceApplyGoals) window.kidsAllowanceApplyGoals(arr); }catch{} }); } catch {}\r\n  try { listenChores((arr)=>{ try{ if(window.kidsAllowanceApplyChores) window.kidsAllowanceApplyChores(arr); }catch{} }); } catch {}\r\n\r\n  try { listenTransactions((key, tx) => {
      try { if (window.kidsAllowanceOnCloudTx) window.kidsAllowanceOnCloudTx(key, tx); }
      catch (e) { console.warn('onCloudTx hook failed', e); }
      console.log('Firebase: new transaction', key, tx);
    });
  } catch {}
});

// ====== app.js 縺九ｉ縺ｮ菫晏ｭ倥ヵ繝・け ======
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
      try { if (window.toast) window.toast('Firebaseへ同期完了'); } catch {}
      console.log('Firebaseへ同期完了', summary);
    } catch (e) {
      console.warn('Firebase同期に失敗', e);
      try { if (window.toast) window.toast('Firebase同期に失敗しました'); } catch {}
    }
  }, 500);
};

// 襍ｷ蜍輔Ο繧ｰ・・ata.json縺ｯ菴ｿ繧上↑縺・ｼ・window.addEventListener('load', () => {
  console.log('Firebase mode: data.json fetch is disabled');
});

// ===== UI 縺九ｉ逶ｴ謗･蜻ｼ縺ｳ蜃ｺ縺吶ヵ繝・け =====
let profTimer = null;
window.kidsAllowanceSaveProfile = function (state) {
  if (profTimer) clearTimeout(profTimer);
  profTimer = setTimeout(async () => {
    try { await saveProfile({ name: state.childName, avatar: state.avatar, theme: state.theme }); }
    catch (e) { console.warn('profile save failed', e); }
  }, 300);
};

// 蜿門ｼ戊ｿｽ蜉譎ゅ・繝輔ャ繧ｯ: app.js 縺ｮ addTx 縺九ｉ蜻ｼ縺ｶ
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

// 谿矩ｫ倥・譖ｴ譁ｰ・医♀縺薙▼縺九＞蜉貂帶凾・・let balTimer = null;
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

// 蜿門ｼ輔・譛ｬ菴填I・医♀縺薙▼縺九＞繧ｿ繝厄ｼ峨∈縺ｮ邨ｱ蜷医・ app.js 蜀・・ kidsAllowanceOnCloudTx 縺悟ｮ滓命


