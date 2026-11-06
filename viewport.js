/* HayWay — էկրանի բարձրությունը և ստեղնաշարը (06.11, Գարիկի նկարով. «այլ iPhone-ում ներքևի տողը օդում է»)։
   Սխալը. էկրանի բարձրությունը վերցնում էինք միայն visualViewport-ից։ iOS 26-ի հավելվածում (Home Screen, black-translucent)
   iPhone-ը երբեմն տալիս է ~60pt ՊԱԿԱՍ բարձրություն (կարծես կարգավիճակի տողը հանած), և ներքևի տողը (.dock) կանգնում է օդում,
   տակը՝ դատարկ։ Ստեղնաշարը փակելուց հետո էլ է այդպես մնում։
   Կանոնը. ստեղնաշարի բարձրությունը (visualViewport) օգտագործվում է ՄԻԱՅՆ երբ իսկապես գրում են (դաշտ է ընտրված),
   մնացած դեպքում՝ ամբողջ էկրանը, iPhone-ի հավելվածում ուղղաձիգ դիրքում՝ ոչ պակաս, քան screen.height։
   Կիսում են app.js-ը և team/page.js-ը. --vvh, --vv-top, body.kb (styles.css)։ */
(function () {
  'use strict';
  const root = document.documentElement;
  const ua = navigator.userAgent;
  const iPhoneApp = /iPhone|iPod/.test(ua) && (navigator.standalone === true || matchMedia('(display-mode: standalone)').matches);
  const meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  const underStatusBar = !!meta && meta.content === 'black-translucent';

  function typing() {
    const a = document.activeElement;
    return !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && !/^(button|checkbox|radio|range|file|submit|reset|color)$/.test(a.type || '');
  }
  function fullHeight() {
    const v = window.visualViewport;
    let h = Math.max(window.innerHeight || 0, root.clientHeight || 0, v ? v.height : 0);
    // iOS-ի հավելվածը ուղղաձիգ դիրքում միշտ ծածկում է ամբողջ էկրանը (viewport-fit=cover + black-translucent)
    if (iPhoneApp && underStatusBar && matchMedia('(orientation: portrait)').matches && screen.height > h) h = screen.height;
    return h;
  }
  function sync() {
    const v = window.visualViewport;
    const full = fullHeight();
    const kb = !!v && typing() && full - v.height > 120;
    root.style.setProperty('--vvh', Math.round(kb ? v.height : full) + 'px');
    root.style.setProperty('--vv-top', (kb ? Math.max(0, v.offsetTop) : 0) + 'px');
    if (document.body) document.body.classList.toggle('kb', kb);
  }
  // iPhone-ը չափերը ուշ է ճշտում՝ մի քանի անգամ էլ ենք նայում
  function settle() { sync(); setTimeout(sync, 60); setTimeout(sync, 350); setTimeout(sync, 1000); }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', sync);
    window.visualViewport.addEventListener('scroll', sync);
  }
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', settle);
  window.addEventListener('pageshow', settle);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) settle(); });
  document.addEventListener('focusin', () => setTimeout(sync, 50));
  document.addEventListener('focusout', () => setTimeout(() => { if (!typing()) window.scrollTo(0, 0); settle(); }, 150));
  window.HWViewport = { sync, settle };
  settle();
})();
