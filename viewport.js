/* HayWay — էկրանի բարձրությունը և ստեղնաշարը (06.11, Գարիկի նկարով. «այլ iPhone-ում ներքևի տողը օդում է»)։
   Սխալը. iOS 26-ի գլխավոր էկրանի հավելվածում WebKit-ը բացվելիս viewport-ը կարճ է չափում (~60–110pt), իսկ մենք բարձրությունը
   վերցնում էինք visualViewport-ից և .app-ը fixed էր → ներքևի տողը (.dock) կանգնում էր օդում, տակը՝ դատարկ։
   WebKit-ը fixed բովանդակությունը այդ սխալ ներքևից ցածր ՉԻ նկարում, ուստի պետք է absolute։
   Լուծումը՝ մեր ստուգված «vfix» ձևը (gth.robi.am / lead-agent / АРОМАТИКА, հիշողություն reference_ios_pwa_bottom_bar_fix).
   standalone + ուղղաձիգ + black-translucent + ստեղնաշարը փակ → html.vfix, --vh = max(screen.height, innerHeight, vv.height),
   html/body/.app այդ բարձրությամբ, .app՝ absolute; home indicator-ի տեղը՝ --sabx 34px, երբ env(safe-area)-ը 0 է։
   Ստեղնաշարը բաց → vfix-ը հանվում է, .app-ը հետևում է visualViewport-ին (--vvh, --vv-top, body.kb)։
   Կիսում են app.js-ը և team/page.js-ը։ */
(function () {
  'use strict';
  const root = document.documentElement;
  const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  const underStatusBar = !!meta && meta.content === 'black-translucent'; // «default»-ով screen.height-ը մեծ է տեսանելիից (agency.robi.am 29.10)
  const PB = document.createElement('div');
  PB.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
  // 06.11 Գարիկի iPhone (17:10 նկար). meta-ն black-translucent է, բայց iOS-ը ժամի գոտին հավելվածից ԴՈՒՐՍ է պահում (top = 0, bottom = 34) →
  // screen.height-ը ~60pt մեծ է տեսանելիից ու vfix-ը ներքևի տողը իջեցնում էր էկրանից ցած (գրությունները կտրված)։ АРОМАТИКА 23.10-ի նույն դեպքը։
  // Իսկ iOS-ի սխալ վիճակում bottom-ը 0 է կարդում, ուստի այդ ուղղումը չի խախտվում։
  function sbOut() {
    if (!PB.isConnected) return false;
    const cs = getComputedStyle(PB);
    return parseFloat(cs.paddingTop) < 20 && parseFloat(cs.paddingBottom) >= 28;
  }

  function typing() {
    const a = document.activeElement;
    return !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && !/^(button|checkbox|radio|range|file|submit|reset|color)$/.test(a.type || '');
  }
  function sync() {
    if (!PB.isConnected && document.body) document.body.appendChild(PB);
    const v = window.visualViewport;
    const vh = v ? Math.round(v.height) : 0;
    const H = Math.max(window.innerHeight || 0, vh);
    const portrait = (screen.height || 0) > (screen.width || 0);
    const big = Math.max(H, portrait ? screen.height || 0 : 0);
    const kb = !!v && typing() && vh < big - 120;
    const fix = !kb && underStatusBar && !sbOut() && portrait && standalone() && big > 0;
    root.classList.toggle('vfix', fix);
    if (fix) {
      root.style.setProperty('--vh', big + 'px');
      const noSafe = PB.isConnected && parseFloat(getComputedStyle(PB).paddingBottom) === 0;
      root.style.setProperty('--sabx', (noSafe && screen.height >= 812 ? 34 : 0) + 'px');
    } else { root.style.removeProperty('--vh'); root.style.removeProperty('--sabx'); }
    // fixed ռեժիմ (Safari ներդիր, համակարգիչ, ստեղնաշար բաց)
    root.style.setProperty('--vvh', (kb ? vh : H) + 'px');
    root.style.setProperty('--vv-top', (kb ? Math.max(0, Math.round(v.offsetTop)) : 0) + 'px');
    if (document.body) document.body.classList.toggle('kb', kb);
  }
  // iPhone-ը չափերը ուշ է ճշտում՝ մի քանի անգամ էլ ենք նայում
  function settle() { sync(); setTimeout(sync, 300); setTimeout(sync, 1500); }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', sync);
    window.visualViewport.addEventListener('scroll', sync);
  }
  window.addEventListener('resize', sync);
  window.addEventListener('pageshow', settle);
  window.addEventListener('orientationchange', () => setTimeout(settle, 300));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) settle(); });
  document.addEventListener('touchstart', () => setTimeout(sync, 350), { passive: true });
  document.addEventListener('focusin', () => setTimeout(sync, 300));
  document.addEventListener('focusout', () => setTimeout(() => { if (!typing()) window.scrollTo(0, 0); settle(); }, 150));
  window.HWViewport = { sync, settle };
  settle();
})();
