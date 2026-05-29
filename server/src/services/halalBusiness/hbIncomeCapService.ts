import type pg from "pg";
import { pool } from "../../db/pool.js";
import { logger } from "../../logger.js";
import { createLedgerProof } from "./hbLedgerProofService.js";

const incomeCapTimezone = process.env.HB_INCOME_CAP_TIMEZONE || "UTC";
const dailyIncomeCapByPackage = new Map<number, string>([
  [4, "2"],
  [20, "10"],
  [100, "50"],
  [500, "250"],
  [2500, "1250"],
  [12500, "6250"]
]);

type CapResult = {
  capDate: string;
  packageAmount: string;
  dailyCapAmount: string;
  creditedAmount: string;
  cappedAmount: string;
  remainingAmount: string;
};

export function getDailyIncomeCap(packageAmount: string | number) {
  return dailyIncomeCapByPackage.get(Number(packageAmount)) || "0";
}

export async function getDailyCapForUser(client: pg.PoolClient, userId: string) {
  const rows = await client.query<{ package_amount: string; daily_cap_amount: string; cap_date: string }>(
    `select coalesce(max(amount_usd), 0)::text as package_amount,
            (now() at time zone $2)::date::text as cap_date
     from hb_package_purchases
     where user_id = $1 and status = 'completed'`,
    [userId, incomeCapTimezone]
  );
  const row = rows.rows[0] || { package_amount: "0", cap_date: "" };
  return {
    package_amount: row.package_amount,
    daily_cap_amount: getDailyIncomeCap(row.package_amount),
    cap_date: row.cap_date
  };
}

export async function getTodayIncomeUsed(client: pg.PoolClient, userId: string) {
  const cap = await getDailyCapForUser(client, userId);
  const rows = await client.query<{ credited_amount: string; capped_amount: string }>(
    `select coalesce(credited_amount,0)::text as credited_amount,
            coalesce(capped_amount,0)::text as capped_amount
     from hb_daily_income_caps
     where user_id = $1 and cap_date = $2::date`,
    [userId, cap.cap_date]
  );
  return {
    capDate: cap.cap_date,
    packageAmount: cap.package_amount,
    dailyCapAmount: cap.daily_cap_amount,
    creditedAmount: rows.rows[0]?.credited_amount || "0",
    cappedAmount: rows.rows[0]?.capped_amount || "0"
  };
}

export async function recordCappedIncome(input: {
  client: pg.PoolClient;
  userId: string;
  incomeLedgerId: string;
  originalAmount: string;
  creditedAmount: string;
  cappedAmount: string;
  capDate: string;
}) {
  await input.client.query(
    `update hb_income_ledger
     set credited_amount = $3::numeric,
         capped_amount = $4::numeric,
         cap_date = $5::date,
         cap_status = case
           when $3::numeric <= 0 and $4::numeric > 0 then 'capped'
           when $4::numeric > 0 then 'partially_capped'
           else 'within_cap'
         end,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'dailyCapOriginalAmount', $2::numeric,
           'dailyCapCreditedAmount', $3::numeric,
           'dailyCapCappedAmount', $4::numeric,
           'dailyCapDate', $5::text
         )
     where id = $1`,
    [input.incomeLedgerId, input.originalAmount, input.creditedAmount, input.cappedAmount, input.capDate]
  );
}

