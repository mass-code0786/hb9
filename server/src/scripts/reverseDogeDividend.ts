import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { createLedgerProof } from "../services/halalBusiness/hbLedgerProofService.js";

const COIN = "DOGE";
const DEDUCTION = "1324";
const ORIGINAL_DISTRIBUTION = "1327.31132499";
const REQUIRED_PACKAGE = "500";
const REQUIRED_USER_COUNT = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Arguments = {
  sourceActionId: string;
  execute: boolean;
  expectedCount?: number;
  expectedUserIdsFile?: string;
};

type Target = {
  user_id: string;
  wallet_address: string | null;
  entry_count: string;
  original_coin_amount: string;
  current_balance: string;
  package_amount: string | null;
  package_purchase_id: string | null;
  reversal_ledger_id: string | null;
};

function usage(): never {
  throw new Error(
    "Usage: npm run hb:reverse-doge-dividend -- --source-action-id <uuid> " +
    "[--execute --expected-count <n> --expected-user-ids-file <path>]"
  );
}

function parseArguments(argv: string[]): Arguments {
  const value = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const sourceActionId = value("--source-action-id");
  const execute = argv.includes("--execute");
  const expectedCountText = value("--expected-count");
  const expectedUserIdsFile = value("--expected-user-ids-file");
  if (!sourceActionId || !UUID.test(sourceActionId)) usage();
  const expectedCount = expectedCountText === undefined ? undefined : Number(expectedCountText);
  if (expectedCount !== undefined && (!Number.isSafeInteger(expectedCount) || expectedCount < 1)) usage();
  if (expectedCount !== undefined && expectedCount !== REQUIRED_USER_COUNT) {
    throw new Error(`--expected-count must be exactly ${REQUIRED_USER_COUNT}.`);
  }
  if (execute && (expectedCount !== REQUIRED_USER_COUNT || !expectedUserIdsFile)) usage();
  return { sourceActionId, execute, expectedCount, expectedUserIdsFile };
}

function reversalKey(sourceActionId: string, userId: string) {
  return `doge-dividend-reversal:${sourceActionId}:${userId}:1324`;
}

