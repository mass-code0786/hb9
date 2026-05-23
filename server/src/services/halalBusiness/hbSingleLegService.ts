import type pg from "pg";
import { pool } from "../../db/pool.js";
import { createLedgerProof } from "./hbLedgerProofService.js";
import { applyIncomeCap } from "./hbIncomeCapService.js";

export const singleLegSlabs = [
  { slabNumber: 1, targetMembers: 100, rewardAmount: "10", requiredDirectReferrals: 1 },
  { slabNumber: 2, targetMembers: 350, rewardAmount: "20", requiredDirectReferrals: 2 },
  { slabNumber: 3, targetMembers: 1350, rewardAmount: "40", requiredDirectReferrals: 3 },
  { slabNumber: 4, targetMembers: 2850, rewardAmount: "80", requiredDirectReferrals: 5 },
  { slabNumber: 5, targetMembers: 7850, rewardAmount: "150", requiredDirectReferrals: 8 },
  { slabNumber: 6, targetMembers: 22850, rewardAmount: "350", requiredDirectReferrals: 12 },
  { slabNumber: 7, targetMembers: 72850, rewardAmount: "1500", requiredDirectReferrals: 22 },
  { slabNumber: 8, targetMembers: 272850, rewardAmount: "5000", requiredDirectReferrals: 42 },
  { slabNumber: 9, targetMembers: 1272850, rewardAmount: "10000", requiredDirectReferrals: 92 }
] as const;

export type SingleLegSlab = typeof singleLegSlabs[number];

export async function placeUserInGlobalSingleLeg(input: {
  client: pg.PoolClient;
  userId: string;
  packageAmount: string | number;
}) {
  const { client, userId, packageAmount } = input;
  if (Number(packageAmount) < 20) return null;
  await client.query("select pg_advisory_xact_lock(hashtext('hb:single-leg:global-position'))");
  const userRows = await client.query<{ sponsor_user_id: string | null }>("select sponsor_user_id from hb_users where id = $1 limit 1", [userId]);
  const existingPositionRows = await client.query<{ position_number: string }>(
    `update hb_single_leg_positions
     set package_amount = greatest(package_amount, $2::numeric),
         sponsor_user_id = coalesce(sponsor_user_id, $3)
     where user_id = $1
     returning position_number::text`,
    [userId, String(packageAmount), userRows.rows[0]?.sponsor_user_id || null]
  );
  if (existingPositionRows.rows[0]) return Number(existingPositionRows.rows[0].position_number || 0);
  const positionRows = await client.query<{ position_number: string }>(
    `insert into hb_single_leg_positions
      (user_id, position_number, sponsor_user_id, package_amount, activated_at)
     values ($1, (select coalesce(max(position_number), 0) + 1 from hb_single_leg_positions), $2, $3, now())
     returning position_number::text`,
    [userId, userRows.rows[0]?.sponsor_user_id || null, String(packageAmount)]
  );
  return Number(positionRows.rows[0]?.position_number || 0);
}

export async function getSingleLegCount(client: pg.PoolClient, userId: string) {
  const rows = await client.query<{ below_count: string }>(
    `select greatest((select coalesce(max(position_number), 0) from hb_single_leg_positions) - position_number, 0)::text as below_count
     from hb_single_leg_positions
     where user_id = $1`,
    [userId]
  );
  return Number(rows.rows[0]?.below_count || 0);
}

export async function getEligibleDirectReferralCount(client: pg.PoolClient, userId: string) {
  const rows = await client.query<{ count: number }>(
    `select count(distinct direct.id)::int as count
     from hb_users direct
     join hb_package_purchases p on p.user_id = direct.id and p.status = 'completed' and p.amount_usd >= 20
     where direct.sponsor_user_id = $1 and direct.status = 'active'`,
    [userId]
  );
  return Number(rows.rows[0]?.count || 0);
}

