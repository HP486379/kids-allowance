// キッズぽけっと｜お小遣い管理
// 依存なしのバニラJS。データは localStorage に保存。

(function(){
  const LS_KEY = 'kid-allowance-v1';
  const $ = (q, el=document) => el.querySelector(q);
  const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));

  // ----- State -----
  const initialState = () => ({
    childName: '',
    avatar: '🐻',
    currency: '¥',
    theme: 'cute', // 'cute' | 'adventure'
    transactions: [], // {id, type:income|expense|goal|chore, amount, note, dateISO}
    goals: [], // {id, name, target, saved}
    chores: [
      { id: id(), name:'ベッドをととのえる', reward:100, lastDone:'' },
      { id: id(), name:'しょるいをかたづける', reward:100, lastDone:'' },
      { id: id(), name:'しょくだい', reward:150, lastDone:'' },
    ],
  });

  let state = load() || seed();
  try { mirrorToProfile(); } catch(_) {}

  // ----- Utils -----
  function id(){ return Math.random().toString(36).slice(2,9) }
function today(){ return new Date().toISOString().slice(0,10) }
function format(n){
    const sign = n < 0 ? '-' : '';
    const v = Math.abs(Math.round(n));
    return sign + v.toLocaleString('ja-JP');
  }
function money(n){ return `${state.currency}${format(n)}` }
function save(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  mirrorToProfile();
  mirrorGoalsCache();
  try {
    if (window.kidsAllowanceSync) window.kidsAllowanceSync(state);
  } catch (_) {}
}
function load(){ try{ return JSON.parse(localStorage.getItem(LS_KEY) || ''); }catch{ return null } }
function seed(){
    const st = initialState();
    st.childName = 'なまえ';
    st.transactions = [
      { id:id(), type:'income', amount:300, note:'はじめてのおこづかい', dateISO:new Date().toISOString() },
      { id:id(), type:'expense', amount:120, note:'おやつ', dateISO:new Date().toISOString() },
    ];
    st.goals = [ { id:id(), name:'レゴ', target:2000, saved:300 } ];
    localStorage.setItem(LS_KEY, JSON.stringify(st));
    return st;
  }
function computeBalance(){
    return state.transactions.reduce((sum, t)=>{
      if(t.type==='income' || t.type==='chore') return sum + t.amount;
      if(t.type==='expense' || t.type==='goal') return sum - t.amount;
      return sum;
    }, 0);
  }

  
  // ===== Multi-user meta (profiles) =====
  const META_KEY = 'kid-allowance:meta';
  const PROFILE_PREFIX = 'kid-allowance:profile:';
  function pidKey(id){ return PROFILE_PREFIX + id; }
  function idGen(){ return Math.random().toString(36).slice(2,9); }
  function ensureMeta(){
    try{
      let meta = JSON.parse(localStorage.getItem(META_KEY) || '');
      if(!meta || !Array.isArray(meta.profiles) || !meta.profiles.length){
        const id = idGen();
        meta = { profiles:[{ id, name:'なまえ' }], currentId:id };
        const st = load() || initialState();
        localStorage.setItem(pidKey(id), JSON.stringify(st));
        localStorage.setItem(META_KEY, JSON.stringify(meta));
      }
      return meta;
    }catch{
      const id = idGen();
      const st = load() || initialState();
      localStorage.setItem(pidKey(id), JSON.stringify(st));
      const meta = { profiles:[{ id, name:'なまえ' }], currentId:id };
      localStorage.setItem(META_KEY, JSON.stringify(meta));
      return meta;
    }
  }
  let META = ensureMeta();
  mirrorGoalsCache();
  // goals 用のローカルキャッシュキー（プロフィールID固有）
  function goalsCacheKey(){
    try{ return 'kids-allowance:goals:' + (META && META.currentId ? META.currentId : 'default'); }catch{ return 'kids-allowance:goals:default'; }
  }
  function mirrorGoalsCache(){
    try{ localStorage.setItem(goalsCacheKey(), JSON.stringify(state.goals||[])); }catch{}
  }
  function mirrorToProfile(){
    try{ if(META && META.currentId){ localStorage.setItem(pidKey(META.currentId), JSON.stringify(state)); } }catch{}
  }
  function loadProfileToActive(id){
    try{
      const raw = localStorage.getItem(pidKey(id));
      const st = raw ? JSON.parse(raw) : initialState();
      localStorage.setItem(LS_KEY, JSON.stringify(st));
      return st;
    }catch{ return null }
  }
  function switchProfile(id){
    try{
      mirrorToProfile();
      mirrorGoalsCache();
      const st = loadProfileToActive(id) || initialState();
      META.currentId = id; localStorage.setItem(META_KEY, JSON.stringify(META));
      state = st; renderAll();
    }catch{}
  }// ----- Rendering -----
  function renderAll(){
    applyTheme();
    renderHeader();
    renderTabs();
    renderHome();
    renderTransactions();
    renderGoals();
    renderSavings();
    renderChores();
    renderSettings();
  }
function renderHeader(){
    $('#avatarButton').textContent = state.avatar;
    $('#childName').value = state.childName || '';
    document.getElementById('balance').textContent = money(computeBalance());
  }
