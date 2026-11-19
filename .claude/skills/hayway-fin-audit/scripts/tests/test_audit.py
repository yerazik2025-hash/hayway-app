"""Run: cd scripts && python -m unittest discover -s tests -v"""
from __future__ import annotations

import sys
import tempfile
import unittest
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import audit  # noqa: E402
from finaudit import checks, report  # noqa: E402
from finaudit.model import Data  # noqa: E402
from finaudit.util import amd, money, parse_dt, phone_key  # noqa: E402
from fixtures import D, build, test_config, write_files  # noqa: E402


def codes(findings, level=None):
    return sorted(f.code for f in findings if level is None or f.level == level)


def find(findings, code):
    fs = [f for f in findings if f.code == code]
    assert len(fs) == 1, f'{code}: {len(fs)} findings'
    return fs[0]


class Util(unittest.TestCase):
    def test_money(self):
        for s, v in [('1 234 567,89', '1234567.89'), ('1,234,567.89', '1234567.89'), ('-1234.5600', '-1234.56'),
                     ('(500)', '-500'), ('12,5', '12.5'), ('1,234', '1234'), ('1.234,56', '1234.56'),
                     ('10 000 ֏', '10000'), ('−300', '-300'), (1500, '1500'), ('0', '0')]:
            self.assertEqual(money(s), Decimal(v), s)
        for bad in ('', 'abc', None, '1-2'):
            with self.assertRaises(ValueError):
                money(bad)

    def test_dates_phone_amd(self):
        self.assertEqual(parse_dt('2026-11-16T20:30:00+00:00').date(), date(2026, 11, 17))   # 00:30 Yerevan
        self.assertEqual(parse_dt('16.11.2026 23:59').date(), date(2026, 11, 16))
        self.assertEqual(phone_key('+374 (91) 12-34-56'), phone_key('091123456'))
        self.assertEqual(amd(Decimal('-12345')), '−12 345 ֏')
        self.assertEqual(amd(Decimal('0.4')), '0,40 ֏')


