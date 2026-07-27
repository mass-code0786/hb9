import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { createLedgerProof } from "../services/halalBusiness/hbLedgerProofService.js";

const COIN = "DOGE";
const DEDUCTION = "1324";
const REQUIRED_ROWS = 3;
const REQUIRED_TOTAL = "3972";
const REQUIRED_PACKAGE = "500";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

type ManifestRow = {
  source_action_id: string;
  user_id: string;
  expected_original_coin_amount: string;
};

const CONFIRMED_MANIFEST: ManifestRow[] = [
  {
    source_action_id: "ebb6da48-ffc2-4ca7-9261-d78794a3f459",
    user_id: "6158ae4c-f2fc-4306-8744-b6908fa95533",
    expected_original_coin_amount: "1327.31132499"
  },
  {
    source_action_id: "8c1a45b7-0350-4e7c-b832-b4c163d90b83",
    user_id: "88eb56d7-6263-45c0-aa92-c7d039ee0e92",
    expected_original_coin_amount: "1327.31132499"
  },
  {
    source_action_id: "ca07e8c0-8e66-4716-b0c8-9ba843a1884b",
    user_id: "96818662-0fa5-4164-a298-8c38f72d3df6",
    expected_original_coin_amount: "1427.67036250"
  }
];

type Arguments = {
  manifestFile: string;
  execute: boolean;
};

type Target = ManifestRow & {
  source_row_count: number;
  actual_user_id: string | null;
  actual_coin_symbol: string | null;
  actual_status: string | null;
  actual_note: string | null;
  original_coin_amount: string | null;
  wallet_address: string | null;
  package_usd: string | null;
  current_balance: string;
  reversal_ledger_id: string | null;
};

function usage(): never {
  throw new Error(
    "Usage: npm run hb:reverse-doge-dividend -- --manifest <reviewed.csv|reviewed.json> [--execute]"
  );
}

function parseArguments(argv: string[]): Arguments {
  const manifestIndex = argv.indexOf("--manifest");
  const manifestFile = manifestIndex >= 0 ? argv[manifestIndex + 1] : undefined;
  if (!manifestFile || manifestFile.startsWith("--")) usage();
  return { manifestFile, execute: argv.includes("--execute") };
}

function canonicalDecimal(value: unknown) {
  const text = String(value ?? "").trim();
  if (!POSITIVE_DECIMAL.test(text)) throw new Error(`Invalid positive decimal in manifest: ${text}`);
  const [whole, fraction = ""] = text.split(".");
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction ? `${whole}.${normalizedFraction}` : whole;
}

function normalizeManifestRow(value: Record<string, unknown>): ManifestRow {
  const sourceActionId = String(value.source_action_id || "").trim().toLowerCase();
  const userId = String(value.user_id || "").trim().toLowerCase();
  if (!UUID.test(sourceActionId) || !UUID.test(userId)) {
    throw new Error("Every manifest row requires valid source_action_id and user_id UUIDs.");
  }
  return {
    source_action_id: sourceActionId,
    user_id: userId,
    expected_original_coin_amount: canonicalDecimal(value.expected_original_coin_amount)
  };
}

function manifestKey(row: ManifestRow) {
  return `${row.source_action_id}:${row.user_id}:${canonicalDecimal(row.expected_original_coin_amount)}`;
}

function validateExactConfirmedManifest(rows: ManifestRow[]) {
  if (rows.length !== REQUIRED_ROWS) throw new Error(`Manifest must contain exactly ${REQUIRED_ROWS} rows.`);
  if (new Set(rows.map((row) => row.user_id)).size !== REQUIRED_ROWS) {
    throw new Error("Manifest must contain exactly 3 distinct users.");
  }
  if (new Set(rows.map((row) => row.source_action_id)).size !== REQUIRED_ROWS) {
    throw new Error("Manifest must contain exactly 3 distinct source_action_id values.");
  }
  const actual = [...rows.map(manifestKey)].sort();
  const confirmed = [...CONFIRMED_MANIFEST.map(manifestKey)].sort();
  if (actual.some((key, index) => key !== confirmed[index])) {
    throw new Error("Manifest does not exactly equal the reviewed three production rows.");
  }
}

