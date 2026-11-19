"""Normalized records. Every source (Fleet API, Supabase export, PrimeBridge file,
bank statement) is converted into these before any check runs."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

# What a Fleet transaction category means for the audit (config 'categories').
KINDS = {
    'topup':          'լիցքավորում (Idram/Telcell/EasyPay…), գումարը մտնում է վարորդի հաշվին',
    'topup_fee':      'լիցքավորման միջնորդավճար, պահվում է վարորդից',
    'payout':         'ելք/փոխանցում վարորդի հաշվից (PrimeBridge-ով Idram/քարտ)',
    'payout_fee':     'ելքի միջնորդավճար, պահվում է վարորդից',
    'payout_refund':  'չկայացած ելքի վերադարձ վարորդի հաշվին',
    'order_income':   'պատվերից եկամուտ (անկանխիկ, կորպ., թեյավճար, բոնուս Yandex-ից)',
    'order_fee':      'պատվերի միջնորդավճար (Yandex, պարկ, ԱԱՀ…)',
    'manual_credit':  'ձեռքով ավելացում վարորդի հաշվին (մրցանակ, ուղղում)',
    'manual_debit':   'ձեռքով հանում վարորդի հաշվից (տուգանք, վարձ)',
    'other':          'այլ, հաշվեկշիռը փոխում է',
    'ignore':         'տեղեկատվական, հաշվեկշիռը չի փոխում (օր. կանխիկ)',
}
PROVIDERS = ('idram', 'telcell', 'easypay')
PARTIES = ('platform', 'park', 'provider', '')


@dataclass
class FleetTx:
    park: str
    id: str
    at: datetime
    driver_id: str
    category_id: str
    category_name: str
    amount: Decimal                  # + credit to driver balance, − debit
    order_id: str = ''
    description: str = ''
    created_by: str = ''
    kind: str = 'unknown'
    provider: str = ''
    party: str = ''

    @property
    def day(self) -> date:
        return self.at.date()


@dataclass
class Driver:
    park: str
    id: str
    name: str = ''
    phone: str = ''
    balance: Optional[Decimal] = None
    balance_at: Optional[datetime] = None


@dataclass
class BankTx:
    at: datetime
    amount: Decimal                  # + incoming, − outgoing
    counterparty: str = ''
    purpose: str = ''
    ref: str = ''
    balance: Optional[Decimal] = None
    source: str = ''                 # yandex | idram | telcell | easypay | primebridge | '' (unclassified)
    row: int = 0

    @property
    def day(self) -> date:
        return self.at.date()


@dataclass
class PBPayout:
    at: datetime
    amount: Decimal                  # sent to the driver (positive)
    fee: Decimal
    ok: bool
    status: str = ''
    driver_id: str = ''
    phone: str = ''
    name: str = ''
    park: str = ''
    dest: str = ''
    ref: str = ''
    row: int = 0
    state: str = ''                  # ok | failed | pending (derived from ok when not given)

    def __post_init__(self):
        if not self.state:
            self.state = 'ok' if self.ok else 'failed'
        self.ok = self.state == 'ok'

    @property
    def day(self) -> date:
        return self.at.date()


@dataclass
class Finding:
    level: str                       # crit | warn | ok | info | skip
    code: str
    title: str
    detail: str = ''
    amount: Optional[Decimal] = None
    rows: list = field(default_factory=list)
    columns: list = field(default_factory=list)
    park: str = ''
    data: dict = field(default_factory=dict)      # structured facts (used to draft letters)


@dataclass
class Data:
    """Everything one audit run reads. None = source not provided (never 'empty')."""
    fleet: Optional[list] = None              # list[FleetTx]  (all parks)
    fleet_parks: set = field(default_factory=set)
    fleet_from: Optional[datetime] = None     # coverage of the Fleet transactions
    fleet_until: Optional[datetime] = None
    drivers: Optional[list] = None            # list[Driver]
    bank: Optional[list] = None               # list[BankTx]
    bank_from: Optional[date] = None
    bank_until: Optional[date] = None
    bank_closing: Optional[Decimal] = None   # given by hand when the statement has no balance column
    pb: Optional[list] = None                 # list[PBPayout]
    pb_from: Optional[date] = None
    pb_until: Optional[date] = None
    pb_balance: Optional[Decimal] = None
    notes: list = field(default_factory=list)  # loader warnings (skipped rows etc.)
