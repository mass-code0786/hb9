import type { Request, Response, NextFunction } from "express";

const forbiddenKeys = ["mnemonic", "seed", "seedPhrase", "privateKey", "recoveryPhrase"];

export function rejectSensitiveWalletMaterial(req: Request, res: Response, next: NextFunction) {
  const body = req.body && typeof req.body === "object" ? JSON.stringify(req.body).toLowerCase() : "";
  const hasSensitiveKey = forbiddenKeys.some((key) => body.includes(key.toLowerCase()));
  if (hasSensitiveKey) {
    res.status(400).json({ error: "Seed phrases and private keys must never be sent to the backend." });
    return;
  }
  next();
}
