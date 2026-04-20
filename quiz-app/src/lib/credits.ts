import { kv } from "@/lib/kv";

// Credit cost per model category
export const MODEL_CREDITS: Record<string, number> = {
  // Free models (0 credits — covered by daily free quota)
  "auto": 0,
  "gemini-2.5-flash": 0,
  "gemini-2.0-flash": 0,
  "openrouter/google/gemini-2.5-flash": 0,
  "openrouter/google/gemini-3-flash-preview": 0,
  "openrouter/meta-llama/llama-4-maverick": 0,
  "openrouter/meta-llama/llama-4-scout": 0,
  "thaillm/typhoon-v1.5x-70b-instruct": 0,
  "groq/llama-3.3-70b-versatile": 0,
  "groq/llama-3.1-8b-instant": 0,
  "github/gpt-4o": 0,
  "github/gpt-4o-mini": 0,
  "github/llama-3.3-70b-instruct": 0,

  // Standard models (1 credit)
  "claude-sonnet": 1,
  "openrouter/google/gemini-2.5-pro-preview": 1,
  "openrouter/openai/gpt-4.1-mini": 1,

  // Pro models (2 credits)
  "gemini-3.1-pro": 2,
  "openrouter/deepseek/deepseek-r1": 2,
  "openrouter/openai/gpt-4.1": 2,

  // Premium models (3 credits)
  "openrouter/openai/o4-mini": 3,

  // Image generation (5 credits)
  "__image_generation__": 5,
};

// Get credit cost for a model (default 1 for unknown models)
export function getModelCreditCost(model: string, isImageGen: boolean = false): number {
  if (isImageGen) return MODEL_CREDITS["__image_generation__"];
  return MODEL_CREDITS[model] ?? 1;
}

export function creditsKey(email: string) {
  return `ai_credits:${email}`;
}

function creditsLogKey(email: string) {
  return `ai_credits_log:${email}`;
}

export interface CreditLog {
  id: string;
  amount: number;
  type: "topup" | "usage" | "bonus" | "refund";
  description: string;
  model?: string;
  timestamp: number;
  balanceAfter: number;
}

export async function addCreditLog(email: string, entry: Omit<CreditLog, "id" | "timestamp">) {
  const logKey = creditsLogKey(email);
  const rawLogs = await kv.get(logKey);
  let logs: CreditLog[] = [];
  if (rawLogs) {
    logs = typeof rawLogs === "string" ? JSON.parse(rawLogs) : (rawLogs as CreditLog[]);
    if (!Array.isArray(logs)) logs = [];
  }

  logs.unshift({
    ...entry,
    id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  });

  // Keep last 100 entries
  if (logs.length > 100) logs = logs.slice(0, 100);
  await kv.set(logKey, JSON.stringify(logs));
}
