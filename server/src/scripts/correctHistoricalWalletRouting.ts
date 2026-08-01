import { createInterface } from "node:readline/promises";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { createLedgerProof } from "../services/halalBusiness/hbLedgerProofService.js";

const ALLOWED_INCOME_TYPES = [
  "referral_income",
  "level_income",
  "salary_income",
  "single_leg_income",
  "dividend_income",
  "admin_income"
] as const;
const CORRECTION_TYPE = "historical_wallet_reclassification";
const DECIMAL = /^-?\d+(?:\.\d+)?$/;

type Arguments = {
  execute: boolean;
  expectedRows?: number;
  expectedHistoricalTotal?: string;
  expectedMovableTotal?: string;
  expectedUsedTotal?: string;
};
type Summary = { reference_type: string; row_count: number; total_usd: string; affected_users: number };
type Sample = {
  id: string; user_id: string; wallet_type: string; direction: string; amount_usd: string;
  reference_type: string; reference_id: string; idempotency_key: string; created_at: string;
};
type UserReport = {
  user_id: string;
  historical_misrouted_income: string;
  current_main_wallet: string;
  movable_amount: string;
  used_amount: string;
  projected_main_wallet: string;
  projected_income_wallet: string;
  combined_wallet_before: string;
  combined_wallet_after: string;
};
type Totals = {
  row_count: number;
  affected_users: number;
  total_historical_misrouted_income: string;
  total_movable_amount: string;
  total_already_used_amount: string;
  users_with_partially_used_income: number;
  users_with_fully_movable_income: number;
  negative_main_users: number;
};
type Inventory = { direction: string; reference_type: string; row_count: number; total_usd: string; affected_users: number };

function canonicalDecimal(value: unknown) {
  const text = String(value ?? "").trim();
  if (!DECIMAL.test(text)) throw new Error(`Expected a non-negative decimal, received: ${text}`);
  const [whole, fraction = ""] = text.split(".");
  const normalized = fraction.replace(/0+$/, "");
  return normalized ? `${whole}.${normalized}` : whole;
}

function toUsdUnits(value: unknown) {
  const canonical = canonicalDecimal(value);
  const [whole, fraction = ""] = canonical.split(".");
  return BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, "0"));
}

