import { NextRequest, NextResponse } from "next/server";
import { isValidSession } from "@/lib/admin-store";
import { getProviderHealth, invalidateProviderHealthCache, type ProviderDetail } from "@/lib/ai-health";
import { getProviderStats, getModelStats, resetAllStats, resetProviderStats, type ProviderStats } from "@/lib/ai-stats";
import { kv } from "@/lib/kv";

export const dynamic = "force-dynamic";

// Summary of AI usage across all users
async function getTotalUsage(): Promise<{ activeUsers: number; totalRequests: number }> {
  try {
    const keys = await kv.keys("ai_usage:*");
    if (!keys || keys.length === 0) return { activeUsers: 0, totalRequests: 0 };
    const values = await Promise.all(keys.map((k) => kv.get<number>(k).catch(() => 0)));
    const totalRequests = values.reduce<number>((acc, v) => acc + (Number(v) || 0), 0);
    return { activeUsers: keys.length, totalRequests };
  } catch {
    return { activeUsers: 0, totalRequests: 0 };
  }
}

// GET — return full AI status snapshot for admin
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("refresh") === "1") {
    invalidateProviderHealthCache();
  }

  const [health, providerStats, modelStats, usage] = await Promise.all([
    getProviderHealth(),
    getProviderStats(),
    getModelStats(),
    getTotalUsage(),
  ]);

  // Merge stats into provider details
  const statsMap = new Map<string, ProviderStats>();
  providerStats.forEach((s) => statsMap.set(s.provider, s));

  const providers = health.providers.map((p: ProviderDetail) => {
    const s = statsMap.get(p.id);
    return {
      ...p,
      calls: s?.calls ?? 0,
      errors: s?.errors ?? 0,
    };
  });

  return NextResponse.json({
    providers,
    models: modelStats.slice(0, 30),
    usage,
    cachedAt: Date.now(),
  });
}

// DELETE — reset provider call counters (?provider=xxx or all)
export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  try {
    if (provider === "gemini" || provider === "claude" || provider === "openrouter") {
      await resetProviderStats(provider);
    } else {
      await resetAllStats();
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
  }
}
