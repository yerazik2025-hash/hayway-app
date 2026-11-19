#!/usr/bin/env python3
"""Idram's monthly "Փոխադարձ հաշվարկների ստուգման ԱԿՏ" vs the bank (and Fleet, if given).

Idram e-mails the act at the start of each month and writes: if there is no answer within
5 working days, the act counts as agreed. So check it as soon as it arrives:

  python monthly_act.py --config ../config.json --act act_taxi.pdf --act act_delivery.pdf \
      --bank statement_main.pdf --bank statement_delivery.pdf [--fleet-file taxi=... --fleet-file delivery=...]

Checks per contract:
  1. the act adds up: opening + collected − transferred − commission (− cancellations/refunds ...) = closing;
  2. commission ÷ collected = the contract % (Idram: 2%);
  3. "transferred to us" = the sum of this contract's receipts in the bank statement(s) for that month;
  4. (with Fleet) collected − commission = what landed on the drivers' balances in Fleet that month.
Read-only. Exit code 2 when something does not match.
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from finaudit.config import load_config  # noqa: E402
from finaudit.loaders import classify_fleet, load_bank_file, load_fleet_file  # noqa: E402
from finaudit.util import ZERO, amd, money  # noqa: E402

LINE = re.compile(r'^\s*(\d{1,2})\s+(.+?)\s{2,}([\d,]+\.\d\d|-)\s+([\d,]+\.\d\d|-)\s*$')


def act_text(path) -> str:
    exe = shutil.which('pdftotext')
    if not exe:
        raise SystemExit('Need pdftotext (poppler) to read the act PDF.')
    return subprocess.run([exe, '-layout', str(path), '-'], capture_output=True, check=True).stdout.decode('utf-8')


def parse_act(text: str) -> dict:
    """-> {'contract', 'date', 'main': {n: (col1, col2)}, 'services': {n: (col1, col2)}}"""
    m = re.search(r'(ՎՀ-[\d/_-]+)\s+առ\s+(\d\d\.\d\d\.\d{4})', text)
    d = re.search(r'^\s*(\d\d\.\d\d\.\d{4})\s*$', text, re.M)
    if not m or not d:
        raise ValueError('not an Idram act: contract number or act date not found')
    out = {'contract': m.group(1).replace('_', '/'), 'date': d.group(1), 'main': {}, 'services': {}}
    part = 'main'
    for line in text.splitlines():
        if 'ԾԱՌԱՅՈՒԹՅՈՒՆՆԵՐ' in line:
            part = 'services'
        mm = LINE.match(line)
        if mm:
            n, _, a, b = mm.groups()
            val = lambda x: ZERO if x == '-' else money(x)
            out[part][int(n)] = (val(a), val(b))
    need = {1, 3, 6, 11}
    if not need <= set(out['main']) or 2 not in out['services']:
        raise ValueError(f'act {out["contract"]}: rows {sorted(need - set(out["main"]))} or the commission row not found')
    return out


def provider_for(cfg, contract: str):
    """config provider whose contract_no is exactly this one ('ՎՀ-1/1' must not match 'ՎՀ-1/1-1')."""
    for key, pc in cfg['providers'].items():
        no = (pc.get('contract_no') or '').replace('_', '/')
        if pc['type'] == 'idram' and no and no == contract:
            return key, pc
    return None, None


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--config', required=True)
    ap.add_argument('--act', action='append', required=True)
    ap.add_argument('--bank', action='append', default=[])
    ap.add_argument('--fleet-file', action='append', default=[])
    ap.add_argument('--tolerance', default='1')
    a = ap.parse_args(argv)
    cfg = load_config(a.config)
    tol = Decimal(a.tolerance)
    notes, bank = [], []
    for b in a.bank:
        bank += load_bank_file(b, cfg, notes)
    fleet = []
    for spec in a.fleet_file:
        park, _, path = spec.partition('=')
        fleet += load_fleet_file(path, cfg, notes, park)
    classify_fleet(fleet, cfg)
    bad = missing = 0
    print('# Idram-ի ամսական ակտերի ստուգում\n')
    for f in a.act:
        act = parse_act(act_text(f))
        M, S = act['main'], act['services']
        d = date(*map(int, reversed(act['date'].split('.'))))
        m0 = d.replace(day=1)
        key, pc = provider_for(cfg, act['contract'])
        name = pc['name'] if pc else act['contract']
        g = lambda n, col=0: M.get(n, (ZERO, ZERO))[col]
        collected, transferred, fee = g(3), g(6), S[2][0]
        print(f'## {name} · պայմանագիր {act["contract"]} · {m0:%m.%Y}\n')
        lines = []

        def chk(ok, text):
            nonlocal bad
            bad += not ok
            lines.append(f'- {"✅" if ok else "🔴"} {text}')
        expect = g(1) + collected - transferred - g(7) - g(8) + g(9) - g(10) - fee
        chk(abs(expect - g(11)) <= tol, f'Ակտը կապվում է. {amd(g(1))} + {amd(collected)} − {amd(transferred)} − միջնորդավճար {amd(fee)}'
            f' = {amd(expect)}, ակտում՝ {amd(g(11))}')
        rate = pc.get('contract_fee_pct') if pc else None
        if collected:
            real = (fee / collected * 100).quantize(Decimal('0.001'))
            if rate is not None:
                chk(abs(real - Decimal(str(rate))) <= Decimal('0.05'), f'Միջնորդավճար {real}% (պայմանագրով {rate}%)')
            else:
                lines.append(f'- ℹ️ Միջնորդավճար {real}% (config-ում պայմանագրի % չկա)')
        if g(2, 1) or g(6, 1):
            lines.append(f'- ℹ️ Ձեր ID-ի համալրում (երկրորդ սյունակ)՝ {amd(g(2, 1))}, փոխանցված՝ {amd(g(6, 1))}')
        if bank and key:
            nxt = (m0 + timedelta(days=32)).replace(day=1)
            got = sum((b.amount for b in bank if b.source == key and b.amount > 0 and m0 <= b.day < nxt), ZERO)
            if not got and transferred:
                missing += 1
                lines.append(f'- ⛔ Ակտով մեզ փոխանցվել է {amd(transferred)}, բայց տրված քաղվածքներում այս պայմանագրից '
                             f'ոչ մի մուտք չկա. հավանաբար փոխանցումները գնում են ուրիշ հաշվի։ Տուր այդ հաշվի քաղվածքը։')
            else:
                chk(abs(got - transferred) <= tol, f'Ակտով մեզ փոխանցվել է {amd(transferred)}, բանկի քաղվածքում՝ {amd(got)}'
                    + ('' if abs(got - transferred) <= tol else f' (տարբերություն {amd(got - transferred, sign=True)})'))
        elif bank:
            lines.append(f'- ⛔ Բանկի հետ չի համեմատվել. config-ում չկա Idram-ի պրովայդեր contract_no = {act["contract"]}')
        if fleet and pc:
            nxt = (m0 + timedelta(days=32)).replace(day=1)
            credited = sum((t.amount for t in fleet if t.kind in ('topup', 'topup_fee') and t.provider == 'idram'
                            and t.park in pc['parks'] and m0 <= t.day < nxt), ZERO)
            want = collected - fee
            chk(abs(credited - want) <= tol, f'Վարորդներին պետք է նստեր {amd(want)} (հավաքագրված − միջնորդավճար), Fleet-ում՝ {amd(credited)}'
                + ('' if abs(credited - want) <= tol else f' (տարբերություն {amd(credited - want, sign=True)})'))
        print('\n'.join(lines) + '\n')
    for lvl, msg in notes:
        print(f'- {"🔴" if lvl == "crit" else "🟠"} {msg}')
    print('Եթե կա 🔴, Idram-ին պետք է գրել ակտը ստանալուց 5 աշխատանքային օրվա ընթացքում, այլապես այն համարվում է համաձայնեցված։'
          if bad else 'Ստուգումը թերի է (⛔)։' if missing else 'Ակտերը համընկնում են։')
    return 2 if bad else 3 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
