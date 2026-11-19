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
from . import letters, provider_reports
from .loaders import classify_bank, classify_fleet
from .model import Data, Finding
from .util import WEEKDAYS_HY, ZERO, amd, day_end, day_start, dmy, hm, pct, phone_key

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
        self.tx_by_driver = defaultdict(list)
        for t in data.fleet or []:
            self.tx_by_driver[(t.park, t.driver_id)].append(t)

    def add(self, level, code, title, detail='', amount=None, rows=None, columns=None, park='', data=None):
        self.f.append(Finding(level, code, title, detail, amount, rows or [], columns or [], park, data or {}))

    def who(self, park, driver_id):
        d = self.drivers.get((park, driver_id))
        return (d.name if d and d.name else driver_id), (d.phone if d else '')

    def park_name(self, p):
        return self.cfg['parks'].get(p, {}).get('name', p)

    def prov_for(self, typ, park) -> dict:
        """Provider contract (config) of this type that serves this park."""
        return next((pc for pc in self.cfg['providers'].values() if pc['type'] == typ and park in pc['parks']), {})

    def snap_late(self, d) -> bool:
        """Balance taken after the end of the Fleet data: the opening balance cannot be derived."""
        u = self.data.fleet_until
        return bool(d.balance is not None and d.balance_at and u and d.balance_at > u + timedelta(minutes=2))

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
        else:
            # an empty day for a park that worked all week = a broken export, not a quiet day
            for p in sorted(d.fleet_parks):
                today = sum(1 for t in d.fleet if t.park == p and t.day == c.day)
                week = sum(1 for t in d.fleet if t.park == p and c.day - timedelta(days=7) <= t.day < c.day)
                if not today and week:
                    c.add('skip', 'fleet_empty_day', f'Fleet · {c.park_name(p)}՝ {dmy(c.day)}-ին ոչ մի գործարք',
                          f'Նախորդ 7 օրում կար {week}։ Հավանաբար արտահանումը թերի է։', park=p)
        need_from = day_start(c.day - timedelta(days=int(cfg['lookback_days'])))
        if d.fleet_from and d.fleet_from > need_from:
            c.add('info', 'fleet_history', 'Fleet-ի պատմությունը կարճ է',
                  f'Կա {dmy(d.fleet_from)}-ից, պետք է {dmy(need_from)}-ից. ելքերի ծագումը ավելի կոպիտ է։')
        if not cfg['categories_verified']:
            c.add('skip', 'cats_unverified', 'Fleet-ի կատեգորիաների համապատասխանությունը դեռ հաստատված չէ',
                  'config.json-ում categories_verified=false։ Թվերը նախնական են, մինչև տերը կհաստատի։')
    if d.drivers is None:
        c.add('skip', 'no_drivers', 'Վարորդների հաշվեկշիռները չկան',
              'Պարտքերի ցուցակը և «մինուս ենք թե ոչ»-ը չեն ստուգվել, ելքերի ծագումը՝ մոտավոր։')
    else:
        unknown = [x for x in d.drivers if x.balance is None]
        if unknown:
            c.add('skip', 'balances_missing', f'{len(unknown)} վարորդի հաշվեկշիռը անհայտ է (ընդամենը {len(d.drivers)})',
                  'Պարտքերը և «մինուս ենք թե ոչ»-ը չեն ստուգվել։ Վարորդների ֆայլում պետք է balance սյունակ։')
        late = [x for x in d.drivers if c.snap_late(x)]
        if late:
            c.add('skip', 'balances_after_fleet', f'{len(late)} վարորդի հաշվեկշիռը վերցված է Fleet-ի տվյալներից ՀԵՏՈ',
                  f'Fleet-ը՝ մինչև {d.fleet_until:%d.%m.%Y %H:%M}։ Այդ վարորդների ելքերի ծագումը մոտավոր է։ '
                  'Հաշվեկշիռները պետք է վերցնել գործարքներից առաջ։')
    if d.bank is None:
        c.add('skip', 'no_bank', 'Բիզնես հաշվի քաղվածքը չկա',
              'Yandex, Idram, Telcell, EasyPay փոխանցումները չեն ստուգվել։')
    else:
        # accounts whose statement must be present (e.g. the main taxi account): side accounts alone are not enough
        loaded = {b.account for b in d.bank} | set(d.bank_opening)
        for acc, a in (cfg['bank'].get('accounts') or {}).items():
            if a.get('required') and acc not in loaded:
                c.add('skip', 'bank_account_missing', f'Չկա «{a.get("name", acc)}» ({acc}) հաշվի քաղվածքը',
                      'Այս հաշվին եկող փոխանցումները չեն ստուգվել։ Արտահանիր քաղվածքը IDBanking-ից կամ Idram հավելվածից։')
    if d.bank is not None and not c.bank_ok:
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

    # the threshold is on what the driver PAID: Fleet shows the amount after the provider's commission
    # (Idram: pays 10 000, 9 800 lands). Paid = the provider report's gross, else net ÷ (1 − contract %).
    def paid(t):
        if id(t) in c.pr_gross:
            return c.pr_gross[id(t)], ''
        r = c.prov_for(t.provider, t.park).get('contract_fee_pct')
        if r:
            return (t.amount / (1 - Decimal(str(r)) / 100)).quantize(Decimal(1)), '≈'
        return t.amount, ''

    singles = [t for t in tops if paid(t)[0] >= big]
    if singles:
        r = []
        for t in singles:
            nm, ph = c.who(t.park, t.driver_id)
            g, est = paid(t)
            r.append({'Պարկ': c.park_name(t.park), 'Վարորդ': nm, 'Հեռախոս': ph, 'Համակարգ': PROV_NAME.get(t.provider, t.provider),
                      'Վճարել է': est + amd(g), 'Նստել է': amd(t.amount), 'Ժամ': hm(t.at)})
        s = sum((paid(t)[0] for t in singles), ZERO)
        c.add('warn', 'topup_large', f'Մեծ լիցքավորումներ (≥ {amd(big)})՝ {len(singles)} հատ',
              f'Ընդամենը {amd(s)} (վճարած գումարով)', amount=s, rows=r, columns=list(r[0]))
    split = []
    for (p, did), lst in per_drv.items():
        s = sum((paid(t)[0] for t in lst), ZERO)
        if len(lst) >= 2 and s >= big and all(paid(t)[0] < big for t in lst):
            nm, ph = c.who(p, did)
            split.append({'Պարկ': c.park_name(p), 'Վարորդ': nm, 'Հեռախոս': ph, 'Քանակ': len(lst),
                          'Գումարներ': ' + '.join(amd(paid(t)[0]) for t in lst), 'Օրվա ընդամենը': amd(s)})
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
    if d is not None and d.balance is not None and not c.snap_late(d):
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
            took = debit(-a, EARN_ORDER)
            if t.day == c.day:
                payouts.append((t, took))
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
    flagged, n, total, from_top_total = [], 0, ZERO, ZERO
    over = {True: ([], [ZERO]), False: ([], [ZERO])}       # approx? -> rows, total
    for (park, did), txs in by_drv.items():
        if not any(t.kind == 'payout' and t.day == c.day for t in txs):
            continue
        # same timestamp: credits first, so an order's income is in before its fee
        txs.sort(key=lambda t: (t.at, t.amount < 0, t.id))
        payouts, approx = _ledger(c, park, did, txs, cashless)
        nm, ph = c.who(park, did)
        week_tops = sum((t.amount for t in txs if t.kind == 'topup' and t.amount > 0
                         and c.day - timedelta(days=6) <= t.day <= c.day), ZERO)
        for t, took in payouts:
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
                over[approx][1][0] += took['D']
                over[approx][0].append({**row, 'Մնացորդից ավել': amd(took['D'])})
    c.summary['payouts'] = {'n': n, 'sum': str(total), 'from_topups': str(from_top_total)}
    if flagged:
        c.add('warn', 'payout_from_topup', f'Ելքեր լիցքավորված գումարից՝ {len(flagged)} հատ',
              f'Վարորդը հանել է գումար, որը պատվերներից չի վաստակել, այլ լիցքավորել է ({amd(from_top_total)} ընդամենը)։ '
              f'Դրա լիցքավորման և ելքի միջնորդավճարները կարող են մեր վրա ընկնել։',
              amount=from_top_total, rows=flagged, columns=list(flagged[0]))
    for approx, (rows, tot) in over.items():
        if rows:
            c.add('warn' if approx else 'crit', 'payout_over_balance_approx' if approx else 'payout_over_balance',
                  f'Ելք՝ հաշվեկշռից ավել՝ {len(rows)} հատ' + (' (մոտավոր)' if approx else ''),
                  f'Վարորդին փոխանցվել է ավելին, քան ուներ հաշվին → {amd(tot[0])} պարկի գումարն է։'
                  + (' Սկզբնական մնացորդը անհայտ է, ստուգել։' if approx else ''),
                  amount=tot[0], rows=rows, columns=list(rows[0]))
    if n and not flagged and not over[True][0] and not over[False][0]:
        c.add('ok', 'payouts_clean', f'Վարորդների {n} ելքը ({amd(total)}) պատվերներից վաստակած գումարից է', '')
    elif not n:
        c.add('info', 'payouts_none', 'Այդ օրը Fleet-ում վարորդների ելք չկա', '')