async function paySingleLegReward(input: {
  client: pg.PoolClient;
  userId: string;
  slab: SingleLegSlab;
  actualSingleLegMembers: number;
  actualDirectReferrals: number;
}) {
  const { client, userId, slab, actualSingleLegMembers, actualDirectReferrals } = input;
  let rewardRows = await client.query<{ id: string; status: string; ledger_reference: string | null }>(
    `update hb_single_leg_rewards
     set actual_single_leg_members = $3,
         actual_direct_referrals = $4,
         status = case when status = 'paid' then 'paid' else 'qualified' end,
         updated_at = now()
     where user_id = $1 and slab_number = $2
     returning id, status, ledger_reference`,
    [userId, slab.slabNumber, actualSingleLegMembers, actualDirectReferrals]
  );
  if (!rewardRows.rows[0]) {
    rewardRows = await client.query<{ id: string; status: string; ledger_reference: string | null }>(
      `insert into hb_single_leg_rewards
        (user_id, slab_number, target_members, reward_amount, required_direct_referrals,
         actual_single_leg_members, actual_direct_referrals, status)
       values ($1,$2,$3,$4,$5,$6,$7,'qualified')
       returning id, status, ledger_reference`,
    [userId, slab.slabNumber, slab.targetMembers, slab.rewardAmount, slab.requiredDirectReferrals, actualSingleLegMembers, actualDirectReferrals]
    );
  }
  const reward = rewardRows.rows[0];
  if (!reward || reward.status === "paid") return reward?.ledger_reference || null;

  const incomeIdempotencyKey = `hb:single_leg:${userId}:slab:${slab.slabNumber}:income`;
  const existingIncomeRows = await client.query<{ id: string }>(
    "select id from hb_income_ledger where idempotency_key = $1 limit 1",
    [incomeIdempotencyKey]
  );
  let incomeLedgerId = existingIncomeRows.rows[0]?.id || null;
  if (!incomeLedgerId) {
    const incomeRows = await client.query<{ id: string }>(
      `insert into hb_income_ledger
        (earner_user_id, source_user_id, income_type, amount_usd, status, idempotency_key, metadata)
       values ($1,$1,'single_leg_income',$2,'credited',$3,$4::jsonb)
       returning id`,
    [
      userId,
      slab.rewardAmount,
      incomeIdempotencyKey,
      JSON.stringify({
        slabNumber: slab.slabNumber,
        targetMembers: slab.targetMembers,
        actualSingleLegMembers,
        requiredDirectReferrals: slab.requiredDirectReferrals,
        actualDirectReferrals
      })
    ]
    );
    incomeLedgerId = incomeRows.rows[0]?.id || null;
  }
  if (!incomeLedgerId) throw new Error("Single-leg income ledger could not be created.");
  await createLedgerProof(client, "hb_income_ledger", incomeLedgerId);

  await applyIncomeCap({
    client,
    userId,
    incomeLedgerId,
    incomeAmount: slab.rewardAmount,
    incomeType: "single_leg_income",
    metadata: { slabNumber: slab.slabNumber, rewardId: reward.id }
  });

  const proofRows = incomeLedgerId
    ? await client.query<{ public_reference_id: string }>(
      "select public_reference_id from hb_ledger_proofs where source_table = 'hb_income_ledger' and ledger_entry_id = $1 limit 1",
      [incomeLedgerId]
    )
    : { rows: [] as Array<{ public_reference_id: string }> };
  const proofReference = proofRows.rows[0]?.public_reference_id || null;
  const ledgerReference = incomeLedgerId;

  await client.query(
    `update hb_single_leg_rewards
     set status = 'paid',
         paid_at = coalesce(paid_at, now()),
         ledger_reference = coalesce(ledger_reference, $3),
         proof_reference = coalesce(proof_reference, $4),
         actual_single_leg_members = $5,
         actual_direct_referrals = $6,
         updated_at = now()
     where user_id = $1 and slab_number = $2 and status <> 'paid'`,
    [userId, slab.slabNumber, ledgerReference, proofReference, actualSingleLegMembers, actualDirectReferrals]
  );
  await client.query(
    `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
     values ($1,'hb.single_leg_reward.paid','hb_single_leg_reward',$2,$3::jsonb)`,
    [userId, reward.id, JSON.stringify({ slabNumber: slab.slabNumber, rewardAmount: slab.rewardAmount, ledgerReference, proofReference })]
  );
  return ledgerReference;
}

