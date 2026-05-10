import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { fail } from "./http.js";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.rateLimitWindowMs });
    next();
    return;
  }

  bucket.count += 1;
  if (bucket.count > config.rateLimitMax) {
    fail(res, "Too many requests. Try again shortly.", 429, "Rate limit exceeded");
    return;
  }

  next();
}