class Scenario(unittest.TestCase):
    """Every planted problem is caught, and only those."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        cls.cfg, cls.cfg_path = test_config(cls.tmp)
        cls.f, cls.s = checks.run(build(), cls.cfg, D)

    def test_exact_sets(self):
        self.assertEqual(codes(self.f, 'crit'), ['easypay_missed_day', 'idram_fee_on_us', 'pb_fee_on_us', 'pb_no_debit'])
        self.assertEqual(codes(self.f, 'warn'), ['bank_unknown_in', 'debt_big', 'manual_big', 'payout_from_topup',
                                                 'topup_large', 'topup_split', 'unknown_categories'])
        self.assertEqual(codes(self.f, 'skip'), [])

    def test_commission_taken_from_us(self):
        f = find(self.f, 'idram_fee_on_us')
        self.assertEqual(f.amount, Decimal(60))            # 1% of 3 × 2 000
        self.assertIn('13.11.2026–15.11.2026', f.detail)

    def test_large_and_split_topups(self):
        f = find(self.f, 'topup_large')
        self.assertEqual([r['Վարորդ'] for r in f.rows], ['Կարեն Կ.'])
        self.assertEqual(f.amount, Decimal(15152))                 # paid ≈ 15 000 credited ÷ (1 − 1%)
        self.assertEqual(f.rows[0]['Վճարել է'], '≈15\u00a0152\u00a0֏')
        f = find(self.f, 'topup_split')
        self.assertEqual(f.rows[0]['Վարորդ'], 'Գոռ Գ.')
        self.assertEqual(f.rows[0]['Քանակ'], 3)

    def test_withdrawal_from_topups_only_flags_d2(self):
        f = find(self.f, 'payout_from_topup')
        self.assertEqual([r['Վարորդ'] for r in f.rows], ['Սուրեն Ս.'])
        self.assertEqual(f.amount, Decimal(17730))
        self.assertEqual(self.s['payouts']['n'], 4)

    def test_primebridge(self):
        self.assertEqual(find(self.f, 'pb_no_debit').amount, Decimal(7100))
        self.assertEqual(find(self.f, 'pb_fee_on_us').amount, Decimal(150))

    def test_settlements_table(self):
        rows = {r['Աղբյուր']: r for r in find(self.f, 'settlements').rows}
        self.assertEqual(rows['Yandex']['Վիճակ'], '✅')
        self.assertTrue(rows['Idram']['Վիճակ'].startswith('🔴'))
        self.assertIn('այսօր չկա', rows['EasyPay']['Վիճակ'])
        self.assertIn('այսօր չկա', rows['Telcell']['Վիճակ'])

    def test_debt_and_manual(self):
        self.assertEqual(find(self.f, 'debt_big').rows[0]['Վարորդ'], 'Լևոն Լ.')
        self.assertEqual(find(self.f, 'manual_big').rows[0]['Ով'], 'dispatcher')

    def test_report_renders(self):
        md = report.markdown(self.f, self.s, D, self.cfg)
        self.assertIn('🔴 4 խնդիր', md)
        txt = report.short(self.f, self.s, D)
        self.assertTrue(txt.startswith('Ֆին. ստուգում 16.11.2026: 🔴'))
        report.to_json(self.f, self.s, D)


class Clean(unittest.TestCase):
    def test_all_green(self):
        tmp = Path(tempfile.mkdtemp())
        cfg, _ = test_config(tmp)
        f, s = checks.run(build(clean=True), cfg, D)
        self.assertEqual([x.code for x in f if x.level in ('crit', 'warn', 'skip')], [])
        self.assertEqual(report.status(f)[0], '✅ Ամեն ինչ ճիշտ է')
        self.assertIn('idram_match', codes(f, 'ok'))
        self.assertIn('easypay_match', codes(f, 'ok'))
        self.assertIn('yandex_match', codes(f, 'ok'))
        self.assertIn('pb_match', codes(f, 'ok'))
        self.assertIn('position', codes(f, 'ok'))


class Incomplete(unittest.TestCase):
    """Missing data must never look like 'all good'."""

    def setUp(self):
        self.cfg, _ = test_config(Path(tempfile.mkdtemp()))

    def test_no_bank(self):
        d = build(clean=True)
        d.bank = None
        f, _ = checks.run(d, self.cfg, D)
        self.assertIn('no_bank', codes(f, 'skip'))
        self.assertEqual(report.status(f)[0], '⛔ Ստուգումը թերի է')

    def test_bank_not_reaching_day(self):
        d = build(clean=True)
        d.bank_until = D - timedelta(days=1)
        f, _ = checks.run(d, self.cfg, D)
        self.assertIn('bank_short', codes(f, 'skip'))
        self.assertNotIn('settlements', codes(f))

    def test_unverified_categories(self):
        cfg, _ = test_config(Path(tempfile.mkdtemp()), categories_verified=False)
        f, _ = checks.run(build(clean=True), cfg, D)
        self.assertIn('cats_unverified', codes(f, 'skip'))

    def test_nothing(self):
        f, _ = checks.run(Data(), self.cfg, D)
        self.assertEqual(sorted(codes(f, 'skip')), ['no_bank', 'no_drivers', 'no_fleet', 'no_pb'])


class Settlement(unittest.TestCase):
    def test_short_without_contract_rate_and_alt_period(self):
        cfg, _ = test_config(Path(tempfile.mkdtemp()), providers={'idram': {'contract_fee_pct': None}})
        d = build()
        f, _ = checks.run(d, cfg, D)
        x = find(f, 'idram_short')                      # no rate known -> plain shortfall, still critical
        self.assertEqual(x.level, 'crit')
        self.assertEqual(x.amount, Decimal(60))
        self.assertIn('միջնորդավճարի', x.detail)

    def test_park_pays_fee_is_ok(self):
        cfg, _ = test_config(Path(tempfile.mkdtemp()), providers={'idram': {'contract_fee_pct': 1.0, 'fee_payer': 'park'}})
        f, _ = checks.run(build(), cfg, D)
        self.assertEqual(find(f, 'idram_fee_on_us').level, 'ok')

    def test_unverified_yandex_is_warning(self):
        cfg, _ = test_config(Path(tempfile.mkdtemp()), yandex={'formula_verified': False})
        d = build(clean=True)
        for b in d.bank:
            if b.source == 'yandex' and b.day == D:
                b.amount -= 1000
        f, _ = checks.run(d, cfg, D)
        self.assertEqual(find(f, 'yandex_short').level, 'warn')


class Edge(unittest.TestCase):
    def setUp(self):
        self.cfg, _ = test_config(Path(tempfile.mkdtemp()))

    def test_payout_over_balance_is_critical(self):
        from fixtures import at
        from finaudit.model import Driver, FleetTx
        d = build(clean=True)
        d.fleet.append(FleetTx('taxi', 'x1', at(D, 9), 'd8', 'payout_pb', 'payout_pb', Decimal(-5000), kind='payout'))
        d.drivers.append(Driver('taxi', 'd8', 'Արթուր Ա.', '+374 91 000008', Decimal(-5000), d.drivers[0].balance_at))
        f, _ = checks.run(d, self.cfg, D)
        x = find(f, 'payout_over_balance')
        self.assertEqual((x.level, x.amount), ('crit', Decimal(5000)))
        self.assertIn('fleet_payout_no_pb', codes(f, 'warn'))

    def test_payout_across_midnight_matches(self):
        from fixtures import at
        from finaudit.model import FleetTx, PBPayout
        d = build(clean=True)
        d.fleet.append(FleetTx('taxi', 'x2', at(D, 0, 1), 'd1', 'payout_pb', 'payout_pb', Decimal(-3000), kind='payout'))
        d.pb.append(PBPayout(at=at(D - timedelta(days=1), 23, 59), amount=Decimal(3000), fee=Decimal(0), ok=True, driver_id='d1'))
        for dr in d.drivers:
            if dr.id == 'd1':
                dr.balance -= 3000
        f, _ = checks.run(d, self.cfg, D)
        self.assertEqual([x.code for x in f if x.level in ('crit', 'warn', 'skip')], [])

    def test_failed_payout_without_refund(self):
        from finaudit.model import PBPayout
        d = build(clean=True)
        p = d.pb[0]
        d.pb[0] = PBPayout(at=p.at, amount=p.amount, fee=p.fee, ok=False, status='failed', driver_id=p.driver_id, ref=p.ref)
        f, _ = checks.run(d, self.cfg, D)
        self.assertEqual(find(f, 'pb_failed_no_refund').rows[0]['Վարորդ'], 'Արամ Ա.')

    def test_no_receipt_for_weeks_is_critical(self):
        d = build(clean=True)
        d.bank = [b for b in d.bank if b.source != 'telcell']
        f, _ = checks.run(d, self.cfg, D)
        self.assertEqual(find(f, 'telcell_none').level, 'crit')


class CLI(unittest.TestCase):
    """End to end through the CSV loaders, including an Armenian bank layout."""

    def test_files(self):
        tmp = Path(tempfile.mkdtemp())
        _, cfg_path = test_config(tmp)
        data = build()
        write_files(data, tmp / 'in')
        rc = audit.main(['--config', str(cfg_path), '--date', D.isoformat(),
                         '--fleet-file', f'taxi={tmp / "in/fleet_taxi.csv"}', '--fleet-file', f'delivery={tmp / "in/fleet_delivery.csv"}',
                         '--fleet-period', f'{(D - timedelta(days=35)).isoformat()}:{(D + timedelta(days=1)).isoformat()}',
                         '--drivers-file', str(tmp / 'in/drivers.csv'), '--bank', str(tmp / 'in/bank.csv'),
                         '--bank-period', f'{(D - timedelta(days=20)).isoformat()}:{D.isoformat()}',
                         '--pb', str(tmp / 'in/pb.csv'), '--out', str(tmp / 'out')])
        self.assertEqual(rc, 2)
        import json
        j = json.loads((tmp / 'out' / D.isoformat() / 'report.json').read_text(encoding='utf-8'))
        crit = sorted(x['code'] for x in j['findings'] if x['level'] == 'crit')
        self.assertEqual(crit, ['easypay_missed_day', 'idram_fee_on_us', 'pb_fee_on_us', 'pb_no_debit'])
        self.assertFalse([x for x in j['findings'] if x['code'] == 'input_note'])


if __name__ == '__main__':
    unittest.main()


class Setup(unittest.TestCase):
    def test_example_config_loads_and_first_run_is_incomplete(self):
        from finaudit.config import load_config
        cfg = load_config(Path(__file__).resolve().parents[2] / 'config.example.json')
        self.assertEqual(cfg['thresholds']['large_topup_amd'], 10000)
        self.assertEqual(cfg['providers']['easypay']['weekday'], 0)
        f, _ = checks.run(build(clean=True), cfg, D)     # no categories mapped yet
        self.assertIn('cats_unverified', codes(f, 'skip'))
        self.assertIn('unknown_categories', codes(f, 'warn'))
        self.assertNotEqual(report.status(f)[0], '✅ Ամեն ինչ ճիշտ է')

    def test_category_proposals(self):
        from fleet_setup import propose
        cases = {('card', 'Оплата картой'): 'order_income', ('cash_collected', 'Наличные'): 'ignore',
                 ('platform_ride_fee', 'Комиссия сервиса за заказ'): 'order_fee', ('x', 'Пополнение через Idram'): 'topup',
                 ('y', 'Комиссия Idram за пополнение'): 'topup_fee', ('z', 'Комиссия за выплату'): 'payout_fee',
                 ('w', 'Выплата на карту PrimeBridge'): 'payout'}
        for (cid, name), kind in cases.items():
            self.assertEqual(propose(cid, name, None)[0]['kind'], kind, name)
        self.assertIsNone(propose('q', 'Аренда авто', None)[0])
        self.assertEqual(propose('card', 'Оплата картой', False)[0]['kind'], 'ignore')


def _rebalance(bank, start=Decimal(3_000_000)):
    bank.sort(key=lambda b: b.at)
    bal = start
    for i, b in enumerate(bank, 1):
        bal += b.amount
        b.balance, b.row = bal, i


class Regression(unittest.TestCase):
    """One test per bug found by the independent review (18.11.2026). Each one used to end green."""

    def setUp(self):
        self.cfg, _ = test_config(Path(tempfile.mkdtemp()))

    def run_(self, d, day=D, cfg=None):
        return checks.run(d, cfg or self.cfg, day)

    def test_partial_receipt_is_a_shortfall_not_another_period(self):
        for got, short in ((4000, 2000), (2000, 4000)):
            d = build(clean=True)
            for b in d.bank:
                if b.source == 'idram' and b.day == D:
                    b.amount = Decimal(got)
            _rebalance(d.bank)
            f, _ = self.run_(d)
            x = find(f, 'idram_short')
            self.assertEqual((x.level, x.amount), ('crit', Decimal(short)))
            self.assertIn('միայն 13.11.2026', x.detail)
            self.assertNotIn('idram_match', codes(f))

    def test_pb_status_words(self):
        from finaudit.loaders import pb_state
        spec = self.cfg['files']['primebridge']
        for st, want in [('Հաջողված', 'ok'), ('Executed', 'ok'), ('Успешно выполнен', 'ok'), ('SUCCESS', 'ok'),
                         ('Неуспешно', 'failed'), ('Ձախողված', 'failed'), ('declined', 'failed'),
                         ('В обработке', 'pending'), ('pending', 'pending'), ('???', None), ('', None)]:
            self.assertEqual(pb_state(st, spec), want, st)

    def test_pb_unknown_status_counts_as_sent(self):
        import csv
        from finaudit.loaders import load_pb_file
        tmp = Path(tempfile.mkdtemp()) / 'pb.csv'
        with open(tmp, 'w', newline='', encoding='utf-8') as fh:
            w = csv.writer(fh)
            w.writerow(['created_at', 'driver_id', 'amount', 'fee', 'status'])
            w.writerow([f'{D} 17:00:00', 'd6', '7000', '100', 'Տարօրինակ'])
        notes = []
        rows = load_pb_file(tmp, self.cfg, notes)
        self.assertTrue(rows[0].ok)
        self.assertEqual(notes[0][0], 'warn')
        d = build(clean=True)
        d.pb += rows
        f, _ = self.run_(d)
        self.assertEqual(find(f, 'pb_no_debit').amount, Decimal(7100))

    def test_duplicate_pb_payout_across_days(self):
        from fixtures import at
        from finaudit.model import FleetTx, PBPayout
        d = build(clean=True)
        y = D - timedelta(days=1)
        d.fleet.append(FleetTx('taxi', 'dup', at(y, 22), 'd1', 'payout_pb', 'payout_pb', Decimal(-10000)))
        d.pb += [PBPayout(at=at(y, 22, 1), amount=Decimal(10000), fee=Decimal(0), ok=True, driver_id='d1', ref='a'),
                 PBPayout(at=at(D, 9), amount=Decimal(10000), fee=Decimal(0), ok=True, driver_id='d1', ref='b')]
        d.pb_from = y
        f, _ = self.run_(d)
        self.assertEqual(find(f, 'pb_no_debit').rows[0]['PB №'], 'b')

    def test_refund_after_successful_payout(self):
        from fixtures import at
        from finaudit.model import FleetTx
        d = build(clean=True)
        d.fleet.append(FleetTx('taxi', 'r1', at(D, 15), 'd1', 'payout_pb_refund', 'payout_pb_refund', Decimal(5100)))
        f, _ = self.run_(d)
        self.assertEqual(find(f, 'pb_paid_twice').level, 'crit')

    def test_failed_then_successful_retry(self):
        from finaudit.model import PBPayout
        d = build(clean=True)
        p = d.pb[0]
        d.pb.insert(0, PBPayout(at=p.at - timedelta(minutes=5), amount=p.amount, fee=p.fee, ok=False, status='failed',
                                driver_id=p.driver_id, ref='try1'))
        f, _ = self.run_(d)
        self.assertNotIn('pb_no_debit', codes(f))

    def test_fee_line_is_not_reused_from_another_day(self):
        from fixtures import at
        from finaudit.model import FleetTx, PBPayout
        d = build(clean=True)
        y = D - timedelta(days=1)
        d.fleet += [FleetTx('taxi', 'p1', at(y, 10), 'd1', 'payout_pb', 'payout_pb', Decimal(-3000)),
                    FleetTx('taxi', 'f1', at(y, 10, 1), 'd1', 'payout_pb_fee', 'payout_pb_fee', Decimal(-150)),
                    FleetTx('taxi', 'p2', at(D, 10), 'd1', 'payout_pb', 'payout_pb', Decimal(-3000))]
        d.pb += [PBPayout(at=at(y, 10, 2), amount=Decimal(3000), fee=Decimal(150), ok=True, driver_id='d1', ref='y'),
                 PBPayout(at=at(D, 10, 2), amount=Decimal(3000), fee=Decimal(150), ok=True, driver_id='d1', ref='t')]
        d.pb_from = y
        f, _ = self.run_(d)
        self.assertEqual(find(f, 'pb_fee_on_us').amount, Decimal(150))

    def test_no_balances_is_not_green(self):
        d = build(clean=True)
        for x in d.drivers:
            x.balance = None
        f, _ = self.run_(d)
        self.assertIn('balances_missing', codes(f, 'skip'))
        self.assertNotIn('position', codes(f))

    def test_bank_without_balance_column(self):
        d = build(clean=True)
        for b in d.bank:
            b.balance = None
        f, _ = self.run_(d)
        self.assertIn('position_no_bank_balance', codes(f, 'skip'))
        d.bank_closing = Decimal(1_000_000)
        f, _ = self.run_(d)
        self.assertEqual(find(f, 'position').level, 'ok')

    def test_balance_taken_after_fleet_data(self):
        d = build(clean=True)
        for x in d.drivers:
            x.balance_at = d.fleet_until + timedelta(days=1)
        f, _ = self.run_(d)
        self.assertIn('balances_after_fleet', codes(f, 'skip'))

    def test_over_balance_not_downgraded_by_an_approximate_row(self):
        from fixtures import at
        from finaudit.model import Driver, FleetTx
        d = build(clean=True)
        bat = d.drivers[0].balance_at
        d.fleet += [FleetTx('taxi', 'o1', at(D, 9), 'd8', 'payout_pb', 'payout_pb', Decimal(-50000)),
                    FleetTx('taxi', 'o2', at(D, 9), 'zz', 'payout_pb', 'payout_pb', Decimal(-500))]
        d.drivers.append(Driver('taxi', 'd8', 'Արթուր Ա.', '', Decimal(-50000), bat))
        f, _ = self.run_(d)
        self.assertEqual(find(f, 'payout_over_balance').amount, Decimal(50000))
        self.assertEqual(find(f, 'payout_over_balance_approx').level, 'warn')

    def test_xlsx_with_stale_dimension(self):
        import openpyxl
        import re as _re
        import shutil
        import zipfile
        from finaudit.loaders import load_bank_file
        tmp = Path(tempfile.mkdtemp())
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['Ամսաթիվ', 'Ստացող/Վճարող', 'Մուտք', 'Ելք'])
        for i in range(1, 11):
            ws.append([f'{i:02d}.11.2026', 'IDRAM LLC', 1000 * i, None])
        wb.save(tmp / 'ok.xlsx')
        with zipfile.ZipFile(tmp / 'ok.xlsx') as zi, zipfile.ZipFile(tmp / 'bad.xlsx', 'w') as zo:
            for it in zi.infolist():
                data = zi.read(it.filename)
                if it.filename.endswith('sheet1.xml'):
                    data = _re.sub(rb'<dimension ref="[^"]+"', b'<dimension ref="A1:D4"', data)
                zo.writestr(it, data)
        notes = []
        self.assertEqual(len(load_bank_file(tmp / 'bad.xlsx', self.cfg, notes)), 10)
        shutil.rmtree(tmp)

    def test_pb_without_fee_column(self):
        import csv
        from finaudit.loaders import load_pb_file
        tmp = Path(tempfile.mkdtemp()) / 'pb.csv'
        with open(tmp, 'w', newline='', encoding='utf-8') as fh:
            csv.writer(fh).writerows([['date', 'driver_id', 'amount', 'status'], [f'{D} 10:00', 'd1', '5000', 'success']])
        notes = []
        load_pb_file(tmp, self.cfg, notes)
        self.assertIn('skip', [n[0] for n in notes])

    def test_bank_direction_markers(self):
        import csv
        from finaudit.loaders import load_bank_file
        tmp = Path(tempfile.mkdtemp())
        rows = [['Дата', 'Контрагент', 'Сумма', 'Дт/Кт'], ['16.11.2026', 'Прайм Бридж', '50 000,00', 'Д'],
                ['16.11.2026', 'IDRAM', '6 000,00', 'К'], ['16.11.2026', 'X', '1,00', 'Դեբետ']]
        with open(tmp / 'b.csv', 'w', newline='', encoding='utf-8') as fh:
            csv.writer(fh, delimiter=';').writerows(rows)
        notes = []
        got = [b.amount for b in load_bank_file(tmp / 'b.csv', self.cfg, notes)]
        self.assertEqual(got, [Decimal('-50000'), Decimal('6000'), Decimal('-1')])
        with open(tmp / 'c.csv', 'w', newline='', encoding='utf-8') as fh:
            csv.writer(fh, delimiter=';').writerows([r[:3] for r in rows])
        with self.assertRaises(ValueError):            # unsigned amounts and no direction: refuse to guess
            load_bank_file(tmp / 'c.csv', self.cfg, [])
        with open(tmp / 'e.csv', 'w', newline='', encoding='utf-8') as fh:
            csv.writer(fh, delimiter=';').writerows([rows[0], ['16.11.2026', 'X', '5,00', '?']])
        notes = []
        load_bank_file(tmp / 'e.csv', self.cfg, notes)
        self.assertEqual(notes[0][0], 'crit')

    def test_money_and_dash_cells(self):
        from finaudit.util import money_or_none
        self.assertEqual(money('10.000'), Decimal(10000))
        self.assertEqual(money('1.234.567'), Decimal(1234567))
        self.assertEqual(money('1234.5600'), Decimal('1234.56'))
        self.assertIsNone(money_or_none('-'))
        self.assertIsNone(money_or_none(' — '))

    def test_missed_monday_easypay_flags_on_tuesday(self):
        d = build(clean=True)
        d.bank = [b for b in d.bank if not (b.source == 'easypay' and b.day == D)]
        _rebalance(d.bank)
        d.bank_until = D + timedelta(days=1)
        f, _ = self.run_(d, day=D + timedelta(days=1))
        self.assertEqual(find(f, 'easypay_late').level, 'crit')

    def test_counterparty_wins_over_purpose(self):
        from finaudit.loaders import classify_bank
        from finaudit.model import BankTx
        from fixtures import at
        self.assertEqual(classify_bank(BankTx(at(D), Decimal(1), 'IDRAM LLC', 'по договору с Яндекс'), self.cfg), 'idram')
        self.assertEqual(classify_bank(BankTx(at(D), Decimal(1), '', 'Yandex payout'), self.cfg), 'yandex')

    def test_empty_fleet_day_for_a_working_park(self):
        d = build(clean=True)
        d.fleet = [t for t in d.fleet if not (t.park == 'delivery' and t.day == D)]
        f, _ = self.run_(d)
        self.assertIn('fleet_empty_day', codes(f, 'skip'))

    def test_short_statement_is_not_a_missing_transfer(self):
        d = build(clean=True)
        d.bank = [b for b in d.bank if b.day >= D - timedelta(days=1)]
        _rebalance(d.bank)
        d.bank_from = D - timedelta(days=1)
        f, _ = self.run_(d)
        self.assertNotIn('telcell_none', codes(f))
        self.assertIn('telcell_short_history', codes(f, 'skip'))


class Letters(unittest.TestCase):
    """Drafts to payers when money is missing (Garik 19.11: 'if Idram sends less, a letter must be written')."""

    def setUp(self):
        self.cfg, _ = test_config(Path(tempfile.mkdtemp()))

    def letters(self, d, cfg=None, day=D):
        _, s = checks.run(d, cfg or self.cfg, day)
        return {x['payer']: x for x in s['letters']}

    def test_scenario_letters(self):
        lt = self.letters(build())
        self.assertEqual(sorted(lt), ['easypay', 'idram'])          # PrimeBridge issues are internal: no letter
        i = lt['idram']
        self.assertIn('60 ֏', i['subject'])
        self.assertIn('13.11.2026–15.11.2026', i['body'])
        self.assertIn('միջնորդավճարը գանձվում է վճարողից', i['body'])
        self.assertEqual(len(i['rows']), 3)
        self.assertEqual(sum(Decimal(r['Գումար']) for r in i['rows']), Decimal(6000))
        e = lt['easypay']
        self.assertIn('09.11.2026–15.11.2026', e['body'])
        self.assertIn('10 500 ֏', e['body'])                 # due amount = attachment total, not today's top-ups
        self.assertEqual(sum(Decimal(r['Գումար']) for r in e['rows']), Decimal(10500))
        self.assertIn('ՀՎՀՀ', i['missing'])

    def test_plain_shortfall_letter(self):
        d = build(clean=True)
        for b in d.bank:
            if b.source == 'idram' and b.day == D:
                b.amount = Decimal(4000)
        x = self.letters(d)['idram']
        self.assertIn('Տարբերությունը կազմում է 2 000 ֏', x['body'])
        self.assertIn('փոխանցել 2 000 ֏ տարբերությունը', x['body'])

    def test_no_letters_when_clean_or_only_warnings(self):
        self.assertEqual(self.letters(build(clean=True)), {})
        cfg, _ = test_config(Path(tempfile.mkdtemp()), yandex={'formula_verified': False})
        d = build(clean=True)
        for b in d.bank:
            if b.source == 'yandex' and b.day == D:
                b.amount -= 1000
        self.assertEqual(self.letters(d, cfg), {})                   # unverified Yandex formula: warning only, no letter

    def test_company_details_fill_the_letter(self):
        cfg, _ = test_config(Path(tempfile.mkdtemp()), company={'name': 'Թեստ ՍՊԸ', 'tin': '00000000', 'signer': 'Տնօրեն'},
                             providers={'idram': {'contract_fee_pct': 1.0, 'email': 'x@example.com', 'contract_no': 'N-1'}})
        x = self.letters(build(), cfg)['idram']
        self.assertEqual(x['missing'], [])
        self.assertIn('Թեստ ՍՊԸ, ՀՎՀՀ 00000000', x['body'])

    def test_cli_writes_letter_files(self):
        tmp = Path(tempfile.mkdtemp())
        _, cfg_path = test_config(tmp)
        write_files(build(), tmp / 'in')
        audit.main(['--config', str(cfg_path), '--date', D.isoformat(),
                    '--fleet-file', f'taxi={tmp / "in/fleet_taxi.csv"}', '--fleet-file', f'delivery={tmp / "in/fleet_delivery.csv"}',
                    '--fleet-period', f'{(D - timedelta(days=35)).isoformat()}:{(D + timedelta(days=1)).isoformat()}',
                    '--drivers-file', str(tmp / 'in/drivers.csv'), '--bank', str(tmp / 'in/bank.csv'),
                    '--bank-period', f'{(D - timedelta(days=20)).isoformat()}:{D.isoformat()}',
                    '--pb', str(tmp / 'in/pb.csv'), '--out', str(tmp / 'out')])
        ld = tmp / 'out' / D.isoformat() / 'letters'
        self.assertEqual(sorted(p.name for p in ld.iterdir()), ['easypay.csv', 'easypay.md', 'idram.csv', 'idram.md'])

    def test_fleet_day_summary(self):
        f, _ = checks.run(build(), self.cfg, D)
        rows = {r['Հոդված']: r for r in find(f, 'fleet_day').rows}
        self.assertEqual(rows['Լիցքավորում · Idram']['Տաքսի'], '+17 000 ֏ (2)')
        self.assertEqual(rows['Ելքեր (PrimeBridge)']['Առաքում'], '−2 000 ֏ (1)')


class ProviderReport(unittest.TestCase):
    """Idram's own report, payment by payment (Garik 19.11: 1 000 paid -> 980 lands, Idram keeps 20)."""

    def setUp(self):
        self.cfg, _ = test_config(Path(tempfile.mkdtemp()), providers={'idram': {'contract_fee_pct': 2.0}})

    def data(self):
        """Clean day where Fleet credits Idram top-ups NET of a 2% commission and Idram reports gross/fee/net."""
        from finaudit.model import ProviderPayment
        d = build(clean=True)
        rows = []
        for t in d.fleet:
            if t.category_id == 'topup_idram':
                t.amount = Decimal(1960)                     # 2 000 paid − 40 commission
                t.description = f'Idram payment {t.id}00'
                rows.append(ProviderPayment('idram', t.at + timedelta(seconds=20), Decimal(2000), Decimal(40), Decimal(1960),
                                            ref=f'{t.id}00', phone='+374 91 000009'))
        d.provider_reports = {'idram': rows}
        self._resync(d)
        return d

    def _resync(self, d):
        """Bank Idram receipts = sum of net credits since the previous receipt; driver balances follow Fleet."""
        rec = sorted({b.day for b in d.bank if b.source == 'idram'})
        net = {}
        for t in d.fleet:
            if t.category_id == 'topup_idram':
                net[t.day] = net.get(t.day, 0) + t.amount
        for b in d.bank:
            if b.source == 'idram':
                prev = max((x for x in rec if x < b.day), default=None)
                if prev:
                    b.amount = sum((v for k, v in net.items() if prev <= k < b.day), Decimal(0))
        _rebalance(d.bank)
        from finaudit.loaders import classify_fleet
        classify_fleet(d.fleet, self.cfg)
        for x in d.drivers:
            snap = x.balance_at
            x.balance = (Decimal(10000) if x.id == 'd1' else 0) + sum(
                (t.amount for t in d.fleet if (t.park, t.driver_id) == (x.park, x.id) and t.kind != 'ignore' and t.at < snap), Decimal(0))

    def test_all_payments_landed(self):
        f, _ = checks.run(self.data(), self.cfg, D)
        self.assertEqual([x.code for x in f if x.level in ('crit', 'warn', 'skip')], [])
        self.assertIn('idram_report_day', codes(f, 'ok'))
        self.assertIn('idram_report_bank', codes(f, 'ok'))

    def test_paid_but_not_credited_money_with_us(self):
        from fixtures import at
        from finaudit.model import ProviderPayment
        d = self.data()
        y = D - timedelta(days=2)       # Saturday: paid 5 000, never landed on the driver; money in Monday's transfer
        d.provider_reports['idram'].append(ProviderPayment('idram', at(y, 19), Decimal(5000), Decimal(100), Decimal(4900),
                                                           ref='LOST1', phone='+374 91 000004', status='not credited', claim=True))
        for b in d.bank:
            if b.source == 'idram' and b.day == D:
                b.amount += 4900
        _rebalance(d.bank)
        f, _ = checks.run(d, self.cfg, D)
        x = find(f, 'idram_not_credited')
        self.assertEqual(x.amount, Decimal(4900))
        self.assertEqual(x.rows[0]['Վարորդ'], 'Գոռ Գ.')
        self.assertIn('այո՝ 16.11.2026', x.rows[0]['Մեզ հասե՞լ է'])
        self.assertIn('idram_report_bank', codes(f, 'ok'))        # Idram paid what its report says
        self.assertIn('ճիշտ հավասար է', find(f, 'idram_over').detail)   # bank > Fleet by exactly that payment, explained

    def test_not_credited_and_not_yet_transferred(self):
        from fixtures import at
        from finaudit.model import ProviderPayment
        d = self.data()
        d.provider_reports['idram'].append(ProviderPayment('idram', at(D, 21), Decimal(3000), Decimal(60), Decimal(2940),
                                                           ref='LOST2', phone='+374 91 000004'))
        f, _ = checks.run(d, self.cfg, D)
        self.assertIn('դեռ չի փոխանցվել', find(f, 'idram_not_credited').rows[0]['Մեզ հասե՞լ է'])

    def test_credited_later_by_hand_is_resolved(self):
        from fixtures import at
        from finaudit.model import FleetTx, ProviderPayment
        d = self.data()
        d.provider_reports['idram'].append(ProviderPayment('idram', at(D, 9), Decimal(3000), Decimal(60), Decimal(2940),
                                                           ref='LOST3', phone='+374 91 000004', status='not credited', claim=True))
        d.fleet.append(FleetTx('taxi', 'm9', at(D, 18), 'd4', 'manual_bonus', 'manual_bonus', Decimal(2940), created_by='dispatcher'))
        f, _ = checks.run(d, self.cfg, D)
        self.assertNotIn('idram_not_credited', codes(f))
        self.assertIn('dispatcher', find(f, 'idram_resolved').rows[0]['Հաշվեգրվել է'])

    def test_claim_but_already_credited(self):
        d = self.data()
        p = next(p for p in d.provider_reports['idram'] if p.day == D)
        p.status, p.claim = 'չի նստել', True
        f, _ = checks.run(d, self.cfg, D)
        self.assertIn('ԿՐԿԻՆ ՄԻ՛', find(f, 'idram_claim_but_credited').detail)

    def test_gross_credited_means_fee_on_us(self):
        d = self.data()
        for t in d.fleet:
            if t.category_id == 'topup_idram' and t.day == D:
                t.amount = Decimal(2000)
        f, _ = checks.run(d, self.cfg, D)
        self.assertEqual(find(f, 'idram_report_fee_on_us').amount, Decimal(40))

    def test_fleet_credit_without_payment(self):
        from fixtures import at
        from finaudit.model import FleetTx
        d = self.data()
        d.fleet.append(FleetTx('taxi', 'ghost', at(D, 13), 'd3', 'topup_idram', 'topup_idram', Decimal(7000)))
        f, _ = checks.run(d, self.cfg, D)
        self.assertEqual(find(f, 'idram_credit_without_payment').amount, Decimal(7000))

    def test_bank_less_than_report_drafts_letter(self):
        d = self.data()
        for b in d.bank:
            if b.source == 'idram' and b.day == D:
                b.amount -= 500
        _rebalance(d.bank)
        f, s = checks.run(d, self.cfg, D)
        self.assertEqual(find(f, 'idram_report_bank_short').amount, Decimal(500))
        letters = [x for x in s['letters'] if x['payer'] == 'idram']
        self.assertEqual(len(letters), 1)
        self.assertEqual(letters[0]['body'].count('Տարբերությունը կազմում է'), 1)   # one paragraph, not two

    def test_large_topup_uses_paid_amount(self):
        from fixtures import at
        from finaudit.model import FleetTx, ProviderPayment
        d = self.data()
        d.fleet.append(FleetTx('taxi', 'big', at(D, 15), 'd3', 'topup_idram', 'topup_idram', Decimal(9800), description='Idram BIG1'))
        d.provider_reports['idram'].append(ProviderPayment('idram', at(D, 15), Decimal(10000), Decimal(200), Decimal(9800), ref='BIG1'))
        f, _ = checks.run(d, self.cfg, D)
        x = find(f, 'topup_large')
        self.assertEqual((x.rows[0]['Վճարել է'], x.rows[0]['Նստել է']), ('10 000 ֏', '9 800 ֏'))

    def test_report_loader(self):
        import csv
        from finaudit.loaders import load_provider_report
        tmp = Path(tempfile.mkdtemp()) / 'idram.csv'
        with open(tmp, 'w', newline='', encoding='utf-8') as fh:
            csv.writer(fh, delimiter=';').writerows([
                ['Ամսաթիվ', 'Համար', 'Հեռախոս', 'Գումար', 'Միջնորդավճար', 'Հաշվեգրված', 'Կարգավիճակ'],
                ['16.11.2026 10:00', '777001', '091000004', '1 000,00', '20,00', '980,00', 'Հաջողված'],
                ['16.11.2026 11:00', '777002', '091000004', '1 000,00', '20,00', '980,00', 'Չի նստել'],
                ['16.11.2026 12:00', '777003', '091000004', '1 000,00', '20,00', '900,00', '']])
        notes = []
        rows = load_provider_report(tmp, 'idram', self.cfg, notes)
        self.assertEqual([(r.net, r.claim) for r in rows], [(Decimal(980), False), (Decimal(980), True)])
        self.assertEqual(notes[0][0], 'crit')                      # 1 000 − 20 ≠ 900: not silently accepted