# ───────────────────────── 4. balances, manual credits ─────────────────────────
def _balance_end_of_day(c: Ctx, d):
    """Driver balance at the end of the audit day, from the snapshot and the transactions in between."""
    if d.balance is None or c.snap_late(d):
        return None
    snap, end = d.balance_at or c.data.fleet_until, day_end(c.day)
    txs = c.tx_by_driver.get((d.park, d.id), [])
    if snap >= end:
        return d.balance - sum((t.amount for t in txs if t.kind != 'ignore' and end <= t.at < snap), ZERO)
    return d.balance + sum((t.amount for t in txs if t.kind != 'ignore' and snap <= t.at < end), ZERO)


def check_balances(c: Ctx):
    if c.data.drivers is None:
        return
    lim = T(c.cfg, 'debt_alert_amd')
    bal = [(d, _balance_end_of_day(c, d) if c.fleet_ok else d.balance) for d in c.data.drivers]
    known = [(d, b) for d, b in bal if b is not None]
    neg = sorted(((d, b) for d, b in known if b < 0), key=lambda x: x[1])
    pos = sum((b for _, b in known if b > 0), ZERO)
    debt = -sum((b for _, b in neg), ZERO)
    complete = len(known) == len(bal) and bool(bal)
    c.summary['balances'] = {'owed_to_drivers': str(pos), 'drivers_owe': str(debt), 'debtors': len(neg), 'complete': complete}
    if not known:
        return
    c.add('info', 'balances', f'Վարորդների հաշիվներում՝ {amd(pos)}, պարտքեր՝ {amd(debt)} ({dmy(c.day)}-ի վերջին)',
          f'{len(neg)} վարորդ մինուսում է։ Դրական մնացորդը այն գումարն է, որ վարորդները կարող են հանել։'
          + ('' if complete else f' {len(bal) - len(known)} վարորդ հաշվի առնված չէ (մնացորդը անհայտ է)։'), amount=debt)
    big = [(d, b) for d, b in neg if -b >= lim]
    if big:
        r = [{'Պարկ': c.park_name(d.park), 'Վարորդ': d.name or d.id, 'Հեռախոս': d.phone, 'Պարտք': amd(-b)}
             for d, b in big[:int(c.cfg['thresholds']['list_limit'])]]
        c.add('warn', 'debt_big', f'Մեծ պարտքեր (≥ {amd(lim)})՝ {len(big)} վարորդ',
              f'Ընդամենը {amd(-sum((b for _, b in big), ZERO))}', rows=r, columns=list(r[0]))


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
    """Compare bank receipts from one payer with what Fleet says it owes for the CONFIGURED period.
    daily_net[d]: amount that should reach the bank for day d. ptype: 'provider' | 'yandex'.

    Only the configured period can make a receipt green. Other windows are searched only to
    explain a mismatch in words; a partial match never hides a shortfall."""
    pc = c.cfg['providers'].get(key) if ptype == 'provider' else c.cfg['yandex']
    rec = defaultdict(lambda: ZERO)
    refs = defaultdict(list)
    for b in c.data.bank:
        if b.source == key and b.amount > 0:
            rec[b.day] += b.amount
            refs[b.day].append(' '.join(x for x in (b.ref, b.purpose) if x).strip())
    first_fleet = c.fleet_day_start()
    base = {'payer': key, 'ptype': ptype, 'schedule': pc.get('schedule', '')}
    lag = int(pc['cover'].get('lag_days', 1))
    due_to = c.day - timedelta(days=lag)          # last day whose money should already have arrived

    def net(a, z):
        return sum((daily_net.get(d, ZERO) for d in _days(a, z)), ZERO)

    def gross(a, z):
        return sum((daily_gross.get(d, ZERO) for d in _days(a, z)), ZERO)

    def cnt(a, z):
        return sum((daily_cnt.get(d, 0) for d in _days(a, z)))

    row = {'Աղբյուր': title, 'Գրաֆիկ': pc.get('schedule', ''), 'Ստացվել է': '—', 'Պետք էր': '—', 'Տարբ.': '—', 'Վիճակ': ''}
    days_before = sorted(d for d in rec if d < c.day)
    last = max((d for d in rec if d <= c.day), default=None)
    maxgap = int(pc.get('max_gap_days', 3))
    word = 'լիցքավորում' if ptype == 'provider' else 'շրջանառություն'
    if last is None:
        since = max(first_fleet, c.data.bank_from or first_fleet)
        moved = gross(since, c.day)
        if not moved:
            row['Վիճակ'] = 'շարժ չկա'
        elif (c.day - since).days > maxgap:
            c.add('crit', f'{key}_none', f'{title}-ից փոխանցում չի եկել {dmy(since)}-ից ի վեր',
                  f'Բայց այդ ընթացքում Fleet-ում կա {amd(moved)} {word}։', amount=net(since, c.day),
                  data={**base, 'kind': 'none', 'from': since, 'to': due_to, 'expected': net(since, due_to),
                        'gross': gross(since, due_to)})
            row['Վիճակ'] = '🔴 չկա'
        else:
            c.add('skip', f'{key}_short_history', f'{title}՝ քաղվածքը շատ կարճ է գրաֆիկը ստուգելու համար',
                  f'Քաղվածքը՝ {dmy(since)}-ից։ Պետք է առնվազն {maxgap + 1} օր։')
            row['Վիճակ'] = '⛔'
        return row, None
    gap = (c.day - last).days
    if gap > maxgap:
        c.add('crit', f'{key}_late', f'{title}-ը ուշանում է. վերջին փոխանցումը՝ {dmy(last)} ({gap} օր առաջ)',
              f'Գրաֆիկը՝ {pc.get("schedule", "")}։ Չփոխանցված՝ ≈ {amd(net(last, c.day))}։', amount=net(last, c.day),
              data={**base, 'kind': 'late', 'last': last, 'gap': gap, 'from': last - timedelta(days=lag - 1), 'to': due_to,
                    'expected': net(last - timedelta(days=lag - 1), due_to), 'gross': gross(last - timedelta(days=lag - 1), due_to)})
    if c.day not in rec:
        wd = pc.get('weekday')
        exp_wd = pc.get('expect_weekdays')
        if wd is not None and c.day.weekday() == int(wd):
            a0 = last - timedelta(days=lag - 1)
            due = net(a0, due_to)
            c.add('crit', f'{key}_missed_day', f'{title}-ի {dmy(c.day)} ({WEEKDAYS_HY[c.day.weekday()]}) փոխանցումը չի եկել',
                  f'Գրաֆիկը՝ {pc.get("schedule", "")}։ Պետք էր փոխանցվեր {dmy(a0)}–{dmy(due_to)}-ի համար՝ {amd(due)}։', amount=due,
                  data={**base, 'kind': 'missed', 'last': last, 'from': a0, 'to': due_to, 'expected': due,
                        'gross': gross(a0, due_to)})
        elif exp_wd and c.day.weekday() in exp_wd and gap <= maxgap:
            c.add('warn', f'{key}_missed_day', f'{title}-ից {dmy(c.day)}-ին փոխանցում չի եկել', f'Վերջինը՝ {dmy(last)}։')
        row['Վիճակ'] = f'այսօր չկա, վերջինը՝ {dmy(last)}'
        return _with_next(row, _next_expected(c, pc, last, net))
    # a receipt today: compare with the configured period only
    R = rec[c.day]
    row['Ստացվել է'] = amd(R)
    prev = days_before[-1] if days_before else None
    per = _period(pc['cover'], c.day, prev)
    if per is None or per[0] < first_fleet:
        why = ('նախորդ փոխանցումը քաղվածքում չկա' if per is None else
               f'Fleet-ի պատմությունը սկսվում է {dmy(first_fleet)}-ից, պետք է {dmy(per[0])}-ից')
        c.add('skip', f'{key}_period_unknown', f'{title}՝ {amd(R)} — հնարավոր չէ համեմատել',
              f'Ժամանակահատվածը որոշելու համար {why}։ Երկարացրու քաղվածքը կամ Fleet-ի պատմությունը։', amount=R)
        row['Վիճակ'] = '⛔ չստուգվեց'
        return row, None
    a, z = per
    N, G, n = net(a, z), gross(a, z), cnt(a, z)
    diff = R - N
    row.update({'Պետք էր': amd(N), 'Տարբ.': amd(diff, sign=True), 'Ժամանակահատված': f'{dmy(a)}–{dmy(z)}'})
    nxt = net(z + timedelta(days=1), c.day)
    if abs(diff) <= c.tol:
        c.add('ok', f'{key}_match', f'{title}՝ {amd(R)} = {_what(ptype)} {dmy(a)}–{dmy(z)} ✓', '')
        row['Վիճակ'] = '✅'
        return _with_next(row, nxt)
    if rate is not None and G:
        exp = N - G * rate / 100
        # commission is rounded per payment (≤ 0.5 AMD each), capped at 0.05% of the volume
        rtol = max(c.tol, min(Decimal(n) / 2, G * Decimal('0.0005')))
        if abs(R - exp) <= rtol:
            lost = N - R
            lvl = 'ok' if fee_payer == 'park' else 'crit'
            c.add(lvl, f'{key}_fee_on_us', f'{title}-ը պահել է {pct(lost, G)} միջնորդավճար ՄԵԶԱՆԻՑ՝ {amd(lost)}',
                  f'{dmy(a)}–{dmy(z)}. վարորդներին հաշվեգրվել է {amd(N)}, բանկ է եկել {amd(R)}։ '
                  + ('Պայմանագրով միջնորդավճարը պարկն է վճարում։' if lvl == 'ok' else 'Միջնորդավճարը պետք է պահվեր վարորդից։'),
                  amount=lost, data={**base, 'kind': 'fee', 'from': a, 'to': z, 'received': R, 'expected': N,
                                     'gross': G, 'count': n, 'diff': lost, 'refs': refs[c.day]})
            row['Վիճակ'] = '🔴 միջնորդավճարը մեզնից' if lvl == 'crit' else '✅ (պարկն է վճարում)'
            return _with_next(row, nxt)
    lvl = 'crit' if verified else 'warn'
    unv = '' if verified else ' (բանաձևը դեռ հաստատված չէ)'
    hint = _explain(R, a, z, c.day, net, c.tol)
    if diff < 0:
        implied = (N - R) / G if G else None
        fee_like = ptype == 'provider' and implied is not None and 0 < implied <= Decimal('0.05')
        c.add(lvl, f'{key}_short', f'{title}-ից պակաս է եկել {amd(-diff)}{unv}',
              f'{dmy(a)}–{dmy(z)}. պետք էր {amd(N)}, եկել է {amd(R)} ({pct(N - R, G)} {word}ից'
              f'{", նման է մեզանից պահված միջնորդավճարի" if fee_like else ""})։ {hint}', amount=-diff,
              data={**base, 'kind': 'short', 'from': a, 'to': z, 'received': R, 'expected': N, 'gross': G,
                    'count': n, 'diff': -diff, 'refs': refs[c.day], 'fee_like': fee_like})
        row['Վիճակ'] = '🔴 պակաս' if lvl == 'crit' else '🟠 պակաս'
    else:
        c.add('warn', f'{key}_over', f'{title}-ից ավել է եկել {amd(diff)}{unv}',
              f'{dmy(a)}–{dmy(z)}. Fleet-ում {amd(N)}, բանկում {amd(R)}։ '
              + ('Հնարավոր է՝ ինչ-որ վարորդի վճարում չի հաշվեգրվել Fleet-ում։ ' if ptype == 'provider' else '') + hint,
              amount=diff, data={**base, 'kind': 'over', 'from': a, 'to': z})
        row['Վիճակ'] = '🟠 ավել'
    return _with_next(row, nxt)


