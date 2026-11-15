"use client";

import { useState } from "react";
import { ChevronDown, CircleAlert, CircleCheck, PartyPopper } from "lucide-react";
import { GeIcon } from "@/components/ge-badge";
import { GE_META } from "@/lib/ge";
import { BUCKETS, BUCKET_META, type CreditSummary } from "@/lib/credit-check";
import { cn } from "@/lib/utils";

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
    >
      <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function SummaryPanel({ summary }: { summary: CreditSummary }) {
  const [showMissing, setShowMissing] = useState(false);
  const done = summary.remaining === 0;
  const requiredMissing = summary.missing.filter((m) => m.bucket === "required");
  const geMissing = summary.missing.filter((m) => m.bucket === "ge");
  const missingCredits = summary.missing.reduce((a, m) => a + m.credits, 0);

  return (
    <div className="space-y-4">
      {/* overall */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-xs font-medium text-gray-500">นับเข้าโครงสร้างหลักสูตรได้</p>
            <p className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight text-gray-900 tabular-nums">{summary.counted}</span>
              <span className="text-base font-medium text-gray-500 tabular-nums">/ {summary.total} หน่วยกิต</span>
            </p>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold",
              done ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
            )}
          >
            {done ? <PartyPopper className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
            {done ? "หน่วยกิตครบตามโครงสร้างแล้ว" : `ขาดอีก ${summary.remaining} หน่วยกิต`}
          </div>
        </div>

        {/* stacked bar: one segment per หมวด, widths proportional to the requirement */}
        <div className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {BUCKETS.map((b) => {
            const s = summary.buckets[b];
            if (!s.need) return null;
            return (
              <div key={b} className="h-full bg-gray-100" style={{ width: `${(s.need / summary.total) * 100}%` }}>
                <div className="h-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(s.counted / s.need) * 100}%`, background: BUCKET_META[b].color }} />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          ลงทะเบียนและนับทั้งหมด {summary.earned} หน่วยกิต
          {summary.earned > summary.counted && ` — ${summary.earned - summary.counted} หน่วยกิตเกินเกณฑ์ของหมวด จึงไม่ช่วยลดส่วนที่ขาด`}
        </p>
      </div>

      {/* per หมวด */}
      <div className="grid gap-3 sm:grid-cols-2">
        {BUCKETS.map((b) => {
          const s = summary.buckets[b];
          const meta = BUCKET_META[b];
          const have = s.earned + s.overflowIn;
          const ok = have >= s.need;
          return (
            <div key={b} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
                  <h3 className="truncate text-sm font-semibold text-gray-900">{meta.label}</h3>
                </div>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
                  )}
                >
                  {ok ? <CircleCheck className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
                  {ok ? "ครบ" : `ขาด ${s.need - have}`}
                </span>
              </div>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900 tabular-nums">{have}</span>
                <span className="text-sm text-gray-500 tabular-nums">/ {s.need} หน่วยกิต</span>
              </p>
              <div className="mt-2">
                <Bar value={have} max={s.need} color={meta.color} label={meta.label} />
              </div>
              {s.overflowIn > 0 && (
                <p className="mt-2 text-[11px] text-gray-500">รวม {s.overflowIn} หน่วยกิตส่วนเกินจาก GE / วิชาเลือกเฉพาะ ที่นับเป็นเลือกเสรีได้</p>
              )}
              {b !== "free" && s.earned > s.need && (
                <p className="mt-2 text-[11px] text-gray-500">
                  เกินเกณฑ์ {s.earned - s.need} หน่วยกิต{b === "required" ? "" : " — ย้ายไปนับเป็นเลือกเสรี"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* GE by area (โครงสร้าง GE1–GE8) */}
      {summary.geAreas.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">ศึกษาทั่วไปรายสาระ</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            เกณฑ์ขั้นต่ำตามโครงสร้าง GE 2567 ของมหาวิทยาลัย (บังคับ GE1–GE7 รวม 18 นก. + GE8 เลือก {summary.geAreas.find((a) => a.area === "GE8")?.need ?? 6} นก.) — วิชาที่ระบบไม่รู้สาระจะไม่ปรากฏที่นี่
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summary.geAreas.map(({ area, earned, need, sub }) => {
              const ok = earned >= need && (!sub || sub.every((s) => s.earned >= s.need));
              return (
                <div key={area} className={cn("rounded-xl border px-3 py-2", ok ? "border-emerald-200 bg-emerald-50/50" : "border-gray-200 bg-white")}>
                  <div className="flex items-center gap-1.5">
                    <GeIcon ge={area} className={cn("h-4 w-4", ok ? "text-emerald-700" : "text-gray-500")} />
                    <span className="text-xs font-bold text-gray-900">{area}</span>
                    <span className={cn("ml-auto text-xs font-semibold tabular-nums", ok ? "text-emerald-800" : "text-amber-800")}>
                      {earned}/{need}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">{GE_META[area].short}</p>
                  {sub && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {sub.map((s) => {
                        const subOk = s.earned >= s.need;
                        return (
                          <span
                            key={s.key}
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                              subOk ? "bg-emerald-100/80 text-emerald-800" : "bg-amber-50 text-amber-800"
                            )}
                          >
                            <span>{s.short}</span>
                            <span>{s.earned}/{s.need}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* courses in the study plan that are not in the history yet */}
      {summary.missing.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <button
            type="button"
            aria-expanded={showMissing}
            onClick={() => setShowMissing((v) => !v)}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-gray-900">วิชาในแผนการศึกษาที่ยังไม่ได้ลง</h3>
              <p className="text-xs text-gray-500">
                {summary.missing.length} วิชา · {missingCredits} หน่วยกิต
                {summary.planIncomplete && " (รายชื่อในระบบยังไม่ครบ อาจมีวิชาบังคับอื่นอีก)"}
              </p>
            </div>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-gray-400 transition-transform", showMissing && "rotate-180")} />
          </button>
          {showMissing && (
            <div className="space-y-3 border-t border-gray-100 px-4 py-3">
              {[
                { title: "วิชาเฉพาะ (พื้นฐาน / บังคับ)", list: requiredMissing },
                { title: "ศึกษาทั่วไปที่แผนระบุรหัส", list: geMissing },
              ]
                .filter((g) => g.list.length)
                .map((g) => (
                  <div key={g.title}>
                    <p className="mb-1 text-xs font-semibold text-gray-700">{g.title}</p>
                    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                      {g.list.map((m) => (
                        <li key={m.code} className="flex items-start gap-3 px-3 py-2 text-sm">
                          <span className="mt-0.5 min-w-[4.5rem] shrink-0 font-mono text-xs font-semibold text-gray-900">{m.code}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-gray-700">{m.name}</p>
                            {m.note && <p className="mt-0.5 text-[11px] text-amber-700">{m.note}</p>}
                          </div>
                          <span className="mt-0.5 shrink-0 text-[11px] text-gray-500">
                            ปี {m.year}/{m.term}
                          </span>
                          <span className="mt-0.5 w-10 shrink-0 text-right text-xs font-semibold text-gray-900 tabular-nums">{m.credits} นก.</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
