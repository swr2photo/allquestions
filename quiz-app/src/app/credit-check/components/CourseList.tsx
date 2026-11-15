"use client";

import { useState } from "react";
import { Ban, RotateCcw, Trash2 } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/checkbox";
import { GeBadge } from "@/components/ge-badge";
import {
  BUCKETS,
  BUCKET_META,
  SKIP_LABEL,
  isNonEarnedGrade,
  termOrder,
  type BucketChoice,
  type CheckedCourse,
} from "@/lib/credit-check";
import { UNKNOWN_TERM } from "@/lib/registration";
import { cn } from "@/lib/utils";

const BUCKET_OPTIONS: SelectOption<BucketChoice>[] = [
  { value: "ge", label: BUCKET_META.ge.short, description: BUCKET_META.ge.label },
  { value: "required", label: BUCKET_META.required.short, description: BUCKET_META.required.label },
  { value: "elective", label: BUCKET_META.elective.short, description: BUCKET_META.elective.label },
  { value: "free", label: BUCKET_META.free.short, description: BUCKET_META.free.label },
  { value: "none", label: "ไม่นับ", description: "ไม่นับเข้าโครงสร้างหลักสูตร" },
];

interface Props {
  courses: CheckedCourse[];
  excludedTerms: string[];
  onBucket: (base: string, bucket: BucketChoice, auto: BucketChoice) => void;
  onToggleExcluded: (key: string) => void;
  onToggleTerm: (term: string) => void;
  onRemove: (course: CheckedCourse) => void;
}