def _explain(R, a, z, day, net, tol):
    """Words only: which days the received amount does match, if any."""
    for aa in _days(a, z):
        for zz in _days(aa, z):
            if (aa, zz) != (a, z) and abs(net(aa, zz) - R) <= tol:
                return f'Եկած գումարը համապատասխանում է միայն {dmy(aa)}–{dmy(zz)} օրերին. մնացած օրերի գումարը չի եկել։'
    for zz in _days(z + timedelta(days=1), day):
        if abs(net(a, zz) - R) <= tol:
            return f'Եկած գումարը համապատասխանում է {dmy(a)}–{dmy(zz)} օրերին. ստուգել config-ի cover կանոնը։'
    return ''


def _what(ptype):
    return 'Fleet-ի լիցքավորումները' if ptype == 'provider' else 'Fleet-ի հաշվարկը'


def _with_next(row, nxt):
    if nxt is not None:
        row['Սպասվում է'] = amd(nxt)
    return row, nxt


def _next_expected(c, pc, last, net):
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
        for t in _txs(c, kinds={'topup', 'topup_fee'}, provider=pc['type'], parks=parks):
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
    """Pair every PrimeBridge row with one Fleet debit, over ALL loaded rows (not just the audit
    day), successful rows first and then by closest time, so a neighbour day cannot steal a debit
    and a duplicate payout cannot hide. Only the audit day is reported."""
    if not (c.fleet_ok and c.pb_ok):
        return
    pbc = c.cfg['primebridge']
    win = timedelta(hours=float(pbc.get('match_window_hours', 48)))
    tol = c.tol
    pay = defaultdict(list)       # (park, driver) -> Fleet payout debits
    fee_tx = defaultdict(list)
    refund_tx = defaultdict(list)
    for t in c.data.fleet:
        k = (t.park, t.driver_id)
        if t.kind == 'payout' and t.amount < 0:
            pay[k].append(t)
        elif t.kind == 'payout_fee' and t.amount < 0:
            fee_tx[k].append(t)
        elif t.kind == 'payout_refund' or (t.kind == 'payout' and t.amount > 0):
            refund_tx[k].append(t)

    def ids_for(p):
        if p.driver_id:
            return {(pk, p.driver_id) for pk in c.cfg['parks'] if not p.park or pk == p.park}
        return {(d.park, d.id) for d in c.by_phone.get(phone_key(p.phone), []) if not p.park or d.park == p.park}

    rank = {'ok': 0, 'pending': 1, 'failed': 2}
    pairs = []
    for i, p in enumerate(c.data.pb):
        for k in ids_for(p):
            for t in pay.get(k, []):
                dt = abs(t.at - p.at)
                if dt <= win and (abs(-t.amount - p.amount) <= tol or abs(-t.amount - p.amount - p.fee) <= tol):
                    pairs.append((rank[p.state], dt, i, id(t), t))
    pairs.sort(key=lambda x: (x[0], x[1], x[2]))
    match, used = {}, set()
    for _, _, i, tid, t in pairs:
        if i not in match and tid not in used:
            match[i] = t
            used.add(tid)

    # refunds: failed/pending payouts claim them first; one left over after a SUCCESSFUL payout = paid twice
    used_ref, refunded = set(), {}
    order = sorted(match, key=lambda i: (c.data.pb[i].state == 'ok', c.data.pb[i].at))
    for i in order:
        m = match[i]
        r = next((r for r in sorted(refund_tx.get((m.park, m.driver_id), []), key=lambda r: r.at)
                  if id(r) not in used_ref and m.at <= r.at <= m.at + win and abs(r.amount + m.amount) <= tol), None)
        if r:
            used_ref.add(id(r))
            refunded[i] = r
    # separate fee lines: each one used once, close in time, all rows in chronological order
    used_fee, fee_paid_by_driver = set(), set()
    for i in sorted(match, key=lambda i: c.data.pb[i].at):
        p, m = c.data.pb[i], match[i]
        if not p.ok or p.fee <= 0:
            continue
        if abs(-m.amount - p.amount - p.fee) <= tol:
            fee_paid_by_driver.add(i)
            continue
        f = next((f for f in sorted(fee_tx.get((m.park, m.driver_id), []), key=lambda f: abs(f.at - m.at))
                  if id(f) not in used_fee and abs(f.at - m.at) <= win and abs(-f.amount - p.fee) <= tol), None)
        if f:
            used_fee.add(id(f))
            fee_paid_by_driver.add(i)

    def person(p, m):
        for k in ([(m.park, m.driver_id)] if m else []) + sorted(ids_for(p)):
            if k in c.drivers:
                d = c.drivers[k]
                return p.name or d.name or d.id, p.phone or d.phone
        return p.name or p.driver_id or p.phone, p.phone

    no_debit, twice, stuck, fee_on_us = [], [], [], []
    s_no_debit = s_twice = s_fee = ZERO
    day_rows = [(i, p) for i, p in enumerate(c.data.pb) if p.day == c.day]
    for i, p in sorted(day_rows, key=lambda x: x[1].at):
        m = match.get(i)
        who, ph = person(p, m)
        base = {'Վարորդ': who, 'Հեռախոս': ph, 'Գումար': amd(p.amount), 'Ժամ': hm(p.at), 'PB №': p.ref}
        if p.ok and not m:
            s_no_debit += p.amount + p.fee
            no_debit.append(base)
        elif p.ok and i in refunded:
            s_twice += p.amount
            twice.append({**base, 'Վերադարձ': f'{amd(refunded[i].amount)} · {refunded[i].at:%d.%m %H:%M}'})
        elif p.state == 'failed' and m and i not in refunded:
            stuck.append({**base, 'Կարգավիճակ': p.status})
        if p.ok and m and p.fee > 0 and i not in fee_paid_by_driver:
            s_fee += p.fee
            fee_on_us.append({'Վարորդ': who, 'Ելք': amd(p.amount), 'Միջնորդավճար': amd(p.fee), 'PB №': p.ref})
    no_pb = [t for k, lst in pay.items() for t in lst if t.day == c.day and id(t) not in used]
    stray = [r for k, lst in refund_tx.items() for r in lst if r.day == c.day and id(r) not in used_ref]
    ok_day = [p for _, p in day_rows if p.ok]
    sent = sum((p.amount for p in ok_day), ZERO)
    fee_sum = sum((p.fee for p in ok_day), ZERO)
    c.summary['primebridge'] = {'n': len(ok_day), 'sent': str(sent), 'fees': str(fee_sum)}
    c.add('info', 'pb_day', f'PrimeBridge-ով վարորդներին ուղարկվել է {amd(sent)}',
          f'{len(ok_day)} փոխանցում, միջնորդավճար՝ {amd(fee_sum)}', amount=sent)
    if no_debit:
        c.add('crit', 'pb_no_debit', f'PrimeBridge-ը ուղարկել է գումար, բայց Fleet-ում վարորդի հաշվից չի հանվել՝ {len(no_debit)} հատ',
              f'Սա պարկի կորուստ է՝ {amd(s_no_debit)} (միջնորդավճարով)։ Կրկնակի փոխանցումն էլ է այստեղ երևում։',
              amount=s_no_debit, rows=no_debit, columns=list(no_debit[0]))
    if twice:
        c.add('crit', 'pb_paid_twice', f'Հաջող փոխանցումից հետո Fleet-ում գումարը վերադարձվել է վարորդին՝ {len(twice)} հատ',
              f'Վարորդը ստացել է երկու անգամ՝ {amd(s_twice)}։', amount=s_twice, rows=twice, columns=list(twice[0]))
    if fee_on_us:
        lvl = 'crit' if pbc['fee_payer'] == 'driver' else 'info'
        c.add(lvl, 'pb_fee_on_us', f'PrimeBridge-ի միջնորդավճարը վճարել ենք ՄԵՆՔ՝ {amd(s_fee)} ({len(fee_on_us)} փոխանցում)',
              'Վարորդի հաշվից հանվել է միայն ուղարկված գումարը, միջնորդավճարը՝ ոչ։', amount=s_fee,
              rows=fee_on_us, columns=list(fee_on_us[0]))
    if stuck:
        c.add('warn', 'pb_failed_no_refund', f'Չկայացած փոխանցումներ, որոնց գումարը վարորդին չի վերադարձվել՝ {len(stuck)}',
              'Fleet-ում հաշվից հանվել է, PrimeBridge-ում չի կատարվել, վերադարձ չկա։', rows=stuck, columns=list(stuck[0]))
    if no_pb:
        r = [{'Պարկ': c.park_name(t.park), 'Վարորդ': c.who(t.park, t.driver_id)[0], 'Գումար': amd(-t.amount), 'Ժամ': hm(t.at)} for t in no_pb]
        c.add('warn', 'fleet_payout_no_pb', f'Fleet-ում ելք կա, PrimeBridge-ում փոխանցում չկա՝ {len(no_pb)} հատ',
              f'Ընդամենը {amd(-sum((t.amount for t in no_pb), ZERO))}։ Կամ սպասման մեջ է, կամ ուրիշ ճանապարհով է գնացել։',
              rows=r, columns=list(r[0]))
    if stray:
        r = [{'Պարկ': c.park_name(t.park), 'Վարորդ': c.who(t.park, t.driver_id)[0], 'Գումար': amd(t.amount), 'Ժամ': hm(t.at)} for t in stray]
        c.add('warn', 'fleet_refund_unexplained', f'Fleet-ում ելքի վերադարձ կա, բայց չկայացած PrimeBridge փոխանցում չկա՝ {len(stray)}',
              'Ստուգել՝ ինչու է գումարը վերադարձվել վարորդին։', rows=r, columns=list(r[0]))
    if ok_day and not (no_debit or twice or fee_on_us or no_pb or stray):
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
    # running balance per account, in the bank's own row order; balances may be per row or per day
    breaks, closing, known = [], ZERO, True
    accounts = defaultdict(list)
    for b in bank:
        accounts[b.account].append(b)
    for acc, seq in accounts.items():
        if len(seq) >= 2 and seq[0].at > seq[-1].at:
            seq = seq[::-1]
        run = c.data.bank_opening.get(acc)
        at_day = run
        for b in seq:
            if run is not None:
                run += b.amount
            if b.balance is not None:
                if run is not None and abs(run - b.balance) > c.tol:
                    breaks.append({'Հաշիվ': acc, 'Տող': b.row, 'Ամսաթիվ': dmy(b.at), 'Գործարք': amd(b.amount, sign=True),
                                   'Մնացորդ': amd(b.balance), 'Պետք էր': amd(run)})
                run = b.balance
            if b.day <= c.day:
                at_day = run
        if at_day is None:
            known = False
        else:
            closing += at_day
    if breaks:
        c.add('warn', 'bank_breaks', f'Քաղվածքի մնացորդը չի կապվում {len(breaks)} տեղում',
              'Հնարավոր է՝ քաղվածքում տողեր պակասում են։', rows=breaks[:20], columns=list(breaks[0]))
    closing = closing if known and accounts else None
    if c.data.bank_closing is not None:
        if closing is not None and abs(closing - c.data.bank_closing) > c.tol:
            c.add('warn', 'bank_balance_differs', f'Քաղվածքի մնացորդը ({amd(closing)}) ≠ ձեռքով տրվածին ({amd(c.data.bank_closing)})', '')
        closing = c.data.bank_closing
    if closing is not None:
        c.summary['bank_closing'] = str(closing)
        if closing < 0:
            c.add('crit', 'bank_negative', f'Բիզնես հաշվի մնացորդը մինուս է՝ {amd(closing)}', '')


