import type pg from "pg";
import { pool } from "../../db/pool.js";
import { createLedgerProof } from "./hbLedgerProofService.js";
import { applyIncomeCap } from "./hbIncomeCapService.js";

const salaryAmountUsd = "100";
const minimumPackageUsd = "100";
const requiredDirectUsers = 5;
const requiredTeamUsers = 5;

type SalaryStatus = "locked" | "unlocked" | "paid";

type SalaryEvaluationResult = {
  userId: string;
  salaryAmount: string;
  status: SalaryStatus;
  selfPackageOk: boolean;
  direct100Count: number;
  team100Count: number;
  ledgerReference: string | null;
  proofReference: string | null;
};

async function evaluateWithClient(client: pg.PoolClient, userId: string): Promise<SalaryEvaluationResult> {
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [`hb:salary:${userId}`]);

  const metricsRows = await client.query<{
    self_package_ok: boolean;
    direct_100_count: number;
    team_100_count: number;
  }>(
    `with recursive team(user_id, depth, path) as (
       select child.id, 1, array[child.id]
       from hb_users child
       where child.sponsor_user_id = $1
       union all
       select child.id, team.depth + 1, team.path || child.id
       from team
       join hb_users child on child.sponsor_user_id = team.user_id
       where team.depth < 15 and not child.id = any(team.path)
     ),
     qualified_buyers as (
       select distinct user_id
       from hb_package_purchases
       where status = 'completed' and amount_usd >= $2::numeric
     )
     select
       exists(select 1 from qualified_buyers where user_id = $1) as self_package_ok,
       count(distinct direct.id) filter (where qb_direct.user_id is not null)::int as direct_100_count,
       count(distinct team.user_id) filter (where qb_team.user_id is not null)::int as team_100_count
     from hb_users owner
     left join hb_users direct on direct.sponsor_user_id = owner.id
     left join qualified_buyers qb_direct on qb_direct.user_id = direct.id
     left join team on true
     left join qualified_buyers qb_team on qb_team.user_id = team.user_id
     where owner.id = $1
     group by owner.id`,
    [userId, minimumPackageUsd]
  );

  const metrics = metricsRows.rows[0] || { self_package_ok: false, direct_100_count: 0, team_100_count: 0 };
  const selfPackageOk = Boolean(metrics.self_package_ok);
  const direct100Count = Number(metrics.direct_100_count || 0);
  const team100Count = Number(metrics.team_100_count || 0);
  const eligible = selfPackageOk && direct100Count >= requiredDirectUsers && team100Count >= requiredTeamUsers;

  const existingRows = await client.query<{
    status: SalaryStatus;
    ledger_reference: string | null;
    proof_reference: string | null;
  }>(
    `select status, ledger_reference, proof_reference
     from hb_salary_income
     where user_id = $1
     for update`,
    [userId]
  );
  const existing = existingRows.rows[0] || null;

  if (!existing) {
    await client.query(
      `insert into hb_salary_income
        (user_id, salary_amount, status, self_package_ok, direct_100_count, team_100_count)
       values ($1,$2,'locked',$3,$4,$5)`,
      [userId, salaryAmountUsd, selfPackageOk, direct100Count, team100Count]
    );
  } else if (existing.status === "paid") {
    await client.query(
      `update hb_salary_income
       set self_package_ok = $2, direct_100_count = $3, team_100_count = $4, updated_at = now()
       where user_id = $1`,
      [userId, selfPackageOk, direct100Count, team100Count]
    );
    return {
      userId,
      salaryAmount: salaryAmountUsd,
      status: "paid",
      selfPackageOk,
      direct100Count,
      team100Count,
      ledgerReference: existing.ledger_reference,
      proofReference: existing.proof_reference
    };
  } else {
    await client.query(
      `update hb_salary_income
       set status = case when $5::boolean then 'unlocked' else status end,
           self_package_ok = $2,
           direct_100_count = $3,
           team_100_count = $4,
           unlocked_at = case when $5::boolean and unlocked_at is null then now() else unlocked_at end,
           updated_at = now()
       where user_id = $1`,
      [userId, selfPackageOk, direct100Count, team100Count, eligible]
    );
  }

  if (!eligible) {
    const lockedRows = await client.query<{
      status: SalaryStatus;
      ledger_reference: string | null;
      proof_reference: string | null;
    }>("select status, ledger_reference, proof_reference from hb_salary_income where user_id = $1", [userId]);
    const row = lockedRows.rows[0];
    return {
      userId,
      salaryAmount: salaryAmountUsd,
      status: row?.status || "locked",
      selfPackageOk,
      direct100Count,
      team100Count,
      ledgerReference: row?.ledger_reference || null,
      proofReference: row?.proof_reference || null
    };
  }

  const incomeIdempotencyKey = `hb:salary:${userId}:income`;
  const existingIncomeRows = await client.query<{ id: string }>(
    "select id from hb_income_ledger where idempotency_key = $1 limit 1",
    [incomeIdempotencyKey]
  );
  let incomeLedgerId = existingIncomeRows.rows[0]?.id || null;
  if (!incomeLedgerId) {
    const incomeRows = await client.query<{ id: string }>(
      `insert into hb_income_ledger
        (earner_user_id, source_user_id, income_type, amount_usd, status, idempotency_key, metadata)
       values ($1,$1,'salary_income',$2,'credited',$3,$4::jsonb)
       returning id`,
      [
        userId,
        salaryAmountUsd,
        incomeIdempotencyKey,
        JSON.stringify({
          salaryAmountUsd,
          selfPackageOk,
          direct100Count,
          team100Count,
          teamCountingRule: "Team count uses distinct referred team users up to 15 levels; direct Level-1 users are included once if qualified."
        })
      ]
    );
    incomeLedgerId = incomeRows.rows[0]?.id || null;
  }
  if (!incomeLedgerId) throw new Error("Salary income ledger could not be created.");
  await createLedgerProof(client, "hb_income_ledger", incomeLedgerId);

  await applyIncomeCap({
    client,
    userId,
    incomeLedgerId,
    incomeAmount: salaryAmountUsd,
    incomeType: "salary_income",
    metadata: { selfPackageOk, direct100Count, team100Count }
  });

  const proofRows = incomeLedgerId
    ? await client.query<{ public_reference_id: string }>(
      "select public_reference_id from hb_ledger_proofs where source_table = 'hb_income_ledger' and ledger_entry_id = $1 limit 1",
      [incomeLedgerId]
    )
    : { rows: [] as Array<{ public_reference_id: string }> };
  const proofReference = proofRows.rows[0]?.public_reference_id || null;

  await client.query(
    `update hb_salary_income
     set status = 'paid',
         self_package_ok = $2,
         direct_100_count = $3,
         team_100_count = $4,
         unlocked_at = coalesce(unlocked_at, now()),
         paid_at = coalesce(paid_at, now()),
         ledger_reference = coalesce(ledger_reference, $5),
         proof_reference = coalesce(proof_reference, $6),
         updated_at = now()
     where user_id = $1`,
    [userId, selfPackageOk, direct100Count, team100Count, incomeLedgerId, proofReference]
  );
  await client.query(
    `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
     values ($1,'hb.salary_income.paid','hb_salary_income',$1,$2::jsonb)`,
    [userId, JSON.stringify({ salaryAmountUsd, incomeLedgerId, proofReference, selfPackageOk, direct100Count, team100Count })]
  );

  return {
    userId,
    salaryAmount: salaryAmountUsd,
    status: "paid",
    selfPackageOk,
    direct100Count,
    team100Count,
    ledgerReference: incomeLedgerId,
    proofReference
  };
}

