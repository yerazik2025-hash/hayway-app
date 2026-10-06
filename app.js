/* HayWay տիրոջ հավելված — v0.4 (դիզայն v3, iOS-ի կանոններով)։
   Շրջանակ. վերևի տող + ոլորվող բովանդակություն + ներքևի տող։ Էջը ինքը չի շարժվում, ոլորվում է միայն .scroll-ը։
   Էկրաններ՝ Գլխավոր, Գործեր (գործակալների առաջարկներ), Գարիկ (զրույց Claude-ով), Բաժիններ, Կարգավորումներ,
   Վարորդներ, Որակ, Ֆինանսներ, Պայմաններ։ */
(function () {
  'use strict';
  const CFG = window.GARIK_CONFIG || {};
  const sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const app = document.getElementById('app');
  const cache = {};

  // ───────── Ստեղնաշար և էկրանի բարձրություն (iPhone-ի «շարժվող էջի» ուղղում) ─────────
  const root = document.documentElement;
  function syncViewport() {
    const v = window.visualViewport;
    if (!v) return;
    root.style.setProperty('--vvh', v.height + 'px');
    root.style.setProperty('--vv-top', v.offsetTop + 'px');
    document.body.classList.toggle('kb', window.innerHeight - v.height > 120);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewport);
    window.visualViewport.addEventListener('scroll', syncViewport);
  }
  document.addEventListener('focusout', () => setTimeout(() => { window.scrollTo(0, 0); syncViewport(); }, 150));
  syncViewport();

  // ───────── Օգնական ֆունկցիաներ ─────────
  const NB = ' ';
  const fmt = (n, d = 0) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: d }).replace(/\s/g, NB);
  const amd = (n) => fmt(n) + NB + '֏';
  const short = (n) => { n = Number(n || 0); const a = Math.abs(n); if (a >= 1e6) return fmt(n / 1e6, a >= 1e8 ? 0 : 1) + NB + 'մլն' + NB + '֏'; if (a >= 1e4) return fmt(n / 1e3) + NB + 'հզ.' + NB + '֏'; return amd(n); };
  const tiny = (n) => { n = Number(n || 0); const a = Math.abs(n); if (a >= 1e6) return fmt(n / 1e6, 1) + NB + 'մլն'; if (a >= 1e4) return fmt(n / 1e3) + NB + 'հզ.'; return fmt(n); };
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
  const delta = (cur, prev) => { if (!prev) return '<span class="delta mut3">—</span>'; const d = Math.round((cur - prev) / prev * 100); if (!d) return '<span class="delta mut">0%</span>'; return d > 0 ? `<span class="delta pos">▲${NB}${d}%</span>` : `<span class="delta neg">▼${NB}${Math.abs(d)}%</span>`; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAYS = ['Կիր', 'Երկ', 'Երք', 'Չրք', 'Հնգ', 'Ուրբ', 'Շբթ'];
  const DAYS_L = ['Կիրակի', 'Երկուշաբթի', 'Երեքշաբթի', 'Չորեքշաբթի', 'Հինգշաբթի', 'Ուրբաթ', 'Շաբաթ'];
  const MONTHS = ['հունվարի', 'փետրվարի', 'մարտի', 'ապրիլի', 'մայիսի', 'հունիսի', 'հուլիսի', 'օգոստոսի', 'սեպտեմբերի', 'հոկտեմբերի', 'նոյեմբերի', 'դեկտեմբերի'];
  const dayIdx = (iso) => new Date(iso + 'T12:00:00').getDay();
  const dmy = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const hm = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yerevan' });
  const ago = (iso) => { if (!iso) return '—'; const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return 'հենց հիմա'; if (m < 60) return `${m}${NB}ր առաջ`; const h = Math.round(m / 60); if (h < 48) return `${h}${NB}ժ առաջ`; return `${Math.round(h / 24)}${NB}օր առաջ`; };
  const initials = (f, l) => ((f || '')[0] || '') + ((l || '')[0] || '');
  const name = (d) => `${d.first_name || ''} ${d.last_name ? d.last_name[0] + '.' : ''}`.trim() || 'Առանց անվան';
  const phone = (d) => (d.phones && d.phones[0]) ? d.phones[0] : '';
  const today = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
  const todayLong = () => { const d = new Date(Date.now() + 4 * 3600e3); return `${DAYS_L[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };

  const sv = (w, body, extra = '') => `<svg class="i" width="${w}" height="${w}" viewBox="0 0 24 24"${extra}>${body}</svg>`;
  const I = {
    home: sv(26, '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h4.5v-6h4v6h4.5V9"/>'),
    tasks: sv(26, '<rect x="4.5" y="4" width="15" height="17" rx="2.5"/><path d="M9 4V3h6v1"/><path d="m8.5 12.5 2.5 2.5 4.5-4.5"/>'),
    star: sv(20, '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    grid: sv(26, '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'),
    cfg: sv(26, '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
    back: sv(26, '<path d="m15 5-7 7 7 7"/>', ' style="stroke-width:2.4"'),
    call: sv(20, '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    chev: sv(16, '<path d="m9 5 7 7-7 7"/>', ' style="stroke-width:2.4"'),
    refresh: sv(22, '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>'),
    users: sv(20, '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M18 15c2.5.5 4 2.5 4 6"/>'),
    userplus: sv(20, '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M19 8v6M16 11h6"/>'),
    quality: sv(20, '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>'),
    money: sv(20, '<path d="M3 7a2 2 0 0 1 2-2h12v3"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.3"/>'),
    percent: sv(20, '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>'),
    mega: sv(20, '<path d="M3 10v4h4l8 5V5L7 10z"/><path d="M18 9a4 4 0 0 1 0 6"/>'),
    chat: sv(20, '<path d="M4 5h16v11H9l-5 4z"/>'),
    box: sv(20, '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>'),
    trophy: sv(20, '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 6h3v1a3 3 0 0 1-3 3M7 6H4v1a3 3 0 0 0 3 3"/>'),
    alert: sv(20, '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.5"/>'),
    link: sv(20, '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    key: sv(20, '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>'),
    clock: sv(20, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    send: sv(20, '<path d="M12 19V5M5 12l7-7 7 7"/>', ' style="stroke-width:2.4"'),
    trash: sv(22, '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    car: sv(20, '<path d="M5 17h14v-5l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>'),
    logo: '<svg width="44" height="44" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#111113"/><path d="M16 6.5c-4 0-7 3-7 6.8 0 4.9 7 12.2 7 12.2s7-7.3 7-12.2c0-3.8-3-6.8-7-6.8z" fill="#FCE000"/><circle cx="16" cy="13.2" r="2.9" fill="#111113"/></svg>',
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

  // ───────── Շրջանակ ─────────
  let pendingCount = 0;
  function tabbar(active) {
    const t = (k, href, icon, label, badge) => `<a class="tab ${active === k ? 'on' : ''}" href="${href}"><span class="ic">${icon}${badge ? `<span class="badge">${badge}</span>` : ''}</span><span>${label}</span></a>`;
    return `<nav class="tabbar">
      ${t('home', '#/', I.home, 'Գլխավոր')}
      ${t('tasks', '#/tasks', I.tasks, 'Գործեր', pendingCount)}
      ${t('garik', '#/garik', `<span class="g">${I.star}</span>`, 'Գարիկ')}
      ${t('sections', '#/sections', I.grid, 'Բաժիններ')}
      ${t('settings', '#/settings', I.cfg, 'Կարգավորում')}
    </nav>`;
  }
  // o: { title, sub, tab, back:[href,label], right, compact, after }
  function frame(o, body) {
    const left = o.back ? `<a class="backb" href="${o.back[0]}">${I.back}<span>${esc(o.back[1])}</span></a>` : '';
    const right = o.right !== undefined ? o.right : `<button class="ibtn" id="refresh" aria-label="Թարմացնել">${I.refresh}</button>`;
    const large = o.compact ? '' : `<header class="lt"><h1>${o.title}</h1>${o.sub ? `<div class="st">${o.sub}</div>` : ''}</header>`;
    return `<div class="top ${o.compact ? 'compact scrolled' : ''} ${o.back ? '' : 'nb'}"><div class="top-in"><div class="l">${left}</div><div class="ct">${o.title}</div><div class="r">${right}</div></div></div>
      <div class="scroll" id="sc">${large}${body}</div>${o.after || ''}${tabbar(o.tab)}`;
  }
  function mount(o, body) {
    app.innerHTML = frame(o, body);
    const sc = document.getElementById('sc'), top = app.querySelector('.top');
    if (!o.compact) sc.addEventListener('scroll', () => top.classList.toggle('scrolled', sc.scrollTop > 40), { passive: true });
    const r = document.getElementById('refresh');
    if (r) r.onclick = () => { r.classList.add('spinning'); invalidate(); render(); };
    return sc;
  }
  const page = (inner) => `<div class="page">${inner}</div>`;
  const sec = (title, inner, opts = {}) => `<section class="sec">${title ? `<div class="sec-h"><h2>${title}</h2>${opts.action || ''}</div>` : ''}${inner}${opts.foot ? `<p class="sec-f">${opts.foot}</p>` : ''}</section>`;
  const cell = (o) => {
    const tag = o.href ? 'a' : (o.button ? 'button' : 'div');
    const attrs = o.href ? ` href="${o.href}"` : (o.button ? ` type="button" id="${o.button}"` : '');
    return `<${tag} class="cell"${attrs}>${o.icon ? `<span class="ico ${o.color || 's'}">${o.icon}</span>` : ''}${o.lead || ''}<span class="bd"><span class="t ${o.bold ? 'b' : ''}">${o.t}</span>${o.s ? `<span class="s">${o.s}</span>` : ''}${o.extra || ''}</span>${o.v !== undefined ? `<span class="v ${o.strong ? 'strong' : ''}">${o.v}</span>` : ''}${o.trail || ''}${o.href ? `<span class="chev">${I.chev}</span>` : ''}</${tag}>`;
  };
  const group = (cells, cls = '') => `<div class="group ${cls}">${cells.join('')}</div>`;
  const kpi = (l, v, s, href) => `<${href ? `a href="${href}"` : 'div'} class="kpi"><span class="kpi-l">${l}</span><span class="kpi-v">${v}</span>${s ? `<span class="kpi-s">${s}</span>` : ''}</${href ? 'a' : 'div'}>`;
  const emptyState = (icon, h, p, btn) => `<div class="empty"><span class="ei">${icon}</span><h3>${h}</h3><p>${p}</p>${btn || ''}</div>`;

  // Սյունակային գրաֆիկ. մեկ շարք, չեզոք գույն, այսօրը՝ մուգ, սեղմելիս՝ արժեքը վերևում
  function barChart(id, days, key, fmtFull, unitWord) {
    const data = (days || []).slice(-7);
    if (!data.length) return '<p class="none">Տվյալ դեռ չկա</p>';
    const vals = data.map((d) => +d[key] || 0);
    const max = Math.max(1, ...vals), sum = vals.reduce((a, b) => a + b, 0);
    const maxI = vals.indexOf(Math.max(...vals)), td = today();
    const cols = data.map((d, i) => {
      const h = Math.max(2, Math.round(vals[i] / max * 100));
      const isT = d.day === td;
      const lb = (i === maxI || isT) ? `<span class="lb" style="bottom:calc(${h}% + 4px)">${tiny(vals[i])}</span>` : '';
      return `<div class="c ${isT ? 'hi' : ''}" data-i="${i}">${lb}<div class="b" style="height:${h}%"></div></div>`;
    }).join('');
    const xs = data.map((d) => `<span class="${d.day === td ? 'hi' : ''}">${DAYS[dayIdx(d.day)]}</span>`).join('');
    const cap0 = `7 օրում՝ ${fmtFull(sum)}${unitWord ? ' ' + unitWord : ''}`;
    setTimeout(() => {
      const el = document.getElementById(id), cap = document.getElementById(id + '-cap');
      if (!el) return;
      el.querySelectorAll('.c').forEach((c) => c.onclick = () => {
        const on = c.classList.contains('sel');
        el.querySelectorAll('.c').forEach((x) => x.classList.remove('sel'));
        if (on) { cap.textContent = cap0; return; }
        c.classList.add('sel');
        const d = data[+c.dataset.i];
        cap.textContent = `${DAYS_L[dayIdx(d.day)]}, ${dmy(d.day)} · ${fmtFull(vals[+c.dataset.i])}${unitWord ? ' ' + unitWord : ''}`;
      });
    });
    return `<p class="meta" id="${id}-cap">${cap0}</p><div class="chart" id="${id}">${cols}</div><div class="chart-x">${xs}</div>`;
  }

  // ───────── Երթուղավորում ─────────
  const routes = {};
  function route(path, fn) { routes[path] = fn; }
  let lastTab = '';
  async function render() {
    const session = (await sb.auth.getSession()).data.session;
    if (!session) return renderLogin();
    const path = (location.hash || '#/').slice(1).split('?')[0];
    const [, seg = '', arg = ''] = path.split('/');
    const fn = routes['/' + seg] || routes['/'];
    const sc = document.getElementById('sc');
    app.querySelectorAll('.composer').forEach((e) => e.remove());
    if (sc && app.querySelector('.tabbar')) sc.innerHTML = '<div class="loading" style="height:60vh"><span class="spin"></span></div>';
    else app.innerHTML = '<div class="loading"><span class="spin"></span></div>';
    try {
      await fn(arg);
    } catch (e) {
      const msg = String(e.message || e);
      mount({ title: 'Սխալ', tab: lastTab || 'home' }, page(`<div class="err">${esc(msg === 'no access' ? 'Այս փոստը հավելվածի մուտքի ցուցակում չէ։' : msg)}</div><button class="btn full" id="signout">Դուրս գալ</button>`));
      document.getElementById('signout').onclick = () => sb.auth.signOut().then(render);
    }
  }
  window.addEventListener('hashchange', render);
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') { invalidate(); render(); } });

  // ───────── Մուտք ─────────
  async function renderLogin() {
    app.innerHTML = `<div class="login">
      <div class="brand">${I.logo}<div><h1>HayWay</h1><p>Տիրոջ հավելված</p></div></div>
      <div class="box">
        <div class="field"><label for="email">Էլ. փոստ</label><input id="email" class="in" type="email" inputmode="email" autocomplete="username" autocapitalize="off" placeholder="name@gmail.com"></div>
        <div class="field"><label for="pw">Գաղտնաբառ</label><input id="pw" class="in" type="password" autocomplete="current-password" placeholder="••••••••"></div>
        <button class="btn pri full" id="login">Մտնել</button>
        <button class="btn plain" id="send">Մտնել առանց գաղտնաբառի՝ հղումով</button>
        <div id="otpbox" style="display:none" class="box">
          <div class="field"><label for="otp">Կոդը նամակից</label><input id="otp" class="in" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"></div>
          <button class="btn dark full" id="verify">Մտնել կոդով</button>
        </div>
        <p id="msg" class="msgline"></p>
      </div>
      <p class="hint">Գաղտնաբառը դրվում է Կարգավորումներում՝ առաջին մուտքից հետո։ Փոստի հղումը բացիր հենց այս հեռախոսում։</p>
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
      msg.textContent = 'Ուղարկված է։ Բացիր նամակի հղումը այս հեռախոսում։ Ժամում առավելագույնը 2 նամակ է գնում։';
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
    lastTab = 'home';
    const h = await rpc('app_home');
    pendingCount = h.tasks_pending || 0;
    const w = h.week, p = h.prev_week, g = h.gold;
    const active = h.active_30d || 0, net = (w.new || 0) - (w.churn || 0);
    const cr = pct(w.cancelled_driver, w.orders + w.cancelled);
    const att = [];
    if (h.tasks_pending) att.push(cell({ href: '#/tasks', icon: I.tasks, color: 'k', t: `${h.tasks_pending} առաջարկ սպասում է քեզ`, bold: true, s: 'Գործակալների այսօրվա առաջարկները' }));
    if (w.churn > w.new) att.push(cell({ href: '#/drivers/churned', icon: I.users, color: 'r', t: `Գնաց ${w.churn}, եկավ ${w.new} վարորդ`, s: `Այս շաբաթ զուտ՝ ${net}` }));
    if (h.debt.drivers) att.push(cell({ href: '#/drivers/debt', icon: I.money, color: 'o', t: `${h.debt.drivers} վարորդ պարտքով`, s: `Ընդհանուր՝ ${short(Math.abs(h.debt.total))}` }));
    att.push(cell({ href: '#/quality', icon: I.quality, color: 'p', t: `Վարորդների չեղարկում՝ ${cr}%`, s: 'Այս շաբաթ, բոլոր պատվերներից' }));

    const sc = mount({ title: 'HayWay', tab: 'home', sub: `${todayLong()} <span class="mut3">·</span> <span class="mut3">թարմ՝ ${ago(h.last_sync)}</span>` }, page(`
      ${sec('Այսօր քո ուշադրությանը', group(att, 'ic'))}
      ${sec('Այս շաբաթ', `<div class="kpis">
        ${kpi('Հիմա գծում', `${fmt(h.online.total)}`, `${fmt(h.online.on_order)} պատվերի վրա`, '#/drivers/active')}
        ${kpi('Պատվերներ', fmt(w.orders), delta(w.orders, p.orders))}
        ${kpi('Շրջանառություն', short(w.gmv), delta(w.gmv, p.gmv), '#/finance')}
        ${kpi('Պարկի եկամուտ', short(w.commission), delta(w.commission, p.commission), '#/finance')}
      </div>`, { foot: 'Վերջին 7 օրը՝ նախորդ 7 օրվա համեմատ։' })}
      ${sec('Արագ գործողություններ', `<div class="qa">
        <a href="#/contact"><span class="q">${I.chat}</span><span>Գրել վարորդներին</span></a>
        <a href="#/tasks"><span class="q">${I.tasks.replace(/width="26" height="26"/, 'width="20" height="20"')}</span>${h.tasks_pending ? `<span class="badge">${h.tasks_pending}</span>` : ''}<span>Հաստատել</span></a>
        <a href="#/drivers/risk"><span class="q">${I.call}</span><span>Ում զանգել</span></a>
        <a href="#/marketing"><span class="q">${I.mega}</span><span>Գովազդ</span></a>
        <a href="#/terms"><span class="q">${I.trophy}</span><span>Մրցույթ</span></a>
        <a href="#/finance"><span class="q">${I.money}</span><span>Վճարումներ</span></a>
      </div>`)}
      ${sec('1000 ակտիվ վարորդ', `<a class="card" href="#/drivers/active">
        <div class="hero"><span class="n">${fmt(active)}</span><span class="u">/ 1000 · ${Math.round(active / 10)}%</span></div>
        <div class="prog y"><span style="width:${Math.min(100, active / 10)}%"></span></div>
        <div class="row wrap"><span class="tag pos">+${w.new} նոր</span><span class="tag neg">−${w.churn} հեռացած</span><span class="tag ${net >= 0 ? 'pos' : 'neg'}">զուտ ${net >= 0 ? '+' : '−'}${Math.abs(net)}</span></div>
        <p class="meta">Yandex-ի Ոսկի մակարդակ՝ ${g.new_50} / 80 նորեկ 50 պատվերով այս ամիս (նորեկ՝ ${g.new_month})։</p>
      </a>`, { foot: 'Ակտիվ՝ վերջին 30 օրում գոնե մեկ ավարտված պատվեր։' })}
      ${sec('Պատվերներ ըստ օրերի', `<div class="card">${barChart('ch-orders', h.days, 'orders', (v) => fmt(v), 'պատվեր')}</div>`, { foot: 'Սեղմիր սյունակին՝ օրվա թիվը տեսնելու համար։' })}
    `));
    return sc;
  });

  // ───────── Բաժիններ ─────────
  route('/sections', async () => {
    lastTab = 'sections';
    const h = await rpc('app_home');
    pendingCount = h.tasks_pending || 0;
    const w = h.week;
    const soon = '<span class="tag n">շուտով</span>';
    mount({ title: 'Բաժիններ', tab: 'sections', sub: '8 բաժին · 5-ը կենդանի տվյալներով' }, page(`
      ${sec('Վարորդներ և որակ', group([
        cell({ href: '#/drivers', icon: I.users, color: 'y', t: 'Վարորդներ', s: `${fmt(h.active_30d)} ակտիվ · շաբաթ՝ +${w.new} / −${w.churn}` }),
        cell({ href: '#/quality', icon: I.quality, color: 'p', t: 'Որակ', s: `${pct(w.orders, w.orders + w.cancelled)}% պատվեր ավարտվում է` }),
        cell({ href: '#/terms', icon: I.percent, color: 'r', t: 'Պայմաններ', s: 'Կոմիսիայի խմբեր, հաշվիչ, մրցույթ' }),
      ], 'ic'))}
      ${sec('Գումար', group([
        cell({ href: '#/finance', icon: I.money, color: 'g', t: 'Ֆինանսներ', s: `Եկամուտ՝ ${short(w.commission)} այս շաբաթ` }),
      ], 'ic'))}
      ${sec('Աճ', group([
        cell({ href: '#/marketing', icon: I.mega, color: 'o', t: 'Մարքեթինգ', s: '10 ալիք, արշավներ, մրցակիցներ', trail: soon }),
        cell({ href: '#/leads', icon: I.userplus, color: 'b', t: 'Հայտեր', s: 'Հայտից մինչև 50-րդ պատվեր', trail: soon }),
        cell({ href: '#/contact', icon: I.chat, color: 's', t: 'Կապ', s: 'Հայտարարություններ և նամակներ', trail: soon }),
      ], 'ic'))}
      ${sec('Այլ պարկ', group([
        cell({ href: '#/delivery', icon: I.box, color: 't', t: 'Առաքում', s: 'HayWay Delivery', trail: soon }),
      ], 'ic'))}
    `));
  });

  // ───────── Վարորդներ ─────────
  const SEGS = [['active', 'Ակտիվ'], ['top', 'Լավագույն 30'], ['risk', 'Վտանգի գոտում'], ['new', 'Նորեկներ'], ['churned', 'Հեռացած'], ['debt', 'Պարտքով'], ['cancellers', 'Չեղարկողներ']];
  const SEG_DESC = {
    active: 'Վերջին 30 օրում գոնե մեկ ավարտված պատվեր։ Դասավորված են այս շաբաթվա պատվերներով։',
    top: '30 վարորդ՝ ամենաշատ պատվերով վերջին 30 օրում։ Կոմիսիան փոխելուց առաջ նրանց զանգում ենք անձամբ։',
    risk: 'Աշխատում էին (30 օրում 10+ պատվեր), բայց 5+ օր պատվեր չեն վերցրել։ Կորցնելուց առաջ վերջին հնարավորությունն է։',
    new: 'Գրանցվել են վերջին 30 օրում։ Առաջին շաբաթը նրանց համար 0% է։',
    churned: 'Վերջին պատվերը 10–90 օր առաջ է։ Շատերը պարզապես դադարել են, զանգը հաճախ վերադարձնում է։',
    debt: 'Բացասական հաշվեկշիռ։ Պետք է հիշեցնել լիցքավորել։',
    cancellers: '30 օրում 50+ առաջարկ, որոնց 25%-ից ավելին չեղարկել են։',
  };
  const callBtn = (d) => { const tel = phone(d); return tel ? `<a class="callb" href="tel:${esc(tel)}" aria-label="Զանգել ${esc(name(d))}">${I.call}</a>` : ''; };
  route('/drivers', async (seg) => {
    lastTab = 'sections';
    seg = SEGS.some((s) => s[0] === seg) ? seg : 'active';
    const [h, rows] = await Promise.all([rpc('app_home'), rpc('app_drivers', { segment: seg })]);
    pendingCount = h.tasks_pending || 0;
    const w = h.week;
    const line = (d) => {
      let tag = '', meta = '';
      if (seg === 'active') { tag = d.current_status === 'offline' ? '<span class="tag n">անջատ</span>' : '<span class="tag pos">գծում</span>'; meta = `${d.orders_7d} պատվեր այս շաբաթ · ${d.rule_pct ?? '—'}%`; }
      if (seg === 'top') { tag = `<span class="tag pos">${fmt(d.orders_30d)} պատվեր</span>`; meta = `${short(d.gmv_30d)} · ${d.rule_pct ?? '—'}% · չեղարկում ${pct(d.cancels_30d, d.offers_30d)}%`; }
      if (seg === 'risk') { tag = `<span class="tag neg">${Math.floor(d.idle_days)} օր կանգնած</span>`; meta = `${d.orders_30d} պատվեր 30 օրում · վերջինը ${dmy(d.last_order_at)}`; }
      if (seg === 'new') { tag = `<span class="tag ${d.orders_30d ? 'pos' : 'warn'}">${d.orders_30d ? d.orders_30d + ' պատվեր' : 'դեռ 0 պատվեր'}</span>`; meta = `Գրանցվել է ${dmy(d.hire_date)} · ${d.days_since_hire} օր առաջ`; }
      if (seg === 'churned') { tag = `<span class="tag n">${Math.floor(d.idle_days)} օր</span>`; meta = `Վերջին պատվերը՝ ${dmy(d.last_order_at)} · ընդամենը ${fmt(d.orders_total)}`; }
      if (seg === 'debt') { tag = `<span class="tag neg">${amd(d.balance)}</span>`; meta = `${d.current_status === 'offline' ? 'Անջատ է' : 'Գծում է'} · վերջին պատվերը ${dmy(d.last_order_at)}`; }
      if (seg === 'cancellers') { tag = `<span class="tag neg">${pct(d.cancels_30d, d.offers_30d)}%</span>`; meta = `${d.cancels_30d} չեղարկում ${d.offers_30d} առաջարկից`; }
      return cell({ lead: `<span class="av">${esc(initials(d.first_name, d.last_name))}</span>`, t: `<span class="nm"><span class="t b">${esc(name(d))}</span>${tag}</span>`, s: esc(meta), trail: callBtn(d) });
    };
    const sc = mount({ title: 'Վարորդներ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '<span class="dot ok"></span>Պահպանող · տվյալները Fleet-ից' }, page(`
      <div class="kpis k3">
        ${kpi('Ակտիվ', fmt(h.active_30d), 'նպատակ՝ 1000')}
        ${kpi('7 օր', `<span class="pos">+${w.new}</span> <span class="neg">−${w.churn}</span>`, 'եկավ / գնաց')}
        ${kpi('30 օր', `<span class="pos">+${h.month.new}</span> <span class="neg">−${h.month.churn}</span>`, 'եկավ / գնաց')}
      </div>
      <section class="sec">
        <div class="chips" id="chips">${SEGS.map(([k, l]) => `<a class="chip ${k === seg ? 'on' : ''}" href="#/drivers/${k}">${l}${k === seg ? ` <span class="cnt">${rows.length}</span>` : ''}</a>`).join('')}</div>
        <p class="sec-f">${SEG_DESC[seg]}</p>
        ${rows.length ? group(rows.map(line), 'avs') : `<div class="group"><p class="none">Այս խմբում հիմա ոչ ոք չկա։</p></div>`}
      </section>
    `));
    const on = document.querySelector('#chips .chip.on');
    if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
    sc.scrollTop = 0;
  });

  // ───────── Որակ ─────────
  route('/quality', async () => {
    lastTab = 'sections';
    const [h, q] = await Promise.all([rpc('app_home'), rpc('app_quality')]);
    pendingCount = h.tasks_pending || 0;
    const d30 = q.d30, d7 = q.d7, g = h.gold;
    const comp30 = pct(d30.completed, d30.total), comp7 = pct(d7.completed, d7.total);
    const canc = (q.top_cancellers || []).slice(0, 5).map((d) => cell({ lead: `<span class="av">${esc(initials(d.first_name, d.last_name))}</span>`, t: esc(name(d)), bold: true, s: `${d.cancels} չեղարկում ${d.offers} առաջարկից`, v: `<span class="tag neg">${d.pct}%</span>`, trail: callBtn(d) }));
    mount({ title: 'Որակ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '<span class="dot ok"></span>Որակի վերահսկիչ · Fleet-ի պատվերներից' }, page(`
      ${sec('Ավարտված պատվերներ', `<div class="card">
        <div class="hero"><span class="n">${comp30}%</span><span class="u">${fmt(d30.completed)} / ${fmt(d30.total)} առաջարկ · 30 օր</span></div>
        <div class="prog"><span style="width:${comp30}%"></span></div>
        <div class="row wrap"><span class="tag neg">վարորդը չեղարկեց՝ ${pct(d30.by_driver, d30.total)}%</span><span class="tag warn">ուղևորը՝ ${pct(d30.by_passenger, d30.total)}%</span></div>
        <p class="meta">Այս շաբաթ՝ ${comp7}% ավարտված։</p>
      </div>`)}
      ${sec('Ով է չեղարկում', group(canc.length ? canc : ['<p class="none">Տվյալ չկա</p>'], 'avs') + group([cell({ href: '#/drivers/cancellers', t: 'Բոլոր չեղարկողները', v: '' })]), { foot: `${q.half_cancellers} վարորդ (չեղարկողների ${pct(q.half_cancellers, q.drivers_with_cancels)}%-ը) անում է վարորդների բոլոր չեղարկումների կեսը։` })}
      ${sec('Yandex-ի մակարդակ', `<div class="card">
        <div class="between"><h3>Ոսկու համար</h3><span class="tag pos">Արծաթ ✓</span></div>
        <div class="hero"><span class="n" style="font-size:34px">${g.new_50}</span><span class="u">/ 80 նորեկ 50 պատվերով</span></div>
        <div class="prog"><span style="width:${Math.min(100, g.new_50 / 80 * 100)}%"></span></div>
        <p class="meta">Այս ամիս գրանցվել է ${g.new_month} նորեկ։ Yandex-ի ուղարկածները չեն հաշվվում։</p>
      </div>`)}
      ${sec('Ստուգել', group([
        cell({ href: '#/drivers/new', icon: I.userplus, color: 'o', t: 'Նորեկներ առանց պատվերի', v: fmt(q.new_without_orders), strong: true }),
        cell({ icon: I.alert, color: 's', t: 'Պայմանագրի խնդիր Fleet-ում', v: fmt(q.contract_issues), strong: true }),
      ], 'ic'))}
    `));
  });

  // ───────── Ֆինանսներ ─────────
  route('/finance', async () => {
    lastTab = 'sections';
    const [h, f] = await Promise.all([rpc('app_home'), rpc('app_finance')]);
    pendingCount = h.tasks_pending || 0;
    const w = f.week, p = f.prev_week, m = f.month, b = f.balances;
    const tops = (f.topups_by_provider || []);
    const kv = (t, v, s) => cell({ t, s, v, strong: true });
    mount({ title: 'Ֆինանսներ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '<span class="dot ok"></span>Ֆինանսիստ · Fleet-ի գործարքներից' }, page(`
      ${sec('Այս շաբաթ', `<div class="kpis">
        ${kpi('Շրջանառություն', short(w.gmv), delta(w.gmv, p.gmv))}
        ${kpi('Պարկի եկամուտ', short(w.commission), delta(w.commission, p.commission))}
      </div>`, { foot: 'Նախորդ 7 օրվա համեմատ։' })}
      ${sec('Եկամուտ ըստ օրերի', `<div class="card">${barChart('ch-comm', f.days, 'commission', (v) => amd(Math.round(v)), '')}</div>`)}
      ${sec('Վերջին 30 օր', group([
        kv('Շրջանառություն', short(m.gmv)),
        kv('Կանխիկ · Քարտ · Կորպ.', `${pct(m.cash, m.gmv)} · ${pct(m.cashless, m.gmv)} · ${pct(m.corporate, m.gmv)}%`),
        kv('Պարկի կոմիսիա', short(m.commission), `${(m.gmv ? m.commission / m.gmv * 100 : 0).toFixed(2).replace('.', ',')}% շրջանառությունից`),
        kv('Վճարումներ վարորդներին', short(m.payouts)),
        kv('Լիցքավորումներ', short(m.topups)),
        kv('Մեկ ակտիվ վարորդից', amd(Math.round(m.active ? m.commission / m.active : 0))),
      ]))}
      ${sec('Հաշվեկշիռներ հիմա', group([
        kv('Վարորդների դրական հաշվեկշիռ', short(b.positive)),
        cell({ href: '#/drivers/debt', t: 'Պարտք', s: `${b.negative_drivers} վարորդ`, v: `<span class="neg">${short(b.negative)}</span>`, strong: true }),
      ]))}
      ${sec('Լիցքավորումներ ըստ ծառայության', tops.length ? group(tops.map((t) => cell({ t: esc(t.provider), s: `${fmt(t.count)} գործարք`, v: short(t.sum), strong: true, extra: `<div class="mbar"><span style="width:${pct(t.sum, m.topups)}%"></span></div>` }))) : '<div class="group"><p class="none">Տվյալ չկա</p></div>', { foot: 'Վերջին 30 օրը։' })}
    `));
  });

  // ───────── Պայմաններ ─────────
  route('/terms', async () => {
    lastTab = 'sections';
    const [h, t] = await Promise.all([rpc('app_home'), rpc('app_terms')]);
    pendingCount = h.tasks_pending || 0;
    const rules = t.rules || [];
    const maxD = Math.max(1, ...rules.map((r) => r.drivers));
    const gmv = t.month_gmv || 0, cur = t.month_commission || 0;
    const rows = rules.map((r) => cell({ t: `<b>${r.pct === null ? '—' : String(r.pct).replace('.', ',') + '%'}</b> · ${esc(r.name.trim())}`, s: `${r.active_30d} ակտիվ · ${short(r.gmv_30d)} 30 օրում${r.is_default ? ' · նորեկների համար' : ''}`, v: fmt(r.drivers), strong: true, extra: `<div class="mbar"><span style="width:${pct(r.drivers, maxD)}%"></span></div>` }));
    mount({ title: 'Պայմաններ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '<span class="dot ok"></span>Պայմանների խորհրդատու' }, page(`
      ${sec(`Կոմիսիայի խմբեր`, group(rows.length ? rows : ['<p class="none">Տվյալ չկա</p>']), { foot: 'Աջում՝ խմբի վարորդների քանակը։' })}
      ${sec('Ինչ կլինի, եթե…', `<div class="card">
        <p class="meta">Կոմիսիան բոլոր վարորդների համար</p>
        <div class="stepper"><button id="dec" aria-label="Պակասեցնել">−</button><span class="n" id="pv">2,50%</span><button id="inc" aria-label="Ավելացնել">+</button></div>
        <div class="kv"><span>Ամսական կոմիսիա</span><b id="mv"></b></div>
        <p class="delta" id="dv" style="font-size:15px"></p>
        <p class="meta">Հաշվարկը վերջին 30 օրվա շրջանառությամբ է՝ ${short(gmv)}։ Իրական կոմիսիան՝ ${short(cur)} (${(gmv ? cur / gmv * 100 : 0).toFixed(2).replace('.', ',')}%)։ Հեռացողներին չի հաշվում։</p>
      </div>`)}
      ${sec('Մրցույթ · Թոփ 20', `<div class="card">
        <div class="between"><h3>Ամենաշատ պատվերով 20 վարորդ</h3><span class="tag pos">մինչև 22.10</span></div>
        <p class="meta">Մրցանակային ֆոնդը՝ 255${NB}000${NB}֏։ Ընթացիկ ցուցակը՝ Լավագույն 30 խմբում։</p>
        <a class="btn dark full" href="#/drivers/top">Տեսնել առաջատարներին</a>
      </div>`)}
    `));
    let pv = 2.5;
    const upd = () => { const mv = gmv * pv / 100, d = mv - cur; document.getElementById('pv').textContent = pv.toFixed(2).replace('.', ',') + '%'; document.getElementById('mv').textContent = short(mv); const dv = document.getElementById('dv'); dv.textContent = (d >= 0 ? '+' : '−') + short(Math.abs(d)) + ' իրականի համեմատ'; dv.className = 'delta ' + (d >= 0 ? 'pos' : 'neg'); };
    document.getElementById('dec').onclick = () => { pv = Math.max(0, +(pv - 0.25).toFixed(2)); upd(); };
    document.getElementById('inc').onclick = () => { pv = Math.min(5, +(pv + 0.25).toFixed(2)); upd(); };
    upd();
  });

  // ───────── Գործեր ─────────
  const AGENT = { 'Պահպանող': [I.users, 'g'], 'Որակի վերահսկիչ': [I.quality, 'p'], 'Ֆինանսիստ': [I.money, 'o'], 'Գարիկ': [I.star, 'k'] };
  route('/tasks', async (view) => {
    lastTab = 'tasks';
    view = view === 'done' ? 'done' : 'pending';
    const { data: tasks, error } = await sb.from('tasks').select('*').in('status', ['pending', 'approved', 'rejected']).order('created_at', { ascending: false }).limit(60);
    if (error) throw new Error(error.message);
    const pending = tasks.filter((t) => t.status === 'pending');
    const done = tasks.filter((t) => t.status !== 'pending');
    pendingCount = pending.length;
    const card = (t) => {
      const p = t.payload || {}, [ic, col] = AGENT[t.agent] || [I.star, 's'];
      const decided = t.status !== 'pending';
      return `<article class="prop" data-id="${t.id}">
        <div class="who"><span class="ico ${col}">${ic}</span><b>${esc(t.agent)}</b><span>· ${esc(t.cost || '')}</span><span class="tm">${dmy(t.created_at)}</span></div>
        <h3>${esc(t.title)}</h3>
        ${t.why ? `<p class="why">${esc(t.why)}</p><button class="more" data-more>Ավելին</button>` : ''}
        ${p.segment ? `<button class="btn sm" data-list style="align-self:flex-start">${I.users} Ցուցակը${p.n ? (p.n > 25 ? ' · առաջին 25-ը' : ` · ${p.n}`) : ''}</button><div class="list" data-drivers style="display:none"></div>` : ''}
        ${decided
          ? `<div class="between"><span class="tag ${t.status === 'approved' ? 'pos' : 'n'}">${t.status === 'approved' ? 'Հաստատված' : 'Մերժված'} · ${dmy(t.decided_at)}</span><button class="btn plain" data-act="undo">Չեղարկել</button></div>`
          : `<div class="btns"><button class="btn" data-act="reject">Մերժել</button><button class="btn pri" data-act="approve">Հաստատել</button></div>`}
      </article>`;
    };
    const list = view === 'done' ? done : pending;
    mount({ title: 'Գործեր', tab: 'tasks', sub: 'Գործակալները պատրաստում են, դու որոշում ես' }, page(`
      <div class="seg"><button data-view="pending" class="${view === 'pending' ? 'on' : ''}">Սպասում են · ${pending.length}</button><button data-view="done" class="${view === 'done' ? 'on' : ''}">Որոշված · ${done.length}</button></div>
      ${list.length ? list.map(card).join('') : (view === 'pending'
        ? emptyState(I.tasks, 'Ամեն ինչ որոշված է', 'Գործակալները ամեն առավոտ 08:30-ին ստուգում են պարկը և նոր առաջարկները դնում են այստեղ։', '<a class="btn dark" href="#/drivers/risk">Ում զանգել այսօր</a>')
        : emptyState(I.clock, 'Դեռ ոչինչ', 'Հաստատած և մերժած առաջարկները կերևան այստեղ։'))}
    `));
    app.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => { location.hash = b.dataset.view === 'done' ? '#/tasks/done' : '#/tasks'; });
    app.querySelectorAll('.prop').forEach((art) => {
      const why = art.querySelector('.why'), more = art.querySelector('[data-more]');
      if (why && more) { requestAnimationFrame(() => { if (why.scrollHeight <= why.clientHeight + 2) more.remove(); }); more.onclick = () => { why.classList.toggle('open'); more.textContent = why.classList.contains('open') ? 'Պակաս' : 'Ավելին'; }; }
    });
    app.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      const { error } = await sb.rpc('app_task_decide', { task_id: b.closest('[data-id]').dataset.id, decision: b.dataset.act });
      if (error) alert('Սխալ՝ ' + error.message);
      invalidate(); render();
    });
    app.querySelectorAll('[data-list]').forEach((b) => b.onclick = async () => {
      const art = b.closest('[data-id]'), box = art.querySelector('[data-drivers]');
      if (box.style.display !== 'none') { box.style.display = 'none'; return; }
      b.disabled = true;
      try {
        const rows = await rpc('app_task_drivers', { task_id: art.dataset.id });
        box.innerHTML = rows.length ? `<div class="group avs" style="border-radius:0">${rows.map((d) => cell({ lead: `<span class="av">${esc(initials(d.first_name, d.last_name))}</span>`, t: esc(name(d)), bold: true, s: `Վերջին պատվերը ${dmy(d.last_order_at)} · ընդամենը ${fmt(d.orders_total)} · ${amd(d.balance)}`, trail: callBtn(d) })).join('')}</div>` : '<p class="none">Ցուցակը դատարկ է։</p>';
        box.style.display = '';
      } catch (e) { alert('Սխալ՝ ' + e.message); }
      b.disabled = false;
    });
  });

  // ───────── Գարիկ (զրույց) ─────────
  // Զրույցը պահվում է միայն այս հեռախոսում (localStorage), սերվերում՝ agent_log-ի գրանցումը։
  const CHAT_KEY = 'hw_chat';
  const loadChat = () => { try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); } catch (e) { return []; } };
  const saveChat = (m) => { try { localStorage.setItem(CHAT_KEY, JSON.stringify(m.slice(-40))); } catch (e) {} };
  let garikStatus = null;
  async function garikCall(method, body) {
    const session = (await sb.auth.getSession()).data.session;
    const r = await fetch(`${CFG.url}/functions/v1/garik`, { method, headers: { Authorization: 'Bearer ' + session.access_token, apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok && !j.answer) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  async function garikState() {
    if (garikStatus) return garikStatus;
    try { garikStatus = await garikCall('GET'); } catch (e) { garikStatus = { ok: false, key: false }; }
    return garikStatus;
  }
  const QS = ['Ում զանգենք այսօր', 'Ինչ կա Գործերում', 'Ինչպես հասնել Ոսկու մակարդակի', 'Ինչպես անցավ այս շաբաթը', 'Ով է ամենաշատը չեղարկում'];
  route('/garik', async () => {
    lastTab = 'garik';
    const [h, st] = await Promise.all([rpc('app_home'), garikState()]);
    pendingCount = h.tasks_pending || 0;
    const w = h.week;
    const msgs = loadChat();
    const hello = `Բարև։ Այս շաբաթ՝ ${fmt(w.orders)} պատվեր և ${short(w.commission)} պարկի եկամուտ։ Եկավ ${w.new}, գնաց ${w.churn} վարորդ, հիմա գծում է ${h.online.total}-ը։${h.tasks_pending ? `\nԳործերում ${h.tasks_pending} առաջարկ սպասում է քեզ։` : ''}${st.key ? '' : '\n\nԶրույցը կմիանա, երբ Claude-ի բանալին դրվի։'}`;
    const bubble = (m) => `<div class="msg ${m.role === 'user' ? 'me' : 'ai'}">${esc(m.content)}</div>`;
    const sugg = `<div class="sugg" id="sugg">${QS.map((q) => `<button data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
    const sc = mount({ title: 'Գարիկ', tab: 'garik', compact: true,
      right: `<button class="ibtn" id="clear" aria-label="Մաքրել զրույցը">${I.trash}</button>`,
      after: `<div class="composer"><textarea id="q" rows="1" placeholder="${st.key ? 'Հարցրու Գարիկին…' : 'Գարիկը դեռ միացված չէ'}" enterkeyhint="send"></textarea><button class="send" id="send" aria-label="Ուղարկել" disabled>${I.send}</button></div>` },
      `<div class="chat" id="chat">${bubble({ role: 'assistant', content: hello })}${msgs.map(bubble).join('')}${msgs.length ? '' : sugg}<div id="typing" class="msg ai typing" style="display:none">Գարիկը նայում է թվերին…</div></div>`);
    const q = document.getElementById('q'), send = document.getElementById('send'), typing = document.getElementById('typing');
    const down = () => { sc.scrollTop = sc.scrollHeight; };
    const add = (m) => { typing.insertAdjacentHTML('beforebegin', bubble(m)); down(); };
    const grow = () => { q.style.height = 'auto'; q.style.height = Math.min(132, q.scrollHeight) + 'px'; send.disabled = !q.value.trim() || busy; };
    let busy = false;
    down();
    async function ask(text) {
      text = String(text || '').trim(); if (!text || busy) return;
      busy = true; q.value = ''; grow();
      const s = document.getElementById('sugg'); if (s) s.remove();
      const m = loadChat(); add({ role: 'user', content: text }); m.push({ role: 'user', content: text }); saveChat(m);
      typing.style.display = ''; down();
      let ans;
      try {
        const r = await garikCall('POST', { question: text, history: m.slice(-13, -1) });
        ans = r.answer || 'Պատասխան չկա։';
        if (r.proposed && r.proposed.length) { ans += `\n\nԳործերում նոր առաջարկ՝ «${r.proposed.join('», «')}»։`; invalidate(); pendingCount += r.proposed.length; }
      } catch (e) { ans = 'Կապի սխալ՝ ' + e.message; }
      typing.style.display = 'none';
      add({ role: 'assistant', content: ans }); m.push({ role: 'assistant', content: ans }); saveChat(m);
      busy = false; grow();
    }
    q.addEventListener('input', grow);
    send.onclick = () => ask(q.value);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q.value); } });
    q.addEventListener('focus', () => setTimeout(down, 300));
    app.querySelectorAll('#sugg button').forEach((c) => c.onclick = () => ask(c.dataset.q));
    document.getElementById('clear').onclick = () => { if (confirm('Մաքրե՞լ զրույցը այս հեռախոսում։')) { saveChat([]); render(); } };
  });

  // ───────── Կարգավորումներ ─────────
  const logText = (l) => {
    const d = l.details || {};
    if (l.agent === 'fleet-sync' && l.action === 'sync') return ['Fleet · թարմացում', `+${d.orders?.n ?? 0} պատվեր, +${d.transactions?.n ?? 0} գործարք · ${Math.round((d.ms || 0) / 1000)} վրկ`];
    if (l.agent === 'fleet-sync' && l.action === 'error') return ['Fleet · սխալ', String(d.msg || '').slice(0, 90)];
    if (l.action === 'propose') return [`${l.agent} · նոր առաջարկ`, d.title || ''];
    if (l.agent === 'agents' && l.action === 'daily') return ['Առավոտյան ստուգում', `${Object.keys(d).length} խումբ ստուգվեց`];
    if (l.agent === 'agents' && l.action === 'skipped') return ['Առավոտյան ստուգում', 'Բաց թողնվեց. գործակալներն անջատված են'];
    if (l.action === 'chat') return ['Գարիկ · զրույց', d.q || ''];
    if (l.action === 'error') return [`${l.agent} · սխալ`, String(d.msg || '').slice(0, 90)];
    if (l.action.startsWith('task_')) return [`Դու · ${{ task_approve: 'հաստատեցիր', task_reject: 'մերժեցիր', task_undo: 'չեղարկեցիր' }[l.action] || l.action}`, d.title || ''];
    if (l.action === 'agents_off') return ['Գործակալները կանգնեցվեցին', ''];
    if (l.action === 'agents_on') return ['Գործակալները միացվեցին', ''];
    return [`${l.agent} · ${l.action}`, ''];
  };
  route('/settings', async () => {
    lastTab = 'settings';
    const [h, st, logsR, usersR, agR, sessR] = await Promise.all([
      rpc('app_home'), garikState(),
      sb.from('agent_log').select('at,agent,action,details').order('id', { ascending: false }).limit(10),
      sb.from('app_users').select('email,role,name'),
      sb.from('sync_state').select('value').eq('key', 'agents').maybeSingle(),
      sb.auth.getSession(),
    ]);
    pendingCount = h.tasks_pending || 0;
    const agentsOn = !(agR.data && agR.data.value && agR.data.value.enabled === false);
    const session = sessR.data.session;
    const logs = (logsR.data || []).map((l) => { const [t, s] = logText(l); const sameDay = new Date(l.at).toDateString() === new Date().toDateString(); return cell({ t: esc(t), s: esc(s), v: `<span class="mut3" style="font-size:13px">${sameDay ? hm(l.at) : dmy(l.at)}</span>` }); });
    const users = (usersR.data || []).map((u) => cell({ t: esc(u.email), v: `<span class="tag ${u.role === 'owner' ? 'k' : 'n'}">${u.role === 'owner' ? 'տեր' : 'դիսպետչեր'}</span>` }));
    mount({ title: 'Կարգավորումներ', tab: 'settings' }, page(`
      ${sec('Գործակալներ', group([cell({ icon: I.star, color: 'k', t: 'Ավտոմատ առաջարկներ', s: 'Ամեն առավոտ 08:30', trail: `<label class="sw"><input type="checkbox" id="agents" ${agentsOn ? 'checked' : ''} aria-label="Գործակալները միացված են"><span></span></label>` })], 'ic'),
        { foot: 'Պահպանող, Որակի վերահսկիչ և Ֆինանսիստ առաջարկներ են դնում Գործերում և ոչինչ չեն անում առանց քո հաստատման։ Անջատելուց հետո Fleet-ի թարմացումը շարունակվում է։' })}
      ${sec('Միացումներ', group([
        cell({ icon: I.car, color: 'y', t: 'Yandex Fleet · տաքսի', v: `<span class="tag pos">${ago(h.last_sync)}</span>` }),
        cell({ icon: I.box, color: 't', t: 'Yandex Fleet · Delivery', v: '<span class="tag warn">մուտք չկա</span>' }),
        cell({ icon: I.star, color: 'k', t: 'Գարիկ · Claude', v: st.key ? '<span class="tag pos">միացված</span>' : '<span class="tag warn">բանալի չկա</span>' }),
        cell({ icon: I.chat, color: 'g', t: 'WhatsApp բոտ', v: '<span class="tag pos">աշխատում է</span>' }),
        cell({ icon: I.mega, color: 'o', t: 'list.am', v: '<span class="tag n">Կոմպ 2-ում</span>' }),
        cell({ icon: I.money, color: 'b', t: 'PrimeBridge', v: '<span class="tag n">շուտով</span>' }),
      ], 'ic'))}
      ${sec('Մուտք ունեն', group(users))}
      ${sec('Վերջին գործողությունները', group(logs.length ? logs : ['<p class="none">Դեռ ոչինչ</p>']))}
      ${sec('Գաղտնաբառ', `<div class="card">
        <p class="meta">Դիր գաղտնաբառ, որ հավելվածը բացվի առանց փոստի հղման։ Առնվազն 8 նիշ։</p>
        <input id="newpw" class="in" type="password" autocomplete="new-password" placeholder="Նոր գաղտնաբառ">
        <button class="btn dark full" id="setpw">Պահել գաղտնաբառը</button>
        <p id="pwmsg" class="meta"></p>
      </div>`)}
      ${sec('', group([`<button class="cell" id="signout" style="justify-content:center"><span class="t neg" style="text-align:center">Դուրս գալ</span></button>`]), { foot: `Մուտք՝ ${esc(session?.user?.email || '')} · տարբերակ 0.4` })}
    `));
    document.getElementById('signout').onclick = () => sb.auth.signOut().then(render);
    document.getElementById('agents').onchange = async (e) => {
      const want = e.target.checked;
      if (!want && !confirm('Կանգնեցնե՞լ բոլոր գործակալներին։ Նոր առաջարկներ չեն գրվի, մինչև նորից միացնես։')) { e.target.checked = true; return; }
      e.target.disabled = true;
      const { error } = await sb.rpc('app_agents_set', { enabled: want });
      if (error) { alert('Սխալ՝ ' + error.message); e.target.checked = !want; }
      e.target.disabled = false;
    };
    document.getElementById('setpw').onclick = async () => {
      const pw = document.getElementById('newpw').value, m = document.getElementById('pwmsg');
      if (pw.length < 8) { m.textContent = 'Առնվազն 8 նիշ։'; return; }
      m.textContent = 'Պահվում է…';
      const { error } = await sb.auth.updateUser({ password: pw });
      m.textContent = error ? 'Սխալ՝ ' + error.message : 'Պահված է։ Հաջորդ անգամ մտիր փոստով և այս գաղտնաբառով։';
      if (!error) document.getElementById('newpw').value = '';
    };
  });

  // ───────── Դեռ չմիացված բաժիններ ─────────
  const SOON = {
    marketing: ['Մարքեթինգ', I.mega, 'Ալիքներ (list.am, TikTok, Facebook, Instagram, WhatsApp, կայք), արշավներ և մրցակիցներ։ Տվյալները կգան Կոմպ 2-ի list, tiktok, meta, govazd և scout գործակալներից։'],
    leads: ['Հայտեր', I.userplus, 'Հայտից մինչև 50-րդ պատվեր՝ ըստ աղբյուրի։ Տվյալները կգան hayter գործակալից և Fleet-ի ներգրավման հաշվետվությունից։'],
    contact: ['Կապ', I.chat, 'Հայտարարություն Fleet-ով (ում և ինչի մասին. Գարիկը գրում է, դու հաստատում ես) և 6 ալիքի նամակները մեկ տեղում։'],
    delivery: ['Առաքում', I.box, 'HayWay Delivery-ն Fleet-ում առանձին մուտք ունի։ Պետք է Delivery պարկի API բանալին (Տնօրենի մուտքով), հետո նույն էկրանները կաշխատեն առաքիչների համար։'],
  };
  Object.keys(SOON).forEach((k) => route('/' + k, async () => {
    lastTab = 'sections';
    const h = await rpc('app_home');
    pendingCount = h.tasks_pending || 0;
    const [t, ic, txt] = SOON[k];
    mount({ title: t, tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '<span class="dot wait"></span>միանում է հաջորդ քայլում' },
      page(emptyState(ic, 'Շուտով', txt, '<a class="btn dark" href="#/garik">Հարցնել Գարիկին</a>')));
  }));

  // ───────── Սկիզբ ─────────
  window.HW = { sb, rpc, render, invalidate, cache };
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
})();