export async function applyIncomeCap(input: {
  client: pg.PoolClient;
  userId: string;
  incomeLedgerId: string;
  incomeAmount: string;
  incomeType: string;
  metadata?: Record<string, unknown>;
  creditWallet?: boolean;
}) {
  const { client, userId, incomeLedgerId, incomeAmount, incomeType } = input;
  const existingRows = await client.query<{
    cap_status: string | null;
    credited_amount: string | null;
    capped_amount: string | null;
    cap_date: string | null;
  }>(
    `select cap_status, credited_amount::text, capped_amount::text, cap_date::text
     from hb_income_ledger
     where id = $1 and earner_user_id = $2
     for update`,
    [incomeLedgerId, userId]
  );
  const existing = existingRows.rows[0];
  if (!existing) throw new Error("Income ledger entry was not found for cap application.");
  if (existing.cap_status) {
    const cap = await getTodayIncomeUsed(client, userId);
    return {
      capDate: existing.cap_date || cap.capDate,
      packageAmount: cap.packageAmount,
      dailyCapAmount: cap.dailyCapAmount,
      creditedAmount: existing.credited_amount || "0",
      cappedAmount: existing.capped_amount || "0",
      remainingAmount: String(Math.max(0, Number(cap.dailyCapAmount) - Number(cap.creditedAmount)))
    };
  }

  const cap = await getDailyCapForUser(client, userId);
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [`hb:daily-income-cap:${userId}:${cap.cap_date}`]);
  const capUpdateRows = await client.query<{ id: string }>(
    `update hb_daily_income_caps
     set package_amount = $3::numeric,
         daily_cap_amount = $4::numeric,
         updated_at = now()
     where user_id = $1 and cap_date = $2::date
     returning id`,
    [userId, cap.cap_date, cap.package_amount, cap.daily_cap_amount]
  );
  if (!capUpdateRows.rows[0]) {
    await client.query(
      `insert into hb_daily_income_caps
        (user_id, cap_date, package_amount, daily_cap_amount, credited_amount, capped_amount)
       values ($1,$2::date,$3::numeric,$4::numeric,0,0)`,
      [userId, cap.cap_date, cap.package_amount, cap.daily_cap_amount]
    );
  }

  const capRows = await client.query<{
    package_amount: string;
    daily_cap_amount: string;
    credited_amount: string;
    capped_amount: string;
  }>(
    `select package_amount::text, daily_cap_amount::text, credited_amount::text, capped_amount::text
     from hb_daily_income_caps
     where user_id = $1 and cap_date = $2::date
     for update`,
    [userId, cap.cap_date]
  );
  const capRow = capRows.rows[0] || { package_amount: "0", daily_cap_amount: "0", credited_amount: "0", capped_amount: "0" };
  const todayIncome = capRow.credited_amount;
  const remainingCap = String(Math.max(0, Number(capRow.daily_cap_amount) - Number(todayIncome)));
  const splitRows = await client.query<{ credited_amount: string; capped_amount: string; remaining_amount: string }>(
    `select least($1::numeric, greatest($2::numeric - $3::numeric, 0))::text as credited_amount,
            greatest($1::numeric - least($1::numeric, greatest($2::numeric - $3::numeric, 0)), 0)::text as capped_amount,
            greatest($2::numeric - $3::numeric - least($1::numeric, greatest($2::numeric - $3::numeric, 0)), 0)::text as remaining_amount`,
    [incomeAmount, capRow.daily_cap_amount, capRow.credited_amount]
  );
  const split = splitRows.rows[0] || { credited_amount: "0", capped_amount: incomeAmount, remaining_amount: "0" };

  await client.query(
    `update hb_daily_income_caps
     set credited_amount = credited_amount + $3::numeric,
         capped_amount = capped_amount + $4::numeric,
         updated_at = now()
     where user_id = $1 and cap_date = $2::date`,
    [userId, cap.cap_date, split.credited_amount, split.capped_amount]
  );

  await recordCappedIncome({
    client,
    userId,
    incomeLedgerId,
    originalAmount: incomeAmount,
    creditedAmount: split.credited_amount,
    cappedAmount: split.capped_amount,
    capDate: cap.cap_date
  });
  await createLedgerProof(client, "hb_income_ledger", incomeLedgerId);

  logger.info("HB9_DAILY_CAP_APPLIED", {
    userId,
    packageAmount: capRow.package_amount,
    dailyCap: capRow.daily_cap_amount,
    todayIncome,
    requestedAmount: incomeAmount,
    creditedAmount: split.credited_amount,
    remainingCap
  });

  if (input.creditWallet !== false && Number(split.credited_amount) > 0) {
    const internalIdempotencyKey = `hb:wallet:income_cap:${incomeLedgerId}`;
    const existingInternalLedgerRows = await client.query<{ id: string }>(
      "select id from hb_internal_ledger where idempotency_key = $1 limit 1",
      [internalIdempotencyKey]
    );
    let internalLedgerId = existingInternalLedgerRows.rows[0]?.id || null;
    if (!internalLedgerId) {
      const internalLedgerRows = await client.query<{ id: string }>(
        `insert into hb_internal_ledger
          (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
         values ($1,'deposit','credit',$2,$3,$4,$5,$6::jsonb)
         returning id`,
        [
          userId,
          split.credited_amount,
          incomeType,
          incomeLedgerId,
          internalIdempotencyKey,
          JSON.stringify({ ...(input.metadata || {}), incomeLedgerId, incomeType, capDate: cap.cap_date, originalAmount: incomeAmount, cappedAmount: split.capped_amount })
        ]
      );
      internalLedgerId = internalLedgerRows.rows[0]?.id || null;
    }
    await createLedgerProof(client, "hb_internal_ledger", internalLedgerId);

    const coinIdempotencyKey = `hb:coin:income_cap:${incomeLedgerId}`;
    const existingCoinLedgerRows = await client.query<{ id: string }>(
      "select id from hb_coin_balance_ledger where idempotency_key = $1 limit 1",
      [coinIdempotencyKey]
    );
    if (existingCoinLedgerRows.rows[0]) {
      await createLedgerProof(client, "hb_coin_balance_ledger", existingCoinLedgerRows.rows[0].id);
      return {
        capDate: cap.cap_date,
        creditedAmount: split.credited_amount,
        cappedAmount: split.capped_amount,
        remainingAmount: split.remaining_amount
      };
    }
    const coinLedgerRows = await client.query<{ id: string }>(
      `insert into hb_coin_balance_ledger
        (user_id, coin_symbol, amount, type, direction, reference_id, note, idempotency_key)
       values ($1,'USDT',$2,'earning','credit',$3,$4,$5)
       returning id`,
      [
        userId,
        split.credited_amount,
        incomeLedgerId,
        `Automatic USDT ${incomeType} income after daily cap`,
        coinIdempotencyKey
      ]
    );
    if (coinLedgerRows.rows[0]) {
      const balanceRows = await client.query<{ id: string }>(
        `update hb_coin_balances
         set balance = balance + $2::numeric,
             updated_at = now()
         where user_id = $1 and coin_symbol = 'USDT'
         returning id`,
        [userId, split.credited_amount]
      );
      if (!balanceRows.rows[0]) {
        await client.query(
          "insert into hb_coin_balances (user_id, coin_symbol, balance) values ($1,'USDT',$2)",
          [userId, split.credited_amount]
        );
      }
    }
  }

  return {
    capDate: cap.cap_date,
    packageAmount: capRow.package_amount,
    dailyCapAmount: capRow.daily_cap_amount,
    creditedAmount: split.credited_amount,
    cappedAmount: split.capped_amount,
    remainingAmount: split.remaining_amount
  } satisfies CapResult;
}

