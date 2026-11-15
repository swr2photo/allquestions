"use client";

import { Ban, RotateCcw, Trash2 } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/checkbox";
import { GeBadge } from "@/components/ge-badge";
import { BUCKET_META, termOrder, type BucketChoice, type CheckedCourse, type SkipReason } from "@/lib/credit-check";
import { UNKNOWN_TERM } from "@/lib/registration";
import { cn } from "@/lib/utils";

const BUCKET_OPTIONS: SelectOption<BucketChoice>[] = [
  { value: "ge", label: BUCKET_META.ge.short, description: BUCKET_META.ge.label },
  { value: "required", label: BUCKET_META.required.short, description: BUCKET_META.required.label },
  { value: "elective", label: BUCKET_META.elective.short, description: BUCKET_META.elective.label },
  { value: "free", label: BUCKET_META.free.short, description: BUCKET_META.free.label },
  { value: "none", label: "ไม่นับ", description: "ไม่นับเข้าโครงสร้างหลักสูตร" },
];

const SKIP_LABEL: Record<SkipReason, string> = {
  repeat: "ลงซ้ำ — นับครั้งล่าสุด",
  audit: "Audit ไม่นับหน่วยกิต",
  excluded: "ไม่นับ (F / W)",
  term: "ไม่นับภาคนี้",
  none: "ไม่นับ",
};

interface Props {
  courses: CheckedCourse[];
  excludedTerms: string[];
  onBucket: (base: string, bucket: BucketChoice, auto: BucketChoice) => void;
  onToggleExcluded: (key: string) => void;
  onToggleTerm: (term: string) => void;
  onRemove: (course: CheckedCourse) => void;
}

export function CourseList({ courses, excludedTerms, onBucket, onToggleExcluded, onToggleTerm, onRemove }: Props) {
  const terms = [...new Set(courses.map((c) => c.record.term))].sort((a, b) => termOrder(a) - termOrder(b));

  return (
    <div className="space-y-3">
      {terms.map((term) => {
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
              {list.map((c) => {
                const dim = !!c.skip;
                const manualSkip = c.skip === "excluded";
                return (
                  <li key={c.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
                    <div className={cn("min-w-0 flex-1 basis-56", dim && "opacity-55")}>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono text-xs font-semibold text-gray-900">{c.record.code}</span>
                        <span className="text-xs font-semibold text-gray-600 tabular-nums">{c.record.credits} นก.</span>
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
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