async function loadManifest(file: string): Promise<ManifestRow[]> {
  const text = await readFile(resolve(process.cwd(), file), "utf8");
  let rawRows: Array<Record<string, unknown>>;
  if (text.trimStart().startsWith("[") || text.trimStart().startsWith("{")) {
    const parsed = JSON.parse(text) as unknown;
    const candidate = Array.isArray(parsed)
      ? parsed
      : (parsed as { rows?: unknown })?.rows;
    if (!Array.isArray(candidate)) throw new Error("JSON manifest must be an array or an object with a rows array.");
    rawRows = candidate as Array<Record<string, unknown>>;
  } else {
    rawRows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const fields = line.split(",").map((field) => field.trim());
        if (fields.length !== 3) throw new Error(`Manifest line must have exactly 3 comma-separated fields: ${line}`);
        return {
          source_action_id: fields[0],
          user_id: fields[1],
          expected_original_coin_amount: fields[2]
        };
      });
  }
  const rows = rawRows.map(normalizeManifestRow);
  validateExactConfirmedManifest(rows);
  return rows.sort((left, right) => left.user_id.localeCompare(right.user_id));
}

function reversalKey(row: ManifestRow) {
  return `doge-dividend-reversal:${row.source_action_id}:${row.user_id}:1324`;
}

async function readTargets(client: PoolClient, manifest: ManifestRow[]): Promise<Target[]> {
  const result = await client.query<Target>(
    `with manifest as (
       select source_action_id::uuid,
              user_id::uuid,
              expected_original_coin_amount::numeric
         from jsonb_to_recordset($1::jsonb) as x(
           source_action_id text,
           user_id text,
           expected_original_coin_amount text
         )
     )
     select m.source_action_id::text,
            m.user_id::text,
            m.expected_original_coin_amount::text,
            (select count(*)::int
               from hb_dividend_income_ledger all_source
              where all_source.source_action_id = m.source_action_id) as source_row_count,
            source_row.user_id::text as actual_user_id,
            source_row.coin_symbol as actual_coin_symbol,
            source_row.status as actual_status,
            source_row.note as actual_note,
            source_row.coin_amount::text as original_coin_amount,
            source_row.package_total_usd::text as package_usd,
            coalesce(nullif(u.wallet_address, ''), nullif(u.hb9_wallet_address, ''),
                     nullif(u.usdt_bep20_address, '')) as wallet_address,
            coalesce(b.balance, 0)::text as current_balance,
            r.id::text as reversal_ledger_id
       from manifest m
       left join hb_users u on u.id = m.user_id
       left join lateral (
         select d.user_id, d.coin_symbol, d.status, d.note,
                d.coin_amount, d.package_total_usd
           from hb_dividend_income_ledger d
          where d.source_action_id = m.source_action_id
          limit 1
       ) source_row on true
       left join hb_coin_balances b
         on b.user_id = m.user_id and b.coin_symbol = 'DOGE'
       left join hb_coin_balance_ledger r
         on r.idempotency_key =
            'doge-dividend-reversal:' || m.source_action_id::text || ':' ||
            m.user_id::text || ':1324'
      order by m.user_id`,
    [JSON.stringify(manifest)]
  );
  return result.rows;
}

