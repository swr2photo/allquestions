"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpenCheck,
  Building2,
  Check,
  ChevronDown,
  GraduationCap,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  DAY_SHORT,
  fmtRange,
  sectionClashes,
  sectionExamClashes,
  shortCampus,
  type Course,
  type CurriculaIndex,
  type CurriculumFile,
  type CurriculumProgram,
  type PlannedEntry,
  type ScheduleGroup,
} from "@/lib/timetable";
import {
  classifyCourse,
  classifyPlaceholder,
  curriculumTargets,
  isCatalogTerm,
  plausibleGeTarget,
  type GeIndex,
  type PlaceholderInfo,
} from "@/lib/ge";
import type { CurriculumSelection } from "@/lib/timetable-store";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/checkbox";
import { GeBadge } from "@/components/ge-badge";

export interface RecommendRequest extends PlaceholderInfo {
  name: string;
  credits: number;
}

interface Props {
  courses: Course[];
  /** SIS term id currently open, e.g. "2569-2" */
  termId: string;
  /** ภาคเรียนเริ่มต้นที่จะแสดง (ตามภาคการศึกษาที่เปิดอยู่) */
  defaultTerm?: number;
  entries: PlannedEntry[];
  geIndex: GeIndex | null;
  selection: CurriculumSelection | undefined;
  onSelectionChange: (s: CurriculumSelection) => void;
  onAddCourse: (course: Course, sec: string) => void;
  onRandomize: (groups: ScheduleGroup[]) => void;
  onRecommend: (req: RecommendRequest) => void;
}

const TERM_LABEL: Record<number, string> = { 1: "ภาค 1", 2: "ภาค 2", 3: "ฤดูร้อน" };
const TERM_LONG: Record<number, string> = { 1: "ภาคเรียนที่ 1", 2: "ภาคเรียนที่ 2", 3: "ภาคฤดูร้อน" };

// fetched once per page load — switching panels / terms never refetches or resets
let indexPromise: Promise<CurriculaIndex> | null = null;
const fileCache = new Map<string, Promise<CurriculumFile>>();

function loadIndex() {
  indexPromise ??= fetch("/timetable/curricula/index.json")
    .then((r) => (r.ok ? (r.json() as Promise<CurriculaIndex>) : Promise.reject(new Error(`HTTP ${r.status}`))))
    .catch(() => ({ faculties: [{ id: "sci", faculty: "คณะวิทยาศาสตร์", campus: "วิทยาเขตหาดใหญ่", file: "/timetable/curricula/sci.json", programs: 0 }] }));
  return indexPromise;
}

function loadFile(file: string) {
  let p = fileCache.get(file);
  if (!p) {
    p = fetch(file).then((r) => (r.ok ? (r.json() as Promise<CurriculumFile>) : Promise.reject(new Error(`HTTP ${r.status}`))));
    p.catch(() => fileCache.delete(file));
    fileCache.set(file, p);
  }
  return p;
}

/** Loads the curricula index + the selected faculty's study-plan file (cached per page load). */
export function useCurriculumData(selection: CurriculumSelection | undefined) {
  const [index, setIndex] = useState<CurriculaIndex | null>(null);
  const [file, setFile] = useState<{ id: string; data: CurriculumFile } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadIndex().then((idx) => !cancelled && setIndex(idx));
    return () => {
      cancelled = true;
    };
  }, []);

  const facultyEntry = index?.faculties.find((f) => f.id === selection?.curriculumId) ?? index?.faculties[0];

  useEffect(() => {
    if (!facultyEntry) return;
    let cancelled = false;
    loadFile(facultyEntry.file)
      .then((data) => !cancelled && setFile({ id: facultyEntry.id, data }))
      .catch((e) => !cancelled && setError(`โหลดโครงสร้างหลักสูตรไม่สำเร็จ (${e instanceof Error ? e.message : e})`));
    return () => {
      cancelled = true;
    };
  }, [facultyEntry]);

  const data = file?.id === facultyEntry?.id ? file?.data : undefined;
  return { index, data, error, facultyEntry };
}

/**
 * Resolve the saved selection against the loaded plan file. Every level falls
 * back to the first valid option, but the user's choice itself lives in the
 * saved store — so nothing snaps back to the default when the panel remounts.
 */
