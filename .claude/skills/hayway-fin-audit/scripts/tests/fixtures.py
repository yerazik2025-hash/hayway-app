"""Synthetic, fully deterministic test data. No real drivers or numbers.

Audit day D = Monday 16.11.2026. Each scenario below is planted on purpose;
test_audit.py asserts that every one of them is caught (and nothing else).
"""
from __future__ import annotations

import csv
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

from finaudit.config import load_config
from finaudit.loaders import classify_bank, classify_fleet
from finaudit.model import BankTx, Data, Driver, FleetTx, PBPayout
from finaudit.util import YEREVAN, day_end, day_start

D = date(2026, 11, 16)
CATS = {
    'card': {'kind': 'order_income', 'party': 'platform'},
    'tip': {'kind': 'order_income', 'party': 'platform'},
    'cash_collected': {'kind': 'ignore'},
    'platform_ride_fee': {'kind': 'order_fee', 'party': 'platform'},
    'partner_ride_fee': {'kind': 'order_fee', 'party': 'park'},
    'topup_idram': {'kind': 'topup', 'provider': 'idram', 'party': 'provider'},
    'topup_telcell': {'kind': 'topup', 'provider': 'telcell', 'party': 'provider'},
    'telcell_fee': {'kind': 'topup_fee', 'provider': 'telcell', 'party': 'provider'},
    'topup_easypay': {'kind': 'topup', 'provider': 'easypay', 'party': 'provider'},
    'payout_pb': {'kind': 'payout', 'party': 'park'},
    'payout_pb_fee': {'kind': 'payout_fee', 'party': 'park'},
    'payout_pb_refund': {'kind': 'payout_refund', 'party': 'park'},
    'manual_bonus': {'kind': 'manual_credit', 'party': 'park'},
    'rent': {'kind': 'manual_debit', 'party': 'park'},
}


def test_config(tmp: Path, **over):
    import json
    cfg = {'categories_verified': True, 'categories': CATS,
           'providers': {'idram': {'contract_fee_pct': 1.0}, 'telcell': {'contract_fee_pct': 1.5}, 'easypay': {'contract_fee_pct': 1.0}},
           'yandex': {'formula_verified': True}}
    for k, v in over.items():
        cfg[k] = v
    p = tmp / 'config.json'
    p.write_text(json.dumps(cfg, ensure_ascii=False), encoding='utf-8')
    return load_config(p), p


class B:
    def __init__(self):
        self.tx, self.n = [], 0

    def add(self, park, at, drv, cat, amount, order='', by='', desc=''):
        self.n += 1
        self.tx.append(FleetTx(park=park, id=f't{self.n}', at=at, driver_id=drv, category_id=cat, category_name=cat,
                               amount=Decimal(amount), order_id=order, created_by=by, description=desc))


def at(d: date, h=12, m=0):
    return datetime.combine(d, time(h, m), tzinfo=YEREVAN)


