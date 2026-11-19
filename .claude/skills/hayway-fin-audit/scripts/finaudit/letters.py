"""Draft letters to payers (Idram, Telcell, EasyPay, Yandex) when money is missing.

Only DRAFTS. Nothing here sends anything: the owner reads the letter, fills in what is
missing and decides whether it goes out. A letter is drafted only for critical findings
(shortfall, commission taken from the park, missed or late transfer), never for warnings,
and for Yandex only once its formula is verified.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from .util import ZERO, amd, dmy, pct

KINDS = ('short', 'fee', 'missed', 'late', 'none')
LEGAL_DEFAULT = {'idram': '«Իդրամ» ՍՊԸ', 'telcell': '«Թելսել» ՓԲԸ', 'easypay': '«Իզի Փեյ» ՍՊԸ', 'yandex': 'Yandex'}


def _blank(v, what, missing):
    if v:
        return str(v)
    missing.append(what)
    return f'[{what}]'


def _rows(c, payer, ptype, a: date, z: date):
    """Our side of the period: every payment (provider) or every day total (Yandex)."""
    if ptype == 'provider':
        parks = set(c.cfg['providers'][payer]['parks'])
        tx = sorted((t for t in c.data.fleet if t.kind == 'topup' and t.provider == payer and t.park in parks
                     and a <= t.day <= z), key=lambda t: t.at)
        return ['Ամսաթիվ', 'Ժամ', 'Գումար', 'Fleet գործարք', 'Նկարագրություն'], [
            {'Ամսաթիվ': dmy(t.at), 'Ժամ': f'{t.at:%H:%M:%S}', 'Գումար': str(t.amount), 'Fleet գործարք': t.id,
             'Նկարագրություն': t.description} for t in tx]
    parks = set(c.cfg['yandex']['parks'])
    days = defaultdict(lambda: ZERO)
    for t in c.data.fleet:
        if t.party == 'platform' and t.kind != 'ignore' and t.park in parks and a <= t.day <= z:
            days[t.day] += t.amount
    return ['Ամսաթիվ', 'Գումար'], [{'Ամսաթիվ': dmy(d), 'Գումար': str(v)} for d, v in sorted(days.items())]


def _paragraph(f, ptype):
    d = f.data
    what = 'ձեր համակարգով մեր վարորդների կատարած վճարումները' if ptype == 'provider' else 'մեր պարկի պատվերների հաշվարկը'
    a, z = dmy(d['from']), dmy(d['to'])
    if d['kind'] in ('short', 'fee'):
        refs = '; '.join(r for r in d.get('refs', []) if r)
        p = (f'{dmy(f.data["day"])}-ին մեր հաշվին ստացվել է {amd(d["received"])}{f" ({refs})" if refs else ""}։ '
             f'Այս փոխանցումը պետք է ծածկեր {a}–{z} ժամանակահատվածում {what}։ ')
        if ptype == 'provider':
            p += (f'Մեր տվյալներով այդ ժամանակահատվածում կատարվել է {d["count"]} վճարում՝ ընդհանուր {amd(d["gross"])}, '
                  f'որից վարորդների հաշվին հաշվեգրվել է {amd(d["expected"])}։ ')
        else:
            p += f'Մեր տվյալներով այդ ժամանակահատվածի համար վճարման ենթակա է {amd(d["expected"])}։ '
        p += f'Տարբերությունը կազմում է {amd(d["diff"])}։'
        if d['kind'] == 'fee':
            p += (f' Պայմանագրի համաձայն՝ միջնորդավճարը գանձվում է վճարողից, մինչդեռ մեզ փոխանցված գումարից պահվել է '
                  f'{amd(d["diff"])} ({pct(d["diff"], d["gross"])})։')
        return p, f'փոխանցել {amd(d["diff"])} տարբերությունը կամ ներկայացնել պահման հիմնավորումը'
    last = f'Ձեր վերջին փոխանցումը մեր հաշվին ստացվել է {dmy(d["last"])}-ին։ ' if d.get('last') else ''
    if d['kind'] == 'none':
        last = f'{a}-ից ի վեր մեր հաշվին ձեզանից ոչ մի փոխանցում չի ստացվել։ '
    p = (f'{last}Համաձայն գրաֆիկի ({d["schedule"]}) {dmy(f.data["day"])}-ի դրությամբ փոխանցումը պետք է արդեն կատարված լիներ։ '
         f'Մեր տվյալներով {a}–{z} ժամանակահատվածում {what} կազմում են '
         + (f'{amd(d["gross"])} (վարորդների հաշվին հաշվեգրված՝ {amd(d["expected"])})'
            if ptype == 'provider' and d.get('gross') is not None and d['gross'] != d['expected'] else amd(d['expected']))
         + ', որը դեռ չի փոխանցվել։')
    return p, 'տեղեկացնել ուշացման պատճառի և փոխանցման ժամկետի մասին և կատարել փոխանցումը'


def build(c, findings):
    """-> list of letter dicts (JSON-friendly)."""
    by_payer = defaultdict(list)
    for f in findings:
        d = f.data
        if f.level != 'crit' or d.get('kind') not in KINDS:
            continue
        if d['ptype'] == 'yandex' and not c.cfg['yandex'].get('formula_verified'):
            continue
        d['day'] = c.day
        by_payer[d['payer']].append(f)
    comp = c.cfg.get('company', {})
    out = []
    for payer, fs in by_payer.items():
        ptype = fs[0].data['ptype']
        pc = c.cfg['providers'][payer] if ptype == 'provider' else c.cfg['yandex']
        missing = []
        to = pc.get('legal_name') or LEGAL_DEFAULT.get(payer, payer)
        email = _blank(pc.get('email'), f'{pc.get("name", payer)}-ի էլ. հասցե', missing)
        contract = _blank(pc.get('contract_no'), 'պայմանագրի համար', missing)
        cname = _blank(comp.get('name'), 'ընկերության անվանում', missing)
        tin = _blank(comp.get('tin'), 'ՀՎՀՀ', missing)
        signer = _blank(comp.get('signer'), 'ստորագրող', missing)
        money_kinds = [f for f in fs if f.data['kind'] in ('short', 'fee')]
        total = sum((f.data['diff'] for f in money_kinds), ZERO)
        subject = (f'Փոխանցման անհամապատասխանություն՝ {dmy(c.day)}, {amd(total)}' if money_kinds
                   else f'Չստացված փոխանցում՝ {dmy(min(f.data["from"] for f in fs))}–{dmy(c.day)}')
        paras, asks, cols, rows = [], [], [], []
        for f in fs:
            p, ask = _paragraph(f, ptype)
            paras.append(p)
            asks.append(ask)
            cols, r = _rows(c, payer, ptype, f.data['from'], f.data['to'])
            rows += r
        att_sum = sum((Decimal(r['Գումար']) for r in rows), ZERO)
        body = '\n'.join([
            f'Ում՝ {to}', f'Էլ. հասցե՝ {email}', f'Ումից՝ {cname}, ՀՎՀՀ {tin}', f'Պայմանագիր՝ № {contract}',
            f'Ամսաթիվ՝ {dmy(c.day + timedelta(days=1))}', '', f'Թեմա՝ {subject}', '', 'Հարգելի գործընկերներ,', '',
            *[x + '\n' for x in paras],
            'Խնդրում ենք՝',
            '1. ստուգել նշված ժամանակահատվածի վճարումները և տրամադրել մանրամասն հաշվետվություն՝ ըստ յուրաքանչյուր վճարման;',
            *[f'{i}. {a};' for i, a in enumerate(dict.fromkeys(asks), start=2)],
            '',
            f'Կից ներկայացնում ենք մեր տվյալներով ցուցակը ({len(rows)} տող, {amd(att_sum)})։' if rows else '',
            '', 'Հարգանքով՝', signer, cname,
            ' '.join(x for x in (comp.get('phone', ''), comp.get('email', '')) if x),
        ]).rstrip() + '\n'
        out.append({'payer': payer, 'to': to, 'email': pc.get('email', ''), 'subject': subject, 'body': body,
                    'amount': str(total), 'columns': cols, 'rows': rows, 'missing': list(dict.fromkeys(missing)),
                    'reasons': [f.code for f in fs]})
    return out
