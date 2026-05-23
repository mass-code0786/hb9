import crypto from "node:crypto";
import type pg from "pg";

type LedgerSourceTable = "hb_internal_ledger" | "hb_income_ledger" | "hb_coin_balance_ledger";

type ProofOptions = {
  chainTxHash?: string | null;
  onchainStatus?: string | null;
};

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function publicReferenceId(sourceTable: LedgerSourceTable, ledgerEntryId: string) {
  return `HBP-${sha256(`${sourceTable}:${ledgerEntryId}`).slice(0, 18).toUpperCase()}`;
}

function maskedUserId(userId: string | null) {
  if (!userId) return "HB9-COMPANY";
  return `HB9-${sha256(userId).slice(0, 8).toUpperCase()}`;
}

function proofType(row: Record<string, any>, sourceTable: LedgerSourceTable) {
  if (sourceTable === "hb_coin_balance_ledger") {
    if (row.reference?.startsWith?.("admin_transfer:")) return row.direction === "credit" ? "internal_transfer_received" : "internal_transfer_sent";
    if (row.reference?.startsWith?.("admin_credit:")) return "admin_credit";
    if (row.reference?.startsWith?.("admin_deduct:")) return "admin_deduction";
    if (row.reference?.startsWith?.("admin_bulk:")) return "bulk_distribution";
    return `coin_${row.direction || "adjustment"}`;
  }
  if (sourceTable === "hb_income_ledger") {
    if (row.income_type === "referral_income" || row.income_type === "upline") return "referral_income";
    if (row.income_type === "level_income" || row.income_type === "level") return "level_income";
    if (row.income_type === "salary_income") return "salary_income";
    if (row.income_type === "single_leg_income") return "single_leg_income";
    if (row.income_type === "single_leg") return "single_leg_reserve";
    if (row.income_type === "product_value") return "product_allocation";
    if (row.income_type === "company") return "company_reserve";
    return String(row.income_type || "income");
  }
  if (row.reference_type === "deposit") return "deposit";
  if (row.reference_type === "package_purchase") return "product_purchase";
  if (row.reference_type === "withdrawal" && row.metadata?.type === "withdrawal_paid") return "withdrawal_paid";
  if (row.reference_type === "withdrawal") return "withdrawal_reserve";
  if (row.reference_type === "recharge_credit") return "recharge_wallet";
  return String(row.reference_type || "ledger_entry");
}

