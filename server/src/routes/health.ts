import { Router } from "express";
import { ok } from "../http.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  ok(res, { service: "bitzenx-api", time: new Date().toISOString() });
});
