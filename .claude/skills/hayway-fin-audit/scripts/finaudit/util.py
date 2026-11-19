"""Money, time and phone helpers. Money is always Decimal, never float.

Every parser raises ValueError on input it cannot read: a value that is
silently turned into 0 is how reconciliation reports go wrong.
"""
from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

YEREVAN = timezone(timedelta(hours=4))  # Armenia: UTC+4, no DST
ZERO = Decimal(0)
ONE = Decimal(1)

WEEKDAYS_HY = ['երկուշաբթի', 'երեքշաբթի', 'չորեքշաբթի', 'հինգշաբթի', 'ուրբաթ', 'շաբաթ', 'կիրակի']

_MONEY_JUNK = re.compile(r'[\s  ֏]|AMD|amd|դր\.?|руб\.?')


def money(x) -> Decimal:
    """Parse an amount: '1 234 567,89', '1,234,567.89', '-1234.5600', '(500)', 1234."""
    if x is None:
        raise ValueError('empty amount')
    if isinstance(x, Decimal):
        return x
    if isinstance(x, bool):
        raise ValueError(f'bad amount: {x!r}')
    if isinstance(x, int):
        return Decimal(x)
    if isinstance(x, float):
        return Decimal(repr(x))
    s = _MONEY_JUNK.sub('', str(x).strip())
    s = s.replace('−', '-').replace('–', '-')
    if s in ('', '-', '+'):
        raise ValueError('empty amount')
    neg = False
    if s.startswith('(') and s.endswith(')'):
        neg, s = True, s[1:-1]
    if re.fullmatch(r'-?\d{1,3}(\.\d{3})+', s):
        s = s.replace('.', '')                         # 10.000 / 1.234.567: dots as thousands (AMD has no 3-decimal amounts)
    if ',' in s and '.' in s:
        if s.rfind(',') > s.rfind('.'):
            s = s.replace('.', '').replace(',', '.')   # 1.234,56
        else:
            s = s.replace(',', '')                     # 1,234.56
    elif ',' in s:
        parts = s.split(',')
        if len(parts) == 2 and 1 <= len(parts[1].lstrip('-')) <= 2:
            s = s.replace(',', '.')                    # 12,5
        else:
            s = s.replace(',', '')                     # 1,234,567
    try:
        v = Decimal(s)
    except InvalidOperation:
        raise ValueError(f'bad amount: {x!r}') from None
    if not v.is_finite():
        raise ValueError(f'bad amount: {x!r}')
    return -v if neg else v


def money_or_none(x):
    if x is None or (isinstance(x, str) and _MONEY_JUNK.sub('', x.strip()) in ('', '-', '—', '–', '−')):
        return None
    return money(x)


def amd(v, sign: bool = False) -> str:
    """12345.6 -> '12 345,60 ֏'; whole numbers without decimals. Minus is U+2212."""
    if v is None:
        return '—'
    v = Decimal(v)
    neg = v < 0
    a = abs(v)
    whole = a.quantize(ONE, ROUND_HALF_UP) if a == a.to_integral_value() else None
    if whole is not None:
        s = f'{int(whole):,}'.replace(',', ' ')
    else:
        q = a.quantize(Decimal('0.01'), ROUND_HALF_UP)
        ip, fp = divmod(q, 1)
        s = f'{int(ip):,}'.replace(',', ' ') + ',' + f'{fp:.2f}'[2:]
    pre = '−' if neg else ('+' if sign and v > 0 else '')
    return f'{pre}{s} ֏'


def pct(part, whole, digits: int = 2) -> str:
    if not whole:
        return '—'
    v = (Decimal(part) / Decimal(whole) * 100).quantize(Decimal(1).scaleb(-digits), ROUND_HALF_UP)
    return f'{v}'.replace('.', ',') + '%'


_DT_FORMATS = [
    '%d.%m.%Y %H:%M:%S', '%d.%m.%Y %H:%M', '%d.%m.%Y',
    '%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y',
    '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d',
    '%d-%m-%Y %H:%M:%S', '%d-%m-%Y %H:%M', '%d-%m-%Y',
    '%d.%m.%y %H:%M', '%d.%m.%y',
]


def parse_dt(x) -> datetime:
    """Any timestamp -> aware datetime in Yerevan time. Naive values are taken as Yerevan time."""
    if x is None or (isinstance(x, str) and not x.strip()):
        raise ValueError('empty date')
    if isinstance(x, datetime):
        d = x
    elif isinstance(x, date):
        d = datetime.combine(x, time())
    else:
        s = str(x).strip()
        d = None
        iso = s.replace('Z', '+00:00')
        try:
            d = datetime.fromisoformat(iso)
        except ValueError:
            for f in _DT_FORMATS:
                try:
                    d = datetime.strptime(s, f)
                    break
                except ValueError:
                    pass
        if d is None:
            raise ValueError(f'bad date: {x!r}')
    if d.tzinfo is None:
        d = d.replace(tzinfo=YEREVAN)
    return d.astimezone(YEREVAN)


def parse_day(x) -> date:
    if isinstance(x, date) and not isinstance(x, datetime):
        return x
    return parse_dt(x).date()


def day_start(d: date) -> datetime:
    return datetime.combine(d, time(), tzinfo=YEREVAN)


def day_end(d: date) -> datetime:
    """Exclusive end of a Yerevan day."""
    return day_start(d + timedelta(days=1))


def dmy(d) -> str:
    if isinstance(d, datetime):
        d = d.astimezone(YEREVAN)
    return d.strftime('%d.%m.%Y')


def hm(d: datetime) -> str:
    return d.astimezone(YEREVAN).strftime('%H:%M')


def daterange(a: date, b: date):
    """Inclusive."""
    d = a
    while d <= b:
        yield d
        d += timedelta(days=1)


def phone_key(p) -> str:
    """Last 8 digits: '+374 91 12-34-56' and '091123456' both -> '91123456'."""
    digits = re.sub(r'\D', '', str(p or ''))
    return digits[-8:] if len(digits) >= 8 else ''
