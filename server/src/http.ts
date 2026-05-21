import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger.js";

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  message: string;
  error: string | null;
};

export function ok<T>(res: Response, data: T, message = "OK", status = 200) {
  res.status(status).json({ success: true, data, message, error: null } satisfies ApiEnvelope<T>);
}

export function fail(res: Response, error: string, status = 400, message = "Request failed") {
  res.status(status).json({ success: false, data: null, message, error } satisfies ApiEnvelope<null>);
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : "Unexpected server error";
  logger.error("api.error", { category: "unhandled", message });
  fail(res, message, 500, "Internal server error");
}
