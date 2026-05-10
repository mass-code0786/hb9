import type { Request, Response, NextFunction } from "express";

import { fail } from "./http.js";

const forbiddenKeys = ["mnemonic", "seed", "seedPhrase", "privateKey", "private_key", "recoveryPhrase"];

export function rejectSensitiveWalletMaterial(req: Request, res: Response, next: NextFunction) {
  const body = req.body && typeof req.body === "object" ? JSON.stringify(req.body).toLowerCase() : "";
  const hasSensitiveKey = forbiddenKeys.some((key) => body.includes(key.toLowerCase()));
  if (hasSensitiveKey) {
    fail(res, "Seed phrases and private keys must never be sent to the backend.", 400, "Sensitive wallet material rejected");
    return;
  }
  next();
}