def build(clean=False):
    """Returns (Data, cfg-overrides) for the scenario day. clean=True: every check passes."""
    b = B()
    start = D - timedelta(days=35)
    end_day = D + timedelta(days=1)
    o = 0
    d = start
    while d <= end_day:
        # d1 (taxi) and a1 (delivery): one cashless and one cash order every day
        for park, drv in (('taxi', 'd1'), ('delivery', 'a1')):
            o += 1
            oid = f'o{o}'
            b.add(park, at(d, 9), drv, 'card', 3000, oid)
            b.add(park, at(d, 9, 1), drv, 'platform_ride_fee', -300, oid)
            b.add(park, at(d, 9, 2), drv, 'partner_ride_fee', -150, oid)
            o += 1
            oid = f'o{o}'
            b.add(park, at(d, 11), drv, 'cash_collected', 2000, oid)
            b.add(park, at(d, 11, 1), drv, 'platform_ride_fee', -200, oid)
            b.add(park, at(d, 11, 2), drv, 'partner_ride_fee', -100, oid)
        # small daily top-ups to keep providers busy
        b.add('taxi', at(d, 8), 'd9', 'topup_idram', 2000)
        b.add('taxi', at(d, 8, 30), 'd9', 'topup_telcell', 1000)
        b.add('taxi', at(d, 8, 31), 'd9', 'telcell_fee', -15)
        b.add('delivery', at(d, 10), 'a1', 'topup_easypay', 1500)
        d += timedelta(days=1)
    pb = []
    # d1: payout from earnings, PB fee 100 inside the Fleet debit -> clean
    b.add('taxi', at(D, 14), 'd1', 'payout_pb', -5100)
    pb.append(PBPayout(at=at(D, 14, 2), amount=Decimal(5000), fee=Decimal(100), ok=True, driver_id='d1', ref='pb1'))
    # a1 (delivery): payout from earnings, no PB fee -> clean
    b.add('delivery', at(D, 15), 'a1', 'payout_pb', -2000)
    pb.append(PBPayout(at=at(D, 15, 1), amount=Decimal(2000), fee=Decimal(0), ok=True, phone='+374 99 000001', ref='pb2'))
    if not clean:
        # d2: no orders, tops up 20 000 on Sunday, withdraws 20 000 on Monday -> payout_from_topup
        b.add('taxi', at(D - timedelta(days=1), 18), 'd2', 'topup_telcell', 9000)
        b.add('taxi', at(D - timedelta(days=1), 18, 5), 'd2', 'topup_telcell', 9000)
        b.add('taxi', at(D - timedelta(days=1), 18, 6), 'd2', 'telcell_fee', -270)
        b.add('taxi', at(D, 10), 'd2', 'payout_pb', -17730)
        pb.append(PBPayout(at=at(D, 10, 1), amount=Decimal(17730), fee=Decimal(0), ok=True, driver_id='d2', ref='pb3'))
        # d3: one big Idram top-up on D -> topup_large
        b.add('taxi', at(D, 16), 'd3', 'topup_idram', 15000)
        # d4: three EasyPay top-ups of 4 000 on D -> topup_split
        for h in (9, 13, 19):
            b.add('taxi', at(D, h), 'd4', 'topup_easypay', 4000)
        # d5: manual bonus 12 000 by a dispatcher -> manual_big
        b.add('taxi', at(D, 12), 'd5', 'manual_bonus', 12000, by='dispatcher', desc='bonus')
        # d6: PB sent 7 000, no Fleet debit -> pb_no_debit (crit)
        pb.append(PBPayout(at=at(D, 17), amount=Decimal(7000), fee=Decimal(100), ok=True, driver_id='d6', ref='pb4'))
        # d7: PB fee 150 not charged to the driver -> pb_fee_on_us (crit)
        b.add('taxi', at(D - timedelta(days=3), 9), 'd7', 'manual_bonus', 9000, by='dispatcher')
        b.add('taxi', at(D, 18), 'd7', 'payout_pb', -8000)
        pb.append(PBPayout(at=at(D, 18, 3), amount=Decimal(8000), fee=Decimal(150), ok=True, driver_id='d7', ref='pb5'))
        # unknown category on D -> unknown_categories
        b.add('taxi', at(D, 20), 'd1', 'mystery', 500)
    fleet = b.tx

    drivers = [
        Driver('taxi', 'd1', 'Արամ Ա.', '+374 91 000001', None), Driver('delivery', 'a1', 'Աննա Ա.', '+374 99 000001', None),
        Driver('taxi', 'd2', 'Սուրեն Ս.', '+374 91 000002', None), Driver('taxi', 'd3', 'Կարեն Կ.', '+374 91 000003', None),
        Driver('taxi', 'd4', 'Գոռ Գ.', '+374 91 000004', None), Driver('taxi', 'd5', 'Լևոն Լ.', '+374 91 000005', None),
        Driver('taxi', 'd6', 'Նարեկ Ն.', '+374 91 000006', None), Driver('taxi', 'd7', 'Վահե Վ.', '+374 91 000007', None),
        Driver('taxi', 'd9', 'Տիգրան Տ.', '+374 91 000009', None),
    ]
    # balances at the end of the Fleet data: opening (at start) + every balance-affecting transaction
    opening = {'d1': Decimal(10000), 'd5': Decimal(0 if clean else -42000)}
    snap = max(t.at for t in fleet)
    cfg, _ = test_config(Path(_tmp()))
    classify_fleet(fleet, cfg)
    for dr in drivers:
        s = sum((t.amount for t in fleet if (t.park, t.driver_id) == (dr.park, dr.id) and t.kind != 'ignore'), Decimal(0))
        dr.balance = opening.get(dr.id, Decimal(0)) + s
        dr.balance_at = snap + timedelta(seconds=1)

    # ── bank ──
    def day_sum(pred, a, z):
        return sum((t.amount for t in fleet if pred(t) and a <= t.day <= z), Decimal(0))
    is_idram = lambda t: t.category_id == 'topup_idram'
    is_tel = lambda t: t.category_id in ('topup_telcell', 'telcell_fee')
    is_easy = lambda t: t.category_id == 'topup_easypay'
    is_yx = lambda t: CATS.get(t.category_id, {}).get('party') == 'platform'
    bank = []

    def rec(day, h, amount, cp, purpose=''):
        bank.append(BankTx(at=at(day, h), amount=Decimal(amount), counterparty=cp, purpose=purpose))
    wd = lambda x: x.weekday() < 5
    days = [D - timedelta(days=i) for i in range(20, -1, -1)]
    prev_y = prev_i = None
    for x in days:
        if wd(x):
            if prev_y:   # Yandex: weekdays, covers since previous receipt (lag 1)
                rec(x, 11, day_sum(is_yx, prev_y - timedelta(days=0), x - timedelta(days=1)), 'Yandex.Taxi Armenia LLC')
            prev_y = x
            if prev_i:
                amt = day_sum(is_idram, prev_i, x - timedelta(days=1))
                if x == D and not clean:   # Idram keeps 1% of the gross from US on Monday
                    gross = day_sum(is_idram, prev_i, x - timedelta(days=1))
                    amt = amt - gross / 100
                rec(x, 12, amt, 'IDRAM LLC', 'Վճարումների փոխանցում')
            prev_i = x
    # Telcell: 01.11 and 11.11, each covers since the previous one
    t_prev = date(2026, 10, 22)
    for x in (date(2026, 11, 1), date(2026, 11, 11)):
        rec(x, 13, day_sum(is_tel, t_prev, x - timedelta(days=1)), 'Telcell CJSC')
        t_prev = x
    # EasyPay: Mondays; on D it is missing unless clean
    e_prev = date(2026, 10, 26)
    for x in (date(2026, 11, 2), date(2026, 11, 9)) + ((D,) if clean else ()):
        rec(x, 14, day_sum(is_easy, e_prev, x - timedelta(days=1)), 'EasyPay LLC')
        e_prev = x
    rec(D, 16, -50000, 'PrimeBridge LLC', 'Մնացորդի համալրում')
    if not clean:
        rec(D, 17, 7000, 'Unknown Trade LLC', 'payment')
    # running balance
    bank.sort(key=lambda b: b.at)
    bal = Decimal(3_000_000)
    for i, bt in enumerate(bank, start=1):
        bal += bt.amount
        bt.balance, bt.row = bal, i
        bt.source = classify_bank(bt, cfg)

    data = Data(fleet=fleet, fleet_parks={'taxi', 'delivery'}, fleet_from=day_start(start), fleet_until=day_end(end_day),
                drivers=drivers, bank=bank, bank_from=days[0], bank_until=D, pb=pb, pb_from=D, pb_until=D)
    return data


