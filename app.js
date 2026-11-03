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
    ai: sv(20, '<path d="M4 5h16v11H9l-5 4z"/><path d="m12 7.5 1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z"/>'),
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

  // Fleet-ը 11–17.10-ի գործարքները չտվեց. այդ օրերի գումարները մոտավոր են (db\0005_tx_gap.sql)
  const estNote = (notes, days) => { const e = ((notes && notes.estimated_days) || []).filter((d) => d > new Date(Date.now() + 4 * 3600e3 - days * 86400e3).toISOString().slice(0, 10)); return e.length ? `≈ Եկամուտը `+dmy(e[0])+`–`+dmy(e[e.length - 1])+`-ի համար մոտավոր է. Fleet-ը այդ օրերի գործարքները չտվեց։` : ''; };

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

  // ───────── Telegram-ի միացում (db\0013, բոտ owner-bot) ─────────
  let tgState = {};
  function bindTg() {
    app.querySelectorAll('[data-tglink]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      const { data, error } = await sb.rpc('app_tg_link');
      b.disabled = false;
      if (error || !data || !data.url) { alert('Չստացվեց՝ ' + (error ? error.message : '')); return; }
      window.open(data.url, '_blank');
    });
    app.querySelectorAll('[data-tgunlink]').forEach((b) => b.onclick = async () => {
      if (!confirm('Անջատե՞լ Telegram-ի ծանուցումները։')) return;
      await sb.rpc('app_tg_unlink');
      render();
    });
  }

  // ───────── Ծանուցումներ այս հեռախոսում (Web Push, db\0014. ուղարկում է owner-bot-ը) ─────────
  // iPhone-ում աշխատում է միայն Home Screen-ին ավելացված հավելվածում (iOS 16.4+), թույլտվությունը՝ միայն կոճակ սեղմելով
  const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const pushStandaloneNeeded = () => /iP(hone|ad|od)/.test(navigator.userAgent) && !(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
  // getRegistration()-ը, ոչ ready-ն. ready-ն երբեք չի վերջանում, եթե service worker չկա, ու Գլխավորը կկախվեր
  async function pushSub() { if (!pushOk()) return null; try { const r = await navigator.serviceWorker.getRegistration(); return r ? await r.pushManager.getSubscription() : null; } catch (e) { return null; } }
  async function pushState() {
    const sub = await pushSub();
    return { ok: pushOk() && !pushStandaloneNeeded(), on: !!sub && Notification.permission === 'granted', denied: pushOk() && Notification.permission === 'denied', sub };
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
  async function pushDisable() {
    const sub = await pushSub();
    if (!sub) return;
    await sb.rpc('app_push_unsubscribe', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  function bindPush() {
    app.querySelectorAll('[data-pushon]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      try { await pushEnable(); render(); } catch (e) { b.disabled = false; alert('Չստացվեց՝ ' + e.message); }
    });
    app.querySelectorAll('[data-pushoff]').forEach((b) => b.onclick = async () => {
      if (!confirm('Անջատե՞լ ծանուցումները այս հեռախոսում։')) return;
      await pushDisable(); render();
    });
  }
  // Ծանուցումը սեղմելիս service worker-ը ասում է, որ էջը բացենք
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.go) location.hash = e.data.go; });

  // ───────── Գլխավոր (պարզ. այսօր անել · 4 թիվ · 1000-ի նպատակը) ─────────
  route('/', async () => {
    lastTab = 'home';
    const [h, notes, tr, qs, nts] = await Promise.all([
      rpc('app_home'), rpc('app_notes'),
      sb.from('tasks').select('id,agent,title,kind').eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
      rpc('app_questions').catch(() => null),
      sb.rpc('app_notices').then((r) => r.data || [], () => []),
      sb.rpc('app_tg').then((r) => r.data || {}, () => ({})),
    ]).then((a) => { tgState = a[5]; return a; });
    const tasks = tr.data || [];
    pendingCount = tasks.length;
    const w = h.week;
    // Համեմատում ենք միայն լրիվ օրերը (առանց այսօրվա). վերջին 7-ը՝ նախորդ 7-ի հետ
    const full = (h.days || []).filter((d) => d.day < today());
    const sum = (a, k) => a.reduce((s, d) => s + (+d[k] || 0), 0);
    const cw = full.slice(-7), pw = full.slice(-14, -7);
    const W7 = { orders: sum(cw, 'orders'), gmv: sum(cw, 'gmv'), commission: sum(cw, 'commission') };
    const P7 = { orders: sum(pw, 'orders'), gmv: sum(pw, 'gmv'), commission: sum(pw, 'commission') };
    const todayRow = (h.days || []).find((d) => d.day === today()) || {};
    const fresh = notes && notes.drivers_synced_at && (Date.now() - new Date(notes.drivers_synced_at)) < 3 * 3600e3;
    const active = h.active_30d || 0;
    const vsWeek = (cur, prev) => { if (!prev) return ''; const d = Math.round((cur - prev) / prev * 100); if (!d) return '<span class="delta mut">նույնը, ինչ նախորդ 7 օրը</span>'; return `<span class="delta ${d > 0 ? 'pos' : 'neg'}">${d > 0 ? '▲' : '▼'}${NB}${Math.abs(d)}%</span> <span class="mut">նախորդ 7 օրից</span>`; };
    const todo = tasks.slice(0, 3).map((t) => { const [ic, col] = AGENT[t.agent] || [I.star, 's']; return cell({ href: '#/tasks', icon: ic, color: col, t: esc(t.title), s: esc(t.agent) }); });
    if (tasks.length > 3) todo.push(cell({ href: '#/tasks', t: `<span style="color:var(--info)">Բոլոր գործերը · ${tasks.length}</span>` }));
    if (!tasks.length) todo.push(cell({ icon: I.tasks, color: 'g', t: 'Այսօր նոր գործ չկա', s: 'Գործակալները ստուգում են ամեն առավոտ 08:30-ին' }));
    const hasQ = qs && qs.open && qs.open.length;
    // Գարիկի հիշեցումները (db\0011, assistant_tick). «Լավ»-ով փակվում են
    const notice = nts.length ? sec('Գարիկը հիշեցնում է', `<div class="card nlist">${nts.map((n) => `<div class="nrow" data-id="${n.id}">
        <p>${esc(n.text)}</p><button type="button" class="btn sm gray" data-seen="${n.id}">Լավ</button></div>`).join('')}</div>`) : '';
    // Գարիկի ծանուցումները. նախ՝ հենց հավելվածում (push), իսկ եթե հեռախոսը չի կարող՝ Telegram (db\0013). «Հետո»-ն թաքցնում է 7 օրով
    let tgLater = 0; try { tgLater = +localStorage.getItem('hw_tg_later') || 0; } catch (e) {}
    const ps = await pushState();
    const tgCard = Date.now() <= tgLater || ps.on || tgState.linked ? ''
      : ps.ok && !ps.denied ? sec('', `<div class="card tgcard">
        <p><b>Գարիկի ծանուցումները՝ այս հեռախոսում</b><br><span class="meta">Երբ Գարիկը պատասխանի, հիշեցնի կամ «Կատարե՞մ» քարտ պատրաստի, հեռախոսը ձեզ կտեղեկացնի։</span></p>
        <div class="act-b"><button type="button" class="btn pri sm" data-pushon>Միացնել ծանուցումները</button><button type="button" class="btn sm gray" data-tglater>Հետո</button></div></div>`)
      : tgState.username ? sec('', `<div class="card tgcard">
        <p><b>Գարիկի պատասխանները՝ Telegram-ում</b><br><span class="meta">Հիշեցումներն ու «Կատարե՞մ» քարտերը կգան Telegram-ում, «Այո»-ն կարող եք սեղմել հենց այնտեղ։</span></p>
        <div class="act-b"><button type="button" class="btn pri sm" data-tglink>Միացնել Telegram-ը</button><button type="button" class="btn sm gray" data-tglater>Հետո</button></div></div>`) : '';
    mount({ title: 'HayWay', tab: 'home', sub: `${todayLong()} <span class="mut3">· թարմ՝ ${ago(h.last_sync)}</span>` }, page(`
      ${notice}
      ${tgCard}
      ${hasQ ? '<section class="sec" id="qa"></section>' : ''}
      ${sec('Այսօր անել', group(todo, 'ic'))}
      ${sec('Վերջին 7 օր', `<div class="kpis">
        ${fresh ? kpi('Հիմա աշխատում են', fmt(h.online.total), `${fmt(h.online.on_order)}-ը պատվերի վրա`, '#/drivers/active')
                : kpi('Այսօր աշխատել են', fmt(todayRow.active || 0), 'վարորդ՝ գոնե մեկ պատվերով', '#/drivers/active')}
        ${kpi('Պատվերներ', fmt(W7.orders), vsWeek(W7.orders, P7.orders))}
        ${kpi('Ընդհանուր գումար', short(W7.gmv), vsWeek(W7.gmv, P7.gmv), '#/finance')}
        ${kpi('Պարկի եկամուտ', short(W7.commission), vsWeek(W7.commission, P7.commission), '#/finance')}
      </div>`, { foot: ('Լրիվ օրեր՝ առանց այսօրվա, համեմատած դրանից առաջվա 7 օրվա հետ։ ' + estNote(notes, 15)).trim() })}
      ${sec('Նպատակ՝ 1000 վարորդ', `<a class="card" href="#/drivers/active">
        <div class="hero"><span class="n">${fmt(active)}</span><span class="u">աշխատող վարորդ</span></div>
        <div class="prog y"><span style="width:${Math.min(100, active / 10)}%"></span></div>
        <p class="meta">Այս շաբաթ եկավ <b class="pos">${w.new}</b>, գնաց <b class="neg">${w.churn}</b>։</p>
      </a>`, { foot: 'Աշխատող՝ վերջին 30 օրում գոնե մեկ պատվեր արած։ Մանրամասն թվերը՝ Բաժիններում։' })}
    `));
    if (hasQ) questionCard(document.getElementById('qa'), qs);
    bindTg();
    bindPush();
    const later = app.querySelector('[data-tglater]');
    if (later) later.onclick = () => { try { localStorage.setItem('hw_tg_later', String(Date.now() + 7 * 864e5)); } catch (e) {} later.closest('.sec').remove(); };
    app.querySelectorAll('[data-seen]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      await sb.rpc('app_notice_seen', { p_id: +b.dataset.seen });
      const row = b.closest('.nrow'), list = row.parentElement;
      row.remove();
      if (!list.children.length) list.closest('.sec').remove();
    });
  });

  // ───────── «Հարց ձեզ» (db\0009_owner_questions.sql). մեկ հարց միանգամից, կոճակներով ─────────
  const OTHER = 'Ուրիշ';
  function questionCard(el, qs) {
    const st = { open: qs.open.slice(), total: qs.total, answered: qs.answered, sel: [], busy: false, done: false };
    const draw = () => {
      if (st.done) {
        el.innerHTML = `<div class="card qcard qdone"><span class="qok">${sv(26, '<path d="m5 12.5 4.5 4.5L19 7.5"/>', ' style="stroke-width:2.6"')}</span>
          <h3>Շնորհակալություն</h3><p class="meta">Պատասխանները ստացանք։ Նոր հարց լինի՝ կհայտնվի այստեղ։</p></div>`;
        return;
      }
      const q = st.open[0], n = st.answered + 1;
      const opts = q.options.map((o, i) => `<button type="button" class="qopt ${st.sel.includes(o) ? 'on' : ''}" data-i="${i}"><span>${esc(o)}</span><span class="qmark"></span></button>`).join('');
      const needText = q.allow_text && st.sel.includes(OTHER);
      el.innerHTML = `<div class="sec-h"><h2>Հարց ձեզ</h2><span class="a mut3">${n}${NB}/${NB}${st.total}</span></div>
        <div class="card qcard">
          <div class="qprog"><span style="width:${Math.round(st.answered / st.total * 100)}%"></span></div>
          <h3>${esc(q.question)}</h3>
          ${q.hint ? `<p class="meta">${esc(q.hint)}</p>` : ''}
          <div class="qopts ${q.multi ? 'multi' : ''}">${opts}</div>
          ${needText ? '<textarea class="in qtext" id="qtext" rows="2" placeholder="Գրեք կարճ"></textarea>' : ''}
          ${q.multi || needText ? `<button type="button" class="btn pri full" id="qsend" ${st.sel.length ? '' : 'disabled'}>Ուղարկել</button>` : ''}
          <p class="msgline" id="qmsg"></p>
        </div>`;
      el.querySelectorAll('.qopt').forEach((b) => b.onclick = () => {
        if (st.busy) return;
        const o = q.options[+b.dataset.i];
        if (q.multi) { st.sel = st.sel.includes(o) ? st.sel.filter((x) => x !== o) : st.sel.concat(o); draw(); if (o === OTHER && st.sel.includes(OTHER)) { const t = document.getElementById('qtext'); if (t) t.focus(); } return; }
        st.sel = [o];
        if (q.allow_text && o === OTHER) { draw(); return; }
        b.classList.add('on');
        send(q);
      });
      const sb2 = document.getElementById('qsend');
      if (sb2) sb2.onclick = () => send(q);
    };
    async function send(q) {
      const t = document.getElementById('qtext');
      const txt = t ? t.value.trim() : '';
      if (q.allow_text && st.sel.includes(OTHER) && !txt) { document.getElementById('qmsg').textContent = 'Գրեք, թե ինչ առաջարկ է գործում։'; return; }
      st.busy = true;
      el.querySelectorAll('button').forEach((b) => b.disabled = true);
      const { error } = await sb.rpc('app_question_answer', { q_id: q.id, ans: st.sel, txt: txt || null });
      st.busy = false;
      if (error) { el.querySelectorAll('button').forEach((b) => b.disabled = false); document.getElementById('qmsg').textContent = 'Չուղարկվեց, փորձեք նորից։'; return; }
      for (const k in cache) if (k.startsWith('app_questions')) delete cache[k];
      st.open.shift(); st.answered++; st.sel = [];
      if (!st.open.length) st.done = true;
      setTimeout(draw, 220);
    }
    draw();
  }

  // ───────── Բաժիններ ─────────
  route('/sections', async () => {
    lastTab = 'sections';
    const [h, lr, geo] = await Promise.all([rpc('app_home'), sb.from('channels').select('status,summary').eq('id', 'listam').maybeSingle(), rpc('app_geo').catch(() => null)]);
    pendingCount = h.tasks_pending || 0;
    const w = h.week;
    const soon = '<span class="tag n">շուտով</span>';
    const la = lr.data;
    const laTag = !la ? '' : la.status === 'off' ? '<span class="tag neg">կանգնած</span>' : la.status === 'warn' ? '<span class="tag warn">ուշանում է</span>' : '';
    const gl = geo && geo.last;
    mount({ title: 'Բաժիններ', tab: 'sections', sub: '11 բաժին · 8-ը կենդանի տվյալներով' }, page(`
      ${sec('Վարորդներ և որակ', group([
        cell({ href: '#/drivers', icon: I.users, color: 'y', t: 'Վարորդներ', s: `${fmt(h.active_30d)} ակտիվ · շաբաթ՝ +${w.new} / −${w.churn}` }),
        cell({ href: '#/quality', icon: I.quality, color: 'p', t: 'Որակ', s: `${pct(w.orders, w.orders + w.cancelled)}% պատվեր ավարտվում է` }),
        cell({ href: '#/terms', icon: I.percent, color: 'r', t: 'Պայմաններ', s: 'Կոմիսիայի խմբեր, հաշվիչ, մրցույթ' }),
      ], 'ic'))}
      ${sec('Գումար', group([
        cell({ href: '#/finance', icon: I.money, color: 'g', t: 'Ֆինանսներ', s: `Եկամուտ՝ ${short(w.commission)} այս շաբաթ` }),
      ], 'ic'))}
      ${sec('Աճ', group([
        cell({ href: '#/growth', icon: I.userplus, color: 'y', t: 'Նոր վարորդներ', s: `30 օրում՝ +${fmt(h.month.new)} · գրանցումից մինչև 50-րդ պատվեր` }),
        cell({ href: '#/listam', icon: I.mega, color: 'r', t: 'list.am', s: 'Նամակներ, թարմացում, փաթեթ, հայտեր, մրցակիցներ', trail: laTag }),
        cell({ href: '#/geo', icon: I.ai, color: 'k', t: 'ChatGPT', s: gl ? `${fmt(gl.score)}% պատասխաններում HayWay-ը կա` : 'Երևո՞ւմ ենք, երբ վարորդը հարցնում է ChatGPT-ին' }),
        cell({ href: '#/marketing', icon: I.mega, color: 'o', t: 'Մարքեթինգ', s: '10 ալիք, արշավներ, մրցակիցներ', trail: soon }),
        cell({ href: '#/leads', icon: I.userplus, color: 'b', t: 'Հայտեր', s: 'Հայտից մինչև 50-րդ պատվեր', trail: soon }),
        cell({ href: '#/contact', icon: I.chat, color: 's', t: 'Կապ', s: 'Հայտարարություններ և նամակներ', trail: soon }),
      ], 'ic'))}
      ${sec('Այլ պարկ', group([
        cell({ href: '#/delivery', icon: I.box, color: 't', t: 'Առաքում', s: 'HayWay Delivery', trail: soon }),
      ], 'ic'))}
    `));
  });

  // ───────── Նոր վարորդներ (ձագար. գրանցում → առաջին պատվեր → 10 → 50 → աշխատում է) ─────────
  route('/growth', async () => {
    lastTab = 'sections';
    const [h, f] = await Promise.all([rpc('app_home'), rpc('app_funnel')]);
    pendingCount = h.tasks_pending || 0;
    const m = f.m30 || {}, R = m.registered || 0, p30 = f.prev30 || {};
    const bar = (n, base) => `<div class="mbar"><span style="width:${base ? Math.min(100, pct(n, base)) : 0}%"></span></div>`;
    const step = (t, n, first) => cell({ t, s: (R && !first) ? `${pct(n, R)}% գրանցվածներից` : '', v: fmt(n), strong: true, extra: bar(n, R) });
    const plus6 = (iso) => new Date(new Date(iso + 'T12:00:00Z').getTime() + 6 * 864e5).toISOString().slice(0, 10);
    const thisWeek = (f.weeks || [])[0] && f.weeks[0].wk;
    const weeks = (f.weeks || []).map((w) => cell({
      t: w.wk === thisWeek ? 'Այս շաբաթ' : `${dmy(w.wk)}–${dmy(plus6(w.wk))}`,
      s: w.registered ? `${w.first} առաջին պատվեր · ${w.o50} հասավ 50-ի` : 'Գրանցում չկա',
      v: fmt(w.registered), strong: true, extra: bar(w.first, w.registered),
    }));
    const stalled = (f.stalled || []).map((d) => cell({
      lead: `<span class="av">${esc(initials(d.first_name, d.last_name))}</span>`,
      t: `<span class="nm"><span class="t b">${esc(name(d))}</span><span class="tag warn">${d.idle_days}${NB}օր կանգնած</span></span>`,
      s: esc(`${d.orders_total} պատվեր · գրանցվել է ${dmy(d.hire_date)}`), trail: callBtn(d),
    }));
    const days1 = m.days_to_first ? String(Math.round(m.days_to_first * 10) / 10).replace('.', ',') : null;
    const syncAge = f.drivers_synced_at ? Date.now() - new Date(f.drivers_synced_at) : Infinity;
    const staleNote = syncAge > 6 * 3600e3 ? `Վարորդների ցուցակը թարմացվել է ${ago(f.drivers_synced_at)}. վերջին օրերի գրանցվածները կարող են դեռ չերևալ։` : '';
    mount({ title: 'Նոր վարորդներ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '<span class="dot ok"></span>Fleet-ի գրանցումներից և պատվերներից' }, page(`
      ${sec('', `<div class="card">
        <div class="hero"><span class="n">${fmt(R)}</span><span class="u">նոր վարորդ վերջին 30 օրում</span></div>
        <p class="meta">Նախորդ 30 օրում՝ ${fmt(p30.registered)}, որից առաջին պատվեր արեց ${pct(p30.first, p30.registered)}%-ը։${days1 ? ` Առաջին պատվերը՝ միջինում գրանցումից ${days1} օր հետո։` : ''}</p>
      </div>`, { foot: staleNote })}
      ${sec('Ինչ եղավ նրանց հետ', group([
        step('Գրանցվեցին', R, true),
        step('Արեցին առաջին պատվերը', m.first || 0),
        step('Հասան 10 պատվերի', m.o10 || 0),
        step('Հասան 50 պատվերի', m.o50 || 0),
        step('Այս շաբաթ աշխատել են', m.active7 || 0),
      ]), { foot: 'Վերջին օրերի գրանցվածները դեռ չեն հասցրել 50 պատվերի, դա նորմալ է։' })}
      ${sec('Ըստ շաբաթների', group(weeks), { foot: 'Աջում՝ տվյալ շաբաթ գրանցվածների քանակը, գիծը՝ քանիսն արեցին առաջին պատվերը։' })}
      ${sec('Ում զանգել', group([
        cell({ href: '#/drivers/new', icon: I.userplus, color: 'o', t: 'Գրանցվել են, պատվեր չկա', s: 'Վերջին 30 օրում', v: fmt(f.zero), strong: true }),
        cell({ href: '#/quality', icon: I.trophy, color: 'y', t: 'Yandex-ի Ոսկու համար', s: 'Այս ամիս 50 պատվերի հասած նորեկներ', v: `${fmt(h.gold.new_50)}${NB}/${NB}80`, strong: true }),
      ], 'ic'))}
      ${sec(`Սկսեցին, բայց կանգնեցին · ${fmt(f.stalled_total)}`, stalled.length ? group(stalled, 'avs') : '<div class="group"><p class="none">Այդպիսիք հիմա չկան։</p></div>',
        { foot: 'Վերջին 8 շաբաթում գրանցված, 1–49 պատվեր, վերջինը 3–30 օր առաջ։ Զանգը հիմա ամենաշատն է օգնում։' })}
    `));
  });

  // ───────── list.am վահանակ (list գործակալի բոլոր գործընթացները) ─────────
  // Տվյալները՝ channels.id='listam', լցնում է scripts\listam-import.ps1-ը Կոմպ 1-ից ժամը մեկ
  // (աղբյուրը Կոմպ 2-ի list գործակալի ֆայլերն են)։
  const daysAgo = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 864e5) : null;
  const dmyhm = (iso) => iso ? `${dmy(iso)} ${hm(iso)}` : '—';
  route('/listam', async () => {
    lastTab = 'sections';
    const [h, cr] = await Promise.all([rpc('app_home'), sb.from('channels').select('status,summary,metrics,updated_at').eq('id', 'listam').maybeSingle()]);
    pendingCount = h.tasks_pending || 0;
    const c = cr.data;
    if (!c) {
      mount({ title: 'list.am', tab: 'sections', back: ['#/sections', 'Բաժիններ'] }, page(emptyState(I.mega, 'Տվյալ դեռ չկա', 'Ցուցանիշները լցնում է Կոմպ 1-ը ժամը մեկ։')));
      return;
    }
    const M = c.metrics || {}, hl = M.health || {}, rf = M.refresh || {}, ad = M.ads || {}, ib = M.inbox || {}, mk = M.market || {}, ld = M.leads || {};
    const off = c.status === 'off', stopD = daysAgo(hl.data_at);
    // Գործընթաց. թարմ է, եթե վերջին աշխատանքը ավելի նոր է, քան սահմանը (ժամերով)
    const proc = (icon, color, t, every, at, limitH) => {
      const ms = at ? Date.now() - new Date(at) : null;
      const fresh = ms !== null && ms < limitH * 3600e3;
      const late = ms === null ? 'տվյալ չկա' : ms < 864e5 ? Math.floor(ms / 3600e3) + NB + 'ժ' : Math.floor(ms / 864e5) + NB + 'օր';
      return cell({ icon, color, t, s: `${every} · վերջինը՝ ${dmyhm(at)}`, v: fresh ? '<span class="tag pos">աշխատում է</span>' : `<span class="tag neg">${late}</span>` });
    };
    // Փաթեթ. մնացածը, ժամկետը, ինչքան կայրվի
    const left = rf.package_left, total = rf.package_total || 500, until = rf.package_until;
    const dLeft = until ? Math.max(0, Math.ceil((new Date(until) - Date.now()) / 864e5)) : null;
    const need = dLeft !== null ? (rf.ads_per_day || 17) * dLeft : null;
    const burn = off ? left : (need !== null && left != null ? Math.max(0, left - need) : null);
    const pkNote = left == null ? '' : off
      ? `Գործակալը կանգնած է, թարմացումները չեն ծախսվում. <b class="neg">${fmt(left)}-ը կայրվի ${dmy(until)}-ին</b>, եթե մինչ այդ չաշխատի։`
      : burn > 0 ? `Օրական ${rf.ads_per_day || 17}-ով մինչև ${dmy(until)} կծախսվի ${fmt(need)}, կմնա ${fmt(burn)}։` : `Կբավականացնի մինչև ${dmy(until)}։`;
    // Գովազդներ. վերջին երկու պահի տարբերությունը
    const sn = ad.snapshots || [], s1 = sn[sn.length - 1] || {}, s0 = sn[sn.length - 2] || {};
    const plus = (a, b) => (a != null && b != null) ? `+${fmt(a - b)} ${dmy(s0.day)}-ից` : '';
    const lg = ib.lang || {};
    const fn = ld.funnel || {}, bs = ld.by_status || {};
    const posAll = mk.positions || [];
    const posRows = posAll.slice().reverse().map((p) => cell({ t: dmy(p.day), s: p.in200 ? `Առաջին 100-ում՝ ${p.in100} · լավագույնը՝ #${p.best}` : 'Առաջին 200-ում չկանք', v: fmt(p.in200), strong: true }));
    const lastPos = posAll[posAll.length - 1] || {};
    const sub = off ? `<span class="dot bad"></span>Գործակալը կանգնած է ${stopD}${NB}օր` : '<span class="dot ok"></span>list գործակալ · Կոմպ 2';
    mount({ title: 'list.am', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub }, page(`
      ${off ? sec('', `<div class="err"><b>Գործակալը ${dmy(hl.data_at)}-ից չի աշխատում</b><p>Նամակներին և դիմորդներին չի պատասխանվում, գովազդները չեն բարձրանում, մրցակիցները չեն ստուգվում։ Պատճառը՝ Կոմպ 2-ը (նոութբուքը) կապ չունի. պետք է միացնել այն և բացել Chrome-ը։</p></div>`) : ''}
      ${sec('Գործընթացներ', group([
        proc(I.chat, 'b', 'Նամակներ և դիմորդներ', 'ամեն 10 րոպե', ib.last_at, 2),
        proc(I.refresh, 'g', 'Գովազդների թարմացում', 'օրը 6 անգամ', rf.last_at, 13),
        proc(I.trophy, 'o', 'Մրցակիցների ստուգում', 'ամեն օր 09:00', mk.generated, 26),
        proc(I.userplus, 'p', 'Հայտերի աղյուսակ', 'ամեն օր', ld.updated_at, 26),
      ], 'ic'), { foot: `Աջում՝ քանի օր է գործընթացը կանգնած։ Վահանակը թարմացվում է ժամը մեկ, վերջինը՝ ${ago(c.updated_at)}։` })}
      ${left != null ? sec('Թարմացման փաթեթ', `<div class="card">
        <div class="hero"><span class="n">${fmt(left)}</span><span class="u">/ ${fmt(total)} թարմացում մնաց</span></div>
        <div class="prog y"><span style="width:${Math.min(100, pct(left, total))}%"></span></div>
        <p class="meta">Ժամկետը՝ ${dmy(until)}${dLeft !== null ? ` (${dLeft}${NB}օր)` : ''}։ ${pkNote}</p>
      </div>`, { foot: ad.wallet ? `Դրամապանակ՝ ${amd(ad.wallet)} (փաթեթը գնելուց հետո)։` : '' }) : ''}
      ${sec('Հայտեր list.am-ից', group([
        cell({ t: 'Գրեցին վերջին 30 օրում', v: fmt(fn.leads30), strong: true, s: fn.day ? `7 օրում՝ ${fmt(fn.leads7)}` : '' }),
        cell({ t: 'Հեռախոս տվեցին', v: fmt(bs.phone || 0), strong: true, s: 'Սպասում են զանգի' }),
        cell({ t: 'Գրանցվեցին Fleet-ում', v: fmt(fn.registered30 != null ? fn.registered30 : (bs.registered || 0)), strong: true, s: '30 օրում' }),
        cell({ t: 'Կորած', v: fmt(bs.lost || 0), strong: true, s: `Ընդամենը ${fmt(ld.total)} հայտից` }),
      ]), { foot: `hayter գործակալի աղյուսակից, թարմացվել է ${dmyhm(ld.updated_at)}։` })}
      ${sec('Նամակներ', `<div class="kpis">
        ${kpi('Պատասխան 7 օրում', fmt(ib.d7), '')}
        ${kpi('Պատասխան 30 օրում', fmt(ib.d30), '')}
      </div>` + group([
        cell({ t: 'Հարց քեզ', s: 'Պատասխանը գիտի միայն տերը. վճար, վարձակալություն, բնակարան և այլն', v: fmt(ib.open_questions), strong: true }),
        cell({ t: 'Դիմորդներ', s: 'Աշխատանքի հայտ list.am-ով', v: fmt(ib.applicants), strong: true }),
        cell({ t: 'Նամակագրություններ', s: `Անգլ.՝ ${fmt(lg.en || 0)} · ռուս.՝ ${fmt(lg.ru || 0)} · հայ.՝ ${fmt(lg.hy || 0)}`, v: fmt(ib.threads), strong: true }),
        cell({ t: 'Թեժ հայտեր', s: 'Պատրաստ են գրանցվելու', v: fmt(ib.hot), strong: true }),
      ]), { foot: `Վերջին պատասխանը՝ ${dmyhm(ib.last_at)}։` })}
      ${sec('Գովազդներ', `<div class="kpis">
        ${kpi('Դիտում', fmt(s1.views), plus(s1.views, s0.views))}
        ${kpi('Զանգի սեղմում', fmt(s1.phone), plus(s1.phone, s0.phone))}
      </div>` + group([
        cell({ t: 'Ակտիվ գովազդ', s: ad.valid_to ? `Գործում են մինչև ${esc(ad.valid_to)}` : '', v: fmt(ad.live), strong: true }),
      ]), { foot: `Բոլոր գովազդների գումարը, ${dmy(s1.day)}-ի դրությամբ։${s0.applicants != null ? ` Դիմորդներ՝ ${fmt(s0.applicants)} (${dmy(s0.day)})։` : ''}` })}
      ${sec('Մրցակիցներ', `<div class="kpis">
        ${kpi('Yandex-ի գովազդ', fmt(mk.yandex_ads), `${fmt(mk.sellers)} վաճառողից`)}
        ${kpi('Մեր լավագույն տեղը', lastPos.best ? '#' + lastPos.best : '—', `${fmt(lastPos.in100)}-ը առաջին 100-ում`)}
      </div>` + group([
        cell({ t: 'Թոփ-ում են', s: `Մրցակիցներ՝ ${fmt(mk.rival_top)}, մենք՝ ${fmt(mk.our_top)}`, v: fmt(mk.rival_top), strong: true }),
      ].concat(posRows)), { foot: `Ըստ օրերի՝ մեր գովազդների տեղը list.am-ի ցուցակում, աջում՝ քանիսն են առաջին 200-ում։ Ստուգումը՝ ${dmyhm(mk.generated)}։` })}
    `));
  });

  // ───────── ChatGPT (AI տեսանելիություն) ─────────
  // Տվյալները՝ app_geo() / app_geo_answers() (db\0012_geo.sql). լցնում է HayWay-ի համակարգչի «Garik-GEO» task-ը շաբաթը մեկ
  // (scripts\geo-weekly.ps1). ChatGPT-ին հարցնում է առանց մուտքի՝ ինչպես աշխատանք փնտրող նոր վարորդը կամ առաքիչը։
  const LANG = { hy: 'հայերեն', ru: 'ռուսերեն', en: 'անգլերեն', hi: 'հինդի', fa: 'պարսկերեն' };
  const WHO = { driver: 'վարորդ', courier: 'առաքիչ', both: 'վարորդ և առաքիչ' };
  const wkLabel = (wk) => {
    const [y, n] = String(wk || '').split('-W').map(Number);
    if (!y || !n) return '';
    const j4 = Date.UTC(y, 0, 4), mon = j4 - ((new Date(j4).getUTCDay() + 6) % 7) * 864e5 + (n - 1) * 7 * 864e5;
    const f = (t) => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
    return `${f(mon)}–${f(mon + 6 * 864e5)}`;
  };
  const place = (x) => 'տեղը՝' + NB + String(x).replace('.', ',');
  route('/geo', async (qid) => {
    lastTab = 'sections';
    if (qid) return geoQuestion(qid);
    const [h, g] = await Promise.all([rpc('app_home'), rpc('app_geo')]);
    pendingCount = h.tasks_pending || 0;
    const L = g.last, run = g.runner || {};
    const runAge = run.seen_at ? Date.now() - new Date(run.seen_at) : Infinity;
    const sub = !run.seen_at ? '<span class="dot wait"></span>Ստուգողը միանում է HayWay-ի համակարգչում'
      : runAge < 3 * 864e5 ? '<span class="dot ok"></span>ChatGPT-ի ստուգում՝ շաբաթը մեկ'
      : `<span class="dot bad"></span>Ստուգողը կանգնած է ${ago(run.seen_at)}`;
    if (!L) {
      mount({ title: 'ChatGPT', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub }, page(emptyState(I.ai, 'Առաջին ստուգումը դեռ չի եղել',
        'Շաբաթը մեկ HayWay-ի համակարգիչը ChatGPT-ին տալիս է 20 հարց, որ տալիս են աշխատանք փնտրող վարորդներն ու առաքիչները, և այստեղ ցույց է տալիս՝ որտեղ ենք և որտեղ չկանք։')));
      return;
    }
    const S = L.summary || {}, Q = S.queries || [], hist = g.history || [];
    const prev = hist.length > 1 ? hist[hist.length - 2] : null;
    const gen = Q.filter((q) => q.kind !== 'brand' && q.n);
    const yes = gen.filter((q) => q.state === 'yes' || q.state === 'some'), no = gen.filter((q) => q.state === 'no');
    const qs = (q) => `${LANG[q.lang] || q.lang} · ${WHO[q.who] || ''}`;
    const ST = { doing: '<span class="tag info">աշխատում ենք</span>', todo: '<span class="tag n">հաջորդը</span>' };
    const acts = (g.actions || []).map((a) => cell({ t: esc(a.title), s: esc([a.place, a.why].filter(Boolean).join(' · ')),
      v: a.status === 'done' ? `<span class="tag pos">արված${a.done_at ? ' ' + dmy(a.done_at) : ''}</span>` : (ST[a.status] || '') }));
    const mk = S.markets || {}, meta = S.markets_meta || {};
    const mrows = Object.keys(meta).filter((k) => mk[k]).map((k) => cell({ t: `${meta[k].flag} ${esc(meta[k].name)}`, s: `${mk[k].hit} պատասխանում ${mk[k].n}-ից`,
      v: `${fmt(mk[k].pct)}%`, strong: true, extra: `<div class="mbar"><span style="width:${mk[k].pct || 0}%"></span></div>` }));
    const ours = (S.our_links || []).map((o) => esc(o.t || o.u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)));
    mount({ title: 'ChatGPT', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub }, page(`
      ${sec('', `<div class="card">
        <div class="hero"><span class="n">${fmt(L.score)}%</span><span class="u">պատասխաններում ChatGPT-ն նշում է HayWay-ը</span></div>
        <p class="meta">${prev ? `Անցյալ շաբաթ՝ ${fmt(prev.score)}%։` : 'Առաջին ստուգումն է. համեմատությունը՝ հաջորդ շաբաթից։'}${S.rank_avg ? ` Առաջարկվող պարկերի ցուցակում HayWay-ի միջին ${place(S.rank_avg)}։` : ''}</p>
        ${L.note ? `<p class="meta"><b>${esc(L.note)}</b></p>` : ''}
      </div><div class="kpis" style="margin-top:8px">
        ${kpi('Հարցեր, որտեղ կանք', `${yes.length}${NB}/${NB}${gen.length}`, '')}
        ${kpi('ChatGPT-ն մեզ ճանաչում է', `${fmt(L.brand)}%`, 'HayWay-ի մասին հարցերում')}
      </div>`, { foot: `Ով է հարցնում՝ աշխատանք փնտրող վարորդ կամ առաքիչ։ Ամեն հարց տրվում է 3 անգամ, ChatGPT-ին առանց մուտքի։` })}
      ${sec('Ինչի վրա ենք աշխատում', acts.length ? group(acts) : '<div class="group"><p class="none">Քայլերը կգրվեն ստուգումից հետո։</p></div>')}
      ${no.length ? sec(`Որտեղ չկանք · ${no.length}`, group(no.map((q) => cell({ href: '#/geo/' + q.id, t: esc(q.q),
        s: `${qs(q)}${q.rivals && q.rivals.length ? ' · փոխարենը՝ ' + q.rivals.slice(0, 3).map(esc).join(', ') : ''}`, v: '<span class="tag neg">չկանք</span>' }))),
        { foot: 'Սեղմիր հարցի վրա՝ կարդալու, թե ChatGPT-ն ինչ է պատասխանում։' }) : ''}
      ${sec(`Որտեղ կանք · ${yes.length}`, yes.length ? group(yes.map((q) => cell({ href: '#/geo/' + q.id, t: esc(q.q),
        s: `${qs(q)} · ${q.hit}/${q.n} անգամ${q.rank ? ' · ' + place(q.rank) : ''}`,
        v: q.state === 'yes' ? '<span class="tag pos">կանք</span>' : '<span class="tag warn">երբեմն</span>' }))) : '<div class="group"><p class="none">Դեռ ոչ մի հարցում։</p></div>')}
      ${sec('Ըստ երկրի և լեզվի', group(mrows), { foot: 'Ռուսաստան, Հնդկաստան, Իրան՝ օտարերկրացի վարորդներն ու առաքիչները հարցնում են իրենց լեզվով։' })}
      ${(S.rivals || []).length ? sec('Ում է ChatGPT-ն առաջարկում', group(S.rivals.slice(0, 6).map((r) => cell({ t: esc(r.name), s: `${r.n} պատասխանում`, v: `${fmt(r.pct)}%`, strong: true }))),
        { foot: 'Այլ պարկեր, որ ChatGPT-ն նշում է նույն հարցերին։' }) : ''}
      ${(S.sources || []).length ? sec('Որտեղից է ChatGPT-ն վերցնում', group(S.sources.slice(0, 8).map((s) => cell({ t: esc(s.domain), v: fmt(s.n), strong: true,
        trail: s.ours ? '<span class="tag pos">մերն էլ կա</span>' : '' }))),
        { foot: `ChatGPT-ն պատասխանը գրում է այս կայքերից։ Այստեղ լինել = ChatGPT-ում լինել։${ours.length ? ' Մեր էջերը՝ ' + ours.slice(0, 4).join(', ') + '։' : ''}` }) : ''}
      ${hist.length > 1 ? sec('Ըստ շաբաթների', group(hist.slice().reverse().map((x) => cell({ t: wkLabel(x.week), s: `${x.answers} պատասխան`, v: `${fmt(x.score)}%`, strong: true })))) : ''}
      <p class="sec-f">Վերջին ստուգումը՝ ${wkLabel(L.week)}, ${L.answers} պատասխան։</p>
    `));
  });

  // Մեկ հարցի պատասխանները՝ ինչպես ChatGPT-ն է գրել
  async function geoQuestion(id) {
    const [h, rows] = await Promise.all([rpc('app_home'), rpc('app_geo_answers', { p_id: id })]);
    pendingCount = h.tasks_pending || 0;
    const r0 = rows[0] || {};
    const cards = rows.filter((r) => r.ok).map((r) => sec(`Պատասխան ${r.rep}`, `<div class="card">
        <div>${r.mentioned ? `<span class="tag pos">HayWay-ը կա${r.rank ? ' · ' + place(r.rank) : ''}</span>` : '<span class="tag neg">HayWay-ը չկա</span>'}${r.our_cited ? ' <span class="tag info">մեր էջը աղբյուր է</span>' : ''}</div>
        <div class="ans clip" dir="auto">${esc(r.answer)}</div>
        <button class="btn full ans-more" type="button">Կարդալ ամբողջը</button>
        ${(r.sources || []).length ? `<p class="meta">Աղբյուրներ՝ ${r.sources.map(esc).join(', ')}</p>` : ''}
      </div>`));
    const sc = mount({ title: 'ChatGPT-ի պատասխանը', tab: 'sections', back: ['#/geo', 'ChatGPT'], sub: esc(`${LANG[r0.lang] || ''} · ${wkLabel(r0.week)}`) }, page(`
      ${sec('Հարցը', `<div class="card"><h3 dir="auto">${esc(r0.q || id)}</h3></div>`)}
      ${cards.join('') || sec('', '<div class="group"><p class="none">Պատասխան դեռ չկա։</p></div>')}
    `));
    sc.querySelectorAll('.ans-more').forEach((b) => b.onclick = () => { b.previousElementSibling.classList.remove('clip'); b.remove(); });
  }

  // ───────── Վարորդներ ─────────
  const SEGS =[['active', 'Ակտիվ'], ['top', 'Լավագույն 30'], ['risk', 'Կանգնածներ'], ['new', 'Նորեկներ'], ['churned', 'Հեռացած'], ['debt', 'Պարտքով'], ['cancellers', 'Չեղարկողներ']];
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
    const [h, f, notes] = await Promise.all([rpc('app_home'), rpc('app_finance'), rpc('app_notes')]);
    pendingCount = h.tasks_pending || 0;
    const m = f.month, b = f.balances;
    const fd = (f.days || []).filter((d) => d.day < today());
    const sm = (a, k) => a.reduce((s, d) => s + (+d[k] || 0), 0);
    const w = { gmv: sm(fd.slice(-7), 'gmv'), commission: sm(fd.slice(-7), 'commission') }, p = { gmv: sm(fd.slice(-14, -7), 'gmv'), commission: sm(fd.slice(-14, -7), 'commission') };
    const tops = (f.topups_by_provider || []);
    const kv = (t, v, s) => cell({ t, s, v, strong: true });
    mount({ title: 'Ֆինանսներ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '<span class="dot ok"></span>Ֆինանսիստ · Fleet-ի գործարքներից' }, page(`
      ${sec('Վերջին 7 օր', `<div class="kpis">
        ${kpi('Շրջանառություն', short(w.gmv), delta(w.gmv, p.gmv))}
        ${kpi('Պարկի եկամուտ', short(w.commission), delta(w.commission, p.commission))}
      </div>`, { foot: ('Լրիվ օրեր՝ առանց այսօրվա, նախորդ 7 օրվա համեմատ։ ' + estNote(notes, 15)).trim() })}
      ${sec('Եկամուտ ըստ օրերի', `<div class="card">${barChart('ch-comm', f.days, 'commission', (v) => amd(Math.round(v)), '')}</div>`)}
      ${sec('Վերջին 30 օր', group([
        kv('Շրջանառություն', short(m.gmv)),
        kv('Կանխիկ · Քարտ · Կորպ.', `${pct(m.cash, m.gmv)} · ${pct(m.cashless, m.gmv)} · ${pct(m.corporate, m.gmv)}%`),
        kv('Պարկի կոմիսիա', short(m.commission), `${(m.gmv ? m.commission / m.gmv * 100 : 0).toFixed(2).replace('.', ',')}% շրջանառությունից`),
        kv('Վճարումներ վարորդներին', short(m.payouts)),
        kv('Լիցքավորումներ', short(m.topups)),
        kv('Մեկ ակտիվ վարորդից', amd(Math.round(m.active ? m.commission / m.active : 0))),
      ]), { foot: estNote(notes, 30) })}
      ${sec('Հաշվեկշիռներ հիմա', group([
        kv('Վարորդների դրական հաշվեկշիռ', short(b.positive)),
        cell({ href: '#/drivers/debt', t: 'Պարտք', s: `${b.negative_drivers} վարորդ`, v: `<span class="neg">${short(b.negative)}</span>`, strong: true }),
      ]), { foot: driversLine(notes) })}
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
          ? `<div class="between"><span class="tag ${t.status === 'approved' ? 'pos' : 'n'}">${t.status === 'approved' ? (t.kind === 'call' ? 'Կզանգենք' : 'Հաստատված') : (t.kind === 'call' ? 'Պետք չէ' : 'Մերժված')} · ${dmy(t.decided_at)}</span><button class="btn plain" data-act="undo">Չեղարկել</button></div>`
          : `<div class="btns"><button class="btn" data-act="reject">${t.kind === 'call' ? 'Պետք չէ' : 'Մերժել'}</button><button class="btn pri" data-act="approve">${t.kind === 'call' ? 'Կզանգենք' : 'Հաստատել'}</button></div>`}
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
  // 2026-11-03. Զրույցը պահվում է բազայում (assistant_msgs, db\0010_assistant.sql)։ Առանց API բանալու (mode «pc») պատասխանում է
  // HayWay-ի համակարգչում տիրոջ Claude-ը (scripts\assistant-run.ps1)՝ 1–2 րոպեում. հավելվածը այդ ընթացքում ամեն 5 վրկ նայում է app_assistant()-ին։
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
  async function assistantNow() { const { data, error } = await sb.rpc('app_assistant'); if (error) throw new Error(error.message); return data || { msgs: [] }; }
  // Excel (CSV, Excel-ը բացում է). հեռախոսները գալիս են միայն այս սարքին, Claude-ին չեն գնում
  async function downloadRows(id, title) {
    const { data, error } = await sb.rpc('app_action_rows', { p_id: id });
    if (error) throw new Error(error.message);
    const cols = [['first_name', 'Անուն'], ['last_name', 'Ազգանուն'], ['phones', 'Հեռախոս'], ['orders_30d', 'Պատվեր 30 օր'], ['orders_7d', 'Պատվեր 7 օր'],
      ['idle_days', 'Օր առանց պատվերի'], ['balance', 'Հաշվեկշիռ ֏'], ['hire_date', 'Գրանցվել'], ['rule_name', 'Պայման'], ['car', 'Մեքենա']];
    const val = (d, k) => k === 'phones' ? (d.phones || []).join(', ') : k === 'idle_days' ? (d.idle_days == null ? '' : Math.floor(d.idle_days))
      : k === 'car' ? [d.car_brand, d.car_model, d.car_year].filter(Boolean).join(' ') : (d[k] ?? '');
    const csvCell = (v) => { const s = String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [cols.map((c) => c[1]).join(';')].concat((data || []).map((d) => cols.map((c) => csvCell(val(d, c[0]))).join(';')));
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `HayWay — ${String(title).slice(0, 40).replace(/[\\/:*?"<>|]/g, '')} ${today()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  // Պատասխանողը միացա՞ծ է. HayWay-ի համակարգիչը սրտի զարկ է տալիս ամեն րոպե
  const runnerOn = (r) => Boolean(r && r.seen_at && Date.now() - new Date(r.seen_at) < 4 * 60000 && r.claude !== false);
  let chatPoll = null;
  const QS = ['Ում զանգենք այսօր', 'Ինչ կա Գործերում', 'Ինչպես հասնել Ոսկու մակարդակի', 'Ինչպես անցավ այս շաբաթը', 'Ով է ամենաշատը չեղարկում'];
  route('/garik', async () => {
    lastTab = 'garik';
    clearTimeout(chatPoll);
    try { localStorage.removeItem('hw_chat'); } catch (e) {}
    const [h, st, as] = await Promise.all([rpc('app_home'), garikState(), assistantNow()]);
    pendingCount = h.tasks_pending || 0;
    const w = h.week;
    const pc = st.mode === 'pc', on = !pc || runnerOn(as.runner);
    const offNote = !st.ok ? '\n\nԳարիկը հիմա կապ չունի, փորձիր մի քիչ հետո։'
      : (on ? '' : `\n\nՊատասխանողը (HayWay-ի համակարգիչը) հիմա անջատված է${as.runner && as.runner.seen_at ? `, վերջին անգամ՝ ${ago(as.runner.seen_at)}` : ''}։ Հարցդ կպահվի, պատասխանը կգա, երբ այն միանա։`);
    const hello = `Բարև։ Այս շաբաթ՝ ${fmt(w.orders)} պատվեր և ${short(w.commission)} պարկի եկամուտ։ Եկավ ${w.new}, գնաց ${w.churn} վարորդ, հիմա գծում է ${h.online.total}-ը։${h.tasks_pending ? `\nԳործերում ${h.tasks_pending} առաջարկ սպասում է քեզ։` : ''}${offNote}`;
    const bubble = (cls, text, note) => `<div class="msg ${cls}">${esc(text)}${note ? `<span class="note">${esc(note)}</span>` : ''}</div>`;
    const waitText = on ? 'Գարիկը նայում է թվերին… պատասխանը՝ 1–2 րոպեում' : 'Հարցը պահված է։ Պատասխանը կգա, երբ HayWay-ի համակարգիչը միանա';
    const waiting = (m) => m.status === 'pending' || m.status === 'working';
    // «Կատարե՞մ» քարտերը (db\0011). կատարում է միայն բազայի կոդը՝ տիրոջ «Այո»-ից հետո
    const dayHm = (iso) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yerevan' }).replace(',', '');
    const actDone = (a) => {
      const r = a.result || {};
      switch (a.type) {
        case 'task_decide': return r.decision === 'reject' ? 'Մերժված է' : 'Հաստատված է';
        case 'call_list': return `${fmt(r.n || 0)} վարորդ՝ Գործերում`;
        case 'export': return `${fmt(r.n || 0)} վարորդ`;
        case 'remind': return `Կհիշեցնեմ ${r.at ? dayHm(r.at) : ''}`;
        case 'watch': return `Հսկում եմ${r.now != null ? ` (հիմա՝ ${fmt(r.now)})` : ''}`;
        case 'remember': return 'Հիշեցի';
        default: return 'Արված է';
      }
    };
    const actCard = (a) => {
      let foot = '';
      if (a.status === 'proposed') foot = `<div class="act-b"><button type="button" class="btn pri sm" data-yes="${a.id}">Այո, արա</button><button type="button" class="btn sm gray" data-no="${a.id}">Ոչ</button></div>`;
      else if (a.status === 'done') foot = `<div class="act-s"><span class="pos">✓ ${esc(actDone(a))}</span>
          ${a.type === 'export' || a.type === 'call_list' ? `<button type="button" class="btn plain sm" data-xls="${a.id}">Excel</button>` : ''}
          ${a.type === 'call_list' ? '<a class="btn plain sm" href="#/tasks">Գործեր</a>' : ''}
          ${a.type !== 'export' ? `<button type="button" class="btn plain sm" data-undo="${a.id}">Հետ բերել</button>` : ''}</div>`;
      else foot = `<div class="act-s"><span class="${a.status === 'failed' ? 'neg' : 'mut'}">${esc({ rejected: 'Չեղարկված', undone: 'Հետ է բերված', expired: 'Ժամկետն անցել է',
        failed: 'Չստացվեց' + (a.result && a.result.error ? '՝ ' + a.result.error : '') }[a.status] || a.status)}</span></div>`;
      return `<div class="act ${a.status}"><span class="act-h">${a.status === 'proposed' ? 'Կատարե՞մ' : 'Գործողություն'}</span><p class="act-t">${esc(a.summary)}</p>${foot}</div>`;
    };
    const thread = (list) => list.map((m) => (m.kind === 'notice' ? `<div class="msg ai notice"><span class="note-h">Հիշեցում · ${dayHm(m.answered_at || m.at)}</span>${esc(m.a)}</div>`
      : bubble('me', m.q) + (waiting(m) ? bubble('ai typing', waitText)
      : bubble('ai', m.a || 'Պատասխան չկա։', m.proposed && m.proposed.length ? `Գործերում նոր առաջարկ՝ «${m.proposed.join('», «')}»` : '')
        + (m.actions || []).map(actCard).join('')))).join('');
    const sugg = `<div class="sugg" id="sugg">${QS.map((q) => `<button data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
    let msgs = as.msgs || [];
    const sc = mount({ title: 'Գարիկ', tab: 'garik', compact: true,
      right: `<button class="ibtn" id="clear" aria-label="Մաքրել զրույցը">${I.trash}</button>`,
      after: `<div class="composer"><textarea id="q" rows="1" placeholder="${st.ok ? 'Հարցրու Գարիկին…' : 'Գարիկը դեռ միացված չէ'}" enterkeyhint="send"></textarea><button class="send" id="send" aria-label="Ուղարկել" disabled>${I.send}</button></div>` },
      `<div class="chat" id="chat">${bubble('ai', hello)}<div class="chat" id="thread" style="padding:0">${thread(msgs)}</div>${msgs.length ? '' : sugg}</div>`);
    const q = document.getElementById('q'), send = document.getElementById('send'), threadEl = document.getElementById('thread');
    const down = () => { sc.scrollTop = sc.scrollHeight; };
    const paint = () => { threadEl.innerHTML = thread(msgs); down(); };
    const grow = () => { q.style.height = 'auto'; q.style.height = Math.min(132, q.scrollHeight) + 'px'; send.disabled = !q.value.trim() || busy || !st.ok; };
    let busy = false;
    // Քարտերի կոճակները (մեկ ունկնդիր ամբողջ զրույցի համար, որ paint()-ից հետո էլ աշխատի)
    const setAct = (a) => { msgs = msgs.map((m) => ({ ...m, actions: (m.actions || []).map((x) => x.id === a.id ? { ...x, status: a.status, result: a.result } : x) })); paint(); };
    threadEl.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-yes],button[data-no],button[data-undo],button[data-xls]');
      if (!b || b.disabled) return;
      const card = b.closest('.act');
      card.querySelectorAll('button').forEach((x) => x.disabled = true);
      try {
        if (b.dataset.xls) { await downloadRows(+b.dataset.xls, card.querySelector('.act-t').textContent); card.querySelectorAll('button').forEach((x) => x.disabled = false); return; }
        const { data, error } = b.dataset.undo ? await sb.rpc('app_action_undo', { p_id: +b.dataset.undo })
          : await sb.rpc('app_action_decide', { p_id: +(b.dataset.yes || b.dataset.no), p_yes: !!b.dataset.yes });
        if (error) throw new Error(error.message);
        invalidate();
        setAct(data);
      } catch (err) {
        card.querySelectorAll('button').forEach((x) => x.disabled = false);
        alert('Չստացվեց՝ ' + err.message);
      }
    });
    // Պատասխանի սպասում. երբ սպասվող հարց կա և մենք դեռ այս էկրանում ենք
    const poll = () => {
      clearTimeout(chatPoll);
      if (!msgs.some(waiting)) return;
      chatPoll = setTimeout(async () => {
        if ((location.hash || '#/') !== '#/garik') return;
        try {
          const wasWaiting = new Set(msgs.filter(waiting).map((m) => m.id));
          msgs = (await assistantNow()).msgs || [];
          const fresh = msgs.filter((m) => wasWaiting.has(m.id) && !waiting(m));
          const n = fresh.reduce((s, m) => s + ((m.proposed && m.proposed.length) || 0), 0);
          if (n) { invalidate(); pendingCount += n; }
          if (fresh.length) paint();
        } catch (e) {}
        poll();
      }, 5000);
    };
    down();
    poll();
    async function ask(text) {
      text = String(text || '').trim(); if (!text || busy || !st.ok) return;
      busy = true; q.value = ''; grow();
      const s = document.getElementById('sugg'); if (s) s.remove();
      msgs = [...msgs, { id: 0, q: text, status: 'pending' }]; paint();
      let extra = null;
      try {
        const r = await garikCall('POST', { question: text });
        if (!r.queued && r.error) extra = { id: 0, q: text, a: r.answer || 'Սխալ եղավ։', status: 'error' };
        if (r.proposed && r.proposed.length) { invalidate(); pendingCount += r.proposed.length; }
        msgs = (await assistantNow()).msgs || [];
      } catch (e) { msgs = msgs.slice(0, -1); extra = { id: 0, q: text, a: 'Կապի սխալ՝ ' + e.message, status: 'error' }; }
      if (extra) msgs = [...msgs, extra];
      paint(); busy = false; grow(); poll();
    }
    q.addEventListener('input', grow);
    send.onclick = () => ask(q.value);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q.value); } });
    q.addEventListener('focus', () => setTimeout(down, 300));
    app.querySelectorAll('#sugg button').forEach((c) => c.onclick = () => ask(c.dataset.q));
    document.getElementById('clear').onclick = async () => { if (confirm('Մաքրե՞լ զրույցը։')) { clearTimeout(chatPoll); await sb.rpc('app_assistant_clear'); render(); } };
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
    if (l.agent === 'assistant') return ['Գարիկ · միացում', d.ok === true || d.code === 0 ? 'պատրաստ է' : 'դեռ չի միացել'];
    if (l.action.startsWith('act_')) return [`Դու · ${{ act_done: 'Գարիկը արեց', act_reject: 'ասացիր «Ոչ»', act_failed: 'չստացվեց', act_undo: 'հետ բերեցիր' }[l.action] || l.action}`, d.title || ''];
    if (l.action === 'notice') return ['Գարիկ · հիշեցում', ''];
    if (l.action === 'tg_link') return ['Դու · միացրիր Telegram-ը', d.name || ''];
    if (l.action === 'tg_unlink') return ['Դու · անջատեցիր Telegram-ը', ''];
    if (l.action === 'push_on') return ['Դու · միացրիր ծանուցումները', ''];
    if (l.action === 'push_off') return ['Դու · անջատեցիր ծանուցումները', ''];
    if (l.agent === 'owner-bot' && l.action === 'flush') return ['Գարիկ · ծանուցում', `Telegram՝ ${d.sent || 0}, հեռախոս՝ ${d.pushed || 0}`];
    if (l.action === 'error') return [`${l.agent} · սխալ`, String(d.msg || '').slice(0, 90)];
    if (l.action.startsWith('task_')) return [`Դու · ${{ task_approve: 'հաստատեցիր', task_reject: 'մերժեցիր', task_undo: 'չեղարկեցիր' }[l.action] || l.action}`, d.title || ''];
    if (l.action === 'agents_off') return ['Գործակալները կանգնեցվեցին', ''];
    if (l.action === 'agents_on') return ['Գործակալները միացվեցին', ''];
    return [`${l.agent} · ${l.action}`, ''];
  };
  // Վարորդների ցուցակի (հաշվեկշիռ, գծում լինել) թարմությունը. Fleet-ը երբեմն մերժում է այդ հարցումը
  const driversLine = (n) => { if (!n) return ''; const ok = n.drivers_synced_at; if (n.drivers_error && (!ok || new Date(n.drivers_error.at) > new Date(ok))) return `Պատվերները թարմ են։ Վարորդների ցուցակը Fleet-ը ժամանակավորապես չի տալիս${ok ? `, վերջինը՝ ${ago(ok)}` : ''}։`; return ok ? `Վարորդների ցուցակը՝ ${ago(ok)}` : ''; };
  route('/settings', async () => {
    lastTab = 'settings';
    const [h, st, notes, logsR, usersR, agR, sessR, asR, brain, tgS] = await Promise.all([
      rpc('app_home'), garikState(), rpc('app_notes'),
      sb.from('agent_log').select('at,agent,action,details').order('id', { ascending: false }).limit(10),
      sb.from('app_users').select('email,role,name'),
      sb.from('sync_state').select('value').eq('key', 'agents').maybeSingle(),
      sb.auth.getSession(),
      assistantNow().catch(() => null),
      sb.rpc('app_brain').then((r) => r.data || [], () => []),
      sb.rpc('app_tg').then((r) => r.data || {}, () => ({})),
    ]);
    const ps = await pushState();
    pendingCount = h.tasks_pending || 0;
    const agentsOn = !(agR.data && agR.data.value && agR.data.value.enabled === false);
    const session = sessR.data.session;
    const logs = (logsR.data || []).map((l) => { const [t, s] = logText(l); const sameDay = new Date(l.at).toDateString() === new Date().toDateString(); return cell({ t: esc(t), s: esc(s), v: `<span class="mut3" style="font-size:13px">${sameDay ? hm(l.at) : dmy(l.at)}</span>` }); });
    const users = (usersR.data || []).map((u) => cell({ t: esc(u.email), v: `<span class="tag ${u.role === 'owner' ? 'k' : 'n'}">${u.role === 'owner' ? 'տեր' : 'դիսպետչեր'}</span>` }));
    mount({ title: 'Կարգավորումներ', tab: 'settings' }, page(`
      ${sec('Գործակալներ', group([cell({ icon: I.star, color: 'k', t: 'Ավտոմատ առաջարկներ', s: 'Ամեն առավոտ 08:30', trail: `<label class="sw"><input type="checkbox" id="agents" ${agentsOn ? 'checked' : ''} aria-label="Գործակալները միացված են"><span></span></label>` })], 'ic'),
        { foot: 'Պահպանող, Որակի վերահսկիչ և Ֆինանսիստ առաջարկներ են դնում Գործերում և ոչինչ չեն անում առանց քո հաստատման։ Անջատելուց հետո Fleet-ի թարմացումը շարունակվում է։' })}
      ${sec('Միացումներ', group([
        cell({ icon: I.car, color: 'y', t: 'Yandex Fleet · տաքսի', s: driversLine(notes), v: `<span class="tag pos">${ago(h.last_sync)}</span>` }),
        cell({ icon: I.box, color: 't', t: 'Yandex Fleet · Delivery', v: '<span class="tag warn">մուտք չկա</span>' }),
        cell({ icon: I.star, color: 'k', t: 'Գարիկ · Claude', s: st.mode === 'pc' ? `Ձեր Claude-ով, HayWay-ի համակարգչից${asR && asR.runner && asR.runner.seen_at ? ` · ${ago(asR.runner.seen_at)}` : ''}` : '',
          v: !st.ok ? '<span class="tag warn">կապ չկա</span>' : st.mode !== 'pc' ? '<span class="tag pos">միացված</span>'
            : runnerOn(asR && asR.runner) ? '<span class="tag pos">միացված</span>' : '<span class="tag warn">անջատված</span>' }),
        cell({ icon: I.star, color: 'y', t: 'Ծանուցումներ այս հեռախոսում',
          s: ps.on ? 'Պատասխաններ, հիշեցումներ և «Կատարե՞մ» քարտեր' : ps.denied ? 'Արգելված է հեռախոսի կարգավորումներում' : !ps.ok ? 'iPhone-ում՝ միայն Home Screen-ին ավելացված հավելվածում' : 'Գարիկը կտեղեկացնի, երբ պատասխանի',
          trail: ps.on ? '<button type="button" class="btn plain sm" data-pushoff>Անջատել</button>' : ps.ok && !ps.denied ? '<button type="button" class="btn pri sm" data-pushon>Միացնել</button>' : '' }),
        ...(tgS.username ? [cell({ icon: I.chat, color: 'b', t: 'Telegram · Գարիկի ծանուցումներ',
          s: tgS.linked ? `@${esc(tgS.username)}${tgS.name ? ' · ' + esc(tgS.name) : ''}` : 'Պատասխաններ, հիշեցումներ և «Այո/Ոչ» քարտեր',
          trail: tgS.linked ? '<button type="button" class="btn plain sm" data-tgunlink>Անջատել</button>' : '<button type="button" class="btn pri sm" data-tglink>Միացնել</button>' })] : []),
        cell({ icon: I.chat, color: 'g', t: 'WhatsApp բոտ', v: '<span class="tag pos">աշխատում է</span>' }),
        cell({ icon: I.mega, color: 'o', t: 'list.am', v: '<span class="tag n">Կոմպ 2-ում</span>' }),
        cell({ icon: I.money, color: 'b', t: 'PrimeBridge', v: '<span class="tag n">շուտով</span>' }),
      ], 'ic'))}
      ${brain.length ? sec('Գարիկը հիշում է', group(brain.map((b) => cell({ t: esc(b.text), s: dmy(b.at),
        trail: `<button type="button" class="btn plain sm" data-forget="${b.id}">Մոռանալ</button>` }))),
        { foot: 'Ձեր ասածները, որ Գարիկը հաշվի է առնում ամեն պատասխանում։ Նորը՝ զրույցում գրեք «հիշիր, որ …»։' }) : ''}
      ${sec('Մուտք ունեն', group(users))}
      ${sec('Վերջին գործողությունները', group(logs.length ? logs : ['<p class="none">Դեռ ոչինչ</p>']))}
      ${sec('Գաղտնաբառ', `<div class="card">
        <p class="meta">Դիր գաղտնաբառ, որ հավելվածը բացվի առանց փոստի հղման։ Առնվազն 8 նիշ։</p>
        <input id="newpw" class="in" type="password" autocomplete="new-password" placeholder="Նոր գաղտնաբառ">
        <button class="btn dark full" id="setpw">Պահել գաղտնաբառը</button>
        <p id="pwmsg" class="meta"></p>
      </div>`)}
      ${sec('', group([`<button class="cell" id="signout" style="justify-content:center"><span class="t neg" style="text-align:center">Դուրս գալ</span></button>`]), { foot: `Մուտք՝ ${esc(session?.user?.email || '')} · տարբերակ 0.12` })}
    `));
    document.getElementById('signout').onclick = () => sb.auth.signOut().then(render);
    bindTg();
    bindPush();
    app.querySelectorAll('[data-forget]').forEach((b) => b.onclick = async () => {
      if (!confirm('Մոռանա՞լ սա։')) return;
      b.disabled = true;
      const { error } = await sb.rpc('app_brain_forget', { p_id: +b.dataset.forget });
      if (error) { b.disabled = false; alert('Չստացվեց՝ ' + error.message); return; }
      render();
    });
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
