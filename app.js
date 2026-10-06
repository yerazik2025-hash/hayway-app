/* HayWay տիրոջ հավելված — առաջին կենդանի տարբերակ (Supabase + Fleet API)։
   Էկրաններ՝ Գլխավոր, Գործեր, Գարիկ (շուտով), Բաժիններ, Կարգավորումներ, Վարորդներ, Որակ, Ֆինանսներ, Պայմաններ։ */
(function () {
  'use strict';
  const CFG = window.GARIK_CONFIG || {};
  const sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const app = document.getElementById('app');
  const cache = {};

  // ───────── Օգնական ֆունկցիաներ ─────────
  const fmt = (n, d = 0) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: d }).replace(/ /g, ' ');
  const amd = (n) => fmt(n) + ' ֏';
  const short = (n) => { n = Number(n || 0); if (Math.abs(n) >= 1e6) return fmt(n / 1e6, 2) + ' մլն ֏'; if (Math.abs(n) >= 1e3) return fmt(n / 1e3) + ' հազ. ֏'; return amd(n); };
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
  const delta = (cur, prev) => { if (!prev) return ''; const d = Math.round((cur - prev) / prev * 100); if (!d) return `<span class="sm mut">0%</span>`; return d > 0 ? `<span class="sm up">↑ ${d}%</span>` : `<span class="sm down">↓ ${Math.abs(d)}%</span>`; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAYS = ['Կիր', 'Երկ', 'Երք', 'Չրք', 'Հնգ', 'Ուրբ', 'Շբթ'];
  const MONTHS = ['հունվարի', 'փետրվարի', 'մարտի', 'ապրիլի', 'մայիսի', 'հունիսի', 'հուլիսի', 'օգոստոսի', 'սեպտեմբերի', 'հոկտեմբերի', 'նոյեմբերի', 'դեկտեմբերի'];
  const dayName = (iso) => DAYS[new Date(iso + 'T12:00:00').getDay()];
  const dmy = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const ago = (iso) => { if (!iso) return '—'; const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 60) return `${m} ր առաջ`; const h = Math.round(m / 60); if (h < 48) return `${h} ժ առաջ`; return `${Math.round(h / 24)} օր առաջ`; };
  const initials = (f, l) => ((f || '')[0] || '') + ((l || '')[0] || '');
  const name = (d) => `${d.first_name || ''} ${d.last_name ? d.last_name[0] + '.' : ''}`.trim() || 'Առանց անվան';
  const phone = (d) => (d.phones && d.phones[0]) ? d.phones[0] : '';
  const today = () => { const d = new Date(Date.now() + 4 * 3600e3); return d.toISOString().slice(0, 10); };

  const I = {
    home: '<svg class="i" width="24" height="24" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>',
    tasks: '<svg class="i" width="24" height="24" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 13 2 2 4-4"/></svg>',
    star: '<svg class="i" width="26" height="26" viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
    grid: '<svg class="i" width="24" height="24" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    cfg: '<svg class="i" width="24" height="24" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    back: '<svg class="i" width="24" height="24" viewBox="0 0 24 24" style="stroke-width:2.2"><path d="m15 5-7 7 7 7"/></svg>',
    call: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
    chev: '<svg class="i" width="18" height="18" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
    refresh: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg>',
    users: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M18 15c2.5.5 4 2.5 4 6"/></svg>',
    userplus: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M19 8v6M16 11h6"/></svg>',
    quality: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/></svg>',
    money: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h12v3"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.3"/></svg>',
    percent: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>',
    mega: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><path d="M3 10v4h4l8 5V5L7 10z"/><path d="M18 9a4 4 0 0 1 0 6"/></svg>',
    chat: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    box: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>',
    bell: '<svg class="i" width="22" height="22" viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
    trophy: '<svg class="i" width="18" height="18" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 6h3v1a3 3 0 0 1-3 3M7 6H4v1a3 3 0 0 0 3 3"/></svg>',
    logo: '<svg width="36" height="36" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#2D2D2D"/><path d="M16 6.5c-4 0-7 3-7 6.8 0 4.9 7 12.2 7 12.2s7-7.3 7-12.2c0-3.8-3-6.8-7-6.8z" fill="#F7DF4B"/><circle cx="16" cy="13.2" r="2.9" fill="#2D2D2D"/></svg>',
  };

  // ───────── Տվյալներ ─────────
  async function rpc(fn, args, key) {
    key = key || fn + JSON.stringify(args || {});
    if (cache[key] && Date.now() - cache[key].t < 60000) return cache[key].v;
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) throw new Error(error.message);
    cache[key] = { t: Date.now(), v: data };
    return data;
  }
  function invalidate() { for (const k in cache) delete cache[k]; }

  // ───────── Երթուղավորում ─────────
  const routes = {};
  function route(path, fn) { routes[path] = fn; }
  function go(path) { location.hash = '#' + path; }
  async function render() {
    const session = (await sb.auth.getSession()).data.session;
    if (!session) return renderLogin();
    const path = (location.hash || '#/').slice(1).split('?')[0];
    const [, seg = '', arg = ''] = path.split('/');
    const fn = routes['/' + seg] || routes['/'];
    app.innerHTML = '<div class="loading">Բեռնվում է…</div>';
    try { await fn(arg); window.scrollTo(0, 0); }
    catch (e) {
      const msg = String(e.message || e);
      app.innerHTML = shell('Սխալ', `<div class="main"><div class="err">${esc(msg === 'no access' ? 'Այս փոստը հավելվածի մուտքի ցուցակում չէ։' : msg)}</div><button class="btn o" id="signout">Դուրս գալ</button></div>`, 'home');
      document.getElementById('signout').onclick = () => sb.auth.signOut().then(render);
    }
  }
  window.addEventListener('hashchange', render);
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') { invalidate(); render(); } });

  // ───────── Շրջանակ՝ վերնագիր + ներքևի ընտրացանկ ─────────
  function nav(active, pending) {
    const b = (k, href, icon, label, extra = '') => `<a class="nv ${active === k ? 'on' : ''}" href="${href}"><span style="position:relative;display:flex">${icon}${extra}</span><span>${label}</span></a>`;
    return `<nav class="nav">
      ${b('home', '#/', I.home, 'Գլխավոր')}
      ${b('tasks', '#/tasks', I.tasks, 'Գործեր', pending ? `<span class="badge">${pending}</span>` : '')}
      <a class="nv ${active === 'garik' ? 'on' : ''}" href="#/garik"><span class="fab">${I.star}</span><span>Գարիկ</span></a>
      ${b('sections', '#/sections', I.grid, 'Բաժիններ')}
      ${b('settings', '#/settings', I.cfg, 'Կարգավորում')}
    </nav>`;
  }
  function shell(title, body, active, opts = {}) {
    const back = opts.back ? `<a class="back" href="${opts.back}" aria-label="Հետ">${I.back}</a>` : '';
    const sub = opts.sub ? `<span class="sub">${opts.sub}</span>` : '';
    const right = opts.right || `<button class="hbtn" id="refresh" aria-label="Թարմացնել">${I.refresh}</button>`;
    return `<header class="hdr">${back}${opts.logo ? I.logo : ''}<div class="col"><h1>${title}</h1>${sub}</div>${right}</header>${body}${nav(active, opts.pending)}`;
  }
  function wire() {
    const r = document.getElementById('refresh');
    if (r) r.onclick = () => { invalidate(); render(); };
  }

  // ───────── Մուտք ─────────
  async function renderLogin() {
    app.innerHTML = `<div class="login">
      <div class="logo">${I.logo}<div><h1>HayWay</h1><p>Տիրոջ հավելված</p></div></div>
      <div class="box">
        <label for="email" class="sm mut">Էլ. փոստ</label>
        <input id="email" class="in" type="email" inputmode="email" autocomplete="username" placeholder="name@gmail.com">
        <label for="pw" class="sm mut">Գաղտնաբառ</label>
        <input id="pw" class="in" type="password" autocomplete="current-password" placeholder="••••••••">
        <button class="btn y" id="login">Մտնել</button>
        <button class="btn o" id="send">Առանց գաղտնաբառի՝ կոդ փոստով</button>
        <div id="otpbox" style="display:none;flex-direction:column;gap:8px">
          <label for="otp" class="sm mut">Կոդը նամակից (6 նիշ)</label>
          <input id="otp" class="in" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="123456">
          <button class="btn" id="verify">Մտնել կոդով</button>
        </div>
        <div id="msg" class="sm mut"></div>
      </div>
      <p>Գաղտնաբառը դրվում է հավելվածի Կարգավորումներում՝ առաջին մուտքից հետո։ Փոստով հղումը բացիր հենց այս հեռախոսում։</p>
    </div>`;
    const email = document.getElementById('email'), pw = document.getElementById('pw'), msg = document.getElementById('msg'), btn = document.getElementById('send'), lb = document.getElementById('login');
    try { email.value = localStorage.getItem('hw_email') || ''; } catch (e) {}
    const errText = (m) => m.includes('Signups not allowed') ? 'այս փոստը մուտքի ցուցակում չէ' : m.includes('Invalid login') ? 'սխալ փոստ կամ գաղտնաբառ' : m.includes('rate limit') ? 'շատ փորձ, սպասիր մեկ ժամ կամ մտիր գաղտնաբառով' : m;
    lb.onclick = async () => {
      const v = email.value.trim().toLowerCase();
      if (!v || !pw.value) { msg.textContent = 'Գրիր փոստը և գաղտնաբառը։'; return; }
      lb.disabled = true; msg.textContent = 'Մտնում ենք…';
      try { localStorage.setItem('hw_email', v); } catch (e) {}
      const { error } = await sb.auth.signInWithPassword({ email: v, password: pw.value });
      lb.disabled = false;
      if (error) msg.textContent = 'Սխալ՝ ' + errText(error.message);
    };
    pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') lb.click(); });
    btn.onclick = async () => {
      const v = email.value.trim().toLowerCase();
      if (!v) { msg.textContent = 'Գրիր փոստը։'; return; }
      btn.disabled = true; msg.textContent = 'Ուղարկվում է…';
      try { localStorage.setItem('hw_email', v); } catch (e) {}
      const { error } = await sb.auth.signInWithOtp({ email: v, options: { emailRedirectTo: location.origin + location.pathname } });
      btn.disabled = false;
      if (error) { msg.textContent = 'Սխալ՝ ' + errText(error.message); return; }
      msg.textContent = 'Ուղարկված է։ Նամակում կա 6-նիշ կոդ, գրիր այստեղ։ Ժամում առավելագույնը 2 նամակ է ուղարկվում։';
      document.getElementById('otpbox').style.display = 'flex';
    };
    document.getElementById('verify').onclick = async () => {
      const v = email.value.trim().toLowerCase(), code = document.getElementById('otp').value.trim(), vb = document.getElementById('verify');
      if (code.length < 6) { msg.textContent = 'Գրիր 6-նիշ կոդը։'; return; }
      vb.disabled = true; msg.textContent = 'Ստուգվում է…';
      const { error } = await sb.auth.verifyOtp({ email: v, token: code, type: 'email' });
      vb.disabled = false;
      if (error) msg.textContent = 'Սխալ՝ ' + (error.message.includes('expired') || error.message.includes('invalid') ? 'կոդը սխալ է կամ ժամկետն անցել է' : errText(error.message));
    };
  }

  // ───────── Գլխավոր ─────────
  route('/', async () => {
    const h = await rpc('app_home');
    const w = h.week, p = h.prev_week, g = h.gold;
    const net = (w.new || 0) - (w.churn || 0);
    const active = h.active_30d || 0;
    const days = h.days || [];
    const maxO = Math.max(1, ...days.map((d) => d.orders || 0));
    const bars = days.slice(-7).map((d) => `<div class="col1 ${d.day === today() ? 'today' : ''}"><span style="height:${Math.round((d.orders || 0) / maxO * 72)}px"></span><span>${dayName(d.day)}</span></div>`).join('');
    const d = new Date(Date.now() + 4 * 3600e3);
    const sub = `${['Կիրակի', 'Երկուշաբթի', 'Երեքշաբթի', 'Չորեքշաբթի', 'Հինգշաբթի', 'Ուրբաթ', 'Շաբաթ'][d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
    const alerts = [];
    if (w.churn > w.new) alerts.push(`<li class="row sm"><span class="pill r">Վարորդներ</span><span>Այս շաբաթ գնաց ${w.churn}, եկավ ${w.new}</span></li>`);
    if (h.debt.drivers) alerts.push(`<li class="row sm"><span class="pill a">Պարտք</span><span>${h.debt.drivers} վարորդ բացասական հաշվեկշռով՝ ${short(h.debt.total)}</span></li>`);
    alerts.push(`<li class="row sm"><span class="pill ${w.cancelled_driver / Math.max(1, w.orders + w.cancelled) > 0.15 ? 'a' : 'g'}">Որակ</span><span>Վարորդների չեղարկում՝ ${pct(w.cancelled_driver, w.orders + w.cancelled)}% այս շաբաթ</span></li>`);
    if (h.tasks_pending) alerts.push(`<li class="row sm"><span class="pill k">Գործեր</span><a href="#/tasks" style="font-weight:700">${h.tasks_pending} առաջարկ սպասում է քեզ</a></li>`);
    app.innerHTML = shell('HayWay', `<main class="main">
      <section class="card y">
        <div class="row"><span class="qi">${I.star.replace('width="26" height="26"', 'width="18" height="18"')}</span><div><h2 class="ttl" style="font-size:15px">Գարիկ</h2><span class="sm mut">այսօրվա գլխավորը</span></div></div>
        <ul class="lst" style="gap:8px">${alerts.join('')}</ul>
      </section>
      <section class="card">
        <h2 class="ttl">Կարևոր կոճակներ</h2>
        <div class="grid3">
          <a class="qa" href="#/contact"><span class="qi">${I.chat}</span>Հայտարարություն</a>
          <a class="qa" href="#/tasks">${h.tasks_pending ? `<span class="qb">${h.tasks_pending}</span>` : ''}<span class="qi">${I.tasks.replace('width="24" height="24"', 'width="18" height="18"')}</span>Հաստատել</a>
          <a class="qa" href="#/marketing"><span class="qi">${I.mega}</span>Գովազդ</a>
          <a class="qa" href="#/drivers/risk"><span class="qi">${I.call}</span>Զանգեր</a>
          <a class="qa" href="#/terms"><span class="qi">${I.trophy}</span>Մրցույթ</a>
          <a class="qa" href="#/finance"><span class="qi">${I.money}</span>Վճարումներ</a>
        </div>
      </section>
      <section class="card">
        <div class="between"><h2 class="ttl">1000-ի ճանապարհը</h2><span class="mut" style="font-size:13px;font-weight:700">${Math.round(active / 10)}%</span></div>
        <div class="row" style="align-items:baseline"><span class="big">${fmt(active)}</span><span class="sm mut">/ 1000 ակտիվ վարորդ (30 օր)</span></div>
        <div class="bar led"><span style="width:${Math.min(100, active / 10)}%"></span></div>
        <div class="row" style="flex-wrap:wrap;gap:6px"><span class="sm mut">Այս շաբաթ՝</span><span class="pill g">+${w.new} նոր</span><span class="pill r">−${w.churn} հեռացած</span><span class="sm ${net >= 0 ? 'up' : 'down'}">զուտ՝ ${net >= 0 ? '+' : ''}${net}</span></div>
        <span class="sm mut">Yandex-ի Ոսկի՝ ${g.new_50} / 80 նորեկ, որոնք արել են 50 պատվեր այս ամիս (նորեկ՝ ${g.new_month})</span>
      </section>
      <div class="grid2">
        <section class="card" style="gap:4px"><h2 class="ttl mut" style="font-size:13px;font-weight:600">Հիմա գծում</h2><span class="num" style="font-size:30px">${fmt(h.online.total)}</span><span class="sm mut">${h.online.on_order} պատվերի վրա, ${h.online.free} ազատ</span></section>
        <section class="card" style="gap:4px"><h2 class="ttl mut" style="font-size:13px;font-weight:600">Պատվերներ · շաբաթ</h2><span class="num" style="font-size:24px">${fmt(w.orders)}</span>${delta(w.orders, p.orders)}</section>
        <section class="card" style="gap:4px"><h2 class="ttl mut" style="font-size:13px;font-weight:600">Շրջանառություն · շաբաթ</h2><span class="num" style="font-size:19px">${short(w.gmv)}</span>${delta(w.gmv, p.gmv)}</section>
        <section class="card" style="gap:4px"><h2 class="ttl mut" style="font-size:13px;font-weight:600">Պարկի եկամուտ · շաբաթ</h2><span class="num" style="font-size:19px">${short(w.commission)}</span>${delta(w.commission, p.commission)}</section>
      </div>
      <section class="card">
        <div class="between"><h2 class="ttl">Պատվերներ ըստ օրերի</h2><span class="sm mut">վերջին 7 օր</span></div>
        <div class="cols" style="grid-template-columns:repeat(7,minmax(0,1fr))">${bars}</div>
      </section>
      <a class="card" href="#/sections" style="flex-direction:row;align-items:center;text-decoration:none"><div style="flex:1;display:flex;flex-direction:column;gap:7px"><span class="ttl">8 բաժին</span><div class="row" style="flex-wrap:wrap;gap:6px"><span class="pill g">5 կենդանի</span><span class="pill n">3 միանում է</span></div></div>${I.chev}</a>
      <span class="sm mut" style="text-align:center">Fleet-ից թարմացվել է ${ago(h.last_sync)}</span>
    </main>`, 'home', { logo: true, sub, pending: h.tasks_pending });
    wire();
  });

  // ───────── Բաժիններ ─────────
  route('/sections', async () => {
    const h = await rpc('app_home');
    const w = h.week;
    const sec = (href, color, icon, nm, mt, pill, ag, wide) => `<a class="sec ${wide ? 'wide' : ''}" href="${href}"><span class="tile" style="background:${color};margin-bottom:4px">${icon}</span><span class="nm">${nm}</span><span class="mt">${mt}</span>${pill}<span class="ag">${ag}</span></a>`;
    app.innerHTML = shell('Բաժիններ', `<main class="main"><div class="grid2">
      ${sec('#/marketing', '#FDBA74', I.mega, 'Մարքեթինգ', '10 ալիք · 6 գործակալ', '<span class="pill n">միանում է</span>', 'list · tiktok · meta · whatsapp · govazd · scout', true)}
      ${sec('#/leads', '#93C5FD', I.userplus, 'Հայտեր', `${w.new} նոր այս շաբաթ`, '<span class="pill n">միանում է</span>', 'Հայտերի գործակալ')}
      ${sec('#/drivers', '#FFC94A', I.users, 'Վարորդներ', `${fmt(h.active_30d)} ակտիվ`, `<span class="pill ${w.churn > w.new ? 'r' : 'g'}">${w.churn} հեռացավ</span>`, 'Պահպանող')}
      ${sec('#/contact', '#D6D3CE', I.chat, 'Կապ', `${fmt(h.working_profiles)} վարորդ Fleet-ում`, '<span class="pill n">միանում է</span>', 'Կապի գործակալ')}
      ${sec('#/quality', '#C4B5FD', I.quality, 'Որակ', `${pct(w.orders, w.orders + w.cancelled)}% պատվեր ավարտվում է`, `<span class="pill a">չեղարկում՝ ${pct(w.cancelled_driver, w.orders + w.cancelled)}%</span>`, 'Որակի վերահսկիչ')}
      ${sec('#/finance', '#86EFAC', I.money, 'Ֆինանսներ', `${short(w.commission)} · շաբաթ`, delta(w.commission, h.prev_week.commission) || '<span class="pill n">—</span>', 'Ֆինանսիստ')}
      ${sec('#/terms', '#FDA4AF', I.percent, 'Պայմաններ', 'կոմիսիայի խմբեր', '<span class="pill g">կենդանի</span>', 'Պայմանների խորհրդատու')}
      ${sec('#/delivery', '#5EEAD4', I.box, 'Առաքում', 'HayWay Delivery', '<span class="pill n">առանձին մուտք</span>', 'Առաքման մենեջեր', true)}
    </div></main>`, 'sections', { pending: h.tasks_pending });
    wire();
  });

  // ───────── Վարորդներ ─────────
  const SEGS = [['active', 'Ակտիվ'], ['top', 'Լավագույն 30'], ['risk', 'Վտանգի գոտում'], ['new', 'Նորեկներ'], ['churned', 'Հեռացած'], ['debt', 'Պարտքով'], ['cancellers', 'Չեղարկողներ']];
  const SEG_DESC = {
    active: 'Վերջին 30 օրում ≥1 ավարտված պատվեր։ Ըստ այս շաբաթվա պատվերների։',
    top: '30 վարորդ, որոնք ամենաշատ պատվերն են արել վերջին 30 օրում։ Կոմիսիան փոխելուց առաջ նրանց զանգում ենք անձամբ։',
    risk: 'Աշխատում էին (10+ պատվեր 30 օրում), բայց 5+ օր պարապ են։ Սրանք կորցնելուց առաջ վերջին հնարավորությունն են։',
    new: 'Գրանցվել են վերջին 30 օրում։ Նրանց առաջին շաբաթը 0% է։',
    churned: 'Վերջին պատվերը 10–90 օր առաջ։ Պարզապես դադարել են աշխատել, զանգը նրանց վերադարձնում է։',
    debt: 'Բացասական հաշվեկշիռ։ Լիցքավորելու հիշեցում է պետք։',
    cancellers: '50+ առաջարկ 30 օրում և չեղարկումների բաժինը ≥ 25%։',
  };
  route('/drivers', async (seg) => {
    seg = SEGS.some((s) => s[0] === seg) ? seg : 'active';
    const [h, rows] = await Promise.all([rpc('app_home'), rpc('app_drivers', { segment: seg })]);
    const w = h.week;
    const line = (d) => {
      let pill = '', meta = '';
      if (seg === 'active') { pill = d.current_status === 'offline' ? '<span class="pill n">անջատ</span>' : '<span class="pill g">գծում</span>'; meta = `${d.orders_7d} պատվեր այս շաբաթ · ${d.rule_pct ?? '—'}%`; }
      if (seg === 'top') { pill = `<span class="pill g">${fmt(d.orders_30d)} պատվեր</span>`; meta = `${short(d.gmv_30d)} 30 օրում · ${d.rule_pct ?? '—'}% · չեղարկում ${pct(d.cancels_30d, d.offers_30d)}%`; }
      if (seg === 'risk') { pill = `<span class="pill r">${Math.floor(d.idle_days)} օր պարապ</span>`; meta = `Նախկինում՝ ${d.orders_30d} պատվեր 30 օրում · վերջինը ${dmy(d.last_order_at)}`; }
      if (seg === 'new') { pill = `<span class="pill ${d.orders_30d ? 'g' : 'a'}">${d.orders_30d ? d.orders_30d + ' պատվեր' : '0 պատվեր'}</span>`; meta = `Գրանցվեց ${dmy(d.hire_date)} · ${d.days_since_hire} օր առաջ`; }
      if (seg === 'churned') { pill = `<span class="pill n">${Math.floor(d.idle_days)} օր</span>`; meta = `Վերջին պատվերը՝ ${dmy(d.last_order_at)} · ընդամենը ${fmt(d.orders_total)} պատվեր`; }
      if (seg === 'debt') { pill = `<span class="pill r">${amd(d.balance)}</span>`; meta = `${d.current_status === 'offline' ? 'անջատ է' : 'գծում է'} · վերջին պատվերը ${dmy(d.last_order_at)}`; }
      if (seg === 'cancellers') { pill = `<span class="pill r">${pct(d.cancels_30d, d.offers_30d)}%</span>`; meta = `${d.cancels_30d} չեղարկում ${d.offers_30d} առաջարկից · ${d.orders_30d} ավարտված`; }
      const tel = phone(d);
      return `<li class="li"><span class="av">${esc(initials(d.first_name, d.last_name))}</span><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><div class="row" style="flex-wrap:wrap;gap:6px"><span style="font-size:14px;font-weight:600">${esc(name(d))}</span>${pill}</div><span class="sm mut">${esc(meta)}</span></div>${tel ? `<a class="call" href="tel:${esc(tel)}" aria-label="Զանգել">${I.call}</a>` : ''}</li>`;
    };
    app.innerHTML = shell('Վարորդներ', `<main class="main">
      <section class="card grid3" style="display:grid">
        <div style="display:flex;flex-direction:column;gap:2px"><span class="sm mut">Ակտիվ</span><span class="num" style="font-size:24px">${fmt(h.active_30d)}</span><span class="sm mut">նպատակ՝ 1000</span></div>
        <div style="display:flex;flex-direction:column;gap:2px"><span class="sm mut">Շաբաթ</span><span class="num" style="font-size:20px;padding-top:3px"><span class="up">+${w.new}</span> <span class="down">−${w.churn}</span></span><span class="sm mut">եկավ / գնաց</span></div>
        <div style="display:flex;flex-direction:column;gap:2px"><span class="sm mut">30 օր</span><span class="num" style="font-size:20px;padding-top:3px"><span class="up">+${h.month.new}</span> <span class="down">−${h.month.churn}</span></span><span class="sm mut">եկավ / գնաց</span></div>
      </section>
      <div class="chips">${SEGS.map(([k, l]) => `<a class="chip ${k === seg ? 'on' : ''}" href="#/drivers/${k}">${l}${k === seg ? ' · ' + rows.length : ''}</a>`).join('')}</div>
      <section class="card" style="gap:0"><p class="sm mut" style="margin:0 0 4px">${SEG_DESC[seg]}</p>
        <ul class="lst">${rows.length ? rows.map(line).join('') : '<li class="empty">Այս խմբում հիմա ոչ ոք չկա։</li>'}</ul></section>
    </main>`, 'sections', { back: '#/sections', sub: `<span class="dot" style="background:#4ADE80"></span>Պահպանող · տվյալները Fleet-ից`, pending: h.tasks_pending });
    wire();
  });

  // ───────── Որակ ─────────
  route('/quality', async () => {
    const [h, q] = await Promise.all([rpc('app_home'), rpc('app_quality')]);
    const d30 = q.d30, d7 = q.d7;
    const comp30 = pct(d30.completed, d30.total), comp7 = pct(d7.completed, d7.total);
    const g = h.gold;
    const canc = (q.top_cancellers || []).slice(0, 5).map((d) => `<li class="li"><span class="av">${esc(initials(d.first_name, d.last_name))}</span><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">${esc(name(d))}</div><div class="sm mut">${d.cancels} չեղարկում ${d.offers} առաջարկից</div></div><span class="pill r">${d.pct}%</span></li>`).join('');
    app.innerHTML = shell('Որակ', `<main class="main">
      <section class="card">
        <h2 class="ttl mut" style="font-weight:600;font-size:13px">Ավարտված պատվերներ · 30 օր</h2>
        <div class="row" style="align-items:baseline"><span class="big">${comp30}%</span><span class="sm mut">${fmt(d30.total)} առաջարկ → ${fmt(d30.completed)} ավարտված</span></div>
        <div class="bar led"><span style="width:${comp30}%"></span></div>
        <div class="row" style="flex-wrap:wrap;gap:6px"><span class="pill r">վարորդի չեղարկում՝ ${pct(d30.by_driver, d30.total)}%</span><span class="pill a">ուղևորի՝ ${pct(d30.by_passenger, d30.total)}%</span><span class="pill n">այս շաբաթ՝ ${comp7}% ավարտված</span></div>
      </section>
      <section class="card">
        <h2 class="ttl">Ով է չեղարկում</h2>
        <div class="row" style="align-items:baseline;flex-wrap:wrap;gap:6px"><span class="num" style="font-size:20px">${q.half_cancellers} վարորդ</span><span class="sm mut">(${pct(q.half_cancellers, q.drivers_with_cancels)}%) անում է վարորդների չեղարկումների</span><span class="num" style="font-size:20px;color:var(--red)">կեսը</span></div>
        <ul class="lst">${canc || '<li class="empty">Տվյալ չկա</li>'}</ul>
        <a class="btn" href="#/drivers/cancellers">Բոլոր չեղարկողները</a>
      </section>
      <section class="card" style="gap:6px">
        <div class="between"><h2 class="ttl">Yandex-ի մակարդակ</h2><span class="pill g">Արծաթ ✓</span></div>
        <span class="sm" style="font-weight:700;padding-top:4px">Ոսկու համար պետք է այս ամիս</span>
        <span class="sm">80 նորեկ, որոնք արել են 50 պատվեր՝ ${g.new_50} / 80</span>
        <div class="bar"><span style="width:${Math.min(100, g.new_50 / 80 * 100)}%;background:#2C5F80"></span></div>
        <span class="sm mut">Այս ամիս գրանցվել է ${g.new_month} նորեկ։ Yandex-ի ուղարկածները չեն հաշվվում։</span>
      </section>
      <section class="card" style="gap:0;padding-top:6px;padding-bottom:6px">
        <a class="row" href="#/drivers/new" style="min-height:44px;text-decoration:none"><span class="pill a">${q.new_without_orders}</span><span style="flex:1;font-size:13.5px">նորեկ առանց պատվերի (30 օր)</span>${I.chev}</a>
        <div class="row" style="min-height:44px;border-top:1px solid var(--line2)"><span class="pill n">${q.contract_issues}</span><span style="flex:1;font-size:13.5px">վարորդի պայմանագրի խնդիր Fleet-ում</span></div>
      </section>
    </main>`, 'sections', { back: '#/sections', sub: `<span class="dot" style="background:#4ADE80"></span>Որակի վերահսկիչ · Fleet-ի պատվերներից`, pending: h.tasks_pending });
    wire();
  });

  // ───────── Ֆինանսներ ─────────
  route('/finance', async () => {
    const [h, f] = await Promise.all([rpc('app_home'), rpc('app_finance')]);
    const w = f.week, p = f.prev_week, m = f.month, b = f.balances;
    const days = f.days || [];
    const maxC = Math.max(1, ...days.map((d) => d.commission || 0));
    const bars = days.slice(-7).map((d) => `<div class="col1 ${d.day === today() ? 'today' : ''}"><span style="height:${Math.round((d.commission || 0) / maxC * 72)}px"></span><span>${dayName(d.day)}</span></div>`).join('');
    const prov = (f.topups_by_provider || []).map((t) => `<div class="hr"><span>${esc(t.provider)}</span><div class="bar"><span style="width:${pct(t.sum, m.topups)}%"></span></div><b>${short(t.sum)}</b></div>`).join('');
    app.innerHTML = shell('Ֆինանսներ', `<main class="main">
      <section class="card">
        <h2 class="ttl">Այս շաբաթ</h2>
        <div class="grid2">
          <div style="display:flex;flex-direction:column;gap:2px"><span class="sm mut">Շրջանառություն</span><span class="num" style="font-size:19px">${short(w.gmv)}</span>${delta(w.gmv, p.gmv)}</div>
          <div style="display:flex;flex-direction:column;gap:2px"><span class="sm mut">Պարկի եկամուտ</span><span class="num" style="font-size:19px">${short(w.commission)}</span>${delta(w.commission, p.commission)}</div>
        </div>
        <span class="sm mut" style="padding-top:4px">Եկամուտն ըստ օրերի</span>
        <div class="cols" style="grid-template-columns:repeat(7,minmax(0,1fr))">${bars}</div>
      </section>
      <section class="card" style="gap:0">
        <h2 class="ttl" style="margin-bottom:4px">Վերջին 30 օր</h2>
        <div class="ln"><span>Շրջանառություն</span><b>${short(m.gmv)}</b></div>
        <div class="ln"><span class="mut">կանխիկ / քարտ / կորպորատիվ</span><b>${pct(m.cash, m.gmv)}% / ${pct(m.cashless, m.gmv)}% / ${pct(m.corporate, m.gmv)}%</b></div>
        <div class="ln"><span>Պարկի կոմիսիա</span><b>${short(m.commission)} (${(m.gmv ? m.commission / m.gmv * 100 : 0).toFixed(2)}%)</b></div>
        <div class="ln"><span>Վճարումներ վարորդներին</span><b>${short(m.payouts)}</b></div>
        <div class="ln"><span>Լիցքավորումներ</span><b>${short(m.topups)}</b></div>
        <div class="ln"><span>Մեկ ակտիվ վարորդից</span><b>${amd(m.active ? m.commission / m.active : 0)}</b></div>
      </section>
      <section class="card" style="gap:0">
        <h2 class="ttl" style="margin-bottom:4px">Հաշվեկշիռներ հիմա</h2>
        <div class="ln"><span>Վարորդների դրական հաշվեկշիռ</span><b>${short(b.positive)}</b></div>
        <div class="ln"><span>Պարտք (${b.negative_drivers} վարորդ)</span><b style="color:var(--red)">${short(b.negative)}</b></div>
        <a class="btn o" href="#/drivers/debt" style="margin-top:8px">Պարտքով վարորդները</a>
      </section>
      <section class="card" style="gap:6px">
        <div class="between"><h2 class="ttl">Լիցքավորումներ · 30 օր</h2><span class="sm mut">${short(m.topups)}</span></div>
        ${prov || '<span class="empty">Տվյալ չկա</span>'}
      </section>
    </main>`, 'sections', { back: '#/sections', sub: `<span class="dot" style="background:#4ADE80"></span>Ֆինանսիստ · Fleet-ի գործարքներից`, pending: h.tasks_pending });
    wire();
  });

  // ───────── Պայմաններ ─────────
  route('/terms', async () => {
    const [h, t] = await Promise.all([rpc('app_home'), rpc('app_terms')]);
    const rules = t.rules || [];
    const maxD = Math.max(1, ...rules.map((r) => r.drivers));
    const rows = rules.map((r) => `<div style="display:flex;flex-direction:column;gap:5px;padding:8px 0;border-top:1px solid var(--line2)"><div class="between"><span style="font-size:13.5px;font-weight:700">${r.pct === null ? '—' : r.pct + '%'} · ${esc(r.name.trim())}</span><span class="sm" style="font-weight:700">${fmt(r.drivers)}</span></div><div class="bar"><span style="width:${pct(r.drivers, maxD)}%"></span></div><span class="sm mut">${r.active_30d} ակտիվ · ${short(r.gmv_30d)} 30 օրում${r.is_default ? ' · նորեկների համար' : ''}</span></div>`).join('');
    const gmv = t.month_gmv || 0, cur = t.month_commission || 0;
    app.innerHTML = shell('Պայմաններ', `<main class="main">
      <section class="card" style="gap:0"><h2 class="ttl" style="margin-bottom:4px">Կոմիսիայի խմբեր · ${rules.length}</h2>${rows}</section>
      <section class="card">
        <h2 class="ttl">Ինչ կլինի, եթե…</h2>
        <span class="sm mut">Կոմիսիան բոլորի համար</span>
        <div class="between"><button class="btn o" id="dec" style="width:48px;padding:0">−</button><span class="big" id="pv">2.50%</span><button class="btn o" id="inc" style="width:48px;padding:0">+</button></div>
        <div class="between" style="padding:10px 12px;border-radius:12px;background:var(--paper)"><span style="font-size:13.5px">Ամսական կոմիսիա</span><span class="num" id="mv" style="font-size:20px"></span></div>
        <span class="sm" id="dv" style="font-weight:700"></span>
        <span class="sm mut">Հաշվարկը վերջին 30 օրվա շրջանառությամբ է՝ ${short(gmv)}, իրական կոմիսիան՝ ${short(cur)} (${(gmv ? cur / gmv * 100 : 0).toFixed(2)}%)։ Հեռացողների փոփոխությունը չի հաշվում։</span>
      </section>
      <section class="card">
        <div class="between"><h2 class="ttl">Մրցույթ · Թոփ 20</h2><span class="pill g">մինչև 22.10</span></div>
        <p class="sm mut" style="margin:0">Ամենաշատ պատվեր արած 20 վարորդը ստանում է 255 000 ֏ մրցանակ։ Ընթացիկ ցուցակը՝ Վարորդներ › Լավագույն 30։</p>
        <a class="btn" href="#/drivers/top">Տեսնել առաջատարներին</a>
      </section>
    </main>`, 'sections', { back: '#/sections', sub: `<span class="dot" style="background:#4ADE80"></span>Պայմանների խորհրդատու`, pending: h.tasks_pending });
    let p = 2.5;
    const upd = () => { const mv = gmv * p / 100, d = mv - cur; document.getElementById('pv').textContent = p.toFixed(2) + '%'; document.getElementById('mv').textContent = short(mv); const dv = document.getElementById('dv'); dv.textContent = (d >= 0 ? '+' : '−') + short(Math.abs(d)) + ' իրականի համեմատ'; dv.className = 'sm ' + (d >= 0 ? 'up' : 'down'); };
    document.getElementById('dec').onclick = () => { p = Math.max(0, +(p - 0.25).toFixed(2)); upd(); };
    document.getElementById('inc').onclick = () => { p = Math.min(5, +(p + 0.25).toFixed(2)); upd(); };
    upd(); wire();
  });

  // ───────── Գործեր ─────────
  route('/tasks', async () => {
    const h = await rpc('app_home');
    const { data: tasks, error } = await sb.from('tasks').select('*').in('status', ['pending', 'approved', 'rejected']).order('created_at', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    const pending = tasks.filter((t) => t.status === 'pending');
    const done = tasks.filter((t) => t.status !== 'pending');
    const card = (t) => `<article class="card" data-id="${t.id}"><div class="between"><span class="pill n">${esc(t.agent)}</span><span class="mut" style="font-size:12px;font-weight:600">${esc(t.cost || '')}</span></div><h2 style="margin:0;font-size:15px;font-weight:700;line-height:1.35">${esc(t.title)}</h2>${t.why ? `<p class="sm mut" style="margin:0">${esc(t.why)}</p>` : ''}
      ${t.status === 'pending' ? `<div class="row"><button class="btn y" style="flex:1" data-act="approve">Հաստատել</button><button class="btn o" style="flex:1" data-act="reject">Մերժել</button></div>` : `<div class="between"><span class="pill ${t.status === 'approved' ? 'g' : 'n'}">${t.status === 'approved' ? 'Հաստատված է' : 'Մերժված է'} · ${dmy(t.decided_at)}</span><button class="btn o" style="padding:0 12px;font-size:12.5px" data-act="undo">Չեղարկել</button></div>`}</article>`;
    app.innerHTML = shell('Գործեր', `<main class="main">
      <h2 class="ttl">Սպասում են քեզ · ${pending.length}</h2>
      ${pending.length ? pending.map(card).join('') : `<section class="card"><p class="sm mut" style="margin:0">Առաջարկ դեռ չկա։ Գործակալները (Պահպանող, Ֆինանսիստ, Մարքեթոլոգ) միանում են հաջորդ քայլում և իրենց առաջարկները կդնեն այստեղ։ Մինչ այդ զանգերի ցուցակները՝ Վարորդներ բաժնում։</p><a class="btn" href="#/drivers/risk">Ում զանգել այսօր</a></section>`}
      ${done.length ? `<h2 class="ttl" style="margin-top:6px">Որոշված</h2>${done.map(card).join('')}` : ''}
    </main>`, 'tasks', { sub: 'Գործակալները պատրաստում են, դու որոշում ես', pending: pending.length });
    app.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      const { error } = await sb.rpc('app_task_decide', { task_id: b.closest('[data-id]').dataset.id, decision: b.dataset.act });
      if (error) alert('Սխալ՝ ' + error.message);
      invalidate(); render();
    });
    wire();
  });

  // ───────── Գարիկ (զրույց) ─────────
  route('/garik', async () => {
    const h = await rpc('app_home');
    const w = h.week;
    app.innerHTML = shell('Գարիկ', `<main class="main">
      <div style="align-self:flex-start;max-width:320px;background:#fff;border:1px solid var(--line);border-radius:6px 18px 18px 18px;padding:10px 12px;font-size:13.5px;line-height:1.45">Բարև։ Այս շաբաթ՝ ${fmt(w.orders)} պատվեր և ${short(w.commission)} պարկի եկամուտ։ Եկավ ${w.new}, գնաց ${w.churn} վարորդ։ Հիմա գծում է ${h.online.total}-ը։</div>
      <div style="align-self:flex-start;max-width:320px;background:#fff;border:1px solid var(--line);border-radius:6px 18px 18px 18px;padding:10px 12px;font-size:13.5px;line-height:1.45">Զրույցը և հրամանները կմիանան հաջորդ քայլում (Claude API)։ Մինչ այդ թվերը բաժիններում են, իսկ զանգերի ցուցակները՝ Վարորդներ բաժնում։</div>
      <div class="chips"><a class="chip" href="#/drivers/risk">Ով է վտանգի գոտում</a><a class="chip" href="#/finance">Այս ամսվա թվերը</a><a class="chip" href="#/quality">Ինչպես հասնել Ոսկու</a></div>
    </main>`, 'garik', { sub: `<span class="dot" style="background:#FBBF24"></span>գլխավոր գործակալ · միանում է`, pending: h.tasks_pending });
    wire();
  });

  // ───────── Կարգավորումներ ─────────
  route('/settings', async () => {
    const h = await rpc('app_home');
    const session = (await sb.auth.getSession()).data.session;
    const { data: logs } = await sb.from('agent_log').select('at,agent,action,details').order('id', { ascending: false }).limit(8);
    const { data: users } = await sb.from('app_users').select('email,role,name');
    const cell = (n, s) => `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px;border-radius:12px;background:var(--paper)"><span style="font-size:13px;font-weight:600">${n}</span>${s}</div>`;
    app.innerHTML = shell('Կարգավորումներ', `<main class="main">
      <section class="card">
        <h2 class="ttl">Միացումներ</h2>
        <div class="grid2">
          ${cell('Yandex Fleet · տաքսի', `<span class="pill g">միացված · ${ago(h.last_sync)}</span>`)}
          ${cell('Yandex Fleet · Delivery', '<span class="pill a">մուտք չկա</span>')}
          ${cell('PrimeBridge', '<span class="pill n">հաջորդ քայլում</span>')}
          ${cell('WhatsApp բոտ', '<span class="pill g">աշխատում է</span>')}
          ${cell('list.am', '<span class="pill g">գործակալ Կոմպ 2-ում</span>')}
          ${cell('Գարիկ (Claude)', '<span class="pill n">հաջորդ քայլում</span>')}
        </div>
      </section>
      <section class="card" style="gap:0">
        <h2 class="ttl" style="margin-bottom:4px">Մուտք ունեն</h2>
        ${(users || []).map((u) => `<div class="ln"><span>${esc(u.email)}</span><b class="pill ${u.role === 'owner' ? 'k' : 'n'}">${u.role === 'owner' ? 'տեր' : 'դիսպետչեր'}</b></div>`).join('')}
      </section>
      <section class="card" style="gap:0">
        <h2 class="ttl" style="margin-bottom:4px">Վերջին գործողությունները</h2>
        ${(logs || []).map((l) => `<div class="tl"><span class="mut" style="font-size:12.5px;font-weight:700;width:70px;flex-shrink:0">${new Date(l.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yerevan' })}</span><div><div style="font-size:13px;font-weight:700">${esc(l.agent)} · ${esc(l.action)}</div><div class="sm mut">${esc(l.action === 'sync' ? `պատվեր +${l.details?.orders?.n ?? 0}, գործարք +${l.details?.transactions?.n ?? 0}, ${Math.round((l.details?.ms || 0) / 1000)} վրկ` : JSON.stringify(l.details || {}).slice(0, 90))}</div></div></div>`).join('')}
      </section>
      <section class="card">
        <h2 class="ttl">Գաղտնաբառ</h2>
        <span class="sm mut">Դիր գաղտնաբառ, որ հավելվածը բացվի առանց փոստի հղման (առնվազն 8 նիշ)։</span>
        <input id="newpw" class="in" type="password" autocomplete="new-password" placeholder="Նոր գաղտնաբառ">
        <button class="btn" id="setpw">Պահել գաղտնաբառը</button>
        <span id="pwmsg" class="sm mut"></span>
      </section>
      <section class="card">
        <span class="sm mut">Մուտք՝ ${esc(session?.user?.email || '')}</span>
        <button class="btn o" id="signout">Դուրս գալ</button>
        <span class="sm mut" style="text-align:center">HayWay տիրոջ հավելված · տարբերակ 0.2</span>
      </section>
    </main>`, 'settings', { pending: h.tasks_pending });
    document.getElementById('signout').onclick = () => sb.auth.signOut().then(render);
    document.getElementById('setpw').onclick = async () => {
      const p = document.getElementById('newpw').value, m = document.getElementById('pwmsg');
      if (p.length < 8) { m.textContent = 'Առնվազն 8 նիշ։'; return; }
      m.textContent = 'Պահվում է…';
      const { error } = await sb.auth.updateUser({ password: p });
      m.textContent = error ? 'Սխալ՝ ' + error.message : 'Պահված է։ Հաջորդ անգամ մտիր փոստով և այս գաղտնաբառով։';
      if (!error) document.getElementById('newpw').value = '';
    };
    wire();
  });

  // ───────── Դեռ չմիացված բաժիններ ─────────
  const SOON = {
    marketing: ['Մարքեթինգ', '#FDBA74', I.mega, 'Ալիքներ (list.am, TikTok, Facebook, Instagram, WhatsApp, կայք), արշավներ և մրցակիցներ։ Տվյալները կգան Կոմպ 2-ի list, tiktok, meta, govazd և scout գործակալներից։'],
    leads: ['Հայտեր', '#93C5FD', I.userplus, 'Հայտից մինչև 50-րդ պատվեր՝ ըստ աղբյուրի։ Տվյալները կգան hayter գործակալից և Fleet-ի «Отчёт по привлечению»-ից։'],
    contact: ['Կապ', '#D6D3CE', I.chat, 'Հայտարարություն Fleet-ով (ում × ինչի մասին, Գարիկը գրում է, դու հաստատում ես) և 6 ալիքի նամակները։'],
    delivery: ['Առաքում', '#5EEAD4', I.box, 'HayWay Delivery-ն Fleet-ում առանձին մուտք ունի։ Պետք է Delivery պարկի API բանալին (Տնօրենի մուտքով), հետո նույն էկրանները կաշխատեն առաքիչների համար։'],
  };
  Object.keys(SOON).forEach((k) => route('/' + k, async () => {
    const h = await rpc('app_home');
    const [t, c, ic, txt] = SOON[k];
    app.innerHTML = shell(t, `<main class="main"><section class="card a"><h2 class="ttl" style="color:#5A3506">Միանում է հաջորդ քայլում</h2><p class="sm" style="margin:0;color:#5A3506">${txt}</p></section>
      <a class="btn" href="#/sections">Վերադառնալ բաժիններ</a></main>`, 'sections', { back: '#/sections', sub: `<span class="dot" style="background:#FBBF24"></span>սպասում է միացման`, pending: h.tasks_pending });
    wire();
  }));

  // ───────── Սկիզբ ─────────
  window.HW = { sb, rpc, render, invalidate, cache };
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
})();
