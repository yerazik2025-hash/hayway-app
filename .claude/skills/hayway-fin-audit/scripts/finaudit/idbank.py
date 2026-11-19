"""IDBank account statement (PDF, sent by statement@idbank.am or downloaded from IDBanking).

The PDF uses an old ArmSCII-8 font: `pdftotext -layout` returns Latin-1 look-alikes
('Ð²ÞìÆ ø²Ôì²Ìø' = 'ՀԱՇՎԻ ՔԱՂՎԱԾՔ'), which `armscii()` turns back into Armenian.

Every parse is checked against the statement's own summary (opening + incoming − outgoing =
closing, and the parsed rows add up to the printed totals). If they do not, the rows are
NOT used silently: the loader raises, because a statement missing one row hides a transfer.
"""
from __future__ import annotations

import re
import shutil
import subprocess
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from .model import BankTx
from .util import YEREVAN, ZERO, money

_PUNCT = {0xA2: 'և', 0xA3: '։', 0xA4: ')', 0xA5: '(', 0xA6: '»', 0xA7: '«', 0xA8: 'և', 0xA9: '.', 0xAA: '՝',
          0xAB: ',', 0xAC: '-', 0xAD: '֊', 0xAE: '…', 0xAF: '՜', 0xB0: '՛', 0xB1: '՞', 0xFE: '՚'}


def armscii(s: str) -> str:
    out = []
    for ch in s:
        o = ord(ch)
        if 0xB2 <= o <= 0xFD:
            k, small = divmod(o - 0xB2, 2)
            out.append(chr((0x561 if small else 0x531) + k))
        else:
            out.append(_PUNCT.get(o, ch))
    return ''.join(out)


def pdf_text(path) -> str:
    exe = shutil.which('pdftotext')
    if not exe:
        raise SystemExit('Need pdftotext (poppler) to read IDBank PDF statements. '
                         'Linux: apt-get install poppler-utils; Windows: winget install oschwartz10612.Poppler; '
                         'or export the statement from IDBanking as Excel.')
    r = subprocess.run([exe, '-layout', str(path), '-'], capture_output=True, check=True)
    return armscii(r.stdout.decode('utf-8', errors='strict'))


_ROW = re.compile(r"^\s*(\d\d\.\d\d\.\d{2,4})\s+([\d,]+\.\d\d)\s+([A-Z]{3})\s+([+-][\d,]+\.\d\d)(.*)$")
_YEAR_TAIL = re.compile(r'^\s{0,12}(\d{1,2})(?=\s|$)')
_DAY_END = 'Օրվա վերջի դրությամբ'
_NUM = re.compile(r'[+-]?\d[\d,]*\.\d\d')


def parse_statement(text: str):
    """-> (rows: list[BankTx], meta: dict). Raises ValueError when the rows do not add up."""
    L = text.splitlines()
    meta = {}
    m = re.search(r'Հաշվի համար`?\s*(\d{8,})', text)
    meta['account'] = m.group(1) if m else ''
    m = re.search(r'ժամանակաշրջան`?\s*(\d\d\.\d\d\.\d{4})\s*-\s*(\d\d\.\d\d\.\d{4})', text)
    if m:
        meta['period'] = tuple(datetime.strptime(x, '%d.%m.%Y').date() for x in m.groups())
    # summary: first numeric line after the "(DD.MM.YYYY դրությամբ)" header
    for i, l in enumerate(L):
        if 'դրությամբ)' in l and '(' in l:
            for l2 in L[i + 1:i + 8]:
                nums = _NUM.findall(l2)
                if len(nums) >= 2:
                    meta['opening'] = money(nums[0])
                    meta['closing'] = money(nums[-1])
                    meta['incoming'] = sum((money(x) for x in nums[1:-1] if x.startswith('+')), ZERO)
                    meta['outgoing'] = sum((-money(x) for x in nums[1:-1] if x.startswith('-')), ZERO)
                    break
            break
    rows = []
    is_row = [bool(_ROW.match(l)) for l in L]
    for i, l in enumerate(L):
        if not is_row[i]:
            continue
        d, _, cur, signed, tail = _ROW.match(l).groups()
        if cur != 'AMD':
            raise ValueError(f'IDBank: {cur} row on {d}; only AMD accounts are supported')
        # the year is cut: "01.10.202" on this line, "6" at the start of the next one
        nxt = L[i + 1] if i + 1 < len(L) else ''
        if len(d) < 10:
            y = _YEAR_TAIL.match(nxt)
            if not y:
                raise ValueError(f'IDBank: cannot read the year of "{d}" (line {i + 1})')
            d += y.group(1)
            nxt = nxt[y.end():]
        desc = []
        # a description may start on the line just above the date line ("Փոխանցում /Համաձայն ...")
        if i >= 1 and L[i - 1].strip() and not is_row[i - 1] and _DAY_END not in L[i - 1] \
                and not (i >= 2 and is_row[i - 2]):
            desc.append(L[i - 1].strip())
        tin = re.search(r"'(\d{6,10})", tail)
        desc.append((tail[tin.end():] if tin else tail).strip())
        desc.append(nxt.strip())
        k = i + 2
        while k < len(L) and L[k].strip() and not is_row[k] and _DAY_END not in L[k] \
                and not (k + 1 < len(L) and is_row[k + 1]):
            desc.append(L[k].strip())
            k += 1
        text_desc = ' '.join(x for x in desc if x)
        rows.append(BankTx(at=datetime.strptime(d, '%d.%m.%Y').replace(tzinfo=YEREVAN), amount=money(signed),
                           counterparty=text_desc, purpose=text_desc, ref=tin.group(1) if tin else '', row=len(rows) + 1))
    # day-end balances: "+73,909.80   Օրվա վերջի դրությամբ ..." belongs to the last row before it
    last = None
    k = 0
    for l in L:
        if _ROW.match(l):
            last = rows[k]
            k += 1
        elif _DAY_END in l and last is not None:
            nums = _NUM.findall(l)
            if nums:
                last.balance = money(nums[0])
    _verify(rows, meta)
    return rows, meta


def _verify(rows, meta):
    inc = sum((r.amount for r in rows if r.amount > 0), ZERO)
    out = -sum((r.amount for r in rows if r.amount < 0), ZERO)
    if 'opening' in meta:
        if meta['opening'] + inc - out != meta['closing']:
            raise ValueError(f'IDBank: rows do not add up: {meta["opening"]} + {inc} − {out} ≠ {meta["closing"]} '
                             f'(statement {meta.get("account")}). Some rows were not read; use the Excel export.')
        if meta.get('incoming') and meta['incoming'] != inc:
            raise ValueError(f'IDBank: incoming rows {inc} ≠ statement total {meta["incoming"]}')
        if meta.get('outgoing') and meta['outgoing'] != out:
            raise ValueError(f'IDBank: outgoing rows {out} ≠ statement total {meta["outgoing"]}')
    else:
        raise ValueError('IDBank: statement summary (opening/closing balance) not found; cannot verify the rows')


def load_pdf(path):
    return parse_statement(pdf_text(Path(path)))


def opening_balance(meta) -> Decimal | None:
    return meta.get('opening')
