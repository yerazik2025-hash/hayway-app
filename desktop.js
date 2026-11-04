/* HayWay · հավելվածը համակարգչով (03.11.2026, Գարիկ. «Երազը նույնը տեսնի նաև համակարգչով, ինչպես Դավիթինը»՝ aromatika a5e2f52-ի ձևով)։
   Աշխատում է ՄԻԱՅՆ ≥ 1024px էկրանին ու մկնիկով (hover + pointer:fine). touch iPad-ը, նույնիսկ լայն, մնում է հեռախոսի տեսքով։
   Այդ դեպքում ներքևի շարքը դառնում է ձախ մենյու (#dkSide), էջերը՝ լայն (desktop.css), իսկ GTH-ը (Գարիկ) բացվում է աջում՝ թվերի կողքին.
   դա նույն հավելվածի GTH էջն է iframe-ում (#dkGth), այսինքն զրույցը, «Այո»-ի քարտերն ու հարցի հերթը նույն կոդն են, ինչ հեռախոսում։
   GTH-ը ինքն է բաց (Երազը փակեց՝ փակ է մնում). Ctrl+K (Mac-ում ⌘K) կամ «/»՝ GTH-ի գրելու դաշտը, Esc՝ փակել։
   Հեռախոսում այստեղ ոչինչ չի աշխատում. ոչ մենյու, ոչ class, ոչ ունկնդիր։ app.js-ից՝ HW.DOCK / HW.I / HW.pending() / HW.todayLong
   (նույն բաժինները, նույն պատկերակները) և render()-ի մեկ տող՝ HWD.route(seg)։ */
