import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";

const INCOME_TYPES = [
  "referral_income",
  "level_income",
  "salary_income",
  "single_leg_income",
  "dividend_income",
  "admin_income"
] as const;
const SCALE = 100000000n;

type Candidate = {
  id: string;
  user_id: string;
  amount_usd: string;
  reference_type: string;
  reference_id: string;
  created_at: string;
  income_proof_id: string | null;
  income_proof_hash: string | null;
  proof_valid: boolean;
};

type Event = {
  id: string;
  user_id: string;
  wallet_type: string;
  direction: "credit" | "debit";
  amount_usd: string;
  reference_type: string;
  reference_id: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  idempotency_key: string;
  internal_proof_id: string | null;
  deposit_id: string | null;
  deposit_user_id: string | null;
  deposit_usd_amount: string | null;
  deposit_status: string | null;
  deposit_verification_status: string | null;
  deposit_ledger_entry_id: string | null;
  purchase_id: string | null;
  purchase_user_id: string | null;
  purchase_amount_usd: string | null;
  purchase_status: string | null;
  purchase_ledger_entry_id: string | null;
  withdrawal_id: string | null;
  withdrawal_user_id: string | null;
  withdrawal_amount_usd: string | null;
  withdrawal_status: string | null;
  withdrawal_reserve_ledger_entry_id: string | null;
  withdrawal_refund_ledger_entry_id: string | null;
  conversion_id: string | null;
  conversion_user_id: string | null;
  conversion_amount_usd: string | null;
  conversion_status: string | null;
  conversion_internal_ledger_entry_id: string | null;
};

type Allocation = { clean: bigint; misrouted: bigint };
type Classified = {
  kind: "misrouted_credit" | "clean_credit" | "package_debit" | "withdrawal_debit" | "reversal_credit" | "unresolved";
  reason: string;
  reversalKey?: string;
};
type ChronologyRow = {
  created_at: string;
  ledger_id: string;
  direction: string;
  amount_usd: string;
  reference_type: string;
  reference_id: string | null;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  internal_proof_id: string | null;
  classification: Classified["kind"];
  classification_reason: string;
  clean_before: string;
  misrouted_before: string;
  clean_after: string;
  misrouted_after: string;
};
type UserSummary = {
  user_id: string;
  total_proven_misrouted: string;
  total_clean_main_credits: string;
  total_legitimate_package_debits: string;
  total_legitimate_withdrawal_debits: string;
  consumed_misrouted: string;
  remaining_reclassifiable: string;
  calculated_remaining_before_safety_hold: string;
  current_main_wallet: string;
  current_income_wallet: string;
  projected_main_after: string;
  projected_income_after: string;
  combined_before: string;
  combined_after: string;
  status: "SAFE" | "PARTIAL" | "UNRESOLVED";
  unresolved_reason: string | null;
};