# ── real-world formats (synthetic numbers, same layout as the real files) ──
IDBANK_TEXT = """                                           ՀԱՇՎԻ ՔԱՂՎԱԾՔ N6-2026-00000001
                                                   ՏԵՍՏ ՍՊԸ
0010 Երևան                      Ձևավորվել է` 17.11.2026 12:17                              Հաշվի համար` 11800000000001
E-mail: info@idbank.am                 Հաշվետու ժամանակաշրջան` 13.11.2026 - 16.11.2026 ( 4 օր )
                                                      ԳՈՐԾԱՐՔՆԵՐԻ ԱՄՓՈՓ ՏԵՂԵԿԱՏՎՈՒԹՅՈՒՆ ( AMD )
Սկզբնական մնացորդ                 Մուտքեր                 Ելքեր                      ար                Վերջնական մնացորդ
(13.11.2026 դրությամբ)          (ընդհանուր)            (ընդհանուր)       որից (գործարքներ               (16.11.2026 դրությամբ)
                                                                                   ից)
      +10,000.00               +5,940.00               -1,000.00                   0.00      կիրառելի չէ              +14,940.00
                                         ԳՈՐԾԱՐՔՆԵՐԻ/ԳՈՐԾԱՌՆՈՒԹՅՈՒՆՆԵՐԻ ՄԱՆՐԱՄԱՍՆ ՏԵՂԵԿԱՏՎՈՒԹՅՈՒՆ
Ամսաթիվ       Գումար         Արժույթ    Մուտք              Ելք
                                                                                                                  Փոխանցում /Համաձայն Պայմանագիր
13.11.202        2,000.00    AMD      +2,000.00                                                   '00000001       HayWay Delivery ՎՀ-1/1-1 առ
    6                                                                                                           01.01.2025/ IDRAM LLC /11800000000002

                                                                                +12,000.00                    Օրվա վերջի դրությամբ հաշվի վերջնական մնացորդ

                                                                                                               Փոխանցում /Համաձայն Պայմանագիր
16.11.202        3,940.00    AMD      +3,940.00                                                   '00000001    (HayWay) ՎՀ-1/1 առ
    6                                                                                                        01.01.2025/ IDRAM LLC /11800000000002
                                                                                                            Փոխանցում /Համաձայն պայմանագիր P-YD -
16.11.202        1,000.00    AMD      -1,000.00                                                   '00000003        1/ԻԶԻ ՓԵՅ ՍՊԸ
    6                                                                                                             2/00000003/1150000000000001

                                                                                +14,940.00                    Օրվա վերջի դրությամբ հաշվի վերջնական մնացորդ
"""

