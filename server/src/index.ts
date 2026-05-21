import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { errorHandler, fail } from "./http.js";
import { rateLimit } from "./rateLimit.js";
import { rejectSensitiveWalletMaterial } from "./security.js";
import { adminRouter } from "./routes/admin.js";
import { healthRouter } from "./routes/health.js";
import { hbRouter } from "./routes/halalBusiness.js";
import { paymentsRouter } from "./routes/payments.js";
import { providersRouter } from "./routes/providers.js";
import { rechargeRouter } from "./routes/recharge.js";
import { startHbOnchainIndexer } from "./services/halalBusiness/hbOnchainIndexerService.js";
import { logger } from "./logger.js";
import { pool } from "./db/pool.js";
import { formatHbSchemaVerificationFailure, verifyHbProductionSchema } from "./schema/hbProductionSchema.js";

const app = express();

const productionOrigins = new Set(
  [config.frontendUrl, config.corsOrigin]
    .flatMap((value) => value.split(","))
    .map((item) => item.trim())
    .filter(Boolean)
);
const developmentOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (productionOrigins.has(origin) || (process.env.NODE_ENV !== "production" && developmentOrigins.has(origin))) {
      callback(null, true);
      return;
    }
    callback(new Error("CORS origin not allowed"));
  },
  credentials: false
}));
app.use(express.json({ limit: "64kb" }));
app.use(rateLimit);
app.use(rejectSensitiveWalletMaterial);
app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    logger.info("http.request", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - started
    });
  });
  next();
});

app.use("/api", healthRouter);
app.use("/api", adminRouter);
app.use("/api", rechargeRouter);
app.use("/api", paymentsRouter);
app.use("/api", providersRouter);
app.use("/api", hbRouter);

app.use((_req, res) => {
  fail(res, "Not found", 404);
});

app.use(errorHandler);

const onListen = () => {
  try {
    startHbOnchainIndexer();
  } catch (error) {
    logger.warn("hb.indexer.start_failed", { error: error instanceof Error ? error.message : "Indexer start failed" });
  }
  logger.info("api.started", { host: config.host || "default", port: config.port, rolloutMode: config.hbRolloutMode });
};

async function start() {
  if (process.env.NODE_ENV === "production") {
    if (!pool) throw new Error("DATABASE_URL is required in production.");
    const schemaResult = await verifyHbProductionSchema(pool);
    if (!schemaResult.ok) throw new Error(formatHbSchemaVerificationFailure(schemaResult));
  }

  if (config.host) {
    app.listen(config.port, config.host, onListen);
  } else {
    app.listen(config.port, onListen);
  }
}

start().catch((error) => {
  logger.error("api.start_failed", { error: error instanceof Error ? error.message : "API start failed" });
  process.exit(1);
});
