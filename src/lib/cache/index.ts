import { getRedis } from "./redis";

/**
 * JSON cache helpers with an in-memory fallback so caching still helps in
 * single-instance dev where Redis is not configured, while multi-instance prod
 * gets the shared store automatically.
 */
const mem = new Map<string, { value: string; expiresAt: number }>();
const MEM_TTL = 60 * 1000; // in-memory cap when Redis is absent

async function getRaw(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.get(key);
    } catch {
      // fall through to memory
    }
  }
  const e = mem.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    mem.delete(key);
    return null;
  }
  return e.value;
}

async function setRaw(key: string, value: string, ttlMs: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, "EX", Math.max(1, Math.round(ttlMs / 1000)));
      return;
    } catch {
      // fall through to memory
    }
  }
  mem.set(key, { value, expiresAt: Date.now() + Math.min(ttlMs, MEM_TTL) });
}

async function del(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  }
  mem.delete(key);
}

/** Fetch from cache, or run `loader` and store the JSON-serialized result. */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number
): Promise<T> {
  const raw = await getRaw(key);
  if (raw !== null) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      // corrupt entry — fall through to reload
    }
  }
  const value = await loader();
  try {
    await setRaw(key, JSON.stringify(value), ttlMs);
  } catch {
    // caching must never fail a request
  }
  return value;
}

export async function invalidate(key: string): Promise<void> {
  await del(key);
}

export async function invalidatePattern(match: string): Promise<number> {
  const redis = getRedis();
  if (redis) {
    try {
      const keys = await redis.keys(`${match}*`);
      if (keys.length > 0) await redis.del(...keys);
      return keys.length;
    } catch {
      return 0;
    }
  }
  // In-memory fallback: delete matching keys.
  let count = 0;
  for (const k of [...mem.keys()]) {
    if (k.startsWith(match)) {
      mem.delete(k);
      count++;
    }
  }
  return count;
}
