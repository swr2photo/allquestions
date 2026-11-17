import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Bucket = "auth" | "ai" | "admin" | "api";

// requests per window, per client IP
const LIMITS: Record<Bucket, { limit: number; window: `${number} s` | `${number} m` }> = {
  auth: { limit: 30, window: "1 m" },    // sign-in attempts (per IP; campus NAT shares IPs)
  ai: { limit: 60, window: "1 m" },      // AI endpoints (chat has its own daily quota too)
  admin: { limit: 120, window: "1 m" },
  api: { limit: 240, window: "1 m" },    // everything else under /api
};

const url = process.env.allquiz_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.allquiz_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

const limiters = new Map<Bucket, Ratelimit>();
function limiterFor(bucket: Bucket): Ratelimit | null {
  if (!redis) return null;
  let l = limiters.get(bucket);
  if (!l) {
    const { limit, window } = LIMITS[bucket];
    l = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `rl:${bucket}`,
      ephemeralCache: new Map(),
    });
    limiters.set(bucket, l);
  }
  return l;
}

// In-memory fallback (local dev / no Redis). Per-instance only, which is fine for dev.
const memory = new Map<string, { count: number; resetAt: number }>();
function windowMs(w: string): number {
  const [n, unit] = w.split(" ");
  return Number(n) * (unit === "m" ? 60_000 : 1000);
}
function memoryLimit(bucket: Bucket, id: string) {
  const { limit, window } = LIMITS[bucket];
  const now = Date.now();
  const key = `${bucket}:${id}`;
  const entry = memory.get(key);
  if (!entry || now > entry.resetAt) {
    if (memory.size > 10_000) memory.clear();
    memory.set(key, { count: 1, resetAt: now + windowMs(window) });
    return { success: true, limit, remaining: limit - 1, reset: now + windowMs(window) };
  }
  entry.count++;
  return { success: entry.count <= limit, limit, remaining: Math.max(limit - entry.count, 0), reset: entry.resetAt };
}

export function bucketFor(pathname: string, method: string): Bucket {
  if ((pathname === "/api/auth/user" || pathname === "/api/admin/auth") && method === "POST") return "auth";
  if (pathname.startsWith("/api/admin/")) return "admin";
  if (pathname.startsWith("/api/ai/")) return "ai";
  return "api";
}

export async function rateLimit(bucket: Bucket, id: string) {
  const limiter = limiterFor(bucket);
  if (!limiter) return memoryLimit(bucket, id);
  try {
    const r = await limiter.limit(id);
    return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
  } catch (err) {
    // Fail open: a Redis outage must not take the whole API down.
    console.error("[rate-limit]", err);
    return memoryLimit(bucket, id);
  }
}
