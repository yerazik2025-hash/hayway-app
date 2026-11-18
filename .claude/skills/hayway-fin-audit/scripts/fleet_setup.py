#!/usr/bin/env python3
"""Step 1 of setup: list the park's real Fleet transaction categories and PROPOSE
what each one means for the audit (topup idram/telcell/easypay, payout, fee...).

  python fleet_setup.py --config ../config.json                 # from the Fleet API (keys in env)
  python fleet_setup.py --config ../config.json --from-file fleet.csv   # distinct categories in an export
  python fleet_setup.py --config ../config.json --write          # add proposals to config.json

Proposals are guesses from category names. --write never overwrites a category
already in config.json and always leaves categories_verified=false: a person
(the owner) has to look at the table and confirm it before the audit is trusted.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from finaudit.config import load_config  # noqa: E402
from finaudit.model import KINDS  # noqa: E402

FEE = r'комисс|commission|fee|միջնորդ'
RULES = [   # (regex on "id | name", kind, provider, party)
    (rf'(idram|идрам|իդրամ).*({FEE})|({FEE}).*(idram|идрам|իդրամ)', 'topup_fee', 'idram', 'provider'),
    (rf'(telcell|телсел|թելսել).*({FEE})|({FEE}).*(telcell|телсел|թելսել)', 'topup_fee', 'telcell', 'provider'),
    (rf'(easy\s*pay|изи\s*пэй|իզի\s*փեյ).*({FEE})|({FEE}).*(easy\s*pay|изи\s*пэй|իզի\s*փեյ)', 'topup_fee', 'easypay', 'provider'),
    (r'idram|идрам|իդրամ', 'topup', 'idram', 'provider'),
    (r'telcell|телсел|թելսել', 'topup', 'telcell', 'provider'),
    (r'easy\s*pay|изи\s*пэй|իզի\s*փեյ', 'topup', 'easypay', 'provider'),
    (rf'(выплат|вывод|payout|withdraw|prime\s*bridge|перевод на карт).*({FEE})|({FEE}).*(выплат|вывод|payout|withdraw)', 'payout_fee', '', 'park'),
    (r'возврат.*(выплат|вывод)|payout.*(refund|return)', 'payout_refund', '', 'park'),
    (r'выплат|вывод средств|payout|withdraw|prime\s*bridge|перевод на карт', 'payout', '', 'park'),
    (r'^cash|наличн', 'ignore', '', ''),
    (r'platform.*(fee|vat|commission)|комиссия (сервиса|яндекс|платформ)|ндс', 'order_fee', '', 'platform'),
    (r'partner.*ride.*fee|комиссия парка|partner_ride', 'order_fee', '', 'park'),
    (r'^card|^corporate|^tip|чаев|оплата карт|корпоратив|bonus|бонус|subvention|субсид|compensation|компенсац|promotion|промокод|доплат', 'order_income', '', 'platform'),
    (r'partner_service_manual|ручн|manual', 'manual_credit', '', 'park'),
]


def propose(cid, name, affects):
    hay = f'{cid} | {name}'.lower()
    if affects is False:
        return {'kind': 'ignore'}, 'հաշվեկշիռը չի փոխում'
    for rx, kind, prov, party in RULES:
        if re.search(rx, hay, re.I):
            out = {'kind': kind}
            if prov:
                out['provider'] = prov
            if party:
                out['party'] = party
            return out, 'անունից'
    return None, 'անհայտ — պետք է որոշել ձեռքով'


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--config', required=True)
    ap.add_argument('--from-file', action='append', help='Fleet transactions export(s) instead of the API')
    ap.add_argument('--write', action='store_true')
    a = ap.parse_args(argv)
    cfg = load_config(a.config)
    cats = {}          # id -> (name, affects, seen-in parks, count, sum)
    usage = defaultdict(lambda: [0, 0])
    if a.from_file:
        from finaudit.loaders import load_fleet_file
        notes = []
        for f in a.from_file:
            park, eq, path = f.partition('=')
            for t in load_fleet_file(path if eq else f, cfg, notes, park if eq else 'file'):
                cats.setdefault(t.category_id, [t.category_name, None, set()])[2].add(t.park)
                usage[t.category_id][0] += 1
                usage[t.category_id][1] += float(t.amount)
    else:
        from finaudit import fleet_api
        for park in cfg['parks']:
            c = fleet_api.creds(cfg, park)
            if not c:
                print(f'! {park}: no API keys in env ({cfg["parks"][park]["env_prefix"]}_PARK_ID / _API_KEY)', file=sys.stderr)
                continue
            for x in fleet_api.categories(c):
                e = cats.setdefault(str(x.get('id')), [x.get('name', ''), x.get('is_affecting_driver_balance'), set()])
                e[2].add(park)
    if not cats:
        print('No categories found.', file=sys.stderr)
        return 1
    have = cfg['categories']
    new = {}
    print(f'{"ID":38} {"Անուն":40} {"Առաջարկ":28} Նշում')
    for cid, (name, affects, parks) in sorted(cats.items(), key=lambda x: (x[0] in have, x[0])):
        if cid in have:
            cur = have[cid]
            print(f'{cid:38} {name[:40]:40} {cur["kind"] + (":" + cur.get("provider", "") if cur.get("provider") else ""):28} արդեն config-ում')
            continue
        p, why = propose(cid, name, affects)
        u = usage.get(cid)
        extra = f' · {u[0]} գործարք, {u[1]:,.0f}' if u else ''
        print(f'{cid:38} {name[:40]:40} {(p["kind"] + (":" + p["provider"] if p.get("provider") else "")) if p else "?":28} {why}{extra}')
        if p:
            new[cid] = {**p, 'name': name}
    if a.write and new:
        path = Path(a.config)
        raw = json.loads(path.read_text(encoding='utf-8'))
        raw.setdefault('categories', {}).update({k: v for k, v in new.items() if k not in raw['categories']})
        raw['categories_verified'] = False
        path.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'\n{len(new)} առաջարկ ավելացվեց {path}-ում։ categories_verified=false — տերը պետք է հաստատի։')
    print('\nKinds:', ', '.join(KINDS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
