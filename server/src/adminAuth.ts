import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";
import { fail } from "./http.js";

export type AdminRole = "super_admin" | "support_admin";

export type AdminTokenPayload = {
  email: string;
  role: AdminRole;
  exp: number;
};

declare module "express-serve-static-core" {
  interface Request {
    admin?: AdminTokenPayload;
  }
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string) {
  return crypto.createHmac("sha256", config.adminSessionSecret).update(value).digest("base64url");
}

export function hashAdminPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyAdminPassword(password: string) {
  if (!config.adminEmail || !config.adminPasswordHash) return false;
  const candidate = Buffer.from(hashAdminPassword(password));
  const expected = Buffer.from(config.adminPasswordHash);
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function createAdminToken(email: string, role: AdminRole = "super_admin") {
  const payload: AdminTokenPayload = {
    email,
    role,
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || sign(encoded) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AdminTokenPayload;
    if (!payload.email || !payload.role || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== "super_admin" && payload.role !== "support_admin") return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyAdminToken(token);
  if (!payload) {
    fail(res, "Admin authentication required.", 401, "Unauthorized");
    return;
  }
  req.admin = payload;
  next();
}