function CourseItemRow({
  c,
  showTerm,
  onBucket,
  onToggleExcluded,
  onRemove,
}: {
  c: CheckedCourse;
  showTerm: boolean;
  onBucket: Props["onBucket"];
  onToggleExcluded: Props["onToggleExcluded"];
  onRemove: Props["onRemove"];
}) {
  const dim = !!c.skip;
  const manualSkip = c.skip === "excluded";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
      <div className={cn("min-w-0 flex-1 basis-56", dim && "opacity-55")}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-mono text-xs font-semibold text-gray-900">{c.record.code}</span>
          <span className="text-xs font-semibold text-gray-600 tabular-nums">{c.record.credits} นก.</span>
          {showTerm && (
            <span className="text-[11px] text-gray-500">
              {c.record.term === UNKNOWN_TERM ? "ไม่ระบุภาค" : `ภาค ${c.record.term}`}
            </span>
          )}
          {c.record.grade && (
            <span
              className={cn(
                "rounded-md px-1.5 py-px font-mono text-[10px] font-semibold ring-1 ring-inset",
                isNonEarnedGrade(c.record.grade) || c.record.grade.trim().toUpperCase() === "AU"
                  ? "bg-red-50 text-red-700 ring-red-200"
                  : "bg-emerald-50 text-emerald-800 ring-emerald-200"
              )}
            >
              {c.record.grade}
            </span>
          )}
          {c.ge && c.bucket === "ge" && <GeBadge ge={c.ge} size="xs" />}
          {c.skip && (
            <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-medium text-gray-700">{SKIP_LABEL[c.skip]}</span>
          )}
          {!c.skip && c.guessed && (
            <span className="rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-900 ring-1 ring-amber-200 ring-inset">
              ระบบเดาหมวด — ตรวจอีกครั้ง
            </span>
          )}
          {c.overridden && (
            <span className="rounded-full bg-sky-50 px-1.5 py-px text-[10px] font-medium text-sky-800 ring-1 ring-sky-200 ring-inset">แก้หมวดเอง</span>
          )}
        </p>
        <p className="mt-0.5 text-sm leading-snug text-gray-800">{c.record.name}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Select<BucketChoice>
          size="sm"
          label={`หมวดของ ${c.record.code}`}
          value={c.bucket}
          options={BUCKET_OPTIONS}
          onChange={(v) => onBucket(c.base, v, c.auto)}
          className="w-[8.5rem]"
          align="end"
          searchable={false}
        />
        <button
          type="button"
          disabled={!!c.skip && !manualSkip}
          onClick={() => onToggleExcluded(c.key)}
          aria-pressed={manualSkip}
          title={manualSkip ? "กลับมานับวิชานี้" : "ไม่นับวิชานี้ (ติด F / ถอน W)"}
          aria-label={manualSkip ? `กลับมานับ ${c.record.code}` : `ไม่นับ ${c.record.code} (ติด F หรือถอน W)`}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl border outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-30",
            manualSkip ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          )}
        >
          {manualSkip ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => onRemove(c)}
          title="ลบรายการนี้"
          aria-label={`ลบ ${c.record.code} ออกจากประวัติ`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 outline-none hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

export function CourseList({ courses, excludedTerms, onBucket, onToggleExcluded, onToggleTerm, onRemove }: Props) {
  const [groupBy, setGroupBy] = useState<"term" | "bucket">("term");
  const terms = [...new Set(courses.map((c) => c.record.term))].sort((a, b) => termOrder(a) - termOrder(b));

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1" role="tablist" aria-label="การจัดกลุ่มรายวิชา">
        <button
          type="button"
          role="tab"
          aria-selected={groupBy === "term"}
          onClick={() => setGroupBy("term")}
          className={cn(
            "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
            groupBy === "term" ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
          )}
        >
          เรียงตามภาคการศึกษา
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={groupBy === "bucket"}
          onClick={() => setGroupBy("bucket")}
          className={cn(
            "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
            groupBy === "bucket" ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
          )}
        >
          จัดตามโครงสร้างหลักสูตร
        </button>
      </div>

      {groupBy === "term" &&
        terms.map((term) => {
          const list = courses.filter((c) => c.record.term === term).sort((a, b) => a.record.code.localeCompare(b.record.code));
          const off = excludedTerms.includes(term);
          const counted = list.filter((c) => !c.skip).reduce((a, c) => a + c.record.credits, 0);
          const registered = list.reduce((a, c) => a + c.record.credits, 0);
          return (
            <section key={term} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <header className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">{term === UNKNOWN_TERM ? "ไม่ระบุภาคการศึกษา" : `ภาคการศึกษา ${term}`}</h3>
                  <p className="text-xs text-gray-500 tabular-nums">
                    นับ {counted} จาก {registered} หน่วยกิต · {list.length} วิชา
                  </p>
                </div>
                <div className="w-auto shrink-0">
                  <Switch
                    checked={!off}
                    onChange={() => onToggleTerm(term)}
                    label={<span className="text-xs font-medium text-gray-600">นับภาคนี้</span>}
                    aria-label={`นับหน่วยกิตของภาค ${term}`}
                    className="w-auto"
                  />
                </div>
              </header>
              <ul className="divide-y divide-gray-100">
                {list.map((c) => (
                  <CourseItemRow
                    key={c.key}
                    c={c}
                    showTerm={false}
                    onBucket={onBucket}
                    onToggleExcluded={onToggleExcluded}
                    onRemove={onRemove}
                  />
                ))}
              </ul>
            </section>
          );
        })}

      {groupBy === "bucket" && (
        <>
          {BUCKETS.map((b) => {
            const list = courses
              .filter((c) => !c.skip && c.bucket === b)
              .sort((a, b2) => termOrder(a.record.term) - termOrder(b2.record.term) || a.record.code.localeCompare(b2.record.code));
            if (!list.length) return null;
            const totalCredits = list.reduce((a, c) => a + c.record.credits, 0);
            const meta = BUCKET_META[b];
            return (
              <section key={b} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <header className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{meta.label}</h3>
                  <p className="shrink-0 text-xs font-medium text-gray-600 tabular-nums">
                    {totalCredits} หน่วยกิต · {list.length} วิชา
                  </p>
                </header>
                <ul className="divide-y divide-gray-100">
                  {list.map((c) => (
                    <CourseItemRow
                      key={c.key}
                      c={c}
                      showTerm
                      onBucket={onBucket}
                      onToggleExcluded={onToggleExcluded}
                      onRemove={onRemove}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
          {(() => {
            const skipped = courses
              .filter((c) => !!c.skip)
              .sort((a, b2) => termOrder(a.record.term) - termOrder(b2.record.term) || a.record.code.localeCompare(b2.record.code));
            if (!skipped.length) return null;
            const totalCredits = skipped.reduce((a, c) => a + c.record.credits, 0);
            return (
              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <header className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
                  <h3 className="min-w-0 flex-1 text-sm font-semibold text-gray-700">รายวิชาที่ไม่ได้นับเข้าหน่วยกิต</h3>
                  <p className="shrink-0 text-xs font-medium text-gray-500 tabular-nums">
                    {totalCredits} หน่วยกิต · {skipped.length} วิชา
                  </p>
                </header>
                <ul className="divide-y divide-gray-100">
                  {skipped.map((c) => (
                    <CourseItemRow
                      key={c.key}
                      c={c}
                      showTerm
                      onBucket={onBucket}
                      onToggleExcluded={onToggleExcluded}
                      onRemove={onRemove}
                    />
                  ))}
                </ul>
              </section>
            );
          })()}
        </>
      )}
    </div>
  );
}
