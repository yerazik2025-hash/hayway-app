"""Read-only Yandex Fleet API client (transactions, categories, drivers).

This module only ever calls *list* endpoints. It never creates transactions or
changes anything in Fleet.

Keys come from the environment, one set per park (config parks.<key>.env_prefix):
  <PREFIX>_PARK_ID, <PREFIX>_API_KEY, optional <PREFIX>_CLIENT_ID (default taxi/park/<PARK_ID>)
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta

from .model import Driver, FleetTx
from .util import YEREVAN, money, money_or_none, parse_dt

BASE = os.environ.get('FLEET_API_BASE', 'https://fleet-api.taxi.yandex.net')


class FleetError(RuntimeError):
    pass


def creds(cfg, park):
    pre = cfg['parks'][park]['env_prefix']
    pid, key = os.environ.get(pre + '_PARK_ID'), os.environ.get(pre + '_API_KEY')
    if not pid or not key:
        return None
    return {'park_id': pid, 'api_key': key, 'client_id': os.environ.get(pre + '_CLIENT_ID') or f'taxi/park/{pid}'}


def _post(c, path, body, tries=5):
    data = json.dumps(body).encode()
    for i in range(tries):
        req = urllib.request.Request(BASE + path, data=data, method='POST', headers={
            'X-Client-ID': c['client_id'], 'X-API-Key': c['api_key'], 'X-Park-ID': c['park_id'],
            'Content-Type': 'application/json', 'Accept-Language': 'ru'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')[:300]
            if e.code in (429, 500, 502, 503, 504) and i < tries - 1:
                time.sleep(2 ** i)
                continue
            raise FleetError(f'{path}: HTTP {e.code}: {msg}') from None
        except urllib.error.URLError as e:
            if i < tries - 1:
                time.sleep(2 ** i)
                continue
            raise FleetError(f'{path}: {e.reason}') from None
    raise FleetError(f'{path}: no answer')


def categories(c):
    r = _post(c, '/v2/parks/transactions/categories/list', {'query': {'park': {'id': c['park_id']}}})
    return r.get('categories', [])


def transactions(c, park, since: datetime, until: datetime, chunk_days=3):
    """All park transactions with since <= event_at < until, chunked and paginated."""
    out, seen = [], set()
    a = since
    while a < until:
        b = min(until, a + timedelta(days=chunk_days))
        cursor = None
        while True:
            body = {'query': {'park': {'id': c['park_id'], 'transaction': {'event_at': {
                'from': a.isoformat(), 'to': b.isoformat()}}}}, 'limit': 1000}
            if cursor:
                body['cursor'] = cursor
            r = _post(c, '/v2/parks/transactions/list', body)
            items = r.get('transactions', [])
            for t in items:
                if t.get('id') in seen:
                    continue
                seen.add(t.get('id'))
                cb = t.get('created_by') or {}
                out.append(FleetTx(
                    park=park, id=str(t.get('id', '')), at=parse_dt(t['event_at']),
                    driver_id=str(t.get('driver_profile_id') or t.get('contractor_profile_id') or ''),
                    category_id=str(t.get('category_id', '')), category_name=str(t.get('category_name', '')),
                    amount=money(t['amount']), order_id=str(t.get('order_id') or ''),
                    description=str(t.get('description') or ''),
                    created_by=str(cb.get('identity', '') if isinstance(cb, dict) else cb)))
            cursor = r.get('cursor')
            if not cursor or not items:
                break
        a = b
    return out


def drivers(c, park):
    out, offset = [], 0
    while True:
        now = datetime.now(YEREVAN)            # per page: the balance is as of this request
        r = _post(c, '/v1/parks/driver-profiles/list', {
            'query': {'park': {'id': c['park_id']}},
            'fields': {'account': ['id', 'balance'], 'driver_profile': ['id', 'first_name', 'last_name', 'phones']},
            'limit': 1000, 'offset': offset})
        items = r.get('driver_profiles', [])
        for it in items:
            dp, acc = it.get('driver_profile', {}), (it.get('accounts') or [{}])
            phones = dp.get('phones') or []
            if not it.get('accounts'):
                raise FleetError(f'driver {dp.get("id")}: no account/balance in the answer')
            out.append(Driver(
                park=park, id=str(dp.get('id', '')),
                name=' '.join(x for x in (dp.get('last_name'), dp.get('first_name')) if x),
                phone=phones[0] if phones else '', balance=money_or_none(acc[0].get('balance')), balance_at=now))
        offset += len(items)
        if not items or offset >= int(r.get('total', 0)):
            break
    return out
