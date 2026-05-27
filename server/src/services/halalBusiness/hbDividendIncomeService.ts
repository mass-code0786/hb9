import type { PoolClient } from "pg";
import { pool, query } from "../../db/pool.js";

type Queryable = Pick<PoolClient, "query">;

export type HbDividendStats = {
  totalDividendUsd: string;
  dividendCapUsd: string;
  remainingDividendUsd: string;
};

export async function getUserDividendStats(userId: string): Promise<HbDividendStats> {
  if (!pool) return { totalDividendUsd: "0", dividendCapUsd: "0", remainingDividendUsd: "0" };
  const rows = await query<{
    total_dividend_usd: string;
    dividend_cap_usd: string;
    remaining_dividend_usd: string;
  }>(dividendStatsSql, [userId]);
  return mapDividendStats(rows[0]);
}

export async function getUserDividendStatsForClient(client: Queryable, userId: string): Promise<HbDividendStats> {
  const result = await client.query<{
    total_dividend_usd: string;
    dividend_cap_usd: string;
    remaining_dividend_usd: string;
  }>(dividendStatsSql, [userId]);
  return mapDividendStats(result.rows[0]);
}

const dividendStatsSql = `with package_totals as (
       select coalesce(sum(amount_usd),0)::numeric as package_total_usd
       from hb_package_purchases
       where user_id = $1
         and status = 'completed'
     ),
     dividend_totals as (
       select coalesce(sum(credited_usd),0)::numeric as total_dividend_usd
       from hb_dividend_income_ledger
       where user_id = $1
     )
     select
       dividend_totals.total_dividend_usd::text as total_dividend_usd,
       (package_totals.package_total_usd * 2)::text as dividend_cap_usd,
       greatest((package_totals.package_total_usd * 2) - dividend_totals.total_dividend_usd, 0)::text as remaining_dividend_usd
     from package_totals, dividend_totals`;

function mapDividendStats(row: {
  total_dividend_usd: string;
  dividend_cap_usd: string;
  remaining_dividend_usd: string;
} | undefined): HbDividendStats {
  return {
    totalDividendUsd: row?.total_dividend_usd || "0",
    dividendCapUsd: row?.dividend_cap_usd || "0",
    remainingDividendUsd: row?.remaining_dividend_usd || "0"
  };
}
