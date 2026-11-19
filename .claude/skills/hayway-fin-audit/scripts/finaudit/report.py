"""Armenian report: full Markdown, a short Telegram-ready text, and JSON."""
from __future__ import annotations

import json
from datetime import date
from decimal import Decimal

from .util import WEEKDAYS_HY, amd, dmy

ICON = {'crit': '🔴', 'warn': '🟠', 'ok': '✅', 'info': 'ℹ️', 'skip': '⛔'}
ORDER = ['crit', 'warn', 'skip', 'ok', 'info']


def status(findings):
    n = {k: sum(1 for f in findings if f.level == k) for k in ICON}
    if n['crit']:
        head = f'🔴 {n["crit"]} խնդիր'
    elif n['skip']:
        head = '⛔ Ստուգումը թերի է'
    elif n['warn']:
        head = f'🟠 {n["warn"]} զգուշացում'
    else:
        head = '✅ Ամեն ինչ ճիշտ է'
    return head, n


def _table(cols, rows):
    if not rows or not cols:
        return ''
    esc = lambda v: str(v if v is not None else '').replace('|', '/').replace('\n', ' ')
    out = ['| ' + ' | '.join(cols) + ' |', '|' + '|'.join('---' for _ in cols) + '|']
    out += ['| ' + ' | '.join(esc(r.get(c, '')) for c in cols) + ' |' for r in rows]
    return '\n'.join(out)


def markdown(findings, summary, day: date, cfg) -> str:
    head, n = status(findings)
    L = [f'# Ֆինանսական ստուգում · {dmy(day)} ({WEEKDAYS_HY[day.weekday()]})', '',
         f'**{head}** · 🔴 {n["crit"]} · 🟠 {n["warn"]} · ✅ {n["ok"]} · ⛔ {n["skip"]} չստուգվեց', '']
    sections = [
        ('crit', '## 🔴 Խնդիրներ — պետք է հիմա նայել'),
        ('warn', '## 🟠 Զգուշացումներ'),
        ('skip', '## ⛔ Չստուգվեց (տվյալ չկա կամ թերի է)'),
        ('ok', '## ✅ Ստուգված և ճիշտ'),
        ('info', '## Թվեր'),
    ]
    for lvl, title in sections:
        fs = [f for f in findings if f.level == lvl]
        if not fs:
            continue
        L += [title, '']
        for f in fs:
            L.append(f'**{ICON[lvl]} {f.title}**' if lvl != 'info' else f'**{f.title}**')
            if f.detail:
                L.append(f.detail)
            t = _table(f.columns, f.rows)
            if t:
                L += ['', t]
            L.append('')
    lt = (summary or {}).get('letters') or []
    if lt:
        L += ['## ✉️ Նամակների նախագծեր (ՉԵՆ ուղարկվել)', '',
              'Տերը կարդում է, լրացնում է բացերը և ինքն է որոշում՝ ուղարկել, թե ոչ։', '']
        for x in lt:
            L.append(f'**{x["to"]}** — {x["subject"]}  ')
            L.append(f'Ֆայլը՝ `letters/{x["payer"]}.md`, կից ցուցակը՝ `letters/{x["payer"]}.csv` ({len(x["rows"])} տող)'
                     + (f'. լրացնել՝ {", ".join(x["missing"])}' if x['missing'] else ''))
            L.append('')
    L += ['---', f'Կանոններ՝ մեծ լիցքավորում ≥ {amd(cfg["thresholds"]["large_topup_amd"])} · '
          f'ելք լիցքավորումից ≥ {amd(cfg["thresholds"]["withdrawal_from_topup_min_amd"])} · '
          f'համընկնման թույլատրելի շեղում ≤ {amd(cfg["thresholds"]["settlement_tolerance_amd"])} · '
          f'պատմություն՝ {cfg["lookback_days"]} օր։ Ստուգումը միայն կարդում է, ոչինչ չի փոխում։']
    return '\n'.join(L) + '\n'


def short(findings, summary, day: date, limit=12) -> str:
    """Plain text for Telegram / push: headline + the problems, one line each."""
    head, n = status(findings)
    L = [f'Ֆին. ստուգում {dmy(day)}: {head}']
    imp = [f for f in findings if f.level in ('crit', 'warn', 'skip')]
    imp.sort(key=lambda f: ORDER.index(f.level))
    for f in imp[:limit]:
        L.append(f'{ICON[f.level]} {f.title}')
    if len(imp) > limit:
        L.append(f'… և ևս {len(imp) - limit}')
    for x in summary.get('letters') or []:
        L.append(f'✉️ Նամակի նախագիծ՝ {x["to"]} ({x["subject"]})')
    tp = summary.get('topups')
    if tp:
        tot = sum(Decimal(v['sum']) for v in tp.values())
        L.append(f'Լիցքավորումներ՝ {amd(tot)}')
    if 'payouts' in summary:
        L.append(f'Ելքեր՝ {amd(Decimal(summary["payouts"]["sum"]))} ({summary["payouts"]["n"]})')
    return '\n'.join(L)


def to_json(findings, summary, day: date) -> str:
    head, n = status(findings)

    def enc(o):
        if isinstance(o, Decimal):
            return str(o)
        raise TypeError(type(o))
    summary = {k: v for k, v in summary.items() if k != 'letters'} | {
        'letters': [{k: v for k, v in x.items() if k != 'rows'} for x in summary.get('letters') or []]}
    return json.dumps({
        'day': day.isoformat(), 'status': head, 'counts': n, 'summary': summary,
        'findings': [{'level': f.level, 'code': f.code, 'title': f.title, 'detail': f.detail,
                      'amount': f.amount, 'park': f.park, 'rows': f.rows} for f in findings],
    }, ensure_ascii=False, indent=1, default=enc)