export async function evaluateSalaryIncome(userId: string, client?: pg.PoolClient) {
  if (client) return evaluateWithClient(client, userId);
  if (!pool) throw new Error("Database is not configured.");
  const ownClient = await pool.connect();
  try {
    await ownClient.query("begin");
    const result = await evaluateWithClient(ownClient, userId);
    await ownClient.query("commit");
    return result;
  } catch (error) {
    await ownClient.query("rollback");
    throw error;
  } finally {
    ownClient.release();
  }
}

export async function evaluateSalaryIncomeForPurchase(client: pg.PoolClient, buyerUserId: string) {
  const userRows = await client.query<{ user_id: string }>(
    `with recursive chain(user_id, depth, path) as (
       select $1::uuid, 0, array[$1::uuid]
       union all
       select u.sponsor_user_id, chain.depth + 1, chain.path || u.sponsor_user_id
       from chain
       join hb_users u on u.id = chain.user_id
       where chain.depth < 15
         and u.sponsor_user_id is not null
         and not u.sponsor_user_id = any(chain.path)
     )
     select user_id from chain`,
    [buyerUserId]
  );
  const results: SalaryEvaluationResult[] = [];
  for (const row of userRows.rows) {
    results.push(await evaluateWithClient(client, row.user_id));
  }
  return results;
}
