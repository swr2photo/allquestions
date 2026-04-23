// Shared AI provider health check with caching
// Used by both /api/ai/health and /api/ai/chat for auto mode

export type ProviderId = "gemini" | "claude" | "openrouter" | "thaillm" | "groq" | "github";

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

export interface HealthResult {
  gemini: boolean;
  claude: boolean;
  openrouter: boolean;
  thaillm: boolean;
  groq: boolean;
  github: boolean;
  moonshot: boolean;
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
  
  if (res.status === 403) {
    const text = await res.text();
    if (text.includes("leaked")) return { ok: false, latency: latencyMs, msg: "API Key ถูกรายงานว่าหลุด (Leaked)" };
    return { ok: false, latency: latencyMs, msg: "ไม่มีสิทธิ์เข้าถึง (403)" };
  }
  
  const ok = res.status === 200;
  return {
    ok,
    latency: latencyMs,
    msg: ok ? `ปกติ` : `ผิดพลาด (HTTP ${res.status})`,
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
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    },
    8000
  );
  if (!res) return { ok: false, latency: latencyMs, msg: error || "เชื่อมต่อไม่สำเร็จ" };
  
  if (res.status === 400) {
    const data = await res.json().catch(() => ({}));
    if (data.error?.message?.includes("credit")) return { ok: false, latency: latencyMs, msg: "เครดิตใน Anthropic หมด" };
  }
  
  const ok = res.status === 200;
  return {
    ok,
    latency: latencyMs,
    msg: ok ? `ปกติ` : `ผิดพลาด (HTTP ${res.status})`,
  };
}

async function checkOpenRouter(apiKey: string): Promise<{ ok: boolean; credits: number; latency: number; msg: string }> {
  const { res, latencyMs, error } = await timedFetch(
    "https://openrouter.ai/api/v1/auth/key",
    { headers: { "Authorization": `Bearer ${apiKey}` } },
    10000
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

async function checkThaiLLM(apiKey: string): Promise<{ ok: boolean; latency: number; msg: string }> {
  const { res, latencyMs, error } = await timedFetch(
    "http://thaillm.or.th/api/openthaigpt/v1/chat/completions",
    { 
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": apiKey },
      body: JSON.stringify({ model: "/model", messages: [{role: "user", content: "hi"}], max_tokens: 1 })
    },
    10000
  );
  if (!res) return { ok: false, latency: latencyMs, msg: error || "เชื่อมต่อไม่สำเร็จ" };
  const ok = res.status === 200;
  return {
    ok,
    latency: latencyMs,
    msg: ok ? `ปกติ (HTTP ${res.status})` : `ผิดพลาด (HTTP ${res.status})`,
  };
}

async function checkGroq(apiKey: string): Promise<{ ok: boolean; latency: number; msg: string }> {
  const { res, latencyMs, error } = await timedFetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
    },
    8000
  );
  if (!res) return { ok: false, latency: latencyMs, msg: error || "เชื่อมต่อไม่สำเร็จ" };
  const ok = res.status === 200;
  return { ok, latency: latencyMs, msg: ok ? "ปกติ" : `ผิดพลาด (HTTP ${res.status})` };
}

async function checkGitHub(token: string): Promise<{ ok: boolean; latency: number; msg: string }> {
  const { res, latencyMs, error } = await timedFetch(
    "https://models.inference.ai.azure.com/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
    },
    8000
  );
  if (!res) return { ok: false, latency: latencyMs, msg: error || "เชื่อมต่อไม่สำเร็จ" };
  const ok = res.status === 200;
  return { ok, latency: latencyMs, msg: ok ? "ปกติ" : `ผิดพลาด (HTTP ${res.status})` };
}

async function checkMoonshot(apiKey: string): Promise<{ ok: boolean; latency: number; msg: string }> {
  const { res, latencyMs, error } = await timedFetch(
    "https://api.moonshot.ai/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "moonshot-v1-auto", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
    },
    8000
  );
  if (!res) return { ok: false, latency: latencyMs, msg: error || "เชื่อมต่อไม่สำเร็จ" };
  
  if (res.status === 401) {
    return { ok: false, latency: latencyMs, msg: "API Key ไม่ถูกต้อง (Unauthorized 401)" };
  }
  if (res.status === 403) {
    return { ok: false, latency: latencyMs, msg: "ไม่มีสิทธิ์เข้าถึงหรือยอดเงินหมด (403)" };
  }
  if (res.status === 429) {
    return { ok: true, latency: latencyMs, msg: "ปกติ (แต่ติด Rate Limit 429 ชั่วคราว)" };
  }
  
  const ok = res.status === 200;
  return { ok, latency: latencyMs, msg: ok ? "ปกติ" : `ผิดพลาด (HTTP ${res.status})` };
}

