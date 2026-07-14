import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (err) {
  console.warn("Failed to initialize Redis for AI caching:", err);
}

// In-Memory fallback cache
const memoryCache = new Map<string, { responseText: string; expiresAt: number }>();

export class AIResponseCache {
  private static getCacheKey(mode: string, questionTitle: string, query: string): string {
    const cleanQuery = query.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanTitle = questionTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    return `ai_cache:${mode}:${cleanTitle}:${cleanQuery}`;
  }

  static async get(mode: string, questionTitle: string, query: string): Promise<string | null> {
    // Disable caching during testing or when using the mock provider
    if (process.env.NODE_ENV === "test" || process.env.AI_PROVIDER === "mock") {
      return null;
    }

    // SECURITY: Never cache live/admin responses
    if (
      mode === "candidate_live" ||
      mode === "interviewer_live" ||
      mode === "admin_live"
    ) {
      return null;
    }

    const key = this.getCacheKey(mode, questionTitle, query);

    // 1. Try Redis Cache
    if (redis) {
      try {
        const cached = await redis.get<string>(key);
        if (cached) return cached;
      } catch (err) {
        console.warn("Redis get failed:", err);
      }
    }

    // 2. Try In-Memory Fallback
    const memoryCached = memoryCache.get(key);
    if (memoryCached) {
      if (Date.now() < memoryCached.expiresAt) {
        return memoryCached.responseText;
      }
      memoryCache.delete(key);
    }

    return null;
  }

  static async set(
    mode: string,
    questionTitle: string,
    query: string,
    responseText: string
  ): Promise<void> {
    if (
      mode === "candidate_live" ||
      mode === "interviewer_live" ||
      mode === "admin_live"
    ) {
      return;
    }

    const key = this.getCacheKey(mode, questionTitle, query);
    const ttlSeconds = 3600 * 24; // 24 hours TTL

    // 1. Save to Redis
    if (redis) {
      try {
        await redis.set(key, responseText, { ex: ttlSeconds });
      } catch (err) {
        console.warn("Redis set failed:", err);
      }
    }

    // 2. Save to In-Memory
    memoryCache.set(key, {
      responseText,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}
