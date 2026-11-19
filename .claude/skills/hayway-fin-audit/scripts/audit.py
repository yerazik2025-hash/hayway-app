#!/usr/bin/env python3
"""HayWay daily financial audit (read-only).

Examples
  # Fleet straight from the API (keys in env), bank + PrimeBridge from files:
  python audit.py --config ../config.json --fleet api --bank bank.xlsx --pb pb.csv --out reports

  # Everything from files (e.g. exported from Supabase):
  python audit.py --config ../config.json --date 2026-11-17 \
      --fleet-file taxi=fleet_taxi.csv --fleet-file delivery=fleet_dlv.csv --fleet-period 2026-10-13:2026-11-18 \
      --drivers-file drivers.csv --bank bank.csv --pb pb.csv --out reports

Default --date is yesterday (Yerevan). Exit code: 0 = ran, 2 = critical problems found,
3 = could not check everything (missing/incomplete data), 1 = the run itself failed.
"""
from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from finaudit import checks, report  # noqa: E402
from finaudit.config import ConfigError, load_config  # noqa: E402
from finaudit.loaders import (classify_fleet, load_bank_file, load_drivers_file,  # noqa: E402
                              load_driver_codes, load_fleet_file, load_pb_file, load_provider_report)
from finaudit.model import Data  # noqa: E402
from finaudit.util import YEREVAN, day_end, day_start, money, parse_day  # noqa: E402


def _period(s):
    a, _, b = s.partition(':')
    return parse_day(a), parse_day(b)


def _park_path(s):
    k, eq, v = s.partition('=')
    return (k, v) if eq else ('', s)


