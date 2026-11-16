"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Ban, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select";
import { Segmented, Switch } from "@/components/ui/checkbox";
import { GeBadge } from "@/components/ge-badge";
import { normalizeQuery } from "@/lib/timetable";
import {
  BUCKETS,
  BUCKET_META,
  SKIP_LABEL,
  isNonEarnedGrade,
  type BucketChoice,
  type CheckedCourse,
  type CreditSummary,
  type OverflowCourse,
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

type Filter = "all" | "review" | "skipped";

interface Props {
  summary: CreditSummary;
  onBucket: (base: string, bucket: BucketChoice, auto: BucketChoice) => void;
  onToggleExcluded: (key: string) => void;
  onToggleTerm: (term: string) => void;
  onRemove: (course: CheckedCourse) => void;
}

const CHIP = "rounded-full px-1.5 py-px text-[10px] font-medium ring-1 ring-inset";

function CourseItemRow({
  c,
  showTerm,
  spill,
  overflowEntry,
  onBucket,
  onToggleExcluded,
  onRemove,
}: {
  c: CheckedCourse;
  showTerm: boolean;
  spill?: OverflowCourse;
  overflowEntry?: OverflowCourse;
  onBucket: Props["onBucket"];
  onToggleExcluded: Props["onToggleExcluded"];
  onRemove: Props["onRemove"];
}) {
  const dim = !!c.skip;
  const manualSkip = c.skip === "excluded";
  const grade = c.record.grade;
  const creditLabel = overflowEntry
    ? overflowEntry.credits < c.record.credits
      ? `ปัดมา ${overflowEntry.credits}/${c.record.credits} นก.`
      : `${overflowEntry.credits} นก.`
    : `${c.record.credits} นก.`;
  const stripe = c.skip || c.bucket === "none" ? "#d1d5db" : BUCKET_META[overflowEntry ? "free" : c.bucket].color;
  return (
    <li className="relative flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 pr-3 pl-5 sm:pr-4">
      <span className="absolute top-2.5 bottom-2.5 left-2 w-1 rounded-full" style={{ background: stripe }} aria-hidden />
      <div className={cn("min-w-0 flex-1 basis-56", dim && "opacity-55")}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs font-semibold text-gray-900">{c.record.code}</span>
          <span className="text-xs font-semibold text-gray-600 tabular-nums">{creditLabel}</span>
          {showTerm && <span className="text-[11px] text-gray-500">{c.record.term === UNKNOWN_TERM ? "ไม่ระบุภาค" : `ภาค ${c.record.term}`}</span>}
          {grade && (
            <span
              className={cn(
                "rounded-md px-1.5 py-px font-mono text-[10px] font-semibold ring-1 ring-inset",
                isNonEarnedGrade(grade) || grade.trim().toUpperCase() === "AU"
                  ? "bg-red-50 text-red-700 ring-red-200"
                  : "bg-emerald-50 text-emerald-800 ring-emerald-200"
              )}
            >
              {grade}
            </span>
          )}
          {c.pending && <span className={cn(CHIP, "bg-gray-50 text-gray-700 ring-gray-200")}>ยังไม่มีเกรด</span>}
          {c.ge && c.bucket === "ge" && <GeBadge ge={c.ge} size="xs" />}
          {c.skip && <span className={cn(CHIP, "bg-gray-100 text-gray-700 ring-gray-200")}>{SKIP_LABEL[c.skip]}</span>}
          {!c.skip && overflowEntry && (
            <span className={cn(CHIP, "bg-orange-50 text-orange-800 ring-orange-200")}>
              {overflowEntry.from === "ge" ? "ปัดจากศึกษาทั่วไป" : "ปัดจากเฉพาะเลือก"}
            </span>
          )}
          {!c.skip && !overflowEntry && spill && (
            <span className={cn(CHIP, "bg-orange-50 text-orange-800 ring-orange-200")}>
              {spill.credits < c.record.credits ? `แบ่งเกิน ${spill.credits} นก. → เลือกเสรี` : "เกินโควตา → นับเป็นเลือกเสรี"}
            </span>
          )}
          {!c.skip && c.guessed && <span className={cn(CHIP, "bg-amber-50 text-amber-900 ring-amber-200")}>ระบบเดาหมวด — ตรวจอีกครั้ง</span>}
          {c.overridden && <span className={cn(CHIP, "bg-sky-50 text-sky-800 ring-sky-200")}>แก้หมวดเอง</span>}
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

const SECTION = "overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

export function CourseList({ summary, onBucket, onToggleExcluded, onToggleTerm, onRemove }: Props) {
  const [groupBy, setGroupBy] = useState<"term" | "bucket">("term");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const needle = useDeferredValue(normalizeQuery(query));

  const reviewCount = summary.guessedCount;
  const skippedCount = summary.skipped.length;
  // ตัวกรองที่ไม่มีรายการเหลือแล้ว (เช่น แก้หมวดครบ) กลับไปแสดงทั้งหมด
  const activeFilter: Filter = (filter === "review" && !reviewCount) || (filter === "skipped" && !skippedCount) ? "all" : filter;

  const match = useMemo(() => {
    const byFilter = (c: CheckedCourse) => (activeFilter === "review" ? c.guessed && !c.skip : activeFilter === "skipped" ? !!c.skip : true);
    if (!needle) return byFilter;
    return (c: CheckedCourse) => byFilter(c) && normalizeQuery(`${c.record.code} ${c.record.name}`).includes(needle);
  }, [activeFilter, needle]);

  const termGroups = useMemo(() => {
    const groups = new Map<string, CheckedCourse[]>();
    for (const c of summary.courses) {
      if (!match(c)) continue;
      const list = groups.get(c.record.term);
      if (list) list.push(c);
      else groups.set(c.record.term, [c]);
    }
    for (const list of groups.values()) list.sort((a, b) => a.record.code.localeCompare(b.record.code));
    return summary.terms.filter((t) => groups.has(t.term)).map((t) => ({ info: t, list: groups.get(t.term)! }));
  }, [summary.courses, summary.terms, match]);

  const bucketGroups = useMemo(
    () =>
      BUCKETS.map((b) => ({
        b,
        list: summary.byBucket[b].filter(match),
        overflowList: b === "free" ? summary.overflowCourses.filter((o) => match(o.course)) : [],
      })).filter((g) => g.list.length || g.overflowList.length),
    [summary.byBucket, summary.overflowCourses, match]
  );
  const skippedList = useMemo(() => summary.skipped.filter(match), [summary.skipped, match]);
  const shown = groupBy === "term" ? termGroups.reduce((a, g) => a + g.list.length, 0) : bucketGroups.reduce((a, g) => a + g.list.length + g.overflowList.length, 0) + skippedList.length;
  const rowProps = { onBucket, onToggleExcluded, onRemove };

  const filterChip = (value: Filter, label: string, count: number) => (
    <button
      key={value}
      type="button"
      aria-pressed={activeFilter === value}
      onClick={() => setFilter(activeFilter === value && value !== "all" ? "all" : value)}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
        activeFilter === value ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      )}
    >
      {label}
      <span className={cn("tabular-nums", activeFilter === value ? "text-gray-300" : "text-gray-400")}>{count}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          aria-label="การจัดกลุ่มรายวิชา"
          value={groupBy}
          onChange={setGroupBy}
          options={[
            { value: "term", label: "ตามภาคการศึกษา" },
            { value: "bucket", label: "ตามหมวดหลักสูตร" },
          ]}
        />
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหารหัสหรือชื่อวิชา"
            aria-label="ค้นหารายวิชาที่ลงทะเบียน"
            className="h-9 w-full rounded-xl border border-gray-200 bg-white pr-8 pl-9 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="ล้างคำค้นหา"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filterChip("all", "ทั้งหมด", summary.courses.length)}
          {reviewCount > 0 && filterChip("review", "ต้องตรวจหมวด", reviewCount)}
          {skippedCount > 0 && filterChip("skipped", "ไม่นับ", skippedCount)}
        </div>
      </div>

      {shown === 0 && (
        <p className="rounded-3xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
          ไม่พบรายวิชาที่ตรงกับ{query ? ` “${query.trim()}”` : "ตัวกรองนี้"}
        </p>
      )}

      {groupBy === "term" &&
        termGroups.map(({ info, list }) => (
          <section key={info.term} className={SECTION}>
            <header className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900">{info.term === UNKNOWN_TERM ? "ไม่ระบุภาคการศึกษา" : `ภาคการศึกษา ${info.term}`}</h3>
                <p className="text-xs text-gray-500 tabular-nums">
                  นับ {info.counted} จาก {info.registered} หน่วยกิต · {info.courses} วิชา
                </p>
              </div>
              <div className="w-auto shrink-0">
                <Switch
                  checked={!info.excluded}
                  onChange={() => onToggleTerm(info.term)}
                  label={<span className="text-xs font-medium text-gray-600">นับภาคนี้</span>}
                  aria-label={`นับหน่วยกิตของภาค ${info.term}`}
                  className="w-auto"
                />
              </div>
            </header>
            <ul className="divide-y divide-gray-100">
              {list.map((c) => (
                <CourseItemRow key={`${c.key}|${c.record.sec}`} c={c} showTerm={false} spill={summary.overflowByKey.get(c.key)} {...rowProps} />
              ))}
            </ul>
          </section>
        ))}

      {groupBy === "bucket" && (
        <>
          {bucketGroups.map(({ b, list, overflowList }) => {
            const meta = BUCKET_META[b];
            const credits = list.reduce((a, c) => a + c.record.credits, 0) + overflowList.reduce((a, o) => a + o.credits, 0);
            return (
              <section key={b} className={SECTION}>
                <header className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{meta.label}</h3>
                  <p className="shrink-0 text-xs font-medium text-gray-600 tabular-nums">
                    {credits} หน่วยกิต · {list.length + overflowList.length} วิชา
                  </p>
                </header>
                <ul className="divide-y divide-gray-100">
                  {list.map((c) => (
                    <CourseItemRow
                      key={`${c.key}|${c.record.sec}`}
                      c={c}
                      showTerm
                      spill={b !== "free" ? summary.overflowByKey.get(c.key) : undefined}
                      {...rowProps}
                    />
                  ))}
                  {overflowList.map((o) => (
                    <CourseItemRow key={`overflow:${o.course.key}`} c={o.course} showTerm overflowEntry={o} {...rowProps} />
                  ))}
                </ul>
              </section>
            );
          })}
          {skippedList.length > 0 && (
            <section className={SECTION}>
              <header className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-300" aria-hidden />
                <h3 className="min-w-0 flex-1 text-sm font-semibold text-gray-700">รายวิชาที่ไม่ได้นับเข้าหน่วยกิต</h3>
                <p className="shrink-0 text-xs font-medium text-gray-500 tabular-nums">
                  {skippedList.reduce((a, c) => a + c.record.credits, 0)} หน่วยกิต · {skippedList.length} วิชา
                </p>
              </header>
              <ul className="divide-y divide-gray-100">
                {skippedList.map((c) => (
                  <CourseItemRow key={`${c.key}|${c.record.sec}`} c={c} showTerm {...rowProps} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