(() => {
  'use strict';
  const MQ = matchMedia('screen and (min-width:1024px) and (hover:hover) and (pointer:fine)');   // նույնը, ինչ index.html-ում ու desktop.css-ում
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const segOf = (h) => ((h || '#/').slice(1).split('?')[0].split('/')[1]) || '';
  const argOf = (h) => ((h || '#/').slice(1).split('?')[0].split('/')[2]) || '';
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform || '') || /Mac OS X/.test(navigator.userAgent);
  const KEY = MAC ? '⌘K' : 'Ctrl K';
  const isKey = (e) => e.code === 'KeyK' && (MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) && !e.altKey && !e.shiftKey;
  const parentHWD = () => { try { return window.parent !== window && window.parent.HWD && window.parent.HWD.panel ? window.parent.HWD : null; } catch (e) { return null; } };
  const SRC = (document.currentScript && document.currentScript.src) || 'desktop.js';
  // Մեծ էջն ու GTH-ի պատուհանը նույն մուտքն են կիսում. երբ մեկը բացվում է, մյուսին «SIGNED_IN» է հասնում, ու app.js-ը ամբողջ էջը
  // նորից կգծեր (ոլորումն ու կիսատ գրածը կկորչեին)։ Արդեն մուտք արած էջում այդ ուրիշից եկած լուրը բաց ենք թողնում. սեփականը, դուրս գալը՝ ոչ։
  function quietAuth() {
    try {
      const au = window.HW.sb.auth, f = au && au._notifyAllSubscribers, app = document.getElementById('app');
      if (typeof f !== 'function' || f._hw) return;
      const g = function (ev, ses, broadcast) {
        if (ev === 'SIGNED_IN' && broadcast === false && app && app.querySelector('.top')) return Promise.resolve();
        return f.apply(this, arguments);
      };
      g._hw = true; au._notifyAllSubscribers = g;
    } catch (e) {}
  }

  // ───────── GTH-ի պատուհանի ներսում (iframe). միայն զրույցը; ուրիշ բաժնի հղումը բացվում է ձախում՝ մեծ էջում ─────────
  const P = parentHWD();
  if (P) {
    if (window.HWD) return;   // արդեն միացված է (index.html-ից կամ մեծ էջից)
    root.classList.add('in-panel');
    quietAuth();
    const st = document.createElement('style');
    // «‹ Հետ»-ի փոխարեն՝ ×, որ փակի պատուհանը (նույն կոճակը, նույն տեղը)
    st.textContent = `html.in-panel .chat-top .backb{width:44px;padding:0;justify-content:center;color:var(--text2)}
      html.in-panel .chat-top .backb>*{display:none}
      html.in-panel .chat-top .backb::before{content:"";width:22px;height:22px;background:currentColor;-webkit-mask:var(--x) center/contain no-repeat;mask:var(--x) center/contain no-repeat;
        --x:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round'%3E%3Cpath d='M6 6l12 12M18 6 6 18'/%3E%3C/svg%3E")}
      html.in-panel .msg{max-width:92%}
      html.in-panel :is(a,button,label){cursor:pointer}
      @media (hover:hover){html.in-panel :is(.backb,.ibtn,a.cell,button.cell,.sugg button):hover{background:var(--fill)}
        html.in-panel .btn:not(:disabled):hover{filter:brightness(1.12)}}`;
    document.head.appendChild(st);
    window.HWD = {
      // app.js render(). այստեղ միշտ GTH-ն է. ուրիշ բաժինը բացվում է մեծ էջում, իսկ այստեղ զրույցը մնում է
      route(seg) {
        if (seg === 'garik') return false;
        const h = location.hash;
        history.replaceState(null, '', '#/garik');
        P.go(h);
        return true;
      }
    };
    addEventListener('click', (e) => {
      if (!e.target.closest) return;
      if (e.target.closest('.chat-top .backb, .chat-top .gclose')) { e.preventDefault(); e.stopImmediatePropagation(); P.close(); return; }
      const a = e.target.closest('a[href^="#/"]');
      if (a && segOf(a.getAttribute('href')) !== 'garik') { e.preventDefault(); e.stopImmediatePropagation(); P.go(a.getAttribute('href')); }
    }, true);
    addEventListener('keydown', (e) => {
      if (isKey(e) || (e.key === 'Escape' && !e.isComposing)) { e.preventDefault(); P.close(); }
    }, true);
    // զրույցը նորից գծվելիս (բացելիս, թարմացնելիս) գրելու դաշտը պատրաստ է՝ եթե Երազը հենց հիմա այստեղ է
    const app = document.getElementById('app');
    if (app) new MutationObserver(() => {
      const q = document.getElementById('q');
      if (q && document.activeElement !== q && P.wantsFocus()) try { q.focus({ preventScroll: true }); } catch (e) {}
    }).observe(app, { childList: true });
    // ծանուցման սեղմումը կարող է գալ հենց այս պատուհանին. բացել ճիշտ տեղում
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.go) { if (segOf(e.data.go) === 'garik') P.open(e.data.go); else P.go(e.data.go); } });
    return;
  }

  // ───────── Մեծ պատուհանը ─────────
  const A = () => window.HW;
  const on = () => MQ.matches && !!A();
  const PARENT = { quality: 'settings', terms: 'settings', tasks: 'garik' };   // ներքևում չեղած էջերը լուսավորում են իրենց «ծնողին» (app.js SUB)
  const S = { open: false, loaded: false, lastMain: segOf(location.hash) === 'garik' ? '#/' : (location.hash || '#/'), seen: false };
  let side = null, panel = null, frame = null, tip = null, wired = false;
  const app = $('#app');

  function build() {
    if (side || !on()) return;
    const H = A(), I = H.I || {};
    const row = (k, ic, l) => `<a class="dk-item" href="#/${k}" data-k="${k}" data-tip="${l}" draggable="false">${ic || ''}<span class="dk-l">${l}</span></a>`;
    side = document.createElement('aside');
    side.id = 'dkSide'; side.setAttribute('aria-label', 'Բաժիններ');
    side.innerHTML = `<a class="dk-brand" href="#/" data-tip="HayWay" draggable="false"><img src="icon.svg?v=9" width="34" height="34" alt=""><span class="dk-l"><b>HayWay</b><small><i></i><span class="dk-date"></span></small></span></a>
      <button type="button" class="dk-gth" data-tip="GTH օգնական · ${KEY}" aria-keyshortcuts="${MAC ? 'Meta+K' : 'Control+K'}" aria-label="GTH օգնական">
        <span class="dk-logo"><img src="GTH-AGENCY-logo-SAFE.svg" width="46" height="24" alt="GTH logo"></span><span class="dk-l"><b>GTH</b><small>օգնական</small></span><span class="dk-badge" hidden></span><kbd>${KEY}</kbd></button>
      <nav class="dk-nav"><div class="dk-cap">Բաժիններ</div>${(H.DOCK || []).map((d) => row(d[0], d[1], d[2])).join('')}
        <div class="dk-cap">Ավելին</div>${row('sections', I.grid, 'Բոլոր բաժինները')}${row('settings', I.cfg, 'Կարգավորում')}</nav>`;
    document.body.insertBefore(side, app);
    $('.dk-gth', side).addEventListener('click', () => (S.open ? close() : open()));
    paint();
  }
  function teardown() {
    tipOff();
    if (side) side.remove(); side = null;
    if (S.open) close(true);
    root.classList.remove('dk', 'dk-in', 'dk-ai');
    delete root.dataset.dkTab; delete root.dataset.dkArg;
  }

  // ընտրված բաժինը, GTH-ի թիվը, ամսաթիվը. ամեն էկրանից հետո (թարմացնում է միայն փոխվածը)
  function paint() {
    if (!side) return;
    const h = location.hash || '#/', s = segOf(h), cur = PARENT[s] || s, arg = argOf(h);
    root.dataset.dkTab = cur || 'home';
    if (arg) root.dataset.dkArg = arg; else delete root.dataset.dkArg;
    side.querySelectorAll('.dk-item').forEach((a) => {
      const o = a.dataset.k === cur;
      if (a.classList.contains('on') !== o) { a.classList.toggle('on', o); if (o) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
    });
    const n = (A().pending && A().pending()) || 0, b = $('.dk-gth .dk-badge', side), txt = n > 99 ? '99+' : String(n);
    if (b.hidden !== !n) b.hidden = !n;
    if (n && b.textContent !== txt) b.textContent = txt;
    $('.dk-gth', side).classList.toggle('on', S.open || cur === 'garik');
    const d = $('.dk-date', side), t = A().todayLong ? A().todayLong() : '';
    if (d.textContent !== t) d.textContent = t;
  }
  // մենյուն միայն մուտքից հետո (մուտքի էկրանը մնում է նույնը, ինչ հեռախոսում)
  function inState() {
    if (!app) return;
    const was = S.seen;
    if (app.querySelector('.login')) S.seen = false;
    else if (app.querySelector('.top')) S.seen = true;
    root.classList.toggle('dk-in', S.seen);
    if (!S.seen && S.open) close(true);
    if (S.seen && !was) autoOpen();
  }
  // Գարիկ 03.11. «ինչու AI օգնականը չի երևում» → համակարգչում GTH-ը ինքն է բաց աջում;
  // Երազը փակեց՝ հաջորդ անգամ էլ փակ է մնում (միայն այս բրաուզերում), բացեց՝ բաց
  const PREF = 'hw_gth';
  const pref = (v) => { try { if (v === undefined) return localStorage.getItem(PREF) || ''; localStorage.setItem(PREF, v); } catch (e) {} return ''; };
  function autoOpen() { if (!S.open && on() && S.seen && pref() !== '0') open('', true); }

  // ───────── GTH-ը աջում ─────────
  const base = () => location.href.split('#')[0];
  function makePanel(h) {
    panel = document.createElement('aside');
    panel.id = 'dkGth'; panel.setAttribute('aria-label', 'GTH օգնական'); panel.hidden = true;
    frame = document.createElement('iframe');
    frame.title = 'GTH օգնական';
    frame.addEventListener('load', () => {
      S.loaded = true;
      // հին պահված index.html (առանց desktop.js-ի). միացնել այստեղից, որ «×»-ն ու հղումները ճիշտ աշխատեն
      try { const d = frame.contentDocument; if (!frame.contentWindow.HWD) { const s = d.createElement('script'); s.src = SRC; d.body.appendChild(s); } } catch (e) {}
      focusQ();
    }, { once: true });
    frame.src = base() + (h || '#/garik');
    panel.appendChild(frame);
    document.body.appendChild(panel);
  }
  // գրելու դաշտը՝ պատրաստ (էջը տվյալները բերում է մի քանի վայրկյանում)
  function focusQ(tries = 16) {
    if (!S.open || !frame || S.quiet) return;   // ինքը բացվելիս՝ գրելու դաշտը չի «խլում» ստեղնաշարը
    try {
      const q = frame.contentWindow.document.getElementById('q');
      if (q) { frame.focus(); q.focus({ preventScroll: true }); return; }
    } catch (e) { return; }
    if (tries > 0) setTimeout(() => focusQ(tries - 1), 250);
  }
  function open(h, auto) {
    if (!on() || !S.seen) { location.hash = h || '#/garik'; return; }
    S.quiet = !!auto;
    if (!auto) pref('1');
    const ask = h && h !== '#/garik' ? h : '';
    if (!panel) makePanel(ask);
    else if (S.loaded) {
      try {
        const w = frame.contentWindow, q = w.document.getElementById('q');
        if (ask) w.location.hash = ask;
        else if (!S.open && !(q && q.value.trim())) { w.HW.invalidate(); w.HW.render(); }   // նորից բացելիս՝ թարմ (կիսատ գրածը չի կորչում)
      } catch (e) {}
    }
    if (!auto) S.openedAt = Date.now();
    if (!S.open) { S.open = true; panel.hidden = false; root.classList.add('dk-ai'); }
    paint(); focusQ();
  }
  function close(auto) {
    if (!S.open) return;
    S.open = false; S.quiet = false;
    if (auto !== true) pref('0');
    if (panel) panel.hidden = true;
    root.classList.remove('dk-ai');
    try { A().invalidate(); } catch (e) {}   // «Այո»-ից հետո թվերը նորից բերվեն
    paint();
    const g = side && $('.dk-gth', side);
    if (g) try { g.focus({ preventScroll: true }); } catch (e) {}
  }

  window.HWD = {
    panel: true,
    // app.js render()-ի առաջին քայլը. համակարգչում #/garik-ը բացում է աջ պատուհանը, իսկ մեծ էջը մնում է տեղում
    route(seg) {
      if (seg !== 'garik') { S.lastMain = location.hash || '#/'; return false; }
      if (!on()) return false;
      if (!S.seen) { S.seen = true; build(); root.classList.add('dk-in'); }   // render()-ը այստեղ է հասնում միայն մուտքից հետո
      const h = location.hash;
      history.replaceState(null, '', S.lastMain);
      open(h);
      if (!(app && app.querySelector('.top'))) setTimeout(() => A().render());   // ուղիղ #/garik-ով բացելիս՝ ետևում Այսօրը
      return true;
    },
    go(h) { if (location.hash === h) A().render(); else location.hash = h; },
    // նոր բացված (6 վրկ) կամ Երազը արդեն պատուհանի ներսում է
    wantsFocus() { return S.open && (Date.now() - S.openedAt < 6000 || document.activeElement === frame); },
    open, close
  };

  function wire() {
    if (wired) return;
    wired = true;
    if (app) new MutationObserver(() => { if (!on()) return; inState(); paint(); fixChat(); }).observe(app, { childList: true });
    addEventListener('hashchange', () => { if (on()) paint(); });
    addEventListener('keydown', (e) => {
      if (!on() || !S.seen) return;
      const a = document.activeElement, typing = !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
      // GTH-ը արդեն բաց է (ինքն է բացվել)՝ Ctrl+K / «/» տանում են նրա գրելու դաշտը; փակել՝ նրա ներսից Ctrl+K, Esc կամ ×
      if (isKey(e)) { e.preventDefault(); if (!e.repeat) open(); return; }
      if ((e.key === '/' || (e.code === 'Slash' && !e.shiftKey)) && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); open(); return; }
      if (e.key === 'Escape' && !e.isComposing && S.open) { e.preventDefault(); close(); }
    }, true);
    // ծալված մենյուն (GTH-ը բաց է, էկրանը՝ փոքր) ցույց է տալիս միայն պատկերակները. անունը՝ մկնիկը վրան պահելիս
    const tipOn = (e) => {
      const b = on() && side && side.offsetWidth < 120 && e.target.closest && e.target.closest('#dkSide [data-tip]');
      if (!b) return tipOff();
      const r = b.getBoundingClientRect();
      if (!tip) { tip = document.createElement('div'); tip.id = 'dkTip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
      tip.textContent = b.dataset.tip; tip.style.left = Math.round(r.right + 10) + 'px'; tip.style.top = Math.round(r.top + r.height / 2) + 'px';
    };
    addEventListener('mouseover', tipOn, true); addEventListener('focusin', tipOn, true);
    addEventListener('mouseout', (e) => { if (tip && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#dkSide [data-tip]'))) tipOff(); }, true);
    addEventListener('click', tipOff, true);
  }
  function tipOff() { if (tip) { tip.remove(); tip = null; } }

  // պատուհանը մեծանում է կամ նեղանում. փոխվում է միայն շրջանակը, էջը նորից չի գծվում
  function sync() {
    if (!on()) return teardown();
    wire(); quietAuth(); root.classList.add('dk'); build(); inState(); paint(); fixChat();
  }
  // GTH-ի էջը հայտնվեց մեծ էջում (ուղիղ #/garik-ով բացելիս app.js-ը հասցրեց գծել մինչև այս ֆայլը, կամ պատուհանը հենց հիմա լայնացավ). տեղափոխել աջ
  function fixChat() {
    if (!on() || segOf(location.hash) !== 'garik' || !(app && app.querySelector('.chat-top'))) return;
    const h = location.hash;
    if (!S.seen) { S.seen = true; root.classList.add('dk-in'); }
    history.replaceState(null, '', S.lastMain);
    open(h); A().render();
  }
  if (MQ.addEventListener) MQ.addEventListener('change', sync); else if (MQ.addListener) MQ.addListener(sync);
  sync();
})();