function fromUsdUnits(value: bigint) {
  const whole = value / 100000000n;
  const fraction = (value % 100000000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function parseArguments(argv: string[]): Arguments {
  const execute = argv.includes("--execute");
  const rowsIndex = argv.indexOf("--expect-rows");
  const historicalIndex = argv.indexOf("--expect-historical-total");
  const movableIndex = argv.indexOf("--expect-movable-total");
  const usedIndex = argv.indexOf("--expect-used-total");
  const rowsText = rowsIndex >= 0 ? argv[rowsIndex + 1] : undefined;
  const historicalText = historicalIndex >= 0 ? argv[historicalIndex + 1] : undefined;
  const movableText = movableIndex >= 0 ? argv[movableIndex + 1] : undefined;
  const usedText = usedIndex >= 0 ? argv[usedIndex + 1] : undefined;
  if (!execute) return { execute: false };
  if (!rowsText || !/^\d+$/.test(rowsText) || !historicalText || !movableText || !usedText) {
    throw new Error(
      "Execution requires --expect-rows, --expect-historical-total, --expect-movable-total, and --expect-used-total from the dry run."
    );
  }
  return {
    execute,
    expectedRows: Number(rowsText),
    expectedHistoricalTotal: canonicalDecimal(historicalText),
    expectedMovableTotal: canonicalDecimal(movableText),
    expectedUsedTotal: canonicalDecimal(usedText)
  };
}

const targetCte = `
  with candidates as (
    select l.*
    from hb_internal_ledger l
    join hb_income_ledger i
      on i.id = l.reference_id
     and i.earner_user_id = l.user_id
     and i.status = 'credited'
     and i.income_type = l.reference_type
    where l.wallet_type = 'deposit'
      and l.direction = 'credit'
      and l.reference_type = any($1::text[])
      and not exists (
        select 1 from hb_internal_ledger correction
        where correction.idempotency_key = 'hb:historical-wallet-routing:' || l.id::text || ':main_debit'
      )
      and not exists (
        select 1 from hb_internal_ledger correction
        where correction.idempotency_key = 'hb:historical-wallet-routing:' || l.id::text || ':income_credit'
      )
      and not exists (
        select 1 from hb_audit_logs audit
        where audit.action = 'historical_wallet_reclassification_consumed'
          and audit.entity_type = 'hb_internal_ledger'
          and audit.entity_id = l.id
      )
  )`;

async function readReport(client: PoolClient) {
  const inventory = await client.query<Inventory>(
    `select direction, reference_type, count(*)::int as row_count,
            coalesce(sum(amount_usd),0)::text as total_usd,
            count(distinct user_id)::int as affected_users
     from hb_internal_ledger
     where wallet_type = 'deposit'
     group by direction, reference_type
     order by direction, reference_type`
  );
  const summary = await client.query<Summary>(
    `${targetCte}
     select reference_type, count(*)::int as row_count, coalesce(sum(amount_usd),0)::text as total_usd,
            count(distinct user_id)::int as affected_users
     from candidates group by reference_type order by reference_type`,
    [[...ALLOWED_INCOME_TYPES]]
  );
  const userReport = await client.query<UserReport>(
    `${targetCte}, historical as (
       select user_id, sum(amount_usd) as historical_misrouted_income
       from candidates group by user_id
     ), balances as (
       select h.user_id, h.historical_misrouted_income,
              coalesce(sum(case when l.wallet_type = 'deposit' and l.direction = 'credit' then l.amount_usd
                                when l.wallet_type = 'deposit' then -l.amount_usd else 0 end),0) as current_main_wallet,
              coalesce(sum(case when l.wallet_type = 'income' and l.direction = 'credit' then l.amount_usd
                                when l.wallet_type = 'income' then -l.amount_usd else 0 end),0) as current_income_wallet
       from historical h left join hb_internal_ledger l on l.user_id = h.user_id
       group by h.user_id, h.historical_misrouted_income
     ), amounts as (
       select *, greatest(least(historical_misrouted_income, current_main_wallet),0) as movable_amount
       from balances
     )
     select user_id::text, historical_misrouted_income::text, current_main_wallet::text,
            movable_amount::text, (historical_misrouted_income - movable_amount)::text as used_amount,
            (current_main_wallet - movable_amount)::text as projected_main_wallet,
            (current_income_wallet + movable_amount)::text as projected_income_wallet,
            (current_main_wallet + current_income_wallet)::text as combined_wallet_before,
            (current_main_wallet + current_income_wallet)::text as combined_wallet_after
     from amounts order by user_id`,
    [[...ALLOWED_INCOME_TYPES]]
  );
  const totals = await client.query<Totals>(
    `${targetCte}, historical as (
       select user_id, sum(amount_usd) as historical_misrouted_income
       from candidates group by user_id
     ), balances as (
       select h.user_id, h.historical_misrouted_income,
              coalesce(sum(case when l.wallet_type = 'deposit' and l.direction = 'credit' then l.amount_usd
                                when l.wallet_type = 'deposit' then -l.amount_usd else 0 end),0) as current_main_wallet
       from historical h left join hb_internal_ledger l on l.user_id = h.user_id
       group by h.user_id, h.historical_misrouted_income
     ), amounts as (
       select *, greatest(least(historical_misrouted_income, current_main_wallet),0) as movable_amount
       from balances
     )
     select (select count(*) from candidates)::int as row_count,
            count(*)::int as affected_users,
            coalesce(sum(historical_misrouted_income),0)::text as total_historical_misrouted_income,
            coalesce(sum(movable_amount),0)::text as total_movable_amount,
            coalesce(sum(historical_misrouted_income - movable_amount),0)::text as total_already_used_amount,
            count(*) filter (where movable_amount < historical_misrouted_income)::int as users_with_partially_used_income,
            count(*) filter (where movable_amount = historical_misrouted_income)::int as users_with_fully_movable_income,
            count(*) filter (where current_main_wallet < 0)::int as negative_main_users
     from amounts`,
    [[...ALLOWED_INCOME_TYPES]]
  );
  const samples = await client.query<Sample>(
    `${targetCte}
     select id::text, user_id::text, wallet_type, direction, amount_usd::text, reference_type,
            reference_id::text, idempotency_key, created_at::text
     from candidates order by created_at, id limit 25`,
    [[...ALLOWED_INCOME_TYPES]]
  );
  return {
    inventory: inventory.rows,
    summary: summary.rows,
    users: userReport.rows,
    totals: totals.rows[0] || {
      row_count: 0, affected_users: 0, total_historical_misrouted_income: "0", total_movable_amount: "0",
      total_already_used_amount: "0", users_with_partially_used_income: 0, users_with_fully_movable_income: 0,
      negative_main_users: 0
    },
    samples: samples.rows
  };
}

function printReport(report: Awaited<ReturnType<typeof readReport>>) {
  console.log("HISTORICAL_WALLET_ROUTING_ALLOWLIST", [...ALLOWED_INCOME_TYPES]);
  console.log("ALL_DEPOSIT_WALLET_LEDGER_INVENTORY");
  console.table(report.inventory);
  console.log("PROVEN_TARGETS_BY_REFERENCE_TYPE");
  console.table(report.summary);
  console.log("TOTALS", report.totals);
  console.log("PER_USER_SAFE_RECLASSIFICATION");
  console.table(report.users);
  console.table(report.samples);
  console.log("EXCLUDED: deposit, package_purchase, withdrawal, coin_conversion, recharge_credit, company, dev_test_balance, and every non-allowlisted/unproven row.");
}

function validateExpected(report: Awaited<ReturnType<typeof readReport>>, args: Arguments) {
  if (report.totals.negative_main_users > 0) {
    throw new Error(`Correction blocked: ${report.totals.negative_main_users} user(s) would have a negative Main Wallet.`);
  }
  if (args.expectedRows !== report.totals.row_count) {
    throw new Error(`Row count changed: expected ${args.expectedRows}, found ${report.totals.row_count}.`);
  }
  if (canonicalDecimal(args.expectedHistoricalTotal) !== canonicalDecimal(report.totals.total_historical_misrouted_income)) {
    throw new Error(`Historical total changed: expected ${args.expectedHistoricalTotal}, found ${report.totals.total_historical_misrouted_income}.`);
  }
  if (canonicalDecimal(args.expectedMovableTotal) !== canonicalDecimal(report.totals.total_movable_amount)) {
    throw new Error(`Movable total changed: expected ${args.expectedMovableTotal}, found ${report.totals.total_movable_amount}.`);
  }
  if (canonicalDecimal(args.expectedUsedTotal) !== canonicalDecimal(report.totals.total_already_used_amount)) {
    throw new Error(`Used total changed: expected ${args.expectedUsedTotal}, found ${report.totals.total_already_used_amount}.`);
  }
}

async function verifyConservation(client: PoolClient, userIds: string[], before: Map<string, string>) {
  if (userIds.length === 0) return;
  const rows = await client.query<{ user_id: string; combined_balance: string }>(
    `select user_id::text,
            coalesce(sum(case when direction = 'credit' then amount_usd else -amount_usd end),0)::text as combined_balance
     from hb_internal_ledger
     where user_id = any($1::uuid[]) and wallet_type in ('deposit','income')
     group by user_id`,
    [userIds]
  );
  for (const row of rows.rows) {
    if (canonicalDecimal(row.combined_balance) !== canonicalDecimal(before.get(row.user_id) || "0")) {
      throw new Error(`Combined wallet balance changed for user ${row.user_id}.`);
    }
  }
}

async function verifyProjectedBalances(client: PoolClient, projected: UserReport[]) {
  if (projected.length === 0) return;
  const expected = new Map(projected.map((row) => [row.user_id, row]));
  const rows = await client.query<{ user_id: string; main_wallet: string; income_wallet: string }>(
    `select user_id::text,
            coalesce(sum(case when wallet_type='deposit' and direction='credit' then amount_usd
                              when wallet_type='deposit' then -amount_usd else 0 end),0)::text as main_wallet,
            coalesce(sum(case when wallet_type='income' and direction='credit' then amount_usd
                              when wallet_type='income' then -amount_usd else 0 end),0)::text as income_wallet
     from hb_internal_ledger where user_id = any($1::uuid[]) group by user_id`,
    [[...expected.keys()]]
  );
  for (const row of rows.rows) {
    const projection = expected.get(row.user_id);
    if (!projection) throw new Error(`Unexpected corrected user ${row.user_id}.`);
    if (toUsdUnits(row.main_wallet) < 0n) throw new Error(`Correction made Main Wallet negative for user ${row.user_id}.`);
    if (canonicalDecimal(row.main_wallet) !== canonicalDecimal(projection.projected_main_wallet)) {
      throw new Error(`Projected Main Wallet mismatch for user ${row.user_id}.`);
    }
    if (canonicalDecimal(row.income_wallet) !== canonicalDecimal(projection.projected_income_wallet)) {
      throw new Error(`Projected Income Wallet mismatch for user ${row.user_id}.`);
    }
    expected.delete(row.user_id);
  }
  if (expected.size > 0) throw new Error(`Missing post-correction balances for ${expected.size} user(s).`);
}

async function requireConfirmation(rows: number, historicalTotal: string, movableTotal: string, usedTotal: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("--execute requires an interactive terminal.");
  const expected = `RECLASSIFY ${rows} ROWS MOVE ${canonicalDecimal(movableTotal)} USD USE ${canonicalDecimal(usedTotal)} USD OF ${canonicalDecimal(historicalTotal)} USD`;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`Type exactly "${expected}" to execute: `);
    if (answer.trim() !== expected) throw new Error("Confirmation did not match; transaction was not started.");
  } finally {
    prompt.close();
  }
}