function renderTabs(){
    $$('.tab').forEach(btn=>{
      btn.onclick = ()=>{
        $$('.tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        $$('.view').forEach(v=>v.classList.remove('active'));
        $(`#view-${tab}`).classList.add('active');
      };
    });
    // Controller/keyboard: left/right to switch tabs (skip when typing)
    document.addEventListener('keydown', (e)=>{
      const t = e.target;
      if(t && ['INPUT','TEXTAREA','SELECT'].includes(t.tagName)) return;
      if(e.key==='ArrowLeft' || e.key==='ArrowRight'){
        const tabs = $$('.tab');
        const idx = tabs.findIndex(b=>b.classList.contains('active'));
        if(idx>=0){
          const next = (idx + (e.key==='ArrowRight'?1:-1) + tabs.length) % tabs.length;
          tabs[next].click();
          tabs[next].focus();
          e.preventDefault();
        }
      }
      if(e.key==='Escape'){
        // close any open fallback dialog
        const openDlg = $('.dialog.open');
        if(openDlg){ closeModal(openDlg); }
      }
    }, { once:true });
  }
function renderHome(){
    // recent
    const recent = [...state.transactions].sort((a,b)=>b.dateISO.localeCompare(a.dateISO)).slice(0,6);
    const ul = $('#recentList');
    ul.innerHTML = '';
    if(recent.length===0){ ul.innerHTML = '<li>まだないよ</li>'; }
    recent.forEach(t=>{
      const li = document.createElement('li');
      const icon = t.type==='income' || t.type==='chore' ? '＋' : '−';
      const col = t.type==='income' || t.type==='chore' ? 'good' : 'bad';
      li.innerHTML = `
        <div>
          <div class="note">${escapeHtml(t.note||labelForType(t.type))}</div>
          <div class="meta">${dateJa(t.dateISO)}</div>
        </div>
        <div class="amount ${col}">${icon}${money(t.amount)}</div>
      `;
      ul.appendChild(li);
    });

    // quick buttons
    $('#quickAdd100').onclick = ()=> addTx('income', 100, 'プチおこづかい', true);
    $('#quickAdd300').onclick = ()=> addTx('income', 300, 'おこづかい', true);
    $('#quickSnack').onclick = ()=> addTx('expense', 150, 'おやつ', true);

    $('#quickForm').onsubmit = (e)=>{
      e.preventDefault();
      const type = $('#quickType').value;
      const amount = parseAmount($('#quickAmount').value);
      const note = $('#quickNote').value.trim();
      if(!validAmount(amount)) return toast('金額を正しく入れてね');
      if(amount >= 10000 && !confirm(`金額が ${money(amount)} になっています。よろしいですか？`)) return;
      addTx(type, amount, note || labelForType(type), true);
      $('#quickAmount').value = '';
      $('#quickNote').value = '';
    };
  }
function renderTransactions(){
    const list = $('#txList');
    const filter = $('#filterType');
    function paint(){
      list.innerHTML = '';
      let items = [...state.transactions].sort((a,b)=>b.dateISO.localeCompare(a.dateISO));
      if(filter.value!=='all') items = items.filter(t=>t.type===filter.value);
      if(items.length===0){ list.innerHTML = '<li>まだないよ</li>'; return; }
      items.forEach(t=>{
        const li = document.createElement('li');
        const isPlus = t.type==='income' || t.type==='chore';
        li.innerHTML = `
          <div>
            <div class="note">${escapeHtml(t.note||labelForType(t.type))}</div>
            <div class="meta">${dateJa(t.dateISO)}</div>
          </div>
          <div class="amount ${isPlus?'good':'bad'}">${isPlus?'+':'−'}${money(t.amount)}</div>
        `;
        const delBtn = document.createElement('button');
        delBtn.className = 'btn danger tx-del';
        delBtn.textContent = 'さくじょ';
        delBtn.style.marginLeft = '8px';
        delBtn.type = 'button';
        delBtn.onclick = ()=> deleteTx(t.id);
        li.appendChild(delBtn);
        list.appendChild(li);
      });
    }
    paint();
    filter.onchange = paint;

    $('#addTransactionBtn').onclick = ()=> openModal($('#txDialog'));
    // 一括削除ボタン（表示中の絞り込み対象を削除）
    (function(){
      const addBtn = $('#addTransactionBtn');
      if(!addBtn) return;
      if(document.getElementById('bulkDeleteBtn')) return;
      const b = document.createElement('button');
      b.id='bulkDeleteBtn'; b.className='btn danger'; b.style.marginLeft='8px'; b.textContent='一括削除(表示分)';
      if(addBtn.parentElement) addBtn.parentElement.appendChild(b);
      b.onclick = ()=>{
        let items = [...state.transactions].sort((a,b)=>b.dateISO.localeCompare(a.dateISO));
        const f = $('#filterType'); if(f && f.value!=='all') items = items.filter(t=>t.type===f.value);
        if(items.length===0){ toast('削除対象がありません'); return; }
        if(!confirm(`${items.length}件を一括削除します。よろしいですか？`)) return;
        let delSet = _loadDeletedSet();
        const ids = new Set();
        items.forEach(t=>{ delSet.add(_fp(t.type,t.amount,t.note)); ids.add(t.id); });
        _saveDeletedSet(delSet);
        state.transactions = state.transactions.filter(t=> !ids.has(t.id));
        save(); paint(); renderHome();
      };
    })();
    $('#txForm').onsubmit = (e)=>{
      e.preventDefault();
      const type = $('#txType').value;
      const amount = parseAmount($('#txAmount').value);
      const note = $('#txNote').value.trim();
      if(!validAmount(amount)) return toast('金額を正しく入れてね');
      if(amount >= 10000 && !confirm(`金額が ${money(amount)} になっています。よろしいですか？`)) return;
      addTx(type, amount, note || labelForType(type), true);
      closeModal($('#txDialog'));
      e.target.reset();
      renderTransactions();
    };
  }
function renderGoals(){
    const wrap = $('#goalList');
    wrap.innerHTML = '';
    if(state.goals.length===0){
      const empty = document.createElement('div');
      empty.className='card';
      empty.textContent = 'まだもくひょうがないよ。つくってみよう！';
      wrap.appendChild(empty);
    } else {
      state.goals.forEach(g=>{
        const p = Math.min(100, Math.round((g.saved / Math.max(1,g.target))*100));
        const card = document.createElement('div');
        card.className = 'goal-card';
        card.innerHTML = `
          <div class="ring" style="background: conic-gradient(var(--brand) 0 ${p}%, #eee ${p}% 100%)">
            <div class="inner"></div>
          </div>
          <div>
            <div class="goal-name">${escapeHtml(g.name)}</div>
            <div class="meta">${money(g.saved)} / ${money(g.target)}</div>
            <div class="goal-actions">
              <button class="btn primary" data-act="save">ちょきんする</button>
              <button class="btn" data-act="edit">変更</button>
              <button class="btn danger" data-act="delete">けす</button>
            </div>
          </div>
        `;
        wrap.appendChild(card);

        const [saveBtn, editBtn, delBtn] = $$('button', card);
        saveBtn.onclick = ()=> contributeToGoal(g);
        editBtn.onclick = ()=> editGoal(g);
        delBtn.onclick = ()=> deleteGoal(g);

        if(g.saved >= g.target){
          // 完了バッジ
          const done = document.createElement('div');
          done.className = 'meta';
          done.textContent = 'おめでとう！ もくひょう たっせい！';
          card.appendChild(done);
        }
      });
    }

    $('#addGoalBtn').onclick = ()=> openModal($('#goalDialog'));
    $('#goalForm').onsubmit = (e)=>{
      e.preventDefault();
      const name = $('#goalName').value.trim();
      const target = parseAmount($('#goalTarget').value);
      if(!name) return toast('なまえをいれてね');
      if(!validAmount(target)) return toast('目標金額を正しく入れてね');
      state.goals.push({ id:id(), name, target, saved:0 });
      save();
      closeModal($('#goalDialog'));
      e.target.reset();
      renderGoals();
    };
  }
  // ===== Savings (ちょきん確認・戻す) =====
  function renderSavings(){
    const wrap = document.getElementById('savingsList');
    const sumEl = document.getElementById('savingsSummary');
    if(!wrap || !sumEl) return;
    wrap.innerHTML = '';
    const total = (state.goals||[]).reduce((s,g)=> s + Math.max(0, Math.round(Number(g.saved)||0)), 0);
    sumEl.textContent = `合計: ${money(total)}`;
    const goals = (state.goals||[]).filter(g => (Math.round(Number(g.saved)||0)) > 0);
    if(goals.length===0){
      const li = document.createElement('li');
      li.textContent = 'まだ ちょきん はないよ';
      wrap.appendChild(li);
      return;
    }
    goals.forEach(g => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <div class="note">${escapeHtml(g.name)}</div>
          <div class="meta">いまの ちょきん: ${money(Math.round(Number(g.saved)||0))}</div>
        </div>
        <div class="goal-actions">
          <button class="btn" data-act="part">すこし もどす</button>
          <button class="btn danger" data-act="all">ぜんぶ もどす</button>
        </div>
      `;
      wrap.appendChild(li);
      const [partBtn, allBtn] = li.querySelectorAll('button');
      partBtn.onclick = ()=> withdrawFromGoal(g, false);
      allBtn.onclick = ()=> withdrawFromGoal(g, true);
    });
  }
  function withdrawFromGoal(goal, all=false){
    try{
      const cur = Math.max(0, Math.round(Number(goal.saved)||0));
      if(cur<=0) return toast('この もくひょう に ちょきん はないよ');
      let amount = cur;
      if(!all){
        const val = prompt(`いくら もどす？（最大 ${money(cur)}）`, Math.min(300, cur).toString());
        amount = parseAmount(val||'');
        if(!validAmount(amount)) return;
        if(amount > cur) return toast('ちょきん より おおいよ');
        if(amount >= 10000 && !confirm(`金額が ${money(amount)} になっています。よろしいですか？`)) return;
      }
      amount = sanitizeAmount(amount);
      goal.saved = sanitizeAmount(cur - amount);
      addTx('income', amount, `もどす: ${goal.name}`);
      save();
      renderGoals();
      renderSavings();
      renderHome();
      renderTransactions();
    }catch{}
  }
function renderChores(){
    const ul = document.getElementById('choreList');
    try{ if(typeof ensureChoreAdder=== 'function') ensureChoreAdder(); }catch(e){}
    ul.innerHTML = '';
    if (!Array.isArray(state.chores) || state.chores.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'まだないよ';
      ul.appendChild(li);
      return;
    }
    state.chores.forEach((ch) => {
      const doneToday = ch.lastDone === today();
      const li = document.createElement('li');
      li.className = doneToday ? 'done' : '';
      const left = document.createElement('div');
      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = ch.name;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = 'ごほうび: ' + money(ch.reward) + (doneToday ? '（きょうはOK）' : '');
      left.appendChild(note);
      left.appendChild(meta);
      const btn = document.createElement('button');
      btn.className = 'btn good';
      btn.textContent = 'やった！';
      if (doneToday) btn.disabled = true;
      btn.onclick = () => {
        if (ch.lastDone === today()) return;
        ch.lastDone = today();
        addTx('chore', ch.reward, 'おてつだい ' + ch.name, true);
        save();
        renderChores();
      };
      li.appendChild(left);
      li.appendChild(btn);
      ul.appendChild(li);
    });
    try{ if(typeof bindChoreControls=== 'function') bindChoreControls(); }catch(e){}
  }
function renderSettings(){
  $("#settingsName").value = state.childName;
  $("#currency").value = state.currency;
  $("#themeSelect").value = state.theme || "cute";

  const wrap = $("#avatarChoices");
  const choices = getAvatarChoices();
  wrap.innerHTML = "";
  choices.forEach(em=>{
    const b = document.createElement("button");
    b.type='button'; b.className='avatar'; b.textContent=em;
    b.onclick=()=>{ state.avatar = em; save(); renderHeader(); try{ if(window.kidsAllowanceSaveProfile) window.kidsAllowanceSaveProfile(state); }catch{} };
    wrap.appendChild(b);
  });

  $("#settingsName").oninput = (e)=>{ state.childName = e.target.value; save(); $("#childName").value = state.childName; try{ if(window.kidsAllowanceSaveProfile) window.kidsAllowanceSaveProfile(state); }catch{} };
  $("#currency").onchange = (e)=>{ state.currency = e.target.value; save(); renderHeader(); renderGoals(); renderChores(); renderTransactions(); renderHome(); };
  $("#themeSelect").onchange = (e)=>{ state.theme = e.target.value; save(); applyTheme(); renderHeader(); renderHome(); renderTransactions(); renderGoals(); renderChores(); renderSettings(); try{ if(window.kidsAllowanceSaveProfile) window.kidsAllowanceSaveProfile(state); }catch{} };
  try{ const syncDisp = document.getElementById('syncIdDisplay'); if(syncDisp){ syncDisp.value = (META && META.currentId) || ''; } }catch{}


  // Reset
  $("#resetData").onclick = ()=>{
    if(confirm('データを初期化します。本当によろしいですか？')){
      localStorage.removeItem(LS_KEY);
      state = seed();
      renderAll();
      toast('リセットしました');
    }
  };

  // Export / Import
  $("#exportData").onclick = async ()=>{
    const json = JSON.stringify(state, null, 2);
    $("#ioTitle").textContent = 'エクスポート';
    $("#ioOk").textContent = 'コピー';
    $("#ioText").value = json;
    openModal($("#ioDialog"));
    $("#ioOk").onclick = (ev)=>{
      ev.preventDefault();
      try{ navigator.clipboard.writeText($("#ioText").value); toast('クリップボードにコピーしました'); }catch{ toast('コピーできない時は手動で選択してください'); }
      closeModal($("#ioDialog"));
    };
  };
  $("#importData").onclick = ()=>{
    $("#ioTitle").textContent = 'インポート';
    $("#ioOk").textContent = '読み込み';
    $("#ioText").value = '';
    openModal($("#ioDialog"));
    $("#ioOk").onclick = (ev)=>{
      ev.preventDefault();
      try{
        const obj = JSON.parse($("#ioText").value);
        if(!obj || typeof obj !== 'object') throw new Error('bad');
        state = { ...initialState(), ...obj };
        save();
        renderAll();
        toast('インポートしました');
        closeModal($("#ioDialog"));
      }catch{ toast('JSONを確認してください'); }
    };
  };

  // Profiles (multi-user) controls (inserted safely)
  (function injectProfileRow(){
    try{
      const card = document.querySelector('#view-settings .card');
      if(!card || document.getElementById('profileRow')) return;
      const row = document.createElement('div');
      row.id = 'profileRow'; row.className = 'field-row'; row.style.marginBottom = '8px';
      const label = document.createElement('label'); label.textContent = 'ひと';
      const sel = document.createElement('select'); sel.id='profileSelect'; sel.className='input'; sel.style.minWidth = '160px';
      const addBtn = document.createElement('button'); addBtn.className='btn'; addBtn.textContent='追加';
      const renBtn = document.createElement('button'); renBtn.className='btn'; renBtn.textContent='なまえ変更';
      const delBtn = document.createElement('button'); delBtn.className='btn danger'; delBtn.textContent='けす';
      row.appendChild(label); row.appendChild(sel); row.appendChild(addBtn); row.appendChild(renBtn); row.appendChild(delBtn);
      card.insertBefore(row, card.firstChild);
      function refreshSelect(){
        sel.innerHTML = '';
        (META && META.profiles || []).forEach(p=>{
          const o=document.createElement('option'); o.value=p.id; o.textContent=p.name||'なまえ'; if(p.id===META.currentId) o.selected=true; sel.appendChild(o);
        });
      }
      refreshSelect();
      sel.onchange = ()=>{ if(sel.value) switchProfile(sel.value); };
      addBtn.onclick = ()=>{
        const name = prompt('なまえ'); if(!name) return;
        const id = idGen(); META.profiles.push({id,name}); META.currentId=id; localStorage.setItem(META_KEY, JSON.stringify(META));
        state = initialState(); state.childName = name; save(); renderAll();
      };
      renBtn.onclick = ()=>{
        const p = META.profiles.find(x=>x.id===META.currentId); if(!p) return;
        const name = prompt('なまえ', p.name)||p.name; p.name=name; localStorage.setItem(META_KEY, JSON.stringify(META)); refreshSelect();
        state.childName = name; save(); renderHeader();
      };
      delBtn.onclick = ()=>{
        if(META.profiles.length<=1){ alert('最低1名必要です'); return; }
        if(!confirm('このひとを削除しますか？')) return;
        const cur=META.currentId; META.profiles = META.profiles.filter(x=>x.id!==cur);
        try{ localStorage.removeItem(pidKey(cur)); }catch{}
        META.currentId = META.profiles[0].id; localStorage.setItem(META_KEY, JSON.stringify(META));
        state = loadProfileToActive(META.currentId) || initialState(); renderAll();
      };
    }catch{}
  })();
}// ----- Actions -----
  function addTx(type, amount, note, animateCoin=false){
    const t = { id:id(), type, amount:sanitizeAmount(amount), note, dateISO:new Date().toISOString() };
    state.transactions.push(t);
    save();
    try{ if(window.kidsAllowanceAddTx) window.kidsAllowanceAddTx(t); }catch{}
    document.getElementById('balance').textContent = money(computeBalance()); try{ if(window.kidsAllowanceUpdateBalance) window.kidsAllowanceUpdateBalance(state); }catch{}
    renderHome();
    renderTransactions();
    if(type==='income' || type==='chore'){
      if(animateCoin) dropCoin();
    }
  }

  // 取引の削除（さくじょ）
  function deleteTx(id){
    try{
      const idx = (state.transactions||[]).findIndex(t=>t.id===id);
      if(idx < 0) return;
      if(!confirm('この記録を削除しますか？')) return;
      // 変更を確定
      const next = [...state.transactions];
      next.splice(idx,1);
      state.transactions = next;
      // ローカル保存を強制（LS_KEY と profile の両方）
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(state));
        if (typeof META !== 'undefined' && META && META.currentId) {
          localStorage.setItem(pidKey(META.currentId), JSON.stringify(state));
        }
      } catch (_) {}
      // 直後にストレージから読み直してメモリと表示を同期
      try {
        const fresh = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
        if (fresh && typeof fresh === 'object') state = fresh;
      } catch (_) {}
      try{ document.getElementById('balance').textContent = money(computeBalance()); }catch{}
      renderTransactions();
      renderHome();
    } catch(_) {}
  }
function contributeToGoal(goal){
    const max = computeBalance();
    if(max<=0) return toast('まずはおこづかいをためよう！');
    const val = prompt(`いくらちょきんする？（最大 ${money(max)}）`, Math.min(300, max).toString());
    const amount = parseAmount(val||'');
    if(!validAmount(amount)) return;
    if(amount > max) return toast('ざんだかよりおおいよ');
    if(amount >= 10000 && !confirm(`金額が ${money(amount)} になっています。よろしいですか？`)) return;
    goal.saved += amount;
    addTx('goal', amount, `ちょきん: ${goal.name}`);
    save();
    renderGoals();
    renderSavings();
    if(goal.saved >= goal.target){
      confetti();
      toast('おめでとう！ もくひょう たっせい！');
    }
  }
function editGoal(goal){
    const name = prompt('なまえ', goal.name)||goal.name;
    const target = parseAmount(prompt('目標金額', String(goal.target))||String(goal.target));
    if(!validAmount(target)) return toast('目標金額を正しく入れてね');
    goal.name = name.trim()||goal.name;
    goal.target = target;
    save();
    renderGoals();
  }
function deleteGoal(goal){
    if(!confirm('もくひょうをけしますか？')) return;
    state.goals = state.goals.filter(g=>g.id!==goal.id);
    save();
    renderGoals();
  }

  // ----- Effects -----
  function dropCoin(){
    const pig = $('#piggy');
    const rect = pig.getBoundingClientRect();
    const c = document.createElement('div');
    c.className='coin';
    c.style.left = (rect.left + rect.width/2 - 13) + 'px';
    c.style.top = (rect.top - 60) + 'px';
    document.body.appendChild(c);
    setTimeout(()=> c.remove(), 900);
  }
function confetti(){
    const wrap = $('#confetti');
    for(let i=0;i<80;i++){
      const p = document.createElement('div');
      p.className='p';
      const hue = Math.floor(Math.random()*360);
      p.style.background = `hsl(${hue} 90% 60%)`;
      p.style.left = Math.random()*100 + 'vw';
      p.style.top = (-Math.random()*20) + 'vh';
      p.style.transform = `rotate(${Math.random()*360}deg)`;
      p.style.animationDelay = (Math.random()*0.4)+'s';
      wrap.appendChild(p);
      setTimeout(()=> p.remove(), 1600);
    }
  }
  function toast(msg){
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.position='fixed'; el.style.left='50%'; el.style.bottom='20px'; el.style.transform='translateX(-50%)';
    el.style.background='#000a'; el.style.color='#fff'; el.style.padding='10px 14px'; el.style.borderRadius='999px'; el.style.fontWeight='800';
    el.style.zIndex='1001';
    document.body.appendChild(el);
    setTimeout(()=> el.remove(), 1800);
  }

  // Toast with action button (Undoなど) ------------------------------
  function toastAction(message, actionLabel, onAction, timeoutMs){
    const wrap = document.createElement('div');
    wrap.style.position='fixed'; wrap.style.left='50%'; wrap.style.bottom='22px';
    wrap.style.transform='translateX(-50%)'; wrap.style.background='#000a'; wrap.style.color='#fff';
    wrap.style.padding='10px 14px'; wrap.style.borderRadius='999px'; wrap.style.fontWeight='800';
    wrap.style.zIndex='1002'; wrap.style.display='flex'; wrap.style.gap='12px'; wrap.style.alignItems='center';
    const span = document.createElement('span'); span.textContent = message; wrap.appendChild(span);
    const btn = document.createElement('button'); btn.textContent = actionLabel; btn.className='btn';
    btn.style.background='#fff2'; btn.style.color='#fff'; btn.style.border='1px solid #fff6'; btn.style.borderRadius='8px';
    btn.onclick = ()=>{ try{ onAction && onAction(); }finally{ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); } };
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
    const t = setTimeout(()=>{ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); }, timeoutMs||4000);
    // Prevent multiple clicks after timeout
    btn.addEventListener('click', ()=> clearTimeout(t), { once:true });
  }

  // ----- Helpers -----
  const supportsDialog = typeof HTMLDialogElement !== 'undefined' && HTMLDialogElement.prototype && 'showModal' in HTMLDialogElement.prototype;
  function openModal(dlg){ if(supportsDialog) dlg.showModal(); else { document.body.classList.add('modal-open'); dlg.classList.add('open'); } }
function closeModal(dlg){ if(supportsDialog) dlg.close(); else { dlg.classList.remove('open'); document.body.classList.remove('modal-open'); } }
function applyTheme(){
    document.body.classList.toggle('theme-adventure', state.theme==='adventure');
    document.body.classList.toggle('theme-cute', state.theme!=='adventure');
  }
function getAvatarChoices(){
    if(state.theme==='adventure'){
      return ['🚀','🛸','🤖','🦖','🛰️','⚽','🎮','🧭','🛡️','🗡️','🧱','🐲'];
    }
    return ['🐻','🐱','🐯','🐰','🐼','🦊','🐨','🦄','🐣','🐵','🐶','🐸'];
  }
function dateJa(iso){
    try{
      const d = new Date(iso);
      const m = d.getMonth()+1; const day = d.getDate();
      const hh = d.getHours().toString().padStart(2,'0');
      const mm = d.getMinutes().toString().padStart(2,'0');
      return `${m}/${day} ${hh}:${mm}`;
    }catch{ return '' }
  }
function labelForType(type){
    return type==='income' ? 'おこづかい' : type==='expense' ? 'おかいもの' : type==='goal' ? 'ちょきん' : 'おてつだい';
  }
// 入力金額の安全なパース（小数や全角・通貨記号を考慮）
function toHalfWidthDigits(s){
    return String(s||'').replace(/[０-９]/g, c=> String.fromCharCode(c.charCodeAt(0)-0xFEE0));
}
function parseAmount(v){
    v = toHalfWidthDigits(v);
    if(typeof v !== 'string') v = String(v||'');
    v = v.trim().replace(/[¥￥$,\s]/g,''); // 通貨・カンマ・空白を除去
    // 小数セパレータが含まれる場合は整数部のみ採用（100.50 -> 100）
    const intPart = v.split(/[\.｡､，．]/)[0].replace(/[^0-9]/g,'');
    const n = intPart ? parseInt(intPart,10) : 0;
    return Number.isFinite(n) ? n : 0;
}
function sanitizeAmount(n){
    n = Math.round(Number(n)||0);
    if(n < 0) n = 0;
    if(n > 1_000_000) n = 1_000_000;
    return n;
}
function validAmount(n){ return Number.isFinite(n) && n>0 && n<=1_000_000 }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])) }

  // ----- Chore controls (undo & clear today) -----
  function isTodayISO(iso){ try{ return (iso||'').slice(0,10) === today(); }catch{ return false } }
function removeLastChoreTxFor(name){
    for(let i=state.transactions.length-1;i>=0;i--){
      const t = state.transactions[i];
      if(t && t.type==='chore' && isTodayISO(t.dateISO) && (t.note||'').indexOf(name) >= 0){
        state.transactions.splice(i,1);
        return true;
      }
    }
    return false;
  }
function clearTodayChores(){
    let changed=false;
    state.chores.forEach(ch=>{ if(ch.lastDone===today()){ ch.lastDone=''; changed=true; } });
    for(let i=state.transactions.length-1;i>=0;i--){
      const t=state.transactions[i];
      if(t && t.type==='chore' && isTodayISO(t.dateISO)){ state.transactions.splice(i,1); changed=true; }
    }
    if(changed){ save(); var b=document.getElementById('balance'); if(b) b.textContent = money(computeBalance()); renderChores(); }
  }
function bindChoreControls(){
    try{
      var ul = document.getElementById('choreList'); if(!ul) return;
      var lis = Array.prototype.slice.call(ul.children);
      lis.forEach(function(li, idx){
        var ch = state.chores[idx]; if(!ch) return;
        var undo = li.querySelector('[data-act="undo-chore"]');
        if(!undo){
          undo = document.createElement('button');
          undo.setAttribute('data-act','undo-chore');
          undo.className = 'btn';
          undo.style.marginLeft = '8px';
          undo.textContent = '\u3082\u3069\u3059';
          li.appendChild(undo);
        }
        undo.disabled = (ch.lastDone !== today());
        undo.onclick = function(){
          if(ch.lastDone !== today()) return;
          removeLastChoreTxFor(ch.name);
          ch.lastDone='';
          save();
          var b=document.getElementById('balance'); if(b) b.textContent = money(computeBalance());
          renderChores();
        };
      });
      var card = ul.closest ? ul.closest('.card') : ul.parentElement;
      if(card){
        var title = card.querySelector ? card.querySelector('.card-title') : null;
        if(title && !card.querySelector('[data-act="clear-today"]')){
          var clearBtn = document.createElement('button');
          clearBtn.setAttribute('data-act','clear-today');
          clearBtn.className = 'btn';
          clearBtn.style.marginLeft = '8px';
          clearBtn.textContent = '\u4ECA\u65E5\u3092\u30AF\u30EA\u30A2';
          clearBtn.onclick = function(){ if(confirm('\u4ECA\u65E5\u306E\u5B9F\u884C\u5206\u3092\u30AF\u30EA\u30A2\u3057\u307E\u3059\u304B?')) clearTodayChores(); };
          title.appendChild(clearBtn);
        }
      }
    }catch(e){}
  }
  






  // Add chore-adder row above the list
  function ensureChoreAdder(){
    try{
      var ul = document.getElementById('choreList'); if(!ul) return;
      var card = ul.closest ? ul.closest('.card') : ul.parentElement; if(!card) return;
      if(document.getElementById('choreAddRow')) return;
      var row = document.createElement('div');
      row.id = 'choreAddRow';
      row.className = 'field-row';
      row.style.marginBottom = '10px';
      var name = document.createElement('input');
      name.id = 'choreName'; name.className = 'input'; name.placeholder = '\u304a\u3066\u3064\u3060\u3044\u306e\u306a\u307e\u3048'; name.style.flex='1';
      var reward = document.createElement('input');
      reward.id = 'choreReward'; reward.className = 'input'; reward.inputMode='numeric'; reward.pattern='[0-9]*'; reward.placeholder='\u3054\u307B\u3046\u3073 (\u00A5)'; reward.style.width='140px';
      var addBtn = document.createElement('button');
      addBtn.id='addChoreBtn'; addBtn.className='btn primary'; addBtn.type='button'; addBtn.textContent='\u8FFD\u52A0';
      row.appendChild(name); row.appendChild(reward); row.appendChild(addBtn);
      card.insertBefore(row, ul);
      addBtn.onclick = function(){
        var nm = (name.value||'').trim();
        var amt = parseAmount(reward.value||'');
        if(!nm) return toast('\u306A\u307E\u3048\u3092\u3044\u308C\u3066\u306D');
        if(!validAmount(amt)) return toast('\u91D1\u984D\u3092\u6B63\u3057\u304F\u5165\u308C\u3066\u306D');
        state.chores.push({ id:id(), name:nm, reward:amt, lastDone:'' });
        save(); name.value=''; reward.value=''; renderChores();
      };
    }catch(e){}
  }




// ----- Init -----
  renderAll();
// Cloud transaction -> append to UI/state (avoid feedback & duplicates)
  try{
    window.kidsAllowanceOnCloudTx = function(key, tx){
    try{
      if(!tx) return;
      window._cloudSeen = window._cloudSeen || new Set();
      if(window._cloudSeen.has(key)) return; // seen
      window._cloudSeen.add(key);
      const t = {
        id: id(),
        type: (tx.type === 'add' ? 'income' : 'expense'),
        amount: sanitizeAmount(tx.amount),
        note: tx.label || '',
        dateISO: new Date(tx.timestamp || Date.now()).toISOString()
      };
      // robust duplicate guard: treat goal/expense as same "minus" kind
      const isPlus = (tp) => tp==='income' || tp==='chore' || tp==='add';
      const isMinus = (tp) => tp==='expense' || tp==='goal' || tp==='subtract';
      const sameKind = (a,b) => (isPlus(a)&&isPlus(b)) || (isMinus(a)&&isMinus(b));
      const recent = state.transactions.slice(-100);
      const dup = recent.some(u => u && sameKind(u.type, t.type) && u.amount===t.amount && (u.note||'')===(t.note||'') && Math.abs(new Date(u.dateISO) - new Date(t.dateISO)) < 5*60*1000);
      if(dup) return;
      // defensive: extremely large amount confirmation in debug mode
      if(t.amount >= 10000 && typeof window.debugLog === 'function') window.debugLog({ type:'cloudTx_large', t });
      state.transactions.push(t);
      save();
      renderHome();
      renderTransactions();
    }catch{}
  };
}catch{}

// Remote goals -> apply to UI/state
try{
  window.kidsAllowanceApplyGoals = function(goals){
    try{
      const arr = Array.isArray(goals) ? goals.map(g => ({
        id: g && g.id ? String(g.id) : id(),
        name: (g && g.name) || '',
        target: Math.round(Number(g && g.target) || 0),
        saved: Math.round(Number(g && g.saved) || 0)
      })) : [];
      // Replace entire goals list
      state.goals = arr;
      // Persist locally and re-render; may trigger sync, which is fine
      save();
      renderGoals();
    }catch(e){ console.warn('kidsAllowanceApplyGoals failed', e); }
  };
}catch{}

// In case goals arrived before this handler existed, apply cached goals
try{
  (function applyCachedGoalsOnce(){
    try{
      const raw = localStorage.getItem(goalsCacheKey());
      if(raw){
        const g = JSON.parse(raw);
        if(Array.isArray(g) && typeof window.kidsAllowanceApplyGoals === 'function'){
          window.kidsAllowanceApplyGoals(g);
        }
      }
    }catch{}
  })();
}catch{}

// Also reflect future events emitted before UI boots completely
try{
  window.addEventListener('goalsUpdated', (e)=>{
    try{
      if(typeof window.kidsAllowanceApplyGoals === 'function'){
        window.kidsAllowanceApplyGoals((e && e.detail) ? e.detail : []);
      }
    }catch{}
  });
}catch{}

// Inject Sync ID share/apply controls into Settings card
try{
  (function setupSyncIdUI(){
    const card = document.querySelector('#view-settings .card');
    if(!card){ setTimeout(setupSyncIdUI, 300); return; }
    if(document.getElementById('syncIdRow')) return;
    const row = document.createElement('div');
    row.id='syncIdRow'; row.className='field-row'; row.style.marginTop='8px';
    const label = document.createElement('label'); label.textContent = '同期ID';
    const disp = document.createElement('input'); disp.id='syncIdDisplay'; disp.readOnly=true; disp.style.minWidth='160px'; disp.value = (META && META.currentId) || '';
    const copyBtn = document.createElement('button'); copyBtn.className='btn'; copyBtn.textContent='コピー';
    const applyInput = document.createElement('input'); applyInput.id='syncIdInput'; applyInput.placeholder='貼り付けて適用'; applyInput.style.minWidth='160px';
    const applyBtn = document.createElement('button'); applyBtn.className='btn'; applyBtn.textContent='適用';
    row.appendChild(label); row.appendChild(disp); row.appendChild(copyBtn); row.appendChild(applyInput); row.appendChild(applyBtn);
    card.appendChild(row);
    copyBtn.onclick = ()=>{ try{ navigator.clipboard.writeText(disp.value); toast('コピーしました'); }catch{ toast('コピーできませんでした'); } };
    applyBtn.onclick = ()=>{
      const id = (applyInput.value||'').trim(); if(!id){ toast('IDを入力してください'); return; }
      try{
        if(!(META.profiles||[]).some(p=>p.id===id)){
          META.profiles = (META.profiles||[]); META.profiles.push({ id, name: state.childName||'なまえ' });
        }
        META.currentId = id; localStorage.setItem(META_KEY, JSON.stringify(META));
        const st = loadProfileToActive(id) || initialState(); state = st; renderAll(); toast('同期IDを適用しました');
      }catch(e){ console.warn(e); }
    };

    // Debug helpers (enable with ?debug=1)
    try {
      const u = new URLSearchParams(location.search||'');
      if (u.get('debug') === '1') {
        const dbgRow = document.createElement('div');
        dbgRow.className = 'field-row';
        const btn = document.createElement('button'); btn.className='btn'; btn.textContent='デバッグ: もくひょう反映';
        btn.onclick = ()=>{
          try{
            const raw = localStorage.getItem(goalsCacheKey());
            const g = raw ? JSON.parse(raw) : [];
            if(typeof window.kidsAllowanceApplyGoals === 'function'){
              window.kidsAllowanceApplyGoals(Array.isArray(g)?g:[]);
              toast('もくひょうを反映しました');
            } else {
              toast('applyGoals が未定義です');
            }
          }catch(e){ console.warn(e); toast('反映に失敗しました'); }
        };
        dbgRow.appendChild(btn);
        card.appendChild(dbgRow);
      }
    } catch {}
  })();
}catch{}
  // ==== Deleted transactions tombstone (prevent cloud resurrection) ====
  const TOMBSTONE_KEY = 'kid-allowance:deleted';
  function _loadDeletedSet(){
    try{ const a = JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || '[]'); return new Set(Array.isArray(a)?a:[]);}catch{ return new Set(); }
  }
  function _saveDeletedSet(set){
    try{ localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([...set].slice(-500))); }catch{}
  }
  function _signForKind(kind){ return (kind==='income'||kind==='chore'||kind==='add')?'+':'-'; }
  function _fp(kind, amount, note){ return `${_signForKind(kind)}|${sanitizeAmount(amount)}|${(note||'').trim()}`; }

  // override: deleteTx(id) with tombstone recording
  let _undoTimer = null; let _lastDeletedTx = null;
  function deleteTx(id){
    try{
      const idx = (state.transactions||[]).findIndex(t=>t.id===id);
      if(idx < 0) return;
      const delTx = state.transactions[idx];
      if (delTx){ const s=_loadDeletedSet(); s.add(_fp(delTx.type, delTx.amount, delTx.note)); _saveDeletedSet(s); }
      if(!confirm('この記録を削除しますか？')) return;
      const next = [...state.transactions]; next.splice(idx,1); state.transactions = next;
      try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); if(META&&META.currentId){ localStorage.setItem(pidKey(META.currentId), JSON.stringify(state)); } }catch{}
      try{ const fresh = JSON.parse(localStorage.getItem(LS_KEY)||'null'); if(fresh&&typeof fresh==='object') state=fresh; }catch{}
      try{ const b=document.getElementById('balance'); if(b) b.textContent = money(computeBalance()); }catch{}
      renderTransactions(); renderHome();

      // Undo 機能: 一時的に元データを保持
      _lastDeletedTx = delTx ? { ...delTx } : null;
      if(_undoTimer) { clearTimeout(_undoTimer); _undoTimer=null; }
      toastAction('削除しました', '取り消す', ()=>{
        try{
          if(!_lastDeletedTx) return;
          // tombstone を除去
          const s=_loadDeletedSet(); s.delete(_fp(_lastDeletedTx.type,_lastDeletedTx.amount,_lastDeletedTx.note)); _saveDeletedSet(s);
          state.transactions.push(_lastDeletedTx); save(); renderTransactions(); renderHome();
        }finally{ _lastDeletedTx=null; }
      }, 4000);
      _undoTimer = setTimeout(()=>{ _lastDeletedTx=null; }, 4100);
    }catch{}
  }

  // override: cloud handler to ignore tombstones
  try{
    window.kidsAllowanceOnCloudTx = function(key, tx){
      try{
        if(!tx) return;
        const s=_loadDeletedSet(); if (s.has(_fp(tx.type, tx.amount, tx.label||''))) return;
        window._cloudSeen = window._cloudSeen || new Set();
        if(window._cloudSeen.has(key)) return; window._cloudSeen.add(key);
        const t={ id:id(), type:(tx.type==='add'?'income':'expense'), amount:sanitizeAmount(tx.amount), note:tx.label||'', dateISO:new Date(tx.timestamp||Date.now()).toISOString() };
        const isPlus=(tp)=>tp==='income'||tp==='chore'||tp==='add'; const isMinus=(tp)=>tp==='expense'||tp==='goal'||tp==='subtract'; const sameKind=(a,b)=>(isPlus(a)&&isPlus(b))||(isMinus(a)&&isMinus(b));
        const recent=state.transactions.slice(-100); const dup=recent.some(u=>u&&sameKind(u.type,t.type)&&u.amount===t.amount&&(u.note||'')===(t.note||'')&&Math.abs(new Date(u.dateISO)-new Date(t.dateISO))<5*60*1000); if(dup) return;
        state.transactions.push(t); save(); renderHome(); renderTransactions();
      }catch{}
    };
  }catch{}

})();





// Cloud sync OFF stubs
try{
  window.KA_CLOUD_DISABLED = true;
  window.kidsAllowanceAddTx = function(){};
  window.kidsAllowanceApplyGoals = function(){};
  window.kidsAllowanceSaveProfile = function(){};
  window.kidsAllowanceUpdateBalance = function(){};
  window.kidsAllowanceSync = function(){};
}catch{}
