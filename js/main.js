// main.js

window.addEventListener('DOMContentLoaded', () => {
  try {
    // Firebase の残高購読
    listenBalance((bal) => {
      if (bal == null) return;
      const el = document.getElementById('balance');
      if (el) el.textContent = `¥${Number(bal).toLocaleString('ja-JP')}`;
    });
  } catch (e) {
    console.warn('listenBalance failed', e);
  }

  // ---------------------------
  // 鏡映情報: Firebase 全取引をロードして同期
  // ---------------------------
  try {
    loadAllTransactions((all) => {
      all.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      all.forEach((tx) => {
        try {
          if (window.kidsAllowanceOnCloudTx) {
            window.kidsAllowanceOnCloudTx(tx.id, tx);
          }
        } catch (e) {
          console.warn('onCloudTx hook failed (initial load)', e);
        }
      });
    });
  } catch (e) {
    console.warn('loadAllTransactions failed', e);
  }

  try {
    listenTransactions((key, tx) => {
      try {
        if (window.kidsAllowanceOnCloudTx) {
          window.kidsAllowanceOnCloudTx(key, tx);
        }
      } catch (e) {
        console.warn('onCloudTx hook failed (listen)', e);
      }
      console.log('Firebase: new transaction', key, tx);
    });
  } catch (e) {
    console.warn('listenTransactions failed', e);
  }

  // ---------------------------
  // もくひょう購読を追加
  // ---------------------------
  try {
    listenGoals((arr) => {
      try {
        if (window.kidsAllowanceApplyGoals) {
          window.kidsAllowanceApplyGoals(arr);
        }
      } catch (e) {
        console.warn('onCloudGoals hook failed', e);
      }
      console.log('Firebase: goals updated', arr);
    });
  } catch (e) {
    console.warn('listenGoals failed', e);
  }

  // ---------------------------
  // おてつだい購読（必要なら）
  // ---------------------------
  try {
    listenChores((arr) => {
      try {
        if (window.kidsAllowanceApplyChores) {
          window.kidsAllowanceApplyChores(arr);
        }
      } catch (e) {
        console.warn('onCloudChores hook failed', e);
      }
      console.log('Firebase: chores updated', arr);
    });
  } catch (e) {
    console.warn('listenChores failed', e);
  }
});