async function dryRun(client: PoolClient) {
  await client.query("begin isolation level repeatable read read only");
  try {
    const report = await readReport(client);
    printReport(report);
    await client.query("rollback");
    console.log("DRY RUN ONLY: read-only transaction rolled back; no data was modified.");
    return report;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function execute(client: PoolClient, args: Arguments) {
  await client.query("begin isolation level serializable");
  try {
    await client.query("select pg_advisory_xact_lock(hashtext('hb:historical-wallet-routing:v1'))");
    const report = await readReport(client);
    printReport(report);
    validateExpected(report, args);
    const targets = await client.query<Sample>(
      `${targetCte} select id::text, user_id::text, wallet_type, direction, amount_usd::text,
       reference_type, reference_id::text, idempotency_key, created_at::text
       from candidates order by user_id, created_at, id for update`,
      [[...ALLOWED_INCOME_TYPES]]
    );
    const userIds = [...new Set(targets.rows.map((row) => row.user_id))];
    const beforeRows = await client.query<{ user_id: string; combined_balance: string }>(
      `select user_id::text, coalesce(sum(case when direction='credit' then amount_usd else -amount_usd end),0)::text as combined_balance
       from hb_internal_ledger where user_id = any($1::uuid[]) and wallet_type in ('deposit','income') group by user_id`,
      [userIds]
    );
    const before = new Map(beforeRows.rows.map((row) => [row.user_id, row.combined_balance]));
    const movableByUser = new Map(report.users.map((row) => [row.user_id, toUsdUnits(row.movable_amount)]));
    for (const row of targets.rows) {
      const sourceAmount = toUsdUnits(row.amount_usd);
      const remainingMovable = movableByUser.get(row.user_id) || 0n;
      const movableAmount = sourceAmount < remainingMovable ? sourceAmount : remainingMovable;
      const usedAmount = sourceAmount - movableAmount;
      movableByUser.set(row.user_id, remainingMovable - movableAmount);
      const metadata = JSON.stringify({
        source: CORRECTION_TYPE,
        originalLedgerId: row.id,
        originalReferenceType: row.reference_type,
        originalAmountUsd: fromUsdUnits(sourceAmount),
        movableAmountUsd: fromUsdUnits(movableAmount),
        usedAmountUsd: fromUsdUnits(usedAmount)
      });
      if (movableAmount > 0n) {
        const amount = fromUsdUnits(movableAmount);
        const debit = await client.query<{ id: string }>(
          `insert into hb_internal_ledger
            (user_id,wallet_type,direction,amount_usd,reference_type,reference_id,idempotency_key,metadata,created_at)
           values ($1,'deposit','debit',$2,$3,$4,$5,$6::jsonb,now()) on conflict (idempotency_key) do nothing returning id`,
          [row.user_id, amount, CORRECTION_TYPE, row.id, `hb:historical-wallet-routing:${row.id}:main_debit`, metadata]
        );
        const credit = await client.query<{ id: string }>(
          `insert into hb_internal_ledger
            (user_id,wallet_type,direction,amount_usd,reference_type,reference_id,idempotency_key,metadata,created_at)
           values ($1,'income','credit',$2,$3,$4,$5,$6::jsonb,now()) on conflict (idempotency_key) do nothing returning id`,
          [row.user_id, amount, CORRECTION_TYPE, row.id, `hb:historical-wallet-routing:${row.id}:income_credit`, metadata]
        );
        if (!debit.rows[0]?.id || !credit.rows[0]?.id) throw new Error(`Correction pair was not created atomically for ${row.id}.`);
        await createLedgerProof(client, "hb_internal_ledger", debit.rows[0].id);
        await createLedgerProof(client, "hb_internal_ledger", credit.rows[0].id);
      }
      if (usedAmount > 0n) {
        const consumed = await client.query<{ id: string }>(
          `insert into hb_audit_logs (user_id,action,entity_type,entity_id,metadata)
           select $1,'historical_wallet_reclassification_consumed','hb_internal_ledger',$2,$3::jsonb
           where not exists (
             select 1 from hb_audit_logs
             where action = 'historical_wallet_reclassification_consumed'
               and entity_type = 'hb_internal_ledger' and entity_id = $2
           ) returning id`,
          [row.user_id, row.id, metadata]
        );
        if (!consumed.rows[0]?.id) throw new Error(`Consumed-income audit marker was not created for ${row.id}.`);
      }
    }
    for (const [userId, remaining] of movableByUser) {
      if (remaining !== 0n) throw new Error(`Movable allocation did not balance for user ${userId}.`);
    }
    await verifyConservation(client, userIds, before);
    await verifyProjectedBalances(client, report.users);
    const remaining = await readReport(client);
    if (remaining.totals.row_count !== 0) throw new Error(`${remaining.totals.row_count} target row(s) remain uncorrected.`);
    await client.query("commit");
    console.log(
      `EXECUTED: ${targets.rowCount} historical row(s); ${report.totals.total_movable_amount} USD moved and ` +
      `${report.totals.total_already_used_amount} USD recorded as already used.`
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (!pool) throw new Error("DATABASE_URL is required. No database operation was attempted.");
  const client = await pool.connect();
  try {
    const report = await dryRun(client);
    if (args.execute) {
      validateExpected(report, args);
      await requireConfirmation(
        report.totals.row_count,
        report.totals.total_historical_misrouted_income,
        report.totals.total_movable_amount,
        report.totals.total_already_used_amount
      );
      await execute(client, args);
    }
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => pool?.end());
