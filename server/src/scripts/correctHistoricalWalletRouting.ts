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

type Arguments = { execute: boolean; expectedRows?: number; expectedTotal?: string };
type Summary = { reference_type: string; row_count: number; total_usd: string; affected_users: number };
type Sample = {
  id: string; user_id: string; wallet_type: string; direction: string; amount_usd: string;
  reference_type: string; reference_id: string; idempotency_key: string; created_at: string;
};
type Totals = { row_count: number; affected_users: number; total_usd: string; negative_main_users: number };
type Inventory = { direction: string; reference_type: string; row_count: number; total_usd: string; affected_users: number };

function canonicalDecimal(value: unknown) {
  const text = String(value ?? "").trim();
  if (!DECIMAL.test(text)) throw new Error(`Expected a non-negative decimal, received: ${text}`);
  const [whole, fraction = ""] = text.split(".");
  const normalized = fraction.replace(/0+$/, "");
  return normalized ? `${whole}.${normalized}` : whole;
}

function parseArguments(argv: string[]): Arguments {
  const execute = argv.includes("--execute");
  const rowsIndex = argv.indexOf("--expect-rows");
  const totalIndex = argv.indexOf("--expect-total");
  const rowsText = rowsIndex >= 0 ? argv[rowsIndex + 1] : undefined;
  const totalText = totalIndex >= 0 ? argv[totalIndex + 1] : undefined;
  if (!execute) return { execute: false };
  if (!rowsText || !/^\d+$/.test(rowsText) || !totalText) {
    throw new Error("Execution requires --expect-rows <dry-run count> and --expect-total <dry-run USD total>.");
  }
  return { execute, expectedRows: Number(rowsText), expectedTotal: canonicalDecimal(totalText) };
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
  const totals = await client.query<Totals>(
    `${targetCte}, user_moves as (
       select user_id, sum(amount_usd) as moved from candidates group by user_id
     ), balances as (
       select m.user_id, m.moved,
              coalesce(sum(case when l.wallet_type = 'deposit' and l.direction = 'credit' then l.amount_usd
                                when l.wallet_type = 'deposit' then -l.amount_usd else 0 end),0) as main_before
       from user_moves m left join hb_internal_ledger l on l.user_id = m.user_id
       group by m.user_id, m.moved
     )
     select (select count(*) from candidates)::int as row_count,
            (select count(distinct user_id) from candidates)::int as affected_users,
            coalesce((select sum(amount_usd) from candidates),0)::text as total_usd,
            count(*) filter (where main_before - moved < 0)::int as negative_main_users
     from balances`,
    [[...ALLOWED_INCOME_TYPES]]
  );
  const samples = await client.query<Sample>(
    `${targetCte}
     select id::text, user_id::text, wallet_type, direction, amount_usd::text, reference_type,
            reference_id::text, idempotency_key, created_at::text
     from candidates order by created_at, id limit 25`,
    [[...ALLOWED_INCOME_TYPES]]
  );
  return { inventory: inventory.rows, summary: summary.rows, totals: totals.rows[0] || { row_count: 0, affected_users: 0, total_usd: "0", negative_main_users: 0 }, samples: samples.rows };
}

function printReport(report: Awaited<ReturnType<typeof readReport>>) {
  console.log("HISTORICAL_WALLET_ROUTING_ALLOWLIST", [...ALLOWED_INCOME_TYPES]);
  console.log("ALL_DEPOSIT_WALLET_LEDGER_INVENTORY");
  console.table(report.inventory);
  console.log("PROVEN_TARGETS_BY_REFERENCE_TYPE");
  console.table(report.summary);
  console.log("TOTALS", report.totals);
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
  if (canonicalDecimal(args.expectedTotal) !== canonicalDecimal(report.totals.total_usd)) {
    throw new Error(`Total changed: expected ${args.expectedTotal}, found ${report.totals.total_usd}.`);
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

async function requireConfirmation(rows: number, total: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("--execute requires an interactive terminal.");
  const expected = `RECLASSIFY ${rows} ROWS ${canonicalDecimal(total)} USD`;
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
       reference_type, reference_id::text, idempotency_key, created_at::text from candidates order by id for update`,
      [[...ALLOWED_INCOME_TYPES]]
    );
    const userIds = [...new Set(targets.rows.map((row) => row.user_id))];
    const beforeRows = await client.query<{ user_id: string; combined_balance: string }>(
      `select user_id::text, coalesce(sum(case when direction='credit' then amount_usd else -amount_usd end),0)::text as combined_balance
       from hb_internal_ledger where user_id = any($1::uuid[]) and wallet_type in ('deposit','income') group by user_id`,
      [userIds]
    );
    const before = new Map(beforeRows.rows.map((row) => [row.user_id, row.combined_balance]));
    for (const row of targets.rows) {
      const metadata = JSON.stringify({ source: CORRECTION_TYPE, originalLedgerId: row.id, originalReferenceType: row.reference_type });
      const debit = await client.query<{ id: string }>(
        `insert into hb_internal_ledger
          (user_id,wallet_type,direction,amount_usd,reference_type,reference_id,idempotency_key,metadata,created_at)
         values ($1,'deposit','debit',$2,$3,$4,$5,$6::jsonb,now()) on conflict (idempotency_key) do nothing returning id`,
        [row.user_id, row.amount_usd, CORRECTION_TYPE, row.id, `hb:historical-wallet-routing:${row.id}:main_debit`, metadata]
      );
      const credit = await client.query<{ id: string }>(
        `insert into hb_internal_ledger
          (user_id,wallet_type,direction,amount_usd,reference_type,reference_id,idempotency_key,metadata,created_at)
         values ($1,'income','credit',$2,$3,$4,$5,$6::jsonb,now()) on conflict (idempotency_key) do nothing returning id`,
        [row.user_id, row.amount_usd, CORRECTION_TYPE, row.id, `hb:historical-wallet-routing:${row.id}:income_credit`, metadata]
      );
      if (!debit.rows[0]?.id || !credit.rows[0]?.id) throw new Error(`Correction pair was not created atomically for ${row.id}.`);
      await createLedgerProof(client, "hb_internal_ledger", debit.rows[0].id);
      await createLedgerProof(client, "hb_internal_ledger", credit.rows[0].id);
    }
    await verifyConservation(client, userIds, before);
    const remaining = await readReport(client);
    if (remaining.totals.row_count !== 0) throw new Error(`${remaining.totals.row_count} target row(s) remain uncorrected.`);
    await client.query("commit");
    console.log(`EXECUTED: ${targets.rowCount} historical row(s), ${report.totals.total_usd} USD reclassified with paired audit entries.`);
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
      await requireConfirmation(report.totals.row_count, report.totals.total_usd);
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
