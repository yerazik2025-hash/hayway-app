"""File loaders (CSV / XLSX / JSON) -> normalized records.

Rows that cannot be read are never dropped silently: each one becomes a note
that the report shows, because one lost bank row can hide a whole transfer.
"""
from __future__ import annotations

import csv
import io
import json
import re
from decimal import Decimal
from pathlib import Path

from .model import BankTx, Driver, FleetTx, PBPayout, ProviderPayment
from .util import money, money_or_none, parse_dt


def _norm(h) -> str:
    return re.sub(r'\s+', ' ', str(h or '')).strip().lower()


def _read_csv(path: Path):
    raw = path.read_bytes()
    for enc in ('utf-8-sig', 'cp1251'):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError(f'{path}: unknown text encoding (need UTF-8 or Windows-1251)')
    try:
        dialect = csv.Sniffer().sniff(text[:5000], delimiters=',;\t|')
    except csv.Error:
        dialect = csv.excel
    return [list(r) for r in csv.reader(io.StringIO(text), dialect)]


def _read_xlsx(path: Path):
    try:
        import openpyxl
    except ImportError:
        raise SystemExit('Need openpyxl for .xlsx files: pip install openpyxl (or save the file as CSV)')
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    ws.reset_dimensions()          # exports often carry a stale <dimension>; trusting it silently drops rows
    return [list(r) for r in ws.iter_rows(values_only=True)]


def read_table(path, columns: dict):
    """Return list of dict rows keyed by our field names. Finds the header row itself
    (bank exports usually have title lines above it)."""
    path = Path(path)
    if path.suffix.lower() == '.json':
        data = json.loads(path.read_text(encoding='utf-8'))
        if isinstance(data, dict):
            data = next((v for v in data.values() if isinstance(v, list)), [])
        keys = list(dict.fromkeys(k for r in data for k in r)) if data else []
        grid = [keys] + [[r.get(k) for k in keys] for r in data] if data else [[]]
    elif path.suffix.lower() in ('.xlsx', '.xlsm'):
        grid = _read_xlsx(path)
    else:
        grid = _read_csv(path)
    want = {f: [_norm(c) for c in cands] for f, cands in columns.items()}
    hdr_i, best = None, 0
    for i, row in enumerate(grid[:40]):
        cells = [_norm(c) for c in row]
        hits = sum(1 for cands in want.values() if any(c in cells for c in cands))
        if hits > best:
            hdr_i, best = i, hits
    if hdr_i is None or best < 2:
        raise ValueError(f'{path.name}: header row not found; expected columns like '
                         + ', '.join(f'{k}={v[0]!r}' for k, v in list(columns.items())[:5]))
    cells = [_norm(c) for c in grid[hdr_i]]
    idx = {}
    for f, cands in want.items():
        for c in cands:
            if c in cells:
                idx[f] = cells.index(c)
                break
    out = []
    for n, row in enumerate(grid[hdr_i + 1:], start=hdr_i + 2):
        if not any(str(c or '').strip() for c in row):
            continue
        rec = {f: (row[i] if i < len(row) else None) for f, i in idx.items()}
        rec['_row'] = n
        out.append(rec)
    return out, sorted(idx)


def _s(v) -> str:
    return '' if v is None else str(v).strip()


def load_fleet_file(path, cfg, notes, default_park=''):
    rows, have = read_table(path, cfg['files']['fleet_transactions']['columns'])
    need = {'at', 'driver_id', 'category_id', 'amount'}
    if not need <= set(have):
        raise ValueError(f'{Path(path).name}: missing columns {sorted(need - set(have))}')
    out = []
    for r in rows:
        try:
            out.append(FleetTx(
                park=_s(r.get('park')) or default_park, id=_s(r.get('id')) or f'row{r["_row"]}',
                at=parse_dt(r['at']), driver_id=_s(r['driver_id']), category_id=_s(r['category_id']),
                category_name=_s(r.get('category_name')), amount=money(r['amount']),
                order_id=_s(r.get('order_id')), description=_s(r.get('description')),
                created_by=_s(r.get('created_by'))))
        except ValueError as e:
            notes.append(('skip', f'Fleet ֆայլ {Path(path).name}, տող {r["_row"]}: չկարդացվեց ({e}). Գումարները թերի են։'))
    if not default_park and any(not t.park for t in out):
        raise ValueError(f'{Path(path).name}: no "park" column; pass --park for this file')
    return out


def load_drivers_file(path, cfg, notes, default_park=''):
    rows, have = read_table(path, cfg['files']['drivers']['columns'])
    if 'id' not in have:
        raise ValueError(f'{Path(path).name}: missing driver id column')
    out = []
    for r in rows:
        try:
            name = _s(r.get('name')) or ' '.join(x for x in (_s(r.get('last_name')), _s(r.get('first_name'))) if x)
            out.append(Driver(
                park=_s(r.get('park')) or default_park, id=_s(r['id']), name=name, phone=_s(r.get('phone')),
                balance=money_or_none(r.get('balance')),
                balance_at=parse_dt(r['balance_at']) if _s(r.get('balance_at')) else None))
        except ValueError as e:
            notes.append(('warn', f'Վարորդների ֆայլ, տող {r["_row"]}: չկարդացվեց ({e})'))
    return out