export function resolveSelection(data: CurriculumFile | undefined, selection: CurriculumSelection | undefined) {
  const divisions = [...new Set(data?.programs.map((p) => p.division) ?? [])];
  const division = divisions.includes(selection?.division ?? "") ? selection!.division : (divisions[0] ?? "");
  const programs = data?.programs.filter((p) => p.division === division) ?? [];
  const program: CurriculumProgram | undefined = programs.find((p) => p.id === selection?.programId) ?? programs[0];
  const editions = program?.editions ?? [];
  const edition = editions.find((e) => e.curriculumYear === selection?.editionYear) ?? editions[0];
  const plans = [...new Set(edition?.years.map((y) => y.plan).filter((p): p is string => Boolean(p)) ?? [])];
  const plan = plans.includes(selection?.plan ?? "") ? selection!.plan : (plans[0] ?? "");
  const yearsInPlan = edition?.years.filter((y) => !y.plan || y.plan === plan) ?? [];
  const yearChoices = [...new Set(yearsInPlan.map((y) => y.year))].sort((a, b) => a - b);
  const yearNo = yearChoices.includes(selection?.year ?? 0) ? selection!.year : (yearChoices[0] ?? 1);
  const year = yearsInPlan.find((y) => y.year === yearNo);
  return { divisions, division, programs, program, editions, edition, plans, plan, yearChoices, yearNo, year };
}

