// Lightweight per-provider/model usage counters backed by KV.
// Used by admin AI management page to display request volume per API.

import { kv } from "@/lib/kv";
import type { ProviderId } from "@/lib/ai-health";

const PROVIDER_PREFIX = "ai_provider_calls:";
const MODEL_PREFIX = "ai_model_calls:";
const ERROR_PREFIX = "ai_provider_errors:";

export function resolveProvider(model: string): ProviderId {
  if (model.startsWith("openrouter/")) return "openrouter";
  if (model.startsWith("claude-")) return "claude";
  return "gemini";
}

/** Record one call for a model. Also increments a provider-level counter. */
export async function recordAiCall(model: string, ok: boolean): Promise<void> {
  const provider = resolveProvider(model);
  try {
    await Promise.all([
      kv.incr(`${PROVIDER_PREFIX}${provider}`),
      kv.incr(`${MODEL_PREFIX}${model}`),
      ok ? Promise.resolve(0) : kv.incr(`${ERROR_PREFIX}${provider}`),
    ]);
  } catch {
    // counters are best-effort
  }
}

export interface ProviderStats {
  provider: ProviderId;
  calls: number;
  errors: number;
}

export async function getProviderStats(): Promise<ProviderStats[]> {
  const providers: ProviderId[] = ["gemini", "claude", "openrouter"];
  return Promise.all(
    providers.map(async (p) => {
      const [calls, errors] = await Promise.all([
        kv.get<number>(`${PROVIDER_PREFIX}${p}`).catch(() => 0),
        kv.get<number>(`${ERROR_PREFIX}${p}`).catch(() => 0),
      ]);
      return {
        provider: p,
        calls: Number(calls) || 0,
        errors: Number(errors) || 0,
      };
    })
  );
}

export interface ModelStats {
  model: string;
  calls: number;
}

export async function getModelStats(): Promise<ModelStats[]> {
  try {
    const keys = await kv.keys(`${MODEL_PREFIX}*`);
    if (!keys || keys.length === 0) return [];
    const stats = await Promise.all(
      keys.map(async (key) => ({
        model: key.replace(MODEL_PREFIX, ""),
        calls: Number(await kv.get<number>(key)) || 0,
      }))
    );
    stats.sort((a, b) => b.calls - a.calls);
    return stats;
  } catch {
    return [];
  }
}

export async function resetProviderStats(provider: ProviderId): Promise<void> {
  await Promise.all([
    kv.del(`${PROVIDER_PREFIX}${provider}`),
    kv.del(`${ERROR_PREFIX}${provider}`),
  ]);
}

export async function resetAllStats(): Promise<void> {
  const providers: ProviderId[] = ["gemini", "claude", "openrouter"];
  await Promise.all(providers.map(resetProviderStats));
  try {
    const modelKeys = await kv.keys(`${MODEL_PREFIX}*`);
    await Promise.all(modelKeys.map((k) => kv.del(k)));
  } catch {
    // ignore
  }
}