_DEBIT_MARK = re.compile(r'^(d|dr|д|дт|debit|debet|дебет|դ|դեբետ|ելք|расход|списание|out|withdrawal|-)\.?$', re.I)
_CREDIT_MARK = re.compile(r'^(c|cr|к|кт|credit|кредит|կ|կրեդիտ|մուտք|приход|поступление|in|deposit|\+)\.?$', re.I)


def classify_bank(tx: BankTx, cfg) -> str:
    """The counterparty decides first; the purpose text only when no counterparty rule matched
    (an Idram transfer whose purpose mentions Yandex is still Idram)."""
    rules = cfg['bank']['classify']
    for field in (tx.counterparty, f'{tx.counterparty} | {tx.purpose}'):
        if not field.strip(' |'):
            continue
        for rule in rules:
            cp, pu = rule.get('counterparty'), rule.get('purpose')
            if cp and not re.search(cp, field, re.I):
                continue
            if pu and not re.search(pu, tx.purpose, re.I):
                continue
            if cp or pu:
                return rule['source']
    return ''


def load_bank_file(path, cfg, notes, meta=None):
    """CSV/XLSX statement, or an IDBank PDF statement (verified against its own totals)."""
    meta = {} if meta is None else meta
    if Path(path).suffix.lower() == '.pdf':
        from . import idbank
        rows, m = idbank.load_pdf(path)
        meta.update(m)
        for r in rows:
            r.account = m.get('account') or Path(path).stem
            r.source = classify_bank(r, cfg)
        return rows
    cols = dict(cfg['files']['bank']['columns'])
    cols.setdefault('direction', ['direction', 'type', 'Տեսակ', 'Тип', 'D/C', 'Дт/Кт'])
    rows, have = read_table(path, cols)
    if 'at' not in have or not ({'amount'} <= set(have) or {'credit', 'debit'} & set(have)):
        raise ValueError(f'{Path(path).name}: need a date column and amount (or credit/debit) columns; found {have}')
    out = []
    has_dir = 'direction' in have
    for r in rows:
        try:
            if 'amount' in have and _s(r.get('amount')):
                amt = money(r['amount'])
                if has_dir:
                    mark = _s(r.get('direction'))
                    if _DEBIT_MARK.match(mark):
                        amt = -abs(amt)
                    elif _CREDIT_MARK.match(mark):
                        amt = abs(amt)
                    elif mark:
                        raise ValueError(f'անհայտ ուղղություն «{mark}» (մուտք է, թե ելք)')
            else:
                cr, dr = money_or_none(r.get('credit')), money_or_none(r.get('debit'))
                if cr is None and dr is None:
                    raise ValueError('no amount')
                amt = (cr or 0) - abs(dr or 0)
            tx = BankTx(at=parse_dt(r['at']), amount=amt, counterparty=_s(r.get('counterparty')),
                        purpose=_s(r.get('purpose')), ref=_s(r.get('ref')),
                        balance=money_or_none(r.get('balance')), row=r['_row'], account=Path(path).stem)
            tx.source = classify_bank(tx, cfg)
            out.append(tx)
        except ValueError as e:
            notes.append(('crit', f'Բանկի քաղվածք, տող {r["_row"]}: չկարդացվեց ({e}). Այդ տողը ստուգումից դուրս է։'))
    if out and 'amount' in have and not has_dir and not ({'credit', 'debit'} & set(have)) and all(b.amount >= 0 for b in out):
        raise ValueError(f'{Path(path).name}: բոլոր գումարները դրական են, և մուտք/ելք սյունակ չկա. '
                         'հնարավոր չէ տարբերել մուտքը ելքից։ Ավելացրու files.bank.columns.direction կամ credit/debit։')
    return out


