import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { rejectSensitiveWalletMaterial } from "./security.js";
import { healthRouter } from "./routes/health.js";
import { paymentsRouter } from "./routes/payments.js";
import { rechargeRouter } from "./routes/recharge.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "64kb" }));
app.use(rejectSensitiveWalletMaterial);

app.use("/api", healthRouter);
app.use("/api", rechargeRouter);
app.use("/api", paymentsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(config.port, () => {
  process.stdout.write(`BitzenX API listening on ${config.port}\n`);
});
