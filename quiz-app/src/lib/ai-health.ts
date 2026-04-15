// Shared AI provider health check with caching
// Used by both /api/ai/health and /api/ai/chat for auto mode

interface HealthResult {
  gemini: boolean;
  claude: boolean;
  openrouter: boolean;
  openrouterCredits: number; // remaining credits on OpenRouter
}

let cachedResult: { data: HealthResult; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function checkGemini(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
        signal: AbortSignal.timeout(8000),
      }
    );
    return res.status === 200 || res.status === 400;
  } catch {
    return false;
  }
}

async function checkClaude(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
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
      signal: AbortSignal.timeout(8000),
    });
    return res.status === 200 || res.status === 400;
  } catch {
    return false;
  }
}

async function checkOpenRouter(apiKey: string): Promise<{ ok: boolean; credits: number }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, credits: 0 };
    const data = await res.json() as { data?: { limit_remaining?: number; usage?: number; limit?: number } };
    const remaining = data.data?.limit_remaining ?? 0;
    return { ok: true, credits: remaining };
  } catch {
    return { ok: false, credits: 0 };
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

  const [geminiOk, claudeOk, orResult] = await Promise.all([
    geminiKey ? checkGemini(geminiKey) : Promise.resolve(false),
    claudeKey ? checkClaude(claudeKey) : Promise.resolve(false),
    openRouterKey ? checkOpenRouter(openRouterKey) : Promise.resolve({ ok: false, credits: 0 }),
  ]);

  const result: HealthResult = {
    gemini: geminiOk,
    claude: claudeOk,
    openrouter: orResult.ok,
    openrouterCredits: orResult.credits,
  };

  cachedResult = { data: result, timestamp: Date.now() };
  return result;
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
