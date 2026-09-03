import { getRedis } from "@/lib/cache/redis";

/**
 * Rate limiter for login / password-reset brute-force protection.
 *
 * Uses a Redis fixed-window counter when Redis is configured (shared across
 * instances, survives restarts), and falls back to an in-memory sliding-window
 * bucket for single-instance dev. All functions are async so the Redis path is
 * safe; callers must `await` them.
 */

// ---- In-memory fallback (single instance only) ---------------------------
interface Bucket {
  attempts: number[];
  clearedAt: number;
}
const buckets = new Map<string, Bucket>();

function memBucketFor(key: string): Bucket {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { attempts: [], clearedAt: now };
    buckets.set(key, b);
  }
  return b;
}

function memPrune(key: string, windowMs: number): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b) return;
  b.attempts = b.attempts.filter((t) => now - t < windowMs);
  for (const [k, v] of buckets) {
    if (now - v.clearedAt > 60 * 60 * 1000) buckets.delete(k);
  }
}

// ---- Redis fixed-window counter ------------------------------------------
// Key: ratelimit:{key}?window={windowMs}. A single INCR with EXPIRE gives an
// atomic fixed window. Attempts within the window come from the counter.
async function redisIsLimited(key: string, max: number, windowMs: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const k = `ratelimit:${key}`;
  try {
    const count = await redis.incr(k);
    if (count === 1) {
      await redis.expire(k, Math.max(1, Math.round(windowMs / 1000)));
    }
    return count > max;
  } catch {
    return false;
  }
}

async function redisClear(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(`ratelimit:${key}`);
  } catch {
    // ignore
  }
}

async function memIsLimited(key: string, max: number, windowMs: number): Promise<boolean> {
  memPrune(key, windowMs);
  const b = memBucketFor(key);
  return b.attempts.length >= max;
}

async function memRecordFailure(key: string): Promise<void> {
  const b = memBucketFor(key);
  b.attempts.push(Date.now());
}

async function memClear(key: string): Promise<void> {
  buckets.delete(key);
}

/** True when the key has exceeded max attempts within windowMs. */
export async function isRateLimited(key: string, max: number, windowMs: number): Promise<boolean> {
  if (getRedis()) {
    return redisIsLimited(key, max, windowMs);
  }
  return memIsLimited(key, max, windowMs);
}

/** Record an attempt (only meaningful for the in-memory backend). */
export async function recordFailure(key: string): Promise<void> {
  if (!getRedis()) {
    await memRecordFailure(key);
  }
}

export async function clearFailures(key: string): Promise<void> {
  await redisClear(key);
  await memClear(key);
}