def build_data(a, cfg) -> Data:
    d = Data()
    day = a.date
    if a.fleet == 'api':
        from finaudit import fleet_api
        since = day_start(day - timedelta(days=int(cfg['lookback_days'])))
        d.fleet, d.drivers = [], []
        until = None
        for park in cfg['parks']:
            c = fleet_api.creds(cfg, park)
            if not c:
                d.notes.append(('skip', f'Fleet · {cfg["parks"][park]["name"]}՝ API բանալիներ չկան '
                                        f'({cfg["parks"][park]["env_prefix"]}_PARK_ID / _API_KEY)'))
                continue
            try:
                # balances FIRST, then transactions up to a moment after them: the ledger can then
                # derive each driver's opening balance exactly (no gap between the two)
                drv = fleet_api.drivers(c, park)
                until = datetime.now(YEREVAN)
                d.fleet += fleet_api.transactions(c, park, since, until)
                d.drivers += drv
                d.fleet_parks.add(park)
            except fleet_api.FleetError as e:
                d.notes.append(('skip', f'Fleet · {cfg["parks"][park]["name"]}՝ API սխալ. {e}'))
        d.fleet_from, d.fleet_until = since, until
        if not d.fleet_parks:
            d.fleet, d.drivers = None, None
    elif a.fleet_file:
        d.fleet = []
        for spec in a.fleet_file:
            park, path = _park_path(spec)
            d.fleet += load_fleet_file(path, cfg, d.notes, park)
            if park:
                d.fleet_parks.add(park)
        d.fleet_parks |= {t.park for t in d.fleet}
        if a.fleet_period:
            f, t = _period(a.fleet_period)
            d.fleet_from, d.fleet_until = day_start(f), day_end(t)
        elif d.fleet:
            d.fleet_from, d.fleet_until = min(t.at for t in d.fleet), max(t.at for t in d.fleet)
            d.notes.append(('info', 'Fleet ֆայլի ժամանակահատվածը որոշվել է գործարքներից (--fleet-period չի տրվել)։'))
    if d.fleet is not None:
        classify_fleet(d.fleet, cfg)
    if a.drivers_file:
        d.drivers = d.drivers or []
        for spec in a.drivers_file:
            park, path = _park_path(spec)
            d.drivers += load_drivers_file(path, cfg, d.notes, park)
    if a.bank:
        d.bank, periods = [], []
        for path in a.bank:
            meta = {}
            rows = load_bank_file(path, cfg, d.notes, meta)
            d.bank += rows
            acc = meta.get('account') or Path(path).stem
            if 'opening' in meta:
                d.bank_opening[acc] = meta['opening']
            if 'period' in meta:
                periods.append(meta['period'])
            elif rows:
                periods.append((min(b.day for b in rows), max(b.day for b in rows)))
        if a.bank_period:
            d.bank_from, d.bank_until = _period(a.bank_period)
        elif periods:
            # several accounts: the audit day must be covered by EVERY statement
            d.bank_from, d.bank_until = max(p[0] for p in periods), min(p[1] for p in periods)
        if a.bank_balance:
            d.bank_closing = money(a.bank_balance)
    for spec in a.provider_report or []:
        prov, path = _park_path(spec)
        if prov not in cfg['providers']:
            raise ValueError(f'--provider-report {spec}: write it as idram=path (or telcell=, easypay=)')
        d.provider_reports.setdefault(prov, [])
        d.provider_reports[prov] += load_provider_report(path, prov, cfg, d.notes)
    for path in a.driver_codes or []:
        d.driver_codes.update(load_driver_codes(path, cfg, d.notes))
    for spec in a.provider_report_period or []:
        prov, per = _park_path(spec)
        d.provider_periods[prov] = _period(per)
    if a.pb:
        d.pb = []
        for path in a.pb:
            d.pb += load_pb_file(path, cfg, d.notes)
        if a.pb_period:
            d.pb_from, d.pb_until = _period(a.pb_period)
        elif d.pb:
            d.pb_from, d.pb_until = min(p.day for p in d.pb), max(p.day for p in d.pb)
        if a.pb_balance:
            d.pb_balance = money(a.pb_balance)
    return d


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--config', required=True)
    ap.add_argument('--date', type=parse_day, default=(datetime.now(YEREVAN) - timedelta(days=1)).date())
    ap.add_argument('--fleet', choices=['api'])
    ap.add_argument('--fleet-file', action='append', help='[park=]path, repeatable')
    ap.add_argument('--fleet-period', help='FROM:TO (inclusive days) the Fleet files fully cover')
    ap.add_argument('--drivers-file', action='append', help='[park=]path with balances, repeatable')
    ap.add_argument('--bank', action='append', help='business account statement (csv/xlsx), repeatable')
    ap.add_argument('--bank-period', help='FROM:TO the statement covers')
    ap.add_argument('--bank-balance', help='business account balance at the end of --date, AMD (if the statement has no balance column)')
    ap.add_argument('--provider-report', action='append', help='idram=path (or telcell=, easypay=): the provider\'s payment report, repeatable')
    ap.add_argument('--provider-report-period', action='append', help='idram=FROM:TO the report fully covers')
    ap.add_argument('--driver-codes', action='append', help='CSV code,driver_id[,park]: account codes drivers type at terminals')
    ap.add_argument('--pb', action='append', help='PrimeBridge payouts export (csv/xlsx), repeatable')
    ap.add_argument('--pb-period', help='FROM:TO the PrimeBridge export covers')
    ap.add_argument('--pb-balance', help='PrimeBridge account balance at end of day, AMD')
    ap.add_argument('--out', help='directory for report.md, summary.txt, report.json')
    a = ap.parse_args(argv)
    try:
        cfg = load_config(a.config)
        data = build_data(a, cfg)
    except (ConfigError, ValueError) as e:
        print(f'ERROR: {e}', file=sys.stderr)
        return 1
    findings, summary = checks.run(data, cfg, a.date)
    md = report.markdown(findings, summary, a.date, cfg)
    txt = report.short(findings, summary, a.date)
    if a.out:
        out = Path(a.out) / a.date.isoformat()
        out.mkdir(parents=True, exist_ok=True)
        (out / 'report.md').write_text(md, encoding='utf-8')
        (out / 'summary.txt').write_text(txt, encoding='utf-8')
        (out / 'report.json').write_text(report.to_json(findings, summary, a.date), encoding='utf-8')
        for x in summary.get('letters') or []:
            ld = out / 'letters'
            ld.mkdir(exist_ok=True)
            (ld / f'{x["payer"]}.md').write_text(x['body'], encoding='utf-8')
            with open(ld / f'{x["payer"]}.csv', 'w', newline='', encoding='utf-8-sig') as fh:
                w = csv.DictWriter(fh, fieldnames=x['columns'])
                w.writeheader()
                w.writerows(x['rows'])
        print(f'written: {out}')
    print(txt)
    _, n = report.status(findings)
    return 2 if n['crit'] else 3 if n['skip'] else 0


if __name__ == '__main__':
    sys.exit(main())
