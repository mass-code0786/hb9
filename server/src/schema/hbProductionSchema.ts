import type pg from "pg";

export type RequiredTable = {
  table: string;
  columns: string[];
};

export const hbRequiredSchema: RequiredTable[] = [
  {
    table: "hb_users",
    columns: [
      "id", "email", "mobile_number", "password_hash", "display_name", "referral_code", "sponsor_user_id", "status",
      "wallet_address", "usdt_bep20_address", "hb9_wallet_address", "wallet_bound_at", "wallet_updated_at",
      "activation_fee_paid", "activation_fee_tx_hash", "failed_login_count",
      "locked_until", "last_login_at", "activated_at", "created_at", "updated_at"
    ]
  },
  { table: "hb_wallets", columns: ["id", "user_id", "network", "wallet_address", "wallet_type", "is_primary", "created_at"] },
  { table: "hb_packages", columns: ["id", "name", "amount_usd", "status", "sort_order", "created_at", "updated_at"] },
  {
    table: "hb_products",
    columns: [
      "id", "package_id", "title", "slug", "description", "image_url", "package_price", "delivery_type", "stock", "active",
      "featured", "created_at", "updated_at"
    ]
  },
  { table: "hb_product_images", columns: ["id", "product_id", "image_url", "alt_text", "sort_order", "created_at"] },
  {
    table: "hb_deposits",
    columns: [
      "id", "user_id", "network", "asset", "amount", "usd_amount", "tx_hash", "wallet_address", "status",
      "verification_status", "failure_reason", "provider", "payment_id", "pay_address", "pay_currency", "price_amount",
      "pay_amount", "payment_status", "payment_invoice_url", "signature_valid", "verified_at", "created_at", "updated_at"
    ]
  },
  {
    table: "hb_withdrawals",
    columns: [
      "id", "user_id", "amount_usd", "gross_amount", "fee_usd", "fee_amount", "payout_amount_usd", "net_amount",
      "currency", "network", "wallet_address", "status", "tx_hash", "failure_reason", "refund_status",
      "refund_ledger_entry_id", "requested_at", "reviewed_at", "approved_at", "processing_at", "paid_at",
      "rejected_at", "cancelled_at", "updated_at"
    ]
  },
  {
    table: "hb_package_purchases",
    columns: [
      "id", "user_id", "package_id", "amount_usd", "status", "idempotency_key", "ledger_entry_id",
      "contract_purchase_tx_hash", "act_purchase_tx_hash", "contract_event_id", "block_number", "log_index",
      "onchain_package_id", "onchain_buyer_address", "onchain_sponsor_address", "onchain_status", "onchain_tx_hash",
      "chain_id", "public_reference_id", "payout_mode", "synced_at", "created_at", "updated_at"
    ]
  },
  {
    table: "hb_product_orders",
    columns: [
      "id", "buyer_user_id", "package_purchase_id", "order_number", "amount_usd", "idempotency_key",
      "payment_status", "activation_status", "distribution_status", "contract_purchase_tx_hash", "act_purchase_tx_hash",
      "contract_event_id", "block_number", "log_index", "onchain_package_id", "onchain_buyer_address",
      "onchain_sponsor_address", "onchain_status", "synced_at", "created_at", "updated_at"
    ]
  },
  {
    table: "hb_product_order_items",
    columns: ["id", "order_id", "product_id", "package_id", "title", "package_price", "quantity", "line_total_usd", "created_at"]
  },
  {
    table: "hb_income_ledger",
    columns: [
      "id", "earner_user_id", "source_user_id", "package_purchase_id", "income_type", "level_depth", "amount_usd",
      "credited_amount", "capped_amount", "cap_status", "cap_date", "status", "idempotency_key", "metadata",
      "proof_hash", "created_at", "updated_at"
    ]
  },
  {
    table: "hb_internal_ledger",
    columns: ["id", "user_id", "wallet_type", "direction", "amount_usd", "reference_type", "reference_id", "idempotency_key", "metadata", "proof_hash", "created_at"]
  },
  {
    table: "hb_coin_balances",
    columns: ["id", "user_id", "coin_symbol", "balance", "created_at", "updated_at"]
  },
  {
    table: "hb_coin_balance_ledger",
    columns: ["id", "user_id", "coin_symbol", "amount", "amount_usd", "type", "direction", "reference_id", "note", "idempotency_key", "metadata", "proof_hash", "created_at"]
  },
  {
    table: "hb_coin_conversions",
    columns: [
      "id", "user_id", "from_coin", "to_coin", "from_amount", "to_amount", "rate", "usd_price", "usd_value",
      "credited_usdt", "from_usd_value", "usdt_credit_amount", "hb9_credit_amount", "hb9_price_used", "status",
      "idempotency_key", "proof_reference_id", "proof_reference", "debit_ledger_entry_id", "credit_ledger_entry_id",
      "usdt_credit_ledger_entry_id", "hb9_credit_ledger_entry_id", "internal_ledger_entry_id", "created_at", "updated_at"
    ]
  },
  {
    table: "hb_referrals",
    columns: ["id", "sponsor_user_id", "referred_user_id", "level_depth", "created_at"]
  },
  {
    table: "hb_salary_income",
    columns: [
      "user_id", "salary_amount", "status", "self_package_ok", "direct_100_count", "team_100_count",
      "unlocked_at", "paid_at", "ledger_reference", "proof_reference", "created_at", "updated_at"
    ]
  },
  {
    table: "hb_single_leg_positions",
    columns: ["id", "user_id", "position_number", "sponsor_user_id", "package_amount", "activated_at", "created_at"]
  },
  {
    table: "hb_single_leg_rewards",
    columns: [
      "id", "user_id", "slab_number", "target_members", "reward_amount", "required_direct_referrals",
      "actual_single_leg_members", "actual_direct_referrals", "status", "paid_at", "ledger_reference",
      "proof_reference", "created_at", "updated_at"
    ]
  },
  {
    table: "hb_single_leg_reserve",
    columns: ["id", "package_purchase_id", "buyer_user_id", "package_id", "amount_usd", "status", "ledger_entry_id", "algorithm_version", "metadata", "created_at"]
  },
  {
    table: "hb_daily_income_caps",
    columns: ["id", "user_id", "cap_date", "package_amount", "daily_cap_amount", "credited_amount", "capped_amount", "created_at", "updated_at"]
  },
  {
    table: "hb_user_products",
    columns: ["id", "user_id", "package_purchase_id", "package_id", "package_name", "package_amount", "activated_at", "created_at"]
  },
  {
    table: "hb_ledger_proofs",
    columns: [
      "id", "public_reference_id", "source_table", "ledger_entry_id", "user_id", "masked_user_id", "proof_type",
      "amount_usd", "status", "reference_type", "reference_id", "proof_hash", "previous_proof_hash",
      "proof_payload_json", "chain_tx_hash", "onchain_status", "created_at"
    ]
  },
  {
    table: "hb_onchain_contracts",
    columns: ["id", "key", "chain_id", "contract_address", "start_block", "enabled", "label", "updated_at"]
  },
  {
    table: "hb_onchain_purchase_events",
    columns: [
      "id", "contract_event_id", "tx_hash", "chain_id", "contract_address", "block_number", "log_index",
      "onchain_package_id", "buyer_address", "sponsor_address", "referral_code", "amount_usd", "buyer_user_id",
      "status", "raw_event", "synced_at", "created_at", "updated_at"
    ]
  },
  {
    table: "hb_onchain_sync_cursors",
    columns: [
      "contract_key", "chain_id", "contract_address", "from_block", "to_block", "last_block", "last_synced_block",
      "last_scanned_block", "last_checked_block", "last_status", "last_error", "updated_at"
    ]
  },
  {
    table: "hb_onchain_sync_logs",
    columns: [
      "id", "contract_key", "from_block", "to_block", "last_block", "last_synced_block", "last_scanned_block",
      "last_checked_block", "status", "last_status", "events_found", "error", "last_error", "triggered_by",
      "created_at", "updated_at"
    ]
  },
  {
    table: "hb_onchain_failed_events",
    columns: ["id", "contract_event_id", "tx_hash", "chain_id", "block_number", "log_index", "error", "raw_event", "retry_count", "next_retry_at", "status", "created_at", "updated_at"]
  },
  { table: "hb_financial_settings", columns: ["key", "value", "updated_at"] },
  { table: "hb_withdrawal_limits", columns: ["id", "user_id", "min_withdrawal_usd", "fee_percent", "daily_limit_usd", "cooldown_minutes", "active", "created_at", "updated_at"] },
  { table: "hb_production_controls", columns: ["key", "value", "updated_by", "updated_at"] },
  {
    table: "hb_registration_activation_fees",
    columns: [
      "id", "user_id", "wallet_address", "treasury_wallet", "tx_hash", "amount_bnb", "amount_usd",
      "status", "verification_status", "failure_reason", "chain_id", "confirmations", "verified_at", "created_at", "updated_at"
    ]
  },
  { table: "hb_treasury_settings", columns: ["id", "key", "wallet_address", "network", "chain_id", "label", "updated_by", "created_at", "updated_at"] },
  { table: "hb_risk_flags", columns: ["id", "user_id", "flag", "reason", "active", "created_by", "created_at", "updated_at"] },
  { table: "hb_activation_logs", columns: ["id", "user_id", "package_purchase_id", "previous_status", "new_status", "created_at"] },
  { table: "hb_audit_logs", columns: ["id", "user_id", "action", "entity_type", "entity_id", "metadata", "created_at"] },
  { table: "hb_followers_requests", columns: ["id", "user_id", "package_purchase_id", "package_id", "status", "admin_remark", "created_at", "updated_at"] },
  { table: "hb_custom_software_requests", columns: ["id", "user_id", "package_purchase_id", "status", "admin_remark", "created_at", "updated_at"] },
  { table: "hb_product_library", columns: ["id", "title", "category", "description", "file_url", "cover_image", "status", "sort_order", "created_at"] }
];