async function loadExpectedUsers(file: string | undefined) {
  if (!file) return undefined;
  const text = await readFile(resolve(process.cwd(), file), "utf8");
  const ids = text.split(/[\s,]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!ids.length || ids.some((id) => !UUID.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error("Expected-user file must contain unique UUIDs separated by whitespace or commas.");
  }
  return new Set(ids);
}

async function readTargets(client: PoolClient, sourceActionId: string): Promise<Target[]> {
  const result = await client.query<Target>(
    `select d.user_id::text,
            u.wallet_address,
            count(*)::text as entry_count,
            sum(d.coin_amount)::text as original_coin_amount,
            coalesce(b.balance, 0)::text as current_balance,
            latest_package.amount_usd::text as package_amount,
            latest_package.id::text as package_purchase_id,
            r.id::text as reversal_ledger_id
       from hb_dividend_income_ledger d
       join hb_users u on u.id = d.user_id
       join hb_admin_balance_actions a
         on a.id = d.source_action_id
        and a.idempotency_key =
            'hb:funds:bulk:' || $1::text || ':' || d.user_id::text
        and a.type = 'bulk_distribution'
        and a.coin_symbol = 'DOGE'
        and a.amount = $2::numeric
        and lower(btrim(a.note)) = 'dividend'
       join hb_coin_balance_ledger source_coin
         on source_coin.id = a.ledger_entry_id
        and source_coin.user_id = d.user_id
        and source_coin.coin_symbol = 'DOGE'
        and source_coin.direction = 'credit'
        and source_coin.amount = $2::numeric
        and source_coin.metadata->>'batchKey' = 'hb:funds:bulk:' || $1::text
        and source_coin.metadata->>'targetMode' = 'package'
        and source_coin.metadata->>'packageAmount' = '500'
       left join lateral (
         select p.id, p.amount_usd
           from hb_package_purchases p
          where p.user_id = d.user_id
            and p.status = 'completed'
          order by p.created_at desc, p.id desc
          limit 1
       ) latest_package on true
       left join hb_coin_balances b
         on b.user_id = d.user_id and b.coin_symbol = 'DOGE'
       left join hb_coin_balance_ledger r
         on r.idempotency_key =
            'doge-dividend-reversal:' || $1::text || ':' || d.user_id::text || ':1324'
      where d.coin_symbol = 'DOGE'
        and d.status = 'credited'
      group by d.user_id, u.wallet_address, b.balance,
               latest_package.amount_usd, latest_package.id, r.id
      order by d.user_id`,
    [sourceActionId, ORIGINAL_DISTRIBUTION]
  );
  return result.rows;
}

function validateTargets(
  targets: Target[],
  expectedCount: number | undefined,
  expectedUsers: Set<string> | undefined
) {
  if (!targets.length) {
    throw new Error("No matching credited $500 Business Package DOGE rows found for this distribution identifier.");
  }
  if (targets.length !== REQUIRED_USER_COUNT) {
    throw new Error(
      `Distribution must resolve to exactly ${REQUIRED_USER_COUNT} users; found ${targets.length}. No changes made.`
    );
  }
  const malformed = targets.filter(
    (row) =>
      row.entry_count !== "1" ||
      Number(row.original_coin_amount) !== Number(ORIGINAL_DISTRIBUTION) ||
      Number(row.package_amount) !== Number(REQUIRED_PACKAGE)
  );
  if (malformed.length) {
    throw new Error(
      `Source validation failed: every user must have one ${ORIGINAL_DISTRIBUTION} DOGE source row ` +
      `and latest completed package amount ${REQUIRED_PACKAGE}. Users: ` +
      malformed.map((row) => row.user_id).join(", ")
    );
  }
  if (expectedCount !== undefined && targets.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} users but source contains ${targets.length}; no changes made.`);
  }
  if (expectedUsers) {
    const actual = new Set(targets.map((row) => row.user_id.toLowerCase()));
    const unexpected = [...actual].filter((id) => !expectedUsers.has(id));
    const missing = [...expectedUsers].filter((id) => !actual.has(id));
    if (unexpected.length || missing.length) {
      throw new Error(
        `Expected-user allowlist mismatch; no changes made. ` +
        `Unexpected: ${unexpected.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`
      );
    }
  }
}

function printReport(sourceActionId: string, targets: Target[]) {
  const insufficient = targets.filter(
    (row) => !row.reversal_ledger_id && Number(row.current_balance) < Number(DEDUCTION)
  );
  console.table(targets.map((row) => ({
    user_id: row.user_id,
    wallet_address: row.wallet_address || "(not set)",
    package_amount_USD: row.package_amount,
    current_DOGE_balance: row.current_balance,
    original_credited_DOGE: row.original_coin_amount,
    deduction_DOGE: DEDUCTION,
    already_reversed: Boolean(row.reversal_ledger_id)
  })));
  console.log({
    source_action_id: sourceActionId,
    distribution_identifier: `hb:funds:bulk:${sourceActionId}`,
    affected_user_count: targets.length,
    deduction_per_user_DOGE: DEDUCTION,
    total_deduction_DOGE: String(BigInt(targets.length) * BigInt(DEDUCTION)),
    insufficient_balance_user_ids: insufficient.map((row) => row.user_id)
  });
  return insufficient;
}

async function requireManualConfirmation(sourceActionId: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("--execute requires an interactive terminal for manual confirmation.");
  }
  const confirmation = `EXECUTE ${sourceActionId} 3 USERS 3972 DOGE`;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(
      `Type exactly "${confirmation}" to authorize the transaction: `
    );
    if (answer.trim() !== confirmation) {
      throw new Error("Manual confirmation did not match; no changes made.");
    }
  } finally {
    prompt.close();
  }
}

async function dryRun(client: PoolClient, args: Arguments, expectedUsers: Set<string> | undefined) {
  await client.query("begin isolation level repeatable read read only");
  try {
    const targets = await readTargets(client, args.sourceActionId);
    validateTargets(targets, args.expectedCount, expectedUsers);
    printReport(args.sourceActionId, targets);
    await client.query("rollback");
    console.log("DRY RUN ONLY: transaction rolled back; database was not modified.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function execute(client: PoolClient, args: Arguments, expectedUsers: Set<string>) {
  await client.query("begin isolation level serializable");
  try {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `doge-dividend-reversal:${args.sourceActionId}`
    ]);
    let targets = await readTargets(client, args.sourceActionId);
    validateTargets(targets, args.expectedCount, expectedUsers);

    for (const target of targets) {
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [
        `coin:${target.user_id}:${COIN}`
      ]);
    }
    await client.query(
      `select b.user_id
         from hb_coin_balances b
        where b.coin_symbol = 'DOGE'
          and b.user_id = any($1::uuid[])
        order by b.user_id
        for update`,
      [targets.map((row) => row.user_id)]
    );

    targets = await readTargets(client, args.sourceActionId);
    validateTargets(targets, args.expectedCount, expectedUsers);
    const insufficient = printReport(args.sourceActionId, targets);
    if (insufficient.length) {
      throw new Error(
        `Insufficient DOGE balance for ${insufficient.length} user(s); entire transaction rolled back.`
      );
    }

    let created = 0;
    for (const target of targets) {
      if (target.reversal_ledger_id) continue;
      const key = reversalKey(args.sourceActionId, target.user_id);
      const ledger = await client.query<{ id: string }>(
        `insert into hb_coin_balance_ledger
          (user_id, coin_symbol, amount, type, direction, reference_id, note,
           idempotency_key, metadata)
         values ($1, 'DOGE', $2::numeric, 'debit', 'debit', $3,
                 'Dividend reversal', $4, $5::jsonb)
         on conflict (idempotency_key) do nothing
         returning id`,
        [
          target.user_id,
          DEDUCTION,
          `dividend_reversal:${args.sourceActionId}`,
          key,
          JSON.stringify({
            source: "one_time_doge_dividend_reversal",
            reason: "Dividend reversal",
            original_source_action_id: args.sourceActionId,
            original_distribution_identifier: `hb:funds:bulk:${args.sourceActionId}`,
            original_doge_credited: ORIGINAL_DISTRIBUTION,
            package_amount_usd: REQUIRED_PACKAGE,
            deduction_doge: DEDUCTION
          })
        ]
      );
      const ledgerId = ledger.rows[0]?.id;
      if (!ledgerId) continue;
      const balance = await client.query(
        `update hb_coin_balances
            set balance = balance - $3::numeric, updated_at = now()
          where user_id = $1 and coin_symbol = $2 and balance >= $3::numeric
          returning balance`,
        [target.user_id, COIN, DEDUCTION]
      );
      if (balance.rowCount !== 1) throw new Error(`Balance changed or is insufficient: ${target.user_id}`);
      await createLedgerProof(client, "hb_coin_balance_ledger", ledgerId);
      created += 1;
    }
    await client.query("commit");
    console.log(`EXECUTED: committed ${created} new reversal debit(s); ${targets.length - created} already existed.`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (!pool) throw new Error("DATABASE_URL is required.");
  const expectedUsers = await loadExpectedUsers(args.expectedUserIdsFile);
  const client = await pool.connect();
  try {
    if (args.execute) {
      await client.query("begin isolation level repeatable read read only");
      try {
        const targets = await readTargets(client, args.sourceActionId);
        validateTargets(targets, args.expectedCount, expectedUsers);
        printReport(args.sourceActionId, targets);
      } finally {
        await client.query("rollback");
      }
      await requireManualConfirmation(args.sourceActionId);
      await execute(client, args, expectedUsers!);
    } else {
      await dryRun(client, args, expectedUsers);
    }
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end();
  });