export async function evaluateSingleLegRewards(userId: string, client?: pg.PoolClient) {
  const run = async (activeClient: pg.PoolClient) => {
    await activeClient.query("select pg_advisory_xact_lock(hashtext($1))", [`hb:single-leg:reward:${userId}`]);
    const positionRows = await activeClient.query<{ position_number: string }>("select position_number::text from hb_single_leg_positions where user_id = $1", [userId]);
    if (!positionRows.rows[0]) return { userId, eligible: false, singleLegMembers: 0, directReferrals: 0, rewards: [] };

    const singleLegMembers = await getSingleLegCount(activeClient, userId);
    const directReferrals = await getEligibleDirectReferralCount(activeClient, userId);
    const rewards = [];

    for (const slab of singleLegSlabs) {
      const targetMet = singleLegMembers >= slab.targetMembers;
      const referralsMet = directReferrals >= slab.requiredDirectReferrals;
      const status = targetMet && referralsMet ? "qualified" : "locked";
      const updatedRewardRows = await activeClient.query<{ id: string }>(
        `update hb_single_leg_rewards
         set actual_single_leg_members = $3,
             actual_direct_referrals = $4,
             status = case when status = 'paid' then 'paid' else $5 end,
             updated_at = now()
         where user_id = $1 and slab_number = $2
         returning id`,
        [userId, slab.slabNumber, singleLegMembers, directReferrals, status]
      );
      if (!updatedRewardRows.rows[0]) {
        await activeClient.query(
          `insert into hb_single_leg_rewards
            (user_id, slab_number, target_members, reward_amount, required_direct_referrals,
             actual_single_leg_members, actual_direct_referrals, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [userId, slab.slabNumber, slab.targetMembers, slab.rewardAmount, slab.requiredDirectReferrals, singleLegMembers, directReferrals, status]
        );
      }
      if (targetMet && referralsMet) {
        await paySingleLegReward({ client: activeClient, userId, slab, actualSingleLegMembers: singleLegMembers, actualDirectReferrals: directReferrals });
      }
      rewards.push({ ...slab, targetMet, referralsMet, status });
    }
    return { userId, eligible: true, singleLegMembers, directReferrals, rewards };
  };

  if (client) return run(client);
  if (!pool) throw new Error("Database is not configured.");
  const ownClient = await pool.connect();
  try {
    await ownClient.query("begin");
    const result = await run(ownClient);
    await ownClient.query("commit");
    return result;
  } catch (error) {
    await ownClient.query("rollback");
    throw error;
  } finally {
    ownClient.release();
  }
}

export async function evaluateAllPendingSingleLegRewards(client?: pg.PoolClient) {
  const run = async (activeClient: pg.PoolClient) => {
    const rows = await activeClient.query<{ user_id: string }>("select user_id from hb_single_leg_positions order by position_number asc");
    const results = [];
    for (const row of rows.rows) {
      results.push(await evaluateSingleLegRewards(row.user_id, activeClient));
    }
    return results;
  };

  if (client) return run(client);
  if (!pool) throw new Error("Database is not configured.");
  const ownClient = await pool.connect();
  try {
    await ownClient.query("begin");
    const result = await run(ownClient);
    await ownClient.query("commit");
    return result;
  } catch (error) {
    await ownClient.query("rollback");
    throw error;
  } finally {
    ownClient.release();
  }
}

export async function placeAndEvaluateSingleLegForPurchase(input: {
  client: pg.PoolClient;
  userId: string;
  packageAmount: string | number;
}) {
  const position = await placeUserInGlobalSingleLeg(input);
  if (!position) return null;
  const rows = await input.client.query<{ user_id: string }>(
    "select user_id from hb_single_leg_positions where position_number <= $1 order by position_number asc",
    [position]
  );
  for (const row of rows.rows) {
    await evaluateSingleLegRewards(row.user_id, input.client);
  }
  return position;
}

export async function getSingleLegProgress(client: pg.PoolClient, userId: string) {
  await evaluateSingleLegRewards(userId, client);
  const positionRows = await client.query<{ position_number: string; package_amount: string }>(
    "select position_number::text, package_amount::text from hb_single_leg_positions where user_id = $1",
    [userId]
  );
  const rewardsRows = await client.query<Record<string, unknown>>(
    `select slab_number, target_members, reward_amount::text, required_direct_referrals,
            actual_single_leg_members, actual_direct_referrals, status, paid_at, ledger_reference, proof_reference
     from hb_single_leg_rewards
     where user_id = $1
     order by slab_number asc`,
    [userId]
  );
  const singleLegMembers = await getSingleLegCount(client, userId);
  const directReferrals = await getEligibleDirectReferralCount(client, userId);
  const nextReward = rewardsRows.rows.find((row) => row.status !== "paid") || rewardsRows.rows[0] || null;
  return {
    eligible: Boolean(positionRows.rows[0]),
    positionNumber: positionRows.rows[0]?.position_number || null,
    packageAmount: positionRows.rows[0]?.package_amount || null,
    singleLegTeamCount: singleLegMembers,
    eligibleDirectReferralCount: directReferrals,
    nextReward,
    rewards: rewardsRows.rows,
    countingRule: "Single-leg members are global eligible users with positions below this user. Slab targets are cumulative."
  };
}

export async function reserveSingleLegIncome(input: {
  client: pg.PoolClient;
  purchaseId: string;
  buyerUserId: string;
  packageId: string;
}) {
  const { client, purchaseId, buyerUserId, packageId } = input;
  const ledgerIdempotencyKey = `hb:distribution:${purchaseId}:single_leg_reserve`;
  const existingLedgerRows = await client.query<{ id: string }>(
    "select id from hb_income_ledger where idempotency_key = $1 limit 1",
    [ledgerIdempotencyKey]
  );
  let ledgerId = existingLedgerRows.rows[0]?.id || null;
  if (!ledgerId) {
    const ledgerRows = await client.query<{ id: string }>(
      `insert into hb_income_ledger
        (earner_user_id, source_user_id, package_purchase_id, income_type, amount_usd, status, idempotency_key, metadata)
       select null, $2, $1, 'single_leg', round(amount_usd * 0.15, 8), 'company_allocated', $4, $5::jsonb
       from hb_package_purchases
       where id = $1
       returning id`,
      [
        purchaseId,
        buyerUserId,
        packageId,
        ledgerIdempotencyKey,
        JSON.stringify({
          algorithmVersion: "pending",
          note: "TODO: final single-leg algorithm is not implemented. Funds are reserved only."
        })
      ]
    );
    ledgerId = ledgerRows.rows[0]?.id || null;
  }
  await createLedgerProof(client, "hb_income_ledger", ledgerId);

  const existingReserveRows = await client.query<{ id: string }>(
    "select id from hb_single_leg_reserve where package_purchase_id = $1 limit 1",
    [purchaseId]
  );
  if (!existingReserveRows.rows[0]) {
    await client.query(
      `insert into hb_single_leg_reserve
        (package_purchase_id, buyer_user_id, package_id, amount_usd, ledger_entry_id, metadata)
       select $1, $2, $3, round(amount_usd * 0.15, 8), $4, $5::jsonb
       from hb_package_purchases
       where id = $1`,
      [
        purchaseId,
        buyerUserId,
        packageId,
        ledgerId,
        JSON.stringify({ algorithmVersion: "pending" })
      ]
    );
  }
}
