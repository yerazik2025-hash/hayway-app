// «Թիմ»-ի զրույցը (2026-11-05, db\0036. Գարիկ. «հայվեյի համարել ստեղծի նույն կերպ թիմի բաժին և մեկ հավելվածել իր աշխատակցի համար»)։
// Նույն կոդը՝ տիրոջ հավելվածում (#/team/<փոստ>, app.js) և աշխատակցի team/ էջում։ GTH-ի նմուշը՝ ai-biznes/app public/v2/sc/։
// Տեսքը՝ WhatsApp iOS-ի պես (Գարիկ 05.11, ԿԱ 6). վերևում ‹ + կլոր նկար + անուն + փոքր տող (առանց զանգի/վիդեոյի), բեժ ֆոն,
// իմը՝ աջում բաց կանաչ + ժամ + ✓✓ (կապույտ՝ երբ կարդացել է), նրանը՝ ձախում սպիտակ «պոչով», օրվա պիտակ, ներքևում կլոր դաշտ + կանաչ սլաք։
// Ամեն 4 վրկ՝ նորերը (team_thread p_after). բացելը = կարդալը (սերվերը նշում է)։ Ուղարկելը՝ team_send. ծանուցումը՝ owner-bot-ը (մեկ ալիքին՝ մեկ)։
// 06.11 (db\0037, ԿԱ 6 = GTH-ի Աննայի լոգիկան). տիրոջ նամակը աշխատակիցը ՉԻ տեսնում («միայն դու»), համակարգն է բացատրում (who 'ai').
// Տերը տեսնում է նաև համակարգի բացատրությունը աշխատակցին («Համակարգը → Արամ»), համակարգի նոթերը իրեն և գործերի քարտերը։
// «⋯»՝ տիրոջը «Ի՞նչ վիճակ է» + բաց գործեր, աշխատակցին՝ բաց գործեր («Արեցի»)։
window.HWTeam = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yv = (at) => new Date(new Date(at).getTime() + 4 * 3600e3);   // Երևան
  const hm = (at) => { const d = yv(at); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
  const MON = ['հունվարի', 'փետրվարի', 'մարտի', 'ապրիլի', 'մայիսի', 'հունիսի', 'հուլիսի', 'օգոստոսի', 'սեպտեմբերի', 'հոկտեմբերի', 'նոյեմբերի', 'դեկտեմբերի'];
  const dayKey = (at) => yv(at).toISOString().slice(0, 10);
  const dayLabel = (at) => {
    const k = dayKey(at), today = dayKey(new Date()), y = dayKey(new Date(Date.now() - 864e5));
    if (k === today) return 'Այսօր';
    if (k === y) return 'Երեկ';
    const d = yv(at); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
  };
  // ցուցակի ժամը. այսօր՝ ժամ, երեկ՝ «Երեկ», ավելի հին՝ օր.ամիս
  const listTime = (at) => { if (!at) return ''; const l = dayLabel(at); if (l === 'Այսօր') return hm(at); if (l === 'Երեկ') return l; const d = yv(at); return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
  const sv = (w, body, extra = '') => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>${body}</svg>`;
  const IC = {
    back: sv(28, '<path d="m15 5-7 7 7 7"/>', ' stroke-width="2.4"'),
    send: sv(22, '<path d="M4 12 20 4l-4 16-4-7z"/><path d="m12 13 8-9"/>', ' stroke-width="2.2"'),
    search: sv(18, '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    more: sv(24, '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>', ' stroke-width="2.4"'),
  };
  const MONS = ['հունվ', 'փետր', 'մարտ', 'ապր', 'մայ', 'հուն', 'հուլ', 'օգոս', 'սեպտ', 'հոկտ', 'նոյ', 'դեկտ'];
  const dueL = (d) => {
    if (!d) return '';
    const x = new Date(d + 'T00:00:00Z'), t = dayKey(new Date()), tm = dayKey(new Date(Date.now() + 864e5));
    return d === t ? 'այսօր' : d === tm ? 'վաղը' : x.getUTCDate() + ' ' + MONS[x.getUTCMonth()];
  };
  // ✓✓. կապույտ՝ երբ մյուսը կարդացել է
  const ticks = (read) => `<svg class="wa-tick${read ? ' read' : ''}" width="17" height="11" viewBox="0 0 17 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6l3 3 6-7"/><path d="M7 9l1 0 6-7"/></svg>`;
  // կլոր նկար. ընկերության պատկերակը (img)՝ իր ձևով, առանց կտրելու, մարդունը՝ առաջին տառը
  const avatar = (a, size) => a && a.img ? `<span class="wa-av img" style="width:${size}px;height:${size}px"><img src="${esc(a.img)}" width="${size}" height="${size}" alt=""></span>`
    : `<span class="wa-av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px">${esc(((a && a.name) || '?').trim().charAt(0).toUpperCase())}</span>`;

  // զրույցի էկրանի կմախքը. o: { back: href կամ null (կոճակ #wa-back), name, status, av: {img|name}, label } (դաշտում գրություն չկա, 05.11)
  function screen(o) {
    const back = o.back ? `<a class="wa-back" href="${esc(o.back)}" aria-label="Հետ">${IC.back}</a>` : `<button type="button" class="wa-back" id="wa-back" aria-label="Հետ">${IC.back}</button>`;
    const more = o.more ? `<button type="button" class="wa-more" id="wa-more" aria-label="Ավելին">${IC.more}<i id="wa-dot" hidden></i></button>` : '';
    return `<div class="wa-top"><div class="wa-top-in">${back}${avatar(o.av, 36)}<span class="wa-who"><b>${esc(o.name)}</b><small id="wa-st" data-s="${esc(o.status || '')}">${esc(o.status || '')}</small></span>${more}</div></div>`
      + `<div class="wa-sheet" id="wa-sheet" hidden></div><div class="wa-scroll" id="sc"><div class="wa-thread" id="tthread"></div></div>`
      + `<div class="wa-bar"><textarea class="wa-in" id="q" rows="1" aria-label="${esc(o.label || 'Նամակ')}" enterkeyhint="send"></textarea>`
      + `<button class="wa-send" id="send" type="button" aria-label="Ուղարկել" disabled>${IC.send}</button></div>`;
  }

  // o: { sb, staff (տիրոջ կողմից՝ աշխատակցի փոստը, աշխատակցի կողմից՝ null), el, sc, q, send, first, alive(), empty }
  function start(o) {
    let msgs = [], last = 0, otherRead = 0, me = 'owner', busy = false, timer = 0, thinking = false, tasks = [], staffName = '';
    const atBottom = () => o.sc.scrollHeight - o.sc.scrollTop - o.sc.clientHeight < 80;
    function paint(stick) {
      if (!msgs.length) { o.el.innerHTML = o.empty || ''; return; }
      let h = '', day = '', prev = '';
      for (const m of msgs) {
        const dk = dayKey(m.at);
        if (dk !== day) { day = dk; prev = ''; h += `<div class="wa-day">${dayLabel(m.at)}</div>`; }
        if (m.who === 'sys') { prev = ''; h += `<div class="wa-day sys">${esc(m.text)}${m.text === '📌 Նոր գործ' ? card(m.task) : ''}</div>`; continue; }
        // տիրոջ կողմից՝ իր նամակը և համակարգի բացատրությունը աշխատակցին աջում, աշխատակցինն ու համակարգի նոթը իրեն՝ ձախում
        const ai = m.who === 'ai', toStaff = ai && m.vis === 'staff';
        const out = m.who === me || (me === 'owner' && toStaff), side = out ? 'out' : 'in';
        const lab = me === 'owner' && toStaff ? `<span class="wa-lab">Համակարգը → ${esc(staffName)}</span>` : me === 'owner' && ai ? '<span class="wa-lab">Համակարգը</span>' : '';
        const who = me === 'owner' && m.who === 'owner' ? 'միայն դու · ' : me === 'staff' && ai ? 'համակարգից · ' : m.via === 'assistant' ? 'GTH · ' : '';
        const tk = (me === 'staff' && m.who === 'staff') || (me === 'owner' && toStaff) ? ticks(otherRead >= m.id) : '';
        const meta = `<span class="wa-meta">${who}${hm(m.at)}${tk}</span>`;
        h += `<div class="wa-msg ${side}${ai ? ' ai' : ''}${prev !== side ? ' tail' : ''}">${lab}${esc(m.text)}${card(m.task)}${meta}</div>`;
        prev = side;
      }
      o.el.innerHTML = h;
      if (stick) o.sc.scrollTop = o.sc.scrollHeight;
      const st = document.getElementById('wa-st');
      if (st) st.textContent = thinking ? (me === 'staff' ? 'գրում է…' : 'համակարգը մտածում է…') : st.dataset.s;
      const dot = document.getElementById('wa-dot');
      if (dot) dot.hidden = !tasks.some((k) => k.state === 'new' || k.late);
    }
    // գործի քարտը (աշխատակցին՝ «Արեցի» կոճակով)
    function card(k) {
      if (!k) return '';
      const done = k.state === 'done' || !tasks.some((x) => x.id === k.id);
      const btn = me === 'staff' && !done ? `<button type="button" class="wa-done" data-done="${k.id}">Արեցի</button>` : '';
      return `<span class="wa-task${done ? ' ok' : ''}"><b>📌 ${esc(k.text)}</b>${k.due && !done ? `<small>Ժամկետը՝ ${dueL(k.due)}</small>` : ''}${done ? '<small>✅ արված է</small>' : ''}${btn}</span>`;
    }
    async function taskDone(id, el) {
      if (el) el.disabled = true;
      try {
        const { error } = await o.sb.rpc('team_task_done', { p_id: Number(id) });
        if (error) throw new Error(error.message);
        closeSheet();
        await pull(true);
      } catch (e) { alert('Չստացվեց՝ ' + e.message); if (el) el.disabled = false; }
    }
    o.el.addEventListener('click', (e) => { const b = e.target.closest('[data-done]'); if (b) taskDone(b.dataset.done, b); });
    // «⋯» թերթը
    const sheet = document.getElementById('wa-sheet');
    function closeSheet() { if (sheet) { sheet.hidden = true; sheet.innerHTML = ''; } }
    function openSheet() {
      if (!sheet) return;
      const list = tasks.length ? tasks.map((k) => `<div class="wa-sh-t"><span><b>${esc(k.text)}</b>${k.due ? `<small class="${k.late ? 'late' : ''}">${k.late ? 'ուշանում է · ' : ''}${dueL(k.due)}</small>` : ''}</span>`
        + `<button type="button" class="wa-done" data-sdone="${k.id}">${me === 'staff' ? 'Արեցի' : 'Փակել'}</button></div>`).join('') : '<p class="wa-sh-e">Բաց գործ չկա</p>';
      sheet.innerHTML = `<div class="wa-sh-in">${me === 'owner' ? '<button type="button" class="wa-sh-b" id="wa-ask">Ի՞նչ վիճակ է</button>' : ''}<h4>Բաց գործեր</h4>${list}`
        + '<button type="button" class="wa-sh-b gray" id="wa-shx">Փակել</button></div>';
      sheet.hidden = false;
      sheet.onclick = async (e) => {
        if (e.target === sheet || e.target.id === 'wa-shx') return closeSheet();
        const d = e.target.closest('[data-sdone]');
        if (d) return taskDone(d.dataset.sdone, d);
        if (e.target.id === 'wa-ask') {
          e.target.disabled = true;
          try {
            const { error } = await o.sb.rpc('team_ask', { p_staff: o.staff, p_mode: 'summary' });
            if (error) throw new Error(error.message);
            e.target.textContent = 'Հարցրի. պատասխանը կգա այս չատում';
            thinking = true; paint(false);
            setTimeout(closeSheet, 1500);
          } catch (er) { e.target.disabled = false; alert('Չստացվեց՝ ' + er.message); }
        }
      };
    }
    const mb = document.getElementById('wa-more');
    if (mb) mb.onclick = () => (sheet && !sheet.hidden ? closeSheet() : openSheet());
    function take(T) {
      me = T.me || me;
      otherRead = T.other_read || 0;
      thinking = !!T.thinking;
      if (T.tasks) tasks = T.tasks;
      if (T.staff && T.staff.name) staffName = T.staff.name;
      const add = (T.msgs || []).filter((m) => m.id > last);
      if (add.length) { msgs = msgs.concat(add); last = add[add.length - 1].id; }
      return add.length;
    }
    const sig = () => otherRead + '|' + thinking + '|' + JSON.stringify(tasks);
    async function pull(force) {
      const { data, error } = await o.sb.rpc('team_thread', { p_staff: o.staff, p_after: force ? 0 : last });
      if (error) throw new Error(error.message);
      const stick = atBottom(), before = sig();
      if (force) { msgs = []; last = 0; }
      if (take(data) || force || before !== sig()) paint(stick);
    }
    function loop() {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!o.alive()) return;
        if (document.visibilityState === 'visible') { try { await pull(); } catch (e) {} }
        loop();
      }, 4000);
    }
    const grow = () => { o.q.style.height = 'auto'; o.q.style.height = Math.min(132, o.q.scrollHeight) + 'px'; o.send.disabled = !o.q.value.trim() || busy; };
    async function submit() {
      const t = o.q.value.trim();
      if (!t || busy) return;
      busy = true; grow();
      try {
        const { error } = await o.sb.rpc('team_send', { p_staff: o.staff, p_text: t });
        if (error) throw new Error(error.message);
        o.q.value = '';
        await pull();
        o.sc.scrollTop = o.sc.scrollHeight;
      } catch (e) { alert('Չգնաց՝ ' + e.message); }
      busy = false; grow();
      o.q.focus();
    }
    o.q.addEventListener('input', grow);
    o.q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); submit(); } });
    o.send.addEventListener('mousedown', (e) => e.preventDefault());   // ստեղնաշարը չփակվի
    o.send.addEventListener('click', submit);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && o.alive()) pull().catch(() => {}); });
    take(o.first || {});
    paint(true);
    grow();
    loop();
    return { pull, stop: () => clearTimeout(timer) };
  }
  return { start, screen, avatar, ticks, listTime, esc, IC };
})();
