// Shared AI provider health check with caching
// Used by both /api/ai/health and /api/ai/chat for auto mode

export type ProviderId = "gemini" | "claude" | "openrouter";

export interface ProviderDetail {
  id: ProviderId;
  name: string;
  configured: boolean;
  online: boolean;
  latencyMs: number | null;
  credits: number | null;      // remaining paid credits (OpenRouter only)
  message: string;             // short human-readable status message (Thai)
  checkedAt: number;           // timestamp ms
}

interface HealthResult {
  gemini: boolean;
  claude: boolean;
  openrouter: boolean;
  openrouterCredits: number; // remaining credits on OpenRouter
  providers: ProviderDetail[];
}

let cachedResult: { data: HealthResult; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function timedFetch(url: string, init: RequestInit, timeoutMs: number): Promise<{ res: Response | null; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    return { res, latencyMs: Date.now() - start };
  } catch (err) {
    return { res: null, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkGemini(apiKey: string): Promise<{ ok: boolean; latency: number; msg: string }> {
  const { res, latencyMs, error } = await timedFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "hi" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    },
    8000
  );
  if (!res) return { ok: false, latency: latencyMs, msg: error || "เชื่อมต่อไม่สำเร็จ" };
  const ok = res.status === 200 || res.status === 400;
  return {
    ok,
    latency: latencyMs,
    msg: ok ? `ปกติ (HTTP ${res.status})` : `ผิดพลาด (HTTP ${res.status})`,
  };
}

async function checkClaude(apiKey: string): Promise<{ ok: boolean; latency: number; msg: string }> {
  const { res, latencyMs, error } = await timedFetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    },
    8000
  );
  if (!res) return { ok: false, latency: latencyMs, msg: error || "เชื่อมต่อไม่สำเร็จ" };
  const ok = res.status === 200 || res.status === 400;
  return {
    ok,
    latency: latencyMs,
    msg: ok ? `ปกติ (HTTP ${res.status})` : `ผิดพลาด (HTTP ${res.status})`,
  };
}

async function checkOpenRouter(apiKey: string): Promise<{ ok: boolean; credits: number; latency: number; msg: string }> {
  const { res, latencyMs, error } = await timedFetch(
    "https://openrouter.ai/api/v1/auth/key",
    { headers: { "Authorization": `Bearer ${apiKey}` } },
    5000
  );
  if (!res) return { ok: false, credits: 0, latency: latencyMs, msg: error || "เชื่อมต่อไม่สำเร็จ" };
  if (!res.ok) return { ok: false, credits: 0, latency: latencyMs, msg: `ผิดพลาด (HTTP ${res.status})` };
  try {
    const data = await res.json() as { data?: { limit_remaining?: number; usage?: number; limit?: number } };
    const remaining = data.data?.limit_remaining ?? 0;
    return { ok: true, credits: remaining, latency: latencyMs, msg: `ปกติ · คงเหลือ ${remaining.toFixed(3)} credits` };
  } catch {
    return { ok: true, credits: 0, latency: latencyMs, msg: "ปกติ แต่ไม่สามารถอ่านเครดิตได้" };
  }
}

export async function getProviderHealth(): Promise<HealthResult> {
  // Return cached if fresh
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
    return cachedResult.data;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const now = Date.now();

  const [geminiResult, claudeResult, orResult] = await Promise.all([
    geminiKey ? checkGemini(geminiKey) : Promise.resolve({ ok: false, latency: 0, msg: "ยังไม่ได้ตั้งค่า API Key" }),
    claudeKey ? checkClaude(claudeKey) : Promise.resolve({ ok: false, latency: 0, msg: "ยังไม่ได้ตั้งค่า API Key" }),
    openRouterKey ? checkOpenRouter(openRouterKey) : Promise.resolve({ ok: false, credits: 0, latency: 0, msg: "ยังไม่ได้ตั้งค่า API Key" }),
  ]);

  const providers: ProviderDetail[] = [
    {
      id: "gemini",
      name: "Google Gemini",
      configured: !!geminiKey,
      online: geminiResult.ok,
      latencyMs: geminiKey ? geminiResult.latency : null,
      credits: null,
      message: geminiResult.msg,
      checkedAt: now,
    },
    {
      id: "claude",
      name: "Anthropic Claude",
      configured: !!claudeKey,
      online: claudeResult.ok,
      latencyMs: claudeKey ? claudeResult.latency : null,
      credits: null,
      message: claudeResult.msg,
      checkedAt: now,
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      configured: !!openRouterKey,
      online: orResult.ok,
      latencyMs: openRouterKey ? orResult.latency : null,
      credits: openRouterKey ? orResult.credits : null,
      message: orResult.msg,
      checkedAt: now,
    },
  ];

  const result: HealthResult = {
    gemini: geminiResult.ok,
    claude: claudeResult.ok,
    openrouter: orResult.ok,
    openrouterCredits: orResult.credits,
    providers,
  };

  cachedResult = { data: result, timestamp: now };
  return result;
}

export function invalidateProviderHealthCache(): void {
  cachedResult = null;
}

// For use in auto mode: pick the best working model
export function pickAutoModel(
  health: HealthResult,
  isComplex: boolean,
  hasOpenRouterKey: boolean,
  hasGeminiKey: boolean,
  hasClaudeKey: boolean,
): string {
  // Strategy: prefer free models that actually work
  // OpenRouter has free models (gemini-2.5-flash, llama) even with 0 credits

  if (hasOpenRouterKey && health.openrouter) {
    if (isComplex) {
      // If OpenRouter has paid credits, use pro model
      if (health.openrouterCredits > 0.01) {
        return "openrouter/google/gemini-2.5-pro-preview";
      }
      // No paid credits — use free model even for complex tasks
      return "openrouter/google/gemini-2.5-flash";
    }
    return "openrouter/google/gemini-2.5-flash";
  }

  if (hasGeminiKey && health.gemini) {
    return isComplex ? "gemini-2.5-flash" : "gemini-2.5-flash";
  }

  if (hasClaudeKey && health.claude) {
    return "claude-sonnet";
  }

  // Nothing confirmed working — try OpenRouter free models as best effort
  if (hasOpenRouterKey) {
    return "openrouter/google/gemini-2.5-flash";
  }
  if (hasGeminiKey) {
    return "gemini-2.5-flash";
  }
  if (hasClaudeKey) {
    return "claude-sonnet";
  }

  return "gemini-2.5-flash"; // last resort
}