def check_position(c: Ctx):
    s = c.summary
    if not c.bank_ok or c.data.drivers is None:
        return                                   # already reported as ⛔ above
    closing = s.get('bank_closing')
    if closing is None:
        c.add('skip', 'position_no_bank_balance', '«Մինուս ենք թե ոչ»-ը չստուգվեց. բանկի մնացորդը անհայտ է',
              'Քաղվածքում մնացորդի սյունակ չկա։ Արտահանիր մնացորդով կամ տուր --bank-balance։')
        return
    if not s.get('balances', {}).get('complete'):
        return                                   # balances_missing / balances_after_fleet already reported
    bank = Decimal(closing)
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
          f'{dmy(c.day)}-ի վերջին. մեր գումարը + գալիքը − այն, ինչ վարորդները կարող են հանել։', amount=pos, rows=rows, columns=['Հոդված', 'Գումար'])


FLEET_DAY = [   # (label, predicate) — everything that moved driver balances in Fleet that day
    ('Լիցքավորում · Idram', lambda t: t.kind == 'topup' and t.provider == 'idram'),
    ('Լիցքավորում · Telcell', lambda t: t.kind == 'topup' and t.provider == 'telcell'),
    ('Լիցքավորում · EasyPay', lambda t: t.kind == 'topup' and t.provider == 'easypay'),
    ('Լիցքավորում · այլ', lambda t: t.kind == 'topup' and t.provider not in ('idram', 'telcell', 'easypay')),
    ('Լիցքավորման միջնորդավճար (վարորդից)', lambda t: t.kind == 'topup_fee'),
    ('Պատվերներից եկամուտ (անկանխիկ, բոնուս)', lambda t: t.kind == 'order_income'),
    ('Yandex-ի միջնորդավճար, ԱԱՀ', lambda t: t.kind == 'order_fee' and t.party == 'platform'),
    ('Պարկի միջնորդավճար (մեր եկամուտը)', lambda t: t.kind == 'order_fee' and t.party != 'platform'),
    ('Ելքեր (PrimeBridge)', lambda t: t.kind in ('payout', 'payout_refund')),
    ('Ելքի միջնորդավճար (վարորդից)', lambda t: t.kind == 'payout_fee'),
    ('Ձեռքով', lambda t: t.kind in ('manual_credit', 'manual_debit')),
    ('Այլ', lambda t: t.kind == 'other'),
    ('Չդասակարգված', lambda t: t.kind == 'unknown'),
]


