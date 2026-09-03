import Redis from "ioredis";

/**
 * Optional Redis client. The app runs fully without Redis (every call degrades
 * gracefully to a miss or an in-memory fallback), so a missing REDIS_URL never
 * breaks startup. When present, it powers shared, multi-instance caching,
 * Redis-backed rate limiting and cross-restart session state.
 */
const url = process.env.REDIS_URL?.trim();

let client: Redis | null = null;

function createClient(): Redis | null {
  if (!url) return null;
  try {
    const c = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    c.on("error", () => {
      // Network is down or Redis is unreachable — degrade to cache misses.
    });
    return c;
  } catch {
    return null;
  }
}

/** Lazily-initialized singleton. Returns null when Redis is unavailable. */
export function getRedis(): Redis | null {
  if (client === null && url) {
    client = createClient();
  }
  return client;
}

export function isRedisAvailable(): boolean {
  return Boolean(url) && getRedis() !== null;
}
