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
        self.assertEqual(f.amount, Decimal(15000))
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