function validateTargets(targets: Target[]) {
  if (targets.length !== REQUIRED_ROWS) throw new Error("Database validation did not return exactly 3 targets.");
  if (new Set(targets.map((row) => row.user_id)).size !== REQUIRED_ROWS) {
    throw new Error("Database targets do not contain exactly 3 distinct users.");
  }
  if (new Set(targets.map((row) => row.source_action_id)).size !== REQUIRED_ROWS) {
    throw new Error("Database targets do not contain exactly 3 distinct source actions.");
  }
  const failures: string[] = [];
  const decimalMatches = (actual: string | null, expected: string) => {
    try {
      return actual !== null && canonicalDecimal(actual) === canonicalDecimal(expected);
    } catch {
      return false;
    }
  };
  for (const row of targets) {
    const prefix = `${row.source_action_id}/${row.user_id}`;
    if (row.source_row_count !== 1) {
      failures.push(`${prefix}: source_row_count expected 1, got ${row.source_row_count}`);
    }
    if (row.actual_user_id !== row.user_id) {
      failures.push(`${prefix}: user_id expected ${row.user_id}, got ${row.actual_user_id ?? "null"}`);
    }
    if (row.actual_coin_symbol !== COIN) {
      failures.push(`${prefix}: coin_symbol expected DOGE, got ${row.actual_coin_symbol ?? "null"}`);
    }
    if (row.actual_status !== "credited") {
      failures.push(`${prefix}: status expected credited, got ${row.actual_status ?? "null"}`);
    }
    if (row.actual_note?.trim() !== "Dividend") {
      failures.push(`${prefix}: note expected Dividend, got ${JSON.stringify(row.actual_note)}`);
    }
    if (!decimalMatches(row.original_coin_amount, row.expected_original_coin_amount)) {
      failures.push(
        `${prefix}: coin_amount expected ${row.expected_original_coin_amount}, got ${row.original_coin_amount ?? "null"}`
      );
    }
    if (!decimalMatches(row.package_usd, REQUIRED_PACKAGE)) {
      failures.push(`${prefix}: package_usd expected 500, got ${row.package_usd ?? "null"}`);
    }
  }
  if (failures.length) {
    throw new Error(`DOGE reversal validation failed:\n- ${failures.join("\n- ")}`);
  }
  const insufficient = targets.filter((row) => Number(row.current_balance) < Number(DEDUCTION));
  if (insufficient.length) {
    throw new Error(
      `Insufficient DOGE balance; entire run blocked for: ${insufficient.map((row) => row.user_id).join(", ")}`
    );
  }
}

function printReport(targets: Target[]) {
  console.table(targets.map((row) => ({
    source_action_id: row.source_action_id,
    user_id: row.user_id,
    wallet_address: row.wallet_address || "(not set)",
    package_USD: row.package_usd,
    original_DOGE_credit: row.original_coin_amount,
    current_DOGE_balance: row.current_balance,
    deduction_DOGE: DEDUCTION,
    already_reversed: Boolean(row.reversal_ledger_id)
  })));
  console.log({
    affected_user_count: REQUIRED_ROWS,
    source_action_count: REQUIRED_ROWS,
    deduction_per_user_DOGE: DEDUCTION,
    total_deduction_DOGE: REQUIRED_TOTAL
  });
}

async function requireManualConfirmation() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("--execute requires an interactive terminal for manual confirmation.");
  }
  const confirmation = "EXECUTE 3 USERS 3 ACTIONS 3972 DOGE";
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`Type exactly "${confirmation}" to authorize the transaction: `);
    if (answer.trim() !== confirmation) throw new Error("Manual confirmation did not match; no changes made.");
  } finally {
    prompt.close();
  }
}

async function dryRun(client: PoolClient, manifest: ManifestRow[]) {
  await client.query("begin isolation level repeatable read read only");
  try {
    const targets = await readTargets(client, manifest);
    validateTargets(targets);
    printReport(targets);
    await client.query("rollback");
    console.log("DRY RUN ONLY: read-only transaction rolled back; database was not modified.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function execute(client: PoolClient, manifest: ManifestRow[]) {
  await client.query("begin isolation level serializable");
  try {
    for (const row of manifest) {
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [
        `doge-dividend-reversal:${row.source_action_id}`
      ]);
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [
        `coin:${row.user_id}:${COIN}`
      ]);
    }
    await client.query(
      `select user_id
         from hb_coin_balances
        where coin_symbol = 'DOGE' and user_id = any($1::uuid[])
        order by user_id
        for update`,
      [manifest.map((row) => row.user_id)]
    );

    const targets = await readTargets(client, manifest);
    validateTargets(targets);
    printReport(targets);

    let created = 0;
    for (const target of targets) {
      if (target.reversal_ledger_id) continue;
      const key = reversalKey(target);
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
          `dividend_reversal:${target.source_action_id}`,
          key,
          JSON.stringify({
            source: "one_time_doge_dividend_reversal",
            reason: "Dividend reversal",
            original_source_action_id: target.source_action_id,
            expected_original_coin_amount: target.expected_original_coin_amount,
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
    console.log(`EXECUTED: committed ${created} new reversal debit(s); ${REQUIRED_ROWS - created} already existed.`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const manifest = await loadManifest(args.manifestFile);
  if (!pool) throw new Error("DATABASE_URL is required.");
  const client = await pool.connect();
  try {
    if (args.execute) {
      await dryRun(client, manifest);
      await requireManualConfirmation();
      await execute(client, manifest);
    } else {
      await dryRun(client, manifest);
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
