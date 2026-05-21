import type pg from "pg";
import { createLedgerProof } from "./hbLedgerProofService.js";
import { applyIncomeCap } from "./hbIncomeCapService.js";

type DistributionInput = {
  client: pg.PoolClient;
  purchaseId: string;
  buyerUserId: string;
  packageId: string;
  amountUsd: string;
};

async function insertIncomeLedger(input: {
  client: pg.PoolClient;
  earnerUserId: string | null;
  sourceUserId: string;
  purchaseId: string;
  incomeType: "referral_income" | "level_income" | "company";
  amountSql: string;
  status: "credited" | "locked" | "company_allocated" | "pending";
  levelDepth?: number | null;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
}) {
  const rows = await input.client.query<{ id: string }>(
    `insert into hb_income_ledger
      (earner_user_id, source_user_id, package_purchase_id, income_type, amount_usd, status, level_depth, idempotency_key, metadata)
     select $1, $2, $3, $4, ${input.amountSql}, $5, $6, $7, $8::jsonb
     on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
     returning id`,
    [
      input.earnerUserId,
      input.sourceUserId,
      input.purchaseId,
      input.incomeType,
      input.status,
      input.levelDepth || null,
      input.idempotencyKey,
      JSON.stringify(input.metadata)
    ]
  );
  const ledgerId = rows.rows[0]?.id || null;
  await createLedgerProof(input.client, "hb_income_ledger", ledgerId);
  if (ledgerId && input.earnerUserId && input.status === "credited" && (input.incomeType === "referral_income" || input.incomeType === "level_income")) {
    const amountRows = await input.client.query<{ amount_usd: string }>("select amount_usd::text from hb_income_ledger where id = $1", [ledgerId]);
    const amount = amountRows.rows[0]?.amount_usd || "0";
    await applyIncomeCap({
      client: input.client,
      userId: input.earnerUserId,
      incomeLedgerId: ledgerId,
      incomeAmount: amount,
      incomeType: input.incomeType,
      metadata: { sourceUserId: input.sourceUserId, packagePurchaseId: input.purchaseId, levelDepth: input.levelDepth || null }
    });
  }
  return ledgerId;
}

export async function distributePackagePurchase({ client, purchaseId, buyerUserId, packageId, amountUsd }: DistributionInput) {
  await client.query(
    `insert into hb_distribution_runs (package_purchase_id, user_id, package_id, amount_usd)
     values ($1,$2,$3,$4)
     on conflict (package_purchase_id) do nothing`,
    [purchaseId, buyerUserId, packageId, amountUsd]
  );

  const runRows = await client.query<{ id: string }>(
    "select id from hb_distribution_runs where package_purchase_id = $1",
    [purchaseId]
  );
  if (!runRows.rows[0]) throw new Error("Distribution marker could not be created.");

  const sponsorRows = await client.query<{ sponsor_user_id: string | null }>(
    "select sponsor_user_id from hb_users where id = $1",
    [buyerUserId]
  );
  const sponsorId = sponsorRows.rows[0]?.sponsor_user_id || null;
  if (sponsorId) {
    await insertIncomeLedger({
      client,
      earnerUserId: sponsorId,
      sourceUserId: buyerUserId,
      purchaseId,
      incomeType: "referral_income",
      amountSql: "round((select amount_usd from hb_package_purchases where id = $3) * 0.20, 8)",
      status: "credited",
      idempotencyKey: `hb:distribution:${purchaseId}:direct_upline`,
      metadata: { reason: "direct_sponsor", percent: 20 }
    });
  }

  await insertIncomeLedger({
    client,
    earnerUserId: null,
    sourceUserId: buyerUserId,
    purchaseId,
    incomeType: "company",
    amountSql: "round((select amount_usd from hb_package_purchases where id = $3) * 0.50, 8)",
    status: "company_allocated",
    idempotencyKey: `hb:distribution:${purchaseId}:treasury_hold`,
    metadata: { allocation: "treasury_hold", withdrawable: false, percent: 50 }
  });

  const uplines = await client.query<{ level_no: number; upline_id: string | null }>(
    `with recursive chain(level_no, upline_id) as (
       select 1, sponsor_user_id from hb_users where id = $1
       union all
       select chain.level_no + 1, hb_users.sponsor_user_id
       from chain
       join hb_users on hb_users.id = chain.upline_id
       where chain.level_no < 15
     )
     select levels.level_no, chain.upline_id
     from generate_series(1, 15) as levels(level_no)
     left join chain on chain.level_no = levels.level_no
     order by levels.level_no`,
    [buyerUserId]
  );

  for (const row of uplines.rows) {
    const receiverId = row.upline_id;
    if (!receiverId) continue;
    const levelPercent = row.level_no <= 5 ? "0.03" : row.level_no <= 10 ? "0.02" : "0.01";
    const unlockRows = await client.query<{ direct_count: number }>(
      `select count(distinct direct.id)::int as direct_count
       from hb_users direct
       join hb_package_purchases p on p.user_id = direct.id and p.status = 'completed' and p.amount_usd >= 4
       where direct.sponsor_user_id = $1 and direct.status = 'active'`,
      [receiverId]
    );
    const directUnlockCount = Number(unlockRows.rows[0]?.direct_count || 0);
    const unlocked = directUnlockCount >= row.level_no;
    const ledgerId = await insertIncomeLedger({
      client,
      earnerUserId: receiverId,
      sourceUserId: buyerUserId,
      purchaseId,
      incomeType: "level_income",
      amountSql: `round((select amount_usd from hb_package_purchases where id = $3) * ${levelPercent}, 8)`,
      status: unlocked ? "credited" : "locked",
      levelDepth: row.level_no,
      idempotencyKey: `hb:distribution:${purchaseId}:level:${row.level_no}`,
      metadata: {
        levelNumber: row.level_no,
        reason: unlocked ? "level_upline" : "level_locked_direct_referral_requirement",
        percent: Number(levelPercent) * 100,
        requiredDirectReferrals: row.level_no,
        actualDirectReferrals: directUnlockCount,
        minimumPackageUsd: 4
      }
    });
    await client.query(
      `insert into hb_level_income_records
        (package_purchase_id, buyer_user_id, receiver_user_id, package_id, level_number, amount_usd, status, ledger_entry_id)
       select $1, $2, $3, $4, $5, round(amount_usd * $8::numeric, 8), $6, $7
       from hb_package_purchases
       where id = $1
       on conflict (package_purchase_id, level_number) do nothing`,
      [purchaseId, buyerUserId, receiverId, packageId, row.level_no, unlocked ? "credited" : "locked", ledgerId, levelPercent]
    );
  }
}
