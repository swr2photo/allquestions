import { createClient } from "@vercel/kv";

const url = process.env.allquiz_KV_REST_API_URL || process.env.KV_REST_API_URL || "";
const token = process.env.allquiz_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || "";

// In-memory fallback when KV is not configured
const memoryStore = new Map<string, { value: unknown; expiresAt?: number }>();

function cleanExpired() {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt && now > entry.expiresAt) {
      memoryStore.delete(key);
    }
  }
}

const memoryKv = {
  async get<T>(key: string): Promise<T | null> {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      memoryStore.delete(key);
      return null;
    }
    return entry.value as T;
  },
  async set(key: string, value: unknown) {
    memoryStore.set(key, { value });
  },
  async incr(key: string): Promise<number> {
    const current = ((await this.get<number>(key)) || 0) + 1;
    const entry = memoryStore.get(key);
    memoryStore.set(key, { value: current, expiresAt: entry?.expiresAt });
    return current;
  },
  async expire(key: string, seconds: number) {
    const entry = memoryStore.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000;
    }
  },
  async persist(key: string): Promise<number> {
    const entry = memoryStore.get(key);
    if (entry) {
      entry.expiresAt = undefined;
      return 1;
    }
    return 0;
  },
  async keys(pattern: string): Promise<string[]> {
    cleanExpired();
    const prefix = pattern.replace("*", "");
    return Array.from(memoryStore.keys()).filter(k => k.startsWith(prefix));
  },
  async mget<T>(...keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(k => this.get<T>(k)));
  },
  async del(key: string): Promise<number> {
    const existed = memoryStore.has(key);
    memoryStore.delete(key);
    return existed ? 1 : 0;
  },
};

type MemoryKv = typeof memoryKv;

let kv: ReturnType<typeof createClient> | MemoryKv;

if (url && token) {
  kv = createClient({ url, token });
} else {
  console.warn("KV not configured - using in-memory fallback (quota resets on redeploy)");
  kv = memoryKv;
}

export { kv };
