import { pool } from "../db/pool.js";
import { formatHbSchemaVerificationFailure, verifyHbProductionSchema } from "../schema/hbProductionSchema.js";

async function main() {
  if (!pool) {
    throw new Error("DATABASE_URL is required for HB9 schema verification.");
  }
  const result = await verifyHbProductionSchema(pool);
  if (!result.ok) {
    throw new Error(formatHbSchemaVerificationFailure(result));
  }
  console.log("HB9 production schema verification passed.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end();
  });