export type SchemaVerificationResult = {
  ok: boolean;
  missingTables: string[];
  missingColumns: Array<{ table: string; column: string }>;
};

export async function verifyHbProductionSchema(client: pg.Pool | pg.PoolClient): Promise<SchemaVerificationResult> {
  const tableRows = await client.query<{ table_name: string }>(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
       and table_name = any($1::text[])`,
    [hbRequiredSchema.map((item) => item.table)]
  );
  const existingTables = new Set(tableRows.rows.map((row) => row.table_name));
  const missingTables = hbRequiredSchema.filter((item) => !existingTables.has(item.table)).map((item) => item.table);

  const columnRows = await client.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = any($1::text[])`,
    [hbRequiredSchema.map((item) => item.table)]
  );
  const existingColumns = new Set(columnRows.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missingColumns = hbRequiredSchema
    .flatMap((item) => item.columns.map((column) => ({ table: item.table, column })))
    .filter((item) => !existingColumns.has(`${item.table}.${item.column}`));

  return {
    ok: missingTables.length === 0 && missingColumns.length === 0,
    missingTables,
    missingColumns
  };
}

export function formatHbSchemaVerificationFailure(result: SchemaVerificationResult) {
  const lines = ["HB9 production schema verification failed."];
  if (result.missingTables.length) {
    lines.push("Missing tables:");
    for (const table of result.missingTables) lines.push(`- ${table}`);
  }
  if (result.missingColumns.length) {
    lines.push("Missing columns:");
    for (const item of result.missingColumns) lines.push(`- ${item.table}.${item.column}`);
  }
  return lines.join("\n");
}
