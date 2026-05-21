import { Router } from "express";
import { ok } from "../http.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  ok(res, { service: "hb9-api", time: new Date().toISOString() });
});