export async function getProviderHealth(): Promise<HealthResult> {
  // Return cached if fresh
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
    return cachedResult.data;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const thaillmKey = process.env.THAILLM_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const moonshotKey = process.env.MOONSHOT_API_KEY;
  const now = Date.now();

  const [geminiResult, claudeResult, orResult, thaillmResult, groqResult, githubResult, moonshotResult] = await Promise.all([
    geminiKey ? checkGemini(geminiKey) : Promise.resolve({ ok: false, latency: 0, msg: "ยังไม่ได้ตั้งค่า API Key" }),
    claudeKey ? checkClaude(claudeKey) : Promise.resolve({ ok: false, latency: 0, msg: "ยังไม่ได้ตั้งค่า API Key" }),
    openRouterKey ? checkOpenRouter(openRouterKey) : Promise.resolve({ ok: false, credits: 0, latency: 0, msg: "ยังไม่ได้ตั้งค่า API Key" }),
    thaillmKey ? checkThaiLLM(thaillmKey) : Promise.resolve({ ok: false, latency: 0, msg: "ยังไม่ได้ตั้งค่า API Key" }),
    groqKey ? checkGroq(groqKey) : Promise.resolve({ ok: false, latency: 0, msg: "ยังไม่ได้ตั้งค่า API Key" }),
    githubToken ? checkGitHub(githubToken) : Promise.resolve({ ok: false, latency: 0, msg: "ยังไม่ได้ตั้งค่า GitHub Token" }),
    moonshotKey ? checkMoonshot(moonshotKey) : Promise.resolve({ ok: false, latency: 0, msg: "ยังไม่ได้ตั้งค่า API Key" }),
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
    {
      id: "thaillm",
      name: "Thai LLM",
      configured: !!thaillmKey,
      online: thaillmResult.ok,
      latencyMs: thaillmKey ? thaillmResult.latency : null,
      credits: null,
      message: thaillmResult.msg,
      checkedAt: now,
    },
    {
      id: "groq",
      name: "Groq Cloud",
      configured: !!groqKey,
      online: groqResult.ok,
      latencyMs: groqKey ? groqResult.latency : null,
      credits: null,
      message: groqResult.msg,
      checkedAt: now,
    },
    {
      id: "github",
      name: "GitHub Models",
      configured: !!githubToken,
      online: githubResult.ok,
      latencyMs: githubToken ? githubResult.latency : null,
      credits: null,
      message: githubResult.msg,
      checkedAt: now,
    },
    {
      id: "moonshot",
      name: "Moonshot AI (Kimi)",
      configured: !!moonshotKey,
      online: moonshotResult.ok,
      latencyMs: moonshotKey ? moonshotResult.latency : null,
      credits: null,
      message: moonshotResult.msg,
      checkedAt: now,
    },
  ];

  const result: HealthResult = {
    gemini: geminiResult.ok,
    claude: claudeResult.ok,
    openrouter: orResult.ok,
    thaillm: thaillmResult.ok,
    groq: groqResult.ok,
    github: githubResult.ok,
    moonshot: moonshotResult.ok,
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
  hasThaiLLMKey: boolean,
  hasGroqKey: boolean = false,
  hasGitHubToken: boolean = false,
  hasMoonshotKey: boolean = false,
): string {
  // === STRATEGY: Prioritize FREE (0-credit) models first ===
  
  // 1. Gemini Flash (Direct) - Very fast, Free, and natively supports Files/Images
  if (hasGeminiKey && health.gemini) {
    return "gemini-2.0-flash";
  }

  // 2. ThaiLLM (Typhoon) - Excellent Thai support & Free
  if (hasThaiLLMKey && health.thaillm) {
    return "thaillm/typhoon-v1.5x-70b-instruct";
  }

  // 3. Groq (Llama 3) - Extremely fast
  if (hasGroqKey && health.groq) {
    return "groq/llama-3.3-70b-versatile";
  }

  // 4. GitHub Models (GPT-4o/Llama)
  if (hasGitHubToken && health.github) {
    return "github/gpt-4o";
  }

  // 5. Moonshot (Kimi)
  if (hasMoonshotKey && health.moonshot) {
    return "moonshot/moonshot-v1-auto";
  }

  // 6. OpenRouter Free Models
  if (hasOpenRouterKey && health.openrouter) {
    return "openrouter/google/gemini-2.0-flash";
  }

  // === STRATEGY: If no free models are online, then consider models with credits ===

  if (hasOpenRouterKey && health.openrouter) {
    if (isComplex && health.openrouterCredits > 0.01) {
      return "openrouter/google/gemini-2.5-pro-preview";
    }
    return "openrouter/google/gemini-2.0-flash";
  }

  if (hasClaudeKey && health.claude) {
    return "claude-sonnet";
  }

  // Fallback chain (Best effort)
  if (hasThaiLLMKey) return "thaillm/typhoon-v1.5x-70b-instruct";
  if (hasGroqKey) return "groq/llama-3.3-70b-versatile";
  if (hasGitHubToken) return "github/gpt-4o";
  if (hasMoonshotKey) return "moonshot/moonshot-v1-auto";
  if (hasGeminiKey) return "gemini-2.0-flash";
  if (hasOpenRouterKey) return "openrouter/google/gemini-2.0-flash";
  if (hasClaudeKey) return "claude-sonnet";

  return "gemini-2.0-flash"; // last resort
}

