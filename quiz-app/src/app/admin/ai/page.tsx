"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Activity,
  Coins,
  Loader2,
  RotateCcw,
  Zap,
  Users,
} from "lucide-react";

interface ProviderRow {
  id: "gemini" | "claude" | "openrouter";
  name: string;
  configured: boolean;
  online: boolean;
  latencyMs: number | null;
  credits: number | null;
  message: string;
  checkedAt: number;
  calls: number;
  errors: number;
}

interface ModelRow {
  model: string;
  calls: number;
}

interface StatusResponse {
  providers: ProviderRow[];
  models: ModelRow[];
  usage: { activeUsers: number; totalRequests: number };
  cachedAt: number;
}

const PROVIDER_META: Record<ProviderRow["id"], { label: string; gradient: string; icon: string }> = {
  gemini: { label: "Google Gemini", gradient: "from-blue-500 to-sky-500", icon: "✦" },
  claude: { label: "Anthropic Claude", gradient: "from-orange-500 to-amber-500", icon: "◆" },
  openrouter: { label: "OpenRouter", gradient: "from-violet-500 to-fuchsia-500", icon: "⟟" },
};

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "เมื่อสักครู่";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} นาทีที่แล้ว`;
  return `${Math.floor(diff / 3_600_000)} ชั่วโมงที่แล้ว`;
}

export default function AdminAIManagementPage() {
  const router = useRouter();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const fetchStatus = useCallback(
    async (opts?: { force?: boolean }) => {
      try {
        if (opts?.force) setRefreshing(true);
        const res = await fetch(`/api/admin/ai/status${opts?.force ? "?refresh=1" : ""}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          router.push("/admin");
          return;
        }
        if (!res.ok) {
          showToast("โหลดสถานะไม่สำเร็จ", "err");
          return;
        }
        const json = (await res.json()) as StatusResponse;
        setData(json);
      } catch {
        showToast("เชื่อมต่อ API ไม่สำเร็จ", "err");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, showToast]
  );

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(), 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const resetCounters = async (provider?: ProviderRow["id"]) => {
    if (!confirm(provider ? `ล้างตัวนับของ ${PROVIDER_META[provider].label}?` : "ล้างตัวนับทั้งหมด?")) return;
    setResettingId(provider ?? "all");
    try {
      const q = provider ? `?provider=${provider}` : "";
      const res = await fetch(`/api/admin/ai/status${q}`, { method: "DELETE" });
      if (res.ok) {
        showToast("ล้างตัวนับเรียบร้อย", "ok");
        fetchStatus();
      } else {
        showToast("ล้างไม่สำเร็จ", "err");
      }
    } catch {
      showToast("เกิดข้อผิดพลาด", "err");
    } finally {
      setResettingId(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const providers = data?.providers ?? [];
  const onlineCount = providers.filter((p) => p.online).length;
  const configuredCount = providers.filter((p) => p.configured).length;
  const totalCalls = providers.reduce((s, p) => s + p.calls, 0);
  const totalErrors = providers.reduce((s, p) => s + p.errors, 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up ${
            toast.type === "ok" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">จัดการระบบ AI</h1>
            <p className="text-sm text-gray-500">
              ตรวจสอบสถานะ API ทั้งหมดและจำนวนการใช้งาน
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              กลับแผงควบคุม
            </Button>
          </Link>
          <Button
            size="sm"
            className="gap-1.5 bg-violet-600 hover:bg-violet-700"
            onClick={() => fetchStatus({ force: true })}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            ตรวจสอบทันที
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">
              {onlineCount}
              <span className="text-sm font-normal text-gray-400">/{providers.length}</span>
            </p>
            <p className="text-xs text-gray-500">API พร้อมใช้งาน</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{configuredCount}</p>
            <p className="text-xs text-gray-500">ตั้งค่า API Key แล้ว</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-violet-100 text-violet-600">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{totalCalls.toLocaleString()}</p>
            <p className="text-xs text-gray-500">
              เรียก API รวม{totalErrors > 0 ? ` · พลาด ${totalErrors}` : ""}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-100 text-amber-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{data?.usage.activeUsers ?? 0}</p>
            <p className="text-xs text-gray-500">
              ผู้ใช้วันนี้ · {data?.usage.totalRequests ?? 0} ครั้ง
            </p>
          </div>
        </div>
      </div>

      {/* Providers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">สถานะผู้ให้บริการ AI</h2>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-gray-500 gap-1.5"
            onClick={() => resetCounters()}
            disabled={resettingId === "all"}
          >
            {resettingId === "all" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            ล้างตัวนับทั้งหมด
          </Button>
        </div>

        {providers.map((p) => {
          const meta = PROVIDER_META[p.id];
          const status = !p.configured
            ? { text: "ยังไม่ได้ตั้งค่า", variant: "secondary" as const }
            : p.online
            ? { text: "ออนไลน์", variant: "success" as const }
            : { text: "ออฟไลน์", variant: "destructive" as const };

          return (
            <Card key={p.id} className="border-gray-200 overflow-hidden">
              <div className={`h-1.5 bg-linear-to-r ${meta.gradient}`} />
              <CardHeader className="py-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br ${meta.gradient} text-white shadow-md text-xl font-bold`}
                  >
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{meta.label}</CardTitle>
                      <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                        {status.text}
                      </Badge>
                      {!p.configured && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <CircleOff className="h-3 w-3" /> ไม่มี API Key
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{p.message}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 flex-wrap">
                      <span>Latency: <span className="text-gray-600 font-medium">{formatLatency(p.latencyMs)}</span></span>
                      <span>เรียกแล้ว: <span className="text-gray-600 font-medium">{p.calls.toLocaleString()}</span></span>
                      {p.errors > 0 && (
                        <span className="text-red-500">พลาด: {p.errors.toLocaleString()}</span>
                      )}
                      {p.credits !== null && (
                        <span className="flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          <span className="text-gray-600 font-medium">
                            {p.credits.toFixed(3)} credits
                          </span>
                        </span>
                      )}
                      <span className="text-gray-300">ตรวจล่าสุด {formatRelativeTime(p.checkedAt)}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-gray-500 gap-1.5"
                    onClick={() => resetCounters(p.id)}
                    disabled={resettingId === p.id}
                  >
                    {resettingId === p.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline">ล้าง</span>
                  </Button>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Top models */}
      {data && data.models.length > 0 && (
        <div className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            โมเดลที่ใช้งานบ่อย ({data.models.length})
          </h2>
          <Card className="border-gray-200">
            <CardContent className="py-4">
              <div className="divide-y divide-gray-100">
                {data.models.slice(0, 15).map((m, i) => {
                  const max = data.models[0]?.calls || 1;
                  const pct = Math.max(2, Math.round((m.calls / max) * 100));
                  return (
                    <div key={m.model} className="py-2 flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.model}</p>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-linear-to-r from-violet-400 to-fuchsia-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-violet-600 tabular-nums">
                        {m.calls.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-8">
        สถานะถูกแคชไว้ 5 นาทีเพื่อลดการเรียก API · ระบบจะตรวจสอบซ้ำอัตโนมัติทุก 1 นาที
      </p>
    </div>
  );
}