def check_fleet_day(c: Ctx):
    """The whole Fleet day per park, so nothing that moved money is invisible."""
    if not c.fleet_ok:
        return
    parks = [p for p in c.cfg['parks'] if p in c.data.fleet_parks]
    day = [t for t in c.data.fleet if t.day == c.day and t.kind != 'ignore']
    rows = []
    for label, pred in FLEET_DAY:
        sums = {p: sum((t.amount for t in day if t.park == p and pred(t)), ZERO) for p in parks}
        cnts = {p: sum(1 for t in day if t.park == p and pred(t)) for p in parks}
        if any(cnts.values()):
            rows.append({'Հոդված': label, **{c.park_name(p): f'{amd(sums[p], sign=True)} ({cnts[p]})' for p in parks}})
    tot = {p: sum((t.amount for t in day if t.park == p), ZERO) for p in parks}
    rows.append({'Հոդված': 'Վարորդների հաշիվների փոփոխություն', **{c.park_name(p): amd(tot[p], sign=True) for p in parks}})
    c.add('info', 'fleet_day', f'Fleet · {dmy(c.day)} օրը ըստ պարկի', 'Վարորդների հաշիվներից/հաշիվներին (+ մտել է, − դուրս է եկել), փակագծում՝ քանակը։',
          rows=rows, columns=['Հոդված'] + [c.park_name(p) for p in parks])


def run(data: Data, cfg: dict, day: date):
    if data.fleet is not None:
        classify_fleet(data.fleet, cfg)      # always against the config of this run
    for b in data.bank or []:
        b.source = classify_bank(b, cfg)
    c = Ctx(data, cfg, day)
    provider_reports.match(c)
    check_inputs(c)
    check_unknown_categories(c)
    check_topups(c)
    check_withdrawals(c)
    check_manual(c)
    check_balances(c)
    check_settlements(c)
    provider_reports.check(c)
    check_primebridge(c)
    check_bank(c)
    check_position(c)
    check_fleet_day(c)
    c.summary['letters'] = letters.build(c, c.f) if c.fleet_ok else []
    return c.f, c.summary