_TMP = None


def _tmp():
    global _TMP
    if _TMP is None:
        import tempfile
        _TMP = tempfile.mkdtemp(prefix='finaudit-')
    return _TMP


def write_files(data: Data, folder: Path):
    """Write the same data as CSV files in the formats the CLI reads (tests the loaders)."""
    folder.mkdir(parents=True, exist_ok=True)
    for park in ('taxi', 'delivery'):
        with open(folder / f'fleet_{park}.csv', 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            w.writerow(['id', 'event_at', 'driver_id', 'category_id', 'category_name', 'amount', 'order_id', 'created_by', 'description'])
            for t in data.fleet:
                if t.park == park:
                    w.writerow([t.id, t.at.isoformat(), t.driver_id, t.category_id, t.category_name, f'{t.amount}.0000', t.order_id, t.created_by, t.description])
    with open(folder / 'drivers.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['park', 'driver_id', 'name', 'phone', 'balance', 'balance_at'])
        for d in data.drivers:
            w.writerow([d.park, d.id, d.name, d.phone, str(d.balance), d.balance_at.isoformat()])
    # bank in an Armenian-bank-like layout: title lines, dd.mm.yyyy, credit/debit columns, '1 234,00'
    with open(folder / 'bank.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['Քաղվածք', 'ՍՊԸ ՀայՎեյ'])
        w.writerow([])
        w.writerow(['Ամսաթիվ', 'Համար', 'Ստացող/Վճարող', 'Վճարման նպատակ', 'Մուտք', 'Ելք', 'Մնացորդ'])
        fmt = lambda v: f'{v:,.2f}'.replace(',', ' ').replace('.', ',')
        for bt in data.bank:
            w.writerow([bt.at.strftime('%d.%m.%Y %H:%M'), bt.row, bt.counterparty, bt.purpose,
                        fmt(bt.amount) if bt.amount > 0 else '', fmt(-bt.amount) if bt.amount < 0 else '', fmt(bt.balance)])
    with open(folder / 'pb.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['created_at', 'driver_id', 'phone', 'amount', 'fee', 'status', 'id'])
        for p in data.pb:
            w.writerow([p.at.strftime('%Y-%m-%d %H:%M:%S'), p.driver_id, p.phone, str(p.amount), str(p.fee), 'success' if p.ok else 'failed', p.ref])
