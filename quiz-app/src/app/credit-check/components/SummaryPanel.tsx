"use client";

import { useState } from "react";
import { ChevronDown, CircleAlert, CircleCheck, Layers, PartyPopper } from "lucide-react";
import { GeBadge, GeIcon } from "@/components/ge-badge";
import { GE_META } from "@/lib/ge";
import {
  BUCKETS,
  BUCKET_META,
  SKIP_LABEL,
  isNonEarnedGrade,
  termOrder,
  type Bucket,
  type CheckedCourse,
  type CreditSummary,
} from "@/lib/credit-check";
import { UNKNOWN_TERM } from "@/lib/registration";
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

function sourceTag(c: CheckedCourse): { label: string; tone: string } | null {
  if (c.overridden) return { label: "แก้หมวดเอง", tone: "bg-sky-50 text-sky-800 ring-sky-200" };
  if (c.guessed) return { label: "ระบบเดาหมวด", tone: "bg-amber-50 text-amber-900 ring-amber-200" };
  if (c.bucket === "required" && c.inPlan) return { label: "ในแผนหลักสูตร", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200" };
  if (c.bucket === "elective" && c.inElectiveCatalog) return { label: "เลือกในหลักสูตร", tone: "bg-violet-50 text-violet-800 ring-violet-200" };
  return null;
}

function BucketCourseSection({ b, summary }: { b: Bucket; summary: CreditSummary }) {
  const meta = BUCKET_META[b];
  const s = summary.buckets[b];
  const list = summary.courses
    .filter((c) => !c.skip && c.bucket === b)
    .sort((a, b2) => termOrder(a.record.term) - termOrder(b2.record.term) || a.record.code.localeCompare(b2.record.code));
  const { basicNeed, majorRequiredNeed, extraNeed, geOverflow, electiveOverflow } = summary.breakdown;
  const planCredits = list.filter((c) => c.inPlan).reduce((acc, c) => acc + c.record.credits, 0);
  const nonPlanCredits = s.earned - planCredits;
  const missingInBucket = summary.missing.filter((m) => m.bucket === b);
  const missingCr = missingInBucket.reduce((acc, m) => acc + m.credits, 0);

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
          <h4 className="text-sm font-semibold text-gray-900">{meta.label}</h4>
        </div>
        <span className="text-xs font-semibold text-gray-700 tabular-nums">
          นับตามโครงสร้าง {s.counted} / {s.need} นก. · {list.length} วิชา
        </span>
      </div>

      <p className="text-xs leading-relaxed text-gray-600">
        {b === "required" && (
          <>
            เกณฑ์โครงสร้าง {s.need} นก. (พื้นฐาน {basicNeed} + เอกบังคับ {majorRequiredNeed}
            {extraNeed > 0 ? ` + อื่น ๆ ${extraNeed}` : ""}) · ลงผ่านแล้ว {s.earned} นก.
            {planCredits > 0 && ` (ตรงตามแผน ${planCredits} นก.`}
            {planCredits > 0 && nonPlanCredits > 0 && ` · นอกแผน/จัดหมวดเพิ่ม ${nonPlanCredits} นก.`}
            {planCredits > 0 && ")"}
            {s.need > s.earned && ` — ยังขาดอีก ${s.need - s.earned} นก.`}
          </>
        )}
        {b === "ge" && (
          <>
            เกณฑ์โครงสร้าง {s.need} นก. · ลงผ่านแล้ว {s.earned} นก. · นับเข้าหมวด GE {s.counted} นก.
            {geOverflow > 0 && ` · เกินเกณฑ์ ${geOverflow} นก. (ย้ายไปนับเป็นเลือกเสรี)`}
          </>
        )}
        {b === "elective" && (
          <>
            เกณฑ์โครงสร้าง {s.need} นก. · ลงผ่านแล้ว {s.earned} นก. · นับเข้าหมวดวิชาเลือก {s.counted} นก.
            {electiveOverflow > 0 && ` · เกินเกณฑ์ ${electiveOverflow} นก. (ย้ายไปนับเป็นเลือกเสรี)`}
          </>
        )}
        {b === "free" && (
          <>
            เกณฑ์โครงสร้าง {s.need} นก. · ลงในหมวดเสรีโดยตรง {s.earned} นก.
            {geOverflow > 0 && ` + ส่วนเกิน GE ${geOverflow} นก.`}
            {electiveOverflow > 0 && ` + ส่วนเกินวิชาเลือก ${electiveOverflow} นก.`}
            {` = ${s.earned + s.overflowIn} นก.`} · นับเข้าโครงสร้างได้ {s.counted} นก.
            {s.earned + s.overflowIn > s.need && ` (เกินอีก ${s.earned + s.overflowIn - s.need} นก. ไม่นับเข้าเกณฑ์รวม)`}
          </>
        )}
      </p>

      {list.length > 0 ? (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {list.map((c) => {
            const tag = sourceTag(c);
            const badGrade = c.record.grade && (isNonEarnedGrade(c.record.grade) || c.record.grade.trim().toUpperCase() === "AU");
            return (
              <li key={c.key} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2 text-xs">
                <span className="min-w-[4.75rem] shrink-0 font-mono font-semibold text-gray-900">{c.record.code}</span>
                <div className="min-w-0 flex-1 basis-48">
                  <span className="text-sm text-gray-800">{c.record.name}</span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-gray-500">
                      {c.record.term === UNKNOWN_TERM ? "ไม่ระบุภาค" : `ภาค ${c.record.term}`}
                    </span>
                    {c.record.grade && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-px font-mono text-[10px] font-semibold ring-1 ring-inset",
                          badGrade ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"
                        )}
                      >
                        {c.record.grade}
                      </span>
                    )}
                    {c.ge && c.bucket === "ge" && <GeBadge ge={c.ge} size="xs" />}
                    {tag && <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium ring-1 ring-inset", tag.tone)}>{tag.label}</span>}
                  </div>
                </div>
                <span className="shrink-0 font-semibold text-gray-900 tabular-nums">{c.record.credits} นก.</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-500">
          {b === "free" && s.overflowIn > 0
            ? `ยังไม่มีรายวิชาที่จัดเข้าเลือกเสรีโดยตรง — ใช้หน่วยกิตส่วนเกิน ${s.overflowIn} นก. จาก GE / วิชาเลือกเฉพาะ`
            : "ยังไม่มีรายวิชาที่นับในหมวดนี้"}
        </p>
      )}

      {missingInBucket.length > 0 && (
        <p className="text-[11px] text-amber-800">
          ยังขาดรายวิชาในแผนของหมวดนี้ {missingInBucket.length} วิชา ({missingCr} นก.):{" "}
          {missingInBucket.map((m) => `${m.code} (${m.credits})`).join(", ")}
        </p>
      )}
    </div>
  );
}

export function SummaryPanel({ summary }: { summary: CreditSummary }) {
  const [showMissing, setShowMissing] = useState(false);
  const [activeBucket, setActiveBucket] = useState<Bucket | "all" | null>(null);
  const done = summary.remaining === 0;
  const requiredMissing = summary.missing.filter((m) => m.bucket === "required");
  const geMissing = summary.missing.filter((m) => m.bucket === "ge");
  const missingCredits = summary.missing.reduce((a, m) => a + m.credits, 0);
  const skippedCourses = summary.courses.filter((c) => !!c.skip);
  const countedCount = summary.courses.filter((c) => !c.skip).length;
  const { basicNeed, majorRequiredNeed, extraNeed, geOverflow, electiveOverflow } = summary.breakdown;

  const toggleBucket = (b: Bucket | "all") => {
    setActiveBucket((prev) => (prev === b ? null : b));
  };

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
          ลงทะเบียนและนับทั้งหมด {summary.earned} หน่วยกิต ({countedCount} วิชา)
          {summary.earned > summary.counted && ` — ${summary.earned - summary.counted} หน่วยกิตเกินเกณฑ์ของหมวด จึงไม่ช่วยลดส่วนที่ขาด`}
        </p>

        {/* สรุปเทียบโครงสร้างหลักสูตรรายหมวด (กดดูรายวิชาในหมวดได้) */}
        <div className="mt-3 overflow-hidden rounded-xl border border-gray-100">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-500">
            <span>หมวดตามโครงสร้าง</span>
            <span className="text-right">ลงผ่าน</span>
            <span className="text-right">นับเข้าเกณฑ์</span>
            <span className="w-16 text-right">สถานะ</span>
          </div>
          <div className="divide-y divide-gray-100">
            {BUCKETS.map((b) => {
              const s = summary.buckets[b];
              const meta = BUCKET_META[b];
              const have = s.earned + s.overflowIn;
              const ok = have >= s.need;
              const subText =
                b === "required"
                  ? `พื้นฐาน ${basicNeed} + เอกบังคับ ${majorRequiredNeed}${extraNeed > 0 ? ` + อื่น ๆ ${extraNeed}` : ""}`
                  : b === "free" && s.overflowIn > 0
                    ? `ลงตรง ${s.earned} + เกิน ${s.overflowIn} (GE ${geOverflow}, เลือก ${electiveOverflow})`
                    : b !== "free" && s.earned > s.need
                      ? `เกิน ${s.earned - s.need} → ย้ายไปเลือกเสรี`
                      : null;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggleBucket(b)}
                  aria-expanded={activeBucket === b}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 px-3 py-2 text-left text-xs transition-colors hover:bg-gray-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                    activeBucket === b && "bg-emerald-50/40"
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium text-gray-900">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
                      <span className="truncate">{meta.label}</span>
                    </span>
                    {subText && <span className="mt-0.5 block pl-3.5 text-[11px] text-gray-500">{subText}</span>}
                  </span>
                  <span className="text-right font-medium text-gray-700 tabular-nums">{have} นก.</span>
                  <span className="text-right font-semibold text-gray-900 tabular-nums">
                    {s.counted} / {s.need}
                  </span>
                  <span
                    className={cn(
                      "w-16 text-right font-semibold tabular-nums",
                      ok ? "text-emerald-700" : "text-amber-800"
                    )}
                  >
                    {ok ? "ครบ" : `ขาด ${s.need - have}`}
                  </span>
                </button>
              );
            })}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 bg-gray-50/70 px-3 py-2 text-xs font-semibold text-gray-900">
              <span>รวมทั้งหลักสูตร</span>
              <span className="text-right tabular-nums">{summary.earned} นก.</span>
              <span className="text-right tabular-nums">
                {summary.counted} / {summary.total}
              </span>
              <span className={cn("w-16 text-right tabular-nums", done ? "text-emerald-700" : "text-amber-800")}>
                {done ? "ครบ" : `ขาด ${summary.remaining}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* per หมวด (กดที่การ์ดเพื่อดูรายละเอียดรายวิชาในหมวดนั้น) */}
      <div className="grid gap-3 sm:grid-cols-2">
        {BUCKETS.map((b) => {
          const s = summary.buckets[b];
          const meta = BUCKET_META[b];
          const have = s.earned + s.overflowIn;
          const ok = have >= s.need;
          const open = activeBucket === b;
          const courseCount = summary.courses.filter((c) => !c.skip && c.bucket === b).length;
          return (
            <button
              key={b}
              type="button"
              onClick={() => toggleBucket(b)}
              aria-expanded={open}
              className={cn(
                "rounded-2xl border bg-white p-4 text-left transition-colors outline-none hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                open ? "border-emerald-400 ring-1 ring-emerald-200" : "border-gray-200"
              )}
            >
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
                <p className="mt-2 text-[11px] text-gray-500">
                  ลงตรง {s.earned} นก. + ส่วนเกินจาก GE / วิชาเลือก {s.overflowIn} นก.
                </p>
              )}
              {b !== "free" && s.earned > s.need && (
                <p className="mt-2 text-[11px] text-gray-500">
                  เกินเกณฑ์ {s.earned - s.need} หน่วยกิต{b === "required" ? "" : " — ย้ายไปนับเป็นเลือกเสรี"}
                </p>
              )}
              <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2 text-[11px] font-medium text-emerald-700">
                <span>
                  ดูรายละเอียด ({courseCount} วิชา · นับตามเกณฑ์ {s.counted}/{s.need} นก.)
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
              </div>
            </button>
          );
        })}
      </div>

      {/* รายละเอียดรายวิชาที่ลงตามโครงสร้างหลักสูตร */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <button
          type="button"
          aria-expanded={activeBucket !== null}
          onClick={() => toggleBucket("all")}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <Layers className="h-4 w-4 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900">รายละเอียดรายวิชาที่ลงตามโครงสร้างหลักสูตร</h3>
            <p className="text-xs text-gray-500">
              แสดงรายวิชาที่ลงและผ่านแยกตามหมวด ({countedCount} วิชา · นับเข้าโครงสร้าง {summary.counted}/{summary.total} นก.
              {skippedCourses.length > 0 ? ` · ไม่นับรวม ${skippedCourses.length} วิชา` : ""})
            </p>
          </div>
          <ChevronDown className={cn("h-5 w-5 shrink-0 text-gray-400 transition-transform", activeBucket !== null && "rotate-180")} />
        </button>

        {activeBucket !== null && (
          <div className="space-y-3 border-t border-gray-100 px-4 py-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="เลือกดูตามหมวดโครงสร้างหลักสูตร">
              <button
                type="button"
                role="tab"
                aria-selected={activeBucket === "all"}
                onClick={() => setActiveBucket("all")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  activeBucket === "all" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                ทุกหมวด ({countedCount})
              </button>
              {BUCKETS.map((b) => {
                const cnt = summary.courses.filter((c) => !c.skip && c.bucket === b).length;
                const s = summary.buckets[b];
                return (
                  <button
                    key={b}
                    type="button"
                    role="tab"
                    aria-selected={activeBucket === b}
                    onClick={() => setActiveBucket(b)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                      activeBucket === b ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {BUCKET_META[b].short} ({s.counted}/{s.need} · {cnt})
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              {(activeBucket === "all" ? BUCKETS : [activeBucket]).map((b) => (
                <BucketCourseSection key={b} b={b} summary={summary} />
              ))}
            </div>

            {skippedCourses.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                <p className="mb-1.5 text-xs font-semibold text-gray-700">รายวิชาที่ไม่ได้นับเข้าหน่วยกิต ({skippedCourses.length} วิชา)</p>
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                  {skippedCourses.map((c) => (
                    <li key={c.key} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-1.5 text-xs text-gray-600">
                      <span className="min-w-[4.75rem] font-mono font-semibold text-gray-800">{c.record.code}</span>
                      <span className="min-w-0 flex-1 truncate">{c.record.name}</span>
                      <span className="text-[11px] text-gray-500">ภาค {c.record.term}</span>
                      {c.record.grade && <span className="rounded bg-gray-100 px-1.5 py-px font-mono text-[10px] font-semibold">{c.record.grade}</span>}
                      {c.skip && <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-medium text-gray-700">{SKIP_LABEL[c.skip]}</span>}
                      <span className="font-medium tabular-nums">{c.record.credits} นก.</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
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
