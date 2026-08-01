import { createInterface } from "node:readline/promises";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { createLedgerProof } from "../services/halalBusiness/hbLedgerProofService.js";
import {
  buildHistoricalWalletChronologyReport,
  type HistoricalWalletUserSummary
} from "./reportHistoricalWalletChronology.js";

const CORRECTION_TYPE = "historical_wallet_reclassification";
const SCALE = 100000000n;
const APPROVED_SNAPSHOT = {
  safeUsers: 10,
  partialUsers: 13,
  unresolvedUsers: 9,
  totalProven: "1651.88",
  totalMovable: "417.7968185",
  totalConsumed: "1123.9231815",
  totalUnresolvedHold: "110.16"
} as const;

type Arguments = {
  execute: boolean;
  expectedSafe?: number;
  expectedPartial?: number;
  expectedUnresolved?: number;
  expectedMovable?: string;
  expectedConsumed?: string;
  expectedUnresolvedHold?: string;
};
type ChronologyReport = Awaited<ReturnType<typeof buildHistoricalWalletChronologyReport>>;

function units(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) throw new Error(`Invalid USD value: ${text}`);
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  if (fraction.length > 8) throw new Error(`USD value exceeds 8 decimal places: ${text}`);
  const result = BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, "0"));
  return negative ? -result : result;
}

