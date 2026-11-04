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
  function syncViewport() {
    const v = window.visualViewport;
    if (!v) return;
    root.style.setProperty('--vvh', v.height + 'px');
    root.style.setProperty('--vv-top', v.offsetTop + 'px');
    document.body.classList.toggle('kb', window.innerHeight - v.height > 120);
  }
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', syncViewport); window.visualViewport.addEventListener('scroll', syncViewport); }
  document.addEventListener('focusout', () => setTimeout(() => { window.scrollTo(0, 0); syncViewport(); }, 150));
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
    const [T, M] = await Promise.all([sb.rpc('team_thread', { p_staff: null, p_after: 0 }), sb.rpc('team_me')]);
    if (T.error) throw new Error(T.error.message);
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
    app.innerHTML = HWTeam.screen({ back: null, name: CHAT.name, status: CHAT.status, av: CHAT.av, placeholder: 'Նամակ' });
    document.getElementById('wa-back').onclick = () => history.back();
    HWTeam.start({ sb, staff: null, el: document.getElementById('tthread'), sc: document.getElementById('sc'), q: document.getElementById('q'),
      send: document.getElementById('send'), first: T.data, alive: () => !!document.getElementById('tthread'),
      empty: `<div class="wa-empty"><h3>Բարև${me.name ? ', ' + esc(me.name) : ''}</h3><span class="note">Այստեղ ձեզ կգրի ղեկավարը։ Պատասխանեք նույն տեղում։</span></div>` });
  }
  // «Հետ»-ը (կոճակը, iPhone-ի սահեցնելը)՝ «Չատեր»
  window.addEventListener('popstate', () => { if (ME) (location.hash === '#chat' ? showChat(ME) : showList(ME)).catch(() => {}); });
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
    try { await showList(me); } catch (e) { app.innerHTML = `<div class="login"><p class="msgline">${esc(e.message)}</p><button class="btn pri" onclick="location.reload()">Նորից</button></div>`; }
  }
  boot();
})();
