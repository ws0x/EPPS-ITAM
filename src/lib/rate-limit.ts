import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimitHits } from "@/db/schema";

export class RateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`Too many attempts. Try again in ${retryAfterSeconds}s.`);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Fixed-window rate limit, DB-backed (no Redis/KV provisioned in this
 * environment). Atomically upserts-and-increments a counter row for
 * (key, windowStart) and throws RateLimitError once `limit` is exceeded
 * within the current window. Same atomic-upsert pattern already proven by
 * nextPoNumber/nextAssetTag for concurrency safety.
 */
export async function checkRateLimit(key: string, limit: number, windowMinutes: number): Promise<void> {
  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const rows = await db.execute<{ count: number }>(sql`
    insert into ${rateLimitHits} (key, window_start, count)
    values (${key}, ${windowStart}, 1)
    on conflict (key, window_start)
    do update set count = ${rateLimitHits.count} + 1
    returning count
  `);
  const count = rows[0].count;

  if (count > limit) {
    const retryAfterMs = windowStart.getTime() + windowMs - Date.now();
    throw new RateLimitError(Math.max(1, Math.ceil(retryAfterMs / 1000)));
  }
}
