"""All audit checks. Pure functions over normalized Data -> list[Finding].

Levels: crit (money is lost or missing), warn (needs a human look), ok (checked
and matched), info (numbers for context), skip (could NOT be checked: a missing
or incomplete source). The report is never "all good" while any skip exists.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from .config import T
from .loaders import classify_fleet
from .model import Data, Finding
from .util import ZERO, amd, day_end, day_start, dmy, hm, pct, phone_key

PROV_NAME = {'idram': 'Idram', 'telcell': 'Telcell', 'easypay': 'EasyPay', 'other': 'այլ'}


class Ctx:
    def __init__(self, data: Data, cfg: dict, day: date):
        self.data, self.cfg, self.day = data, cfg, day
        self.f: list[Finding] = []
        self.tol = T(cfg, 'settlement_tolerance_amd')
        lb = int(cfg['lookback_days'])
        self.win_start = day_start(day - timedelta(days=lb))
        if data.fleet_from and data.fleet_from > self.win_start:
            self.win_start = data.fleet_from
        self.drivers = {(d.park, d.id): d for d in (data.drivers or [])}
        self.by_phone = defaultdict(list)
        for d in data.drivers or []:
            if phone_key(d.phone):
                self.by_phone[phone_key(d.phone)].append(d)
        self.fleet_ok = data.fleet is not None and data.fleet_until is not None and data.fleet_until >= day_end(day)
        self.bank_ok = data.bank is not None and data.bank_until is not None and data.bank_until >= day
        self.pb_ok = data.pb is not None and data.pb_until is not None and data.pb_until >= day
        self.summary = {}

    def add(self, level, code, title, detail='', amount=None, rows=None, columns=None, park=''):
        self.f.append(Finding(level, code, title, detail, amount, rows or [], columns or [], park))

    def who(self, park, driver_id):
        d = self.drivers.get((park, driver_id))
        return (d.name if d and d.name else driver_id), (d.phone if d else '')

    def park_name(self, p):
        return self.cfg['parks'].get(p, {}).get('name', p)

    def fleet_day_start(self) -> date:
        """First Yerevan day fully covered by the Fleet data used in the audit."""
        d = self.win_start.date()
        return d if self.win_start == day_start(d) else d + timedelta(days=1)


# ───────────────────────── 0. inputs ─────────────────────────
def check_inputs(c: Ctx):
    d, cfg = c.data, c.cfg
    for lvl, msg in d.notes:
        c.add(lvl, 'input_note', msg)
    if d.fleet is None:
        c.add('skip', 'no_fleet', 'Fleet-ի գործարքներ չկան', 'Առանց Fleet-ի ոչ մի ստուգում չի արվել։')
    else:
        for p in cfg['parks']:
            if p not in d.fleet_parks:
                c.add('skip', 'no_fleet_park', f'Fleet · {c.park_name(p)}՝ տվյալ չկա', 'Այս պարկը չի ստուգվել։', park=p)
        if not c.fleet_ok:
            c.add('skip', 'fleet_short', f'Fleet-ի տվյալները չեն ծածկում {dmy(c.day)} օրը ամբողջությամբ',
                  f'Կա մինչև {dmy(d.fleet_until) if d.fleet_until else "—"}։ Օրվա ստուգումները թերի են։')
        need_from = day_start(c.day - timedelta(days=int(cfg['lookback_days'])))
        if d.fleet_from and d.fleet_from > need_from:
            c.add('info', 'fleet_history', 'Fleet-ի պատմությունը կարճ է',
                  f'Կա {dmy(d.fleet_from)}-ից, պետք է {dmy(need_from)}-ից. ելքերի ծագումը ավելի կոպիտ է։')
        if not cfg['categories_verified']:
            c.add('skip', 'cats_unverified', 'Fleet-ի կատեգորիաների համապատասխանությունը դեռ հաստատված չէ',
                  'config.json-ում categories_verified=false։ Թվերը նախնական են, մինչև տերը կհաստատի։')
    if d.drivers is None:
        c.add('skip', 'no_drivers', 'Վարորդների հաշվեկշիռները չկան',
              'Պարտքերի ցուցակը չի կազմվել, ելքերի ծագումը՝ մոտավոր (սկզբնական մնացորդը անհայտ է)։')
    if d.bank is None:
        c.add('skip', 'no_bank', 'Բիզնես հաշվի քաղվածքը չկա',
              'Yandex, Idram, Telcell, EasyPay փոխանցումները չեն ստուգվել։')
    elif not c.bank_ok:
        c.add('skip', 'bank_short', f'Բանկի քաղվածքը չի հասնում {dmy(c.day)}-ին',
              f'Քաղվածքը՝ մինչև {dmy(d.bank_until) if d.bank_until else "—"}։ Օրվա փոխանցումները չեն ստուգվել։')
    if d.pb is None:
        c.add('skip', 'no_pb', 'PrimeBridge-ի ելքերը չկան', 'Վարորդներին արված փոխանցումները PrimeBridge-ի հետ չեն համեմատվել։')
    elif not c.pb_ok:
        c.add('skip', 'pb_short', f'PrimeBridge-ի տվյալները չեն հասնում {dmy(c.day)}-ին', '')


def _txs(c: Ctx, kinds=None, day=None, provider=None, parks=None):
    for t in c.data.fleet or []:
        if kinds and t.kind not in kinds:
            continue
        if day and t.day != day:
            continue
        if provider and t.provider != provider:
            continue
        if parks is not None and t.park not in parks:
            continue
        yield t


# ───────────────────────── 1. categories ─────────────────────────
def check_unknown_categories(c: Ctx):
    if c.data.fleet is None:
        return
    g = defaultdict(lambda: [0, ZERO, 0])
    for t in _txs(c, kinds={'unknown'}):
        k = (t.park, t.category_id, t.category_name)
        g[k][0] += 1
        g[k][1] += t.amount
        g[k][2] += t.day == c.day
    if g:
        rows = [{'Պարկ': c.park_name(p), 'ID': cid, 'Անուն': nm, 'Քանակ': n, 'Գումար': amd(s), 'Այդ օրը': today}
                for (p, cid, nm), (n, s, today) in sorted(g.items(), key=lambda x: -abs(x[1][1]))]
        c.add('warn', 'unknown_categories', f'Fleet-ում կա {len(g)} չդասակարգված կատեգորիա',
              'Դրանց գումարները ստուգումներում չեն մասնակցում որպես լիցքավորում/ելք։ Պետք է ավելացնել config-ում։',
              rows=rows, columns=list(rows[0]))


# ───────────────────────── 2. top-ups ─────────────────────────
def check_topups(c: Ctx):
    if not c.fleet_ok:
        return
    big = T(c.cfg, 'large_topup_amd')
    tops = sorted(_txs(c, kinds={'topup'}, day=c.day), key=lambda t: t.at)
    per_prov = defaultdict(lambda: [0, ZERO])
    per_drv = defaultdict(list)
    for t in tops:
        per_prov[(t.park, t.provider)][0] += 1
        per_prov[(t.park, t.provider)][1] += t.amount
        per_drv[(t.park, t.driver_id)].append(t)
    rows = [{'Պարկ': c.park_name(p), 'Համակարգ': PROV_NAME.get(pv, pv or '?'), 'Քանակ': n, 'Գումար': amd(s)}
            for (p, pv), (n, s) in sorted(per_prov.items())]
    total = sum((s for _, s in per_prov.values()), ZERO)
    c.summary['topups'] = {f'{p}:{pv}': {'n': n, 'sum': str(s)} for (p, pv), (n, s) in per_prov.items()}
    c.add('info', 'topups_day', f'Օրվա լիցքավորումները՝ {amd(total)}', f'{len(tops)} լիցքավորում',
          amount=total, rows=rows, columns=['Պարկ', 'Համակարգ', 'Քանակ', 'Գումար'] if rows else [])

    singles = [t for t in tops if t.amount >= big]
    if singles:
        r = []
        for t in singles:
            nm, ph = c.who(t.park, t.driver_id)
            r.append({'Պարկ': c.park_name(t.park), 'Վարորդ': nm, 'Հեռախոս': ph, 'Համակարգ': PROV_NAME.get(t.provider, t.provider),
                      'Գումար': amd(t.amount), 'Ժամ': hm(t.at)})
        c.add('warn', 'topup_large', f'Մեծ լիցքավորումներ (≥ {amd(big)})՝ {len(singles)} հատ',
              f'Ընդամենը {amd(sum((t.amount for t in singles), ZERO))}', amount=sum((t.amount for t in singles), ZERO),
              rows=r, columns=list(r[0]))
    split = []
    for (p, did), lst in per_drv.items():
        s = sum((t.amount for t in lst), ZERO)
        if len(lst) >= 2 and s >= big and all(t.amount < big for t in lst):
            nm, ph = c.who(p, did)
            split.append({'Պարկ': c.park_name(p), 'Վարորդ': nm, 'Հեռախոս': ph, 'Քանակ': len(lst),
                          'Գումարներ': ' + '.join(amd(t.amount) for t in lst), 'Օրվա ընդամենը': amd(s)})
    if split:
        c.add('warn', 'topup_split', f'Մասնատված մեծ լիցքավորումներ՝ {len(split)} վարորդ',
              f'Մի քանի փոքր լիցքավորում, որոնք մեկ օրում միասին ≥ {amd(big)} են։', rows=split, columns=list(split[0]))
    rev = [t for t in _txs(c, kinds={'topup'}, day=c.day) if t.amount < 0]
    if rev:
        r = [{'Պարկ': c.park_name(t.park), 'Վարորդ': c.who(t.park, t.driver_id)[0], 'Համակարգ': PROV_NAME.get(t.provider, t.provider),
              'Գումար': amd(t.amount), 'Ժամ': hm(t.at)} for t in rev]
        c.add('warn', 'topup_reversed', f'Չեղարկված լիցքավորումներ՝ {len(rev)}', '', rows=r, columns=list(r[0]))


# ───────────────────────── 3. driver ledger: where withdrawals come from ─────────────────────────
FEE_ORDER = ('P', 'O', 'E')        # charges are covered by topped-up money first (that is what top-ups are for)
EARN_ORDER = ('E', 'O', 'P')       # payouts and cashless-order fees come out of earnings first


def _ledger(c: Ctx, park, did, txs, cashless):
    d = c.drivers.get((park, did))
    approx = True
    opening = ZERO
    if d is not None and d.balance is not None:
        snap = d.balance_at or c.data.fleet_until
        opening = d.balance - sum((t.amount for t in txs if t.kind != 'ignore' and t.at < snap), ZERO)
        approx = False
    b = {'E': ZERO, 'O': max(opening, ZERO), 'P': ZERO, 'D': max(-opening, ZERO)}

    def credit(k, x):
        r = min(b['D'], x)
        b['D'] -= r
        b[k] += x - r

    def debit(x, order):
        took = {}
        for k in order:
            t = min(b[k], x)
            if t:
                b[k] -= t
                took[k] = t
                x -= t
        if x:
            b['D'] += x
            took['D'] = x
        return took

    payouts = []
    for t in txs:
        a, k = t.amount, t.kind
        if k == 'ignore' or not a:
            continue
        if k == 'payout' and a < 0:
            pre = dict(b)
            took = debit(-a, EARN_ORDER)
            if t.day == c.day:
                payouts.append((t, took, pre))
        elif a > 0:
            credit('P' if k in ('topup', 'topup_fee') else 'E', a)
        elif k in ('order_fee', 'order_income') and t.order_id in cashless:
            debit(-a, EARN_ORDER)
        else:
            debit(-a, FEE_ORDER)
    return payouts, approx


def check_withdrawals(c: Ctx):
    if not c.fleet_ok:
        return
    min_flag = T(c.cfg, 'withdrawal_from_topup_min_amd')
    cashless = {t.order_id for t in _txs(c, kinds={'order_income'}) if t.order_id and t.amount > 0}
    by_drv = defaultdict(list)
    for t in c.data.fleet:
        if t.at >= c.win_start:
            by_drv[(t.park, t.driver_id)].append(t)
    flagged, over, n, total, from_top_total, over_total = [], [], 0, ZERO, ZERO, ZERO
    for (park, did), txs in by_drv.items():
        if not any(t.kind == 'payout' and t.day == c.day for t in txs):
            continue
        txs.sort(key=lambda t: (t.at, t.id))
        payouts, approx = _ledger(c, park, did, txs, cashless)
        nm, ph = c.who(park, did)
        week_tops = sum((t.amount for t in txs if t.kind == 'topup' and t.amount > 0
                         and c.day - timedelta(days=6) <= t.day <= c.day), ZERO)
        for t, took, pre in payouts:
            n += 1
            total += -t.amount
            fp = took.get('P', ZERO)
            from_top_total += fp
            row = {'Պարկ': c.park_name(park), 'Վարորդ': nm, 'Հեռախոս': ph, 'Ելք': amd(-t.amount), 'Ժամ': hm(t.at),
                   'Պատվերներից': amd(took.get('E', ZERO) + took.get('O', ZERO)), 'Լիցքավորումից': amd(fp),
                   'Լիցք. 7 օրում': amd(week_tops)}
            if approx:
                row['Նշում'] = 'մոտավոր (մնացորդը անհայտ)'
            if fp >= min_flag:
                flagged.append(row)
            if took.get('D'):
                over_total += took['D']
                over.append({**row, 'Մնացորդից ավել': amd(took['D'])})
    c.summary['payouts'] = {'n': n, 'sum': str(total), 'from_topups': str(from_top_total)}
    if flagged:
        c.add('warn', 'payout_from_topup', f'Ելքեր լիցքավորված գումարից՝ {len(flagged)} հատ',
              f'Վարորդը հանել է գումար, որը պատվերներից չի վաստակել, այլ լիցքավորել է ({amd(from_top_total)} ընդամենը)։ '
              f'Դրա լիցքավորման և ելքի միջնորդավճարները կարող են մեր վրա ընկնել։',
              amount=from_top_total, rows=flagged, columns=list(flagged[0]))
    if over:
        lvl = 'crit' if all('Նշում' not in r for r in over) else 'warn'
        c.add(lvl, 'payout_over_balance', f'Ելք՝ հաշվեկշռից ավել՝ {len(over)} հատ',
              f'Վարորդին փոխանցվել է ավելին, քան ուներ հաշվին → {amd(over_total)} պարկի գումարն է։',
              amount=over_total, rows=over, columns=list(over[0]))
    if n and not flagged and not over:
        c.add('ok', 'payouts_clean', f'Վարորդների {n} ելքը ({amd(total)}) պատվերներից վաստակած գումարից է', '')
    elif not n:
        c.add('info', 'payouts_none', 'Այդ օրը Fleet-ում վարորդների ելք չկա', '')


# ───────────────────────── 4. balances, manual credits ─────────────────────────
def check_balances(c: Ctx):
    if c.data.drivers is None:
        return
    lim = T(c.cfg, 'debt_alert_amd')
    neg = sorted((d for d in c.data.drivers if d.balance is not None and d.balance < 0), key=lambda d: d.balance)
    pos = sum((d.balance for d in c.data.drivers if d.balance and d.balance > 0), ZERO)
    debt = -sum((d.balance for d in neg), ZERO)
    c.summary['balances'] = {'owed_to_drivers': str(pos), 'drivers_owe': str(debt), 'debtors': len(neg)}
    c.add('info', 'balances', f'Վարորդների հաշիվներում՝ {amd(pos)}, պարտքեր՝ {amd(debt)}',
          f'{len(neg)} վարորդ մինուսում է։ Դրական մնացորդը այն գումարն է, որ վարորդները կարող են հանել։', amount=debt)
    big = [d for d in neg if -d.balance >= lim]
    if big:
        r = [{'Պարկ': c.park_name(d.park), 'Վարորդ': d.name or d.id, 'Հեռախոս': d.phone, 'Պարտք': amd(-d.balance)}
             for d in big[:int(c.cfg['thresholds']['list_limit'])]]
        c.add('warn', 'debt_big', f'Մեծ պարտքեր (≥ {amd(lim)})՝ {len(big)} վարորդ',
              f'Ընդամենը {amd(-sum((d.balance for d in big), ZERO))}', rows=r, columns=list(r[0]))


def check_manual(c: Ctx):
    if not c.fleet_ok:
        return
    lim = T(c.cfg, 'manual_credit_alert_amd')
    man = [t for t in _txs(c, kinds={'manual_credit', 'manual_debit'}, day=c.day)]
    if not man:
        return
    cr = [t for t in man if t.kind == 'manual_credit' and t.amount > 0]
    big = [t for t in cr if t.amount >= lim]
    c.add('info', 'manual_day', f'Ձեռքով գործարքներ՝ +{amd(sum((t.amount for t in cr), ZERO))} վարորդներին',
          f'{len(man)} գործարք ({len(cr)} ավելացում)')
    if big:
        r = [{'Պարկ': c.park_name(t.park), 'Վարորդ': c.who(t.park, t.driver_id)[0], 'Գումար': amd(t.amount),
              'Ով': t.created_by or '—', 'Նկարագրություն': t.description[:60], 'Ժամ': hm(t.at)} for t in big]
        c.add('warn', 'manual_big', f'Ձեռքով մեծ ավելացումներ վարորդների հաշվին՝ {len(big)}',
              'Ստուգեք՝ արդյոք հիմնավորված են (մրցանակ, ուղղում)։', amount=sum((t.amount for t in big), ZERO),
              rows=r, columns=list(r[0]))


# ───────────────────────── 5. settlements (providers, Yandex) ─────────────────────────
def _period(cover, s: date, prev: date | None):
    lag = int(cover.get('lag_days', 1))
    typ = cover['type']
    if typ == 'since_previous_receipt':
        return (prev - timedelta(days=lag - 1), s - timedelta(days=lag)) if prev else None
    if typ == 'previous_days':
        n = int(cover.get('days', 1))
        return s - timedelta(days=lag + n - 1), s - timedelta(days=lag)
    if typ == 'previous_week':
        end = s - timedelta(days=s.weekday() + 1)
        return end - timedelta(days=6), end
    return None


def _settle(c: Ctx, key, title, daily_net, daily_gross, daily_cnt, ptype, verified, fee_payer, rate):
    """Compare bank receipts from one payer with what Fleet says it owes.
    daily_net[d]: amount that should reach the bank for day d. ptype: 'provider' | 'yandex'."""
    pc = c.cfg['providers'].get(key) if ptype == 'provider' else c.cfg['yandex']
    rec = defaultdict(lambda: ZERO)
    rec_rows = defaultdict(list)
    for b in c.data.bank:
        if b.source == key and b.amount > 0:
            rec[b.day] += b.amount
            rec_rows[b.day].append(b)
    first_fleet = c.fleet_day_start()

    def net(a, z):
        return sum((daily_net.get(d, ZERO) for d in _days(a, z)), ZERO)

    def gross(a, z):
        return sum((daily_gross.get(d, ZERO) for d in _days(a, z)), ZERO)

    def cnt(a, z):
        return sum((daily_cnt.get(d, 0) for d in _days(a, z)))

    row = {'Աղբյուր': title, 'Գրաֆիկ': pc.get('schedule', ''), 'Ստացվել է': '—', 'Պետք էր': '—', 'Տարբ.': '—', 'Վիճակ': ''}
    days_before = sorted(d for d in rec if d < c.day)
    last = max((d for d in rec if d <= c.day), default=None)
    lvl_miss = 'crit'
    # schedule
    lb_tops = sum((v for d, v in daily_gross.items() if d <= c.day), ZERO)
    if last is None:
        if lb_tops:
            c.add(lvl_miss, f'{key}_none', f'{title}-ից փոխանցում չի եկել {c.cfg["lookback_days"]} օրում',
                  f'Բայց այդ ընթացքում Fleet-ում կա {amd(lb_tops)} {"լիցքավորում" if ptype == "provider" else "շրջանառություն"}։',
                  amount=lb_tops)
            row['Վիճակ'] = '🔴 չկա'
        else:
            row['Վիճակ'] = 'շարժ չկա'
        return row, None
    gap = (c.day - last).days
    maxgap = int(pc.get('max_gap_days', 3))
    if gap > maxgap:
        c.add(lvl_miss, f'{key}_late', f'{title}-ը ուշանում է. վերջին փոխանցումը՝ {dmy(last)} ({gap} օր առաջ)',
              f'Գրաֆիկը՝ {pc.get("schedule", "")}։ Չփոխանցված՝ ≈ {amd(net(last, c.day))}։', amount=net(last, c.day))
    if c.day not in rec:
        wd = pc.get('weekday')
        exp_wd = pc.get('expect_weekdays')
        if wd is not None and c.day.weekday() == int(wd):
            c.add('crit', f'{key}_missed_day', f'{title}-ի {dmy(c.day)} ({["երկուշաբթի", "երեքշաբթի", "չորեքշաբթի", "հինգշաբթի", "ուրբաթ", "շաբաթ", "կիրակի"][c.day.weekday()]}) փոխանցումը չի եկել', f'Գրաֆիկը՝ {pc.get("schedule", "")}։')
        elif exp_wd and c.day.weekday() in exp_wd and gap <= maxgap:
            c.add('warn', f'{key}_missed_day', f'{title}-ից {dmy(c.day)}-ին փոխանցում չի եկել', f'Վերջինը՝ {dmy(last)}։')
        row['Վիճակ'] = f'այսօր չկա, վերջինը՝ {dmy(last)}'
        return _with_next(row, _next_expected(c, pc, last, days_before, net))
    # a receipt today: match it
    R = rec[c.day]
    row['Ստացվել է'] = amd(R)
    prev = days_before[-1] if days_before else None
    per = _period(pc['cover'], c.day, prev)
    tol = c.tol
    if per and per[0] >= first_fleet:
        a, z = per
        N, G = net(a, z), gross(a, z)
        diff = R - N
        row['Պետք էր'] = amd(N)
        row['Տարբ.'] = amd(diff, sign=True)
        row['Ժամանակահատված'] = f'{dmy(a)}–{dmy(z)}'
        if abs(diff) <= tol:
            c.add('ok', f'{key}_match', f'{title}՝ {amd(R)} = {_what(ptype)} {dmy(a)}–{dmy(z)} ✓', '')
            row['Վիճակ'] = '✅'
            return _with_next(row, net(z + timedelta(days=1), c.day))
    else:
        a = z = None
        N = G = None
        row['Վիճակ'] = 'ժամանակահատվածը անհայտ'
    # search other periods: exact, or exact after a commission taken from us
    exact, by_rate = None, None          # (distance from the configured period, start, end, net)
    for zz in [c.day - timedelta(days=i) for i in range(0, 5)]:
        for k in range(0, 16):
            aa = zz - timedelta(days=k)
            if aa < first_fleet:
                break
            n_ = net(aa, zz)
            if not n_:
                continue
            dist = (abs((aa - a).days) + abs((zz - z).days)) if a else k
            if abs(R - n_) <= tol and (exact is None or dist < exact[0]):
                exact = (dist, aa, zz, n_)
            if rate is not None:
                exp = n_ - gross(aa, zz) * rate / 100
                # commission is rounded per payment: allow 1 AMD per top-up
                if abs(R - exp) <= max(tol, Decimal(cnt(aa, zz))) and (by_rate is None or dist < by_rate[0]):
                    by_rate = (dist, aa, zz, n_)
    best = ('exact',) + exact if exact else (('rate',) + by_rate if by_rate else None)
    if best:
        best = (best[0], best[2], best[3], best[1], best[4])   # kind, start, end, dist, net
    if best and best[0] == 'exact':
        _, aa, zz, _, n_ = best
        c.add('ok', f'{key}_match', f'{title}՝ {amd(R)} = {_what(ptype)} {dmy(aa)}–{dmy(zz)} ✓',
              f'Կոնֆիգի ժամանակահատվածը ({dmy(a)}–{dmy(z)}) չհամընկավ, բայց գումարը ճշգրիտ համընկնում է այլ օրերի հետ։ '
              f'Ստուգեք config-ի cover կանոնը։' if a else '')
        row.update({'Պետք էր': amd(n_), 'Տարբ.': amd(R - n_, sign=True), 'Ժամանակահատված': f'{dmy(aa)}–{dmy(zz)}', 'Վիճակ': '✅'})
        return _with_next(row, net(zz + timedelta(days=1), c.day))
    if best and best[0] == 'rate':
        _, aa, zz, _, n_ = best
        lost = n_ - R
        lvl = 'ok' if fee_payer == 'park' else 'crit'
        c.add(lvl, f'{key}_fee_on_us', f'{title}-ը պահել է {pct(lost, gross(aa, zz))} միջնորդավճար ՄԵԶԱՆԻՑ՝ {amd(lost)}',
              f'{dmy(aa)}–{dmy(zz)}. վարորդներին հաշվեգրվել է {amd(n_)}, բանկ է եկել {amd(R)}։ '
              f'Միջնորդավճարը պետք է պահվեր վարորդից։', amount=lost)
        row.update({'Պետք էր': amd(n_), 'Տարբ.': amd(R - n_, sign=True), 'Ժամանակահատված': f'{dmy(aa)}–{dmy(zz)}',
                    'Վիճակ': '🔴 միջնորդավճարը մեզնից' if lvl == 'crit' else '✅ (պարկն է վճարում)'})
        return _with_next(row, net(zz + timedelta(days=1), c.day))
    # no exact match anywhere
    lvl = 'crit' if verified else 'warn'
    unv = '' if verified else ' (բանաձևը դեռ հաստատված չէ)'
    if N is None:
        c.add(lvl, f'{key}_unmatched', f'{title}՝ {amd(R)} չհամընկավ ոչ մի ժամանակահատվածի հետ{unv}',
              'Նախորդ փոխանցումը տվյալներում չկա, ժամանակահատվածը հնարավոր չէ որոշել։', amount=R)
        row['Վիճակ'] = '🟠 չհամընկավ'
        return row, None
    diff = R - N
    if diff < 0:
        implied = (N - R) / G if G else None
        hint = (f'Տարբերությունը {pct(N - R, G)} է {"լիցքավորումներից" if ptype == "provider" else "շրջանառությունից"}'
                f'{" — նման է միջնորդավճարի, որ պահվել է մեզանից" if implied is not None and 0 < implied <= Decimal("0.05") and ptype == "provider" else ""}։')
        c.add(lvl, f'{key}_short', f'{title}-ից պակաս է եկել {amd(-diff)}{unv}',
              f'{dmy(a)}–{dmy(z)}. պետք էր {amd(N)}, եկել է {amd(R)}։ {hint}', amount=-diff)
        row['Վիճակ'] = '🔴 պակաս' if lvl == 'crit' else '🟠 պակաս'
    else:
        c.add('warn', f'{key}_over', f'{title}-ից ավել է եկել {amd(diff)}{unv}',
              f'{dmy(a)}–{dmy(z)}. Fleet-ում {amd(N)}, բանկում {amd(R)}։ '
              + ('Հնարավոր է՝ ինչ-որ վարորդի վճարում չի հաշվեգրվել Fleet-ում։' if ptype == 'provider' else ''), amount=diff)
        row['Վիճակ'] = '🟠 ավել'
    return _with_next(row, net(z + timedelta(days=1), c.day))


def _what(ptype):
    return 'Fleet-ի լիցքավորումները' if ptype == 'provider' else 'Fleet-ի հաշվարկը'


def _with_next(row, nxt):
    if nxt is not None:
        row['Սպասվում է'] = amd(nxt)
    return row, nxt


def _next_expected(c, pc, last, days_before, net):
    lag = int(pc['cover'].get('lag_days', 1))
    if pc['cover']['type'] != 'since_previous_receipt':
        return None
    start = last - timedelta(days=lag - 1)
    if start < c.fleet_day_start():
        return None
    return net(start, c.day)


def _days(a: date, z: date):
    d = a
    while d <= z:
        yield d
        d += timedelta(days=1)


def check_settlements(c: Ctx):
    if not (c.fleet_ok and c.bank_ok):
        return
    rows, outstanding = [], ZERO
    for key, pc in c.cfg['providers'].items():
        parks = set(pc['parks'])
        dn, dg, dc = defaultdict(lambda: ZERO), defaultdict(lambda: ZERO), defaultdict(int)
        for t in _txs(c, kinds={'topup', 'topup_fee'}, provider=key, parks=parks):
            dn[t.day] += t.amount
            if t.kind == 'topup':
                dg[t.day] += t.amount
                dc[t.day] += 1
        rate = Decimal(str(pc['contract_fee_pct'])) if pc.get('contract_fee_pct') is not None else None
        row, nxt = _settle(c, key, pc['name'], dn, dg, dc, 'provider', True, pc['fee_payer'], rate)
        rows.append(row)
        if nxt:
            outstanding += nxt
    # Yandex: what the platform owes = sum of platform-side transactions
    yc = c.cfg['yandex']
    dn, dg, dc = defaultdict(lambda: ZERO), defaultdict(lambda: ZERO), defaultdict(int)
    for t in _txs(c, parks=set(yc['parks'])):
        if t.party == 'platform' and t.kind != 'ignore':
            dn[t.day] += t.amount
            if t.kind == 'order_income' and t.amount > 0:
                dg[t.day] += t.amount
                dc[t.day] += 1
    row, nxt = _settle(c, 'yandex', yc.get('name', 'Yandex'), dn, dg, dc, 'yandex', bool(yc.get('formula_verified')), 'driver', None)
    rows.insert(0, row)
    if nxt and yc.get('formula_verified'):
        outstanding += nxt
    c.summary['receivable'] = str(outstanding)
    cols = ['Աղբյուր', 'Գրաֆիկ', 'Ստացվել է', 'Պետք էր', 'Տարբ.', 'Ժամանակահատված', 'Վիճակ', 'Սպասվում է']
    c.add('info', 'settlements', 'Փոխանցումներ բիզնես հաշվին',
          'Սպասվում է = Fleet-ում արդեն հաշվեգրված, բայց դեռ բանկ չհասած գումարը։',
          rows=[{k: r.get(k, '') for k in cols} for r in rows], columns=cols)


# ───────────────────────── 6. PrimeBridge ─────────────────────────
def check_primebridge(c: Ctx):
    if not (c.fleet_ok and c.pb_ok):
        return
    pbc = c.cfg['primebridge']
    win = timedelta(hours=float(pbc.get('match_window_hours', 48)))
    tol = c.tol
    lo, hi = day_start(c.day) - win, day_end(c.day) + win
    fpay = [t for t in c.data.fleet if t.kind == 'payout' and t.amount < 0 and lo <= t.at < hi]
    fees = [t for t in c.data.fleet if t.kind == 'payout_fee' and t.amount < 0 and lo <= t.at < hi]
    refunds = [t for t in c.data.fleet if (t.kind == 'payout_refund' or (t.kind == 'payout' and t.amount > 0)) and t.at >= lo]
    used, used_fee = set(), set()

    def ids_for(p):
        if p.driver_id:
            return {(pk, p.driver_id) for pk in c.cfg['parks'] if not p.park or pk == p.park}
        return {(d.park, d.id) for d in c.by_phone.get(phone_key(p.phone), []) if not p.park or d.park == p.park}

    def person(p, m, ids):
        for k in ([(m.park, m.driver_id)] if m else []) + sorted(ids):
            if k in c.drivers:
                d = c.drivers[k]
                return p.name or d.name or d.id, p.phone or d.phone
        return p.name or p.driver_id or p.phone, p.phone

    no_debit, no_debit_sum, failed_stuck, fee_on_us, fee_on_us_sum = [], ZERO, [], [], ZERO
    pb_day = [p for p in c.data.pb if p.day == c.day]
    # neighbours are matched too (a payout at 23:59 may be debited after midnight), only the audit day is reported
    pb_win = [p for p in c.data.pb if lo <= p.at < hi]
    for p in sorted(pb_win, key=lambda p: (p.day != c.day, p.at)):
        ids = ids_for(p)
        cand = [t for t in fpay if id(t) not in used and (t.park, t.driver_id) in ids and abs(t.at - p.at) <= win
                and (abs(-t.amount - p.amount) <= tol or abs(-t.amount - p.amount - p.fee) <= tol)]
        cand.sort(key=lambda t: abs(t.at - p.at))
        m = cand[0] if cand else None
        if m:
            used.add(id(m))
        if p.day != c.day:
            continue
        who, ph = person(p, m, ids)
        if p.ok and not m:
            no_debit_sum += p.amount + p.fee
            no_debit.append({'Վարորդ': who, 'Հեռախոս': ph, 'Գումար': amd(p.amount), 'Ժամ': hm(p.at), 'PB №': p.ref})
        elif not p.ok and m:
            back = [r for r in refunds if (r.park, r.driver_id) == (m.park, m.driver_id) and r.at >= m.at and abs(r.amount + m.amount) <= tol]
            if not back:
                failed_stuck.append({'Վարորդ': who, 'Հեռախոս': ph, 'Գումար': amd(p.amount), 'Կարգավիճակ': p.status, 'PB №': p.ref})
        if p.ok and m and p.fee > 0:
            inside = abs(-m.amount - p.amount - p.fee) <= tol
            sep = next((f for f in fees if id(f) not in used_fee and (f.park, f.driver_id) == (m.park, m.driver_id)
                        and abs(-f.amount - p.fee) <= tol), None)
            if sep:
                used_fee.add(id(sep))
            if not inside and not sep:
                fee_on_us.append({'Վարորդ': who, 'Ելք': amd(p.amount), 'Միջնորդավճար': amd(p.fee), 'PB №': p.ref})
                fee_on_us_sum += p.fee
    no_pb = [t for t in fpay if t.day == c.day and id(t) not in used]
    ok_day = [p for p in pb_day if p.ok]
    sent = sum((p.amount for p in ok_day), ZERO)
    fee_sum = sum((p.fee for p in ok_day), ZERO)
    c.summary['primebridge'] = {'n': len(ok_day), 'sent': str(sent), 'fees': str(fee_sum)}
    c.add('info', 'pb_day', f'PrimeBridge-ով վարորդներին ուղարկվել է {amd(sent)}', f'{len(ok_day)} փոխանցում, միջնորդավճար՝ {amd(fee_sum)}', amount=sent)
    if no_debit:
        c.add('crit', 'pb_no_debit', f'PrimeBridge-ը ուղարկել է գումար, բայց Fleet-ում վարորդի հաշվից չի հանվել՝ {len(no_debit)} հատ',
              f'Սա պարկի կորուստ է՝ {amd(no_debit_sum)} (միջնորդավճարով)։', amount=no_debit_sum, rows=no_debit, columns=list(no_debit[0]))
    if fee_on_us:
        lvl = 'crit' if pbc['fee_payer'] == 'driver' else 'info'
        c.add(lvl, 'pb_fee_on_us', f'PrimeBridge-ի միջնորդավճարը վճարել ենք ՄԵՆՔ՝ {amd(fee_on_us_sum)} ({len(fee_on_us)} փոխանցում)',
              'Վարորդի հաշվից հանվել է միայն ուղարկված գումարը, միջնորդավճարը՝ ոչ։', amount=fee_on_us_sum,
              rows=fee_on_us, columns=list(fee_on_us[0]))
    if failed_stuck:
        c.add('warn', 'pb_failed_no_refund', f'Չկայացած փոխանցումներ, որոնց գումարը վարորդին չի վերադարձվել՝ {len(failed_stuck)}',
              'Fleet-ում հաշվից հանվել է, PrimeBridge-ում չի կատարվել, վերադարձ չկա։', rows=failed_stuck, columns=list(failed_stuck[0]))
    if no_pb:
        r = [{'Պարկ': c.park_name(t.park), 'Վարորդ': c.who(t.park, t.driver_id)[0], 'Գումար': amd(-t.amount), 'Ժամ': hm(t.at)} for t in no_pb]
        c.add('warn', 'fleet_payout_no_pb', f'Fleet-ում ելք կա, PrimeBridge-ում փոխանցում չկա՝ {len(no_pb)} հատ',
              f'Ընդամենը {amd(-sum((t.amount for t in no_pb), ZERO))}։ Կամ սպասման մեջ է, կամ ուրիշ ճանապարհով է գնացել։',
              rows=r, columns=list(r[0]))
    if ok_day and not (no_debit or fee_on_us or no_pb):
        c.add('ok', 'pb_match', f'PrimeBridge-ի {len(ok_day)} փոխանցումը համընկնում է Fleet-ի ելքերի հետ ✓', '')


# ───────────────────────── 7. bank day, position ─────────────────────────
SRC_NAME = {'yandex': 'Yandex', 'idram': 'Idram', 'telcell': 'Telcell', 'easypay': 'EasyPay', 'primebridge': 'PrimeBridge', '': 'Չճանաչված'}


def check_bank(c: Ctx):
    if not c.bank_ok:
        return
    bank = list(c.data.bank)
    day = [b for b in bank if b.day == c.day]
    g = defaultdict(lambda: [ZERO, ZERO])
    for b in day:
        g[b.source][0 if b.amount > 0 else 1] += b.amount
    rows = [{'Աղբյուր': SRC_NAME.get(s, s), 'Մուտք': amd(i), 'Ելք': amd(o)} for s, (i, o) in sorted(g.items(), key=lambda x: x[0] == '')]
    inc = sum((v[0] for v in g.values()), ZERO)
    out = sum((v[1] for v in g.values()), ZERO)
    c.add('info', 'bank_day', f'Բիզնես հաշիվ՝ մուտք {amd(inc)}, ելք {amd(-out)}', f'Զուտ՝ {amd(inc + out, sign=True)}',
          rows=rows, columns=['Աղբյուր', 'Մուտք', 'Ելք'] if rows else [])
    unk = [b for b in day if b.amount > 0 and not b.source]
    if unk:
        r = [{'Գումար': amd(b.amount), 'Ումից': b.counterparty[:40], 'Նպատակ': b.purpose[:60], 'Տող': b.row} for b in unk]
        c.add('warn', 'bank_unknown_in', f'Չճանաչված մուտքեր՝ {len(unk)} ({amd(sum((b.amount for b in unk), ZERO))})',
              'Չեն համապատասխանում Yandex/Idram/Telcell/EasyPay կանոններին։ Կամ ուրիշ եկամուտ է, կամ պետք է ավելացնել կանոն։',
              rows=r, columns=list(r[0]))
    # running-balance continuity (in the bank's own row order)
    seq = [b for b in bank if b.balance is not None]
    if len(seq) >= 2 and seq[0].at > seq[-1].at:
        seq.reverse()
    breaks = []
    for p, q in zip(seq, seq[1:]):
        if abs(p.balance + q.amount - q.balance) > c.tol:
            breaks.append({'Տող': q.row, 'Ամսաթիվ': dmy(q.at), 'Նախորդ մնացորդ': amd(p.balance), 'Գործարք': amd(q.amount, sign=True),
                           'Մնացորդ': amd(q.balance), 'Պետք էր': amd(p.balance + q.amount)})
    if breaks:
        c.add('warn', 'bank_breaks', f'Քաղվածքի մնացորդը չի կապվում {len(breaks)} տեղում',
              'Հնարավոր է՝ քաղվածքում տողեր պակասում են։', rows=breaks[:20], columns=list(breaks[0]))
    closing = next((b.balance for b in reversed(seq) if b.day <= c.day), None)
    if closing is not None:
        c.summary['bank_closing'] = str(closing)
        if closing < 0:
            c.add('crit', 'bank_negative', f'Բիզնես հաշվի մնացորդը մինուս է՝ {amd(closing)}', '')


def check_position(c: Ctx):
    s = c.summary
    if 'bank_closing' not in s or 'balances' not in s:
        return
    bank = Decimal(s['bank_closing'])
    owed = Decimal(s['balances']['owed_to_drivers'])
    recv = Decimal(s.get('receivable', '0'))
    pb = c.data.pb_balance or ZERO
    pos = bank + pb + recv - owed
    verified = c.cfg['categories_verified'] and c.cfg['yandex'].get('formula_verified')
    rows = [{'Հոդված': 'Բիզնես հաշիվ', 'Գումար': amd(bank)}, {'Հոդված': 'PrimeBridge-ի մնացորդ', 'Գումար': amd(pb) if c.data.pb_balance is not None else '—'},
            {'Հոդված': 'Դեռ գալու է (Idram/Telcell/EasyPay' + (', Yandex' if c.cfg['yandex'].get('formula_verified') else '') + ')', 'Գումար': amd(recv)},
            {'Հոդված': 'Պարտք ենք վարորդներին (դրական մնացորդներ)', 'Գումար': amd(-owed)}, {'Հոդված': 'Արդյունք', 'Գումար': amd(pos, sign=True)}]
    lvl = 'ok' if pos >= 0 else ('crit' if verified else 'warn')
    c.add(lvl, 'position', 'Մինուսում չենք' if pos >= 0 else f'ՄԻՆՈՒՍ ենք՝ {amd(pos)}',
          'Մեր գումարը + գալիքը − այն, ինչ վարորդները կարող են հանել։', amount=pos, rows=rows, columns=['Հոդված', 'Գումար'])


def run(data: Data, cfg: dict, day: date):
    if data.fleet is not None:
        classify_fleet(data.fleet, cfg)      # always against the config of this run
    c = Ctx(data, cfg, day)
    check_inputs(c)
    check_unknown_categories(c)
    check_topups(c)
    check_withdrawals(c)
    check_manual(c)
    check_balances(c)
    check_settlements(c)
    check_primebridge(c)
    check_bank(c)
    check_position(c)
    return c.f, c.summary