ACT_TEXT = """                                       ԱԿՏ
                    ԻԴՐԱՄ ՍՊԸ և «ՏԵՍՏ ՍՊԸ» ՍՊԸ
                        ((HayWay) ՎՀ-1/1 առ 01.01.2025) միջև
                            փոխադարձ հաշվարկների ստուգման

                                      31.10.2026

ԳԱՆՁՈՒՄ ԵՎ ԵԼՔԱԳՐՈՒՄ
№     Գործողություն                                  Հավաքագրում         Ելքագրում
1     Սկզբնական մնացորդ ի օգուտ                          1,000.00            0.00
2     ՏԵՍՏ ՍՊԸ-ի ID-ի համալրում                                        -     50,000.00
3     Ընդամենը հավաքագրվել է                            100,000.00                    -
6     Ընդամենը փոխանցվել է                               97,000.00       50,000.00
7     Չեղարկված գործարքներ                                      0.00                 0.00
11    Վերջնական մնացորդ առ 31.10.2026                        2,000.00            0.00

ԾԱՌԱՅՈՒԹՅՈՒՆՆԵՐ
№     Նկարագրություն                                 Գանձում             Ելք
2     Գանձված է ծառայության արժեք                           2,000.00                 0.00
"""


class RealFormats(unittest.TestCase):
    def test_armscii(self):
        from finaudit.idbank import armscii
        self.assertEqual(armscii('Ð²ÞìÆ ø²Ôì²Ìø'), 'ՀԱՇՎԻ ՔԱՂՎԱԾՔ')
        self.assertEqual(armscii('ºñ¨³Ý'), 'Երևան')

    def split_cfg(self):
        cfg, _ = test_config(Path(tempfile.mkdtemp()), providers={
            'idram': None,
            'idram_taxi': {'type': 'idram', 'name': 'Idram · տաքսի', 'parks': ['taxi'], 'contract_no': 'ՎՀ-1/1', 'contract_fee_pct': 2.0},
            'idram_delivery': {'type': 'idram', 'name': 'Idram · Delivery', 'parks': ['delivery'], 'contract_no': 'ՎՀ-1/1-1',
                               'contract_fee_pct': 2.0, 'expect_weekdays': []}},
            bank={'classify': [{'source': 'idram_delivery', 'counterparty': 'idram', 'purpose': 'Delivery|1/1-1'},
                               {'source': 'idram_taxi', 'counterparty': 'idram', 'purpose': 'ՎՀ-1/1(?![-\\d])'},
                               {'source': 'easypay', 'counterparty': 'իզի\\s*փեյ'}]})
        return cfg

    def test_idbank_statement(self):
        from finaudit.idbank import parse_statement
        from finaudit.loaders import classify_bank
        rows, meta = parse_statement(IDBANK_TEXT)
        self.assertEqual(meta['period'], (date(2026, 11, 13), date(2026, 11, 16)))
        self.assertEqual((meta['opening'], meta['closing']), (Decimal(10000), Decimal(14940)))
        self.assertEqual([(r.day, r.amount) for r in rows],
                         [(date(2026, 11, 13), Decimal(2000)), (date(2026, 11, 16), Decimal(3940)), (date(2026, 11, 16), Decimal(-1000))])
        self.assertEqual([r.balance for r in rows], [Decimal(12000), None, Decimal(14940)])
        cfg = self.split_cfg()
        self.assertEqual([classify_bank(r, cfg) for r in rows], ['idram_delivery', 'idram_taxi', 'easypay'])

    def test_idbank_statement_that_does_not_add_up_is_refused(self):
        from finaudit.idbank import parse_statement
        broken = IDBANK_TEXT.replace('16.11.202        3,940.00    AMD      +3,940.00', '  some text without a date')
        with self.assertRaises(ValueError):
            parse_statement(broken)

    def test_mail_claims(self):
        from mail_claims import extract
        rows = extract('Ամսաթիվ Գործարք Բաժանորդ Գումար\n23/10/2026 21:40 11111111111111 123456 1,500\n'
                       '> 24/10/2026 09:05 22222222222222 654321 490\n>\n'
                       'Ամսաթիվ Գործարք Բաժանորդ Գումար\n26/10/2026 12:49 33333333333333\n111222\n1,000.00\n\n--\n')
        self.assertEqual([(r['Ամսաթիվ'], r['Գործարք'], r['Բաժանորդ'], r['Գումար']) for r in rows],
                         [('23.10.2026 21:40', '11111111111111', '123456', '1500'),
                          ('24.10.2026 09:05', '22222222222222', '654321', '490'),
                          ('26.10.2026 12:49', '33333333333333', '111222', '1000.00')])

    def test_monthly_act(self):
        from monthly_act import parse_act, provider_for
        act = parse_act(ACT_TEXT)
        self.assertEqual(act['contract'], 'ՎՀ-1/1')
        self.assertEqual(act['main'][3][0], Decimal(100000))
        self.assertEqual(act['services'][2][0], Decimal(2000))
        cfg = self.split_cfg()
        self.assertEqual(provider_for(cfg, 'ՎՀ-1/1')[0], 'idram_taxi')            # not the '-1' delivery contract
        self.assertEqual(provider_for(cfg, 'ՎՀ-1/1-1')[0], 'idram_delivery')

    def test_split_contracts_are_settled_separately(self):
        cfg = self.split_cfg()
        self.assertNotIn('idram', cfg['providers'])
        d = build(clean=True)
        for b in d.bank:
            if b.source == 'idram':
                b.counterparty, b.purpose = 'IDRAM LLC', '(HayWay) ՎՀ-1/1 առ 01.01.2025'
        f, _ = checks.run(d, cfg, D)
        self.assertIn('idram_taxi_match', codes(f, 'ok'))
        self.assertNotIn('idram_delivery_none', codes(f))     # delivery has no Idram top-ups in the fixture

    def test_telcell_fee_from_contract_rate(self):
        import openpyxl
        from finaudit.loaders import load_provider_report
        tmp = Path(tempfile.mkdtemp())
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['ID платежа', 'Дата и время', 'Реквизиты', 'Сумма', '№ чека', 'ID платежа провайдера'])
        ws.append([1234567890, '2026-11-16 10:00:00', '123456', 1000.0, '777', None])
        wb.save(tmp / 't.xlsx')
        cfg, _ = test_config(tmp, providers={'telcell': {'contract_fee_pct': 1.5}})
        r = load_provider_report(tmp / 't.xlsx', 'telcell', cfg, [])[0]
        self.assertEqual((r.ref, r.account, r.gross, r.fee, r.net), ('1234567890', '123456', Decimal(1000), Decimal(15), Decimal(985)))

    def test_driver_code_learned_from_payment_number(self):
        from fixtures import at
        from finaudit.model import FleetTx, ProviderPayment
        cfg, _ = test_config(Path(tempfile.mkdtemp()), providers={'idram': {'contract_fee_pct': 2.0}})
        d = build(clean=True)
        d.fleet += [FleetTx('taxi', 'k1', at(D - timedelta(days=3), 10), 'd4', 'topup_idram', 'topup_idram', Decimal(980),
                            description='Idram 55550001'),
                    FleetTx('taxi', 'k2', at(D, 10), 'd4', 'topup_idram', 'topup_idram', Decimal(490))]
        d.provider_reports = {'idram': [
            ProviderPayment('idram', at(D - timedelta(days=3), 10), Decimal(1000), Decimal(20), Decimal(980), ref='55550001', account='424242'),
            ProviderPayment('idram', at(D, 10), Decimal(500), Decimal(10), Decimal(490), ref='55550002', account='424242')]}
        f, _ = checks.run(d, cfg, D)
        self.assertNotIn('idram_not_credited', codes(f))        # second payment matched via the learned code 424242 -> d4