export async function recalculateDailyCap(userId: string, capDate: string, client?: pg.PoolClient) {
  const run = async (activeClient: pg.PoolClient) => {
    const rows = await activeClient.query(
      `select id, amount_usd::text, income_type
       from hb_income_ledger
       where earner_user_id = $1 and cap_date = $2::date
       order by created_at asc, id asc`,
      [userId, capDate]
    );
    await activeClient.query("delete from hb_daily_income_caps where user_id = $1 and cap_date = $2::date", [userId, capDate]);
    for (const row of rows.rows as Array<{ id: string; amount_usd: string; income_type: string }>) {
      await activeClient.query("update hb_income_ledger set cap_status = null, credited_amount = null, capped_amount = 0 where id = $1", [row.id]);
      await applyIncomeCap({ client: activeClient, userId, incomeLedgerId: row.id, incomeAmount: row.amount_usd, incomeType: row.income_type });
    }
  };
  if (client) return run(client);
  if (!pool) throw new Error("Database is not configured.");
  const ownClient = await pool.connect();
  try {
    await ownClient.query("begin");
    await run(ownClient);
    await ownClient.query("commit");
  } catch (error) {
    await ownClient.query("rollback");
    throw error;
  } finally {
    ownClient.release();
  }
}

export async function getIncomeCapSummary(userId: string) {
  if (!pool) throw new Error("Database is not configured.");
  const client = await pool.connect();
  try {
    const cap = await getTodayIncomeUsed(client, userId);
    return {
      ...cap,
      remainingAmount: String(Math.max(0, Number(cap.dailyCapAmount) - Number(cap.creditedAmount))),
      timezone: incomeCapTimezone
    };
  } finally {
    client.release();
  }
}
