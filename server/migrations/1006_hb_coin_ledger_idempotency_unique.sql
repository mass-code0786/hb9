create unique index if not exists hb_coin_balance_ledger_idempotency_key_unique
  on hb_coin_balance_ledger (idempotency_key);
