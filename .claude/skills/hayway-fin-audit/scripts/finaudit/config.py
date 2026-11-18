"""Audit configuration: defaults + the owner's config.json on top.

Defaults encode what the owner said (Garik, 18.11.2026):
  * Yandex pays every day, Idram every day, Telcell every 10 days, EasyPay every Monday;
  * every top-up of 10 000 AMD or more is a big warning;
  * payment-system commissions must be paid by drivers, never by the park;
  * withdrawals to Idram must come from order earnings, not from topped-up money;
  * taxi and delivery parks are checked the same way.
"""
from __future__ import annotations

import copy
import json
import re
from decimal import Decimal
from pathlib import Path

from .model import KINDS, PARTIES, PROVIDERS

DEFAULTS = {
    'thresholds': {
        'large_topup_amd': 10000,                 # >= this one top-up -> warning
        'withdrawal_from_topup_min_amd': 1000,    # flag when >= this part of a payout came from top-ups
        'manual_credit_alert_amd': 10000,         # manual credit to a driver >= this -> warning
        'debt_alert_amd': 20000,                  # one driver owes the park >= this -> listed as warning
        'settlement_tolerance_amd': 1,            # |bank receipt - expected| <= this counts as exact
        'list_limit': 50,
    },
    'lookback_days': 35,
    'parks': {
        'taxi': {'name': 'Տաքսի', 'env_prefix': 'FLEET_TAXI'},
        'delivery': {'name': 'Առաքում', 'env_prefix': 'FLEET_DELIVERY'},
    },
    'categories_verified': False,
    'categories': {},
    'providers': {
        'idram': {'name': 'Idram', 'parks': ['taxi', 'delivery'], 'fee_payer': 'driver', 'contract_fee_pct': None,
                  'schedule': 'ամեն օր', 'max_gap_days': 3, 'expect_weekdays': [0, 1, 2, 3, 4],
                  'cover': {'type': 'since_previous_receipt', 'lag_days': 1}},
        'telcell': {'name': 'Telcell', 'parks': ['taxi', 'delivery'], 'fee_payer': 'driver', 'contract_fee_pct': None,
                    'schedule': '10 օրը մեկ', 'max_gap_days': 12,
                    'cover': {'type': 'since_previous_receipt', 'lag_days': 1}},
        'easypay': {'name': 'EasyPay', 'parks': ['taxi', 'delivery'], 'fee_payer': 'driver', 'contract_fee_pct': None,
                    'schedule': 'ամեն երկուշաբթի', 'weekday': 0, 'max_gap_days': 8,
                    'cover': {'type': 'since_previous_receipt', 'lag_days': 1}},
    },
    'yandex': {'name': 'Yandex', 'parks': ['taxi', 'delivery'], 'schedule': 'ամեն օր', 'max_gap_days': 3,
               'expect_weekdays': [0, 1, 2, 3, 4],
               'cover': {'type': 'since_previous_receipt', 'lag_days': 1}, 'formula_verified': False},
    'primebridge': {'fee_payer': 'driver', 'match_window_hours': 48},
    'bank': {
        'classify': [
            {'source': 'yandex', 'counterparty': r'yandex|яндекс|յանդեքս'},
            {'source': 'idram', 'counterparty': r'idram|идрам|իդրամ'},
            {'source': 'telcell', 'counterparty': r'telcell|телсел|թելսել'},
            {'source': 'easypay', 'counterparty': r'easy\s*pay|изи\s*пэй|իզի\s*փեյ'},
            {'source': 'primebridge', 'counterparty': r'prime\s*bridge|прайм|պրայմ'},
        ],
    },
    'files': {
        'fleet_transactions': {'columns': {
            'park': ['park'], 'id': ['id', 'transaction_id'], 'at': ['event_at', 'at', 'date'],
            'driver_id': ['driver_id', 'driver_profile_id', 'contractor_profile_id'],
            'category_id': ['category_id'], 'category_name': ['category_name', 'category'],
            'amount': ['amount'], 'order_id': ['order_id'], 'description': ['description'],
            'created_by': ['created_by', 'created_by_identity'],
        }},
        'drivers': {'columns': {
            'park': ['park'], 'id': ['driver_id', 'id', 'driver_profile_id'], 'name': ['name', 'full_name'],
            'first_name': ['first_name'], 'last_name': ['last_name'],
            'phone': ['phone', 'phones'], 'balance': ['balance'], 'balance_at': ['balance_at', 'synced_at'],
        }},
        'bank': {'columns': {
            'at': ['date', 'Ամսաթիվ', 'Дата', 'Дата операции', 'Գործարքի ամսաթիվ', 'Value date'],
            'amount': ['amount', 'Գումար', 'Сумма'],
            'credit': ['credit', 'Մուտք', 'Кредит', 'Поступление', 'Приход', 'Credit'],
            'debit': ['debit', 'Ելք', 'Дебет', 'Списание', 'Расход', 'Debit'],
            'counterparty': ['counterparty', 'Կոնտրագենտ', 'Թղթակից', 'Контрагент', 'Плательщик/Получатель', 'Payer/Beneficiary', 'Ստացող/Վճարող'],
            'purpose': ['purpose', 'Նպատակ', 'Վճարման նպատակ', 'Назначение', 'Назначение платежа', 'Description', 'Details'],
            'ref': ['ref', 'Համար', 'Номер', 'Document No', 'Reference'],
            'balance': ['balance', 'Մնացորդ', 'Остаток', 'Balance'],
        }},
        'primebridge': {'columns': {
            'at': ['date', 'created_at', 'Ամսաթիվ', 'Дата'],
            'amount': ['amount', 'Գումար', 'Сумма'],
            'fee': ['fee', 'commission', 'Միջնորդավճար', 'Комиссия'],
            'status': ['status', 'Կարգավիճակ', 'Статус'],
            'driver_id': ['driver_id', 'driver_profile_id', 'contractor_id'],
            'phone': ['phone', 'Հեռախոս', 'Телефон'],
            'name': ['name', 'driver', 'Վարորդ', 'Водитель'],
            'park': ['park'],
            'dest': ['destination', 'dest', 'wallet', 'Ուր', 'Куда'],
            'ref': ['id', 'ref', 'transaction_id'],
        }, 'ok_statuses': ['success', 'succeeded', 'ok', 'done', 'completed', 'paid', 'հաջող', 'կատարված', 'успешно', 'выполнен']},
    },
}


