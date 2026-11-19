#!/usr/bin/env python3
"""Turn Idram "Իդրամ հարցում" e-mails into a provider report CSV (status = չի նստել).

Idram writes when a driver paid but the money did not appear on the driver's balance:
    Ամսաթիվ Գործարք Բաժանորդ Գումար
    23/10/2026 21:44 11111111111111 123456 490
(the four values may also be on separate lines). Save each e-mail's plain text to a file and run
    python mail_claims.py claim1.txt claim2.txt --out idram_claims.csv
then pass the CSV to audit.py with --provider-report idram=idram_claims.csv.
A file in which no payment row is found is reported, never skipped silently.
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

ROW = re.compile(r'(\d{1,2}[./]\d{1,2}[./]\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+(\d{8,})\s+(\S+)\s+(\d[\d,]*(?:\.\d+)?)(?=\s|$)')


def extract(text: str):
    text = re.sub(r'^\s*>+ ?', '', text, flags=re.M)          # quoted replies: "> 23/10/2026 ..."
    out, seen = [], set()
    for m in ROW.finditer(text):
        d, t, ref, acc, amt = m.groups()
        if ref in seen:
            continue
        seen.add(ref)
        out.append({'Ամսաթիվ': f'{d.replace("/", ".")} {t}', 'Գործարք': ref, 'Բաժանորդ': acc,
                    'Գումար': re.sub(r'[\s,]', '', amt), 'Կարգավիճակ': 'չի նստել'})
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('files', nargs='+')
    ap.add_argument('--out', required=True)
    a = ap.parse_args(argv)
    rows, bad = [], []
    for f in a.files:
        got = extract(Path(f).read_text(encoding='utf-8'))
        if not got:
            bad.append(f)
        rows += got
    uniq = list({r['Գործարք']: r for r in rows}.values())
    with open(a.out, 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.DictWriter(fh, fieldnames=['Ամսաթիվ', 'Գործարք', 'Բաժանորդ', 'Գումար', 'Կարգավիճակ'])
        w.writeheader()
        w.writerows(uniq)
    print(f'{len(uniq)} payment(s) -> {a.out}')
    for f in bad:
        print(f'NO PAYMENT ROW FOUND in {f}: read it by hand', file=sys.stderr)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
