import type { Request, Response, NextFunction } from "express";

import { fail } from "./http.js";

const forbiddenKeys = ["mnemonic", "seed", "seedPhrase", "privateKey", "private_key", "recoveryPhrase"];

export function containsSensitiveWalletMaterial(payload: unknown) {
  const body = payload && typeof payload === "object" ? JSON.stringify(payload).toLowerCase() : "";
  return forbiddenKeys.some((key) => body.includes(key.toLowerCase()));
}

export function rejectSensitiveWalletMaterial(req: Request, res: Response, next: NextFunction) {
  // Backend boundary: API requests must never contain wallet recovery material.
  if (containsSensitiveWalletMaterial(req.body)) {
    fail(res, "Seed phrases and private keys must never be sent to the backend.", 400, "Sensitive wallet material rejected");
    return;
  }
  next();
}
