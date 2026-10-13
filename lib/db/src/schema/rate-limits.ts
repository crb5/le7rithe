import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const apiRateLimitsTable = pgTable(
  "marketplace_api_rate_limits",
  {
    limiterKey: text("limiter_key").notNull(),
    clientKeyHash: text("client_key_hash").notNull(),
    hitCount: integer("hit_count").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.limiterKey, table.clientKeyHash] }),
    resetAtIdx: index("marketplace_api_rate_limits_reset_at_idx").on(table.resetAt),
    hitCountPositive: check(
      "marketplace_api_rate_limits_hit_count_check",
      sql`${table.hitCount} > 0`,
    ),
  }),
);
