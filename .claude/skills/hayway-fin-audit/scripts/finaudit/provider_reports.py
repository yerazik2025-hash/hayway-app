"""Payment-by-payment check of Idram / Telcell / EasyPay reports against Fleet and the bank.

How Idram works (Garik, 19.11.2026, from Idram): the driver pays 1 000, Idram keeps its
commission (e.g. 20) and only 980 lands on the driver's Yandex balance; Idram transfers the
net amounts to the park every day. So for every payment in the provider's report:
  * Fleet must show a top-up of exactly the NET amount  -> the driver paid the commission;
  * a top-up of the GROSS amount means the park paid it -> 🔴;
  * no top-up at all = "paid but not credited": the driver is owed the money; we say whether
    the money already reached our bank account and whether someone credited it later by hand;
  * a payment the provider calls "not credited" but Fleet shows credited -> do NOT credit again;
  * a Fleet top-up with no payment in the report -> credited without money -> 🔴.
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from .util import ZERO, amd, dmy, hm, phone_key

_TOKEN = re.compile(r'[A-Za-z0-9-]{4,}')
CREDIT_KINDS = ('topup', 'manual_credit', 'other', 'unknown')


def _identities(c, p, parks):
    ids = set()
    for v in (p.driver_id, p.account):
        if v:
            ids |= {(pk, v) for pk in parks}
    for v in (p.phone, p.account):
        k = phone_key(v)
        if k:
            ids |= {(d.park, d.id) for d in c.by_phone.get(k, []) if d.park in parks}
    if p.park:
        ids = {x for x in ids if x[0] == p.park}
    return ids


def match(c):
    """Pair report payments with Fleet top-ups, in two passes:
    1. the provider's payment number appears in the Fleet description (strongest);
    2. same driver + amount within the time window. The driver of a payment is its Fleet id,
       its phone, or its account code (the 6-digit "Բաժանորդ"/"Реквизиты" the driver types at the
       terminal): codes are learned from pass 1 and from --driver-codes."""
    c.pr = {}
    c.pr_gross = {}
    if c.data.fleet is None:
        return
    tol = c.tol
    win = timedelta(hours=float(c.cfg['provider_reports'].get('match_window_hours', 6)))
    for prov, rows in c.data.provider_reports.items():
        pc = c.cfg['providers'][prov]
        parks = set(pc['parks'])
        tops = [t for t in c.data.fleet if t.kind == 'topup' and t.provider == pc['type'] and t.park in parks and t.amount > 0]
        by_drv, by_tok = defaultdict(list), defaultdict(list)
        for t in tops:
            by_drv[(t.park, t.driver_id)].append(t)
            for tok in set(_TOKEN.findall(t.description)) | {t.id}:
                by_tok[tok].append(t)

        def mode_of(t, p, exact_only):
            if abs(t.amount - p.net) <= tol:
                return 'net'
            if abs(t.amount - p.gross) <= tol:
                return 'gross'
            return None if exact_only else 'diff'

        m, used = {}, set()

        def assign(pairs):
            pairs.sort(key=lambda x: (x[0], x[1], x[2]))
            for _, _, i, t, mode in pairs:
                if i not in m and id(t) not in used:
                    m[i] = (t, mode)
                    used.add(id(t))
                    c.pr_gross[id(t)] = rows[i].gross

        assign([(0, abs(t.at - p.at), i, t, mode_of(t, p, False))
                for i, p in enumerate(rows) if p.ref and len(p.ref) >= 4 for t in by_tok.get(p.ref, [])])
        codes = defaultdict(set)                       # account code -> {(park, driver)}
        for (park, code), did in c.data.driver_codes.items():
            codes[code].add((park, did))
        for i, (t, _) in m.items():
            if rows[i].account:
                codes[rows[i].account].add((t.park, t.driver_id))
        pairs = []
        for i, p in enumerate(rows):
            if i in m:
                continue
            ids = _identities(c, p, parks) | {k for k in codes.get(p.account, ()) if k[0] in parks}
            for k in ids:
                for t in by_drv.get(k, []):
                    if id(t) not in used and abs(t.at - p.at) <= win:
                        mode = mode_of(t, p, True)
                        if mode:
                            pairs.append((1, abs(t.at - p.at), i, t, mode))
        assign(pairs)
        c.pr[prov] = {'match': m, 'used': used, 'tops': tops, 'parks': parks, 'codes': codes}


def _in_bank(c, prov, p, rows, rep_from, rep_to):
    """Has the money of payment p already reached our account? (by the provider's cover rule)"""
    from .checks import _period
    if not c.bank_ok:
        return 'քաղվածք չկա'
    pc = c.cfg['providers'][prov]
    rec = defaultdict(lambda: ZERO)
    for b in c.data.bank:
        if b.source == prov and b.amount > 0:
            rec[b.day] += b.amount
    days = sorted(rec)
    for j, s in enumerate(days):
        per = _period(pc['cover'], s, days[j - 1] if j else None)
        if not per or not (per[0] <= p.day <= per[1]):
            continue
        R = rec[s]
        if rep_from <= per[0] and per[1] <= rep_to:
            rep_net = sum((x.net for x in rows if per[0] <= x.day <= per[1]), ZERO)
            if abs(R - rep_net) <= c.tol:
                return f'այո՝ {dmy(s)}-ի փոխանցման մեջ է ({amd(R)})'
            if abs(R - (rep_net - p.net)) <= c.tol:
                return f'ոչ՝ {dmy(s)}-ի փոխանցումը ({amd(R)}) առանց այս վճարման է'
        return f'{dmy(s)}-ի փոխանցումը ({amd(R)})՝ ճշգրիտ չի որոշվում'
    return 'դեռ չի փոխանցվել (կգա հաջորդ փոխանցմամբ)'


def check(c):
    if not c.fleet_ok or not c.data.provider_reports:
        return
    from .checks import _period
    tol = c.tol
    for prov, rows in c.data.provider_reports.items():
        pc = c.cfg['providers'][prov]
        name = pc['name']
        st = c.pr[prov]
        m, used, parks = st['match'], st['used'], st['parks']
        rep_from, rep_to = c.data.provider_periods.get(prov) or (
            min((p.day for p in rows), default=c.day), max((p.day for p in rows), default=c.day))
        covers = rep_from <= c.day <= rep_to
        if not covers:
            c.add('skip', f'{prov}_report_short', f'{name}-ի հաշվետվությունը չի ծածկում {dmy(c.day)}-ը',
                  f'Հաշվետվությունը՝ {dmy(rep_from)}–{dmy(rep_to)}։ Վճարումները հատ առ հատ չեն ստուգվել։')
        todo = [(i, p) for i, p in enumerate(rows) if (covers and p.day == c.day) or p.claim]

        def ids(p):
            return _identities(c, p, parks) | {k for k in st['codes'].get(p.account, ()) if k[0] in parks}

        def who(p, t=None):
            for k in ([(t.park, t.driver_id)] if t else []) + sorted(ids(p)):
                if k in c.drivers:
                    d = c.drivers[k]
                    return d.name or d.id, d.phone or p.phone
            return p.account or p.driver_id or p.phone or '?', p.phone

        credits = defaultdict(list)          # later credits that may settle an uncredited payment
        for t in c.data.fleet:
            if t.kind in CREDIT_KINDS and t.amount > 0 and t.park in parks and id(t) not in used:
                credits[(t.park, t.driver_id)].append(t)
        used_later = set()
        fee_on_us, diffs, not_cred, resolved, claim_ok = [], [], [], [], []
        s_fee = s_not = ZERO
        for i, p in sorted(todo, key=lambda x: x[1].at):
            base = {'Ժամ': f'{p.at:%d.%m %H:%M}', 'Վճարել է': amd(p.gross), 'Պետք է նստեր': amd(p.net), f'{name} №': p.ref}
            if i in m:
                t, mode = m[i]
                nm, ph = who(p, t)
                row = {'Վարորդ': nm, 'Հեռախոս': ph, **base, 'Նստել է': amd(t.amount)}
                if mode == 'gross' and p.fee > 0:
                    s_fee += p.fee
                    fee_on_us.append(row)
                elif mode == 'diff':
                    diffs.append(row)
                if p.claim:
                    claim_ok.append({**row, 'Fleet-ում': f'{t.at:%d.%m %H:%M}'})
                continue
            later = None
            for k in sorted(ids(p)):
                later = next((t for t in sorted(credits.get(k, []), key=lambda t: t.at) if id(t) not in used_later
                              and t.at >= p.at and (abs(t.amount - p.net) <= tol or abs(t.amount - p.gross) <= tol)), None)
                if later:
                    break
            nm, ph = who(p, later)
            row = {'Վարորդ': nm, 'Հեռախոս': ph, **base}
            if later:
                used_later.add(id(later))
                resolved.append({**row, 'Հաշվեգրվել է': f'{later.at:%d.%m %H:%M} · {later.category_name or later.kind}'
                                 + (f' · {later.created_by}' if later.created_by else '')})
            else:
                s_not += p.net
                not_cred.append({**row, 'Մեզ հասե՞լ է': _in_bank(c, prov, p, rows, rep_from, rep_to),
                                 'Նշում': f'{name}-ը գրել է՝ «{p.status}»' if p.claim else ''})
        if not_cred:
            c.add('warn', f'{prov}_not_credited', f'{name}. վարորդը վճարել է, բայց գումարը չի նստել հաշվին՝ {len(not_cred)} վճարում',
                  f'Ընդամենը {amd(s_not)}։ Այս գումարը պարտք ենք վարորդներին. «Մեզ հասե՞լ է» սյունակը ցույց է տալիս՝ '
                  f'գումարը մեր հաշվին է, թե դեռ {name}-ի մոտ։ Հաշվեգրելուց առաջ ստուգել, որ կրկնակի չլինի։',
                  amount=s_not, rows=not_cred, columns=list(not_cred[0]))
        if claim_ok:
            c.add('warn', f'{prov}_claim_but_credited', f'{name}-ը գրում է «չի նստել», բայց Fleet-ում նստած է՝ {len(claim_ok)}',
                  'ԿՐԿԻՆ ՄԻ՛ հաշվեգրեք. գումարը արդեն վարորդի հաշվին է։', rows=claim_ok, columns=list(claim_ok[0]))
        if fee_on_us:
            lvl = 'crit' if pc['fee_payer'] == 'driver' else 'info'
            c.add(lvl, f'{prov}_report_fee_on_us', f'{name}. վարորդին նստել է ամբողջ գումարը, միջնորդավճարը՝ մեզ վրա՝ {amd(s_fee)}',
                  f'{len(fee_on_us)} վճարում. պետք է նստեր զուտ գումարը (վճարած − միջնորդավճար)։', amount=s_fee,
                  rows=fee_on_us, columns=list(fee_on_us[0]))
        if diffs:
            c.add('warn', f'{prov}_amount_diff', f'{name}. նստած գումարը չի համապատասխանում վճարմանը՝ {len(diffs)}',
                  'Վճարման համարով գտնվել է, բայց գումարը ոչ զուտ է, ոչ ամբողջ։', rows=diffs, columns=list(diffs[0]))
        if resolved:
            c.add('info', f'{prov}_resolved', f'{name}. ուշ հաշվեգրված վճարումներ՝ {len(resolved)}',
                  'Չէին նստել ավտոմատ, հետո հաշվեգրվել են (ով, երբ)։', rows=resolved, columns=list(resolved[0]))
        # explain a "received more than credited" warning with the payments that never landed
        over = next((x for x in c.f if x.code == f'{prov}_over' and x.data), None)
        if over:
            a, z = over.data['from'], over.data['to']
            miss = sum((p.net for i, p in enumerate(rows) if i not in m and a <= p.day <= z), ZERO)
            if miss and abs(miss - over.amount) <= tol:
                over.detail += (f' Տարբերությունը ճիշտ հավասար է {name}-ի այն վճարումներին, որոնք չեն նստել վարորդների հաշվին '
                                f'({amd(miss)}). տես «վճարել է, բայց չի նստել»։')
        if not covers:
            continue
        # Fleet credits with no payment behind them
        orphan = [t for t in st['tops'] if t.day == c.day and id(t) not in used]
        if orphan:
            r = [{'Պարկ': c.park_name(t.park), 'Վարորդ': c.who(t.park, t.driver_id)[0], 'Գումար': amd(t.amount),
                  'Ժամ': hm(t.at), 'Fleet': t.id} for t in orphan]
            s = sum((t.amount for t in orphan), ZERO)
            c.add('crit', f'{prov}_credit_without_payment', f'Fleet-ում {name}-ով լիցքավորում կա, {name}-ի հաշվետվությունում՝ ոչ՝ {len(orphan)}',
                  f'{amd(s)} հաշվեգրվել է վարորդներին առանց {name}-ի վճարման (կամ հաշվետվությունը թերի է)։', amount=s,
                  rows=r, columns=list(r[0]))
        day = [p for p in rows if p.day == c.day]
        fd = [t for t in st['tops'] if t.day == c.day]
        g, f, n = (sum((getattr(p, k) for p in day), ZERO) for k in ('gross', 'fee', 'net'))
        cols = ['', 'Քանակ', 'Վճարել են', 'Միջնորդավճար', 'Պետք է նստեր', 'Նստել է Fleet-ում']
        rows_t = [{'': f'{name}-ի հաշվետվություն', 'Քանակ': len(day), 'Վճարել են': amd(g), 'Միջնորդավճար': amd(f), 'Պետք է նստեր': amd(n),
                   'Նստել է Fleet-ում': amd(sum((t.amount for t in fd), ZERO)) + f' ({len(fd)})'}]
        rate = pc.get('contract_fee_pct')
        if rate is not None:
            off = [p for p in day if abs(p.fee - p.gross * Decimal(str(rate)) / 100) > 1]
            if off:
                rr = [{'Ժամ': hm(p.at), 'Վճարել է': amd(p.gross), 'Միջնորդավճար': amd(p.fee), f'{name} №': p.ref} for p in off]
                c.add('warn', f'{prov}_fee_rate', f'{name}-ի միջնորդավճարը չի համապատասխանում պայմանագրի {rate}%-ին՝ {len(off)} վճարում',
                      '', rows=rr, columns=list(rr[0]))
        bad = not_cred or fee_on_us or diffs or orphan
        c.add('info' if bad else 'ok', f'{prov}_report_day',
              f'{name}՝ {len(day)} վճարում' + ('' if bad else ' — բոլորը ճիշտ են նստել ✓'),
              f'{pct_line(f, g)}', rows=rows_t, columns=cols)
        # the provider's own numbers vs the bank
        if c.bank_ok:
            rec = defaultdict(lambda: ZERO)
            for b in c.data.bank:
                if b.source == prov and b.amount > 0:
                    rec[b.day] += b.amount
            if c.day in rec:
                prev = max((d for d in rec if d < c.day), default=None)
                per = _period(pc['cover'], c.day, prev)
                if per and rep_from <= per[0] and per[1] <= rep_to:
                    a, z = per
                    rn = sum((p.net for p in rows if a <= p.day <= z), ZERO)
                    R = rec[c.day]
                    if abs(R - rn) <= tol:
                        c.add('ok', f'{prov}_report_bank', f'{name}՝ բանկ եկած {amd(R)} = իր հաշվետվության {dmy(a)}–{dmy(z)} զուտ գումարը ✓', '')
                    elif R < rn:
                        c.add('crit', f'{prov}_report_bank_short', f'{name}-ը փոխանցել է {amd(rn - R)} պակաս, քան իր հաշվետվությունում է',
                              f'{dmy(a)}–{dmy(z)}. հաշվետվությամբ՝ {amd(rn)}, բանկ է եկել {amd(R)}։', amount=rn - R,
                              data={'payer': prov, 'ptype': 'provider', 'schedule': pc.get('schedule', ''), 'kind': 'short',
                                    'from': a, 'to': z, 'received': R, 'expected': rn, 'diff': rn - R,
                                    'gross': sum((p.gross for p in rows if a <= p.day <= z), ZERO),
                                    'count': sum(1 for p in rows if a <= p.day <= z), 'refs': []})
                    else:
                        c.add('warn', f'{prov}_report_bank_over', f'{name}-ը փոխանցել է {amd(R - rn)} ավել, քան իր հաշվետվությունում է',
                              f'{dmy(a)}–{dmy(z)}. հաշվետվությամբ՝ {amd(rn)}, բանկ է եկել {amd(R)}։', amount=R - rn)


def pct_line(fee, gross):
    if not gross:
        return ''
    return f'Միջինը միջնորդավճար՝ {(fee / gross * 100).quantize(Decimal("0.01"))}%'.replace('.', ',')