export function CurriculumPicker({
  courses,
  termId,
  defaultTerm = 1,
  entries,
  geIndex,
  selection,
  onSelectionChange,
  onAddCourse,
  onRandomize,
  onRecommend,
}: Props) {
  const [openCode, setOpenCode] = useState<string | null>(null);
  const { index, data, error, facultyEntry } = useCurriculumData(selection);
  const { divisions, division, programs, program, editions, edition, plans, plan, yearChoices, yearNo, year } = useMemo(
    () => resolveSelection(data, selection),
    [data, selection]
  );
  const wantedTerm = selection?.termOf === termId && selection.term ? selection.term : defaultTerm;
  const term = year?.terms.find((t) => t.term === wantedTerm) ?? year?.terms[0];
  const catalog = term ? isCatalogTerm(term) : false;

  const current: CurriculumSelection = {
    curriculumId: facultyEntry?.id ?? "sci",
    division,
    programId: program?.id ?? "",
    editionYear: edition?.curriculumYear ?? 0,
    plan,
    year: yearNo,
    term: term?.term,
    termOf: termId,
  };
  const change = (p: Partial<CurriculumSelection>) => onSelectionChange({ ...current, ...p });

  const targets = useMemo(
    () => curriculumTargets(program, edition?.curriculumYear, plan || undefined, geIndex),
    [program, edition, plan, geIndex]
  );

  const coursesByCode = useMemo(() => {
    const m = new Map<string, Course[]>();
    courses.forEach((c) => m.set(c.code, [...(m.get(c.code) ?? []), c]));
    return m;
  }, [courses]);

  const addCourse = (code: string) => {
    const [course] = coursesByCode.get(code) ?? [];
    if (!course) return;
    const free = course.sections.find((s) => sectionClashes(s, entries, course.id).length === 0);
    const section = free ?? course.sections[0];
    if (section) onAddCourse(course, section.sec);
  };

  const randomTerm = () => {
    const groups: ScheduleGroup[] = [];
    for (const c of term?.courses ?? []) {
      if (c.placeholder) continue;
      const options = (coursesByCode.get(c.code) ?? []).flatMap((course) =>
        course.sections.map((section) => ({ code: c.code, course, section }))
      );
      if (options.length) groups.push({ code: c.code, options });
    }
    if (!groups.length) {
      toast.info("ไม่มีรายวิชาที่เปิดให้สุ่มในภาคนี้");
      return;
    }
    onRandomize(groups);
  };

  if (error) return <p className="p-4 text-xs text-red-600">{error}</p>;
  if (!index || !data || !program) {
    return (
      <div className="space-y-2 p-3" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-gray-100" />
        ))}
        <p className="flex items-center gap-2 pt-1 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังโหลดหลักสูตร…
        </p>
      </div>
    );
  }

  const plannedCodes = new Set(entries.map((e) => e.code));

  return (
    <div className="space-y-3 p-3">
      {/* faculty */}
      <div className="flex items-center gap-2">
        {index.faculties.length > 1 ? (
          <Select
            label="คณะ"
            size="sm"
            icon={<Building2 className="h-4 w-4" />}
            value={facultyEntry?.id ?? ""}
            onChange={(id) => onSelectionChange({ ...current, curriculumId: id, division: "", programId: "", editionYear: 0, plan: "", year: 1 })}
            options={index.faculties.map((f) => ({ value: f.id, label: f.faculty, description: shortCampus(f.campus), meta: f.programs || undefined }))}
          />
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate font-semibold">{facultyEntry?.faculty}</span>
            <span className="shrink-0 text-emerald-700/70">· {shortCampus(facultyEntry?.campus ?? "")}</span>
          </div>
        )}
        <Link
          href="/faculties"
          className="shrink-0 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-[11px] font-medium text-gray-600 hover:border-emerald-300 hover:text-emerald-700"
        >
          คณะอื่น ๆ
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select
          label="กลุ่มสาขา"
          size="sm"
          value={division}
          onChange={(d) => change({ division: d, programId: "", plan: "", editionYear: 0, year: 1, term: undefined })}
          options={divisions.map((d) => ({ value: d, label: d, meta: data.programs.filter((p) => p.division === d).length }))}
        />
        <Select
          label="สาขาวิชา"
          size="sm"
          value={program.id}
          onChange={(id) => change({ programId: id, plan: "", editionYear: 0, year: 1, term: undefined })}
          options={programs.map((p) => ({ value: p.id, label: p.name, description: p.editions.map((e) => e.curriculumYear).join(" / ") }))}
        />
        {editions.length > 1 && (
          <Select
            label="ฉบับหลักสูตร"
            size="sm"
            icon={<BookOpenCheck className="h-3.5 w-3.5" />}
            value={edition?.curriculumYear ?? 0}
            onChange={(y) => change({ editionYear: y, plan: "", year: 1, term: undefined })}
            options={editions.map((e) => ({ value: e.curriculumYear, label: `หลักสูตร ${e.curriculumYear}` }))}
          />
        )}
        {plans.length > 1 && (
          <Select
            label="แผนการศึกษา"
            size="sm"
            icon={<Layers className="h-3.5 w-3.5" />}
            value={plan}
            onChange={(p) => change({ plan: p })}
            options={plans.map((p) => ({ value: p, label: `แผน${p}` }))}
          />
        )}
      </div>

      <div className="space-y-2">
        <Segmented
          aria-label="ชั้นปี"
          size="sm"
          className="flex w-full"
          value={String(yearNo)}
          onChange={(v) => change({ year: Number(v), term: undefined })}
          options={yearChoices.map((y) => ({ value: String(y), label: `ปี ${y}` }))}
        />
        {(year?.terms.length ?? 0) > 1 && (
          <Segmented
            aria-label="ภาคการศึกษา"
            size="sm"
            className="flex w-full"
            value={String(term?.term ?? 1)}
            onChange={(v) => change({ term: Number(v), termOf: termId })}
            options={(year?.terms ?? []).map((t) => ({
              value: String(t.term),
              label: (
                <span className="flex items-center gap-1">
                  {isCatalogTerm(t) ? "ภาคผนวก" : (TERM_LABEL[t.term] ?? `ภาค ${t.term}`)}
                  {t.term === defaultTerm && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-label="ภาคที่เปิดอยู่" />}
                </span>
              ),
            }))}
          />
        )}
      </div>

      {/* program card */}
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/40 p-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{program.name}</p>
            <p className="text-[11px] text-gray-600">
              {edition ? `หลักสูตร ${edition.curriculumYear}` : ""}
              {plan ? ` · แผน${plan}` : ""} · ปี {yearNo}
            </p>
          </div>
        </div>
        {edition?.electives && edition.electives.areas.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onRecommend({
                kind: "major",
                hint: [],
                name: "วิชาเลือกหมวดวิชาเฉพาะ",
                credits: edition.electives?.credits ?? 0,
              })
            }
            className="mt-2 flex w-full items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-left text-[11px] ring-1 ring-violet-100 transition hover:bg-violet-50 hover:ring-violet-200"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-600" />
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-gray-900">วิชาเลือกหลักสูตร {edition.electives.areas.length} ด้าน/กลุ่ม</span>
              <span className="block truncate text-gray-500">
                {edition.electives.areas.map((a) => a.name).join(" · ")}
              </span>
            </span>
            <span className="shrink-0 font-semibold text-violet-700">แนะนำ ›</span>
          </button>
        )}
        {targets && (plausibleGeTarget(targets) > 0 || targets.freeCredits > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {plausibleGeTarget(targets) > 0 && (
              <span className="rounded-full bg-white px-2 py-0.5 font-medium text-gray-700 ring-1 ring-emerald-100">
                ศึกษาทั่วไป ≈ {plausibleGeTarget(targets)} นก.
              </span>
            )}
            {targets.freeCredits > 0 && (
              <span className="rounded-full bg-white px-2 py-0.5 font-medium text-gray-700 ring-1 ring-emerald-100">
                เลือกเสรี {targets.freeCredits} นก.
              </span>
            )}
          </div>
        )}
      </div>

      {term ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-800">
              {catalog
                ? `รายวิชาเลือกจากภาคผนวก · ${term.courses.length} วิชา`
                : `${TERM_LONG[term.term] ?? `ภาค ${term.term}`} · ${term.credits} หน่วยกิต`}
            </p>
            {!catalog && (
              <button
                type="button"
                onClick={randomTerm}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-600 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-600 hover:text-white"
              >
                <Shuffle className="h-3 w-3" /> สุ่มตารางภาคนี้
              </button>
            )}
          </div>
          {catalog && (
            <p className="mb-2 rounded-lg bg-sky-50 px-2 py-1.5 text-[11px] text-sky-800">
              รายการวิชาเลือกท้ายเล่มหลักสูตร (ไม่ใช่แผนรายภาค) — เลือกเฉพาะวิชาที่ต้องการลงเพิ่ม
            </p>
          )}
          {!catalog && term.term !== defaultTerm && (
            <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
              ข้อมูล Section ที่เปิดสอนเป็นของ {TERM_LONG[defaultTerm]} — วิชาของภาคอื่นอาจไม่เปิดในภาคนี้
            </p>
          )}
          <ul className="space-y-1">
            {term.courses.map((c) => {
              if (c.placeholder) {
                const info = classifyPlaceholder(c.name);
                return (
                  <li key={`${c.code}-${c.name}`}>
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-2.5 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-700">{c.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {c.credits} หน่วยกิต ·{" "}
                          {info.kind === "ge" ? "หมวดศึกษาทั่วไป" : info.kind === "free" ? "หมวดเลือกเสรี" : "วิชาเลือกของหลักสูตร"}
                        </p>
                      </div>
                      {(info.kind !== "major" || (edition?.electives?.areas.length ?? 0) > 0) && (
                        <button
                          type="button"
                          onClick={() => onRecommend({ ...info, name: c.name, credits: c.credits })}
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-violet-700"
                        >
                          <Sparkles className="h-3 w-3" /> แนะนำวิชา
                        </button>
                      )}
                    </div>
                  </li>
                );
              }
              const offered = coursesByCode.has(c.code);
              const ge = classifyCourse({ code: c.code, name: c.name }, geIndex);
              const planned = plannedCodes.has(c.code);
              return (
                <li key={`${c.code}-${c.name}`}>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOpenCode(openCode === c.code ? null : c.code)}
                      disabled={!offered}
                      aria-expanded={openCode === c.code}
                      className={`flex min-w-0 flex-1 items-start gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition hover:bg-emerald-50 disabled:text-gray-400 ${
                        planned ? "bg-emerald-50/70" : ""
                      }`}
                    >
                      <span className={`shrink-0 font-mono ${offered ? "text-emerald-700" : "text-gray-400"}`}>{c.code}</span>
                      <span className="min-w-0 flex-1">
                        <span className={offered ? "text-gray-800" : ""}>{c.name}</span>
                        {(ge?.levels.length || !offered) && (
                          <span className="mt-0.5 flex flex-wrap items-center gap-1">
                            {ge?.levels.slice(0, 1).map((g) => <GeBadge key={g} ge={g} size="xs" />)}
                            {!offered && <span className="text-[10px] text-gray-400">ไม่เปิดสอนภาคนี้</span>}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-gray-400 tabular-nums">{c.credits}</span>
                      {planned ? (
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="อยู่ในตารางแล้ว" />
                      ) : (
                        offered && (
                          <ChevronDown
                            className={`mt-0.5 h-3 w-3 shrink-0 text-gray-400 transition ${openCode === c.code ? "rotate-180" : ""}`}
                          />
                        )
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => addCourse(c.code)}
                      disabled={!offered}
                      title={offered ? "เพิ่มลงตารางเรียน (Sec ว่างแรก)" : "ยังไม่มีรายวิชานี้ในภาคการศึกษานี้"}
                      aria-label={`เพิ่ม ${c.code} ลงตารางเรียน`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-100 disabled:text-gray-300 disabled:hover:bg-transparent"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {openCode === c.code && (
                    <SectionList
                      options={(coursesByCode.get(c.code) ?? []).flatMap((course) =>
                        course.sections.map((section) => ({ course, section }))
                      )}
                      entries={entries}
                      onAdd={onAddCourse}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-gray-500">ไม่มีข้อมูลภาคนี้</p>
      )}
    </div>
  );
}

function SectionList({
  options,
  entries,
  onAdd,
}: {
  options: { course: Course; section: Course["sections"][number] }[];
  entries: PlannedEntry[];
  onAdd: (course: Course, sec: string) => void;
}) {
  if (!options.length) return <p className="px-2 py-1 text-[11px] text-gray-500">ยังไม่มี Sec ในภาคนี้</p>;
  return (
    <ul className="mt-1 space-y-1 pl-2">
      {options.map(({ course, section }) => {
        const selected = entries.some((e) => e.course?.id === course.id && e.sec === section.sec);
        const clashes = sectionClashes(section, entries, course.id);
        const examClashes = sectionExamClashes(section, entries, course.id);
        return (
          <li
            key={course.id + section.sec}
            className={`rounded-xl border p-2 text-[11px] ${
              selected ? "border-emerald-400 bg-emerald-50/60" : clashes.length ? "border-red-200 bg-red-50/40" : "border-gray-100 bg-gray-50/60"
            }`}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-semibold text-gray-900">
                  Sec {section.sec} <span className="font-normal text-gray-500">· {shortCampus(course.campus)}</span>
                </p>
                {section.slots.length > 0 ? (
                  section.slots.map((sl, i) => (
                    <p key={i} className="text-gray-700 tabular-nums">
                      {DAY_SHORT[sl.day]} {fmtRange(sl.start, sl.end)}
                      {sl.room && (
                        <span className="ml-1 text-gray-500">
                          <MapPin className="inline h-3 w-3" /> {sl.room}
                        </span>
                      )}
                    </p>
                  ))
                ) : (
                  <p className="text-gray-500">{section.dayTime || "ยังไม่มีตารางเรียน"}</p>
                )}
                {section.instructors.length > 0 && <p className="text-gray-600">ผู้สอน: {section.instructors.join(", ")}</p>}
                {clashes.length > 0 && (
                  <p className="flex items-center gap-1 font-medium text-red-600">
                    <AlertTriangle className="h-3 w-3" /> เวลาเรียนชนกับ {clashes.map((c) => c.code).join(", ")}
                  </p>
                )}
                {examClashes.length > 0 && (
                  <p className="flex items-center gap-1 font-medium text-orange-600">
                    <AlertTriangle className="h-3 w-3" /> วันสอบชนกับ {examClashes.map((c) => c.code).join(", ")}
                  </p>
                )}
              </div>
              {selected ? (
                <span className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 font-medium text-white">
                  <Check className="h-3 w-3" /> เลือกแล้ว
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onAdd(course, section.sec)}
                  className="shrink-0 rounded-lg border border-emerald-600 px-2.5 py-1 font-medium text-emerald-700 hover:bg-emerald-600 hover:text-white"
                >
                  เลือก
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