export async function createLedgerProof(
  client: pg.PoolClient,
  sourceTable: LedgerSourceTable,
  ledgerEntryId: string | null | undefined,
  options: ProofOptions = {}
) {
  if (!ledgerEntryId) return null;
  await client.query("select pg_advisory_xact_lock(hashtext('hb-ledger-proof-chain'))");

  const existing = await client.query<{ id: string; public_reference_id: string; proof_hash: string }>(
    "select id, public_reference_id, proof_hash from hb_ledger_proofs where source_table = $1 and ledger_entry_id = $2 limit 1",
    [sourceTable, ledgerEntryId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const sql = sourceTable === "hb_internal_ledger"
    ? `select id, user_id, wallet_type, direction, amount_usd::text, reference_type, reference_id, idempotency_key, metadata, created_at
       from hb_internal_ledger where id = $1 limit 1`
    : sourceTable === "hb_income_ledger"
      ? `select id, earner_user_id as user_id, source_user_id, package_purchase_id, income_type, amount_usd::text, status, level_depth, idempotency_key, metadata, created_at
         from hb_income_ledger where id = $1 limit 1`
      : `select id, user_id, coin_symbol, direction, amount::text as amount_usd, type, reference_id as reference, reference_id, admin_id, note, idempotency_key, created_at,
                jsonb_build_object('coinSymbol', coin_symbol, 'adminId', admin_id, 'note', note) as metadata
         from hb_coin_balance_ledger where id = $1 limit 1`;
  const rows = await client.query<Record<string, any>>(sql, [ledgerEntryId]);
  const row = rows.rows[0];
  if (!row) return null;

  const previousRows = await client.query<{ proof_hash: string }>(
    "select proof_hash from hb_ledger_proofs order by created_at desc, id desc limit 1"
  );
  const previousProofHash = previousRows.rows[0]?.proof_hash || null;
  const publicRef = publicReferenceId(sourceTable, ledgerEntryId);
  const existingPublicRef = await client.query<{ id: string; public_reference_id: string; proof_hash: string }>(
    "select id, public_reference_id, proof_hash from hb_ledger_proofs where public_reference_id = $1 limit 1",
    [publicRef]
  );
  if (existingPublicRef.rows[0]) return existingPublicRef.rows[0];
  const type = proofType(row, sourceTable);
  const userId = row.user_id || null;
  const payload = {
    version: 1,
    publicReferenceId: publicRef,
    sourceTable,
    ledgerEntryId,
    type,
    user: maskedUserId(userId),
    amountUsd: row.amount_usd,
    direction: row.direction || null,
    walletType: row.wallet_type || null,
    status: row.status || null,
    coinSymbol: row.coin_symbol || null,
    referenceType: row.reference_type || row.income_type || row.type || null,
    referenceId: row.reference_id || row.package_purchase_id || (/^[0-9a-fA-F-]{36}$/.test(String(row.reference || "")) ? row.reference : null),
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    previousProofHash,
    chainTxHash: options.chainTxHash || null,
    onchainStatus: options.onchainStatus || "not_applicable"
  };
  const proofHash = sha256(stableJson(payload));

  const proofRows = await client.query<{ id: string; public_reference_id: string; proof_hash: string }>(
    `insert into hb_ledger_proofs
      (public_reference_id, source_table, ledger_entry_id, user_id, masked_user_id, proof_type, amount_usd, status,
       reference_type, reference_id, proof_hash, previous_proof_hash, proof_payload_json, chain_tx_hash, onchain_status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15)
     returning id, public_reference_id, proof_hash`,
    [
      publicRef,
      sourceTable,
      ledgerEntryId,
      userId,
      maskedUserId(userId),
      type,
      row.amount_usd,
      row.status || row.direction || null,
      row.reference_type || row.income_type || row.type || null,
      row.reference_id || row.package_purchase_id || (/^[0-9a-fA-F-]{36}$/.test(String(row.reference || "")) ? row.reference : null),
      proofHash,
      previousProofHash,
      JSON.stringify(payload),
      options.chainTxHash || null,
      options.onchainStatus || "not_applicable"
    ]
  );

  const proof = proofRows.rows[0] || existing.rows[0] || null;
  if (!proof) {
    const stored = await client.query<{ id: string; public_reference_id: string; proof_hash: string }>(
      "select id, public_reference_id, proof_hash from hb_ledger_proofs where public_reference_id = $1 limit 1",
      [publicRef]
    );
    if (stored.rows[0]) return stored.rows[0];
  }

  await client.query(
    `update ${sourceTable}
     set proof_hash = $2,
         previous_proof_hash = $3,
         proof_payload_json = $4::jsonb,
         proof_created_at = now(),
         public_reference_id = $5,
         onchain_tx_hash = coalesce($6, onchain_tx_hash),
         onchain_status = coalesce($7, onchain_status)
     where id = $1`,
    [ledgerEntryId, proofHash, previousProofHash, JSON.stringify(payload), publicRef, options.chainTxHash || null, options.onchainStatus || null]
  );

  return proof;
}

export async function verifyLedgerProofChain(client: pg.PoolClient) {
  const rows = await client.query<{
    id: string;
    proof_hash: string;
    previous_proof_hash: string | null;
    proof_payload_json: Record<string, unknown>;
  }>("select id, proof_hash, previous_proof_hash, proof_payload_json from hb_ledger_proofs order by created_at asc, id asc");

  const broken: Array<{ id: string; reason: string }> = [];
  let previous: string | null = null;
  for (const row of rows.rows) {
    const payload = { ...row.proof_payload_json, previousProofHash: row.previous_proof_hash };
    const expected = sha256(stableJson(payload));
    if (row.previous_proof_hash !== previous) broken.push({ id: row.id, reason: "previous_hash_mismatch" });
    if (row.proof_hash !== expected) broken.push({ id: row.id, reason: "proof_hash_mismatch" });
    previous = row.proof_hash;
  }
  const [duplicateHashes, missingReferences] = await Promise.all([
    client.query<{ proof_hash: string; duplicate_count: number }>(
      `select proof_hash, count(*)::int as duplicate_count
       from hb_ledger_proofs
       group by proof_hash
       having count(*) > 1`
    ),
    client.query<{ source: string; id: string }>(
      `select 'hb_internal_ledger' as source, id::text from hb_internal_ledger where proof_hash is null
       union all
       select 'hb_income_ledger' as source, id::text from hb_income_ledger where proof_hash is null
       union all
       select 'hb_coin_balance_ledger' as source, id::text from hb_coin_balance_ledger where proof_hash is null`
    )
  ]);
  const totalProofs = rows.rowCount || 0;
  const integrityPercent = totalProofs > 0 ? Math.max(0, ((totalProofs - broken.length) / totalProofs) * 100) : 100;
  return {
    totalProofs,
    brokenCount: broken.length,
    integrityPercent,
    broken,
    duplicateHashes: duplicateHashes.rows,
    missingReferences: missingReferences.rows
  };
}

export async function verifyLedgerProofReference(client: pg.PoolClient, referenceId: string) {
  const rows = await client.query<{
    id: string;
    public_reference_id: string;
    source_table: string;
    masked_user_id: string | null;
    proof_type: string;
    amount_usd: string;
    status: string | null;
    reference_type: string | null;
    proof_hash: string;
    previous_proof_hash: string | null;
    proof_payload_json: Record<string, unknown>;
    chain_tx_hash: string | null;
    onchain_status: string;
    created_at: string;
  }>(
    `select id, public_reference_id, source_table, masked_user_id, proof_type, amount_usd::text,
            status, reference_type, proof_hash, previous_proof_hash, proof_payload_json,
            chain_tx_hash, onchain_status, created_at
     from hb_ledger_proofs
     where public_reference_id = $1
     limit 1`,
    [referenceId]
  );
  const proof = rows.rows[0];
  if (!proof) return null;
  const expectedHash = sha256(stableJson({ ...proof.proof_payload_json, previousProofHash: proof.previous_proof_hash }));
  return {
    ...proof,
    expected_hash: expectedHash,
    valid: expectedHash === proof.proof_hash
  };
}
