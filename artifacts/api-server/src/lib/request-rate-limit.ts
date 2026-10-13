import { createHash } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { logger } from "./logger";

type RateLimitOptions = {
  limiterKey: string;
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  errorMessage?: string;
  failClosed?: boolean | ((req: Request) => boolean);
};

export type RateLimitStore = {
  consume(input: {
    limiterKey: string;
    clientKeyHash: string;
    windowMs: number;
    max: number;
  }): Promise<{ count: number; resetAt: number }>;
  pruneExpired(): Promise<void>;
};

export const postgresRateLimitStore: RateLimitStore = {
  async consume({ limiterKey, clientKeyHash, windowMs, max }) {
    const { pool } = await import("@workspace/db/pool");
    const result = await pool.query<{ hit_count: number; reset_at: Date }>(
      `INSERT INTO marketplace_api_rate_limits
         (limiter_key, client_key_hash, hit_count, reset_at)
       VALUES ($1, $2, 1, statement_timestamp() + ($3 * interval '1 millisecond'))
       ON CONFLICT (limiter_key, client_key_hash) DO UPDATE
       SET hit_count = CASE
             WHEN marketplace_api_rate_limits.reset_at <= statement_timestamp() THEN 1
             ELSE LEAST(marketplace_api_rate_limits.hit_count + 1, $4)
           END,
           reset_at = CASE
             WHEN marketplace_api_rate_limits.reset_at <= statement_timestamp() THEN EXCLUDED.reset_at
             ELSE marketplace_api_rate_limits.reset_at
           END,
           updated_at = statement_timestamp()
       RETURNING hit_count, reset_at`,
      [limiterKey, clientKeyHash, windowMs, max + 1],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Rate-limit upsert returned no row");
    return { count: Number(row.hit_count), resetAt: new Date(row.reset_at).getTime() };
  },
  async pruneExpired() {
    const { pool } = await import("@workspace/db/pool");
    await pool.query(
      "DELETE FROM marketplace_api_rate_limits WHERE reset_at <= statement_timestamp()",
    );
  },
};

let cleanupCounter = 0;

export function createRequestRateLimiter(
  {
    limiterKey,
    windowMs,
    max,
    keyGenerator = (req) => req.ip || "unknown",
    errorMessage = "Too many requests",
    failClosed = false,
  }: RateLimitOptions,
  store: RateLimitStore = postgresRateLimitStore,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (++cleanupCounter >= 1_000) {
      cleanupCounter = 0;
      void store.pruneExpired().catch((error: unknown) => {
        const code = typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "unknown";
        logger.error({ code }, "Rate-limit expired-row cleanup failed");
      });
    }

    const shouldFailClosed =
      typeof failClosed === "function" ? failClosed(req) : failClosed;
    try {
      const clientKeyHash = createHash("sha256")
        .update(keyGenerator(req))
        .digest("hex");
      const bucket = await store.consume({
        limiterKey,
        clientKeyHash,
        windowMs,
        max,
      });
      if (bucket.count > max) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((bucket.resetAt - Date.now()) / 1000),
        );
        res.setHeader("Retry-After", String(retryAfterSeconds));
        res.status(429).json({ error: errorMessage, retryAfterSeconds });
        return;
      }
      next();
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "unknown";
      logger.error({ code, failClosed: shouldFailClosed }, "Database rate-limit check failed");
      if (shouldFailClosed) {
        res.status(503).json({ error: "Request security check temporarily unavailable" });
        return;
      }
      next();
    }
  };
}