function units(value: string | null | undefined) {
  const text = String(value || "0");
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

function sameUsd(left: string | null, right: string) {
  return left !== null && units(left) === units(right);
}

function eventKey(event: Event) {
  return `${event.reference_type}:${event.reference_id || "none"}`;
}

function classify(event: Event, candidateIds: Set<string>): Classified {
  if (candidateIds.has(event.id)) {
    return { kind: "misrouted_credit", reason: "credited income row and matching hb_income_ledger proof" };
  }
  if (event.direction === "credit" && event.reference_type === "deposit") {
    const valid = event.deposit_id === event.reference_id
      && event.deposit_user_id === event.user_id
      && event.deposit_status === "verified"
      && event.deposit_verification_status === "verified"
      && sameUsd(event.deposit_usd_amount, event.amount_usd)
      && (!event.deposit_ledger_entry_id || event.deposit_ledger_entry_id === event.id);
    return valid
      ? { kind: "clean_credit", reason: "verified hb_deposits source" }
      : { kind: "unresolved", reason: "deposit credit does not match a verified hb_deposits source" };
  }
  if (event.direction === "credit" && event.reference_type === "coin_conversion") {
    const valid = event.conversion_id === event.reference_id
      && event.conversion_user_id === event.user_id
      && event.conversion_status === "completed"
      && sameUsd(event.conversion_amount_usd, event.amount_usd)
      && event.conversion_internal_ledger_entry_id === event.id;
    return valid
      ? { kind: "clean_credit", reason: "completed hb_coin_conversions source" }
      : { kind: "unresolved", reason: "coin-conversion credit does not match a completed source record" };
  }
  if (event.direction === "debit" && event.reference_type === "package_purchase") {
    const valid = event.purchase_id === event.reference_id
      && event.purchase_user_id === event.user_id
      && event.purchase_status === "completed"
      && sameUsd(event.purchase_amount_usd, event.amount_usd)
      && (!event.purchase_ledger_entry_id || event.purchase_ledger_entry_id === event.id);
    return valid
      ? { kind: "package_debit", reason: "completed hb_package_purchases source" }
      : { kind: "unresolved", reason: "package debit does not match a completed purchase" };
  }
  if (event.direction === "debit" && event.reference_type === "withdrawal") {
    const validStatus = ["pending", "under_review", "approved", "processing", "paid", "rejected", "cancelled", "failed"]
      .includes(event.withdrawal_status || "");
    const valid = event.withdrawal_id === event.reference_id
      && event.withdrawal_user_id === event.user_id
      && validStatus
      && sameUsd(event.withdrawal_amount_usd, event.amount_usd)
      && (!event.withdrawal_reserve_ledger_entry_id || event.withdrawal_reserve_ledger_entry_id === event.id);
    return valid
      ? { kind: "withdrawal_debit", reason: `matched hb_withdrawals source (${event.withdrawal_status})` }
      : { kind: "unresolved", reason: "withdrawal debit does not match a valid hb_withdrawals source" };
  }
  if (event.direction === "credit" && event.reference_type === "withdrawal") {
    const validStatus = ["rejected", "cancelled", "failed"].includes(event.withdrawal_status || "");
    const valid = event.withdrawal_id === event.reference_id
      && event.withdrawal_user_id === event.user_id
      && validStatus
      && event.withdrawal_refund_ledger_entry_id === event.id;
    return valid
      ? { kind: "reversal_credit", reason: `matched withdrawal refund (${event.withdrawal_status})`, reversalKey: eventKey(event) }
      : { kind: "unresolved", reason: "withdrawal credit does not match a valid refund source" };
  }
  if (event.direction === "credit" && event.reference_type === "package_purchase") {
    const valid = event.purchase_id === event.reference_id
      && event.purchase_user_id === event.user_id
      && event.purchase_status === "reversed"
      && sameUsd(event.purchase_amount_usd, event.amount_usd);
    return valid
      ? { kind: "reversal_credit", reason: "matched reversed package purchase", reversalKey: eventKey(event) }
      : { kind: "unresolved", reason: "package credit does not match a reversed purchase" };
  }
  return { kind: "unresolved", reason: `unsupported Main ${event.direction} reference_type=${event.reference_type}` };
}

function consume(amount: bigint, first: "clean" | "misrouted", state: Allocation) {
  const allocation: Allocation = { clean: 0n, misrouted: 0n };
  const second = first === "clean" ? "misrouted" : "clean";
  const fromFirst = amount < state[first] ? amount : state[first];
  state[first] -= fromFirst;
  allocation[first] += fromFirst;
  let remaining = amount - fromFirst;
  const fromSecond = remaining < state[second] ? remaining : state[second];
  state[second] -= fromSecond;
  allocation[second] += fromSecond;
  remaining -= fromSecond;
  return { allocation, shortfall: remaining };
}

function hasMaterialTimestampAmbiguity(group: Array<{ event: Event; classified: Classified }>) {
  if (group.length < 2) return false;
  if (group.every(({ classified }) => classified.kind === "clean_credit" || classified.kind === "misrouted_credit")) return false;
  const kinds = new Set(group.map(({ classified }) => classified.kind));
  return kinds.size > 1 || kinds.has("reversal_credit") || kinds.has("unresolved");
}

async function loadCandidates(client: PoolClient) {
  return client.query<Candidate>(
    `select l.id::text, l.user_id::text, l.amount_usd::text, l.reference_type,
            l.reference_id::text, l.created_at::text,
            proof.id::text as income_proof_id, proof.proof_hash as income_proof_hash,
            (proof.id is not null
             and proof.user_id = income.earner_user_id
             and proof.amount_usd = income.amount_usd
             and proof.status = income.status
             and proof.reference_type = income.income_type
             and proof.proof_hash = income.proof_hash) as proof_valid
     from hb_internal_ledger l
     join hb_income_ledger income
       on income.id = l.reference_id
      and income.earner_user_id = l.user_id
      and income.status = 'credited'
      and income.income_type = l.reference_type
      and income.amount_usd = l.amount_usd
     left join lateral (
       select p.* from hb_ledger_proofs p
       where p.source_table = 'hb_income_ledger' and p.ledger_entry_id = income.id
       order by p.created_at, p.id limit 1
     ) proof on true
     where l.wallet_type = 'deposit' and l.direction = 'credit'
       and l.reference_type = any($1::text[])
     order by l.user_id, l.created_at, l.id`,
    [[...INCOME_TYPES]]
  );
}

async function loadEvents(client: PoolClient, userIds: string[]) {
  return client.query<Event>(
    `select l.id::text, l.user_id::text, l.wallet_type, l.direction, l.amount_usd::text,
            l.reference_type, l.reference_id::text, l.created_at::text, l.metadata,
            l.idempotency_key, internal_proof.id::text as internal_proof_id,
            d.id::text as deposit_id, d.user_id::text as deposit_user_id, d.usd_amount::text as deposit_usd_amount,
            d.status as deposit_status, d.verification_status as deposit_verification_status,
            d.ledger_entry_id::text as deposit_ledger_entry_id,
            p.id::text as purchase_id, p.user_id::text as purchase_user_id, p.amount_usd::text as purchase_amount_usd,
            p.status as purchase_status, p.ledger_entry_id::text as purchase_ledger_entry_id,
            w.id::text as withdrawal_id, w.user_id::text as withdrawal_user_id,
            w.amount_usd::text as withdrawal_amount_usd, w.status as withdrawal_status,
            w.reserve_ledger_entry_id::text as withdrawal_reserve_ledger_entry_id,
            w.refund_ledger_entry_id::text as withdrawal_refund_ledger_entry_id,
            c.id::text as conversion_id, c.user_id::text as conversion_user_id,
            c.usdt_credit_amount::text as conversion_amount_usd, c.status as conversion_status,
            c.internal_ledger_entry_id::text as conversion_internal_ledger_entry_id
     from hb_internal_ledger l
     left join lateral (
       select p.id from hb_ledger_proofs p
       where p.source_table = 'hb_internal_ledger' and p.ledger_entry_id = l.id
       order by p.created_at, p.id limit 1
     ) internal_proof on true
     left join hb_deposits d on l.reference_type = 'deposit' and d.id = l.reference_id
     left join hb_package_purchases p on l.reference_type = 'package_purchase' and p.id = l.reference_id
     left join hb_withdrawals w on l.reference_type = 'withdrawal' and w.id = l.reference_id
     left join hb_coin_conversions c on l.reference_type = 'coin_conversion' and c.id = l.reference_id
     where l.wallet_type = 'deposit' and l.user_id = any($1::uuid[])
     order by l.user_id, l.created_at, l.id`,
    [userIds]
  );
}

async function loadIncomeBalances(client: PoolClient, userIds: string[]) {
  return client.query<{ user_id: string; balance: string }>(
    `select users.user_id::text,
            coalesce(sum(case when l.direction='credit' then l.amount_usd else -l.amount_usd end),0)::text as balance
     from unnest($1::uuid[]) users(user_id)
     left join hb_internal_ledger l on l.user_id=users.user_id and l.wallet_type='income'
     group by users.user_id order by users.user_id`,
    [userIds]
  );
}

async function buildReport(client: PoolClient) {
  const candidates = (await loadCandidates(client)).rows;
  const userIds = [...new Set(candidates.map((row) => row.user_id))].sort();
  if (userIds.length === 0) throw new Error("No proven historical misrouted income rows were found.");
  const [eventResult, incomeResult] = await Promise.all([loadEvents(client, userIds), loadIncomeBalances(client, userIds)]);
  const candidateIds = new Set(candidates.filter((row) => row.proof_valid).map((row) => row.id));
  const candidatesByUser = new Map<string, Candidate[]>();
  const eventsByUser = new Map<string, Event[]>();
  for (const row of candidates.filter((candidate) => candidate.proof_valid)) {
    candidatesByUser.set(row.user_id, [...(candidatesByUser.get(row.user_id) || []), row]);
  }
  for (const row of eventResult.rows) eventsByUser.set(row.user_id, [...(eventsByUser.get(row.user_id) || []), row]);
  const incomeByUser = new Map(incomeResult.rows.map((row) => [row.user_id, units(row.balance)]));
  const users: UserSummary[] = [];
  const chronology: Record<string, ChronologyRow[]> = {};

  for (const userId of userIds) {
    const userCandidates = candidatesByUser.get(userId) || [];
    const events = eventsByUser.get(userId) || [];
    const state: Allocation = { clean: 0n, misrouted: 0n };
    const debitAllocations = new Map<string, Allocation[]>();
    const unresolved = new Set<string>();
    const invalidIncomeProofs = candidates.filter((candidate) => candidate.user_id === userId && !candidate.proof_valid);
    for (const candidate of invalidIncomeProofs) {
      unresolved.add(`ledger ${candidate.id} has no matching valid credited hb_income_ledger proof`);
    }
    let cleanCredits = 0n;
    let packageDebits = 0n;
    let withdrawalDebits = 0n;
    let consumedMisrouted = 0n;
    const rows: ChronologyRow[] = [];
    const classifiedEvents = events.map((event) => ({ event, classified: classify(event, candidateIds) }));
    const timestampGroups = new Map<string, typeof classifiedEvents>();
    for (const item of classifiedEvents) timestampGroups.set(item.event.created_at, [...(timestampGroups.get(item.event.created_at) || []), item]);
    for (const [timestamp, group] of timestampGroups) {
      if (hasMaterialTimestampAmbiguity(group)) unresolved.add(`equal-timestamp ordering ambiguity at ${timestamp}`);
    }

    for (const { event, classified } of classifiedEvents) {
      const amount = units(event.amount_usd);
      const before = { ...state };
      if (classified.kind === "misrouted_credit") state.misrouted += amount;
      else if (classified.kind === "clean_credit") {
        state.clean += amount;
        cleanCredits += amount;
      } else if (classified.kind === "package_debit" || classified.kind === "withdrawal_debit") {
        const result = consume(amount, classified.kind === "package_debit" ? "clean" : "misrouted", state);
        const key = eventKey(event);
        debitAllocations.set(key, [...(debitAllocations.get(key) || []), result.allocation]);
        consumedMisrouted += result.allocation.misrouted;
        if (classified.kind === "package_debit") packageDebits += amount;
        else withdrawalDebits += amount;
        if (result.shortfall > 0n) unresolved.add(`ledger ${event.id} debit exceeds classified bucket balance by ${usd(result.shortfall)}`);
      } else if (classified.kind === "reversal_credit") {
        const allocations = debitAllocations.get(classified.reversalKey || "") || [];
        const original = allocations.shift();
        if (!original || original.clean + original.misrouted !== amount) {
          unresolved.add(`ledger ${event.id} reversal cannot be matched exactly to its original debit allocation`);
        } else {
          state.clean += original.clean;
          state.misrouted += original.misrouted;
          consumedMisrouted -= original.misrouted;
        }
      } else unresolved.add(`ledger ${event.id}: ${classified.reason}`);
      rows.push({
        created_at: event.created_at, ledger_id: event.id, direction: event.direction, amount_usd: event.amount_usd,
        reference_type: event.reference_type, reference_id: event.reference_id, idempotency_key: event.idempotency_key,
        metadata: event.metadata, internal_proof_id: event.internal_proof_id,
        classification: classified.kind, classification_reason: classified.reason,
        clean_before: usd(before.clean), misrouted_before: usd(before.misrouted),
        clean_after: usd(state.clean), misrouted_after: usd(state.misrouted)
      });
    }

    const proven = userCandidates.reduce((sum, row) => sum + units(row.amount_usd), 0n);
    const currentMain = events.reduce((sum, row) => sum + (row.direction === "credit" ? units(row.amount_usd) : -units(row.amount_usd)), 0n);
    const currentIncome = incomeByUser.get(userId) || 0n;
    if (state.clean + state.misrouted !== currentMain) {
      unresolved.add(`bucket/current Main mismatch: buckets=${usd(state.clean + state.misrouted)} ledger=${usd(currentMain)}`);
    }
    if (state.misrouted > proven) unresolved.add("remaining misrouted bucket exceeds proven historical income");
    if (state.misrouted < 0n || currentMain < 0n) unresolved.add("negative bucket or current Main balance");
    const safeRemaining = unresolved.size === 0 ? state.misrouted : 0n;
    const projectedMain = currentMain - safeRemaining;
    const projectedIncome = currentIncome + safeRemaining;
    const combinedBefore = currentMain + currentIncome;
    const combinedAfter = projectedMain + projectedIncome;
    const status: UserSummary["status"] = unresolved.size > 0 ? "UNRESOLVED" : consumedMisrouted > 0n ? "PARTIAL" : "SAFE";
    users.push({
      user_id: userId,
      total_proven_misrouted: usd(proven),
      total_clean_main_credits: usd(cleanCredits),
      total_legitimate_package_debits: usd(packageDebits),
      total_legitimate_withdrawal_debits: usd(withdrawalDebits),
      consumed_misrouted: usd(consumedMisrouted),
      remaining_reclassifiable: usd(safeRemaining),
      calculated_remaining_before_safety_hold: usd(state.misrouted),
      current_main_wallet: usd(currentMain),
      current_income_wallet: usd(currentIncome),
      projected_main_after: usd(projectedMain),
      projected_income_after: usd(projectedIncome),
      combined_before: usd(combinedBefore),
      combined_after: usd(combinedAfter),
      status,
      unresolved_reason: [...unresolved].join("; ") || null
    });
    chronology[userId] = rows;
  }

  const sum = (field: keyof UserSummary) => users.reduce((total, row) => total + units(String(row[field])), 0n);
  const summary = {
    affected_users: users.length,
    total_proven_misrouted: usd(sum("total_proven_misrouted")),
    total_consumed_misrouted: usd(sum("consumed_misrouted")),
    total_safely_reclassifiable: usd(sum("remaining_reclassifiable")),
    total_unresolved_safety_hold: usd(sum("total_proven_misrouted") - sum("consumed_misrouted") - sum("remaining_reclassifiable")),
    safe_users: users.filter((row) => row.status === "SAFE").length,
    partial_users: users.filter((row) => row.status === "PARTIAL").length,
    unresolved_users: users.filter((row) => row.status === "UNRESOLVED").length,
    combined_before: usd(sum("combined_before")),
    combined_after: usd(sum("combined_after")),
    conservation_ok: sum("combined_before") === sum("combined_after")
  };
  return { generated_at: new Date().toISOString(), transaction: "REPEATABLE READ READ ONLY (rolled back)", summary, users, chronology };
}

async function main() {
  if (process.argv.slice(2).length > 0) throw new Error("This report-only script accepts no execution arguments.");
  if (!pool) throw new Error("DATABASE_URL is required. No database operation was attempted.");
  const client = await pool.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    try {
      const report = await buildReport(client);
      console.log("HISTORICAL_WALLET_CHRONOLOGY_SUMMARY");
      console.table([report.summary]);
      console.log("HISTORICAL_WALLET_CHRONOLOGY_USERS");
      console.table(report.users);
      console.log("HISTORICAL_WALLET_CHRONOLOGY_JSON_BEGIN");
      console.log(JSON.stringify(report, null, 2));
      console.log("HISTORICAL_WALLET_CHRONOLOGY_JSON_END");
      await client.query("rollback");
      console.log("READ ONLY: transaction rolled back; no data was modified.");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => pool?.end());
