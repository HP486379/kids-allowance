// 繧ｭ繝・ぜ縺ｽ縺代▲縺ｨ・懊♀蟆城▲縺・ｮ｡逅・
// 萓晏ｭ倥↑縺励・繝舌ル繝ｩJS縲ゅョ繝ｼ繧ｿ縺ｯ localStorage 縺ｫ菫晏ｭ倥・

(function(){
  const LS_KEY = 'kid-allowance-v1';
  const $ = (q, el=document) => el.querySelector(q);
  const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));

  // ----- State -----
  const initialState = () => ({
    childName: '',
    avatar: '製',
    currency: 'ﾂ･',
    theme: 'cute', // 'cute' | 'adventure'
    transactions: [], // {id, type:income|expense|goal|chore, amount, note, dateISO}
    goals: [], // {id, name, target, saved}
    chores: [
      { id: id(), name:'繝吶ャ繝峨ｒ縺ｨ縺ｨ縺ｮ縺医ｋ', reward:100, lastDone:'' },
      { id: id(), name:'縺励ｇ繧九＞繧偵°縺溘▼縺代ｋ', reward:100, lastDone:'' },
      { id: id(), name:'縺励ｇ縺上□縺・, reward:150, lastDone:'' },
    ],
  });

  let state = load() || seed();

  // ----- Utils -----
  function id(){ return Math.random().toString(36).slice(2,9) }
  function today(){ return new Date().toISOString().slice(0,10) }
  function format(n){
    const sign = n < 0 ? '-' : '';
    const v = Math.abs(Math.round(n));
    return sign + v.toLocaleString('ja-JP');
  }
  function money(n){ return `${state.currency}${format(n)}` }
  function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  function load(){ try{ return JSON.parse(localStorage.getItem(LS_KEY) || ''); }catch{ return null } }
  function seed(){
    const st = initialState();
    st.childName = '縺ｪ縺ｾ縺・;
    st.transactions = [
      { id:id(), type:'income', amount:300, note:'縺ｯ縺倥ａ縺ｦ縺ｮ縺翫％縺･縺九＞', dateISO:new Date().toISOString() },
      { id:id(), type:'expense', amount:120, note:'縺翫ｄ縺､', dateISO:new Date().toISOString() },
    ];
    st.goals = [ { id:id(), name:'繝ｬ繧ｴ', target:2000, saved:300 } ];
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

  // ----- Rendering -----
  function renderAll(){
    applyTheme();
    renderHeader();
    renderTabs();
    renderHome();
    renderTransactions();
    renderGoals();
    renderChores();
    renderSettings();
  }

  function renderHeader(){
    $('#avatarButton').textContent = state.avatar;
    $('#childName').value = state.childName || '';
    $('#balance').textContent = money(computeBalance());
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
    if(recent.length===0){ ul.innerHTML = '<li>縺ｾ縺縺ｪ縺・ｈ</li>'; }
    recent.forEach(t=>{
      const li = document.createElement('li');
      const icon = t.type==='income' || t.type==='chore' ? '・・ : '竏・;
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
    $('#quickAdd100').onclick = ()=> addTx('income', 100, '繝励メ縺翫％縺･縺九＞', true);
    $('#quickAdd300').onclick = ()=> addTx('income', 300, '縺翫％縺･縺九＞', true);
    $('#quickSnack').onclick = ()=> addTx('expense', 150, '縺翫ｄ縺､', true);

    $('#quickForm').onsubmit = (e)=>{
      e.preventDefault();
      const type = $('#quickType').value;
      const amount = parseAmount($('#quickAmount').value);
      const note = $('#quickNote').value.trim();
      if(!validAmount(amount)) return toast('驥鷹｡阪ｒ豁｣縺励￥蜈･繧後※縺ｭ');
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
      if(items.length===0){ list.innerHTML = '<li>縺ｾ縺縺ｪ縺・ｈ</li>'; return; }
      items.forEach(t=>{
        const li = document.createElement('li');
        const isPlus = t.type==='income' || t.type==='chore';
        li.innerHTML = `
          <div>
            <div class="note">${escapeHtml(t.note||labelForType(t.type))}</div>
            <div class="meta">${dateJa(t.dateISO)}</div>
          </div>
          <div class="amount ${isPlus?'good':'bad'}">${isPlus?'+':'竏・}${money(t.amount)}</div>
        `;
        list.appendChild(li);
      });
    }
    paint();
    filter.onchange = paint;

    $('#addTransactionBtn').onclick = ()=> openModal($('#txDialog'));
    $('#txForm').onsubmit = (e)=>{
      e.preventDefault();
      const type = $('#txType').value;
      const amount = parseAmount($('#txAmount').value);
      const note = $('#txNote').value.trim();
      if(!validAmount(amount)) return toast('驥鷹｡阪ｒ豁｣縺励￥蜈･繧後※縺ｭ');
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
      empty.textContent = '縺ｾ縺繧ゅ￥縺ｲ繧・≧縺後↑縺・ｈ縲ゅ▽縺上▲縺ｦ縺ｿ繧医≧・・;
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
              <button class="btn primary" data-act="save">縺｡繧・″繧薙☆繧・/button>
              <button class="btn" data-act="edit">螟画峩</button>
              <button class="btn danger" data-act="delete">縺代☆</button>
            </div>
          </div>
        `;
        wrap.appendChild(card);

        const [saveBtn, editBtn, delBtn] = $$('button', card);
        saveBtn.onclick = ()=> contributeToGoal(g);
        editBtn.onclick = ()=> editGoal(g);
        delBtn.onclick = ()=> deleteGoal(g);

        if(g.saved >= g.target){
          // 螳御ｺ・ヰ繝・ず
          const done = document.createElement('div');
          done.className = 'meta';
          done.textContent = '縺翫ａ縺ｧ縺ｨ縺・ｼ・繧ゅ￥縺ｲ繧・≧ 縺溘▲縺帙＞・・;
          card.appendChild(done);
        }
      });
    }

    $('#addGoalBtn').onclick = ()=> openModal($('#goalDialog'));
    $('#goalForm').onsubmit = (e)=>{
      e.preventDefault();
      const name = $('#goalName').value.trim();
      const target = parseAmount($('#goalTarget').value);
      if(!name) return toast('縺ｪ縺ｾ縺医ｒ縺・ｌ縺ｦ縺ｭ');
      if(!validAmount(target)) return toast('逶ｮ讓咎≡鬘阪ｒ豁｣縺励￥蜈･繧後※縺ｭ');
      state.goals.push({ id:id(), name, target, saved:0 });
      save();
      closeModal($('#goalDialog'));
      e.target.reset();
      renderGoals();
    };
  }

  function renderChores(){
    const ul = $('#choreList');
    ul.innerHTML = '';
    if(state.chores.length===0){ ul.innerHTML = '<li>縺ｾ縺縺ｪ縺・ｈ</li>'; return; }
    state.chores.forEach(ch=>{
      const doneToday = ch.lastDone === today();
      const li = document.createElement('li');
      li.className = doneToday ? 'done' : '';
      li.innerHTML = `
        <div>
          <div class="note">${escapeHtml(ch.name)}</div>
          <div class="meta">縺斐⊇縺・・: ${money(ch.reward)} ${doneToday ? '・医″繧・≧縺ｯOK・・ｼ・ : ''}</div>
        </div>
        <button ${doneToday?'disabled':''}>繧・▲縺滂ｼ・/button>
      `;
      const btn = $('button', li);
      btn.onclick = ()=>{
        if(ch.lastDone === today()) return;
        ch.lastDone = today();
        addTx('chore', ch.reward, `縺翫※縺､縺縺・ ${ch.name}`, true);
        save();
        renderChores();
      };
      ul.appendChild(li);
    });
  }

  function renderSettings(){
    $('#settingsName').value = state.childName;
    $('#currency').value = state.currency;
    $('#themeSelect').value = state.theme || 'cute';
    const wrap = $('#avatarChoices');
    const choices = getAvatarChoices();
    wrap.innerHTML = '';
    choices.forEach(em=>{
      const b = document.createElement('button');
      b.type='button'; b.className='avatar'; b.textContent=em;
      b.onclick=()=>{ state.avatar = em; save(); renderHeader(); };
      wrap.appendChild(b);
    });

    $('#settingsName').oninput = (e)=>{ state.childName = e.target.value; save(); $('#childName').value = state.childName; };
    $('#currency').onchange = (e)=>{ state.currency = e.target.value; save(); renderHeader(); renderGoals(); renderChores(); renderTransactions(); renderHome(); };
    $('#themeSelect').onchange = (e)=>{
      state.theme = e.target.value;
      save();
      applyTheme();
      renderHeader();
      renderHome();
      renderTransactions();
      renderGoals();
      renderChores();
      renderSettings(); // refresh avatar pack
    };
    $('#resetData').onclick = ()=>{
      if(confirm('繝・・繧ｿ繧偵●繧薙・縺代＠縺ｾ縺吶ゅｈ繧阪＠縺・〒縺吶°・・)){
        localStorage.removeItem(LS_KEY);
        state = seed();
        renderAll();
        toast('繝ｪ繧ｻ繝・ヨ縺励∪縺励◆');
      }
    };
    // Export / Import
    $('#exportData').onclick = async ()=>{
      const json = JSON.stringify(state, null, 2);
      $('#ioTitle').textContent = '繧ｨ繧ｯ繧ｹ繝昴・繝・;
      $('#ioOk').textContent = '繧ｳ繝斐・';
      $('#ioText').value = json;
      openModal($('#ioDialog'));
      $('#ioOk').onclick = (ev)=>{
        ev.preventDefault();
        try{ navigator.clipboard.writeText($('#ioText').value); toast('繧ｯ繝ｪ繝・・繝懊・繝峨↓繧ｳ繝斐・縺励∪縺励◆'); }catch{ toast('繧ｳ繝斐・縺ｧ縺阪↑縺・ｴ蜷医・謇句虚縺ｧ驕ｸ謚槭＠縺ｦ縺上□縺輔＞'); }
        closeModal($('#ioDialog'));
      };
    };
    $('#importData').onclick = ()=>{
      $('#ioTitle').textContent = '繧､繝ｳ繝昴・繝・;
      $('#ioOk').textContent = '隱ｭ縺ｿ霎ｼ縺ｿ';
      $('#ioText').value = '';
      openModal($('#ioDialog'));
      $('#ioOk').onclick = (ev)=>{
        ev.preventDefault();
        try{
          const obj = JSON.parse($('#ioText').value);
          if(!obj || typeof obj !== 'object') throw new Error('bad');
          state = { ...initialState(), ...obj };
          save();
          renderAll();
          toast('繧､繝ｳ繝昴・繝医＠縺ｾ縺励◆');
          closeModal($('#ioDialog'));
        }catch{ toast('JSON繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞'); }
      };
    };

    // Header quick edits
    $('#childName').oninput = (e)=>{ state.childName = e.target.value; save(); $('#settingsName').value = state.childName; };
    $('#avatarButton').onclick = ()=>{
      // cycle avatar
      const choices = getAvatarChoices();
      const idx = (choices.indexOf(state.avatar)+1) % choices.length;
      state.avatar = choices[idx]; save(); renderHeader();
    };
  }

  // ----- Actions -----
  function addTx(type, amount, note, animateCoin=false){
    const t = { id:id(), type, amount:Math.round(amount), note, dateISO:new Date().toISOString() };
    state.transactions.push(t);
    save();
    $('#balance').textContent = money(computeBalance());
    renderHome();
    renderTransactions();
    if(type==='income' || type==='chore'){
      if(animateCoin) dropCoin();
    }
  }

  function contributeToGoal(goal){
    const max = computeBalance();
    if(max<=0) return toast('縺ｾ縺壹・縺翫％縺･縺九＞繧偵◆繧√ｈ縺・ｼ・);
    const val = prompt(`縺・￥繧峨■繧・″繧薙☆繧具ｼ滂ｼ域怙螟ｧ ${money(max)}・荏, Math.min(300, max).toString());
    const amount = parseAmount(val||'');
    if(!validAmount(amount)) return;
    if(amount>max) return toast('縺悶ｓ縺縺九ｈ繧翫♀縺翫＞繧・);
    goal.saved += amount;
    addTx('goal', amount, `縺｡繧・″繧・ ${goal.name}`);
    save();
    renderGoals();
    if(goal.saved >= goal.target){
      confetti();
      toast('縺翫ａ縺ｧ縺ｨ縺・ｼ・繧ゅ￥縺ｲ繧・≧ 縺溘▲縺帙＞・・);
    }
  }

  function editGoal(goal){
    const name = prompt('縺ｪ縺ｾ縺・, goal.name)||goal.name;
    const target = parseAmount(prompt('逶ｮ讓咎≡鬘・, String(goal.target))||String(goal.target));
    if(!validAmount(target)) return toast('逶ｮ讓咎≡鬘阪ｒ豁｣縺励￥蜈･繧後※縺ｭ');
    goal.name = name.trim()||goal.name;
    goal.target = target;
    save();
    renderGoals();
  }

  function deleteGoal(goal){
    if(!confirm('繧ゅ￥縺ｲ繧・≧繧偵￠縺励∪縺吶°・・)) return;
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
      return ['噫','嶌','､・,'ｦ・,'峅・・,'笞ｽ','式','ｧｭ','孱・・,'裡・・,'ｧｱ','栖'];
    }
    return ['製','棲','星','晴','西','ｦ・,'勢','ｦ・,'瀬','牲','生','精'];
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
    return type==='income' ? '縺翫％縺･縺九＞' : type==='expense' ? '縺翫°縺・ｂ縺ｮ' : type==='goal' ? '縺｡繧・″繧・ : '縺翫※縺､縺縺・;
  }
  function parseAmount(v){
    if(typeof v !== 'string') return 0;
    v = v.replace(/[^0-9]/g,'');
    return v ? parseInt(v,10) : 0;
  }
  function validAmount(n){ return Number.isFinite(n) && n>0 && n<=1_000_000 }
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])) }

  // Chore button binder (robust against innerHTML encoding issues)
  function bindChoreButtons(){
    try{
      const ul = document.getElementById('choreList');
      if(!ul) return;
      const lis = ul.querySelectorAll('li');
      lis.forEach((li, idx)=>{
        const ch = state.chores[idx];
        if(!ch) return;
        let btn = li.querySelector('button');
        if(!btn){
          btn = document.createElement('button');
          li.appendChild(btn);
        }
        btn.textContent = '繧・▲縺滂ｼ・;
        btn.classList.add('btn','good');
        btn.disabled = (ch.lastDone === today());
        btn.onclick = ()=>{
          if(ch.lastDone === today()) return;
          ch.lastDone = today();
          addTx('chore', ch.reward, `縺翫※縺､縺縺・${ch.name}`, true);
          save();
          renderChores();
          bindChoreButtons();
        };
      });
    }catch{}
  }

  // Remove visual "（きょうはOK！）" from chore meta if present (UI only)
  function stripChoreOkText(){
    try{
      document.querySelectorAll('#choreList .meta').forEach(el=>{
        el.textContent = (el.textContent||'')
          .replace(/（きょうはOK！）/g, '')
          .replace(/\(きょうはOK!\)/g, '');
      });
    }catch{}
  }

  function setupChoreBinding(){
    const ul = document.getElementById('choreList');
    if(!ul) return;
    const ob = new MutationObserver(()=> { bindChoreButtons(); stripChoreOkText(); });
    ob.observe(ul, { childList:true });
    bindChoreButtons();
    stripChoreOkText();
  }

  // ----- Init -----
  renderAll();
  // ensure chore buttons always wired
  setupChoreBinding();
})();