def _merge(base, over):
    for k, v in over.items():
        if k.startswith('_'):
            continue
        if isinstance(v, dict) and isinstance(base.get(k), dict) and k not in ('categories',):
            _merge(base[k], v)
        else:
            base[k] = v
    return base


class ConfigError(ValueError):
    pass


def load_config(path=None) -> dict:
    cfg = copy.deepcopy(DEFAULTS)
    if path:
        p = Path(path)
        if not p.exists():
            raise ConfigError(f'config not found: {p}')
        _merge(cfg, json.loads(p.read_text(encoding='utf-8')))
    validate(cfg)
    return cfg


def validate(cfg: dict) -> None:
    errs = []
    for cid, c in cfg['categories'].items():
        if c.get('kind') not in KINDS:
            errs.append(f'category {cid}: unknown kind {c.get("kind")!r} (allowed: {", ".join(KINDS)})')
        if c.get('kind') in ('topup', 'topup_fee') and c.get('provider') not in PROVIDERS + ('other',):
            errs.append(f'category {cid}: kind {c["kind"]} needs provider idram|telcell|easypay|other')
        if c.get('party', '') not in PARTIES:
            errs.append(f'category {cid}: unknown party {c.get("party")!r}')
    for key, pv in cfg['providers'].items():
        if key not in PROVIDERS:
            errs.append(f'provider {key}: only {PROVIDERS} are supported')
        if pv.get('fee_payer') not in ('driver', 'park'):
            errs.append(f'provider {key}: fee_payer must be driver|park')
        if pv.get('cover', {}).get('type') not in ('since_previous_receipt', 'previous_days', 'previous_week'):
            errs.append(f'provider {key}: cover.type must be since_previous_receipt|previous_days|previous_week')
        for pk in pv.get('parks', []):
            if pk not in cfg['parks']:
                errs.append(f'provider {key}: unknown park {pk}')
    for r in cfg['bank']['classify']:
        try:
            re.compile(r.get('counterparty') or '', re.I)
            re.compile(r.get('purpose') or '', re.I)
        except re.error as e:
            errs.append(f'bank.classify {r}: bad regex: {e}')
    if cfg['primebridge'].get('fee_payer') not in ('driver', 'park'):
        errs.append('primebridge.fee_payer must be driver|park')
    if errs:
        raise ConfigError('config errors:\n  ' + '\n  '.join(errs))


def T(cfg, key) -> Decimal:
    return Decimal(str(cfg['thresholds'][key]))
