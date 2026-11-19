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
  4. (with Fleet) collected − commission = what landed on the drivers' balances in Fleet that month;
  5. (with Fleet) the act's second column = money sent to drivers from the Idram OUT account (PrimeBridge payouts)
     vs what was debited from drivers' Fleet balances for payouts that month.
With --telcell-report (Telcell's daily e-mails): monthly volume, Telcell's fee by its tiers, and how much
Telcell actually kept on each transfer in the bank.
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


def tier_fee(tiers, volume: Decimal) -> Decimal:
    """Telcell 04.2026 offer: up to 1 mln a month -> 35 000 fixed; 1-10 mln -> 3.5%; over 10 mln -> 3%."""
    for t in tiers:
        if t.get('upto') is None or volume <= Decimal(str(t['upto'])):
            return Decimal(str(t['fixed'])) if 'fixed' in t else (volume * Decimal(str(t['pct'])) / 100).quantize(Decimal('0.01'))
    return ZERO


def telcell_month(cfg, files, bank, notes, tol) -> int:
    from collections import defaultdict
    from finaudit.loaders import load_provider_report
    key = next((k for k, p in cfg['providers'].items() if p['type'] == 'telcell'), None)
    if not key:
        return 0
    pc = cfg['providers'][key]
    rows = {}
    for f in files:
        for p in load_provider_report(f, key, cfg, notes):
            rows[p.ref or (p.at, p.account, p.gross)] = p          # the same payment may be in two reports
    rows = list(rows.values())
    if not rows:
        return 0
    first, last = min(p.day for p in rows), max(p.day for p in rows)
    vol = defaultdict(lambda: [0, ZERO])
    for p in rows:
        vol[p.day.replace(day=1)][0] += 1
        vol[p.day.replace(day=1)][1] += p.gross
    print(f'## Telcell · {first:%d.%m.%Y}–{last:%d.%m.%Y}\n')
    tiers = pc.get('fee_tiers')
    for m0, (n, v) in sorted(vol.items()):
        m_end = (m0 + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        full = first <= m0 and last >= m_end            # the fee is per calendar month: only for a fully covered month
        fee = tier_fee(tiers, v) if tiers and full else None
        print(f'- {m0:%m.%Y}{"" if full else " (մասնակի)"}՝ {n} վճարում, {amd(v)}'
              + (f', Telcell-ի վարձատրությունը սակագնով՝ {amd(fee)} ({(fee / v * 100).quantize(Decimal("0.01"))}%)' if fee is not None and v else ''))
    bad = 0
    rec = sorted((b for b in bank if b.source == key and b.amount > 0), key=lambda b: b.at)
    days = sorted({b.day for b in rec})
    for j, s in enumerate(days[1:], start=1):
        a0, z0 = days[j - 1], s - timedelta(days=1)
        if a0 < first or z0 > last:
            continue
        R = sum((b.amount for b in rec if b.day == s), ZERO)
        G = sum((p.gross for p in rows if a0 <= p.day <= z0), ZERO)
        kept = G - R
        ok = G and 0 <= kept <= G * Decimal('0.05')
        bad += not ok
        print(f'- {"✅" if ok else "🔴"} {s:%d.%m}-ի փոխանցում {amd(R)}՝ {a0:%d.%m}–{z0:%d.%m}-ի {amd(G)} վճարումներից, '
              f'Telcell-ը պահել է {amd(kept)}' + (f' ({(kept / G * 100).quantize(Decimal("0.01"))}%)' if G else ''))
    if bank and not rec:
        print('- ⛔ Տրված քաղվածքներում Telcell-ից մուտք չկա (փոխանցումները գնում են հիմնական հաշվին)։')
    print()
    return bad


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--config', required=True)
    ap.add_argument('--act', action='append', required=True)
    ap.add_argument('--bank', action='append', default=[])
    ap.add_argument('--fleet-file', action='append', default=[])
    ap.add_argument('--telcell-report', action='extend', nargs='+', default=[], help="Telcell's daily Excel reports")
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
            sent = g(6, 1)
            if sent:
                debited = sum((-t.amount for t in fleet if t.kind == 'payout' and t.amount < 0 and t.park in pc['parks']
                               and m0 <= t.day < nxt), ZERO) - sum((t.amount for t in fleet if (t.kind == 'payout_refund' or (
                                   t.kind == 'payout' and t.amount > 0)) and t.park in pc['parks'] and m0 <= t.day < nxt), ZERO)
                # drivers may not receive more than was taken from their balances
                chk(sent <= debited + tol, f'Idram OUT-ից (PrimeBridge) վարորդներին ուղարկվել է {amd(sent)}, '
                    f'Fleet-ում ելքերով հանվել է {amd(debited)}'
                    + ('' if sent <= debited + tol else f' → {amd(sent - debited)} ուղարկվել է առանց հաշվից հանելու'))
        print('\n'.join(lines) + '\n')
    if a.telcell_report:
        bad += telcell_month(cfg, a.telcell_report, bank, notes, tol)
    for lvl, msg in notes:
        print(f'- {"🔴" if lvl == "crit" else "🟠"} {msg}')
    print('Եթե կա 🔴, Idram-ին պետք է գրել ակտը ստանալուց 5 աշխատանքային օրվա ընթացքում, այլապես այն համարվում է համաձայնեցված։'
          if bad else 'Ստուգումը թերի է (⛔)։' if missing else 'Ակտերը համընկնում են։')
    return 2 if bad else 3 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
