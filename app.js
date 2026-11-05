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
  // ԿԱ 2. ետևի մեղմ գունային լույսերը (styles.css → .aura)
  document.body.insertAdjacentHTML('afterbegin', '<div class="aura" aria-hidden="true"><i></i><i></i><i></i></div>');

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
    team: sv(26, '<path d="M3.5 5.5h12v8.5H8l-4.5 3.5z"/><path d="M15.5 9h5v8.5l-3-2.5h-6.5v-1"/>'),
    box: sv(20, '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>'),
    trophy: sv(20, '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 6h3v1a3 3 0 0 1-3 3M7 6H4v1a3 3 0 0 0 3 3"/>'),
    alert: sv(20, '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.5"/>'),
    link: sv(20, '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    key: sv(20, '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>'),
    clock: sv(20, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    send: sv(20, '<path d="M12 19V5M5 12l7-7 7 7"/>', ' style="stroke-width:2.4"'),
    trash: sv(22, '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    car: sv(20, '<path d="M5 17h14v-5l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>'),
    film: sv(20, '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>'),
    mic: sv(20, '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    plus: sv(22, '<path d="M12 5v14M5 12h14"/>'),
    // 04.11. Դավիթի АРОМАТИКА-ի նշանները. «⋯» ավելին, ժամացույց = հին զրույցներ, մատիտ = նոր զրույց
    more: '<svg class="i" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    hist: sv(22, '<path d="M3.5 12A8.5 8.5 0 1 0 6 6L3.5 8.5"/><path d="M3.5 4v4.5H8"/><path d="M12 7.5V12l3 1.8"/>'),
    compose: sv(22, '<path d="M11.5 4H6.2A2.2 2.2 0 0 0 4 6.2v11.6A2.2 2.2 0 0 0 6.2 20h11.6a2.2 2.2 0 0 0 2.2-2.2v-5.3"/><path d="M17.6 3.6a1.9 1.9 0 0 1 2.8 2.8l-7.6 7.6-3.6.9.9-3.6z"/>'),
    ai: sv(20, '<path d="M4 5h16v11H9l-5 4z"/><path d="m12 7.5 1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z"/>'),
    logo: '<svg width="44" height="44" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#111113"/><path d="M16 6.5c-4 0-7 3-7 6.8 0 4.9 7 12.2 7 12.2s7-7.3 7-12.2c0-3.8-3-6.8-7-6.8z" fill="#FCE000"/><circle cx="16" cy="13.2" r="2.9" fill="#111113"/></svg>',
  };

  // ───────── Տվյալներ ─────────
  async function fetchRpc(fn, args) {
    let { data, error } = await sb.rpc(fn, args || {});
    // 03.11. Բազան երբեմն զբաղված է (Fleet-ի համաժամացումը 15 րոպեն մեկ) → 8 վրկ սահմանը անցնում է. մեկ անգամ նորից, մինչև սխալը ցույց տալը
    if (error && (error.code === '57014' || /statement timeout/i.test(error.message || ''))) {
      await new Promise((r) => setTimeout(r, 1500));
      ({ data, error } = await sb.rpc(fn, args || {}));
    }
    if (error) throw new Error(error.message);
    return data;
  }
  // 03.11 (Գարիկ. «շատ բաժիններ դանդաղ են բացվում»). Կարդալու պատասխանները պահվում են նաև այս սարքում (localStorage, 12 ժամ).
  // Էկրանը նկարելիս (render) հին պատասխանը տրվում է անմիջապես, թարմը բերվում է ետևում, և եթե փոխվել է՝ էկրանը լուռ թարմանում է
  // նույն տեղում (render(true)). Գործողությունից հետո invalidate()-ը ջնջում է պահածը, որ հին վիճակ չերևա։ Դուրս գալիս՝ նույնպես։
  const LS = 'hw_rc:', LS_AGE = 12 * 3600e3;
  const SWR = /^app_(home|notes|dash|geo|rivals?|dlv|listam|funnel|drivers|quality|finance|fees|net_income|terms|reels|reel_refs|wa)$/;
  let rendering = 0, bg = [];
  const lsGet = (k) => { try { const x = JSON.parse(localStorage.getItem(LS + k)); return x && Date.now() - x.t < LS_AGE ? x : null; } catch (e) { return null; } };
  const lsClear = () => { try { Object.keys(localStorage).forEach((k) => { if (k.startsWith(LS)) localStorage.removeItem(k); }); } catch (e) {} };
  const lsSet = (k, x) => { const s = JSON.stringify(x); try { localStorage.setItem(LS + k, s); } catch (e) { lsClear(); try { localStorage.setItem(LS + k, s); } catch (e2) {} } };
  async function rpc(fn, args, key) {
    key = key || fn + JSON.stringify(args || {});
    if (cache[key] && Date.now() - cache[key].t < 60000) return cache[key].v;
    const keep = SWR.test(fn);
    const old = rendering && keep ? (cache[key] || lsGet(key)) : null;
    const p = fetchRpc(fn, args).then((v) => {
      const changed = !old || JSON.stringify(v) !== JSON.stringify(old.v);
      cache[key] = { t: Date.now(), v };
      if (keep) lsSet(key, { t: Date.now(), v });
      return changed;
    });
    if (old) { bg.push(p); return old.v; }
    await p;
    return cache[key].v;
  }
  function invalidate() { for (const k in cache) delete cache[k]; lsClear(); }

  // ───────── Շրջանակ (ԿԱ 2-ի պատյան, 03.11.2026) ─────────
  // Ներքևում՝ պարկի ԲՈԼՈՐ բաժինները մեկ սահող շարքում (Գարիկ. «ինչպես իմ հավելվածինը»՝ gth.robi.am/v2, iOS 26-ի Telegram-ի պես),
  // աջում՝ GTH կոճակը → Գարիկ (օգնականը)։ Աղյուսակով «Բոլորը»՝ վերևի կոճակով (#/sections)։
  // Վերևում՝ HayWay-ի փոքր լոգոն ու անունը. բիզնեսի իր գույնը չկա (ԿԱ 2-ի կանոն)։
  let pendingCount = 0;
  // 05.11 ԿԱ 5 (Դավիթի ai.unread, Գարիկ. «կետ չէ, թիվ»)՝ GTH կոճակի վրա օգնականի ՆՈՐ նամակների թիվը (պատասխան, հիշեցում, հսկում, թիմի պատասխան, ծանուցում),
  // ոչ թե «Այո» սպասողները (դրանք՝ զրույցի «Սպասում է քեզ» տողում)։ Սերվերը՝ app_assistant_unread() (db5), «տեսավ»-ը՝ app_assistant()-ը #/garik-ը բացելիս
  let unreadCount = 0, unreadBusy = false;
  const unreadTxt = (n) => (n > 99 ? '99+' : String(n));
  function unreadPaint() {
    const g = app.querySelector('.dock .gthb');
    if (g) {
      let b = g.querySelector('.badge');
      if (unreadCount && !b) { b = document.createElement('span'); b.className = 'badge'; g.appendChild(b); }
      if (b && !unreadCount) b.remove();
      else if (b && b.textContent !== unreadTxt(unreadCount)) b.textContent = unreadTxt(unreadCount);
      g.setAttribute('aria-label', unreadCount ? `GTH օգնական · ${unreadCount} նոր` : 'GTH օգնական');
    }
    if (window.HWD && HWD.paint) HWD.paint();
  }
  async function unreadPull() {
    if (unreadBusy || document.visibilityState !== 'visible' || (location.hash || '').startsWith('#/garik')) return;
    unreadBusy = true;
    try {
      if (window.HWD && HWD.isOpen && HWD.isOpen()) unreadCount = 0;   // համակարգչում GTH-ը բաց է աջում՝ փակելիս նորից կհաշվի (ինչը այնտեղ չերևաց)
      else { const { data, error } = await sb.rpc('app_assistant_unread'); if (!error) unreadCount = Number(data) || 0; }
      unreadPaint();
    } catch (e) {} finally { unreadBusy = false; }
  }
  setInterval(unreadPull, 30000);
  document.addEventListener('visibilitychange', unreadPull);
  // հերթը՝ Գարիկ 03.11. «Այսօրը, հետո list.am-ը, հետո ChatGPT-ն»; Գործեր/Որակ/Պայմաններ՝ «պետք չէ», Կարգավորումներում են (SUB); Մրցակիցները՝ Վարորդներից առաջ (Գարիկ 03.11)
  // Գարիկ 03.11. «չատ գպտ-ից հետո ուզում եմ այս բաժինը երևա ռիլերի»
  // Գարիկ 03.11. WhatsApp-ը՝ «Ռիլեր բաժնից առաջ», Մրցակիցները՝ «Վարորդներ բաժնից առաջ»
  const DOCK = [['', I.home, 'Այսօր'], ['team', I.team, 'Թիմ'], ['listam', I.mega, 'list.am'], ['geo', I.ai, 'ChatGPT'], ['whatsapp', I.chat, 'WhatsApp'], ['reels', I.film, 'Ռիլեր'], ['rivals', I.trophy, 'Մրցակիցներ'], ['drivers', I.users, 'Վարորդներ'], ['growth', I.userplus, 'Նորեկներ'],
    ['finance', I.money, 'Ֆինանս']];
  // ներքևում չեղած էջերի «Հետ»-ը
  const SUB = { quality: ['#/settings', 'Կարգավորում'], terms: ['#/settings', 'Կարգավորում'], tasks: ['#/garik', 'GTH'] };
  const hashParts = () => (location.hash || '#/').slice(1).split('?')[0].split('/');
  let chatBack = '#/';
  function tabbar() {
    const s = hashParts()[1] || '';
    return `<nav class="dock"><div class="strip"><div class="track"><i class="glass" aria-hidden="true"></i>${DOCK.map(([k, ic, l]) => `<a class="tab${k === s ? ' on' : ''}" href="#/${k}" draggable="false"><span class="ic">${ic}</span><span>${l}</span></a>`).join('')}</div></div>
      <a class="gthb" href="#/garik" aria-label="GTH օգնական"><img src="GTH-AGENCY-logo-SAFE.svg" width="46" height="24" alt="GTH logo"><span class="cue"><i></i><i></i><i></i></span>${unreadCount ? `<span class="badge">${unreadTxt(unreadCount)}</span>` : ''}</a></nav>`;
  }
  // o: { title, sub, tab, back:[href,label], right, compact, after }
  function frame(o, body) {
    const chat = o.tab === 'garik';
    let back = o.back;
    // Բաժինները բացվում են ներքևից կամ «Բոլորը»-ից. ներքևի բաժնում «Հետ» պետք չէ, մնացածում՝ «Բոլորը»
    if (back && back[0] === '#/sections') { const [, s, arg] = hashParts(); back = DOCK.some((d) => d[0] === s) && !arg ? null : SUB[s] && !arg ? SUB[s] : [back[0], 'Բոլորը']; }
    if (!back && !chat && SUB[hashParts()[1]]) back = SUB[hashParts()[1]];
    const left = chat ? (o.left !== undefined ? o.left : `<a class="backb" href="${chatBack}">${I.back}<span>Հետ</span></a>`)
      : back ? `<a class="backb" href="${back[0]}">${I.back}<span>${esc(back[1])}</span></a>`
      : `<a class="brand" href="#/"><img src="icon.svg?v=9" width="36" height="36" alt=""><span><b>HayWay</b><small><i></i>${todayLong()}</small></span></a>`;
    const right = o.right !== undefined ? o.right : `<a class="ibtn ${hashParts()[1] === 'sections' ? 'on' : ''}" href="#/sections" aria-label="Բոլոր բաժինները">${I.grid}</a><button class="ibtn" id="refresh" aria-label="Թարմացնել">${I.refresh}</button>`;
    const large = o.compact ? '' : `<header class="lt"><h1>${o.title}</h1>${o.sub ? `<div class="st">${o.sub}</div>` : ''}</header>`;
    // 04.11 (Գարիկ. «Գարիկ բառը ներսից հանի, թող GTH»). զրույցի վերևում՝ միայն GTH լոգոն
    const ct = chat ? `<img src="GTH-AGENCY-logo-SAFE.svg" width="40" height="21" alt="GTH">` : o.title;
    return `<div class="top ${o.compact ? 'compact scrolled' : ''} ${back || chat ? '' : 'nb br'} ${chat ? 'chat-top' : ''}"><div class="top-in"><div class="l">${left}</div><div class="ct">${ct}</div><div class="r">${right}</div></div></div>
      <div class="scroll" id="sc">${large}${body}</div>${o.after || ''}${chat ? '' : tabbar()}`;
  }
  let lastPath = '';
  function mount(o, body) {
    const keep = app.querySelector('.dock');
    // 04.11 (ԿԱ 5). «Գարիկ» բառը տիրոջ էկրանին երբեք (Գարիկ. «Գարիկով էլ բան չերևա»)՝ ամեն էկրանի վերջին ցանցը
    app.innerHTML = noG(frame(o, body));
    placeDock(keep);
    app.classList.toggle('has-dock', o.tab !== 'garik');
    app.classList.remove('wa');   // «Թիմ»-ի զրույցից դուրս գալիս
    app.classList.toggle('gth', o.tab === 'garik');   // ԿԱ 5. մուգ ֆոն + մանուշակագույն լույս վերևում (ka5-chat-tesq.md)
    const sc = document.getElementById('sc'), top = app.querySelector('.top');
    // նոր էկրան բացելիս բլոկները մեղմ բարձրանում են (թարմացնելիս՝ ոչ)
    const path = location.hash || '#/', pg = sc.querySelector('.page');
    if (pg && path !== lastPath) pg.classList.add('enter');
    lastPath = path;
    countUp(sc);
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

  // ───────── Ներքևի շարքը (GTH-ի հավելվածից, 03.11). մատով սահեցնել → մնացած բաժինները; սեղմել → «ապակե» գնդիկը թռչում է ու մի պահ ուռչում;
  // մատը պահել (260 մվ) ու տանել → գնդիկը մեծանում է, դառնում ապակի, գնում մատի հետևից (եզրին՝ շարքն էլ է սահում), բաց թողնելիս բացում է բաժինը ─────────
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = { x: null, w: 0, block: 0 };
  let dockSl = null;
  // Շարքը էկրանից էկրան նույնն է մնում (keep), որ գնդիկի թռիչքն ու շարքի դիրքը չընդհատվեն. թարմանում են միայն «on»-ն ու թիվը
  function placeDock(keep) {
    const nd = app.querySelector('.dock');
    if (!nd) return;
    if (keep) {
      nd.replaceWith(keep);
      const fresh = [...nd.querySelectorAll('.tab')];
      keep.querySelectorAll('.tab').forEach((t, i) => { t.classList.toggle('on', fresh[i].classList.contains('on')); t.querySelector('.ic').innerHTML = fresh[i].querySelector('.ic').innerHTML; });
      keep.querySelector('.gthb').innerHTML = nd.querySelector('.gthb').innerHTML;
      const tr = keep.querySelector('.track'), on = tr.querySelector('.tab.on');
      if (on) reveal(tr, on, true);
      glassPlace(tr, on, true);
      return;
    }
    const tr = nd.querySelector('.track'), on = tr.querySelector('.tab.on');
    if (dockSl != null) tr.scrollLeft = dockSl;
    if (on) reveal(tr, on, dockSl != null);
    edges(tr); tr.addEventListener('scroll', () => { edges(tr); dockSl = tr.scrollLeft; }, { passive: true });
    G.x = null; glassPlace(tr, on, false); glassDrag(tr);
  }
  // ընտրված բաժինը միշտ երևա (եթե շարքից դուրս է՝ սահում է դեպի այն)
  function reveal(tr, t, smooth) {
    const l = tr.scrollLeft, w = tr.clientWidth;
    if (t.offsetLeft >= l + 4 && t.offsetLeft + t.offsetWidth <= l + w - 4) return;
    tr.scrollTo({ left: t.offsetLeft - (w - t.offsetWidth) / 2, behavior: smooth && !calm() ? 'smooth' : 'auto' });
  }
  // եզրերի մարում՝ այն կողմում, որտեղ դեռ բաժին կա (հուշում է, որ կարելի է սահեցնել)
  function edges(tr) {
    tr.classList.toggle('fl', tr.scrollLeft > 2);
    tr.classList.toggle('fr', tr.scrollLeft < tr.scrollWidth - tr.clientWidth - 2);
  }
  function glassPlace(tr, t, anim) {
    const g = tr.querySelector('.glass');
    if (!g) return;
    if (!t) { g.style.opacity = '0'; G.x = null; return; }
    const x = t.offsetLeft, w = t.offsetWidth;
    if (anim && G.x != null && (G.x !== x || G.w !== w) && !calm()) {
      g.classList.add('still'); g.style.setProperty('--x', G.x + 'px'); g.style.setProperty('--w', G.w + 'px');
      void g.offsetWidth; g.classList.remove('still', 'hop'); void g.offsetWidth; g.classList.add('hop');
    }
    g.style.setProperty('--x', x + 'px'); g.style.setProperty('--w', w + 'px'); g.style.opacity = '';
    G.x = x; G.w = w;
  }
  // iPhone-ում navigator.vibrate չկա. Safari 18+-ը «switch» վանդակը փոխելիս թեթև թրթռում է տալիս
  function tick() {
    try {
      if (navigator.vibrate) return void navigator.vibrate(6);
      const l = document.createElement('label'); l.ariaHidden = 'true'; l.style.display = 'none'; l.innerHTML = '<input type="checkbox" switch>';
      document.head.appendChild(l); l.click(); l.remove();
    } catch (e) {}
  }
  function glassDrag(tr) {
    const g = tr.querySelector('.glass'), tabs = () => [...tr.querySelectorAll('.tab')];
    const near = (cx) => tabs().reduce((b, t) => { const r = t.getBoundingClientRect(), k = Math.abs(cx - r.left - r.width / 2); return !b || k < b.k ? { t, k } : b; }, null).t;
    let p = null;
    const follow = (cx) => {
      const ts = tabs(), a = ts[0], z = ts[ts.length - 1];
      const x = Math.max(a.offsetLeft, Math.min(z.offsetLeft + z.offsetWidth - G.w, cx - tr.getBoundingClientRect().left + tr.scrollLeft - G.w / 2));
      g.style.setProperty('--x', x + 'px'); G.x = x;
      const h = near(cx);
      if (h !== p.hov) { if (p.hov) p.hov.classList.remove('hov'); h.classList.add('hov'); p.hov = h; tick(); }
    };
    // գնդիկը եզրին պահելիս շարքը ինքն է սահում դեպի այդ կողմ
    const edge = () => {
      if (!p || !p.up) return;
      const r = tr.getBoundingClientRect(), k = p.cx > r.right - 24 ? 1 : p.cx < r.left + 24 ? -1 : 0;
      if (k) { tr.scrollLeft += k * 6; follow(p.cx); }
      p.raf = requestAnimationFrame(edge);
    };
    const lift = () => {
      if (!p || p.up) return;
      if (G.x == null) { const t = near(p.cx); G.w = t.offsetWidth; g.classList.add('still'); g.style.setProperty('--w', G.w + 'px'); g.style.opacity = ''; void g.offsetWidth; g.classList.remove('still'); }
      p.up = true; tr.classList.add('drag'); try { tr.setPointerCapture(p.id); } catch (e) {} follow(p.cx); edge();
    };
    tr.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || !e.isPrimary) return;
      p = { id: e.pointerId, x0: e.clientX, y0: e.clientY, cx: e.clientX, up: false, hov: null, mouse: e.pointerType === 'mouse' };
      p.t = p.mouse ? 0 : setTimeout(lift, 260);
    });
    tr.addEventListener('pointermove', (e) => {
      if (!p || e.pointerId !== p.id) return;
      p.cx = e.clientX;
      if (p.up) return follow(e.clientX);
      // մատը շուտ շարժվեց՝ սա սահեցնել է (շարքը սահում է), ոչ գնդիկը; մկնիկով քաշելը՝ գնդիկը
      if (Math.abs(e.clientX - p.x0) > 8 || Math.abs(e.clientY - p.y0) > 8) { clearTimeout(p.t); if (p.mouse) lift(); else p = null; }
    });
    // գնդիկը բարձրացված է՝ շարքը մատի տակ չսահի
    tr.addEventListener('touchmove', (e) => { if (p && p.up) e.preventDefault(); }, { passive: false });
    const end = (ok) => (e) => {
      if (!p || e.pointerId !== p.id) return;
      clearTimeout(p.t); cancelAnimationFrame(p.raf); const q = p; p = null;
      if (!q.up) return; // կարճ սեղմում՝ սովորական click
      tr.classList.remove('drag'); tabs().forEach((t) => t.classList.remove('hov'));
      const t = ok ? near(q.cx) : tr.querySelector('.tab.on');
      G.block = Date.now(); glassPlace(tr, t, false);
      if (ok && t && !t.classList.contains('on')) { tabs().forEach((x) => x.classList.toggle('on', x === t)); location.hash = t.getAttribute('href'); }
    };
    tr.addEventListener('pointerup', end(true));
    tr.addEventListener('pointercancel', end(false));
    tr.addEventListener('dragstart', (e) => e.preventDefault()); // հղումը որպես ֆայլ չքաշվի (թե չէ pointercancel)
    // մատը բաց թողնելուց հետո զննիչի click-ը չկրկնի անցումը
    tr.addEventListener('click', (e) => { if (Date.now() - G.block < 400) { e.preventDefault(); e.stopPropagation(); } }, true);
    // սեղմելիս գնդիկը թռչում է անմիջապես, տվյալների բեռնմանը չսպասելով
    tr.addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (!t) return; tabs().forEach((x) => x.classList.toggle('on', x === t)); glassPlace(tr, t, true); });
  }
  addEventListener('resize', () => { const tr = app.querySelector('.track'); if (tr) { edges(tr); glassPlace(tr, tr.querySelector('.tab.on'), false); } });

  // ───────── Գլխավորի եկամտի վահանակ (db\0025, app_dash). 03.11, Գարիկ. «ժամկետները փոխել՝ 7 օր, 14 օր, 1 ամիս, նաև ըստ ամիսների;
  // օրվա վրա սեղմելով՝ շրջանառությունը առանց ծախսերի, փոքր՝ ետևից երևացող; աղյուսակ՝ գրանցվողներ և դուրս եկողներ (отток);
  // ներքևում՝ նույն վահանակը առաքման համար» ─────────
  const PERIODS = [['d7', '7 օր'], ['d14', '14 օր'], ['d30', '1 ամիս'], ['months', 'Ամիսներ']];
  const MON_S = ['Հնվ', 'Փտր', 'Մրտ', 'Ապր', 'Մյս', 'Հնս', 'Հլս', 'Օգս', 'Սեպ', 'Հոկ', 'Նոյ', 'Դեկ'];
  const MON_N = ['Հունվար', 'Փետրվար', 'Մարտ', 'Ապրիլ', 'Մայիս', 'Հունիս', 'Հուլիս', 'Օգոստոս', 'Սեպտեմբեր', 'Հոկտեմբեր', 'Նոյեմբեր', 'Դեկտեմբեր'];
  const PARKS = [['taxi', 'Տաքսի'], ['delivery', 'Առաքում']];
  let period = 'd14';
  try { period = localStorage.getItem('hw_period') || 'd14'; } catch (e) {}
  if (!PERIODS.some((p) => p[0] === period)) period = 'd14';
  const num = (v) => Math.round(+v || 0);
  // օրերն ու ամիսները՝ մեկ տեսքով (սյուն + աղյուսակ)
  function dashRows(D) {
    const td = today();
    if (D.mode === 'months') return (D.months || []).map((m) => {
      const mi = +m.m.slice(5) - 1, full = m.from.slice(8) === '01' && m.days >= 28 && m.to !== td;
      return { ax: MON_S[mi], nm: MON_N[mi].toLowerCase(), title: MON_N[mi] + (full ? '' : ` · ${dmy(m.from)}–${dmy(m.to)}`), from: m.from, to: m.to, now: m.m === td.slice(0, 7),
        has: m.cov_days > 0, part: m.cov_days > 0 && m.cov_days < m.days ? m.cov_days : 0, commission: m.commission, net: m.net, gmv: m.gmv, orders: m.orders,
        active: m.active_avg, avg: true, new: m.new, churn: m.churn, pay: m.pay, tax: m.tax, ads: m.ads, fixed: m.fixed, costs: m.costs, est: m.est };
    });
    return (D.days || []).map((d) => ({ ax: dmy(d.day), title: `${d.day === td ? 'Այսօր' : DAYS_L[dayIdx(d.day)]} · ${dmy(d.day)}`, from: d.day, to: d.day,
      now: d.day === td, has: d.has_comm, commission: d.commission, net: d.net, gmv: d.gmv, orders: d.orders, active: d.active,
      new: d.new, churn: d.churn, pay: d.pay, tax: d.tax, ads: d.ads, fixed: d.fixed, costs: d.costs, est: d.est }));
  }
  // մեծ քարտը. գլխավոր թիվ + սյուներ (առջևում՝ մաքուրը, ետևում՝ շրջանառությունը ծախսերից առաջ) + ընտրված օրը
  function dashCard(park, D) {
    if (!D || !D.connected) return `<div class="card hc dash-off">
        <div class="lab"><span>HayWay Delivery</span><span class="tag n">միացվում է</span></div>
        <p class="meta">Թվերը կերևան միացնելուց հետո։</p>
        </div>`;
    const M = D.mode === 'months', rows = dashRows(D);
    let lab, val, cmp, sub;
    if (M) {
      const k = rows.map((r) => r.has).lastIndexOf(true), cur = rows[k] || {}, prev = rows[k - 1];
      lab = `Մաքուր եկամուտ · ${cur.nm || ''}`; val = num(cur.net);
      cmp = prev && prev.has ? `<span>${prev.nm}՝ ${short(prev.net)}${prev.part ? ` (${prev.part} օր)` : ''}</span>` : '';
      sub = cur.has ? `շրջանառություն ${short(cur.commission)} − ծախսեր ${short(cur.costs)}` : '';
    } else {
      const c = D.cur || {}, p = D.prev || {}, pOk = p.days && p.cov_days === p.days && +p.net;
      const dp = pOk ? Math.round((c.net - p.net) / Math.abs(p.net) * 100) : null;
      lab = `Մաքուր եկամուտ · ${D.n === 30 ? '30' : D.n} օր`; val = num(c.net);
      cmp = (dp === null ? '' : `<span class="pill ${dp > 0 ? 'up' : dp < 0 ? 'down' : ''}">${dp > 0 ? '+' : dp < 0 ? '−' : ''}${Math.abs(dp)}%</span>`)
        + (pOk ? `<span>նախորդ ${D.n} օրը՝ ${short(p.net)}</span>` : '');
      sub = `շրջանառություն ${short(c.commission)} − ծախսեր ${short(c.costs)}`;
    }
    const max = Math.max(1, ...rows.map((r) => r.has ? Math.max(+r.commission || 0, +r.net || 0) : 0));
    const bars = rows.map((r, i) => `<i class="${r.now ? 't' : ''}${r.has ? '' : ' nd'}" style="--g:${r.has ? Math.max(3, Math.round(r.commission / max * 100)) : 0}%;--h:${r.has ? Math.max(0, Math.round(r.net / max * 100)) : 0}%;--k:${i}"></i>`).join('');
    const axis = M ? `<div class="axis mo">${rows.map((r) => `<span>${r.ax}</span>`).join('')}</div>`
      : `<div class="axis"><span>${rows.length ? rows[0].ax : ''}</span><span>${rows.length > 8 ? rows[Math.floor(rows.length / 2)].ax : ''}</span><span>${rows.length && rows[rows.length - 1].now ? 'այսօր' : (rows.length ? rows[rows.length - 1].ax : '')}</span></div>`;
    const tot = rows.reduce((s, r) => s + (r.has ? +r.net || 0 : 0), 0);
    return `<div class="card hc">
        <div class="lab"><span>${lab}</span><span class="aux">թարմ՝ ${ago(D.last_sync)}</span></div>
        <div class="val"><span data-n="${val}">${fmt(val)}</span><small>֏</small></div>
        ${cmp ? `<div class="cmp">${cmp}</div>` : ''}
        ${sub ? `<div class="cmp"><span>${sub}</span>${D.approx ? '<a class="tag warn" href="#/finance">մոտավոր</a>' : ''}</div>` : ''}
        ${rows.length ? `<div class="d14">
          <div class="d14-h"><span>${M ? 'Ըստ ամիսների' : `Վերջին ${D.n} օրը`}</span>${M ? '' : `<b>${short(tot)}</b>`}</div>
          <div class="bars dash grow${rows.length > 20 ? ' dense' : ''}" id="${park}-bars">${bars}</div>
          ${axis}
          <div class="lgd"><span><i></i>մաքուր եկամուտ</span><span><i class="g"></i>շրջանառություն</span></div>
          <button type="button" class="dayh" id="${park}-day" aria-expanded="false"></button>
          <div class="dtab" id="${park}-tab" hidden></div>
        </div>` : ''}
      </div>`;
  }
  // աղյուսակը ընտրված օրվա (ամսվա) համար. շրջանառություն, ծախսեր (բացվում է), մաքուր, պատվերներ, գրանցվածներ, դուրս եկածներ (կոճակով՝ ցուցակը)
  function dashTable(park, D, r) {
    const el = document.getElementById(park + '-tab');
    if (!el) return;
    const fixedNames = (D.fixed_items || []).map((x) => x.name).join(', ');
    const pbtn = (kind, t, n, s) => `<button type="button" class="cell" data-ppl="${kind}" ${n ? '' : 'disabled'}><span class="bd"><span class="t">${t}</span>${s ? `<span class="s">${s}</span>` : ''}</span><span class="v strong ${kind === 'churn' && n ? 'neg' : ''}">${fmt(n)}${NB}մարդ</span>${n ? `<span class="chev">${I.chev}</span>` : ''}</button>`;
    // շրջանառությունը, ծախսն ու մաքուրը՝ օրվա տողում (bindDash), այստեղ՝ ծախսերը ըստ տեսակի և վարորդները.
    // առաքումը (db\0026)՝ առանց list.am-ի ու ամսական ծախսերի (դրանք տաքսու վահանակում են)
    const dlv = park === 'delivery';
    el.innerHTML = (r.has ? ['<div class="dt-c">Ծախսերը</div>',
      cell({ t: 'Վճարային համակարգեր', s: 'Idram, Telcell, EasyPay, PrimeBridge', v: amd(num(r.pay)) }),
      cell({ t: `Հարկ ${fmt(D.tax_pct)}%`, s: 'շրջանառությունից', v: amd(num(r.tax)) }),
    ].concat(dlv ? [] : [
      cell({ t: 'Գովազդ', s: 'list.am', v: amd(num(r.ads)) }),
      cell({ t: 'Ամսական ծախսեր', s: esc(fixedNames || 'վարձ, աշխատավարձ'), v: amd(num(r.fixed)) }),
    ]) : []).concat([
      `<div class="dt-c">Պատվերներ և ${dlv ? 'առաքիչներ' : 'վարորդներ'}</div>`,
      cell({ t: 'Պատվերներ', s: `գումարը՝ ${short(r.gmv)}`, v: fmt(r.orders) }),
      cell({ t: 'Աշխատել են', s: r.avg ? 'միջինը օրական' : 'գոնե մեկ պատվեր', v: `${fmt(r.active)}${NB}${dlv ? 'առաքիչ' : 'վարորդ'}` }),
      pbtn('new', 'Գրանցվել են', r.new, ''),
      pbtn('churn', 'Դուրս են եկել', r.churn, '10 օր պատվեր չունեն'),
      '<div class="dt-l" hidden></div>',
    ]).join('');
    el.querySelectorAll('[data-ppl]').forEach((b) => b.onclick = async () => {
      const box = el.querySelector('.dt-l'), kind = b.dataset.ppl;
      if (b.classList.contains('on')) { b.classList.remove('on'); box.hidden = true; return; }
      el.querySelectorAll('[data-ppl]').forEach((x) => x.classList.remove('on'));
      b.classList.add('on'); box.hidden = false; box.innerHTML = '<div class="loading" style="padding:18px"><span class="spin"></span></div>';
      try {
        const ppl = await rpc('app_dash_people', { p_park: park, p_kind: kind, p_from: r.from, p_to: r.to });
        if (!b.classList.contains('on')) return;
        box.innerHTML = ppl.length ? `<div class="group avs">${ppl.map((d) => cell({ lead: `<span class="av">${esc(initials(d.first_name, d.last_name))}</span>`, t: esc(name(d)), bold: true,
          s: kind === 'new' ? `Գրանցվել է ${dmy(d.hire_date)} · ${fmt(d.orders_total)} պատվեր` : `Վերջին պատվերը ${dmy(d.last_order_at)} · ընդամենը ${fmt(d.orders_total)} պատվեր`,
          trail: callBtn(d) })).join('')}</div>` : '<p class="none">Ցուցակը դատարկ է։</p>';
      } catch (e) { box.innerHTML = `<p class="none">Չբացվեց՝ ${esc(e.message)}</p>`; }
    });
  }
  // սեղմել կամ մատը սահեցնել սյուների վրա → ներքևում այդ օրը (մաքուրը մեծ, շրջանառությունը՝ փոքր);
  // աղյուսակը փակ է, բացվում է օրվա տողը սեղմելով (03.11, Գարիկ. «բացովի լինի, կենտրոնական բաժին չլինի»)
  const dashOpen = {};
  function bindDash(park, D) {
    const rows = dashRows(D), bars = document.getElementById(park + '-bars'), out = document.getElementById(park + '-day'), tab = document.getElementById(park + '-tab');
    if (!bars || !out || !rows.length) return;
    const show = () => { tab.hidden = !dashOpen[park]; out.classList.toggle('on', !!dashOpen[park]); out.setAttribute('aria-expanded', dashOpen[park] ? 'true' : 'false'); };
    out.onclick = () => { dashOpen[park] = !dashOpen[park]; show(); };
    show();
    let cur = -1;
    const pick = (i) => {
      i = Math.max(0, Math.min(rows.length - 1, i));
      if (i === cur) return;
      cur = i;
      const r = rows[i];
      bars.classList.add('sel');
      bars.querySelectorAll('i').forEach((b, k) => b.classList.toggle('on', k === i));
      // հաշվի պես. շրջանառություն − ծախսեր = մաքուր (Գարիկ 03.11. «կոկիկ, հեշտ կարդացվող»)
      const ln = (t, v, cls = '') => `<span class="dh-r ${cls}"><span>${t}</span>${v}</span>`;
      out.innerHTML = `<span class="dh-h"><span class="dh-t">${r.title}</span><span class="dh-m">Մանրամասն${I.chev}</span></span>` + (r.has
        ? ln('Շրջանառություն', `<span>${amd(num(r.commission))}</span>`) + ln('Ծախսեր', `<span>−${amd(num(r.costs))}</span>`)
          + ln('Մաքուր եկամուտ', `<b class="${+r.net < 0 ? 'neg' : 'pos'}">${r.est ? '≈' + NB : ''}${amd(num(r.net))}</b>`, 'n')
        : ln('Պատվերներ', `<span>${fmt(r.orders)}</span>`) + ln('Պատվերների գումարը', `<span>${short(r.gmv)}</span>`)
          + ln('Մաքուր եկամուտ', '<b class="mut3">տվյալ չկա</b>', 'n'));
      dashTable(park, D, r);
    };
    const at = (x) => { const b = bars.getBoundingClientRect(); return Math.floor((x - b.left) / b.width * rows.length); };
    bars.addEventListener('pointerdown', (e) => { pick(at(e.clientX)); });
    bars.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') pick(at(e.clientX)); });
    // սկզբում՝ վերջին լրիվ օրը (ամիսներում՝ այս ամիսը)
    const k = D.mode === 'months' ? rows.length - 1 : rows.map((r) => !r.now).lastIndexOf(true);
    pick(k >= 0 ? k : rows.length - 1);
  }
  // parks՝ Գլխավորում երկուսը, «Առաքում» բաժնում՝ միայն առաքումը (DLV)
  async function dashLoad(parks = PARKS) {
    return Promise.all(parks.map(([p]) => rpc('app_dash', { p_park: p, p_mode: period }).catch((e) => (p === 'taxi' ? Promise.reject(e) : null))));
  }
  const dashHtml = (ds, parks = PARKS) => parks.map(([p, l], i) => sec(l, dashCard(p, ds[i]))).join('');
  function bindDashAll(ds, parks = PARKS) {
    parks.forEach(([p], i) => { if (ds[i] && ds[i].connected) bindDash(p, ds[i]); });
    app.querySelectorAll('[data-period]').forEach((b) => b.onclick = async () => {
      if (b.dataset.period === period) return;
      period = b.dataset.period;
      try { localStorage.setItem('hw_period', period); } catch (e) {}
      app.querySelectorAll('[data-period]').forEach((x) => x.classList.toggle('on', x === b));
      const box = document.getElementById('dash');
      box.style.opacity = '.5';
      try {
        const nd = await dashLoad(parks);
        if (b.dataset.period !== period) return;
        box.innerHTML = dashHtml(nd, parks);
        bindDashAll(nd, parks);
      } finally { box.style.opacity = ''; }
    });
  }
  // թվերը հաշվում են 0-ից (ԿԱ 2-ի «կենդանի» թվերը). միայն նոր էկրան բացելիս
  function countUp(root) {
    if (!root.querySelector('.page.enter') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-n]').forEach((el) => {
      const n = +el.dataset.n, t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 800), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(n * e)); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

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
  const estNote = (notes, days) => { const e = ((notes && notes.estimated_days) || []).filter((d) => d > new Date(Date.now() + 4 * 3600e3 - days * 86400e3).toISOString().slice(0, 10)); return e.length ? `≈ ${dmy(e[0])}–${dmy(e[e.length - 1])}՝ մոտավոր։` : ''; };

  // ───────── Երթուղավորում ─────────
  const routes = {};
  function route(path, fn) { routes[path] = fn; }
  let lastTab = '', renderSeq = 0, roleOf = '', isStaff = false;
  // silent = նույն էկրանը ետևում եկած թարմ թվերով. առանց պտտվող նշանի, նույն ոլորման տեղում (տե՛ս rpc-ի պահածը)
  async function render(silent) {
    silent = silent === true;   // hashchange-ը Event է տալիս
    const seq = ++renderSeq;
    const session = (await sb.auth.getSession()).data.session;
    if (!session) return renderLogin();
    // 05.11 (db6). աշխատակիցը (role staff) այստեղ ոչինչ չի տեսնում → իր չատը՝ team/ էջում
    if (roleOf !== session.user.email) { roleOf = session.user.email; const { data: tm } = await sb.rpc('team_me'); isStaff = !!(tm && tm.role === 'staff'); }
    if (isStaff) { location.replace('team/'); return; }
    const path = (location.hash || '#/').slice(1).split('?')[0];
    const [, seg = '', arg = ''] = path.split('/');
    if (window.HWD && HWD.route(seg)) return;   // (03.11) desktop.js. համակարգչում GTH-ը բացվում է աջում, մեծ էջը մնում է տեղում
    const fn = routes['/' + seg] || routes['/'];
    if (seg !== 'garik') chatBack = '#' + path;
    const sc = document.getElementById('sc'), y = silent && sc ? sc.scrollTop : 0;
    app.querySelectorAll('.composer').forEach((e) => e.remove());
    if (!silent) {
      if (sc && app.querySelector('.dock')) sc.innerHTML = '<div class="loading" style="height:60vh"><span class="spin"></span></div>';
      else app.innerHTML = '<div class="loading"><span class="spin"></span></div>';
    }
    const mine = bg = [];
    rendering++;
    try {
      await fn(arg);
      if (seg === 'garik') unreadCount = 0; else unreadPull();   // 05.11 ԿԱ 5՝ զրույցը բացվեց = տեսավ (app_assistant), մնացած էկրաններում՝ թարմ թիվը
      if (y) { const s2 = document.getElementById('sc'); if (s2) s2.scrollTop = y; }
    } catch (e) {
      const msg = String(e.message || e);
      mount({ title: 'Սխալ', tab: lastTab || 'home' }, page(`<div class="err">${esc(msg === 'no access' ? 'Այս փոստը հավելվածի մուտքի ցուցակում չէ։' : msg)}</div><button class="btn full" id="signout">Դուրս գալ</button>`));
      document.getElementById('signout').onclick = () => sb.auth.signOut().then(render);
    } finally { rendering--; }
    // հին թվերով նկարվեց → սպասում ենք թարմին (վերևի կոճակը պտտվում է) և փոխվելու դեպքում նկարում ենք նորից. զրույցը՝ ոչ
    if (!mine.length || seg === 'garik') return;
    const rb = document.getElementById('refresh');
    if (rb) rb.classList.add('spinning');
    const res = await Promise.allSettled(mine);
    if (seq !== renderSeq) return;
    const rb2 = document.getElementById('refresh');
    if (rb2) rb2.classList.remove('spinning');
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (!typing && res.some((r) => r.status === 'fulfilled' && r.value)) render(true);
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
      <p class="hint">Հղումը բացիր այս հեռախոսում։</p>
    </div>`;
    const email = document.getElementById('email'), pw = document.getElementById('pw'), msg = document.getElementById('msg'), btn = document.getElementById('send'), lb = document.getElementById('login');
    try { email.value = localStorage.getItem('hw_email') || ''; } catch (e) {}
    const errText = (m) => m.includes('Signups not allowed') ? 'այս փոստը մուտքի ցուցակում չէ' : m.includes('Invalid login') ? 'սխալ փոստ կամ գաղտնաբառ' : m.includes('rate limit') ? 'շատ փորձ, սպասիր մեկ ժամ' : m;
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
      msg.textContent = 'Ուղարկված է։ Բացիր նամակի հղումը։';
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
    // 03.11, Գարիկ. «հավելվածը բացելուց միանգամից երևա ֆինանսական կտորը» → Գլխավորը սկսվում է եկամտով;
    // «Այո»-ն, հիշեցումները, «Հարց ձեզ»-ը ու ծանուցումների միացումը՝ GTH էջում (gthCards), թիվը՝ GTH կոճակի վրա
    const [h, notes, ds] = await Promise.all([rpc('app_home'), rpc('app_notes'), dashLoad()]);
    pendingCount = h.tasks_pending || 0;
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
    // Գլխավոր թիվը՝ մաքուր եկամուտը (03.11, Գարիկ. «ոչ թե շրջանառությունը, այլ մաքուր եկամուտը»), ժամկետը՝ 7/14/30 օր կամ ամիսներ,
    // տաքսին, ներքևում՝ առաքումը (dashCard, db\0025)
    const pseg = `<div class="seg pseg">${PERIODS.map(([k, l]) => `<button type="button" data-period="${k}" class="${k === period ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    mount({ title: 'Այսօր', tab: 'home' }, page(`
      ${pseg}
      <div id="dash">${dashHtml(ds)}</div>
      ${sec('Վերջին 7 օր', `<div class="kpis">
        ${fresh ? kpi('Հիմա աշխատում են', fmt(h.online.total), `${fmt(h.online.on_order)}-ը պատվերի վրա`, '#/drivers/active')
                : kpi('Այսօր աշխատել են', fmt(todayRow.active || 0), 'վարորդ', '#/drivers/active')}
        ${kpi('Պատվերներ', fmt(W7.orders), vsWeek(W7.orders, P7.orders))}
        ${kpi('Ընդհանուր գումար', short(W7.gmv), vsWeek(W7.gmv, P7.gmv), '#/finance')}
        ${kpi('Նորեկներ · 30 օր', fmt(h.month.new), '', '#/growth')}
      </div>`, { foot: estNote(notes, 15) })}
      ${sec('Նպատակ՝ 1000 վարորդ', `<a class="card" href="#/drivers/active">
        <div class="hero"><span class="n" data-n="${active}">${fmt(active)}</span><span class="u">աշխատող վարորդ</span></div>
        <div class="prog y"><span style="width:${Math.min(100, active / 10)}%"></span></div>
        <p class="meta">Այս շաբաթ եկավ <b class="pos">${w.new}</b>, գնաց <b class="neg">${w.churn}</b>։</p>
      </a>`, { foot: 'Աշխատող՝ 30 օրում գոնե 1 պատվեր։' })}
    `));
    bindDashAll(ds);
  });

  // ───────── GTH էջի (օգնականի) քարտերը (03.11, Գարիկ. «այս բաժինները թող լինեն իր AI օգնականի, այսինքն GTH բաժնում») ─────────
  // «Սպասում է «Այո»-ի», Գարիկի հիշեցումները, «Հարց ձեզ», ծանուցումների միացում. նախկինում Գլխավորում էին
  let reelsW = [], waP = 0;
  async function gthCards() {
    const [tr, qs, nts] = await Promise.all([
      sb.from('tasks').select('id,agent,title,kind').eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
      rpc('app_questions').catch(() => null),
      sb.rpc('app_notices').then((r) => r.data || [], () => []),
      sb.rpc('app_tg').then((r) => r.data || {}, () => ({})),
      rpc('app_reels').catch(() => null),
      rpc('app_wa').catch(() => null),
    ]).then((a) => { tgState = a[3]; reelsW = ((a[4] && a[4].reels) || []).filter((r) => r.status === 'ready').reverse(); waP = ((a[5] && a[5].pending) || []).length; return a; });
    const tasks = tr.data || [];
    pendingCount = tasks.length;
    // նոր ռիլ, որ սպասում է տիրոջ «Հրապարակել»-ին (db\0021)
    const reelCell = reelsW.length ? cell({ href: '#/reels', icon: I.film, color: 'p', t: `Նոր ռիլ #${reelsW[0].n}՝ դիտեք`, s: 'Հրապարակել կամ փոխել' }) : '';
    // «Սպասում է «Այո»-ի» (ԿԱ 2). գործակալների առաջարկները՝ GTH էջի վերևում, թիվը՝ GTH կոճակի վրա
    const todo = tasks.slice(0, 3).map((t) => { const [ic, col] = AGENT[t.agent] || [I.star, 's']; return cell({ href: '#/tasks', icon: ic, color: col, t: esc(t.title), s: esc(agentName(t.agent)) }); });
    if (tasks.length > 3) todo.push(cell({ href: '#/tasks', t: `<span style="color:var(--info)">Բոլոր գործերը · ${tasks.length}</span>` }));
    // WhatsApp-ի պատասխանների նախագծերը (db\0020)
    const waCell = waP ? cell({ href: '#/whatsapp', icon: I.chat, color: 'g', t: `WhatsApp՝ ${waP} պատասխան`, s: 'Կարդալ և ուղարկել' }) : '';
    const apr = tasks.length || reelCell || waCell ? `<div class="group ic apr"><a class="apr-h" href="#/tasks"><span class="ico y">${I.alert}</span><span class="t">Սպասում է «Այո»-ի</span><span class="cnt">${tasks.length + reelsW.length + waP}</span></a>${waCell}${reelCell}${todo.join('')}</div>` : '';
    const hasQ = qs && qs.open && qs.open.length;
    // Գարիկի հիշեցումները (db\0011, assistant_tick). «Լավ»-ով փակվում են
    const notice = nts.length ? sec('Հիշեցումներ', `<div class="card nlist">${nts.map((n) => `<div class="nrow" data-id="${n.id}">
        <p>${esc(n.text)}</p><button type="button" class="btn sm gray" data-seen="${n.id}">Լավ</button></div>`).join('')}</div>`) : '';
    // Գարիկի ծանուցումները. նախ՝ հենց հավելվածում (push), իսկ եթե հեռախոսը չի կարող՝ Telegram (db\0013). «Հետո»-ն թաքցնում է 7 օրով
    let tgLater = 0; try { tgLater = +localStorage.getItem('hw_tg_later') || 0; } catch (e) {}
    const ps = await pushState();
    const tgCard = Date.now() <= tgLater || ps.on || tgState.linked ? ''
      : ps.ok && !ps.denied ? sec('', `<div class="card tgcard">
        <p><b>GTH-ի ծանուցումները՝ այս հեռախոսում</b><br><span class="meta">Պատասխանները կգան հեռախոսին։</span></p>
        <div class="act-b"><button type="button" class="btn pri sm" data-pushon>Միացնել ծանուցումները</button><button type="button" class="btn sm gray" data-tglater>Հետո</button></div></div>`)
      : tgState.username ? sec('', `<div class="card tgcard">
        <p><b>GTH-ի պատասխանները՝ Telegram-ում</b><br><span class="meta">«Այո»-ն կսեղմեք հենց Telegram-ում։</span></p>
        <div class="act-b"><button type="button" class="btn pri sm" data-tglink>Միացնել Telegram-ը</button><button type="button" class="btn sm gray" data-tglater>Հետո</button></div></div>`) : '';
    const html = `${notice}${hasQ ? '<section class="sec" id="qa"></section>' : ''}${apr}${tgCard}`;
    // 04.11 (Դավիթի «Ждут вас · N»). զրույցի վերևի նուրբ տողի համար՝ քանակը ու առաջինը
    const count = nts.length + (hasQ ? qs.open.length : 0) + tasks.length + reelsW.length + waP;
    const top = hasQ ? 'Հարց ձեզ' : waP ? `WhatsApp՝ ${waP} պատասխան` : reelsW.length ? `Նոր ռիլ #${reelsW[0].n}` : tasks.length ? tasks[0].title : nts.length ? nts[0].text : '';
    return { html, count, top, any: !!(notice || hasQ || apr || tgCard), bind() {
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
    } };
  }

  // ───────── «Հարց ձեզ» (db\0009_owner_questions.sql). մեկ հարց միանգամից, կոճակներով ─────────
  const OTHER = 'Ուրիշ';
  function questionCard(el, qs) {
    const st = { open: qs.open.slice(), total: qs.total, answered: qs.answered, sel: [], busy: false, done: false };
    const draw = () => {
      if (st.done) {
        el.innerHTML = `<div class="card qcard qdone"><span class="qok">${sv(26, '<path d="m5 12.5 4.5 4.5L19 7.5"/>', ' style="stroke-width:2.6"')}</span>
          <h3>Շնորհակալություն</h3><p class="meta">Պատասխանները ստացանք։</p></div>`;
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
    const [h, lr, geo, riv, dv] = await Promise.all([rpc('app_home'), sb.from('channels').select('status,summary').eq('id', 'listam').maybeSingle(), rpc('app_geo').catch(() => null), rpc('app_rivals').catch(() => null), rpc('app_dlv').catch(() => null)]);
    pendingCount = h.tasks_pending || 0;
    const w = h.week;
    const soon = '<span class="tag n">շուտով</span>';
    const la = lr.data;
    const gl = geo && geo.last;
    const rvToday = riv ? (riv.changes || []).filter((c) => c.day === today()).length : 0;
    const rvNv = !riv || !(riv.rivals || []).length ? '20 մեծ պարկ' : rvToday ? `${fmt(rvToday)} փոփոխություն այսօր` : `${fmt(riv.rivals.length)} պարկ`;
    // «Բոլորը» (ԿԱ 2). տաքսի պարկի իրական բաժինները խմբերով, ամեն մեկի տակ՝ իր գլխավոր թիվը; չմիացվածները՝ ներքևում «Շուտով»
    const gc = (href, ic, col, nm, nv, nvCls, badge) => `<a class="gcell" href="${href}"><span class="ico ${col}">${ic}</span><span class="nm">${nm}</span><span class="nv ${nvCls || ''}">${nv}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</a>`;
    const grid = (title, cells) => sec(title, `<div class="gcells">${cells.join('')}</div>`);
    const laNv = !la ? 'նամակներ, հայտեր' : la.status === 'off' ? 'կանգնած է' : la.status === 'warn' ? 'ուշանում է' : 'աշխատում է';
    mount({ title: 'Բոլոր բաժինները', tab: 'sections', sub: 'HayWay տաքսի պարկ · Yandex Fleet' }, page(`
      ${grid('Վարորդներ', [
        gc('#/drivers', I.users, 'y', 'Վարորդներ', `${fmt(h.active_30d)} ակտիվ`),
        gc('#/growth', I.userplus, 'b', 'Նորեկներ', `+${fmt(h.month.new)} · 30 օր`),
      ])}
      ${grid('Գումար', [
        gc('#/finance', I.money, 'g', 'Ֆինանս', `${short(w.commission)} · 7 օր`),
        gc('#/delivery', I.box, 't', 'Առաքում', dv && dv.connected ? `${fmt(dv.active7)} առաքիչ · 7 օր` : 'միանում է'),
      ])}
      ${grid('Աճ', [
        gc('#/listam', I.mega, 'o', 'list.am', laNv, la && la.status !== 'ok' && la.status ? (la.status === 'off' ? 'neg' : 'warn') : ''),
        gc('#/geo', I.ai, 't', 'ChatGPT', gl ? `${fmt(gl.score)}% երևում ենք` : 'չափում չկա'),
        gc('#/rivals', I.trophy, 'r', 'Մրցակիցներ', rvNv),
        gc('#/team', I.chat, 'b', 'Թիմ', 'չատ աշխատակցի հետ'),
        gc('#/whatsapp', I.chat, 'g', 'WhatsApp', 'վարորդների նամակներ'),
        gc('#/reels', I.film, 'p', 'Ռիլեր', 'TikTok, Instagram'),
      ])}
      ${grid('Կառավարում', [
        gc('#/garik', I.star, 'b', 'GTH', 'Օգնական'),
        gc('#/settings', I.cfg, 's', 'Կարգավորում', 'միացումներ, մուտք'),
      ])}
      ${sec('Շուտով', group([
        cell({ href: '#/marketing', icon: I.mega, color: 'o', t: 'Մարքեթինգ', s: '10 ալիք, արշավներ', trail: soon }),
        cell({ href: '#/leads', icon: I.userplus, color: 'b', t: 'Հայտեր', s: 'Հայտից մինչև 50-րդ պատվեր', trail: soon }),
        cell({ href: '#/contact', icon: I.chat, color: 's', t: 'Կապ', s: 'Հայտարարություններ և նամակներ', trail: soon }),
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
    const staleNote = syncAge > 6 * 3600e3 ? `Ցուցակը թարմացվել է ${ago(f.drivers_synced_at)}։` : '';
    mount({ title: 'Նոր վարորդներ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '' }, page(`
      ${sec('', `<div class="card">
        <div class="hero"><span class="n">${fmt(R)}</span><span class="u">նոր վարորդ վերջին 30 օրում</span></div>
        <p class="meta">Նախորդ 30 օրում՝ ${fmt(p30.registered)}։</p>
      </div>`, { foot: staleNote })}
      ${sec('Ինչ եղավ նրանց հետ', group([
        step('Գրանցվեցին', R, true),
        step('Արեցին առաջին պատվերը', m.first || 0),
        step('Հասան 10 պատվերի', m.o10 || 0),
        step('Հասան 50 պատվերի', m.o50 || 0),
        step('Այս շաբաթ աշխատել են', m.active7 || 0),
      ]))}
      ${sec('Ըստ շաբաթների', group(weeks))}
      ${sec('Ում զանգել', group([
        cell({ href: '#/drivers/new', icon: I.userplus, color: 'o', t: 'Գրանցվել են, պատվեր չկա', s: 'Վերջին 30 օրում', v: fmt(f.zero), strong: true }),
        cell({ href: '#/quality', icon: I.trophy, color: 'y', t: 'Yandex-ի Ոսկու համար', s: 'նորեկներ 50 պատվերով', v: `${fmt(h.gold.new_50)}${NB}/${NB}80`, strong: true }),
      ], 'ic'))}
      ${sec(`Սկսեցին, բայց կանգնեցին · ${fmt(f.stalled_total)}`, stalled.length ? group(stalled, 'avs') : '<div class="group"><p class="none">Այդպիսիք հիմա չկան։</p></div>',
        { foot: 'Զանգը հիմա ամենաշատն է օգնում։' })}
    `));
  });

  // ───────── list.am վահանակ (list գործակալի բոլոր գործընթացները) ─────────
  // Տվյալները՝ channels.id='listam', լցնում է scripts\listam-import.ps1-ը Կոմպ 1-ից ժամը մեկ
  // (աղբյուրը Կոմպ 2-ի list գործակալի ֆայլերն են)։
  const daysAgo = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 864e5) : null;
  const dmyhm = (iso) => iso ? `${dmy(iso)} ${hm(iso)}` : '—';
  // 03.11, Գարիկ. «list.am բաժնում առաջինը՝ տեղադրված հայտարարությունների քանակը և 500-ի նպատակը, տակը ընդհանուր դիտումները (7 օրվա գրաֆիկով)
  // ու մնացած թվերը, կոճակով՝ մեր բոլոր հայտարարությունները իրենց թվերով; հետո՝ նամակագրությունը (այսօր քանի մարդ, 7 օր), «ինչ գովազդենք» կոճակ,
  // մրցակիցներն ու նրանց քարտերի թարմացումները, վառոնկան; ամեն ինչ պարզ, առանց երկար գրությունների»։ Տվյալը՝ channels.listam + app_listam() (db\0016)
  const LISTAM_GOAL = 500;
  const KIND = { taxi: 'տաքսի', delivery: 'առաքում', both: 'տաքսի և առաքում' };
  const ASK_PROMO = 'Ո՞ր list.am հայտարարությունները արժե գովազդել (Թոփ) հիմա և ինչու';
  const lastDays = (n) => [...Array(n)].map((_, i) => new Date(Date.now() + 4 * 3600e3 - (n - 1 - i) * 864e5).toISOString().slice(0, 10));
  const nextDay = (iso) => new Date(new Date(iso + 'T12:00:00Z').getTime() + 864e5).toISOString().slice(0, 10);
  const listamItem = (id) => `https://www.list.am/item/${encodeURIComponent(id)}`;
  route('/listam', async (arg) => {
    lastTab = 'sections';
    const [h, cr, L, pr, ic] = await Promise.all([
      rpc('app_home'),
      sb.from('channels').select('status,summary,metrics,updated_at').eq('id', 'listam').maybeSingle(),
      rpc('app_listam').catch(() => ({ days: [], ads: [], rivals: [], removed: [] })),
      sb.from('tasks').select('id,title,cost').eq('agent', 'list.am').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      // list.am գործակալի նամակների վերջին ստուգումը (10 րոպեն մեկ, HayWay-ի համակարգչում)
      sb.from('agent_log').select('at').eq('agent', 'list.am').eq('action', 'inbox').order('id', { ascending: false }).limit(1),
    ]);
    pendingCount = h.tasks_pending || 0;
    const c = cr.data || {}, M = c.metrics || {}, hl = M.health || {}, rf = M.refresh || {}, ad = M.ads || {}, ib = M.inbox || {}, mk = M.market || {}, ld = M.leads || {};
    const ads = L.ads || [], rivals = L.rivals || [];

    // ── Մեր բոլոր հայտարարությունները (կոճակից) ──
    if (arg === 'ads') {
      const rows = ads.map((x) => `<a class="cell" href="${listamItem(x.id)}" target="_blank" rel="noopener"><span class="bd">
          <span class="nm"><span class="t b">${esc(x.title || x.id)}</span>${x.top ? '<span class="tag info">Թոփ</span>' : ''}</span>
          <span class="s">${fmt(x.views)} դիտում · ${fmt(x.phone)} զանգ · ${fmt(x.applicants)} դիմորդ</span></span>
          ${x.views7 != null ? `<span class="v"><span class="tag ${x.views7 > 0 ? 'pos' : 'n'}">+${fmt(x.views7)}</span></span>` : ''}</a>`);
      mount({ title: 'Մեր հայտարարությունները', tab: 'sections', back: ['#/listam', 'list.am'], sub: ads.length ? `${fmt(ads.length)} հայտարարություն · ${dmy(L.ads_day)}` : '' },
        page(ads.length ? sec('', group(rows), { foot: 'Կանաչը՝ 7 օրվա նոր դիտումներ։' })
          : emptyState(I.mega, 'Թվերը դեռ չկան', 'Կերևան առավոտյան 09:05-ին։')));
      return;
    }
    // ── Մեկ մրցակցի քարտերը ──
    if (arg === 'rival') {
      const who = decodeURIComponent(hashParts()[3] || '');
      const mine = rivals.filter((r) => r.seller === who);
      const rows = mine.map((r) => `<a class="cell" href="${listamItem(r.id)}" target="_blank" rel="noopener"><span class="bd">
          <span class="nm"><span class="t b">${esc(r.title)}</span>${r.top ? '<span class="tag info">Թոփ</span>' : ''}${r.new ? '<span class="tag pos">նոր</span>' : ''}${r.upd ? '<span class="tag warn">թարմացրել են</span>' : ''}</span>
          <span class="s">${esc(KIND[r.kind] || '')}${r.shown ? ` · ${esc(r.shown)}` : ''}${r.n7 ? ` · 7 օրում թարմացրել են ${r.n7} անգամ` : ''}</span></span></a>`);
      mount({ title: esc(who || 'Մրցակից'), tab: 'sections', back: ['#/listam', 'list.am'], sub: `${fmt(mine.length)} հայտարարություն list.am-ում` },
        page(mine.length ? sec('', group(rows)) : emptyState(I.trophy, 'Քարտեր չկան', 'Վերջին ստուգման մեջ չկան։')));
      return;
    }

    // 1. Տեղադրված / 500 + դիտումներ (7 օրվա աճը՝ միայն իրար հաջորդող օրերից)
    const live = ad.live || ads.length || 0;
    const sn = ad.snapshots || [], last = sn[sn.length - 1] || {};
    const LD = (L.days || []).slice().sort((x, y) => (x.day < y.day ? -1 : 1));
    const lastD = LD[LD.length - 1] || {};
    const views = lastD.views != null ? lastD.views : last.views, phone = lastD.phone != null ? lastD.phone : last.phone;
    const applicants = ads.length ? ads.reduce((t, x) => t + (+x.applicants || 0), 0) : (lastD.applicants != null ? lastD.applicants : last.applicants);
    const grow = [];
    for (let i = 1; i < LD.length; i++) if (nextDay(LD[i - 1].day) === LD[i].day && LD[i].views != null && LD[i - 1].views != null) grow.push({ day: LD[i].day, v: Math.max(0, LD[i].views - LD[i - 1].views) });
    const viewsChart = grow.length ? barChart('lv', grow, 'v', (n) => fmt(n), 'դիտում') : '<p class="none">Գրաֆիկը լցվում է</p>';
    const topN = ads.length ? ads.filter((x) => x.top).length : mk.our_top;
    // 2. Նամակագրություն. այսօր քանի զրույց + 7 օր
    const ibMap = {}; (ib.days || []).forEach((d) => { ibMap[d.day] = d.n; });
    const ib7 = lastDays(7).map((d) => ({ day: d, n: ibMap[d] || 0 }));
    // 3. Վառոնկա (hayter գործակալի աղյուսակից)
    const bs = ld.by_status || {};
    const fRows = [['Գրեցին', ld.total || 0], ['Պատասխանեցինք', (bs.answered || 0) + (bs.phone || 0) + (bs.qualified || 0) + (bs.registered || 0)],
      ['Հեռախոս տվեցին', (bs.phone || 0) + (bs.qualified || 0) + (bs.registered || 0)], ['Գրանցվեցին', bs.registered || 0]];
    const f0 = fRows[0][1] || 1;
    const funnel = `<div class="card fnl">${fRows.map(([t, n], i) => `<div class="fr"><i style="--w:${Math.max(38, Math.round(n / f0 * 100))}%;--k:${i}"><b>${fmt(n)}</b><span>${t}</span></i>${i ? `<em>${pct(n, f0)}%</em>` : ''}</div>`).join('')}</div>`;
    // 4. Մրցակիցներ. վաճառողներն ըստ հայտարարությունների քանակի + այսօրվա փոփոխությունները
    const bySeller = {};
    rivals.forEach((r) => { const k = r.seller || '—'; const g = bySeller[k] || (bySeller[k] = { n: 0, top: 0, upd: 0, n7: 0, nw: 0 }); g.n++; if (r.top) g.top++; if (r.upd) g.upd++; if (r.new) g.nw++; g.n7 += +r.n7 || 0; });
    const sellers = Object.keys(bySeller).sort((x, y) => bySeller[y].n - bySeller[x].n || bySeller[y].n7 - bySeller[x].n7);
    const nNew = rivals.filter((r) => r.new).length, nUpd = rivals.filter((r) => r.upd).length, nTopNew = rivals.filter((r) => r.top_new).length;
    const rivRows = sellers.slice(0, 8).map((k) => { const g = bySeller[k]; return cell({ href: `#/listam/rival/${encodeURIComponent(k)}`, lead: `<span class="av">${esc(String(k).slice(0, 2))}</span>`,
      t: `<span class="nm"><span class="t b">${esc(k)}</span>${g.top ? `<span class="tag info">Թոփ ${g.top}</span>` : ''}${g.upd ? '<span class="tag warn">թարմացրել են</span>' : ''}</span>`,
      s: `${fmt(g.n)} հայտարարություն${g.n7 ? ` · ${g.n7} թարմացում 7 օրում` : ''}` }); });
    const lastPos = (mk.positions || []).slice(-1)[0] || {};
    // 5. Մանրամասներ. գործընթացները
    const proc = (icon, color, t, at, limitH) => {
      const ms = at ? Date.now() - new Date(at) : null, fresh = ms !== null && ms < limitH * 3600e3;
      return cell({ icon, color, t, s: at ? `վերջինը՝ ${dmyhm(at)}` : 'տվյալ չկա', v: fresh ? '<span class="tag pos">աշխատում է</span>' : '<span class="tag neg">կանգնած</span>' });
    };
    const off = c.status === 'off';
    const sub = off ? `<span class="dot bad"></span>Գործակալը կանգնած է ${daysAgo(hl.data_at)}${NB}օր` : `<span class="dot ok"></span>թարմ՝ ${ago(c.updated_at)}`;
    mount({ title: 'list.am', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub }, page(`
      ${off ? `<div class="err"><b>Գործակալը ${dmy(hl.data_at)}-ից չի աշխատում</b></div>` : ''}
      <div class="card hc">
        <div class="lab"><span>Տեղադրված հայտարարություններ</span><span class="aux">նպատակ՝ ${fmt(LISTAM_GOAL)}</span></div>
        <div class="val"><span data-n="${live}">${fmt(live)}</span><small>/ ${fmt(LISTAM_GOAL)}</small></div>
        <div class="prog y"><span style="width:${Math.min(100, live / LISTAM_GOAL * 100)}%"></span></div>
        <div class="d14">
          <div class="d14-h"><span>Ընդհանուր դիտում</span><b data-n="${views || 0}">${fmt(views)}</b></div>
          ${viewsChart}
        </div>
      </div>
      <div class="kpis">
        ${kpi('Զանգի սեղմում', fmt(phone), '')}
        ${kpi('Դիմորդներ', fmt(applicants), '')}
        ${kpi('Թոփ-ում', fmt(topN), '')}
        ${kpi('Թարմացում մնաց', fmt(rf.package_left), rf.package_until ? `մինչև ${dmy(rf.package_until)}` : '')}
      </div>
      <a class="btn pri full" href="#/listam/ads">${I.mega} Բոլոր հայտարարությունները${ads.length ? ` · ${fmt(ads.length)}` : ''}</a>
      ${sec('Նամակագրություն', `<div class="card">
        <div class="hero"><span class="n" data-n="${ibMap[today()] || 0}">${fmt(ibMap[today()] || 0)}</span><span class="u">զրույց այսօր</span></div>
        ${barChart('lm', ib7, 'n', (n) => fmt(n), 'զրույց')}
      </div>
      <div class="kpis k3">
        ${kpi('Թեժ հայտ', fmt(ib.hot), '')}
        ${kpi('Հարց քեզ', fmt(ib.open_questions), '')}
        ${kpi('Դիմորդ', fmt(ib.applicants), '')}
      </div>`)}
      ${sec('Ինչ գովազդենք', `<a class="btn pri full" href="#/garik?ask=${encodeURIComponent(ASK_PROMO)}">${I.star} GTH, առաջարկիր</a>`
        + ((pr.data || []).length ? group((pr.data || []).map((t) => cell({ href: '#/tasks', icon: I.trophy, color: 'o', t: esc(t.title), v: t.cost ? `<span class="tag warn">${esc(t.cost)}</span>` : '' })), 'ic') : ''))}
      ${sec('Վառոնկա', funnel)}
      ${sec('Մրցակիցներ', `<div class="kpis">
        ${kpi('Yandex-ի գովազդ', fmt(mk.yandex_ads), `${fmt(mk.sellers)} մրցակից`)}
        ${kpi('Մեր լավագույն տեղը', lastPos.best ? '#' + lastPos.best : '—', 'ցուցակում')}
      </div>`
        + (rivals.length ? (L.rivals_prev ? `<div class="chips">${[[nUpd, 'թարմացրել են', 'warn'], [nNew, 'նոր', 'pos'], [nTopNew, 'նոր Թոփ', 'info']].map(([n, t]) => `<span class="chip">${fmt(n)} ${t}</span>`).join('')}</div>` : '') + group(rivRows, 'avs')
          : '<p class="none">Կերևան հաջորդ ստուգումից հետո</p>'), { foot: rivals.length ? `Ստուգումը՝ ${dmy(L.rivals_day)}։` : '' })}
      ${sec('Մանրամասներ', group([
        // 03.11, Գարիկ. «սա ինչու է կանգնած» → ոչ թե վերջին պատասխանի ժամը (նոր նամակ չլինելիս հին է), այլ վերջին ստուգումը
        proc(I.chat, 'b', 'Նամակներին պատասխան', (ic && ic.data && ic.data[0] && ic.data[0].at) || ib.last_at, 2),
        proc(I.refresh, 'g', 'Հայտարարությունների թարմացում', rf.last_at, 13),
        proc(I.trophy, 'o', 'Մրցակիցների ստուգում', mk.generated, 26),
        proc(I.userplus, 'p', 'Հայտերի աղյուսակ', ld.updated_at, 26),
      ], 'ic'))}
    `));
  });

  // ───────── Մրցակիցներ (db\0022_rivals.sql, 2026-11-03, Գարիկ. «20 մեծին», ծանուցում՝ միայն 3 դեպքում) ─────────
  // Տվյալները՝ app_rivals() / app_rival(). լցնում է HayWay-ի համակարգչի «Garik-Rivals» task-ը ամեն օր (scripts\rivals-check.ps1)։
  // list.am-ի մյուս փոքր պարկերը մնում են list.am բաժնում։
  const OFFER = [['taxi_pct', 'Տաքսի՝ պարկի տոկոս'], ['delivery_pct', 'Առաքում՝ պարկի տոկոս'], ['flat_fee', 'Ֆիքսված վճար'], ['bonus', 'Բոնուս նորեկին'],
    ['first_week', 'Սկզբի զեղչ'], ['cashback', 'Վերադարձ (cashback)'], ['referral', 'Ընկեր բերելու բոնուս'], ['car_rent', 'Մեքենա վարձով'],
    ['payout', 'Վճարում'], ['languages', 'Լեզուներ'], ['other', 'Այլ']];
  const WHY = { price_below: 'մեզնից էժան', bonus: 'նոր բոնուս', big_ad: 'մեծ գովազդ' };
  const numPct = (v) => { const m = String(v ?? '').replace(',', '.').match(/\d+(\.\d+)?/); return m ? +m[0] : null; };
  const refPct = (v) => String(v ?? '—').replace('.', ',');
  // ցուցակում՝ միայն կարճը (առաջին մասը մինչև «;» կամ «(»), մանրամասնը՝ պարկի էջում
  const brief = (v) => { const t = String(v || '').split(/[;(]/)[0].trim(); return t.length > 32 ? t.slice(0, 31).trim() + '…' : t; };
  const rivalOffer = (o) => { o = o || {}; return [o.taxi_pct && `տաքսի ${brief(o.taxi_pct)}`, o.delivery_pct && `առաքում ${brief(o.delivery_pct)}`, o.flat_fee && brief(o.flat_fee),
    o.first_week && brief(o.first_week), o.bonus && `բոնուս ${brief(o.bonus)}`].filter(Boolean).slice(0, 3).map((x) => esc(x)).join(' · ') || 'պայմանները դեռ չգիտենք'; };
  const rvLead = (n) => `<span class="av">${esc(String(n || '').slice(0, 2))}</span>`;
  const chCell = (c, withDay) => cell({ href: `#/rivals/${encodeURIComponent(c.rival)}`, lead: rvLead(c.name),
    t: `<span class="nm"><span class="t b">${esc(c.name)}</span>${c.important ? `<span class="tag warn">${esc(WHY[c.why] || 'կարևոր')}</span>` : ''}</span>`,
    s: esc(c.title), v: withDay ? dmy(c.day) : undefined });
  route('/rivals', async (id) => {
    lastTab = 'sections';
    if (id) return rivalPage(decodeURIComponent(id));
    const [h, R] = await Promise.all([rpc('app_home'), rpc('app_rivals')]);
    pendingCount = h.tasks_pending || 0;
    const rv = R.rivals || [], ch = R.changes || [], ref = R.ref || {}, td = today();
    const now = ch.filter((c) => c.day === td), before = ch.filter((c) => c.day !== td).slice(0, 15);
    const ads = rv.filter((r) => r.state && +r.state.meta_ads > 0).length;
    const sub = R.checked_at ? `<span class="dot ok"></span>ստուգված՝ ${ago(R.checked_at)}` : '<span class="dot wait"></span>առաջին ստուգումը շուտով';
    if (!rv.length) return mount({ title: 'Մրցակիցներ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub },
      page(emptyState(I.trophy, 'Ցուցակը լցվում է', 'Կերևա առաջին ստուգումից հետո։')));
    const rows = rv.map((r) => {
      const o = r.offer || {}, st = r.state || {}, c = r.channels || {};
      const cheaper = numPct(o.taxi_pct) !== null && ref.taxi_pct && numPct(o.taxi_pct) < ref.taxi_pct;
      const where = [+st.meta_ads ? `գովազդ ${fmt(st.meta_ads)}` : '', +st.listam_ads ? `list.am ${fmt(st.listam_ads)}` : '',
        c.instagram ? 'Instagram' : '', c.tiktok ? 'TikTok' : '', c.site ? 'կայք' : ''].filter(Boolean).join(' · ');
      return cell({ href: `#/rivals/${encodeURIComponent(r.id)}`, lead: rvLead(r.name),
        t: `<span class="nm"><span class="t b">${esc(r.name)}</span>${r.imp7 ? '<span class="tag warn">կարևոր</span>' : r.ch7 ? `<span class="tag info">${fmt(r.ch7)} փոփոխ.</span>` : ''}${cheaper ? '<span class="tag neg">մեզնից էժան</span>' : ''}</span>`,
        s: rivalOffer(o) + (where ? `<br>${esc(where)}` : '') });
    });
    mount({ title: 'Մրցակիցներ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub }, page(`
      <div class="kpis k3">
        ${kpi('Փոխվեց այսօր', fmt(now.length), '')}
        ${kpi('Կարևոր', fmt(now.filter((c) => c.important).length), 'ծանուցում')}
        ${kpi('Գովազդ են անում', fmt(ads), `${fmt(rv.length)} պարկից`)}
      </div>
      ${sec('Այսօր փոխվեց', now.length ? group(now.map((c) => chCell(c)), 'avs') : `<p class="none">${R.checked_at ? 'Այսօր փոփոխություն չկա' : 'Դեռ ստուգում չի եղել'}</p>`)}
      ${sec(`Բոլոր ${fmt(rv.length)} պարկը`, group(rows, 'avs'))}
      ${before.length ? sec('Նախորդ օրերը', group(before.map((c) => chCell(c, true)), 'avs')) : ''}
      ${(R.others || []).length ? sec('list.am-ում մեծանում են', group(R.others.map((o) => cell({ href: `#/listam/rival/${encodeURIComponent(o.seller)}`, t: esc(o.seller), v: `${fmt(o.n)} հայտ.` }))),
        { foot: 'Սրանք 20-ի մեջ չեն։' }) : ''}
    `));
  });
  async function rivalPage(id) {
    const [h, r] = await Promise.all([rpc('app_home'), rpc('app_rival', { p_id: id })]);
    pendingCount = h.tasks_pending || 0;
    const o = r.offer || {}, c = r.channels || {}, st = r.state || {}, ref = r.ref || {}, la = r.listam || {};
    const ext = (href, icon, color, t, s, v) => `<a class="cell" href="${esc(href)}" target="_blank" rel="noopener"><span class="ico ${color}">${icon}</span><span class="bd"><span class="t">${t}</span>${s ? `<span class="s">${s}</span>` : ''}</span>${v ? `<span class="v">${v}</span>` : ''}<span class="chev">${I.chev}</span></a>`;
    const terms = OFFER.filter(([k]) => o[k]).map(([k, l]) => {
      const lower = (k === 'taxi_pct' || k === 'delivery_pct') && numPct(o[k]) !== null && ref[k] && numPct(o[k]) < ref[k];
      return cell({ t: l, s: esc(o[k]), v: lower ? '<span class="tag neg">մեզնից ցածր</span>' : undefined });
    });
    const ig = String(c.instagram || '').replace(/^@/, ''), tt = String(c.tiktok || '').replace(/^@/, ''), tg = String(c.telegram || '').replace(/^@|^https?:\/\/t\.me\//g, '');
    const metaUrl = c.fb_page_id ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=AM&view_all_page_id=${encodeURIComponent(c.fb_page_id)}`
      : `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=AM&search_type=keyword_unordered&q=${encodeURIComponent(c.fb_name || r.name)}`;
    const seller = (c.listam_sellers || [])[0] || r.name;
    const where = [
      c.site && ext(c.site, I.link, 'b', 'Կայք', esc(String(c.site).replace(/^https?:\/\//, '').replace(/\/$/, ''))),
      (c.fb_name || c.facebook || c.fb_page_id) && ext(metaUrl, I.mega, 'o', 'Facebook և Instagram գովազդ', st.meta_ads != null ? `${fmt(st.meta_ads)} ակտիվ գովազդ` : 'Meta-ի գովազդների գրադարան'),
      c.facebook && ext(c.facebook, I.users, 'b', 'Facebook էջ', esc(c.fb_name || '')),
      ig && ext(`https://www.instagram.com/${ig}/`, I.star, 'p', 'Instagram', '@' + esc(ig), st.ig_followers ? tiny(st.ig_followers) : ''),
      tt && ext(`https://www.tiktok.com/@${tt}`, I.star, 's', 'TikTok', '@' + esc(tt), st.tiktok_followers ? tiny(st.tiktok_followers) : ''),
      tg && ext(`https://t.me/${tg}`, I.chat, 't', 'Telegram', '@' + esc(tg)),
      la.n ? cell({ href: `#/listam/rival/${encodeURIComponent(seller)}`, icon: I.mega, color: 'y', t: 'list.am', s: `${fmt(la.n)} հայտարարություն${la.top ? ` · Թոփ ${fmt(la.top)}` : ''}` }) : '',
      ...(c.jobs || []).filter((j) => j && j.url).map((j) => ext(j.url, I.userplus, 'g', esc(j.site || 'Աշխատանքի կայք'), 'աշխատանքի հայտարարություն')),
    ].filter(Boolean);
    const list = (xs) => group(xs.map((x) => cell({ t: esc(x) })));
    const changes = (r.changes || []).map((x) => cell({ t: `<span class="nm"><span class="t">${esc(x.title)}</span>${x.important ? '<span class="tag warn">կարևոր</span>' : ''}</span>`,
      s: [x.before && `առաջ՝ ${esc(x.before)}`, x.after && `հիմա՝ ${esc(x.after)}`].filter(Boolean).join('<br>'), v: dmy(x.day) }));
    const subParts = [KIND[r.kind] || '', (r.phones || [])[0] || ''].filter(Boolean).map(esc).join(' · ');
    mount({ title: esc(r.name), tab: 'sections', back: ['#/rivals', 'Մրցակիցներ'], sub: subParts }, page(`
      ${sec('Պայմանները', terms.length ? group(terms) : '<p class="none">Պայմանները դեռ չգիտենք</p>', { foot: `HayWay՝ տաքսի ${refPct(ref.taxi_pct)}%, առաջին 7 օրը՝ 0%։` })}
      ${sec('Որտեղ են', where.length ? group(where, 'ic') : '<p class="none">Խողովակներ չեն գտնվել</p>', { foot: r.checked_at ? `Ստուգված՝ ${dmyhm(r.checked_at)}` : '' })}
      ${(r.strong || []).length ? sec('Ուժեղ կողմերը', list(r.strong)) : ''}
      ${(r.weak || []).length ? sec('Թույլ կողմերը', list(r.weak)) : ''}
      ${sec('Փոփոխություններ', changes.length ? group(changes) : '<p class="none">Դեռ փոփոխություն չի եղել</p>')}
      ${r.size_note ? `<p class="sec-f">${esc(r.size_note)}</p>` : ''}
    `));
  }

  // ───────── ChatGPT (AI տեսանելիություն) ─────────
  // Տվյալները՝ app_geo() / app_geo_answers() (db\0012_geo.sql). լցնում է HayWay-ի համակարգչի «Garik-GEO» task-ը շաբաթը մեկ
  // (scripts\geo-weekly.ps1). ChatGPT-ին հարցնում է առանց մուտքի՝ ինչպես աշխատանք փնտրող նոր վարորդը կամ առաքիչը։
  // Նոր լեզուները ավելացնում է ինքնաճը (geo-grow.ps1, 05.11)
  const LANG = { hy: 'հայերեն', ru: 'ռուսերեն', en: 'անգլերեն', hi: 'հինդի', fa: 'պարսկերեն', uz: 'ուզբեկերեն', tg: 'տաջիկերեն', ky: 'ղրղզերեն',
    tk: 'թուրքմեներեն', ka: 'վրացերեն', ar: 'արաբերեն', ur: 'ուրդու', bn: 'բենգալերեն', ne: 'նեպալերեն', tr: 'թուրքերեն', kk: 'ղազախերեն' };
  const WHO = { driver: 'վարորդ', courier: 'առաքիչ', both: 'վարորդ և առաքիչ' };
  const wkLabel = (wk) => {
    const [y, n] = String(wk || '').split('-W').map(Number);
    if (!y || !n) return '';
    const j4 = Date.UTC(y, 0, 4), mon = j4 - ((new Date(j4).getUTCDay() + 6) % 7) * 864e5 + (n - 1) * 7 * 864e5;
    const f = (t) => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
    return `${f(mon)}–${f(mon + 6 * 864e5)}`;
  };
  const place = (x) => 'տեղը՝' + NB + String(x).replace('.', ',');
  // 100 հարցի նպատակը (queries.json v2.0, 03.11). summary.map = {goal,total,yes,no,none}, summary.topics = թեմաները պլանի հերթով
  // (ամենաշատ «չկանք»-ը առաջինը. ինքնավար խմբագիրը՝ geo-act.ps1-ը, աշխատում է նույն հերթով)
  const qs = (q) => `${LANG[q.lang] || q.lang} · ${WHO[q.who] || ''}`;
  // ⛔ 05.11 (Գարիկ). «կանք» = 3 փորձից 2+; 1/1 կամ 1/3 = some («ստուգում ենք»), map.yes-ում չի հաշվվում
  const geoYes = (q) => q.state === 'yes';
  const qNo = (q) => cell({ href: '#/geo/' + q.id, t: esc(q.q),
    s: `${qs(q)}${q.rivals && q.rivals.length ? ' · փոխարենը՝ ' + q.rivals.slice(0, 3).map(esc).join(', ') : ''}`, v: '<span class="tag neg">չկանք</span>' });
  const qYes = (q) => cell({ href: '#/geo/' + q.id, t: esc(q.q),
    s: q.carried ? `${qs(q)} · նախորդ ստուգումից` : `${qs(q)} · ${q.hit}/${q.n} անգամ${q.rank ? ' · ' + place(q.rank) : ''}`,
    v: q.state === 'yes' ? '<span class="tag pos">կանք</span>' : (q.n || 0) < 3 ? '<span class="tag warn">ստուգում ենք</span>' : '<span class="tag warn">երբեմն</span>' });
  const qWait = (q) => cell({ t: esc(q.q), s: qs(q), v: '<span class="tag n">ստուգվում է</span>' });
  const bar = (a, b) => `<div class="mbar"><span style="width:${b ? Math.round(100 * a / b) : 0}%"></span></div>`;
  route('/geo', async (qid) => {
    lastTab = 'sections';
    if (qid) return qid.startsWith('t-') ? geoTopic(qid.slice(2)) : geoQuestion(qid);
    const [h, g] = await Promise.all([rpc('app_home'), rpc('app_geo')]);
    pendingCount = h.tasks_pending || 0;
    const L = g.last, run = g.runner || {};
    const runAge = run.seen_at ? Date.now() - new Date(run.seen_at) : Infinity;
    const sub = !run.seen_at ? '<span class="dot wait"></span>Միանում է'
      : runAge < 3 * 864e5 ? '<span class="dot ok"></span>Ստուգում՝ շաբաթը մեկ'
      : `<span class="dot bad"></span>Ստուգողը կանգնած է ${ago(run.seen_at)}`;
    if (!L) {
      mount({ title: 'ChatGPT', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub }, page(emptyState(I.ai, 'Առաջին ստուգումը շուտով է', 'Շաբաթը մեկ՝ 100 հարց։')));
      return;
    }
    const S = L.summary || {}, Q = S.queries || [], hist = g.history || [];
    const prev = hist.length > 1 ? hist[hist.length - 2] : null;
    const gen = Q.filter((q) => q.kind !== 'brand');
    const M = S.map || { goal: gen.length, total: gen.length, yes: gen.filter(geoYes).length, some: gen.filter((q) => q.state === 'some').length, no: gen.filter((q) => q.state === 'no').length, none: gen.filter((q) => q.state === 'none').length };
    const ST = { doing: '<span class="tag info">աշխատում ենք</span>', todo: '<span class="tag n">հաջորդը</span>' };
    const acts = (g.actions || []).map((a) => cell({ t: esc(a.title), s: esc(a.place || ''),
      v: a.status === 'done' ? `<span class="tag pos">արված${a.done_at ? ' ' + dmy(a.done_at) : ''}</span>` : (ST[a.status] || '') }));
    // Պլանը. առաջին բաց թեման՝ «այս շաբաթ», մնացած բացերը՝ «հերթում», բոլորում կանք՝ «կանք»
    let nextSet = false;
    const tops = (S.topics || []).map((t) => {
      let tag;
      if (t.no > 0 && !nextSet) { nextSet = true; tag = '<span class="tag info">այս շաբաթ</span>'; }
      else if (t.no > 0) tag = '<span class="tag n">հերթում</span>';
      else if (t.none > 0) tag = '<span class="tag n">ստուգվում է</span>';
      else tag = '<span class="tag pos">կանք</span>';
      const sm = t.some || 0;
      const s = t.no ? (sm ? `չկանք ${t.no - sm}, ստուգում ենք ${sm}` : `չկանք ${t.no} հարցում`) : t.none ? `${t.none} հարց դեռ ստուգվում է` : `բոլոր ${t.n} հարցում կանք`;
      return cell({ href: '#/geo/t-' + t.id, t: `${esc(t.name)} ${tag}`, s, v: `${t.yes}${NB}/${NB}${t.n}`, strong: true, extra: bar(t.yes, t.n) });
    });
    const mk = S.markets || {}, meta = S.markets_meta || {};
    const mrows = Object.keys(meta).filter((k) => mk[k]).map((k) => cell({ t: `${meta[k].flag} ${esc(meta[k].name)}`, s: `${mk[k].hit} հարցում ${mk[k].n}-ից`,
      v: `${fmt(mk[k].pct)}%`, strong: true, extra: bar(mk[k].pct || 0, 100) }));
    // Ինքնաճ (geo-grow.ps1, 05.11). նպատակի սանդուղք, հարցերի աճ, և նախորդ էջերը՝ օգնե՞լ են (1–3 շաբաթ հետո)
    const G = S.growth || null;
    const done = new Set(((G && G.reached) || []).map((x) => x.goal));
    const ladder = G ? (G.ladder || []).filter((n) => n <= (G.next || G.goal) || done.has(n))
      .map((n) => done.has(n) ? `${n}${NB}✓` : n === M.goal ? `<b>${n}</b>` : `${n}`).join(' → ') + (G.next ? ' → …' : '') : '';
    const learn = (S.learned || []).map((l) => cell({ t: esc(l.name), s: esc((l.pages || []).map((p) => p.replace(/index\.html$/, '')).join(', ')),
      v: l.helped > 0 ? `<span class="tag pos">${l.helped}/${l.of} հարցում կանք</span>`
        : l.final ? '<span class="tag neg">չօգնեց, փոխում է</span>' : `<span class="tag n">${l.helped}/${l.of}, սպասում է</span>` }));
    // «Ում է առաջարկում»-ում HayWay-ն էլ՝ նույն հաշվով, ինչ մրցակիցները (նշված պատասխաններ / բոլոր պատասխանները, առանց brand հարցերի)
    const selfN = gen.reduce((a, q) => a + (q.n || 0), 0), selfHit = gen.reduce((a, q) => a + (q.hit || 0), 0);
    const recs = [...(selfN ? [{ name: 'HayWay', n: selfHit, pct: Math.round(100 * selfHit / selfN), me: true }] : []), ...(S.rivals || []).slice(0, 3)]
      .sort((a, b) => (b.pct || 0) - (a.pct || 0));
    mount({ title: 'ChatGPT', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub }, page(`
      ${sec('', `<div class="card">
        <div class="hero"><span class="n">${M.yes}${NB}/${NB}${M.goal}</span><span class="u">հարցում ChatGPT-ն նշում է HayWay-ը</span></div>
        ${bar(M.yes, M.goal)}
        <p class="meta">${G ? `Նպատակները՝ ${ladder}։` : `Նպատակը՝ ${M.goal}։`}${prev && prev.cover != null ? ` Անցյալ շաբաթ՝ ${prev.cover}։` : ''}${M.some ? ` ${M.some}-ում մեկ անգամ նշեց՝ ստուգում ենք։` : ''}${M.none ? ` ${M.none}-ը ստուգվում է։` : ''}</p>
        <p class="meta">«Կանք»՝ միայն երբ 3 փորձից 2-ում ChatGPT-ն մեզ նշում է։</p>
        ${G ? `<p class="meta">Ստուգում ենք ${G.pool} հարց${G.added_week ? `, այս շաբաթ ինքն ավելացրեց ${G.added_week} նոր հարց` : ''}։ Ամեն հարց = մեկ նպատակ։</p>` : ''}
        ${L.note ? `<p class="meta"><b>${esc(L.note)}</b></p>` : ''}
      </div><div class="kpis" style="margin-top:8px">
        ${kpi('Որտեղ չկանք', `${M.no}`, 'հարցում')}
        ${G && G.next ? kpi('Հաջորդ նպատակը', `${G.next}`, 'հարց') : kpi('Ճանաչում է մեզ', `${fmt(L.brand)}%`, '')}
      </div>`)}
      ${tops.length ? sec('Պլանը՝ ըստ թեմաների', group(tops)) : ''}
      ${sec('Ինչ ենք արել և անում', acts.length ? group(acts) : '<div class="group"><p class="none">Քայլերը կգրվեն ստուգումից հետո։</p></div>')}
      ${G ? sec('Ինքն իրեն ստուգում է', learn.length ? group(learn) : '<div class="group"><p class="none">Ամեն նոր էջից 1–3 շաբաթ հետո այստեղ կերևա՝ օգնե՞ց։</p></div>') : ''}
      ${sec('Ըստ երկրի և լեզվի', group(mrows))}
      ${recs.length ? sec('Ում է ChatGPT-ն առաջարկում', group(recs.map((r) => cell({ t: r.me ? 'HayWay <span class="tag pos">մենք</span>' : esc(r.name), bold: r.me,
        s: `${r.n} պատասխանում`, v: `${fmt(r.pct)}%`, strong: true })))) : ''}
      ${hist.length > 1 ? sec('Ըստ շաբաթների', group(hist.slice().reverse().map((x) => cell({ t: wkLabel(x.week), s: `${x.answers} պատասխան`,
        v: x.cover != null ? `${x.cover}${NB}/${NB}${x.total}` : `${fmt(x.score)}%`, strong: true })))) : ''}
      <p class="sec-f">Ստուգված՝ ${wkLabel(L.week)}</p>
    `));
  });

  // Մեկ թեմայի հարցերը՝ որտեղ չկանք, որտեղ կանք, որոնք դեռ ստուգվում են
  async function geoTopic(tid) {
    const [h, g] = await Promise.all([rpc('app_home'), rpc('app_geo')]);
    pendingCount = h.tasks_pending || 0;
    const S = (g.last && g.last.summary) || {}, t = (S.topics || []).find((x) => x.id === tid);
    if (!t) { location.hash = '#/geo'; return; }
    const Q = (S.queries || []).filter((q) => q.topic === tid && q.kind !== 'brand');
    const no = Q.filter((q) => q.state === 'no'), some = Q.filter((q) => q.state === 'some'), yes = Q.filter(geoYes), wait = Q.filter((q) => q.state === 'none');
    const pg = t.page == null ? 'Էջը դեռ չկա։' : `Մեր էջը՝ haywaypark.am/${esc(t.page)}`;
    mount({ title: esc(t.name), tab: 'sections', back: ['#/geo', 'ChatGPT'], sub: esc(`${t.yes} հարցում կանք ${t.n}-ից`) }, page(`
      ${sec('', `<div class="card">
        <div class="hero"><span class="n">${t.yes}${NB}/${NB}${t.n}</span><span class="u">հարցում ChatGPT-ն նշում է HayWay-ը</span></div>
        ${bar(t.yes, t.n)}
        <p class="meta">${pg}</p>
      </div>`)}
      ${no.length ? sec(`Որտեղ չկանք · ${no.length}`, group(no.map(qNo))) : ''}
      ${some.length ? sec(`Մեկ անգամ նշեց, ստուգում ենք · ${some.length}`, group(some.map(qYes))) : ''}
      ${yes.length ? sec(`Որտեղ կանք · ${yes.length}`, group(yes.map(qYes))) : ''}
      ${wait.length ? sec(`Դեռ ստուգվում է · ${wait.length}`, group(wait.map(qWait))) : ''}
    `));
  }

  // Մեկ հարցի պատասխանները՝ ինչպես ChatGPT-ն է գրել
  async function geoQuestion(id) {
    const [h, rows, g] = await Promise.all([rpc('app_home'), rpc('app_geo_answers', { p_id: id }), rpc('app_geo').catch(() => null)]);
    pendingCount = h.tasks_pending || 0;
    const r0 = rows[0] || {};
    const S = (g && g.last && g.last.summary) || {}, qq = (S.queries || []).find((q) => q.id === id), tp = qq && (S.topics || []).find((t) => t.id === qq.topic);
    const cards = rows.filter((r) => r.ok).map((r) => sec(`Պատասխան ${r.rep}`, `<div class="card">
        <div>${r.mentioned ? `<span class="tag pos">HayWay-ը կա${r.rank ? ' · ' + place(r.rank) : ''}</span>` : '<span class="tag neg">HayWay-ը չկա</span>'}${r.our_cited ? ' <span class="tag info">մեր էջը աղբյուր է</span>' : ''}</div>
        <div class="ans clip" dir="auto">${esc(r.answer)}</div>
        <button class="btn full ans-more" type="button">Կարդալ ամբողջը</button>
        ${(r.sources || []).length ? `<p class="meta">Աղբյուրներ՝ ${r.sources.map(esc).join(', ')}</p>` : ''}
      </div>`));
    const sc = mount({ title: 'ChatGPT-ի պատասխանը', tab: 'sections', back: tp ? ['#/geo/t-' + tp.id, tp.name] : ['#/geo', 'ChatGPT'], sub: esc(`${LANG[r0.lang] || ''} · ${wkLabel(r0.week)}`) }, page(`
      ${sec('Հարցը', `<div class="card"><h3 dir="auto">${esc(r0.q || id)}</h3></div>`)}
      ${cards.join('') || sec('', '<div class="group"><p class="none">Պատասխան դեռ չկա։</p></div>')}
    `));
    sc.querySelectorAll('.ans-more').forEach((b) => b.onclick = () => { b.previousElementSibling.classList.remove('clip'); b.remove(); });
  }

  // ───────── Ռիլեր (db\0021_reels.sql, 03.11). ամեն օր AI կերպարով մեկ ռիլ TikTok-ի և Instagram-ի համար. տերը դիտում է,
  // գրում կարծիք և սեղմում «Հրապարակել» կամ «Փոխել»; հրապարակվածների տակ՝ թվերը 7 օրով. ⛔ առաջին 10-ում գովազդ չկա ─────────
  const REEL_ST = { ready: ['info', 'սպասում է ձեզ'], approved: ['pos', 'կհրապարակվի'], changes: ['warn', 'փոխում ենք'], publishing: ['info', 'հրապարակվում է'],
    published: ['pos', 'հրապարակված'], failed: ['neg', 'չհրապարակվեց'], skipped: ['n', 'բաց թողնված'] };
  const reelTag = (r) => { const [c, t] = REEL_ST[r.status] || ['n', r.status]; return `<span class="tag ${c}">${t}${r.status === 'published' && r.published_at ? ' ' + dmy(r.published_at) : ''}</span>`; };
  const reelSum = (r, k) => ['tiktok', 'instagram'].reduce((a, p) => a + (r.last && r.last[p] ? +r.last[p][k] || 0 : 0), 0);
  // օրվա դիտումները՝ կուտակային թվերի տարբերությունից
  const reelDays = (r) => (r.days || []).map((d, i, a) => ({ day: d.day, views: Math.max(0, d.views - (i ? a[i - 1].views : 0)) }));
  // ───────── WhatsApp (db\0020_whatsapp.sql, 03.11) ─────────
  // Գարիկ 03.11. «պարզ և ընկալելի. միայն քանի հոգու հետ է չատը խոսել, քանիսն են գրանցվել, իսկ կարևորը՝ ներքևում ծանուցումով կամ հարցով»։
  // Նամակները՝ SendPulse-ից (098 888 960, մենյուն մնում է), նախագիծը՝ տիրոջ Claude-ը HayWay-ի համակարգչում, «Ուղարկել»-ից հետո՝ wa-bot-ը։
  // ───────── Թիմ (05.11, db\0036. Գարիկ. «հայվեյի համարել ստեղծի նույն կերպ թիմի բաժին և մեկ հավելվածել իր աշխատակցի համար») ─────────
  // Միայն չատերի ցուցակ՝ անուն + «N նոր», առանց վերջին նամակի (Գարիկ 05.11. «պարզ, առանց երկար բարակ գրածի»), սեղմելով՝ զրույցը (team.js)։
  // Աշխատակցի հավելվածը՝ team/ (ԿԱ 6՝ HayWay անունով ու պատկերակով). մուտքը՝ «Հրավեր»-ի հղումով/կոդով, որը տերը ինքն է ուղարկում։
  const datHy = (n) => n + (/[աո]$/.test(n) ? 'յին' : 'ին');
  route('/team', async (arg) => {
    lastTab = 'sections';
    if (arg) return teamChat(decodeURIComponent(arg));
    const L = await fetchRpc('team_list');
    const rows = L.map((p) => cell({ href: '#/team/' + encodeURIComponent(p.email), icon: I.chat, color: 'b', t: esc(p.name), bold: p.unread > 0,
      trail: p.unread ? `<span class="wa-n">${fmt(p.unread)}</span>` : '' }));
    const inv = L.map((p) => `<button type="button" class="btn sm gray" data-inv="${esc(p.email)}" data-name="${esc(p.name)}">Հրավեր ${esc(datHy(p.name))}</button>`).join('');
    const sc = mount({ title: 'Թիմ', tab: 'sections', back: ['#/sections', 'Բաժիններ'] }, page(L.length
      ? `${sec('', group(rows))}${sec('', `<div class="tinv">${inv}</div><div id="tinvbox"></div>`, { foot: 'Հրավերը հղում է աշխատակցի հավելվածի համար՝ ուղարկեք ինքներդ։' })}`
      : emptyState(I.chat, 'Աշխատակից դեռ չկա', 'Ավելացնում է GTH թիմը')));
    sc.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-inv]');
      if (!b) return;
      b.disabled = true;
      try {
        const v = await fetchRpc('app_team_invite', { p_staff: b.dataset.inv });
        const url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'team/#c' + v.code;
        const box = document.getElementById('tinvbox');
        box.innerHTML = `<div class="card tinv-c"><p>${esc(b.dataset.name)}-ի հավելվածը</p><input class="in" readonly value="${esc(url)}">
          <p>Կամ կոդը՝ <b class="tinv-k">${esc(v.code.slice(0, 4))} ${esc(v.code.slice(4))}</b> · գործում է մինչև ${dmy(v.expires_at)}</p>
          <div class="btns"><button type="button" class="btn pri" data-cp>Պատճենել հղումը</button>${navigator.share ? '<button type="button" class="btn" data-sh>Ուղարկել…</button>' : ''}</div></div>`;
        box.querySelector('[data-cp]').onclick = async (ev) => { try { await navigator.clipboard.writeText(url); ev.target.textContent = 'Պատճենված է'; } catch (x) { box.querySelector('input').select(); } };
        const sh = box.querySelector('[data-sh]');
        if (sh) sh.onclick = () => navigator.share({ title: 'HayWay', text: 'HayWay-ի հավելվածը', url }).catch(() => {});
      } catch (er) { alert('Չստացվեց՝ ' + er.message); }
      b.disabled = false;
    });
  });
  // զրույցը՝ WhatsApp-ի տեսքով (Գարիկ 05.11, ԿԱ 6). առանց ներքևի ներդիրների, մեծ էջը փոխվում է ամբողջությամբ
  async function teamChat(email) {
    const T = await fetchRpc('team_thread', { p_staff: email, p_after: 0 });
    const name = T.staff.name, here = location.hash;
    app.innerHTML = HWTeam.screen({ back: '#/team', name, status: 'աշխատակից', av: { name }, placeholder: `Գրեք ${datHy(name)}` });
    app.classList.remove('has-dock', 'gth');
    app.classList.add('wa');
    HWTeam.start({ sb, staff: email, el: document.getElementById('tthread'), sc: document.getElementById('sc'), q: document.getElementById('q'),
      send: document.getElementById('send'), first: T, alive: () => location.hash === here && !!document.getElementById('tthread'),
      empty: `<div class="wa-empty"><span class="note">Գրեք ${esc(datHy(name))}. նա կստանա իր HayWay հավելվածում</span></div>` });
  }


  route('/whatsapp', async () => {
    lastTab = 'sections';
    const [h, W] = await Promise.all([rpc('app_home'), rpc('app_wa')]);
    pendingCount = h.tasks_pending || 0;
    const fresh = W.hook_at && Date.now() - new Date(W.hook_at) < 2 * 864e5;
    // 03.11-ից երկու համար՝ 098 888 960 «HayWay» և 044 080 806 «HayWay Park» (երկուսն էլ տաքսոպարկինն են)
    const sub = !W.hook_at ? '<span class="dot wait"></span>098 888 960 · 044 080 806'
      : `<span class="dot ${fresh ? 'ok' : 'bad'}"></span>098 · 044 · վերջին նամակը ${ago(W.hook_at)}`;
    const pend = W.pending || [];
    // SendPulse-ի բոտը կանգնած է (03.11-ին՝ վճարը ավարտվել էր 28.10-ին) → մենյուն չի պատասխանում, նամակները կուտակվում են
    const waNum = (p) => { p = String(p || ''); return p.length === 11 ? `0${p.slice(3, 5)} ${p.slice(5, 8)} ${p.slice(8)}` : p; };
    const botOff = W.bot && W.bot.active === false ? ((W.bot.off || []).map((b) => `${waNum(b.phone)}-ի բոտը կանգնած է՝ կապը կտրվել է։${b.unread ? ` ${fmt(b.unread)} նամակ անպատասխան է։` : ''}`).join(' ') || 'Բոտը կանգնած է։') : '';
    if (!W.hook_at && !pend.length) {
      mount({ title: 'WhatsApp', tab: 'sections', sub }, page(`${emptyState(I.chat, 'WhatsApp-ը միանում է',
        'Կերևա, երբ վարորդները գրեն 098 կամ 044 համարներին։')}${botOff ? sec('Ուշադրություն', `<div class="card nlist"><div class="nrow"><p>${esc(botOff)}</p></div></div>`) : ''}`));
      return;
    }
    // կարևորը՝ միայն երբ ինչ-որ բան կանգնած է
    const warn = botOff ? [botOff] : [];
    if (W.hook_at && !fresh) warn.push('2 օր նամակ չկա. ստուգում ենք։');
    if (W.drafting && (!W.runner_at || Date.now() - new Date(W.runner_at) > 15 * 60e3)) warn.push(`${fmt(W.drafting)} հարց սպասում է. HayWay-ի համակարգիչը անջատված է։`);
    const card = (r) => `<article class="prop" data-id="${r.id}">
        <div class="who"><span class="ico g">${I.chat}</span><b>${esc(r.name || 'Առանց անվան')}</b>${r.topic ? `<span>· ${esc(r.topic)}</span>` : ''}<span class="tm">${ago(r.at)}</span></div>
        <h3 dir="auto">${esc(r.question)}</h3>
        ${r.ask ? `<p class="why open">Հարց ձեզ՝ ${esc(r.ask)}</p>` : ''}
        ${r.answered ? '<span class="tag warn" style="align-self:flex-start">Հեռախոսից արդեն պատասխանել են</span>' : ''}
        <textarea class="in qtext" rows="7" dir="auto" data-txt placeholder="Գրեք պատասխանը">${esc(r.draft || '')}</textarea>
        <div class="btns"><button class="btn" data-no>Չուղարկել</button><button class="btn pri" data-yes>Ուղարկել</button></div>
        <p class="msgline"></p>
      </article>`;
    const sc = mount({ title: 'WhatsApp', tab: 'sections', sub }, page(`
      ${sec('', `<div class="card">
        <div class="hero"><span class="n" data-n="${W.people_7 || 0}">${fmt(W.people_7 || 0)}</span><span class="u">մարդու հետ խոսեցինք · 7 օր</span></div>
        ${barChart('wa7', W.days, 'people', fmt, 'մարդ')}
      </div>`)}
      ${sec('', `<div class="kpis">
        ${kpi('Գրանցվել են', fmt(W.registered_30), `${fmt(W.people_30)} գրողից · 30 օր`, '#/growth')}
        ${kpi('Այսօր գրեցին', fmt(W.people_today), 'մարդ')}
      </div>`)}
      ${warn.length ? sec('Ուշադրություն', `<div class="card nlist">${warn.map((w) => `<div class="nrow"><p>${esc(w)}</p></div>`).join('')}</div>`) : ''}
      ${pend.length ? sec(`Սպասում է ձեզ · ${pend.length}`, pend.map(card).join(''), { foot: 'Գնում է միայն «Ուղարկել»-ից հետո։' }) : ''}
      ${sec('', group([cell({ icon: I.star, color: W.auto ? 'g' : 's', t: 'Ինքնուրույն պատասխաններ', s: W.auto ? 'Վստահ պատասխանները գնում են առանց «Այո»-ի' : 'Հիմա ամեն պատասխան՝ ձեր «Այո»-ով',
        trail: `<button type="button" class="btn sm ${W.auto ? 'gray' : 'pri'}" data-auto="${W.auto ? 0 : 1}">${W.auto ? 'Անջատել' : 'Միացնել'}</button>` })]))}
    `));
    sc.querySelectorAll('.prop').forEach((art) => {
      const ta = art.querySelector('[data-txt]'), msg = art.querySelector('.msgline'), bs = art.querySelectorAll('button');
      const go = async (yes) => {
        if (yes && !ta.value.trim()) { msg.textContent = 'Գրեք պատասխանը'; ta.focus(); return; }
        bs.forEach((b) => { b.disabled = true; });
        const { data, error } = await sb.rpc('app_wa_decide', { p_id: +art.dataset.id, p_yes: yes, p_text: yes ? ta.value.trim() : null });
        if (error) { msg.textContent = 'Չստացվեց՝ ' + error.message; bs.forEach((b) => { b.disabled = false; }); return; }
        msg.textContent = !data ? '' : data.status === 'approved' ? 'Գնում է՝ մեկ րոպեի ընթացքում' : data.status === 'expired' ? '24 ժամն անցել է, պատասխանել չի կարելի' : 'Չի ուղարկվի';
        setTimeout(() => { invalidate(); render(); }, 1500);
      };
      art.querySelector('[data-yes]').onclick = () => go(true);
      art.querySelector('[data-no]').onclick = () => go(false);
    });
    const ab = sc.querySelector('[data-auto]');
    if (ab) ab.onclick = async () => {
      const on = ab.dataset.auto === '1';
      if (on && !confirm('Միացնե՞լ։ Վստահ պատասխանները կգնան առանց ձեր «Այո»-ի։')) return;
      ab.disabled = true;
      const { error } = await sb.rpc('app_wa_auto', { p_on: on });
      if (error) { alert('Չստացվեց՝ ' + error.message); ab.disabled = false; return; }
      invalidate(); render();
    };
  });

  // Ձայնով կարծիք ռիլի մասին՝ գրելու փոխարեն (Գարիկ 03.11. «գրելու տեղը պարզապես խոսքով ասվեր մեկնաբանությունը հոլովակի վերաբերյալ, ոչ գրավոր»).
  // սեղմել → խոսել → «Կանգնեցնել» → ձայնը պահվում է Storage «reels/voice»; տեքստը միայն գործարանի համար է (reels-run.ps1), տիրոջը ցույց չի տրվում
  const voiceBox = (id) => `<div class="vbox" id="${id}"><button type="button" class="btn gray full" data-rec>${I.mic} Ասել ձայնով</button>
      <div class="vdone" hidden><audio controls preload="metadata"></audio><button type="button" class="btn sm gray" data-vdel>Ջնջել</button></div></div>`;
  function bindVoice(id, msg) {
    const box = document.getElementById(id); if (!box) return { path: () => null, busy: () => false };
    const btn = box.querySelector('[data-rec]'), done = box.querySelector('.vdone'), au = done.querySelector('audio');
    const st = { rec: null, path: null, busy: false, t: 0, timer: 0 };
    const label = () => `${I.mic} Ասել ձայնով`;
    btn.onclick = async () => {
      if (st.busy) return;
      if (st.rec) { st.rec.stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { msg.textContent = 'Այս հեռախոսում ձայնագրելը չի աշխատում. գրեք տեքստով'; return; }
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { msg.textContent = 'Թույլ տվեք միկրոֆոնը և նորից սեղմեք'; return; }
      const chunks = [], rec = new MediaRecorder(stream);
      st.rec = rec; st.t = Date.now();
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        clearInterval(st.timer); stream.getTracks().forEach((t) => t.stop()); st.rec = null;
        btn.classList.add('gray'); btn.classList.remove('pri');
        const type = (rec.mimeType || 'audio/mp4').split(';')[0], blob = new Blob(chunks, { type });
        if (blob.size < 2000) { btn.innerHTML = label(); msg.textContent = 'Ձայնը շատ կարճ էր'; return; }
        st.busy = true; btn.disabled = true; btn.textContent = 'Պահվում է…';
        const path = `voice/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${/webm/.test(type) ? 'webm' : /ogg/.test(type) ? 'ogg' : 'm4a'}`;
        const up = await sb.storage.from('reels').upload(path, blob, { contentType: type, upsert: false });
        st.busy = false; btn.disabled = false; btn.innerHTML = label();
        if (up.error) { msg.textContent = 'Ձայնը չպահվեց, փորձեք նորից'; return; }
        st.path = path; au.src = URL.createObjectURL(blob); btn.hidden = true; done.hidden = false; msg.textContent = '';
      };
      rec.start();
      btn.classList.add('pri'); btn.classList.remove('gray');
      const tick = () => { const sec = Math.round((Date.now() - st.t) / 1000); btn.textContent = `■ Կանգնեցնել · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; if (sec >= 180 && st.rec) rec.stop(); };
      tick(); st.timer = setInterval(tick, 500);
    };
    done.querySelector('[data-vdel]').onclick = () => { st.path = null; au.removeAttribute('src'); done.hidden = true; btn.hidden = false; };
    return { path: () => st.path, busy: () => st.busy || !!st.rec };
  }
  // արդեն ասված ձայնային կարծիքները՝ լսելու համար
  const voiceList = (items, urls) => (items || []).filter((v) => v.path && urls[v.path]).map((v) => `<div class="vnote"><audio controls preload="none" src="${esc(urls[v.path])}"></audio>
      <p class="meta">Ձեր ձայնային կարծիքը · ${dmy(v.at)}</p></div>`).join('');

  // «Օրինակներ» (Գարիկ 03.11). տերը դնում է դուր եկած ռիլ՝ վիդեո հեռախոսից կամ հղում, և գրում՝ ինչ վերցնել; հաջորդ ռիլերը կարդում են դրանք
  const reelRefsSec = (refs, urls) => sec('Օրինակներ', `<div class="card">
      <p class="meta">Դրեք ռիլ, որ դուր է գալիս։</p>
      <input class="in" id="rf-url" type="url" inputmode="url" autocomplete="off" placeholder="TikTok կամ Instagram հղում">
      <label class="btn gray full" for="rf-file" id="rf-pick">${I.film} Ընտրել վիդեո</label><input id="rf-file" type="file" accept="video/*,image/*" hidden>
      <textarea class="in qtext" id="rf-note" rows="2" placeholder="Ինչն է դուր գալիս"></textarea>
      <button type="button" class="btn pri full" id="rf-send">Ավելացնել</button>
      <p class="msgline" id="rf-msg"></p>
    </div>${refs.length ? `<div style="margin-top:8px">${group(refs.map((f) => cell({ icon: f.kind === 'video' ? I.film : I.link, color: 'p',
      t: f.note ? esc(f.note) : 'Առանց նշման', s: `${dmy(f.created_at)} · ${f.used_in ? 'օգտագործված ռիլ #' + f.used_in : 'դեռ չի օգտագործվել'}${f.learned ? ' · ' + esc(f.learned) : ''}`,
      extra: `<span class="act-b" style="margin-top:8px">${(f.kind === 'video' ? urls[f.path] : f.url) ? `<a class="btn sm gray" href="${esc(f.kind === 'video' ? urls[f.path] : f.url)}" target="_blank" rel="noopener">Բացել</a>` : ''}<button type="button" class="btn sm gray" data-rfhide="${f.id}">Հանել</button></span>` })))}</div>` : ''}`);
  function bindReelRefs() {
    const file = document.getElementById('rf-file'), pick = document.getElementById('rf-pick'), msg = document.getElementById('rf-msg'), send = document.getElementById('rf-send');
    if (!send) return;
    file.onchange = () => { const f = file.files[0]; if (f) pick.textContent = `${f.name} · ${fmt(f.size / 1048576, 1)} ՄԲ`; };
    send.onclick = async () => {
      const f = file.files[0], url = document.getElementById('rf-url').value.trim(), note = document.getElementById('rf-note').value.trim();
      if (!f && !url) { msg.textContent = 'Ընտրեք վիդեո կամ դրեք հղում'; return; }
      if (url && !/^https?:\/\//i.test(url)) { msg.textContent = 'Հղումը պետք է սկսվի https://-ով'; return; }
      if (f && f.size > 50 * 1048576) { msg.textContent = 'Վիդեոն 50 ՄԲ-ից մեծ է. դրեք հղումը'; return; }
      send.disabled = true; msg.textContent = f ? 'Բեռնվում է…' : '';
      let path = null;
      if (f) {
        const ext = ((f.name.match(/\.([a-z0-9]{2,5})$/i) || [])[1] || 'mp4').toLowerCase();
        path = `refs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const up = await sb.storage.from('reels').upload(path, f, { contentType: f.type || 'video/mp4', upsert: false });
        if (up.error) { msg.textContent = 'Վիդեոն չբեռնվեց, փորձեք նորից'; send.disabled = false; return; }
      }
      const { error } = await sb.rpc('app_reel_ref_add', { p_kind: f ? 'video' : 'link', p_path: path, p_url: url || null, p_note: note || null });
      if (error) { msg.textContent = 'Չստացվեց, փորձեք նորից'; send.disabled = false; return; }
      invalidate(); render();
    };
    app.querySelectorAll('[data-rfhide]').forEach((b) => b.onclick = async () => { b.disabled = true; await sb.rpc('app_reel_ref_hide', { p_id: +b.dataset.rfhide }); invalidate(); render(); });
  }
  const signedUrls = {};
  route('/reels', async (n) => {
    lastTab = 'sections';
    const [h, R, refs0] = await Promise.all([rpc('app_home'), rpc('app_reels'), rpc('app_reel_refs').catch(() => [])]);
    pendingCount = h.tasks_pending || 0;
    const list = R.reels || [], run = R.runner, refs = refs0 || [];
    const sub = !run ? '<span class="dot wait"></span>Միանում է'
      : Date.now() - new Date(run.at) < 2 * 864e5 ? `<span class="dot ok"></span>Ամեն օր մեկ ռիլ`
      : `<span class="dot bad"></span>Գործարանը կանգնած է ${ago(run.at)}`;
    const back = n ? ['#/reels', 'Ռիլեր'] : ['#/sections', 'Բաժիններ'];
    const urls = {};
    // ստորագրված հղումները գործում են 3 ժամ → 2 ժամ վերցնում ենք պահածից, որ ամեն բացելիս Storage-ին չսպասենք (03.11)
    const signAll = async (paths) => {
      paths = paths.filter(Boolean);
      const now = Date.now(), need = paths.filter((p) => !(signedUrls[p] && now - signedUrls[p].t < 2 * 3600e3));
      try { const { data } = need.length ? await sb.storage.from('reels').createSignedUrls(need, 3 * 3600) : { data: [] }; (data || []).forEach((x) => { if (x.signedUrl) signedUrls[x.path] = { u: x.signedUrl, t: now }; }); } catch (e) {}
      paths.forEach((p) => { if (signedUrls[p]) urls[p] = signedUrls[p].u; });
    };
    const refPaths = refs.filter((f) => f.kind === 'video').map((f) => f.path);
    if (!list.length) {
      await signAll(refPaths);
      mount({ title: 'Ռիլեր', tab: 'sections', back, sub }, page(emptyState(I.film, 'Առաջին ռիլը պատրաստվում է',
        'Կերևա այստեղ, դուք կհաստատեք։')
        + reelRefsSec(refs, urls)));
      bindReelRefs();
      return;
    }
    // գլխավորը՝ ձեզ սպասողներից ամենահինը (հրապարակման հերթով), հետո վերջին հրապարակվածը; #/reels/<n>՝ կոնկրետ ռիլը
    const r = n ? list.find((x) => String(x.n) === String(n)) : (list.slice().reverse().find((x) => ['ready', 'changes', 'approved', 'failed'].includes(x.status)) || list[0]);
    if (!r) { location.hash = '#/reels'; return; }
    await signAll([r.video, r.poster, ...refPaths, ...(r.voice || []).map((v) => v.path)]);
    const open = ['ready', 'changes', 'approved', 'failed'].includes(r.status);
    const pub = r.status === 'published';
    const views = reelSum(r, 'views');
    const links = [r.tiktok && `<a class="btn sm gray" href="${esc(r.tiktok)}" target="_blank" rel="noopener">TikTok</a>`, r.instagram && `<a class="btn sm gray" href="${esc(r.instagram)}" target="_blank" rel="noopener">Instagram</a>`].filter(Boolean);
    const plat = (p, nm) => { const s = r.last && r.last[p]; return s ? cell({ t: nm, s: `${fmt(s.likes)} հավանում · ${fmt(s.comments)} մեկնաբանություն · ${fmt(s.shares)} կիսվել${s.saves != null ? ' · ' + fmt(s.saves) + ' պահել' : ''}`, v: fmt(s.views), strong: true }) : ''; };
    const others = list.filter((x) => x.id !== r.id);
    const sc = mount({ title: n ? `Ռիլ #${r.n}` : 'Ռիլեր', tab: 'sections', back, sub }, page(`
      ${sec('', `<div class="card">
        ${r.video && urls[r.video] ? `<video class="reel-v" src="${esc(urls[r.video])}" ${r.poster && urls[r.poster] ? `poster="${esc(urls[r.poster])}"` : ''} controls playsinline preload="metadata"></video>` : '<p class="none">Վիդեոն դեռ բեռնվում է</p>'}
        <div>${reelTag(r)}${r.ad ? '' : ' <span class="tag n">առանց գովազդի</span>'}</div>
        <h3>#${r.n} · ${esc(r.title)}</h3>
        ${r.learned ? `<p class="meta">Ձեր կարծիքից՝ ${esc(r.learned)}</p>` : ''}
        ${r.script ? `<div class="ans clip" dir="auto">${esc(r.script)}</div><button class="btn full ans-more" type="button">Կարդալ տեքստը</button>` : ''}
        ${links.length ? `<div class="act-b">${links.join('')}</div>` : ''}
      </div>`, { foot: r.status === 'approved' ? 'Կհրապարակվի մոտակա ժամերին։' : r.status === 'changes' ? 'Նոր տարբերակ է պատրաստվում։'
        : r.status === 'failed' ? esc(r.note || 'Հրապարակումը չստացվեց, նորից կփորձենք։') : '' })}
      ${sec(open ? 'Ձեր կարծիքը' : 'Կարծիք հաջորդ ռիլի համար', `<div class="card">
        ${voiceList(r.voice, urls)}
        ${voiceBox('rc-voice')}
        <textarea class="in qtext" id="rc" rows="2" placeholder="կամ գրեք">${esc(r.comment || '')}</textarea>
        <div class="act-b">${open ? `<button type="button" class="btn pri" data-v="publish" ${r.status === 'approved' ? 'disabled' : ''}>Հրապարակել</button><button type="button" class="btn gray" data-v="change">Փոխել</button>`
          : '<button type="button" class="btn pri" data-v="">Պահել</button>'}</div>
        <p class="msgline" id="rmsg">${r.owner_at ? `Վերջին կարծիքը՝ ${ago(r.owner_at)}` : ''}</p>
      </div>`)}
      ${pub ? sec('Թվեր', `<div class="kpis">
          ${kpi('Դիտում', fmt(views), '')}${kpi('Հավանում', fmt(reelSum(r, 'likes')), '')}
          ${kpi('Մեկնաբանություն', fmt(reelSum(r, 'comments')), '')}${kpi('Կիսվել', fmt(reelSum(r, 'shares')), '')}
        </div>${r.days && r.days.length ? `<div class="card" style="margin-top:8px">${barChart('rv' + r.id, reelDays(r), 'views', fmt, 'դիտում')}</div>` : ''}
        ${r.last ? `<div style="margin-top:8px">${group([plat('tiktok', 'TikTok'), plat('instagram', 'Instagram')].filter(Boolean))}</div>` : ''}`,
        { foot: r.last ? '' : 'Թվերը՝ վաղը։' }) : ''}
      ${reelRefsSec(refs, urls)}
      ${others.length ? sec('Բոլոր ռիլերը', group(others.map((x) => cell({ href: '#/reels/' + x.n, icon: I.film, color: 'p', t: `#${x.n} · ${esc(x.title)}`,
        s: x.status === 'published' ? `${fmt(reelSum(x, 'likes'))} հավանում · ${fmt(reelSum(x, 'comments'))} մեկնաբանություն` : (REEL_ST[x.status] || [, x.status])[1],
        v: x.status === 'published' ? `${fmt(reelSum(x, 'views'))}` : '', strong: true }))), { foot: x0foot(R) }) : ''}
    `));
    sc.querySelectorAll('.ans-more').forEach((b) => b.onclick = () => { b.previousElementSibling.classList.remove('clip'); b.remove(); });
    bindReelRefs();
    const ta = document.getElementById('rc'), msg = document.getElementById('rmsg');
    const rv = bindVoice('rc-voice', msg);
    sc.querySelectorAll('[data-v]').forEach((b) => b.onclick = async () => {
      if (rv.busy()) { msg.textContent = 'Նախ կանգնեցրեք ձայնագրությունը'; return; }
      const v = b.dataset.v || null, txt = ta.value.trim(), voice = rv.path();
      if (v === 'change' && !txt && !voice) { msg.textContent = 'Ասեք ձայնով՝ ինչ փոխել'; return; }
      if (!v && !txt && !voice) { msg.textContent = 'Ասեք ձայնով կամ գրեք կարծիքը'; return; }
      sc.querySelectorAll('[data-v]').forEach((x) => { x.disabled = true; });
      const { error } = await sb.rpc('app_reel_feedback', { p_id: r.id, p_verdict: v, p_comment: txt, p_voice: voice });
      if (error) { msg.textContent = 'Չստացվեց, փորձեք նորից'; sc.querySelectorAll('[data-v]').forEach((x) => { x.disabled = false; }); return; }
      invalidate(); render();
    });
  });
  const x0foot = (R) => R.no_ads_left ? '' : 'Թիվը՝ դիտումներ։';

  // ───────── Վարորդներ ─────────
  const SEGS =[['active', 'Ակտիվ'], ['top', 'Լավագույն 30'], ['risk', 'Կանգնածներ'], ['new', 'Նորեկներ'], ['churned', 'Հեռացած'], ['debt', 'Պարտքով'], ['cancellers', 'Չեղարկողներ']];
  const SEG_DESC = {
    active: '30 օրում գոնե 1 պատվեր։',
    top: '30 օրում ամենաշատ պատվերով. «պարկին»՝ քանի % է վերցրել պարկը։',
    risk: '5+ օր պատվեր չկա. զանգեք։',
    new: 'Գրանցվել են 30 օրում։',
    churned: 'Վերջին պատվերը՝ 10–90 օր առաջ։',
    debt: 'Բացասական հաշվեկշիռ։',
    cancellers: 'Չեղարկում են 25%-ից շատ։',
  };
  // Պարկի իրական մասը 30 օրում (db\0028, Fleet-ի գործարքներից), ոչ թե պայմանի անվան թիվը
  const parkTxt = (d) => { const p = d.park_pct ?? d.rule_pct; return p == null ? '' : ` · պարկին ${p}%`; };
  const callBtn = (d) => { const tel = phone(d); return tel ? `<a class="callb" href="tel:${esc(tel)}" aria-label="Զանգել ${esc(name(d))}">${I.call}</a>` : ''; };
  route('/drivers', async (seg) => {
    lastTab = 'sections';
    seg = SEGS.some((s) => s[0] === seg) ? seg : 'active';
    const [h, rows] = await Promise.all([rpc('app_home'), rpc('app_drivers', { segment: seg })]);
    pendingCount = h.tasks_pending || 0;
    const w = h.week;
    const line = (d) => {
      let tag = '', meta = '';
      if (seg === 'active') { tag = d.current_status === 'offline' ? '<span class="tag n">անջատ</span>' : '<span class="tag pos">գծում</span>'; meta = `${d.orders_7d} պատվեր այս շաբաթ${parkTxt(d)}`; }
      if (seg === 'top') { tag = `<span class="tag pos">${fmt(d.orders_30d)} պատվեր</span>`; meta = `${short(d.gmv_30d)}${parkTxt(d)} · չեղարկում ${pct(d.cancels_30d, d.offers_30d)}%`; }
      if (seg === 'risk') { tag = `<span class="tag neg">${Math.floor(d.idle_days)} օր կանգնած</span>`; meta = `${d.orders_30d} պատվեր 30 օրում · վերջինը ${dmy(d.last_order_at)}`; }
      if (seg === 'new') { tag = `<span class="tag ${d.orders_30d ? 'pos' : 'warn'}">${d.orders_30d ? d.orders_30d + ' պատվեր' : 'դեռ 0 պատվեր'}</span>`; meta = `Գրանցվել է ${dmy(d.hire_date)} · ${d.days_since_hire} օր առաջ`; }
      if (seg === 'churned') { tag = `<span class="tag n">${Math.floor(d.idle_days)} օր</span>`; meta = `Վերջին պատվերը՝ ${dmy(d.last_order_at)} · ընդամենը ${fmt(d.orders_total)}`; }
      if (seg === 'debt') { tag = `<span class="tag neg">${amd(d.balance)}</span>`; meta = `${d.current_status === 'offline' ? 'Անջատ է' : 'Գծում է'} · վերջին պատվերը ${dmy(d.last_order_at)}`; }
      if (seg === 'cancellers') { tag = `<span class="tag neg">${pct(d.cancels_30d, d.offers_30d)}%</span>`; meta = `${d.cancels_30d} չեղարկում ${d.offers_30d} առաջարկից`; }
      return cell({ lead: `<span class="av">${esc(initials(d.first_name, d.last_name))}</span>`, t: `<span class="nm"><span class="t b">${esc(name(d))}</span>${tag}</span>`, s: esc(meta), trail: callBtn(d) });
    };
    const sc = mount({ title: 'Վարորդներ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '<span class="dot ok"></span>Պահպանող' }, page(`
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
    mount({ title: 'Որակ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '<span class="dot ok"></span>Որակի վերահսկիչ' }, page(`
      ${sec('Ավարտված պատվերներ', `<div class="card">
        <div class="hero"><span class="n">${comp30}%</span><span class="u">${fmt(d30.completed)} / ${fmt(d30.total)} առաջարկ · 30 օր</span></div>
        <div class="prog"><span style="width:${comp30}%"></span></div>
        <div class="row wrap"><span class="tag neg">վարորդը չեղարկեց՝ ${pct(d30.by_driver, d30.total)}%</span><span class="tag warn">ուղևորը՝ ${pct(d30.by_passenger, d30.total)}%</span></div>
        <p class="meta">Այս շաբաթ՝ ${comp7}% ավարտված։</p>
      </div>`)}
      ${sec('Ով է չեղարկում', group(canc.length ? canc : ['<p class="none">Տվյալ չկա</p>'], 'avs') + group([cell({ href: '#/drivers/cancellers', t: 'Բոլոր չեղարկողները', v: '' })]), { foot: `${q.half_cancellers} վարորդ = չեղարկումների կեսը։` })}
      ${sec('Yandex-ի մակարդակ', `<div class="card">
        <div class="between"><h3>Ոսկու համար</h3><span class="tag pos">Արծաթ ✓</span></div>
        <div class="hero"><span class="n" style="font-size:34px">${g.new_50}</span><span class="u">/ 80 նորեկ 50 պատվերով</span></div>
        <div class="prog"><span style="width:${Math.min(100, g.new_50 / 80 * 100)}%"></span></div>
        <p class="meta">Այս ամիս՝ ${g.new_month} նորեկ։</p>
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
    const [h, f, notes, fe, nis] = await Promise.all([rpc('app_home'), rpc('app_finance'), rpc('app_notes'), rpc('app_fees', { p_days: 30 }).catch(() => null), rpc('app_net_income', { p_days: 30 }).catch(() => null)]);
    const ni = nis;
    pendingCount = h.tasks_pending || 0;
    const m = f.month, b = f.balances;
    // Միջնորդավճարներ և մաքուր եկամուտ 30 օրում (db\0018, app_fees). չհաստատված տոկոսը՝ «մոտավոր»
    const kv = (t, v, s) => cell({ t, s, v, strong: true });
    const rateS = (r) => r ? `${String(r.pct).replace('.', ',')}% ${r.verified ? '' : '<span class="tag warn">մոտավոր</span>'}` : '';
    const pc = fe && fe.park_payment_costs;
    // 03.11, Գարիկ. «ամենամաքուր շահույթ». բոլոր ծախսերը՝ վճարային, հարկ, ամսականներ (վարձ, աշխատավարձ…), list.am գովազդ (db\0024, app_net_income)
    const np = ni && ni.period, ex = ni && ni.expenses;
    const allCost = np ? +np.payment_costs + +np.other_costs : 0;
    const feeSec = fe ? (np ? sec('Մաքուր շահույթ · 30 օր', `<div class="kpis">
        ${kpi('Պարկի եկամուտ', short(np.commission), `${String(fe.park_commission_pct).replace('.', ',')}% պատվերներից`)}
        ${kpi('Բոլոր ծախսերը', short(allCost), np.commission ? `${Math.round(allCost / np.commission * 100)}% եկամտից` : '')}
        ${kpi('Մաքուր շահույթ', `<span class="${+np.net < 0 ? 'neg' : ''}">${short(np.net)}</span>`, 'եկամուտ − բոլոր ծախսերը')}
      </div>`) + sec('Ծախսեր · 30 օր', group([
        kv('Վճարային', `<span class="neg">${short(np.payment_costs)}</span>`, 'Idram, Telcell, EasyPay, PrimeBridge'),
        kv('Հարկ', `<span class="neg">${short(np.tax)}</span>`, `${String(ex.tax_pct).replace('.', ',')}% եկամտից`),
        ...(ex.items || []).map((it) => kv(esc(it.name), `<span class="neg">${short(it.amd_period)}</span>`, `ամսական ${short(it.amd_month)}`)),
        kv('Գովազդ · list.am', `<span class="neg">${short(np.ads)}</span>`, 'list.am'),
      ]))
      : sec('Մաքուր եկամուտ · 30 օր', `<div class="kpis">
        ${kpi('Պարկի եկամուտ', short(fe.park_commission_amd), `${String(fe.park_commission_pct).replace('.', ',')}% պատվերներից`)}
        ${kpi('Վճարային ծախսեր', short(pc.total_amd), `${String(fe.costs_pct_of_park_commission).replace('.', ',')}% եկամտից`)}
        ${kpi('Մաքուր', short(fe.park_net_after_costs_amd), 'եկամուտ − ծախսեր')}
      </div>`))
      + sec('Ով ինչքան է վերցնում · 30 օր', group([
        kv('Idram · լիցքավորում', `<span class="neg">${short(pc.idram_topups.cost_amd)}</span>`, `${rateS(pc.idram_topups.rate)} · ${short(pc.idram_topups.volume_amd)}-ից`),
        kv('Telcell · լիցքավորում', `<span class="neg">${short(pc.telcell_topups.cost_amd)}</span>`, `${rateS(pc.telcell_topups.rate)} · ${short(pc.telcell_topups.volume_amd)}-ից`),
        kv('EasyPay · լիցքավորում', `<span class="neg">${short(pc.easypay_topups.cost_amd)}</span>`, `${rateS(pc.easypay_topups.rate)} · ${short(pc.easypay_topups.volume_amd)}-ից`),
        kv('PrimeBridge · փոխանցում', `<span class="neg">${short(pc.primebridge_payouts.cost_amd)}</span>`, `${rateS(pc.primebridge_payouts.rate)} · ${short(pc.primebridge_payouts.volume_amd)}-ից`),
        kv('Yandex · վարորդից', short(+fe.yandex.fee_amd + +fe.yandex.vat_amd + +fe.yandex.other_amd), `≈${String(fe.yandex.pct_of_gross).replace('.', ',')}% պատվերներից, ԱԱՀ-ով`),
        kv('Պատենտի տուրք · վարորդից', short(fe.state_duty_amd), 'պետությանը'),
      ])) : '';
    const fd = (f.days || []).filter((d) => d.day < today());
    const sm = (a, k) => a.reduce((s, d) => s + (+d[k] || 0), 0);
    const w = { gmv: sm(fd.slice(-7), 'gmv'), commission: sm(fd.slice(-7), 'commission') }, p = { gmv: sm(fd.slice(-14, -7), 'gmv'), commission: sm(fd.slice(-14, -7), 'commission') };
    const tops = (f.topups_by_provider || []);
    mount({ title: 'Ֆինանսներ', tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '<span class="dot ok"></span>Ֆինանսիստ' }, page(`
      ${sec('Վերջին 7 օր', `<div class="kpis">
        ${kpi('Շրջանառություն', short(w.gmv), delta(w.gmv, p.gmv))}
        ${kpi('Պարկի եկամուտ', short(w.commission), delta(w.commission, p.commission))}
      </div>`, { foot: estNote(notes, 15) })}
      ${feeSec}
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
      ${sec(`Կոմիսիայի խմբեր`, group(rows.length ? rows : ['<p class="none">Տվյալ չկա</p>']))}
      ${sec('Ինչ կլինի, եթե…', `<div class="card">
        <p class="meta">Կոմիսիան բոլոր վարորդների համար</p>
        <div class="stepper"><button id="dec" aria-label="Պակասեցնել">−</button><span class="n" id="pv">2,50%</span><button id="inc" aria-label="Ավելացնել">+</button></div>
        <div class="kv"><span>Ամսական կոմիսիա</span><b id="mv"></b></div>
        <p class="delta" id="dv" style="font-size:15px"></p>
        <p class="meta">Հիմա՝ ${short(cur)} ամսական։</p>
      </div>`)}
    `));
    let pv = 2.5;
    const upd = () => { const mv = gmv * pv / 100, d = mv - cur; document.getElementById('pv').textContent = pv.toFixed(2).replace('.', ',') + '%'; document.getElementById('mv').textContent = short(mv); const dv = document.getElementById('dv'); dv.textContent = (d >= 0 ? '+' : '−') + short(Math.abs(d)) + ' իրականի համեմատ'; dv.className = 'delta ' + (d >= 0 ? 'pos' : 'neg'); };
    document.getElementById('dec').onclick = () => { pv = Math.max(0, +(pv - 0.25).toFixed(2)); upd(); };
    document.getElementById('inc').onclick = () => { pv = Math.min(5, +(pv + 0.25).toFixed(2)); upd(); };
    upd();
  });

  // ───────── Գործեր ─────────
  const AGENT = { 'Պահպանող': [I.users, 'g'], 'Որակի վերահսկիչ': [I.quality, 'p'], 'Ֆինանսիստ': [I.money, 'o'], 'Գարիկ': [I.star, 'k'], 'GTH': [I.star, 'k'] };
  // 04.11 (Գարիկ. «Գարիկով էլ բան չերևա»). բազայում գործակալի անունը մնում է «Գարիկ», տիրոջը՝ GTH
  const agentName = (a) => (a === 'Գարիկ' ? 'GTH' : a);
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
        <div class="who"><span class="ico ${col}">${ic}</span><b>${esc(agentName(t.agent))}</b><span>· ${esc(t.cost || '')}</span><span class="tm">${dmy(t.created_at)}</span></div>
        <h3>${esc(t.title)}</h3>
        ${t.why ? `<p class="why">${esc(t.why)}</p><button class="more" data-more>Ավելին</button>` : ''}
        ${p.segment ? `<button class="btn sm" data-list style="align-self:flex-start">${I.users} Ցուցակը${p.n ? (p.n > 25 ? ' · առաջին 25-ը' : ` · ${p.n}`) : ''}</button><div class="list" data-drivers style="display:none"></div>` : ''}
        ${decided
          ? `<div class="between"><span class="tag ${t.status === 'approved' ? 'pos' : 'n'}">${t.status === 'approved' ? (t.kind === 'call' ? 'Կզանգենք' : 'Հաստատված') : (t.kind === 'call' ? 'Պետք չէ' : 'Մերժված')} · ${dmy(t.decided_at)}</span><button class="btn plain" data-act="undo">Չեղարկել</button></div>`
          : `<div class="btns"><button class="btn" data-act="reject">${t.kind === 'call' ? 'Պետք չէ' : 'Մերժել'}</button><button class="btn pri" data-act="approve">${t.kind === 'call' ? 'Կզանգենք' : 'Հաստատել'}</button></div>`}
      </article>`;
    };
    const list = view === 'done' ? done : pending;
    mount({ title: 'Գործեր', tab: 'tasks', sub: '' }, page(`
      <div class="seg"><button data-view="pending" class="${view === 'pending' ? 'on' : ''}">Սպասում են · ${pending.length}</button><button data-view="done" class="${view === 'done' ? 'on' : ''}">Որոշված · ${done.length}</button></div>
      ${list.length ? list.map(card).join('') : (view === 'pending'
        ? emptyState(I.tasks, 'Ամեն ինչ որոշված է', 'Նորերը՝ առավոտյան 08:30-ին։', '<a class="btn dark" href="#/drivers/risk">Ում զանգել այսօր</a>')
        : emptyState(I.clock, 'Դեռ ոչինչ', 'Որոշածները կերևան այստեղ։'))}
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
  // 2026-11-04. Ձայնային մուտք՝ ինչպես ChatGPT / Wispr Flow թելադրությունը. 🎙 → ալիք + ժամ + ✕/✓ → ձայնը garik-voice ֆունկցիային
  // (Gemini-ն գրում ու մաքրում է՝ կետադրություն, «էէ», կրկնություններ) → տեքստը դաշտում։ Ինքը չի ուղարկում. տերը կարդում, ուղղում, ուղարկում է։
  // Enter/✓՝ պատրաստ, Esc/✕՝ չեղարկել, Ctrl+M՝ սկսել։ Միկրոֆոնը փակվում է անմիջապես (iPhone-ի նարնջագույն կետը չի մնում)։
  const VOICE_MAX = 300;   // վրկ
  function dictation(q, grow) {
    const mic = document.getElementById('mic'), bar = document.getElementById('rec'), cv = document.getElementById('rec-w'), tEl = document.getElementById('rec-t');
    const box = mic.closest('.composer'), ph = q.placeholder;
    let rec = null, stream = null, actx = null, raf = 0, t0 = 0, levels = [], chunks = [], keep = false, hintT = 0;
    const hint = (text) => { clearTimeout(hintT); q.placeholder = text; if (text !== ph) hintT = setTimeout(() => { q.placeholder = ph; }, 3500); };
    const release = () => {
      cancelAnimationFrame(raf); raf = 0;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (actx) actx.close().catch(() => {});
      stream = actx = null;
      bar.hidden = true; box.classList.remove('recording');
      document.removeEventListener('keydown', onKey, true);
    };
    const draw = () => {
      if (!document.body.contains(mic)) { keep = false; if (rec && rec.state !== 'inactive') rec.stop(); return release(); }   // էկրանը փոխվեց
      const s = (performance.now() - t0) / 1000;
      tEl.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      tEl.classList.toggle('warn', s > VOICE_MAX - 15);
      if (s >= VOICE_MAX) return finish(true);
      const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      const g = cv.getContext('2d'), n = Math.floor(w / 4), col = getComputedStyle(box).getPropertyValue('--acc').trim() || '#6EA8FE';
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); g.fillStyle = col;
      const lv = levels.slice(-n);
      lv.forEach((v, i) => { const bh = Math.max(3, Math.min(h, v * h * 3.2)); g.globalAlpha = .45 + .55 * (i / n); g.fillRect(w - (lv.length - i) * 4, (h - bh) / 2, 2.5, bh); });
      raf = requestAnimationFrame(draw);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      else if (e.key === 'Enter') { e.preventDefault(); finish(); }
    };
    async function start() {
      if (rec) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return hint('Այս բրաուզերը ձայն չի ձայնագրում');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        stream = null;
        return hint(e.name === 'NotAllowedError' ? 'Միկրոֆոնը փակ է. թույլ տուր կարգավորումներում' : 'Միկրոֆոն չգտնվեց');
      }
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
      rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
      chunks = []; levels = []; keep = false;
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => { const r = rec; rec = null; release(); if (keep) upload(new Blob(chunks, { type: (r.mimeType || type || 'audio/webm').split(';')[0] })); };
      rec.start(250);
      try {   // ալիքը՝ ձայնի ուժգնությունից
        actx = new (window.AudioContext || window.webkitAudioContext)();
        const an = actx.createAnalyser(); an.fftSize = 512;
        actx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.fftSize);
        const tick = () => { if (!actx) return; an.getByteTimeDomainData(buf); let sum = 0; for (const b of buf) sum += ((b - 128) / 128) ** 2; levels.push(Math.sqrt(sum / buf.length)); if (levels.length > 400) levels.shift(); setTimeout(tick, 60); };
        tick();
      } catch (e) {}
      t0 = performance.now(); bar.hidden = false; box.classList.add('recording');
      document.addEventListener('keydown', onKey, true);
      navigator.vibrate?.(12);
      draw();
    }
    function finish(atLimit) { if (!rec || rec.state === 'inactive') return; keep = true; if (atLimit) hint('5 րոպեն լրացավ, գրում եմ…'); rec.stop(); navigator.vibrate?.(8); }
    function cancel() { if (!rec || rec.state === 'inactive') return release(); keep = false; rec.stop(); }
    async function upload(blob) {
      if (blob.size < 1200) return hint('Խոսք չլսվեց');
      mic.disabled = true; mic.classList.add('busy'); q.disabled = true; q.placeholder = 'Գրում եմ…';
      let text = '', err = '';
      const ac = new AbortController(), stop = setTimeout(() => ac.abort(), 60000);   // «Գրում եմ…»-ը երբեք չի կախվում
      try {
        const session = await Promise.race([sb.auth.getSession().then((x) => x.data.session), new Promise((_, no) => ac.signal.addEventListener('abort', () => no(new Error('timeout'))))]);
        const r = await fetch(`${CFG.url}/functions/v1/garik-voice`, { method: 'POST', signal: ac.signal, headers: { Authorization: 'Bearer ' + session.access_token, apikey: CFG.anonKey, 'Content-Type': blob.type }, body: blob });
        let j = {}; try { j = await r.json(); } catch (e) {}
        if (!r.ok) err = j.message || 'Ձայնը չհաջողվեց կարդալ';
        text = String(j.text || '').trim();
      } catch (e) { err = 'Կապ չկա. փորձիր նորից'; }
      clearTimeout(stop);
      mic.disabled = false; mic.classList.remove('busy'); q.disabled = false; q.placeholder = ph;
      if (err) return hint(err);
      if (!text) return hint('Խոսք չլսվեց');
      q.value = q.value.trim() ? q.value.replace(/\s*$/, ' ') + text : text;
      grow();
      if (!matchMedia('(pointer: coarse)').matches) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
    mic.onclick = start;
    document.getElementById('rec-x').onclick = cancel;
    document.getElementById('rec-ok').onclick = () => finish();
    q.addEventListener('keydown', (e) => { if (e.ctrlKey && (e.key === 'm' || e.key === 'M' || e.code === 'KeyM')) { e.preventDefault(); start(); } });
    document.addEventListener('visibilitychange', function vis() {
      if (!document.body.contains(mic)) return document.removeEventListener('visibilitychange', vis);
      if (document.hidden && rec) finish();   // iPhone-ում հավելվածից դուրս գալիս ձայնը չի կորչում
    });
  }
  // 03.11. GET-ը «սառը» ֆունկցիա է (առաջին կանչը՝ մինչև 3 վրկ) → վերջին հայտնի վիճակը՝ անմիջապես, թարմը՝ ետևում
  async function garikState() {
    if (garikStatus) return garikStatus;
    let old = null;
    try { old = JSON.parse(localStorage.getItem('hw_garik_st')); } catch (e) {}
    const p = garikCall('GET').then((s) => { try { localStorage.setItem('hw_garik_st', JSON.stringify(s)); } catch (e) {} return s; })
      .catch(() => ({ ok: false, key: false })).then((s) => (garikStatus = s));
    return old || p;
  }
  async function assistantNow() { const { data, error } = await sb.rpc('app_assistant'); if (error) throw new Error(error.message); return data || { msgs: [] }; }
  // ───────── ԿԱ 5 «GTH Օգնական»՝ Դավիթի АРОМАТИКА-ի պես (04.11, Գարիկ. «Այո, սկսի» — «սաղ Դավիթինի պես է սարքվելու») ─────────
  // Ստանդարտը՝ Հայաստան/_brain/templates/ka5-standard.md։ Այստեղ՝ կարճ պատասխան + «Ավելին» (Դավիթի short.js), «Լսել» + արագություն (speak.js,
  // ձայնը՝ gth-tts ֆունկցիա), ֆայլեր տիրոջից («+» → «Նկար կամ ֆայլ») և նրան (Excel քարտ՝ «Ներբեռնել» / «Telegram-ով»), «Ինչ արեց օգնականը»,
  // «Հարցումներ թիմին», հին զրույցը բացել ու շարունակել, 30 րոպե լռությունից հետո՝ թարմ զրույց, ↓ «վերջինին», ընտրության քարտ (ask_choice)։
  // Բազան՝ db\0032_ka5_like_davit.sql, մոզգը՝ scripts\assistant-run.ps1 (Claude Code սեանս) + supabase\functions\gth-tools։
  // «Գարիկ» բառը տիրոջ էկրանին չի երևում (Գարիկ 04.11. «Գարիկով էլ բան չերևա»)՝ նույնիսկ հին պատասխաններում ու կառուցողի տողերում
  const noG = (s) => String(s ?? '').replace(/Գարիկ(ը|ին|ի|ից|ով|ն)?/g, (m, sfx) => 'GTH' + (sfx ? '-' + sfx : ''));
  const IC = {
    speaker: sv(16, '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    img: sv(16, '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>'),
    doc: sv(16, '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5M9 13h6M9 16.5h4"/>'),
    clip: sv(20, '<path d="m20 11.5-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6"/>'),
    down: sv(20, '<path d="M12 5v14M5 12l7 7 7-7"/>', ' style="stroke-width:2.4"'),
    x: sv(16, '<path d="M6 6l12 12M18 6 6 18"/>', ' style="stroke-width:2.4"'),
    acts: sv(20, '<path d="M4 12h3l3-7 4 14 3-7h3"/>'),
    team: sv(20, '<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M2.5 19c.6-3 2.9-4.5 5.5-4.5s4.9 1.5 5.5 4.5M14 14.6c2.6-.4 5 .9 5.6 4"/>'),
  };
  // Supabase ֆունկցիաներ տիրոջ մուտքով (garik?op=…, gth-tts)
  async function fnFetch(path, opts = {}) {
    const session = (await sb.auth.getSession()).data.session;
    return fetch(`${CFG.url}/functions/v1/${path}`, { ...opts, headers: { Authorization: 'Bearer ' + session.access_token, apikey: CFG.anonKey, ...(opts.headers || {}) } });
  }
  const saveBlob = (blob, name) => {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  };
  // «Կատարե՞մ → Ներբեռնել» վարորդների ցուցակը. իսկական Excel (xlsx, սերվերում), չստացվի՝ CSV ինչպես առաջ. հեռախոսները միայն այս սարքին են գալիս
  async function downloadRows(id, title) {
    const name = `HayWay — ${String(title).slice(0, 40).replace(/[\\/:*?"<>|]/g, '')} ${today()}`;
    try {
      const r = await fnFetch(`garik?op=xlsx&id=${id}`);
      if (r.ok) { saveBlob(await r.blob(), name + '.xlsx'); return; }
    } catch (e) {}
    const { data, error } = await sb.rpc('app_action_rows', { p_id: id });
    if (error) throw new Error(error.message);
    const cols = [['first_name', 'Անուն'], ['last_name', 'Ազգանուն'], ['phones', 'Հեռախոս'], ['orders_30d', 'Պատվեր 30 օր'], ['orders_7d', 'Պատվեր 7 օր'],
      ['idle_days', 'Օր առանց պատվերի'], ['balance', 'Հաշվեկշիռ ֏'], ['hire_date', 'Գրանցվել'], ['rule_name', 'Պայման'], ['car', 'Մեքենա']];
    const val = (d, k) => k === 'phones' ? (d.phones || []).join(', ') : k === 'idle_days' ? (d.idle_days == null ? '' : Math.floor(d.idle_days))
      : k === 'car' ? [d.car_brand, d.car_model, d.car_year].filter(Boolean).join(' ') : (d[k] ?? '');
    const csvCell = (v) => { const s = String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [cols.map((c) => c[1]).join(';')].concat((data || []).map((d) => cols.map((c) => csvCell(val(d, c[0]))).join(';')));
    saveBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), name + '.csv');
  }
  // Հաշվետվություն (db\0032 assistant_reports). «Ներբեռնել»՝ 10 րոպեանոց հղում, «Telegram-ով»՝ բոտը ուղարկում է ֆայլը
  async function reportGet(id, tg) {
    const r = await fnFetch(`garik?op=${tg ? 'report_tg' : 'report'}&id=${id}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || j.error || 'Չստացվեց');
    if (tg) return 'Ուղարկեցի Telegram-ով ✓';
    const a = document.createElement('a'); a.href = j.url; a.download = j.name || 'HayWay.xlsx'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    return '';
  }
  // Պատասխանողը միացա՞ծ է. HayWay-ի համակարգիչը սրտի զարկ է տալիս ամեն րոպե
  const runnerOn = (r) => Boolean(r && r.seen_at && Date.now() - new Date(r.seen_at) < 4 * 60000 && r.claude !== false);
  let chatPoll = null;
  const dayHm = (iso) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yerevan' }).replace(',', '');
  const msgWaiting = (m) => m.status === 'pending' || m.status === 'working';

  // Կարճը առաջինը (Դավիթի public/short.js, կանոն 20). մոդելի տեքստը չի կտրվում՝ միայն ծալվում է. սահմանը՝ առաջին դատարկ տողը,
  // իսկ առանց դրա երկար պատասխանում՝ առաջին նախադասություններից հետո (≤240)։ Կարճը, ցուցակով կամ «Ահա…:»-ով սկսվողը՝ ամբողջը
  const shortCut = (() => {
    const LONG = 360, HEAD_MAX = 420, SOLO = 600, SENT = 240, REST_MIN = 120;
    const weak = (h) => !h || /[:：]\s*$/.test(h) || /^\s*(?:[-•·*—]|\d+[.)])\s/.test(h);
    return (t) => {
      t = String(t || ''); const all = t.trim().length;
      const m = /\n[ \t]*\n/.exec(t);
      if (m && m.index <= HEAD_MAX) return weak(t.slice(0, m.index).trim()) || all <= LONG ? -1 : m.index;
      if (t.length < SOLO) return -1;
      const re = /[.!?…։](?=\s)/g; let k = -1, x;
      while ((x = re.exec(t)) && x.index < HEAD_MAX) { if (x.index + 1 <= SENT || k < 0) k = x.index + 1; else break; }
      return k < 0 || weak(t.slice(0, k).trim()) || all - k < REST_MIN ? -1 : k;
    };
  })();
  const opened = new Set();   // «Ավելին» բացած պատասխանները (մնում են բաց, «Լսել»-ը կարդում է ամբողջը)
  const ansParts = (m) => { const t = noG(m.a || 'Պատասխան չկա։'); const k = m.status === 'done' && !opened.has(m.id) ? shortCut(t) : -1; return k < 0 ? [t, ''] : [t.slice(0, k).trim(), t.slice(k).trim()]; };
  const ansHtml = (m) => { const [a, b] = ansParts(m); return b ? `${esc(a)}<span class="more-t" hidden>\n\n${esc(b)}</span><button type="button" class="more-b" data-more="${m.id}">Ավելին</button>` : esc(a); };

  // «Լսել» (Դավիթի public/speak.js). մեկ նվագարկիչ, ամեն պատասխանի տակ՝ իր կոճակը, կողքին՝ արագություն 1× → 1,5× → 2× (պահվում է այս հեռախոսում)։
  // Ձայնը՝ gth-tts (Gemini «Charon», պահուստ՝ ElevenLabs), չստացվի՝ հեռախոսի ձայնը։ Կարդում է կարճ մասը, «Ավելին»-ից հետո՝ ամբողջը։ Ինքն իրեն չի խոսում։
  const SAY = (() => {
    const au = new Audio(); au.preload = 'auto'; au.setAttribute('playsinline', '');
    const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
    const RATES = [1, 1.5, 2]; let rate = 1;
    try { const v = +localStorage.getItem('hw_say_rate'); if (RATES.includes(v)) rate = v; } catch (e) {}
    let cur = null;
    const label = () => String(rate).replace('.', ',') + '×';
    const sayable = (t) => String(t || '').replace(/https?:\/\/\S+/g, '').replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/[*_#`>|]+/g, ' ')
      .replace(/^\s*(?:[-•·—]|\d+[.)])\s+/gm, '').replace(/֏/g, ' դրամ').replace(/\s+/g, ' ').trim();
    const ui = () => document.querySelectorAll('[data-say]').forEach((b) => {
      const me = !!cur && +b.dataset.say === cur.id; b.classList.toggle('on', me); b.lastChild.textContent = me ? 'Կանգնեցնել' : 'Լսել';
      const r = b.nextElementSibling; if (r && r.hasAttribute('data-rate')) { r.hidden = !me; r.textContent = label(); }
    });
    function stop() { try { au.pause(); } catch (e) {} if (window.speechSynthesis) speechSynthesis.cancel(); if (cur && cur.url) URL.revokeObjectURL(cur.url); cur = null; ui(); }
    function phone(t) {
      const ss = window.speechSynthesis; if (!ss || !window.SpeechSynthesisUtterance) return false;
      const u = new SpeechSynthesisUtterance(t); u.lang = 'hy-AM'; u.rate = rate;
      const v = ss.getVoices().find((x) => /^hy/i.test(x.lang)); if (v) u.voice = v;
      u.onend = u.onerror = () => { if (cur && cur.phone) stop(); };
      cur.phone = true; ss.speak(u); return true;
    }
    async function play(id, text) {
      if (cur && cur.id === id) return stop();
      stop(); cur = { id }; ui();
      try { au.src = SILENT; au.play().catch(() => {}); } catch (e) {}   // iPhone. նվագարկիչը «բացվում է» հենց սեղմելու պահին
      const t = sayable(text).slice(0, 700);
      if (!t) return stop();
      try {
        const r = await fnFetch('gth-tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) });
        if (!cur || cur.id !== id) return;
        if (!r.ok) throw new Error('tts ' + r.status);
        const blob = await r.blob();
        if (!cur || cur.id !== id) return;
        cur.url = URL.createObjectURL(blob); au.src = cur.url; au.playbackRate = rate; await au.play();
      } catch (e) { if (cur && cur.id === id && !phone(t)) stop(); }
    }
    au.onended = () => { if (cur && !cur.phone && au.src !== SILENT) stop(); };
    function speed() { rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; try { localStorage.setItem('hw_say_rate', rate); } catch (e) {} au.playbackRate = rate; ui(); }
    window.addEventListener('hashchange', stop);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    return { play, stop, speed, label };
  })();

  // ───────── Զրույցի նկարը ─────────
  const ACT_HEAD = { staff_message: 'Նամակ աշխատակցին', remember: 'Հիշողություն', remind: 'Հիշեցում', watch: 'Հսկողություն', build: 'Նախագիծ', export: 'Ֆայլ' };
  const actDone = (a) => {
    const r = a.result || {};
    switch (a.type) {
      case 'task_decide': return r.decision === 'reject' ? 'Մերժված է' : 'Հաստատված է';
      case 'call_list': return `${fmt(r.n || 0)} վարորդ՝ Գործերում`;
      case 'export': return `${fmt(r.n || 0)} վարորդ`;
      case 'remind': return `Կհիշեցնեմ ${r.at ? dayHm(r.at) : ''}`;
      case 'watch': return r.now != null ? `Հսկում եմ (հիմա՝ ${fmt(r.now)})` : `Հսկում եմ${r.until ? ` մինչև ${dmy(r.until)}` : ''}`;
      case 'remember': return r.forgot ? 'Մոռացա' : r.replaced ? 'Փոխեցի հիշածը' : 'Հիշեցի';
      case 'listam_top': case 'listam_package': return `Հերթում է (${fmt(r.price || 0)} ֏). list.am-ը կանի 10–20 րոպեում`;
      case 'build': return 'Նախագծերում է';
      case 'staff_message': return 'Գնաց՝ «Թիմ»-ի չատ';
      default: return 'Արված է';
    }
  };
  // ask_choice. մեկ հարց կոճակներով, առաջինը՝ «խորհուրդ եմ տալիս», սեղմածը գնում է որպես հաջորդ հարց
  const choiceCard = (a, ro) => {
    const p = a.params || {}, opts = p.options || [];
    if (a.status !== 'proposed' || ro) return `<div class="act done"><span class="act-h">Հարց</span><p class="act-t">${esc(noG(a.summary))}</p>${a.result && a.result.picked ? `<div class="act-s"><span class="pos">✓ ${esc(a.result.picked)}</span></div>` : ''}</div>`;
    return `<div class="act choice"><span class="act-h">Հարց</span><p class="act-t">${esc(noG(a.summary))}</p>${p.why ? `<p class="act-w">Ինչու եմ հարցնում՝ ${esc(noG(p.why))}</p>` : ''}`
      + `<div class="job-o">${opts.map((o, i) => `<button type="button" class="btn sm ${i ? 'gray' : 'pri'}" data-pick="${a.id}" data-v="${esc(o)}"><span>${esc(o)}</span>${i ? '' : '<small>խորհուրդ եմ տալիս</small>'}</button>`).join('')}</div></div>`;
  };
  // Քարտի կոճակը՝ բայով (Դավիթի acts.js. «Применить», «Остановить»…), և «առաջ → հետո», որտեղ այն կա (db3 params + task_title)
  const METRIC_HY = { online: 'Գծում', orders_today: 'Այսօրվա պատվերներ', orders_hour: 'Վերջին ժամի պատվերներ', tasks_pending: 'Սպասող գործեր' };
  const actVerb = (a) => ({ task_decide: (a.params || {}).decision === 'reject' ? 'Մերժել' : 'Հաստատել', call_list: 'Ստեղծել ցուցակը', remind: 'Հիշեցնել', watch: 'Հսկել',
    remember: 'Հիշել', listam_top: 'Հանել TOP', listam_package: 'Գնել փաթեթը', build: 'Սկսել նախագիծը', staff_message: 'Ուղարկել' })[a.type] || 'Այո, արա';
  const actChange = (a) => {
    const p = a.params || {}, r = a.result || {};
    switch (a.type) {
      case 'task_decide': return ['Սպասում է', p.decision === 'reject' ? 'Մերժված' : 'Հաստատված', a.task_title];
      case 'remind': { const at = r.at || p.at; return at ? ['Հիշեցում չկա', `Հիշեցում ${dayHm(at)}`] : null; }
      case 'watch': return p.metric ? ['Չեմ հսկում', `${METRIC_HY[p.metric] || p.metric} ${p.op} ${fmt(+p.value)}${r.until || p.until ? ` · մինչև ${dmy(r.until || p.until)}` : ''}`] : null;
      case 'remember': return r.forgot ? [r.forgot, 'Մոռացված'] : r.replaced || p.replaced ? [r.replaced || p.replaced, p.text || a.summary] : null;
      case 'listam_top': return ['Սովորական տեղում', `TOP ${p.days || ''} օր · ${+p.days === 7 ? '2 150' : '1 075'} ֏`];
      case 'listam_package': return ['Թարմացում՝ ըստ մնացորդի', '+500 թարմացում · 18 500 ֏'];
      default: return null;
    }
  };
  const chgHtml = (c) => c ? `${c[2] ? `<p class="act-w">${esc(noG(c[2]))}</p>` : ''}<div class="chg"><s>${esc(noG(c[0]))}</s><span class="chg-a">→</span><b>${esc(noG(c[1]))}</b></div>` : '';
  // «Կատարե՞մ» քարտերը (db\0011) + ԿԱ 5-ի նորերը. Excel (report), հարցում թիմին (request), ընտրություն (choice)
  const actCard = (a, ro) => {
    if (a.type === 'choice') return choiceCard(a, ro);
    const r = a.result || {};
    // 05.11 (db4). Հիշողությունը՝ Claude-ի պես, օգնականը հիշում է ինքը → մեծ քարտի փոխարեն փոքր նշան
    if (a.type === 'remember' && a.status === 'done') return `<div class="act mem"><span class="mem-t">✓ ${esc(actDone(a))}${r.name || (a.params || {}).name ? ` · ${esc(noG(r.name || a.params.name))}` : ''}</span>`
      + `<a class="btn plain sm" href="#/garik/brain">Փոխել</a>${ro ? '' : `<button type="button" class="btn plain sm" data-undo="${a.id}">Հետ բերել</button>`}</div>`;
    if (a.type === 'report' && a.status === 'done') return `<div class="act done rep"><span class="act-h">Ֆայլ · Excel</span><p class="act-t">${esc(noG(r.title || a.summary))}</p>`
      + `${(r.summary || []).length ? `<p class="act-l">${r.summary.map((s) => esc(noG(s))).join('<br>')}</p>` : ''}<p class="act-w">${fmt(r.rows || 0)} տող</p>`
      + `<div class="act-b"><button type="button" class="btn pri sm" data-rep="${r.report_id}">Ներբեռնել</button><button type="button" class="btn sm gray" data-reptg="${r.report_id}">Telegram-ով</button></div></div>`;
    if (a.type === 'request' && a.status === 'done') return `<div class="act done"><span class="act-h">Հարցում թիմին</span><p class="act-t">№${esc(r.request_id)}${r.auto ? ' · ինքնաբերաբար' : ''}</p>`
      + `<div class="act-s"><span class="mut">Պատասխանը կգա այստեղ</span><a class="btn plain sm" href="#/garik/req">Հարցումներ ›</a></div></div>`;
    let foot = '';
    if (a.status === 'proposed' && ro) foot = '<div class="act-s"><span class="mut">Չորոշված</span></div>';
    else if (a.status === 'proposed' && a.type === 'export') foot = `<div class="act-b"><button type="button" class="btn pri sm" data-dl="${a.id}">Ներբեռնել Excel</button></div>`;
    else if (a.status === 'proposed') foot = `<div class="act-b"><button type="button" class="btn pri sm" data-yes="${a.id}">${actVerb(a)}</button><button type="button" class="btn sm gray" data-no="${a.id}">Ոչ</button></div>`;
    else if (a.status === 'done' && a.type === 'build') foot = `<div class="act-s"><span class="pos">✓ ${esc(actDone(a))}</span></div><div class="act-b"><a class="btn pri sm" href="#/garik/jobs">Բացել և պատասխանել հարցերին</a></div>`;
    else if (a.status === 'done') foot = `<div class="act-s"><span class="pos">✓ ${esc(actDone(a))}</span>
        ${a.type === 'export' || a.type === 'call_list' ? `<button type="button" class="btn plain sm" data-xls="${a.id}">Excel</button>` : ''}
        ${a.type === 'call_list' ? '<a class="btn plain sm" href="#/tasks">Գործեր</a>' : ''}${a.type === 'remember' ? '<a class="btn plain sm" href="#/garik/brain">Փոխել</a>' : ''}
        ${!ro && a.type !== 'export' && a.type !== 'staff_message' ? `<button type="button" class="btn plain sm" data-undo="${a.id}">Հետ բերել</button>` : ''}</div>`;
    else foot = `<div class="act-s"><span class="${a.status === 'failed' ? 'neg' : 'mut'}">${esc({ rejected: 'Չեղարկված', undone: 'Հետ է բերված', expired: 'Ժամկետն անցել է',
      failed: 'Չստացվեց' + (r.error ? '՝ ' + r.error : '') }[a.status] || a.status)}</span></div>`;
    const head = a.status !== 'proposed' ? (ACT_HEAD[a.type] || 'Գործողություն') : a.type === 'build' ? 'Կառուցե՞մ' : a.type === 'export' ? 'Ֆայլ' : a.type === 'staff_message' ? 'Ուղարկե՞մ' : 'Կատարե՞մ';
    return `<div class="act ${a.status}"><span class="act-h">${head}</span><p class="act-t">${esc(noG(a.summary))}</p>${a.type === 'staff_message' && (a.params || {}).text ? `<p class="act-l">«${esc(a.params.text)}»</p>` : ''}${chgHtml(actChange(a))}${foot}</div>`;
  };
  // հիշեցում / թիմի պատասխան / առաջադրանքի լուր. երկարը՝ մեկ տող, սեղմելով բացվում է
  const noticeEl = (m) => {
    const t = noG(m.a || ''), kind = m.runner === 'team' ? 'Թիմի պատասխանը' : m.runner === 'builder' ? 'Նախագծեր' : m.runner === 'rivals' ? 'Մրցակիցներ' : 'Հիշեցում';
    const body = m.runner === 'team' ? t.replace(/^Թիմի պատասխանը /, '') : t;
    const h = `<span class="note-h">${kind} · ${dayHm(m.answered_at || m.at)}</span>`;
    if (m.runner === 'builder' || /^«.+»՝ (պլանը պատրաստ է|Գարիկը հարց ունի|հարց ունեմ|պատրաստ է|չստացվեց|հետ է բերված)/.test(m.a || '')) return `<a class="msg ai notice jlink" href="#/garik/jobs">${h}${esc(body)} ›</a>`;
    if (body.length <= 90 && !body.includes('\n')) return `<div class="msg ai notice">${h}${esc(body)}</div>`;
    const first = body.split('\n').map((x) => x.trim()).filter(Boolean).join(' · ');
    return `<details class="msg ai notice"><summary>${h}<span class="note-s">${esc(first.length > 90 ? first.slice(0, 88) + '…' : first)}</span></summary><div class="note-b">${esc(body)}</div></details>`;
  };
  const fileChips = (fs) => (fs || []).length ? `<span class="fchips">${fs.map((f) => `<button type="button" class="fchip" data-file="${esc(f.path || '')}">${/^image\//.test(f.mime || '') ? IC.img : IC.doc}<span>${esc(f.name)}</span></button>`).join('')}</span>` : '';
  const aiBubble = (m, ro) => {
    const done = m.status === 'done', bad = m.status === 'error' || m.status === 'cancelled';
    return `<div class="msg ai">${ansHtml(m)}${m.proposed && m.proposed.length ? `<span class="note">Գործերում նոր առաջարկ՝ «${esc(m.proposed.join('», «'))}»</span>` : ''}`
      + (done ? `<span class="msg-f"><button type="button" class="say-b" data-say="${m.id}">${IC.speaker}<span>Լսել</span></button><button type="button" class="say-r" data-rate hidden>${SAY.label()}</button></span>` : '')
      + (bad && !ro && m.q ? `<span class="msg-f"><button type="button" class="say-b" data-retry="${m.id}">Կրկնել</button></span>` : '') + '</div>';
  };
  const chatThread = (list, waitText, ro) => list.map((m) => (m.kind === 'notice' ? noticeEl(m)
    : (m.src === 'auto' ? `<div class="msg-sys">Խոստացածս կատարում եմ · ${dayHm(m.at)}</div>` : `<div class="msg me">${esc(m.q)}${fileChips(m.files)}</div>`)
      + (msgWaiting(m) ? `<div class="msg ai typing">${esc(waitText)}${m.id && !ro ? `<button type="button" class="nowait" data-nowait="${m.id}">Չսպասել</button>` : ''}</div>`
        : aiBubble(m, ro) + (m.actions || []).map((a) => actCard(a, ro)).join('')))).join('');
  // Ընդհանուր կոճակները (զրույցում և հին զրույցում). «Ավելին», «Լսել», արագություն, Excel, ֆայլեր
  async function threadCommon(e, list) {
    const b = e.target.closest('[data-more],[data-say],[data-rate],[data-rep],[data-reptg],[data-xls],[data-file]');
    if (!b) return false;
    const d = b.dataset;
    if (d.more) { opened.add(+d.more); const r = b.previousElementSibling; if (r && r.classList.contains('more-t')) r.hidden = false; b.remove(); return true; }
    if (d.say) { const m = list().find((x) => x.id === +d.say); if (m) { const [a, rest] = ansParts(m); SAY.play(m.id, rest ? a : noG(m.a)); } return true; }
    if (b.hasAttribute('data-rate')) { SAY.speed(); return true; }
    b.disabled = true;
    try {
      if (d.rep || d.reptg) { const t = await reportGet(+(d.rep || d.reptg), !!d.reptg); if (t) { b.textContent = t; return true; } }
      else if (d.xls) await downloadRows(+d.xls, b.closest('.act').querySelector('.act-t').textContent);
      else if (d.file) { const r = await fnFetch(`garik?op=file&path=${encodeURIComponent(d.file)}`); const j = await r.json(); if (!j.url) throw new Error('Ֆայլը չգտնվեց'); window.open(j.url, '_blank', 'noopener'); }
    } catch (err) { alert('Չստացվեց՝ ' + err.message); }
    b.disabled = false;
    return true;
  }

  // ───────── Ֆայլեր տիրոջից (ԿԱ 5 մաս 7). մինչև 3, նկարը՝ 1600px JPEG, PDF / Excel / Word / CSV / TXT ≤ 5 ՄԲ ─────────
  const FILE_EXT = ['pdf', 'xlsx', 'xls', 'csv', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'];
  async function prepFile(file) {
    const ext = ((/\.([a-z0-9]+)$/i.exec(file.name) || [])[1] || '').toLowerCase();
    const isImg = /^image\//.test(file.type) || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(ext);
    if (!isImg && !FILE_EXT.includes(ext)) throw new Error('Այս ֆայլը չեմ կարդում. նկար, PDF, Excel, Word, CSV կամ TXT');
    if (isImg) {
      try {
        const bmp = await createImageBitmap(file);
        const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
        if (blob) return { name: (file.name.replace(/\.[^.]+$/, '') || 'նկար') + '.jpg', mime: 'image/jpeg', blob, size: blob.size, img: true };
      } catch (e) {}
    }
    if (file.size > 5 * 1024 * 1024) throw new Error('Ֆայլը 5 ՄԲ-ից մեծ է');
    return { name: file.name, mime: file.type || '', blob: file, size: file.size, img: isImg };
  }
  async function uploadFile(f) {
    const r = await fnFetch('garik?op=upload', { method: 'POST', headers: { 'Content-Type': f.mime || 'application/octet-stream', 'x-file-name': encodeURIComponent(f.name) }, body: f.blob });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || 'Ֆայլը չբեռնվեց');
    return j;
  }

  // 30 րոպե առանց էկրանի → վերադառնալիս թարմ զրույց (Դավիթի ձևը)
  let gHiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { gHiddenAt = Date.now(); return; }
    if (gHiddenAt && Date.now() - gHiddenAt > 30 * 60000 && (location.hash || '') === '#/garik' && !document.querySelector('.composer textarea:focus')) render();
    gHiddenAt = 0;
  });

  // ներքին էջերի վերնագիր՝ «‹ Զրույց» + անուն (Դավիթի pj-vh)
  const gsub = (t, back = ['#/garik', 'Զրույց']) => `<div class="gsub"><a class="backb" href="${back[0]}">${I.back}<span>${back[1]}</span></a><b>${t}</b></div>`;
  // վերնագիրը՝ Դավիթի aiHead-ի հերթականությամբ. ⋯ · GTH · ժամացույց · մատիտ · փակել
  const garikLeft = () => `<a class="ibtn hb" href="#/garik/more" aria-label="Ավելին" title="Ավելին">${I.more}</a>`;
  const garikHead = () => `<a class="ibtn hb" href="#/garik/history" aria-label="Հին զրույցներ" title="Հին զրույցներ">${I.hist}</a><button type="button" class="ibtn hb" id="gnew" aria-label="Նոր զրույց" title="Նոր զրույց">${I.compose}</button><a class="ibtn hb gclose" href="${chatBack}" aria-label="Փակել" title="Փակել">${sv(20, '<path d="M6 6l12 12M18 6 6 18"/>', ' style="stroke-width:2.2"')}</a>`;
  const subMount = (title, body, back) => mount({ title: 'GTH', tab: 'garik', compact: true, right: '' }, gsub(title, back) + body);
  const recRow = () => `<div class="rec" id="rec" hidden><button type="button" class="rec-x" id="rec-x" aria-label="Չեղարկել">${sv(20, '<path d="M6 6l12 12M18 6 6 18"/>', ' style="stroke-width:2.4"')}</button><span class="rec-dot"></span><canvas class="rec-w" id="rec-w"></canvas><span class="rec-t" id="rec-t">0:00</span><button type="button" class="rec-ok" id="rec-ok" aria-label="Պատրաստ է">${sv(20, '<path d="m5 12.5 4.5 4.5L19 7.5"/>', ' style="stroke-width:2.6"')}</button></div>`;

  route('/garik', async (arg) => {
    lastTab = 'garik';
    clearTimeout(chatPoll);
    clearTimeout(jobsPoll);
    SAY.stop();
    if (arg === 'jobs') return jobsView();
    if (arg === 'more') return garikMore();
    if (arg === 'wait') return garikWait();
    if (arg === 'history') return garikHistory();
    if (arg === 'brain') return garikBrain();
    if (arg === 'acts') return garikActs();
    if (arg === 'req') return garikRequests();
    if (arg && arg.startsWith('h-')) return garikOld(arg.slice(2));
    try { localStorage.removeItem('hw_chat'); } catch (e) {}
    const askQ = new URLSearchParams((location.hash.split('?')[1]) || '').get('ask');
    // 30 րոպե լռությունից հետո՝ թարմ զրույց. նախորդը գնում է «Հին զրույցներ», և կոճակով այն կարելի է շարունակել (db\0032)
    const fr = await sb.rpc('app_assistant_fresh').then((r) => r.data || {}, () => ({}));
    if (fr.key) { try { sessionStorage.setItem('hw_prev_conv', fr.key); } catch (e) {} }
    const [st, as, gc, jb] = await Promise.all([garikState(), assistantNow(), gthCards(), jobsNow().catch(() => ({ items: [] }))]);
    const pc = st.mode === 'pc', on = !pc || runnerOn(as.runner);
    const waitText = on ? 'Նայում եմ թվերին… պատասխանը՝ 1–2 րոպեում' : 'Հարցը պահված է';
    // «Սպասում է քեզ · N»՝ մեկ նուրբ տող (Դավիթի «Ждут вас»)
    const jw = jobsWaiting(jb.items), nWait = gc.count + jw;
    const firstJob = (jb.items || []).find((j) => JOB_WAIT.includes(j.status));
    const slot = nWait ? `<a class="gslot" href="${gc.count ? '#/garik/wait' : '#/garik/jobs'}"><i></i><b>Սպասում է քեզ${nWait > 1 ? ` · ${nWait}` : ''}</b><span>${esc(noG(gc.top || (firstJob ? firstJob.title || firstJob.request : '')))}</span><em>›</em></a>` : '';
    const off = !st.ok ? 'Օգնականը հիմա կապ չունի' : on ? '' : 'Համակարգիչը անջատված է. հարցը կպահվի';
    let msgs = as.msgs || [], att = [], busy = false;
    let prevKey = null; try { prevKey = sessionStorage.getItem('hw_prev_conv'); } catch (e) {}
    const empty = () => `<div class="gempty"><h3>Ինչով օգնե՞մ</h3>${prevKey ? '<button type="button" class="btn sm gray gresume" id="gresume">Շարունակել նախորդ զրույցը</button>' : ''}${off ? `<p><span class="dot off"></span>${off}</p>` : ''}</div>`;
    const nj = (jb.items || []).length;
    const sc = mount({ title: 'GTH', tab: 'garik', compact: true, left: garikLeft(), right: garikHead(),
      after: `<div class="gdown-w"><button type="button" class="gdown" id="gdown" aria-label="Վերջինին" title="Վերջինին" hidden>${IC.down}</button></div>`
        + `<div class="cpop" id="cpop" hidden><a href="#/garik/jobs?new=1">${I.star}<span><b>Նոր նախագիծ</b><small>պատմիր, ինչ ավելացնել. կսարքեմ</small></span></a>`
        + `<a href="#" id="cfile">${IC.clip}<span><b>Նկար կամ ֆայլ</b><small>նկար, PDF, Excel, Word · մինչև 3</small></span></a></div>`
        + `<div class="atts" id="atts" hidden></div><input type="file" id="fin" multiple accept="image/*,.pdf,.xlsx,.xls,.csv,.docx,.txt" hidden>`
        + `<div class="composer"><button type="button" class="cplus" id="cplus" aria-label="Ավելացնել">${I.plus}</button><textarea id="q" rows="1" placeholder="${st.ok ? 'Գրիր GTH-ին…' : 'Օգնականը դեռ միացված չէ'}" enterkeyhint="send"></textarea><button class="mic" id="mic" type="button" aria-label="Խոսել" title="Խոսել (Ctrl+M)"${st.ok ? '' : ' disabled'}>${I.mic}</button><button class="send" id="send" aria-label="Ուղարկել" disabled>${I.send}</button>${recRow()}</div>` },
      `${slot}<div class="chat" id="chat"><div class="chat" id="thread" style="padding:0">${msgs.length ? chatThread(msgs, waitText) : empty()}</div>${msgs.length && off ? `<p class="job-off"><span class="dot off"></span>${off}</p>` : ''}</div>`);
    const q = document.getElementById('q'), send = document.getElementById('send'), threadEl = document.getElementById('thread'), gdown = document.getElementById('gdown');
    const attsEl = document.getElementById('atts'), fin = document.getElementById('fin');
    const down = () => { sc.scrollTop = sc.scrollHeight; };
    const paint = () => { threadEl.innerHTML = msgs.length ? chatThread(msgs, waitText) : empty(); bindResume(); down(); };
    const grow = () => { q.style.height = 'auto'; q.style.height = Math.min(132, q.scrollHeight) + 'px'; send.disabled = (!q.value.trim() && !att.length) || busy || !st.ok; };
    // ↓ «վերջինին»՝ երբ վերև է թերթել
    sc.addEventListener('scroll', () => { gdown.hidden = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 240; }, { passive: true });
    gdown.onclick = () => sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
    function bindResume() {
      const b = document.getElementById('gresume'); if (!b) return;
      b.onclick = async () => {
        b.disabled = true;
        const { error } = await sb.rpc('app_assistant_resume', { p_key: prevKey });
        try { sessionStorage.removeItem('hw_prev_conv'); } catch (e) {}
        if (error) { b.disabled = false; alert('Չստացվեց՝ ' + error.message); return; }
        render();
      };
    }
    bindResume();
    // կցված ֆայլերը դաշտի վերևում (✕՝ հանել)
    const paintAtts = () => {
      attsEl.hidden = !att.length;
      attsEl.innerHTML = att.map((f, i) => `<span class="att">${f.img ? `<img src="${f.url}" alt="">` : IC.doc}<span>${esc(f.name)}</span><button type="button" data-rm="${i}" aria-label="Հանել">${IC.x}</button></span>`).join('');
      grow();
    };
    attsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; const f = att.splice(+b.dataset.rm, 1)[0]; if (f && f.url) URL.revokeObjectURL(f.url); paintAtts(); });
    fin.onchange = async () => {
      const list = [...fin.files]; fin.value = '';
      for (const file of list) {
        if (att.length >= 3) { alert('Մեկ հարցին՝ մինչև 3 ֆայլ'); break; }
        try { const f = await prepFile(file); if (f.img) f.url = URL.createObjectURL(f.blob); att.push(f); } catch (err) { alert(err.message); }
      }
      paintAtts();
    };
    // Քարտերի ու պատասխանի կոճակները (մեկ ունկնդիր ամբողջ զրույցի համար, որ paint()-ից հետո էլ աշխատի)
    const setAct = (a) => { msgs = msgs.map((m) => ({ ...m, actions: (m.actions || []).map((x) => x.id === a.id ? { ...x, status: a.status, result: a.result } : x) })); paint(); };
    threadEl.addEventListener('click', async (e) => {
      if (await threadCommon(e, () => msgs)) return;
      const b = e.target.closest('button[data-yes],button[data-no],button[data-undo],button[data-dl],button[data-pick],button[data-retry],button[data-nowait]');
      if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.retry) { const m = msgs.find((x) => x.id === +d.retry); if (m) ask(m.q, m.files); return; }
      if (d.nowait) { b.disabled = true; await sb.rpc('app_assistant_cancel', { p_id: +d.nowait }); msgs = (await assistantNow()).msgs || []; paint(); return; }
      const card = b.closest('.act');
      card.querySelectorAll('button').forEach((x) => x.disabled = true);
      try {
        if (d.pick) {   // ընտրությունը՝ որպես հաջորդ հարց
          const { error } = await sb.rpc('app_choice_pick', { p_id: +d.pick, p_value: d.v });
          if (error) throw new Error(error.message);
          setAct({ id: +d.pick, status: 'done', result: { picked: d.v } });
          ask(d.v); return;
        }
        if (d.dl) {   // ֆայլ՝ մեկ սեղմումով. բազան պատրաստում է ցուցակը, հետո՝ ներբեռնում
          const { data, error } = await sb.rpc('app_action_decide', { p_id: +d.dl, p_yes: true });
          if (error) throw new Error(error.message);
          if (data.status === 'done') await downloadRows(+d.dl, card.querySelector('.act-t').textContent);
          setAct(data); return;
        }
        const { data, error } = d.undo ? await sb.rpc('app_action_undo', { p_id: +d.undo })
          : await sb.rpc('app_action_decide', { p_id: +(d.yes || d.no), p_yes: !!d.yes });
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
      if (!msgs.some(msgWaiting)) return;
      chatPoll = setTimeout(async () => {
        if ((location.hash || '#/') !== '#/garik') return;
        try {
          const wasWaiting = new Set(msgs.filter(msgWaiting).map((m) => m.id));
          msgs = (await assistantNow()).msgs || [];
          const fresh = msgs.filter((m) => wasWaiting.has(m.id) && !msgWaiting(m));
          const n = fresh.reduce((s, m) => s + ((m.proposed && m.proposed.length) || 0), 0);
          if (n) { invalidate(); pendingCount += n; }
          if (fresh.length) paint();
        } catch (e) {}
        poll();
      }, 5000);
    };
    down();
    poll();
    async function ask(text, files) {
      text = String(text || '').trim();
      const pending = files ? [] : att.slice();
      if ((!text && !pending.length && !(files || []).length) || busy || !st.ok) return;
      busy = true; q.value = ''; att = []; paintAtts(); grow(); SAY.stop();
      try { sessionStorage.removeItem('hw_prev_conv'); } catch (e) {}
      prevKey = null;
      msgs = [...msgs, { id: 0, q: text || 'Նայիր կցված ֆայլին։', status: 'pending', files: (files || pending).map((f) => ({ name: f.name, mime: f.mime })) }]; paint();
      let extra = null;
      try {
        let up = files || [];
        if (pending.length) { q.placeholder = 'Բեռնում եմ ֆայլը…'; up = []; for (const f of pending) up.push(await uploadFile(f)); }
        const r = await garikCall('POST', { question: text, files: up });
        if (!r.queued && r.error) extra = { id: 0, q: text, a: r.answer || 'Սխալ եղավ։', status: 'error', files: up };
        if (r.proposed && r.proposed.length) { invalidate(); pendingCount += r.proposed.length; }
        msgs = (await assistantNow()).msgs || [];
      } catch (e) { msgs = msgs.slice(0, -1); extra = { id: 0, q: text, a: 'Կապի սխալ՝ ' + e.message, status: 'error' }; }
      pending.forEach((f) => { if (f.url) URL.revokeObjectURL(f.url); });
      q.placeholder = st.ok ? 'Գրիր GTH-ին…' : 'Օգնականը դեռ միացված չէ';
      if (extra) msgs = [...msgs, extra];
      paint(); busy = false; grow(); poll();
    }
    dictation(q, grow);
    q.addEventListener('input', grow);
    send.onclick = () => ask(q.value);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q.value); } });
    q.addEventListener('focus', () => setTimeout(down, 300));
    // «+»՝ նոր առաջադրանք կամ ֆայլ (Դավիթի «+ Новый проект · Фото или файл»)
    const pop = document.getElementById('cpop');
    document.getElementById('cplus').onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; };
    document.getElementById('cfile').onclick = (e) => { e.preventDefault(); pop.hidden = true; fin.click(); };
    sc.addEventListener('click', () => { pop.hidden = true; });
    // Նոր զրույց. հինը գնում է «Հին զրույցներ», ոչինչ չի ջնջվում (db\0031)
    document.getElementById('gnew').onclick = async () => {
      if (!msgs.length) { q.focus(); return; }
      clearTimeout(chatPoll);
      const { error } = await sb.rpc('app_assistant_clear');
      if (error) { alert('Չստացվեց՝ ' + error.message); return; }
      msgs = []; prevKey = null; paint(); q.focus();
    };
    // այլ բաժնից եկած հարցը (#/garik?ask=…). մեկ անգամ, հասցեից հանելով, որ թարմացնելիս չկրկնվի
    if (askQ) { history.replaceState(null, '', '#/garik'); ask(askQ).then(down); }
  });

  // «⋯». Դավիթի մենյուն՝ նույն հերթականությամբ. Նախագծեր · Ինչ արեց օգնականը · Հարցումներ թիմին · Ինչ գիտեմ քո մասին (+ Հին զրույցներ)
  async function garikMore() {
    const [jb, br, ac, rq] = await Promise.all([jobsNow().catch(() => ({ items: [] })), sb.rpc('app_brain').then((r) => r.data || [], () => []),
      sb.rpc('app_acts').then((r) => r.data || {}, () => ({})), sb.rpc('app_requests').then((r) => r.data || [], () => [])]);
    const L = jb.items || [], jw = jobsWaiting(L), aw = (ac.waiting || []).length, ro = rq.filter((r) => r.status === 'open').length;
    subMount('Ավելին', page(group([
      cell({ href: '#/garik/jobs', icon: I.star, color: 'y', t: 'Նախագծեր', s: L.length ? `${L.length}${jw ? ` · սպասում են քեզ՝ ${jw}` : ' · ոչինչ չի սպասում'}` : 'Դեռ չկա. պատմիր առաջինի մասին' }),
      cell({ href: '#/garik/acts', icon: IC.acts, color: 'p', t: 'Ինչ արեց օգնականը', s: aw ? `Սպասում են որոշման՝ ${aw}` : `Հսկողության տակ՝ ${(ac.watches || []).length} · ֆայլեր՝ ${(ac.reports || []).length}` }),
      cell({ href: '#/garik/req', icon: IC.team, color: 'b', t: 'Հարցումներ թիմին', s: rq.length ? `${rq.length}${ro ? ` · բաց՝ ${ro}` : ''}` : 'Դեռ չկա' }),
      cell({ href: '#/garik/brain', icon: I.ai, t: 'Ինչ գիտեմ քո մասին', s: br.length ? `${br.length} գրառում` : 'Դեռ ոչինչ' }),
      cell({ href: '#/garik/history', icon: I.hist, t: 'Հին զրույցներ', s: 'Բացել և շարունակել' }),
    ], 'ic')));
  }
  // Սպասում է քեզ. «Այո» սպասողները, «Հարց ձեզ», հիշեցումները, ծանուցումների միացումը (նախկինում՝ զրույցի վերևում)
  async function garikWait() {
    const [gc, jb] = await Promise.all([gthCards(), jobsNow().catch(() => ({ items: [] }))]);
    const jw = (jb.items || []).filter((j) => JOB_WAIT.includes(j.status));
    const jobsRow = jw.length ? group(jw.slice(0, 3).map((j) => cell({ href: '#/garik/jobs', icon: I.star, color: 'y', t: esc(noG(j.title || j.request)), s: (JOB_TAG[j.status] || ['Սպասում է'])[0] })), 'ic') : '';
    subMount('Սպասում է քեզ', `<div class="page gthc">${jobsRow}${gc.html || (jobsRow ? '' : emptyState(I.tasks, 'Ոչինչ չի սպասում', 'Ամեն ինչ որոշված է'))}</div>`);
    gc.bind();
  }
  // «Ինչ արեց օգնականը» (Դավիթի acts.js). Սպասում են որոշման · Փոփոխություններ · Հսկողության տակ · Հաշվետվություններ
  async function garikActs() {
    const { data, error } = await sb.rpc('app_acts');
    if (error) throw new Error(error.message);
    const A = data || {};
    const stText = (a) => a.status === 'done' ? '✓ ' + actDone(a) : ({ rejected: 'Չեղարկված', undone: 'Հետ է բերված', expired: 'Ժամկետն անցել է', failed: 'Չստացվեց' }[a.status] || a.status);
    const watchS = (w) => w.kind === 'remind' ? `Կհիշեցնեմ ${w.due_at ? dayHm(w.due_at) : ''}` : `${{ online: 'Գծում', orders_today: 'Այսօրվա պատվերներ', orders_hour: 'Վերջին ժամի պատվերներ', tasks_pending: 'Սպասող գործեր' }[w.metric] || w.metric} ${w.op} ${fmt(w.value)}${w.until ? ` · մինչև ${dmy(w.until)}` : ''}`;
    subMount('Ինչ արեց օգնականը', page(
      sec('Սպասում են որոշման', (A.waiting || []).length ? `<div class="chat acts-w">${A.waiting.map((a) => actCard({ ...a, status: 'proposed' }, false)).join('')}</div>` : '<p class="none">Ոչինչ չի սպասում</p>')
      + sec('Փոփոխություններ', (A.changes || []).length ? group(A.changes.map((a) => cell({ t: esc(noG(a.summary)), s: `${esc(stText(a))} · ${dayHm(a.at)}`,
          trail: a.status === 'done' && !['export', 'build'].includes(a.type) ? `<button type="button" class="btn plain sm" data-undo="${a.id}">Հետ բերել</button>` : '' }))) : '<p class="none">Դեռ ոչինչ</p>',
        { foot: 'Վերջին 30 օրը։' })
      + sec('Հսկողության տակ', (A.watches || []).length ? group(A.watches.map((w) => cell({ t: esc(noG(w.text)), s: esc(watchS(w)),
          trail: `<button type="button" class="btn plain sm" data-wcancel="${w.id}">Անջատել</button>` }))) : '<p class="none">Ոչինչ չեմ հսկում. ասա զրույցում՝ «հետևիր…» կամ «հիշեցրու…»</p>')
      + sec('Հաշվետվություններ', (A.reports || []).length ? group(A.reports.map((r) => cell({ icon: IC.doc, t: esc(noG(r.title)), s: `${fmt(r.rows)} տող · ${dayHm(r.at)}`,
          trail: `<span class="acts-rb"><button type="button" class="btn pri sm" data-rep="${r.id}">Ներբեռնել</button><button type="button" class="btn sm gray" data-reptg="${r.id}">Telegram</button></span>` })), 'ic') : '<p class="none">Դեռ ֆայլ չկա. խնդրիր զրույցում՝ «տուր Excel-ով»</p>')));
    app.querySelector('#sc').addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-yes],button[data-no],button[data-undo],button[data-wcancel],button[data-rep],button[data-reptg],button[data-dl]');
      if (!b || b.disabled) return;
      const d = b.dataset; b.disabled = true;
      try {
        if (d.rep || d.reptg) { const t = await reportGet(+(d.rep || d.reptg), !!d.reptg); if (t) b.textContent = t; b.disabled = false; return; }
        if (d.wcancel) { if (!confirm('Անջատե՞լ')) { b.disabled = false; return; } const { error } = await sb.rpc('app_watch_cancel', { p_id: +d.wcancel }); if (error) throw new Error(error.message); }
        else if (d.dl) { const { data: x, error } = await sb.rpc('app_action_decide', { p_id: +d.dl, p_yes: true }); if (error) throw new Error(error.message); if (x.status === 'done') await downloadRows(+d.dl, b.closest('.act').querySelector('.act-t').textContent); }
        else { const { error } = d.undo ? await sb.rpc('app_action_undo', { p_id: +d.undo }) : await sb.rpc('app_action_decide', { p_id: +(d.yes || d.no), p_yes: !!d.yes }); if (error) throw new Error(error.message); }
        invalidate(); render();
      } catch (err) { b.disabled = false; alert('Չստացվեց՝ ' + err.message); }
    });
  }
  // «Հարցումներ թիմին» (Դավիթի «Запросы»). №N, կարգավիճակ, թիմի պատասխանը (այն գալիս է նաև զրույց)
  async function garikRequests() {
    const { data, error } = await sb.rpc('app_requests');
    if (error) throw new Error(error.message);
    const L = data || [];
    const TAG = { open: ['Բաց', 'warn'], answered: ['Պատասխանված', 'pos'], done: ['Արված', 'pos'], closed: ['Փակ', 'n'] };
    subMount('Հարցումներ թիմին', page(L.length ? `<div class="card nlist reqs">${L.map((r) => `<div class="nrow req"><div class="req-h"><b>№${r.id}</b><span class="tag ${(TAG[r.status] || ['', 'n'])[1]}">${(TAG[r.status] || [r.status])[0]}</span><span class="mut3">${dmy(r.at)}</span></div>`
      + `<p>${esc(noG(r.text))}</p>${r.answer ? `<p class="req-a"><b>Թիմ՝</b> ${esc(noG(r.answer))}</p>` : r.status === 'open' ? '<p class="mut3">Թիմը նայում է. պատասխանը կգա զրույց</p>' : ''}</div>`).join('')}</div>`
      : emptyState(IC.team, 'Դեռ չկա', 'Երբ ինչ-որ բան իմ ձեռքով չի լինում, կփոխանցեմ թիմին, ու այստեղ կերևա')));
  }
  // Հին զրույցներ (Դավիթի «История разговоров») + որոնում
  async function garikHistory() {
    const { data, error } = await sb.rpc('app_assistant_history');
    if (error) throw new Error(error.message);
    const L = data || [];
    const d = (iso) => new Date(iso).toLocaleDateString('hy-AM', { day: 'numeric', month: 'long', timeZone: 'Asia/Yerevan' });
    const rows = (list) => list.length ? group(list.map((c) => cell({ href: `#/garik/h-${c.key}`, t: esc(noG(c.title_ai || c.title || 'Զրույց')), s: `${d(c.last)} · ${c.n} հարց${c.summary ? ' · ' + esc(noG(c.summary).replace(/\s+/g, ' ').slice(0, 160)) : ''}` }))) : '<p class="none">Չգտնվեց</p>';
    subMount('Հին զրույցներ', page(L.length ? `<input class="in hsearch" id="hq" type="search" placeholder="Որոնել…" enterkeyhint="search"><div id="hl">${rows(L)}</div>`
      : emptyState(I.hist, 'Դեռ չկա', 'Նոր զրույց սկսելիս՝ հինը կհայտնվի այստեղ')));
    const hq = document.getElementById('hq');
    if (hq) hq.addEventListener('input', () => { const s = hq.value.trim().toLowerCase(); document.getElementById('hl').innerHTML = rows(s ? L.filter((c) => `${c.title} ${c.title_ai || ''} ${c.summary || ''}`.toLowerCase().includes(s)) : L); });
  }
  // Հին զրույցը՝ ամբողջը, և «Շարունակել» (Դավիթի open_chat / «Продолжить»)
  async function garikOld(key) {
    const { data, error } = await sb.rpc('app_assistant_chat', { p_key: key });
    if (error) throw new Error(error.message);
    const L = data || [];
    const sc = subMount(L.length ? dayHm(L[0].at) : 'Զրույց', `<div class="chat" id="othread">${chatThread(L, '', true)}</div>${L.length ? '<div class="gcont"><button type="button" class="btn pri full" id="gcont">Շարունակել այս զրույցը</button></div>' : ''}`, ['#/garik/history', 'Հին զրույցներ']);
    sc.querySelector('#othread').addEventListener('click', (e) => { threadCommon(e, () => L); });
    const b = document.getElementById('gcont');
    if (b) b.onclick = async () => {
      b.disabled = true;
      const { error: er } = await sb.rpc('app_assistant_resume', { p_key: key });
      if (er) { b.disabled = false; alert('Չստացվեց՝ ' + er.message); return; }
      location.hash = '#/garik';
    };
  }
  // Ինչ գիտեմ քո մասին (owner_brain, db4). Claude-ի հիշողության 4 տեսակը, ամեն գրառում՝ անուն + փաստ + ինչու. «Փոխել» / «Մոռանալ»
  const BRAIN_KINDS = [['user', 'Քո մասին'], ['feedback', 'Ինչպես աշխատել քեզ հետ'], ['project', 'Որոշումներ ու պլաններ'], ['reference', 'Որտեղ ինչ կա']];
  async function garikBrain() {
    const br = await sb.rpc('app_brain').then((r) => r.data || [], () => []);
    const row = (b) => `<div class="nrow brain"><p>${b.name ? `<b>${esc(noG(b.name))}</b><br>` : ''}${esc(noG(b.text))}${b.why ? `<small class="brain-w">Ինչու՝ ${esc(noG(b.why))}</small>` : ''}<small class="brain-w">${dmy(b.at)}${b.source === 'owner' ? '' : ' · հիշեցի ինքս'}</small></p>`
      + `<span class="nrow-b"><button type="button" class="btn sm gray" data-edit="${b.id}">Փոխել</button><button type="button" class="btn sm gray" data-forget="${b.id}">Մոռանալ</button></span></div>`;
    subMount('Ինչ գիտեմ քո մասին', page(br.length
      ? `<p class="meta">Կարևորը հիշում եմ ինքս՝ մեր զրույցներից։ Սխալ բան կա՝ փոխիր կամ մոռացիր։</p>`
        + BRAIN_KINDS.map(([k, t]) => { const L = br.filter((b) => (b.kind || 'user') === k); return L.length ? sec(t, `<div class="card nlist">${L.map(row).join('')}</div>`) : ''; }).join('')
      : emptyState(I.ai, 'Դեռ ոչինչ', 'Կարևորը կհիշեմ ինքս՝ մեր զրույցներից')));
    app.querySelectorAll('[data-forget]').forEach((b) => b.onclick = async () => {
      if (!confirm('Մոռանա՞լ սա։')) return;
      b.disabled = true;
      const { error } = await sb.rpc('app_brain_forget', { p_id: +b.dataset.forget });
      if (error) { b.disabled = false; alert('Չստացվեց՝ ' + error.message); return; }
      b.closest('.nrow').remove();
    });
    app.querySelectorAll('[data-edit]').forEach((b) => b.onclick = async () => {
      const old = (br.find((x) => x.id === +b.dataset.edit) || {}).text || '';
      const t = prompt('Ինչպե՞ս հիշեմ', old);
      if (t == null || !t.trim() || t.trim() === old) return;
      b.disabled = true;
      const { error } = await sb.rpc('app_brain_edit', { p_id: +b.dataset.edit, p_text: t.trim() });
      if (error) { b.disabled = false; alert('Չստացվեց՝ ' + error.message); return; }
      render();
    });
  }

  // ───────── Նախագծեր (#/garik/jobs, նախկինում «Առաջադրանքներ») ─────────
  // 2026-11-04 (Գարիկ. «Դավիթինի պես, որ առաջադրանք տան, ինքը կառուցի, ու մարդը տեսնի»)։ Տերը գրում է, ինչ ավելացնել կամ փոխել →
  // GTH-ը (տիրոջ Claude-ը HayWay-ի համակարգչում, scripts\builder-run.ps1) հարցնում է ՄԵԿ-ՄԵԿ (մինչև 7, «Ինչու եմ հարցնում», «մնաց ~N»)
  // → «Ահա ինչ հասկացա» (7 դաշտ) → «Այո, արեք» → կառուցում, ստուգում → «Միացնել իսկապես» / «Դեռ ոչ» → 7 օր հետո «Օգնե՞ց»։
  // Բազան՝ db\0030_builds.sql + db\0032_ka5_like_davit.sql։ Ցուցակը՝ «Սպասում է քեզ / Անում եմ / Պատրաստ» (Դավիթի «Проекты»)։
  const JOB_STEPS = ['Հարցեր', 'Պլան', 'Կառուցում', 'Աշխատում է', 'Ստուգված'];
  const JOB_AT = { new: 0, planning: 0, ask: 0, ready: 1, garik: 1, queued: 2, building: 2, checking: 2, preview: 2, held: 2, releasing: 2, done: 3, verify: 3, verified: 4 };
  const JOB_WORK = ['new', 'planning', 'queued', 'building', 'checking', 'releasing', 'undo', 'undoing'];
  const JOB_WAIT = ['ask', 'ready', 'preview', 'held', 'verify', 'failed'];
  const JOB_TAG = { ask: ['Հարց', 'warn'], ready: ['Սպասում է «Այո»-ի', 'warn'], garik: ['GTH-ի հաստատում', 'n'], preview: ['Միացնե՞մ', 'warn'], held: ['Պահված', 'n'],
    done: ['Աշխատում է', 'pos'], verify: ['Օգնե՞ց', 'warn'], verified: ['Ստուգված', 'pos'], failed: ['Չստացվեց', 'neg'], rejected: ['Չեղարկված', 'n'], undone: ['Հետ բերված', 'n'] };
  const JOB_CARD = [['why', 'Ինչու'], ['what', 'Ինչ'], ['where', 'Որտեղ'], ['rules', 'Կանոններ'], ['keep', 'Չենք փոխում'], ['check', 'Ինչպես կստուգենք'], ['assumptions', 'Ենթադրություններ']];
  const VERDICT = { yes: 'Օգնեց ✓', partly: 'Մասամբ օգնեց', no: 'Չօգնեց. թիմը նայում է' };
  const JOB_EX = ['Ամեն երկուշաբթի՝ ով չի աշխատել', 'Նոր վարորդների ցուցակ Excel-ով', 'Գլխավորում՝ այսօրվա եկամուտը'];
  const JOB_PH = 'Գրիր, ինչ սարքեմ…';
  let jobsPoll = null;
  async function jobsNow() { const { data, error } = await sb.rpc('app_builds'); if (error) throw new Error(error.message); return data || { items: [] }; }
  const jobsWaiting = (items) => (items || []).filter((j) => JOB_WAIT.includes(j.status) && j.status !== 'failed').length;
  async function jobsView() {
    lastTab = 'garik';
    clearTimeout(jobsPoll);
    let B = await jobsNow(), replyTo = null, busy = false;
    const steps = (j) => {
      const at = JOB_AT[j.status];
      return at == null ? '' : `<div class="jsteps">${JOB_STEPS.map((s, i) => `<span class="${i < at || (i === at && at === 4) ? 'ok' : i === at ? 'now' : ''}">${s}</span>`).join('')}</div>`;
    };
    const cardFields = (c) => c ? `<div class="jcard"><b class="jcard-h">Ահա ինչ հասկացա</b>${JOB_CARD.filter(([k]) => c[k] && String(c[k]).trim()).map(([k, l]) => `<div><b>${l}</b>${esc(noG(c[k]))}</div>`).join('')}</div>` : '';
    const card = (j) => {
      const tag = JOB_TAG[j.status];
      let body;
      switch (j.status) {
        case 'ask': body = `<p class="job-q">${esc(noG(j.question))}</p>${j.why_ask ? `<p class="act-w">Ինչու եմ հարցնում՝ ${esc(noG(j.why_ask))}</p>` : ''}`
          + `<div class="job-o">${(j.options || []).map((o, i) => `<button type="button" class="btn sm ${i ? 'gray' : 'pri'}" data-ans="${j.id}" data-v="${esc(o)}"><span>${esc(o)}</span>${i ? '' : '<small>խորհուրդ եմ տալիս</small>'}</button>`).join('')}<button type="button" class="btn plain sm" data-other="${j.id}">Այլ…</button></div>`
          + (j.left_n != null ? `<p class="job-left">${j.left_n > 0 ? `Մնաց ~${j.left_n} հարց` : 'Սա վերջին հարցն է'}</p>` : ''); break;
        case 'ready': body = (j.card ? cardFields(j.card) : `<p class="job-p">${esc(noG(j.plan))}</p>`) + `${j.zone ? `<p class="job-z">GTH-ի թիմն էլ կհաստատի՝ ${esc(j.zone_why || '')}</p>` : ''}<div class="act-b"><button type="button" class="btn pri sm" data-yes="${j.id}">Այո, արեք</button><button type="button" class="btn sm gray" data-edit="${j.id}">Փոխել</button><button type="button" class="btn plain sm" data-nojob="${j.id}">Ոչ</button></div>`; break;
        case 'preview': case 'held': body = `<p class="job-p">${esc(noG(j.preview || j.plan || ''))}</p><p class="job-n">${esc(noG(j.note || ''))}</p><div class="act-b"><button type="button" class="btn pri sm" data-go="${j.id}">Միացնել իսկապես</button>${j.status === 'preview' ? `<button type="button" class="btn sm gray" data-hold="${j.id}">Դեռ ոչ</button>` : ''}</div>`; break;
        case 'verify': body = `<p class="job-q">Մեկ շաբաթ է աշխատում. օգնե՞ց</p><div class="job-o"><button type="button" class="btn sm pri" data-vd="${j.id}" data-v="yes">Այո</button><button type="button" class="btn sm gray" data-vd="${j.id}" data-v="partly">Մասամբ</button><button type="button" class="btn sm gray" data-vd="${j.id}" data-v="no">Ոչ</button></div>`; break;
        case 'done': case 'verified': body = `<div class="act-s"><span class="pos">✓ ${esc(j.status === 'verified' ? VERDICT[j.verdict] || 'Ստուգված' : noG(j.note || 'Պատրաստ է'))}</span>${j.dry ? '' : `<button type="button" class="btn plain sm" data-undo="${j.id}">Հետ բերել</button>`}</div>`; break;
        case 'failed': body = `<div class="act-s"><span class="neg">${esc(noG(j.note || 'Չստացվեց'))}</span><button type="button" class="btn plain sm" data-again="${j.id}">Նորից</button></div>`; break;
        case 'rejected': case 'undone': body = `<div class="act-s"><span class="mut">${esc(noG(j.note || ''))}</span>${j.status === 'rejected' ? `<a class="btn plain sm" href="#/garik?ask=${encodeURIComponent(j.request)}">Հարցնել զրույցում</a>` : ''}<button type="button" class="btn plain sm" data-hide="${j.id}">Թաքցնել</button></div>`; break;
        default: body = `<p class="job-n${JOB_WORK.includes(j.status) ? ' typing' : ''}">${esc(noG(j.note || ''))}</p>`;
      }
      return `<div class="job ${j.status}${replyTo === j.id ? ' reply' : ''}"><div class="job-h"><span class="job-t">${esc(noG(j.title || j.request))}</span>${tag ? `<span class="tag ${tag[1]}">${tag[0]}</span>` : ''}</div>`
        + `${j.title ? `<p class="job-r">${esc(j.request)}</p>` : ''}${steps(j)}${body}</div>`;
    };
    const list = () => {
      const r = B.runner, off = !(r && r.seen_at && Date.now() - new Date(r.seen_at) < 5 * 60000);
      const items = B.items || [];
      const grp = (t, L) => L.length ? `<h4 class="jgrp">${t}<span>${L.length}</span></h4>${L.map(card).join('')}` : '';
      const wait = items.filter((j) => JOB_WAIT.includes(j.status)), done = items.filter((j) => ['done', 'verified', 'rejected', 'undone'].includes(j.status));
      const doing = items.filter((j) => !wait.includes(j) && !done.includes(j));
      return (off ? '<p class="job-off"><span class="dot off"></span>Համակարգիչը անջատված է. կսպասի</p>' : '')
        + (B.left_today === 0 ? '<p class="job-off"><span class="dot wait"></span>Այսօրվա 3 կառուցումն արված է. հաջորդը՝ վաղը</p>' : '')
        + (items.length ? grp('Սպասում է քեզ', wait) + grp('Անում եմ', doing) + grp('Պատրաստ', done)
          : emptyState(I.star, 'Ի՞նչ ավելացնենք', 'Գրիր ներքևում, ես կսարքեմ', `<div class="sugg">${JOB_EX.map((x) => `<button type="button" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>`));
    };
    const x = sv(18, '<path d="M6 6l12 12M18 6 6 18"/>', ' style="stroke-width:2.4"');
    const sc = mount({ title: 'GTH', tab: 'garik', compact: true, right: '',
      after: `<div class="job-to" id="jto" hidden></div><div class="composer"><textarea id="q" rows="1" placeholder="${JOB_PH}" enterkeyhint="send"></textarea><button class="mic" id="mic" type="button" aria-label="Խոսել">${I.mic}</button><button class="send" id="send" aria-label="Ուղարկել" disabled>${I.send}</button>${recRow()}</div>` },
      `${gsub('Նախագծեր')}<div class="jobs" id="jobs">${list()}</div>`);
    const q = document.getElementById('q'), send = document.getElementById('send'), jobsEl = document.getElementById('jobs'), jto = document.getElementById('jto');
    const grow = () => { q.style.height = 'auto'; q.style.height = Math.min(132, q.scrollHeight) + 'px'; send.disabled = !q.value.trim() || busy; };
    const paint = () => { jobsEl.innerHTML = list(); };
    // «Փոխել» / «Այլ պատասխան». գրածը գնում է այդ առաջադրանքին, ոչ թե նոր առաջադրանք
    const setReply = (id) => {
      replyTo = id;
      const j = (B.items || []).find((y) => y.id === id);
      jto.hidden = !id;
      jto.innerHTML = id ? `<span>Պատասխան՝ «${esc(noG(j ? j.title || j.request : ''))}»</span><button type="button" class="ibtn" id="jto-x" aria-label="Չեղարկել">${x}</button>` : '';
      q.placeholder = id ? 'Գրիր պատասխանը…' : JOB_PH;
      paint();
      if (id) q.focus();
    };
    jto.addEventListener('click', (e) => { if (e.target.closest('#jto-x')) setReply(null); });
    // զրույցի «+ → Նոր առաջադրանք»-ից (#/garik/jobs?new=1)՝ դաշտը պատրաստ է գրելու
    if (/[?&]new=1/.test(location.hash)) { history.replaceState(null, '', '#/garik/jobs'); setTimeout(() => q.focus(), 50); }
    const poll = () => {
      clearTimeout(jobsPoll);
      const working = (B.items || []).some((j) => JOB_WORK.includes(j.status));
      jobsPoll = setTimeout(async () => {
        if (!/^#\/garik\/jobs/.test(location.hash)) return;
        try { const n = await jobsNow(); const ch = JSON.stringify(n.items) !== JSON.stringify(B.items); B = n; if (ch) paint(); } catch (e) {}
        poll();
      }, working ? 5000 : 30000);
    };
    async function submit(text) {
      text = String(text || '').trim(); if (!text || busy) return;
      busy = true; grow();
      try {
        const { error } = replyTo ? await sb.rpc('app_build_reply', { p_id: replyTo, p_text: text }) : await sb.rpc('app_build_new', { p_text: text });
        if (error) throw new Error(error.message);
        q.value = ''; replyTo = null; jto.hidden = true; q.placeholder = JOB_PH;
        B = await jobsNow(); paint(); sc.scrollTop = 0;
      } catch (e) { alert('Չստացվեց՝ ' + e.message); }
      busy = false; grow(); poll();
    }
    jobsEl.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-ex]');
      if (ex) { q.value = ex.dataset.ex; grow(); q.focus(); return; }
      const b = e.target.closest('button[data-ans],button[data-other],button[data-yes],button[data-edit],button[data-nojob],button[data-undo],button[data-again],button[data-hide],button[data-go],button[data-hold],button[data-vd]');
      if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.other || d.edit) return setReply(+(d.other || d.edit));
      if (d.undo && !confirm('Հետ բերե՞լ, ինչպես էր։')) return;
      const box = b.closest('.job');
      box.querySelectorAll('button').forEach((y) => y.disabled = true);
      try {
        const r = d.ans ? await sb.rpc('app_build_reply', { p_id: +d.ans, p_text: d.v })
          : d.again ? await sb.rpc('app_build_reply', { p_id: +d.again, p_text: 'նորից' })
          : d.undo ? await sb.rpc('app_build_undo', { p_id: +d.undo })
          : d.hide ? await sb.rpc('app_build_hide', { p_id: +d.hide })
          : d.go || d.hold ? await sb.rpc('app_build_go', { p_id: +(d.go || d.hold), p_yes: !!d.go })
          : d.vd ? await sb.rpc('app_build_verdict', { p_id: +d.vd, p_v: d.v })
          : await sb.rpc('app_build_decide', { p_id: +(d.yes || d.nojob), p_yes: !!d.yes });
        if (r.error) throw new Error(r.error.message);
        B = await jobsNow(); paint(); poll();
      } catch (err) { box.querySelectorAll('button').forEach((y) => y.disabled = false); alert('Չստացվեց՝ ' + err.message); }
    });
    q.addEventListener('input', grow);
    send.onclick = () => submit(q.value);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(q.value); } });
    dictation(q, grow);
    poll();
  }

  // ───────── Կարգավորումներ ─────────
  // 04.11 (ԿԱ 5). ամեն տող՝ noG-ով (գործակալի անունը «Գարիկ» → GTH), անհայտ գործողությունները՝ հայերեն
  const logText = (l) => logText0({ ...l, agent: agentName(l.agent) }).map((x) => noG(x));
  const LOG_ACT = { tts: 'ձայն («Լսել»)', tool_error: 'գործիքի սխալ', tg_ask: 'հարց Telegram-ից', watch_cancel: 'անջատեցիր հսկողությունը', team_link: 'թիմի չատը միացավ',
    answer: 'թիմի պատասխան', go: 'միացրիր նախագիծը', held: 'նախագիծը պահվեց', verdict: '«Օգնե՞ց»-ի պատասխան', new: 'նոր նախագիծ', decide: 'նախագծի որոշում' };
  const logText0 = (l) => {
    const d = l.details || {};
    if (l.agent === 'fleet-sync' && l.action === 'sync') return ['Fleet · թարմացում', `+${d.orders?.n ?? 0} պատվեր, +${d.transactions?.n ?? 0} գործարք · ${Math.round((d.ms || 0) / 1000)} վրկ`];
    if (l.agent === 'fleet-sync' && l.action === 'error') return ['Fleet · սխալ', String(d.msg || '').slice(0, 90)];
    if (l.action === 'propose') return [`${l.agent} · նոր առաջարկ`, d.title || ''];
    if (l.agent === 'agents' && l.action === 'daily') return ['Առավոտյան ստուգում', `${Object.keys(d).length} խումբ ստուգվեց`];
    if (l.agent === 'agents' && l.action === 'skipped') return ['Առավոտյան ստուգում', 'Բաց թողնվեց. գործակալներն անջատված են'];
    if (l.action === 'chat') return ['GTH · զրույց', d.q || ''];
    if (l.agent === 'assistant') return ['GTH · միացում', d.ok === true || d.code === 0 ? 'պատրաստ է' : 'դեռ չի միացել'];
    if (l.action.startsWith('act_')) return [`Դու · ${{ act_done: 'GTH-ը արեց', act_reject: 'ասացիր «Ոչ»', act_failed: 'չստացվեց', act_undo: 'հետ բերեցիր' }[l.action] || l.action}`, d.title || ''];
    if (l.action === 'notice') return ['GTH · հիշեցում', ''];
    if (l.action === 'tg_link') return ['Դու · միացրիր Telegram-ը', d.name || ''];
    if (l.action === 'tg_unlink') return ['Դու · անջատեցիր Telegram-ը', ''];
    if (l.action === 'push_on') return ['Դու · միացրիր ծանուցումները', ''];
    if (l.action === 'push_off') return ['Դու · անջատեցիր ծանուցումները', ''];
    if (l.agent === 'owner-bot' && l.action === 'flush') return ['GTH · ծանուցում', `Telegram՝ ${d.sent || 0}, հեռախոս՝ ${d.pushed || 0}`];
    if (l.action === 'error') return [`${l.agent} · սխալ`, String(d.msg || '').slice(0, 90)];
    if (l.action.startsWith('task_')) return [`Դու · ${{ task_approve: 'հաստատեցիր', task_reject: 'մերժեցիր', task_undo: 'չեղարկեցիր' }[l.action] || l.action}`, d.title || ''];
    if (l.action === 'voice') return ['GTH · ձայնային մուտք', `${Math.round((d.ms || 0) / 1000)} վրկ · ${d.chars || 0} նիշ`];
    if (l.action === 'agents_off') return ['Գործակալները կանգնեցվեցին', ''];
    if (l.action === 'agents_on') return ['Գործակալները միացվեցին', ''];
    return [`${l.agent === 'builder' ? 'Նախագծեր' : l.agent === 'team' ? 'Թիմ' : l.agent} · ${LOG_ACT[l.action] || l.action}`, ''];
  };
  // Վարորդների ցուցակի (հաշվեկշիռ, գծում լինել) թարմությունը. Fleet-ը երբեմն մերժում է այդ հարցումը
  const driversLine = (n) => { if (!n) return ''; const ok = n.drivers_synced_at; if (n.drivers_error && (!ok || new Date(n.drivers_error.at) > new Date(ok))) return `Վարորդների ցուցակը՝ ${ok ? ago(ok) : 'չկա'}`; return ok ? `Վարորդների ցուցակը՝ ${ago(ok)}` : ''; };
  route('/settings', async () => {
    lastTab = 'settings';
    const [h, st, notes, logsR, usersR, agR, sessR, asR, brain, tgS, dvS] = await Promise.all([
      rpc('app_home'), garikState(), rpc('app_notes'),
      sb.from('agent_log').select('at,agent,action,details').order('id', { ascending: false }).limit(10),
      sb.from('app_users').select('email,role,name'),
      sb.from('sync_state').select('value').eq('key', 'agents').maybeSingle(),
      sb.auth.getSession(),
      // 05.11. ոչ app_assistant()-ը՝ այն նամակները «տեսած» է նշում (GTH կոճակի թիվը կմաքրվեր), այստեղ պետք է միայն պատասխանողի վիճակը
      sb.from('sync_state').select('value,updated_at').eq('key', 'assistant').maybeSingle().then((r) => (r.data ? { runner: { ...(r.data.value || {}), seen_at: r.data.updated_at } } : null), () => null),
      sb.rpc('app_brain').then((r) => r.data || [], () => []),
      sb.rpc('app_tg').then((r) => r.data || {}, () => ({})),
      rpc('app_dlv').catch(() => null),
    ]);
    const ps = await pushState();
    pendingCount = h.tasks_pending || 0;
    const agentsOn = !(agR.data && agR.data.value && agR.data.value.enabled === false);
    const session = sessR.data.session;
    const logs = (logsR.data || []).map((l) => { const [t, s] = logText(l); const sameDay = new Date(l.at).toDateString() === new Date().toDateString(); return cell({ t: esc(t), s: esc(s), v: `<span class="mut3" style="font-size:13px">${sameDay ? hm(l.at) : dmy(l.at)}</span>` }); });
    const users = (usersR.data || []).map((u) => cell({ t: esc(u.email), v: `<span class="tag ${u.role === 'owner' ? 'k' : 'n'}">${u.role === 'owner' ? 'տեր' : 'դիսպետչեր'}</span>` }));
    mount({ title: 'Կարգավորումներ', tab: 'settings' }, page(`
      ${sec('Այլ բաժիններ', group([
        cell({ href: '#/tasks', icon: I.tasks, color: 'y', t: 'Գործեր', s: 'Գործակալների բոլոր առաջարկները', v: pendingCount ? `<span class="tag warn">${pendingCount}</span>` : '' }),
        cell({ href: '#/quality', icon: I.quality, color: 'p', t: 'Որակ', s: 'Ավարտված և չեղարկված պատվերներ' }),
        cell({ href: '#/terms', icon: I.percent, color: 'r', t: 'Պայմաններ', s: 'Կոմիսիայի խմբեր, հաշվիչ' }),
      ], 'ic'))}
      ${sec('Գործակալներ', group([cell({ icon: I.star, color: 'k', t: 'Ավտոմատ առաջարկներ', s: 'Ամեն առավոտ 08:30', trail: `<label class="sw"><input type="checkbox" id="agents" ${agentsOn ? 'checked' : ''} aria-label="Գործակալները միացված են"><span></span></label>` })], 'ic'),
        { foot: 'Առանց քո «Այո»-ի ոչինչ չեն անում։' })}
      ${sec('Միացումներ', group([
        cell({ icon: I.car, color: 'y', t: 'Yandex Fleet · տաքսի', s: driversLine(notes), v: `<span class="tag pos">${ago(h.last_sync)}</span>` }),
        cell({ href: '#/delivery', icon: I.box, color: 't', t: 'Yandex Fleet · Delivery', s: dvS && dvS.connected ? `${fmt(dvS.working)} առաքիչ` : '',
          v: dvS && dvS.error ? '<span class="tag warn">սխալ</span>' : dvS && dvS.connected ? `<span class="tag pos">${ago(dvS.last_sync)}</span>`
            : `<span class="tag n">${dvS && dvS.key ? 'լցվում է' : 'միանում է'}</span>` }),
        cell({ icon: I.star, color: 'k', t: 'GTH · համակարգ', s: st.mode === 'pc' ? `HayWay-ի համակարգչից${asR && asR.runner && asR.runner.seen_at ? ` · ${ago(asR.runner.seen_at)}` : ''}` : '',
          v: !st.ok ? '<span class="tag warn">կապ չկա</span>' : st.mode !== 'pc' ? '<span class="tag pos">միացված</span>'
            : runnerOn(asR && asR.runner) ? '<span class="tag pos">միացված</span>' : '<span class="tag warn">անջատված</span>' }),
        cell({ icon: I.star, color: 'y', t: 'Ծանուցումներ այս հեռախոսում',
          s: ps.on ? '' : ps.denied ? 'Արգելված է հեռախոսում' : !ps.ok ? 'iPhone-ում՝ Home Screen-ից' : '',
          trail: ps.on ? '<button type="button" class="btn plain sm" data-pushoff>Անջատել</button>' : ps.ok && !ps.denied ? '<button type="button" class="btn pri sm" data-pushon>Միացնել</button>' : '' }),
        ...(tgS.username ? [cell({ icon: I.chat, color: 'b', t: 'Telegram · GTH-ի ծանուցումներ',
          s: tgS.linked ? `GTH բոտ${tgS.name ? ' · ' + esc(tgS.name) : ''}` : 'GTH բոտ',
          trail: tgS.linked ? '<button type="button" class="btn plain sm" data-tgunlink>Անջատել</button>' : '<button type="button" class="btn pri sm" data-tglink>Միացնել</button>' })] : []),
        cell({ href: '#/whatsapp', icon: I.chat, color: 'g', t: 'WhatsApp բոտ', s: '098 888 960 · SendPulse' }),
        cell({ icon: I.mega, color: 'o', t: 'list.am', v: '<span class="tag n">Կոմպ 2-ում</span>' }),
        cell({ icon: I.money, color: 'b', t: 'PrimeBridge', v: '<span class="tag n">շուտով</span>' }),
      ], 'ic'))}
      ${brain.length ? sec('Հիշում եմ', group(brain.map((b) => cell({ t: esc(noG(b.name ? b.name + '. ' + b.text : b.text)), s: dmy(b.at),
        trail: `<button type="button" class="btn plain sm" data-forget="${b.id}">Մոռանալ</button>` }))),
        { foot: 'Կարևորը հիշում եմ ինքս՝ զրույցներից։ Բոլորը՝ «Ինչ գիտեմ»-ում։' }) : ''}
      ${sec('Մուտք ունեն', group(users))}
      ${sec('Վերջին գործողությունները', group(logs.length ? logs : ['<p class="none">Դեռ ոչինչ</p>']))}
      ${sec('Գաղտնաբառ', `<div class="card">
        <p class="meta">Առնվազն 8 նիշ։</p>
        <input id="newpw" class="in" type="password" autocomplete="new-password" placeholder="Նոր գաղտնաբառ">
        <button class="btn dark full" id="setpw">Պահել գաղտնաբառը</button>
        <p id="pwmsg" class="meta"></p>
      </div>`)}
      ${sec('', group([`<button class="cell" id="signout" style="justify-content:center"><span class="t neg" style="text-align:center">Դուրս գալ</span></button>`]), { foot: esc(session?.user?.email || '') })}
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
      if (!want && !confirm('Կանգնեցնե՞լ գործակալներին։')) { e.target.checked = true; return; }
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
      m.textContent = error ? 'Սխալ՝ ' + error.message : 'Պահված է։';
      if (!error) document.getElementById('newpw').value = '';
    };
  });

  // ───────── Դեռ չմիացված բաժիններ ─────────
  const SOON = {
    marketing: ['Մարքեթինգ', I.mega, 'Ալիքներ և արշավներ։'],
    leads: ['Հայտեր', I.userplus, 'Հայտից մինչև 50-րդ պատվեր։'],
    contact: ['Կապ', I.chat, 'Հայտարարություններ և նամակներ։'],
  };

  // ───────── Առաքում (HayWay Delivery, db\0026). 03.11, Գարիկ. «HayWay Delivery բաժինը միացնենք հավելվածին» ─────────
  // Նույն եկամտի վահանակը, ինչ Գլխավորում (ժամկետներ, օրեր, աղյուսակ) + առաքիչների 3 թիվ
  const DLV = [['delivery', 'Եկամուտ']];
  route('/delivery', async () => {
    lastTab = 'sections';
    const [h, c, ds] = await Promise.all([rpc('app_home'), rpc('app_dlv'), dashLoad(DLV)]);
    pendingCount = h.tasks_pending || 0;
    const back = ['#/sections', 'Բաժիններ'];
    if (!c.connected) {
      mount({ title: 'Առաքում', tab: 'sections', back, sub: '<span class="dot wait"></span>միանում է' },
        page(emptyState(I.box, 'Միանում է', c.key ? 'Առաջին թվերը՝ շուտով։' : 'Fleet-ի բանալին ստեղծվում է։')));
      return;
    }
    const pseg = `<div class="seg pseg">${PERIODS.map(([k, l]) => `<button type="button" data-period="${k}" class="${k === period ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    mount({ title: 'Առաքում', tab: 'sections', back, sub: c.error ? '<span class="dot wait"></span>թարմացումը ձախողվեց' : `HayWay Delivery · թարմ՝ ${ago(c.last_sync)}` }, page(`
      ${pseg}
      <div id="dash">${dashHtml(ds, DLV)}</div>
      ${sec('Առաքիչներ', `<div class="kpis">
        ${kpi('Հիմա գծում', fmt(c.online), '')}
        ${kpi('Աշխատել են · 7 օր', fmt(c.active7), '')}
        ${kpi('Աշխատող պրոֆիլ', fmt(c.working), '')}
      </div>`)}
    `));
    bindDashAll(ds, DLV);
  });
  Object.keys(SOON).forEach((k) => route('/' + k, async () => {
    lastTab = 'sections';
    const h = await rpc('app_home');
    pendingCount = h.tasks_pending || 0;
    const [t, ic, txt] = SOON[k];
    mount({ title: t, tab: 'sections', back: ['#/sections', 'Բաժիններ'], sub: '<span class="dot wait"></span>շուտով' },
      page(emptyState(ic, 'Շուտով', txt, '<a class="btn dark" href="#/garik">Հարցնել GTH-ին</a>')));
  }));

  // ───────── Սկիզբ ─────────
  window.HW = { sb, rpc, render, invalidate, cache, DOCK, I, todayLong, pending: () => pendingCount, unread: () => unreadCount, unreadPull };   // DOCK…pending՝ desktop.js-ի մենյուի համար (03.11)
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
})();
