create unique index if not exists provider_settings_provider_unique
  on provider_settings (provider);

create unique index if not exists api_provider_settings_provider_unique
  on api_provider_settings (provider);

create unique index if not exists hb_production_controls_key_unique
  on hb_production_controls (key);

create unique index if not exists hb_mainnet_readiness_key_unique
  on hb_mainnet_readiness (key);

create unique index if not exists hb_internal_ledger_idempotency_key_unique
  on hb_internal_ledger (idempotency_key);

create unique index if not exists hb_income_ledger_idempotency_key_unique
  on hb_income_ledger (idempotency_key);

create unique index if not exists hb_referrals_referred_user_id_unique
  on hb_referrals (referred_user_id);

create unique index if not exists hb_users_email_unique
  on hb_users (email);

create unique index if not exists hb_wallets_user_type_network_unique
  on hb_wallets (user_id, wallet_type, network);

create unique index if not exists hb_deposit_webhook_logs_valid_payment_unique
  on hb_deposit_webhook_logs (provider, payment_id, payment_status)
  where signature_valid = true and payment_id is not null and payment_status is not null;

create unique index if not exists hb_onchain_purchase_events_log_unique
  on hb_onchain_purchase_events (chain_id, tx_hash, log_index)
  where log_index is not null;

create unique index if not exists hb_onchain_purchase_events_contract_event_id_unique
  on hb_onchain_purchase_events (contract_event_id);

create unique index if not exists hb_user_products_package_purchase_id_unique
  on hb_user_products (package_purchase_id);

create unique index if not exists hb_book_downloads_user_book_unique
  on hb_book_downloads (user_id, book_id);

create unique index if not exists hb_registration_activation_fees_tx_hash_unique
  on hb_registration_activation_fees (tx_hash);

create unique index if not exists hb_onchain_sync_cursors_contract_key_unique
  on hb_onchain_sync_cursors (contract_key);

create unique index if not exists hb_deposit_event_logs_event_id_unique
  on hb_deposit_event_logs (event_id);

create unique index if not exists hb_coin_balances_user_symbol_unique
  on hb_coin_balances (user_id, coin_symbol);
