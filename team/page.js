// Աշխատակցի հավելվածը՝ team/ (2026-11-05, db\0036. Գարիկ. «մեկ հավելվածել իր աշխատակցի համար», աշխատակիցը՝ Արամ)։
// ԿԱ 6՝ անունը, պատկերակը և վերևի նշանը HayWay-ինն են, աշխատակցի անունը՝ միայն ներսում։ Աշխատակիցը տեսնում է ՄԻԱՅՆ իր զրույցը տիրոջ հետ։
// Մուտք՝ տիրոջ «Հրավեր»-ի հղումով (#c<կոդ>) կամ նույն կոդը ձեռքով գրելով (iPhone-ի Home Screen հավելվածը Safari-ի պահածը չունի)
// → team-login ֆունկցիա → session։ Փոստ ու գաղտնաբառ չկա (Գարիկ. Արամը «չունի իմեյլ»)։
(function () {
  const CFG = window.GARIK_CONFIG;
  const sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const app = document.getElementById('app');
  const esc = HWTeam.esc;
  const LOGO = '<img src="../icon.svg?v=9" width="36" height="36" alt="HayWay">';

  // iPhone-ի ստեղնաշարը (նույնը, ինչ app.js-ում)
  const root = document.documentElement;
  // Էկրանի բարձրությունը՝ ../viewport.js (06.11)
  if (window.HWViewport) window.HWViewport.settle();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});

  async function login(code) {
    const r = await fetch(CFG.url + '/functions/v1/team-login', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.anonKey }, body: JSON.stringify({ code }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(j.error || 'Չստացվեց, փորձեք նորից');
    const { error } = await sb.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
    if (error) throw new Error(error.message);
  }

  function showLogin(note) {
    app.innerHTML = `<div class="login">
      <div class="brand">${LOGO}<div><h1>HayWay</h1><p>Մուտք</p></div></div>
      <div class="box">
        <div class="field"><label for="code">Հրավերի կոդը</label><input id="code" class="in" type="text" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="ABCD 1234" style="letter-spacing:.12em;text-transform:uppercase"></div>
        <button class="btn pri full" id="go">Մտնել</button>
        <p id="msg" class="msgline">${esc(note || '')}</p>
      </div>
      <p class="hint">Կոդը ձեզ կուղարկի ղեկավարը։</p>
    </div>`;
    const inp = document.getElementById('code'), go = document.getElementById('go'), msg = document.getElementById('msg');
    const run = async () => {
      if (inp.value.replace(/[^A-Za-z0-9]/g, '').length < 8) { msg.textContent = 'Գրեք 8 նիշը'; return; }
      go.disabled = true; msg.textContent = '';
      try { await login(inp.value); location.replace(location.pathname); } catch (e) { msg.textContent = e.message; go.disabled = false; }
    };
    go.onclick = run;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  }

  // ծանուցումներ (db\0014. նույն push-ը, ինչ տիրոջ հավելվածում)
  const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const needHome = () => /iP(hone|ad|od)/.test(navigator.userAgent) && !(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
  async function pushOn() {
    if (!pushOk()) return false;
    try { const r = await navigator.serviceWorker.getRegistration('../'); const s = r && await r.pushManager.getSubscription(); return !!s && Notification.permission === 'granted'; } catch (e) { return false; }
  }
  async function pushEnable() {
    const { data, error } = await sb.rpc('app_push');
    if (error || !data || !data.public_key) throw new Error(error ? error.message : 'բանալի չկա');
    if (await Notification.requestPermission() !== 'granted') throw new Error('Թույլտվություն չտրվեց');
    const k = data.public_key.replace(/-/g, '+').replace(/_/g, '/');
    const key = Uint8Array.from(atob(k + '='.repeat((4 - k.length % 4) % 4)), (c) => c.charCodeAt(0));
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, rj) => setTimeout(() => rj(new Error('service worker չկա')), 10000))]);
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const j = sub.toJSON();
    const r = await sb.rpc('app_push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent });
    if (r.error) throw new Error(r.error.message);
  }
  async function pushBar() {
    const bar = document.getElementById('pushbar');
    if (!bar || await pushOn()) { if (bar) bar.innerHTML = ''; return; }
    if (needHome()) { bar.innerHTML = '<div class="wa-push">Ծանուցումների համար՝ Safari-ում «Կիսվել» → «Ավելացնել գլխավոր էկրանին», հետո բացեք այնտեղից։</div>'; return; }
    if (!pushOk() || Notification.permission === 'denied') { bar.innerHTML = ''; return; }
    bar.innerHTML = '<div class="wa-push">Միացրեք ծանուցումները, որ ղեկավարի նամակը միանգամից տեսնեք։<button type="button" id="pon">Միացնել</button></div>';
    document.getElementById('pon').onclick = async (e) => { e.target.disabled = true; try { await pushEnable(); bar.innerHTML = ''; } catch (er) { e.target.disabled = false; alert('Չստացվեց՝ ' + er.message); } };
  }

  // ── «Չատեր» (WhatsApp-ի «Чаты»-ի պես, Գարիկ 05.11. վերևի տեսախցիկ/+ և ներքևի ներդիրներ՝ ոչ). հիմա մեկ զրույց՝ ղեկավարի հետ ──
  const CHAT = { name: 'HayWay', status: 'ղեկավարություն', av: { img: '../icon.svg?v=9' } };
  let filter = 'all', query = '', listTimer = 0;
  async function showList(me) {
    clearTimeout(listTimer);
    const [T, M, W] = await Promise.all([sb.rpc('team_thread', { p_staff: null, p_after: 0 }), sb.rpc('team_me'), sb.rpc('staff_wa_list')]);
    if (T.error) throw new Error(T.error.message);
    WA = W.error ? null : W.data;   // null = այս աշխատակցին WhatsApp-ը միացված չէ (sync_state wa_staff)
    const msgs = (T.data.msgs || []).filter((m) => m.who !== 'sys'), lastM = msgs[msgs.length - 1];
    const unread = (M.data && M.data.unread) || 0;
    app.classList.add('wa', 'wa-white');
    if (!document.getElementById('walist')) {
      app.innerHTML = `<div class="wa-list" id="walist"><h1>Չատեր</h1>
        <label class="wa-search">${HWTeam.IC.search}<input id="wsq" type="search" placeholder="Որոնում" autocomplete="off"></label>
        <div class="wa-chips"><button type="button" class="wa-chip" data-f="all">Բոլորը</button><button type="button" class="wa-chip" data-f="unread">Չկարդացած</button></div>
        <div id="pushbar"></div><div id="warows"></div></div>`;
      document.getElementById('wsq').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); showList(me); });
      app.querySelectorAll('.wa-chip').forEach((c) => c.onclick = () => { filter = c.dataset.f; showList(me); });
      pushBar();
    }
    app.querySelectorAll('.wa-chip').forEach((c) => c.classList.toggle('on', c.dataset.f === filter));
    const prev = !lastM ? 'Այստեղ ձեզ կգրի ղեկավարը' : (lastM.who === 'staff' ? HWTeam.ticks(T.data.other_read >= lastM.id) : '') + esc(lastM.text.replace(/\s+/g, ' '));
    const hay = (CHAT.name + ' ' + msgs.map((m) => m.text).join(' ')).toLowerCase();
    const show = (filter === 'all' || unread > 0) && (!query || hay.includes(query));
    document.getElementById('warows').innerHTML = show
      ? `<button type="button" class="wa-row${unread ? ' unread' : ''}" id="openchat">${HWTeam.avatar(CHAT.av, 52)}<span class="wa-row-b">
          <span class="wa-row-l"><b>${esc(CHAT.name)}</b><time>${lastM ? HWTeam.listTime(lastM.at) : ''}</time></span>
          <span class="wa-row-p"><span>${prev}</span>${unread ? `<i class="wa-n">${unread}</i>` : ''}</span></span></button>`
      : `<p style="padding:24px 16px;text-align:center;color:#667781">${filter === 'unread' ? 'Չկարդացած նամակ չկա' : 'Ոչինչ չգտնվեց'}</p>`;
    if (WA) {
      const n = WA.items.length, nw = WA.items.filter((x) => x.left_min < 120).length;
      const prevW = n ? `${n} նոր հարց${nw ? ` · ${nw}-ը շտապ է` : ''}` : 'Բոլորին պատասխանել ես';
      const showW = (filter === 'all' || n > 0) && (!query || ('հաճախորդների հարցեր whatsapp ' + WA.items.map((x) => x.name + ' ' + x.question).join(' ')).toLowerCase().includes(query));
      if (showW) {
        const rows = document.getElementById('warows');
        if (rows.querySelector('p')) rows.innerHTML = '';
        rows.insertAdjacentHTML('afterbegin', `<button type="button" class="wa-row${n ? ' unread' : ''}" id="openwa"><span class="wa-av wq-av" style="width:52px;height:52px">${WQ_IC.chat}</span><span class="wa-row-b">
          <span class="wa-row-l"><b>Հաճախորդների հարցեր</b><time>${n ? HWTeam.listTime(WA.items[n - 1].at) : ''}</time></span>
          <span class="wa-row-p"><span>${esc(prevW)}</span>${n ? `<i class="wa-n">${n}</i>` : ''}</span></span></button>`);
        document.getElementById('openwa').onclick = () => { history.pushState({ wa: 1 }, '', '#wa'); showWA(me); };
      }
    }
    const o = document.getElementById('openchat');
    if (o) o.onclick = () => { history.pushState({ chat: 1 }, '', '#chat'); showChat(me); };
    listTimer = setTimeout(() => { if (document.getElementById('walist') && document.visibilityState === 'visible') showList(me).catch(() => {}); else if (document.getElementById('walist')) listTimer = setTimeout(() => showList(me).catch(() => {}), 4000); }, 6000);
  }

  async function showChat(me) {
    clearTimeout(listTimer);
    const T = await sb.rpc('team_thread', { p_staff: null, p_after: 0 });
    if (T.error) throw new Error(T.error.message);
    app.classList.add('wa');
    app.classList.remove('wa-white');
    app.innerHTML = HWTeam.screen({ back: null, name: CHAT.name, status: CHAT.status, av: CHAT.av, placeholder: 'Նամակ', more: true });
    document.getElementById('wa-back').onclick = () => history.back();
    HWTeam.start({ sb, staff: null, el: document.getElementById('tthread'), sc: document.getElementById('sc'), q: document.getElementById('q'),
      send: document.getElementById('send'), first: T.data, alive: () => !!document.getElementById('tthread'),
      empty: `<div class="wa-empty"><h3>Բարև${me.name ? ', ' + esc(me.name) : ''}</h3><span class="note">Այստեղ կստանաք ձեր գործերը։ Հարց ունեք՝ գրեք նույն տեղում։</span></div>` });
  }
  // ── «Հաճախորդների հարցեր» (08.11, db\0043. Գարիկ. «արամի ուղացը մի անգամից գնա հաճախորդին», «հնարավորինս պարզ»)։
  // Մեկ հարց էկրանին (ամենաշտապը առաջինը), պատասխանը արդեն գրված է ու ուղղվում է հենց տեղում, «Ուղարկել»-ը՝ ներքևում (բթամատի գոտի, 52px),
  // հաստատման պատուհան չկա՝ փոխարենը «Չեղարկել» (ուղարկողը սպասում է 8 վրկ)։ Ուղղածից համակարգը սովորում է (wa_lessons)։
  const WQ_IC = {
    chat: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/></svg>',
    send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 20 4l-4 16-4-7z"/><path d="m12 13 8-9"/></svg>',
    ok: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  };
  let WA = null, waTimer = 0, toastTimer = 0;
  const leftL = (m) => m >= 120 ? `մնաց ${Math.floor(m / 60)} ժ` : m > 0 ? `մնաց ${m} ր` : 'ժամկետն անցնում է';
  async function waLoad() { const W = await sb.rpc('staff_wa_list'); if (W.error) throw new Error(W.error.message); WA = W.data; return WA; }
  function toast(text, undo) {
    clearTimeout(toastTimer);
    const old = document.getElementById('wqt'); if (old) old.remove();
    app.insertAdjacentHTML('beforeend', `<div class="wq-toast" id="wqt" role="status"><span>${esc(text)}</span>${undo ? '<button type="button" id="wqu">Չեղարկել</button>' : ''}</div>`);
    if (undo) document.getElementById('wqu').onclick = undo;
    toastTimer = setTimeout(() => { const el = document.getElementById('wqt'); if (el) el.remove(); }, undo ? 8000 : 3500);
  }
  async function showWA(me, keepToast) {
    clearTimeout(listTimer); clearTimeout(waTimer);
    if (!keepToast) { const t0 = document.getElementById('wqt'); if (t0) t0.remove(); }
    await waLoad();
    const toastEl = document.getElementById('wqt');
    app.classList.add('wa'); app.classList.remove('wa-white');
    const items = WA.items, it = items[0];
    const head = `<div class="wa-top"><div class="wa-top-in"><button type="button" class="wa-back" id="wa-back" aria-label="Հետ">${HWTeam.IC.back}</button>`
      + `<span class="wa-av wq-av" style="width:36px;height:36px">${WQ_IC.chat.replace(/"26"/g, '"20"')}</span><span class="wa-who"><b>Հաճախորդների հարցեր</b>`
      + `<small>${items.length ? (items.length === 1 ? 'մեկ հարց' : `1 / ${items.length}`) : 'բոլորին պատասխանել ես'}</small></span></div></div>`;
    const keep = () => { if (toastEl && !document.getElementById('wqt')) app.appendChild(toastEl); };
    if (!it) {
      app.innerHTML = head + `<div class="wa-scroll" id="sc"><div class="wq"><div class="wq-empty"><i>${WQ_IC.ok}</i><h3>Բոլոր հարցերին պատասխանել ես</h3>`
        + `<span>${WA.drafting ? `Համակարգը պատրաստում է ևս ${WA.drafting} պատասխան։` : 'Նոր հարց գալիս՝ ծանուցում կստանաս։'}</span></div></div></div>`;
      keep();
      document.getElementById('wa-back').onclick = () => history.back();
      waTimer = setTimeout(() => { if (location.hash === '#wa' && !document.getElementById('wqx')) showWA(me, true).catch(() => {}); }, 15000);
      return;
    }
    const hist = it.history || [];
    const bub = (dir, text, old) => `<div class="wa-msg ${dir === 'in' ? 'in' : 'out'} tail${old ? ' old' : ''}">${esc(text)}</div>`;
    app.innerHTML = head + `<div class="wa-scroll" id="sc"><div class="wq">
        <div class="wq-head"><span class="wa-av" style="width:40px;height:40px;font-size:17px">${esc(it.name.trim().charAt(0).toUpperCase() || '?')}</span><b>${esc(it.name)}</b>`
        + `<span class="wq-left${it.left_min < 120 ? ' soon' : ''}">${leftL(it.left_min)}</span></div>`
        + (hist.length ? `<button type="button" class="wq-hist" id="wqh">Նախորդ նամակները (${hist.length})</button><div id="wqhb" hidden>${hist.map((m) => bub(m.dir, m.text, true)).join('')}</div>` : '')
        + bub('in', it.question)
        + (it.answered ? '<div class="wq-note">Այս հարցին արդեն պատասխանել են հեռախոսից։ Եթե էլ պետք չէ, սեղմիր «Բաց թողնել»։</div>' : '')
        + (it.ask ? `<div class="wq-note warn">Համակարգը սա լրիվ չգիտի. ${esc(it.ask)}${/[։.?!՞]$/.test(it.ask.trim()) ? '' : '։'}<br>Գրիր ճիշտ պատասխանը՝ ներքևում։</div>` : '')
        + `<label class="wq-lab" for="wqx">Պատասխանը</label>
        <textarea class="wq-text" id="wqx" rows="4" enterkeyhint="enter" spellcheck="true">${esc(it.draft)}</textarea>
        <div class="wq-hint" id="wqm" aria-live="polite"></div>
      </div></div>
      <div class="wq-bar"><button type="button" class="wq-btn skip" id="wqs">Բաց թողնել</button><button type="button" class="wq-btn send" id="wqo">${WQ_IC.send}Ուղարկել</button></div>`;
    keep();
    document.getElementById('wa-back').onclick = () => history.back();
    const x = document.getElementById('wqx'), hint = document.getElementById('wqm'), sc = document.getElementById('sc');
    const grow = () => { x.style.height = 'auto'; x.style.height = Math.max(120, x.scrollHeight + 4) + 'px'; };
    const paintHint = () => {
      const edited = x.value.trim() !== it.draft.trim();
      x.classList.remove('bad');
      hint.className = 'wq-hint' + (edited ? ' edited' : '');
      hint.innerHTML = edited ? 'Ուղղել ես. համակարգը կսովորի սրանից։ <button type="button" id="wqr">Վերադարձնել</button>' : 'Ստուգիր. պետք է՝ ուղղիր, հետո «Ուղարկել»։';
      const r = document.getElementById('wqr'); if (r) r.onclick = () => { x.value = it.draft; grow(); paintHint(); };
    };
    grow(); paintHint();
    x.addEventListener('input', () => { grow(); paintHint(); });
    x.addEventListener('focus', () => setTimeout(() => x.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300));
    const h = document.getElementById('wqh');
    if (h) h.onclick = () => { const b = document.getElementById('wqhb'); b.hidden = !b.hidden; h.textContent = b.hidden ? `Նախորդ նամակները (${hist.length})` : 'Թաքցնել նախորդը'; };
    const btnO = document.getElementById('wqo'), btnS = document.getElementById('wqs');
    let busy = false;
    const act = async (kind) => {
      if (busy) return;
      const text = x.value.trim();
      if (kind === 'send' && !text) { x.classList.add('bad'); hint.className = 'wq-hint bad'; hint.textContent = 'Գրիր պատասխանը, հետո «Ուղարկել»։'; x.focus(); return; }
      busy = true; (kind === 'send' ? btnO : btnS).setAttribute('aria-busy', 'true');
      const edited = text !== it.draft.trim();
      const r = kind === 'send' ? await sb.rpc('staff_wa_send', { p_id: it.id, p_text: text }) : await sb.rpc('staff_wa_skip', { p_id: it.id });
      busy = false; btnO.removeAttribute('aria-busy'); btnS.removeAttribute('aria-busy');
      if (r.error) { hint.className = 'wq-hint bad'; hint.textContent = 'Չստացվեց՝ ' + r.error.message + '. Փորձիր նորից։'; return; }
      const st = r.data && r.data.status;
      if (st === 'expired') { toast('Ժամկետն անցել էր. WhatsApp-ը 24 ժամից հետո պատասխանել թույլ չի տալիս։'); return showWA(me, true); }
      if (st !== 'approved' && st !== 'rejected') { toast('Այս հարցին արդեն պատասխանել են։'); return showWA(me, true); }
      const undo = async () => {
        const u = await sb.rpc('staff_wa_undo', { p_id: it.id });
        const t1 = document.getElementById('wqt'); if (t1) t1.remove();
        if (u.error || !u.data || !u.data.undone) { toast('Արդեն ուղարկված է, չեղարկել չի ստացվում։'); return; }
        toast('Չեղարկվեց'); showWA(me, true).catch(() => {});
      };
      toast(kind === 'send' ? `Ուղարկվեց${edited ? ' · համակարգը կսովորի' : ''}` : 'Բաց թողնվեց', undo);
      showWA(me, true).catch(() => {});
    };
    btnO.onclick = () => act('send');
    btnS.onclick = () => act('skip');
    // նոր հարցերը՝ ինքնաբերաբար, բայց ոչ երբ Արամը գրում կամ ուղղում է
    waTimer = setTimeout(function tick() {
      if (location.hash !== '#wa' || !document.getElementById('wqx')) return;
      if (document.activeElement === x || x.value.trim() !== it.draft.trim()) { waTimer = setTimeout(tick, 15000); return; }
      waLoad().then(() => { const top = WA.items[0]; if (!top || top.id !== it.id || top.draft !== it.draft) showWA(me, true); else waTimer = setTimeout(tick, 15000); })
        .catch(() => { waTimer = setTimeout(tick, 15000); });
    }, 15000);
    sc.scrollTop = 0;
  }

  // «Հետ»-ը (կոճակը, iPhone-ի սահեցնելը)՝ «Չատեր»
  const route = () => (location.hash === '#chat' ? showChat(ME) : location.hash === '#wa' && WA !== null ? showWA(ME) : showList(ME));
  window.addEventListener('popstate', () => { if (ME) route().catch(() => {}); });
  // ծանուցումից (sw.js postMessage) → «Հաճախորդների հարցեր»
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => {
    const go = e.data && e.data.go;
    if (ME && WA !== null && go && String(go).includes('#wa')) { history.pushState({ wa: 1 }, '', '#wa'); showWA(ME).catch(() => {}); }
  });
  let ME = null;

  async function boot() {
    const m = (location.hash || '').match(/^#c([A-Za-z0-9-]{6,14})/);
    if (m) {
      history.replaceState(null, '', location.pathname);   // կոդը հասցեում չմնա
      app.innerHTML = '<div class="loading"><span class="spin"></span></div>';
      try { await login(m[1]); } catch (e) { return showLogin(e.message); }
      // setSession-ից անմիջապես հետո նույն client-ը կախվում էր (ստուգված 05.11) → session-ը պահված է, էջը բացում ենք նորից
      return location.replace(location.pathname);
    }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showLogin();
    const { data: me, error } = await sb.rpc('team_me');
    if (error) { await sb.auth.signOut(); return showLogin('Մուտքը փակված է. խնդրեք նոր հրավեր'); }
    if (me.role !== 'staff') { location.replace('../#/team'); return; }   // տերը՝ իր հավելվածի «Թիմ»
    ME = me;
    if (location.hash === '#chat') history.replaceState(null, '', location.pathname);
    const wantWA = location.hash === '#wa';
    try { await showList(me); if (wantWA && WA) await showWA(me); else if (wantWA) history.replaceState(null, '', location.pathname); } catch (e) { app.innerHTML = `<div class="login"><p class="msgline">${esc(e.message)}</p><button class="btn pri" onclick="location.reload()">Նորից</button></div>`; }
  }
  boot();
})();
