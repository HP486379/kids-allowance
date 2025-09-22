import { saveSummary, saveProfile, listenProfile, updateBalance, listenBalance, addTransaction, listenTransactions } from "./firebase.js";

// ====== Firebase 邁｡譏填I騾｣謳ｺ ======
// 襍ｷ蜍墓凾縺ｫ繧ｯ繝ｩ繧ｦ繝峨・繝励Ο繝輔ぅ繝ｼ繝ｫ/谿矩ｫ倥ｒ雉ｼ隱ｭ縺励※UI繧呈峩譁ｰ・郁ｻｽ驥擾ｼ・window.addEventListener("DOMContentLoaded", () => {
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

  // 蜿門ｼ募ｱ･豁ｴ・医け繝ｩ繧ｦ繝会ｼ芽ｳｼ隱ｭ: 迴ｾ迥ｶ縺ｯ繝ｭ繧ｰ縺ｮ縺ｿ縲ょｿ・ｦ√↑繧蔚I縺ｸ蜿肴丐
  try {
    listenTransactions((key, tx) => { try{ if(window.kidsAllowanceOnCloudTx) window.kidsAllowanceOnCloudTx(key, tx); }catch(e){ console.warn('onCloudTx hook failed', e);} console.log('Firebase: new transaction', key, tx); });
  } catch {}
});

// ====== app.js 縺九ｉ縺ｮ菫晏ｭ倥ヵ繝・け ======
// 鬆ｻ郢√↑菫晏ｭ倥ｒ驕ｿ縺代ｋ縺溘ａ縺ｫ邁｡譏薙ョ繝舌え繝ｳ繧ｹ
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
      if (typeof window.toast === 'function') window.toast('Firebase縺ｸ蜷梧悄螳御ｺ・);
      console.log('Firebase縺ｸ蜷梧悄螳御ｺ・, summary);
    } catch (e) {
      console.warn('Firebase蜷梧悄縺ｫ螟ｱ謨・, e);
      if (typeof window.toast === 'function') window.toast('Firebase蜷梧悄縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
    }
  }, 500);
};

// 襍ｷ蜍輔Ο繧ｰ・・ata.json縺ｯ菴ｿ繧上↑縺・ｼ・window.addEventListener('load', () => {
  console.log('Firebase mode: data.json fetch is disabled');
});

// ===== UI 縺九ｉ逶ｴ謗･蜻ｼ縺ｳ蜃ｺ縺吶ヵ繝・け =====
// 繝励Ο繝輔ぅ繝ｼ繝ｫ・亥錐蜑阪・繧｢繝舌ち繝ｼ繝ｻ繝・・繝橸ｼ我ｿ晏ｭ・let profTimer = null;
window.kidsAllowanceSaveProfile = function (state) {
  if (profTimer) clearTimeout(profTimer);
  profTimer = setTimeout(async () => {
    try {
      await saveProfile({ name: state.childName, avatar: state.avatar, theme: state.theme });
      console.log('Firebase: profile saved');
    } catch (e) { console.warn('profile save failed', e); }
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
  } catch (e) {
    console.warn('addTransaction failed', e);
  }
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
    try {
      await updateBalance(balance);
      console.log('Firebase: balance updated', balance);
    } catch (e) { console.warn('balance update failed', e); }
  }, 200);
};


