import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { errorHandler, fail } from "./http.js";
import { rateLimit } from "./rateLimit.js";
import { rejectSensitiveWalletMaterial } from "./security.js";
import { adminRouter } from "./routes/admin.js";
import { healthRouter } from "./routes/health.js";
import { paymentsRouter } from "./routes/payments.js";
import { providersRouter } from "./routes/providers.js";
import { rechargeRouter } from "./routes/recharge.js";

const app = express();

app.use(cors({ origin: config.corsOrigin.split(",").map((item) => item.trim()), credentials: false }));
app.use(express.json({ limit: "64kb" }));
app.use(rateLimit);
app.use(rejectSensitiveWalletMaterial);

app.use("/api", healthRouter);
app.use("/api", adminRouter);
app.use("/api", rechargeRouter);
app.use("/api", paymentsRouter);
app.use("/api", providersRouter);

app.use((_req, res) => {
  fail(res, "Not found", 404);
});

app.use(errorHandler);

app.listen(config.port, () => {
  process.stdout.write(`BitzenX API listening on ${config.port}\n`);
});
