import pg from "pg";
import { config } from "../config.js";

export const pool = config.databaseUrl
  ? new pg.Pool({
      connectionString: config.databaseUrl
    })
  : null;

export async function query<T>(text: string, values: unknown[] = []): Promise<T[]> {
  if (!pool) return [];
  const result = await pool.query(text, values);
  return result.rows as T[];
}