def load_pb_file(path, cfg, notes):
    spec = cfg['files']['primebridge']
    rows, have = read_table(path, spec['columns'])
    if not {'at', 'amount'} <= set(have) or not ({'driver_id', 'phone'} & set(have)):
        raise ValueError(f'{Path(path).name}: need date, amount and driver_id or phone columns; found {have}')
    unknown = {}
    out = []
    for r in rows:
        try:
            st = _s(r.get('status'))
            state = pb_state(st, spec) if 'status' in have else 'ok'
            if state is None:
                unknown[st] = unknown.get(st, 0) + 1
                state = 'ok'           # counted as sent: then a missing Fleet debit shows up as a loss
            out.append(PBPayout(
                at=parse_dt(r['at']), amount=abs(money(r['amount'])), fee=abs(money_or_none(r.get('fee')) or 0),
                ok=state == 'ok', state=state, status=st, driver_id=_s(r.get('driver_id')),
                phone=_s(r.get('phone')), name=_s(r.get('name')), park=_s(r.get('park')),
                dest=_s(r.get('dest')), ref=_s(r.get('ref')), row=r['_row']))
        except ValueError as e:
            notes.append(('crit', f'PrimeBridge ֆայլ, տող {r["_row"]}: չկարդացվեց ({e}). Այդ տողը ստուգումից դուրս է։'))
    if 'status' not in have:
        notes.append(('warn', 'PrimeBridge ֆայլում կարգավիճակի սյունակ չկա. բոլոր տողերը համարվել են հաջողված։'))
    if unknown:
        notes.append(('warn', 'PrimeBridge-ի անծանոթ կարգավիճակներ (համարվել են հաջողված)՝ '
                      + ', '.join(f'«{k or "դատարկ"}» ×{v}' for k, v in unknown.items())
                      + '։ Ավելացրու files.primebridge.status_* կանոններում։'))
    if 'fee' not in have and cfg['primebridge'].get('fee_column_required', True):
        notes.append(('skip', 'PrimeBridge ֆայլում միջնորդավճարի սյունակ չկա. «միջնորդավճարը մեզ վրա» ստուգումը չի արվել։'))
    return out


def pb_state(status: str, spec) -> str | None:
    s = status.strip().lower()
    if not s:
        return None
    for state in ('failed', 'pending', 'ok'):      # failed first: "неуспешно" contains "успешно"
        if re.search(spec[f'status_{state}'], s, re.I):
            return state
    return None


def load_provider_report(path, provider, cfg, notes):
    """Idram/Telcell/EasyPay report -> ProviderPayment rows. gross − fee must equal net."""
    spec = cfg['files']['provider_report']
    rows, have = read_table(path, spec['columns'])
    if 'at' not in have or not ({'gross', 'net'} & set(have)) or not ({'phone', 'account', 'driver_id', 'ref'} & set(have)):
        raise ValueError(f'{Path(path).name}: need date, amount and phone/account/payment number columns; found {have}')
    pc = cfg['providers'][provider]
    rate = pc.get('contract_fee_pct')
    derive = 'fee' not in have and not {'gross', 'net'} <= set(have) and 'gross' in have and rate is not None
    if 'fee' not in have and not {'gross', 'net'} <= set(have) and not derive:
        notes.append(('warn', f'{pc["name"]} հաշվետվությունում միջնորդավճարի սյունակ չկա, պայմանագրի % էլ չկա config-ում. '
                              f'համարվել է, որ վարորդին պետք է նստեր {"ամբողջ" if "gross" in have else "զուտ"} գումարը։'))
    out = []
    for r in rows:
        try:
            g, f, n = money_or_none(r.get('gross')), money_or_none(r.get('fee')), money_or_none(r.get('net'))
            g, f, n = (abs(x) if x is not None else None for x in (g, f, n))
            if g is None and n is None:
                raise ValueError('no amount')
            if derive:                    # e.g. Telcell's daily report has only the paid amount
                f = (g * Decimal(str(rate)) / 100).quantize(Decimal('0.01'))
            if n is None:
                n = g - (f or 0)
            if g is None:
                g = n + (f or 0)
            if f is None:
                f = g - n
            if abs(g - f - n) > 1:
                raise ValueError(f'գումար − միջնորդավճար ≠ հաշվեգրված ({g} − {f} ≠ {n})')
            st = _s(r.get('status'))
            out.append(ProviderPayment(
                provider=provider, at=parse_dt(r['at']), gross=g, fee=f, net=n, ref=_s(r.get('ref')),
                phone=_s(r.get('phone')), account=_s(r.get('account')), driver_id=_s(r.get('driver_id')),
                park=_s(r.get('park')), status=st, row=r['_row'],
                claim=bool(st) and bool(re.search(spec['status_not_credited'], st, re.I))))
        except ValueError as e:
            notes.append(('crit', f'{provider} հաշվետվություն {Path(path).name}, տող {r["_row"]}: չկարդացվեց ({e})։'))
    return out


def load_driver_codes(path, cfg, notes):
    """code -> Fleet driver: the account number drivers type at Idram/Telcell/EasyPay."""
    rows, have = read_table(path, {'code': ['code', 'account', 'Բաժանորդ', 'Реквизиты', 'կոդ'],
                                   'driver_id': ['driver_id', 'driver_profile_id', 'id'], 'park': ['park']})
    if not {'code', 'driver_id'} <= set(have):
        raise ValueError(f'{Path(path).name}: need code and driver_id columns')
    out = {}
    for r in rows:
        parks = [_s(r.get('park'))] if _s(r.get('park')) else list(cfg['parks'])
        for pk in parks:
            out[(pk, _s(r['code']))] = _s(r['driver_id'])
    return out


def classify_fleet(txs, cfg):
    cats = cfg['categories']
    for t in txs:
        c = cats.get(t.category_id)
        if c:
            t.kind, t.provider, t.party = c['kind'], c.get('provider', ''), c.get('party', '')
        else:
            t.kind, t.provider, t.party = 'unknown', '', ''
    return txs