function usd(value: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE).toString().padStart(8, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function argument(argv: string[], name: string) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function exactCount(value: string | undefined, name: string) {
  if (!value || !/^\d+$/.test(value)) throw new Error(`${name} requires a non-negative integer.`);
  return Number(value);
}

function exactUsd(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} requires an exact dry-run USD total.`);
  return usd(units(value));
}

function parseArguments(argv: string[]): Arguments {
  const execute = argv.includes("--execute");
  if (!execute) {
    if (argv.length > 0) throw new Error("Dry run accepts no arguments. Use --execute only with every required expectation.");
    return { execute: false };
  }
  const allowed = new Set([
    "--execute", "--expect-safe", "--expect-partial", "--expect-unresolved",
    "--expect-movable", "--expect-consumed", "--expect-unresolved-hold"
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!allowed.has(item)) throw new Error(`Unknown execution argument: ${item}`);
    if (item !== "--execute") index += 1;
  }
  return {
    execute,
    expectedSafe: exactCount(argument(argv, "--expect-safe"), "--expect-safe"),
    expectedPartial: exactCount(argument(argv, "--expect-partial"), "--expect-partial"),
    expectedUnresolved: exactCount(argument(argv, "--expect-unresolved"), "--expect-unresolved"),
    expectedMovable: exactUsd(argument(argv, "--expect-movable"), "--expect-movable"),
    expectedConsumed: exactUsd(argument(argv, "--expect-consumed"), "--expect-consumed"),
    expectedUnresolvedHold: exactUsd(argument(argv, "--expect-unresolved-hold"), "--expect-unresolved-hold")
  };
}

function eligibleUsers(report: ChronologyReport) {
  return report.users.filter((user) => user.status === "SAFE" || user.status === "PARTIAL");
}

function assertConservation(report: ChronologyReport) {
  if (!report.summary.conservation_ok || units(report.summary.combined_before) !== units(report.summary.combined_after)) {
    throw new Error("Chronology report failed its global conservation check.");
  }
  for (const user of report.users) {
    if (units(user.combined_before) !== units(user.combined_after)) {
      throw new Error(`Chronology report failed conservation for user ${user.user_id}.`);
    }
    if (user.status !== "UNRESOLVED" && units(user.projected_main_after) < 0n) {
      throw new Error(`Chronology projection makes Main Wallet negative for user ${user.user_id}.`);
    }
    const allocated = user.source_allocations.reduce((sum, row) => sum + units(row.correction_amount), 0n);
    if (allocated !== units(user.remaining_reclassifiable)) {
      throw new Error(`Source allocations do not equal remaining reclassifiable for user ${user.user_id}.`);
    }
    if (user.status === "UNRESOLVED" && (allocated !== 0n || units(user.remaining_reclassifiable) !== 0n)) {
      throw new Error(`Unresolved user ${user.user_id} has a non-zero correction allocation.`);
    }
  }
}

function assertApprovedSnapshot(report: ChronologyReport) {
  assertConservation(report);
  const summary = report.summary;
  const drift = [
    ["safe users", summary.safe_users, APPROVED_SNAPSHOT.safeUsers],
    ["partial users", summary.partial_users, APPROVED_SNAPSHOT.partialUsers],
    ["unresolved users", summary.unresolved_users, APPROVED_SNAPSHOT.unresolvedUsers],
    ["total proven", usd(units(summary.total_proven_misrouted)), APPROVED_SNAPSHOT.totalProven],
    ["total movable", usd(units(summary.total_safely_reclassifiable)), APPROVED_SNAPSHOT.totalMovable],
    ["total consumed", usd(units(summary.total_consumed_misrouted)), APPROVED_SNAPSHOT.totalConsumed],
    ["unresolved hold", usd(units(summary.total_unresolved_safety_hold)), APPROVED_SNAPSHOT.totalUnresolvedHold]
  ].filter(([, actual, expected]) => actual !== expected);
  if (drift.length > 0) {
    throw new Error(`PRODUCTION SNAPSHOT DRIFT — correction blocked:\n${drift.map(([name, actual, expected]) => `- ${name}: expected ${expected}, found ${actual}`).join("\n")}`);
  }
}

function validateExpected(report: ChronologyReport, args: Arguments) {
  assertApprovedSnapshot(report);
  const summary = report.summary;
  const checks: Array<[string, unknown, unknown]> = [
    ["safe users", summary.safe_users, args.expectedSafe],
    ["partial users", summary.partial_users, args.expectedPartial],
    ["unresolved users", summary.unresolved_users, args.expectedUnresolved],
    ["movable total", usd(units(summary.total_safely_reclassifiable)), args.expectedMovable],
    ["consumed total", usd(units(summary.total_consumed_misrouted)), args.expectedConsumed],
    ["unresolved hold", usd(units(summary.total_unresolved_safety_hold)), args.expectedUnresolvedHold]
  ];
  const mismatches = checks.filter(([, actual, expected]) => actual !== expected);
  if (mismatches.length > 0) {
    throw new Error(`Execution expectations do not match the dry run:\n${mismatches.map(([name, actual, expected]) => `- ${name}: expected ${expected}, found ${actual}`).join("\n")}`);
  }
}

function printReport(report: ChronologyReport) {
  const eligible = eligibleUsers(report);
  console.log("CHRONOLOGY_ELIGIBLE_USERS");
  console.table(eligible.map((user) => ({
    user_id: user.user_id,
    status: user.status,
    proven_misrouted: user.total_proven_misrouted,
    consumed_misrouted: user.consumed_misrouted,
    remaining_reclassifiable: user.remaining_reclassifiable,
    current_main: user.current_main_wallet,
    current_income: user.current_income_wallet,
    projected_main_after: user.projected_main_after,
    projected_income_after: user.projected_income_after,
    combined_before: user.combined_before,
    combined_after: user.combined_after
  })));
  console.log("EXACT_SOURCE_ROW_ALLOCATIONS");
  console.table(eligible.flatMap((user) => user.source_allocations.map((allocation) => ({
    user_id: user.user_id, status: user.status, ...allocation
  }))));
  console.log("UNRESOLVED_USERS_EXCLUDED");
  console.table(report.users.filter((user) => user.status === "UNRESOLVED").map((user) => ({
    user_id: user.user_id,
    unresolved_reason: user.unresolved_reason,
    held_amount: user.calculated_remaining_before_safety_hold,
    correction_amount: "0"
  })));
  console.log("CHRONOLOGY_GLOBAL_SUMMARY");
  console.table([report.summary]);
}

async function dryRun(client: PoolClient) {
  await client.query("begin isolation level repeatable read read only");
  try {
    const report = await buildHistoricalWalletChronologyReport(client);
    printReport(report);
    assertApprovedSnapshot(report);
    await client.query("rollback");
    console.log("DRY RUN ONLY: read-only transaction rolled back; no data was modified.");
    return report;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function requireConfirmation(report: ChronologyReport) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("--execute requires an interactive terminal.");
  const summary = report.summary;
  const expected = `RECLASSIFY CHRONOLOGY SAFE ${summary.safe_users} PARTIAL ${summary.partial_users} UNRESOLVED ${summary.unresolved_users} MOVE ${usd(units(summary.total_safely_reclassifiable))} CONSUMED ${usd(units(summary.total_consumed_misrouted))} HOLD ${usd(units(summary.total_unresolved_safety_hold))}`;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`Type exactly "${expected}" to execute: `);
    if (answer.trim() !== expected) throw new Error("Confirmation did not match; transaction was not started.");
  } finally {
    prompt.close();
  }
}

async function balanceRows(client: PoolClient, userIds: string[]) {
  const result = await client.query<{ user_id: string; main: string; income: string; combined: string }>(
    `select users.user_id::text,
            coalesce(sum(case when l.wallet_type='deposit' and l.direction='credit' then l.amount_usd when l.wallet_type='deposit' then -l.amount_usd else 0 end),0)::text as main,
            coalesce(sum(case when l.wallet_type='income' and l.direction='credit' then l.amount_usd when l.wallet_type='income' then -l.amount_usd else 0 end),0)::text as income,
            coalesce(sum(case when l.direction='credit' then l.amount_usd else -l.amount_usd end),0)::text as combined
     from unnest($1::uuid[]) users(user_id)
     left join hb_internal_ledger l on l.user_id=users.user_id and l.wallet_type in ('deposit','income')
     group by users.user_id`,
    [userIds]
  );
  return new Map(result.rows.map((row) => [row.user_id, row]));
}

async function execute(client: PoolClient, args: Arguments) {
  await client.query("begin isolation level serializable");
  try {
    await client.query("select pg_advisory_xact_lock(hashtext('hb:historical-wallet-routing:chronology:v2'))");
    let report = await buildHistoricalWalletChronologyReport(client);
    const initialUserIds = report.users.map((user) => user.user_id).sort();
    for (const userId of initialUserIds) await client.query("select pg_advisory_xact_lock(hashtext($1))", [userId]);
    report = await buildHistoricalWalletChronologyReport(client);
    printReport(report);
    validateExpected(report, args);
    const eligible = eligibleUsers(report);
    const eligibleIds = eligible.map((user) => user.user_id);
    const before = await balanceRows(client, eligibleIds);

    for (const user of eligible) {
      for (const allocation of user.source_allocations) {
        const source = await client.query<{ amount_usd: string }>(
          `select amount_usd::text from hb_internal_ledger
           where id=$1 and user_id=$2 and wallet_type='deposit' and direction='credit' for update`,
          [allocation.source_ledger_id, user.user_id]
        );
        if (!source.rows[0] || units(allocation.correction_amount) > units(source.rows[0].amount_usd)) {
          throw new Error(`Invalid source allocation ${allocation.source_ledger_id} for user ${user.user_id}.`);
        }
        const metadata = JSON.stringify({
          source: CORRECTION_TYPE,
          accountingRule: "chronology_v2",
          chronologyStatus: user.status,
          originalLedgerId: allocation.source_ledger_id,
          originalReferenceType: allocation.source_reference_type,
          originalAmountUsd: allocation.source_original_amount,
          correctionAmountUsd: allocation.correction_amount
        });
        const debit = await client.query<{ id: string }>(
          `insert into hb_internal_ledger
            (user_id,wallet_type,direction,amount_usd,reference_type,reference_id,idempotency_key,metadata)
           values ($1,'deposit','debit',$2,$3,$4,$5,$6::jsonb)
           on conflict (idempotency_key) do nothing returning id`,
          [user.user_id, allocation.correction_amount, CORRECTION_TYPE, allocation.source_ledger_id,
            `hb:historical-wallet-routing:chronology:v2:${allocation.source_ledger_id}:main_debit`, metadata]
        );
        const credit = await client.query<{ id: string }>(
          `insert into hb_internal_ledger
            (user_id,wallet_type,direction,amount_usd,reference_type,reference_id,idempotency_key,metadata)
           values ($1,'income','credit',$2,$3,$4,$5,$6::jsonb)
           on conflict (idempotency_key) do nothing returning id`,
          [user.user_id, allocation.correction_amount, CORRECTION_TYPE, allocation.source_ledger_id,
            `hb:historical-wallet-routing:chronology:v2:${allocation.source_ledger_id}:income_credit`, metadata]
        );
        if (!debit.rows[0]?.id || !credit.rows[0]?.id) {
          throw new Error(`Correction pair already exists or was not created atomically for source ${allocation.source_ledger_id}.`);
        }
        await createLedgerProof(client, "hb_internal_ledger", debit.rows[0].id);
        await createLedgerProof(client, "hb_internal_ledger", credit.rows[0].id);
      }
    }

    const after = await balanceRows(client, eligibleIds);
    for (const user of eligible) {
      const beforeRow = before.get(user.user_id);
      const afterRow = after.get(user.user_id);
      if (!beforeRow || !afterRow) throw new Error(`Missing balance verification for user ${user.user_id}.`);
      if (units(afterRow.main) < 0n) throw new Error(`Main Wallet became negative for user ${user.user_id}.`);
      if (units(afterRow.main) !== units(user.projected_main_after)) throw new Error(`Main projection mismatch for user ${user.user_id}.`);
      if (units(afterRow.income) !== units(user.projected_income_after)) throw new Error(`Income projection mismatch for user ${user.user_id}.`);
      if (units(beforeRow.combined) !== units(afterRow.combined)) throw new Error(`Combined wallet changed for user ${user.user_id}.`);
    }
    const globalBefore = [...before.values()].reduce((sum, row) => sum + units(row.combined), 0n);
    const globalAfter = [...after.values()].reduce((sum, row) => sum + units(row.combined), 0n);
    if (globalBefore !== globalAfter) throw new Error("Global combined wallet total changed.");
    await client.query("commit");
    console.log(`EXECUTED: chronology safely reclassified ${report.summary.total_safely_reclassifiable} USD.`);
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
      await requireConfirmation(report);
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
