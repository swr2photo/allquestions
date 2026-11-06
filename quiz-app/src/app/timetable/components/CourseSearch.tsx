"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  Building2,
  Check,
  ChevronDown,
  Info,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  DAY_SHORT,
  courseHaystack,
  fmtExam,
  fmtRange,
  matchScore,
  normalizeQuery,
  sectionClashes,
  sectionExamClashes,
  shortCampus,
  type Course,
  type PlannedEntry,
  type ScheduleGroup,
  type Section,
} from "@/lib/timetable";
import { GE_AREAS, GE_META, classifyCourse, curriculumTargets, geArea, type GeInfo } from "@/lib/ge";
import type { RegistrationHistory } from "@/lib/registration";
import { useGenedIndex } from "@/hooks/use-gened-index";
import { timetableStore, useTimetableStore } from "@/hooks/use-timetable-store";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { GeBadge, GeIcon } from "@/components/ge-badge";
import { cn } from "@/lib/utils";
import type { GhostBlock } from "./WeekGrid";
import { CurriculumPicker, resolveSelection, useCurriculumData, type RecommendRequest } from "./CurriculumPicker";
import { RecommendPanel } from "./RecommendPanel";

interface Props {
  courses: Course[];
  /** SIS term id, e.g. "2569-2" */
  termId: string;
  /** ภาคของข้อมูลที่เปิดอยู่ (1|2|3) — ใช้เป็นภาคเริ่มต้นในแท็บ "ตามหลักสูตร" */
  term: number;
  entries: PlannedEntry[];
  registration: RegistrationHistory;
  initialQuery?: string;
  onAdd: (course: Course, sec: string) => void;
  onRandomize: (groups: ScheduleGroup[]) => void;
  onRemove: (courseId: string) => void;
  onPreview: (ghost: GhostBlock | null) => void;
  onDetail: (course: Course) => void;
  onOpenRegistration: () => void;
}

const QUICK = [
  { label: "GE ทั้งหมด", q: "", ge: "any" },
  { label: "890 ภาษาอังกฤษ", q: "890-", ge: "all" },
  { label: "895 ศึกษาทั่วไป", q: "895-", ge: "all" },
  { label: "322 คณิตศาสตร์", q: "322-", ge: "all" },
  { label: "240 คอมพิวเตอร์", q: "240-", ge: "all" },
];

const PAGE = 40;

type Panel = "search" | "curriculum" | "recommend";

export function CourseSearch({
  courses,
  termId,
  term,
  entries,
  registration,
  initialQuery = "",
  onAdd,
  onRandomize,
  onRemove,
  onPreview,
  onDetail,
  onOpenRegistration,
}: Props) {
  const { store } = useTimetableStore();
  const { index: geIndex, loading: geLoading } = useGenedIndex();
  const panel: Panel = store.prefs.panel ?? "search";
  const setPanel = (p: Panel) => timetableStore.setPrefs({ panel: p });
  const selection = store.prefs.curriculum;

  const [query, setQuery] = useState(initialQuery);
  const [campus, setCampus] = useState("all");
  const [faculty, setFaculty] = useState("all");
  const [geFilter, setGeFilter] = useState<string>("all");
  const [hideClash, setHideClash] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [request, setRequest] = useState<RecommendRequest | null>(null);
  const deferredQuery = useDeferredValue(query);
  // the page can push a new query (deep links / "pick a section yourself")
  const [prevInitial, setPrevInitial] = useState(initialQuery);
  if (initialQuery !== prevInitial) {
    setPrevInitial(initialQuery);
    setQuery(initialQuery);
    setGeFilter("all");
    setLimit(PAGE);
  }

  // curriculum context for the recommendation tab (targets, home campus)
  const cur = useCurriculumData(selection);
  const resolved = useMemo(() => resolveSelection(cur.data, selection), [cur.data, selection]);
  const targets = useMemo(
    () => curriculumTargets(resolved.program, resolved.edition?.curriculumYear, resolved.plan || undefined, geIndex),
    [resolved, geIndex]
  );

  const haystacks = useMemo(() => new Map(courses.map((c) => [c.id, courseHaystack(c)])), [courses]);
  const geById = useMemo(() => {
    const m = new Map<string, GeInfo>();
    for (const c of courses) {
      const info = classifyCourse(c, geIndex);
      if (info?.levels.length) m.set(c.id, info);
    }
    return m;
  }, [courses, geIndex]);

  const campuses = useMemo(() => {
    const m = new Map<string, number>();
    courses.forEach((c) => m.set(c.campus, (m.get(c.campus) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [courses]);

  const faculties = useMemo(() => {
    const m = new Map<string, number>();
    courses.forEach((c) => {
      if (c.faculty && (campus === "all" || c.campus === campus)) m.set(c.faculty, (m.get(c.faculty) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "th"));
  }, [courses, campus]);

  const plannedSec = useMemo(() => {
    const m = new Map<string, string>();
    entries.forEach((e) => e.course && m.set(e.course.id, e.sec));
    return m;
  }, [entries]);

  const results = useMemo(() => {
    const q = normalizeQuery(deferredQuery);
    if (!q && faculty === "all" && geFilter === "all") return null;
    const out: { c: Course; score: number }[] = [];
    for (const c of courses) {
      if (campus !== "all" && c.campus !== campus) continue;
      if (faculty !== "all" && c.faculty !== faculty) continue;
      if (geFilter !== "all") {
        const info = geById.get(c.id);
        if (!info) continue;
        if (geFilter !== "any" && !info.levels.some((l) => geArea(l) === geFilter || l === geFilter)) continue;
      }
      const score = matchScore(c, haystacks.get(c.id) ?? "", q);
      if (score < 0) continue;
      if (hideClash && !plannedSec.has(c.id)) {
        const anyFree = c.sections.some((s) => sectionClashes(s, entries, c.id).length === 0);
        if (!anyFree) continue;
      }
      out.push({ c, score });
    }
    out.sort((a, b) => a.score - b.score || a.c.code.localeCompare(b.c.code));
    return out.map((o) => o.c);
  }, [courses, haystacks, deferredQuery, campus, faculty, geFilter, geById, hideClash, entries, plannedSec]);

  const resetPaging = () => {
    setLimit(PAGE);
    setExpanded(null);
  };

  const TABS: { value: Panel; label: string; icon: typeof Search }[] = [
    { value: "search", label: "ค้นหา", icon: Search },
    { value: "curriculum", label: "ตามหลักสูตร", icon: BookMarked },
    { value: "recommend", label: "แนะนำ", icon: Sparkles },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-gray-100 bg-white/80 p-2 text-xs" role="tablist" aria-label="วิธีเลือกวิชา">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={panel === value}
            onClick={() => setPanel(value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 font-semibold transition",
              panel === value
                ? value === "recommend"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-emerald-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {panel === "curriculum" ? (
        <div className="ui-scroll min-h-0 flex-1 overflow-y-auto">
          <CurriculumPicker
            courses={courses}
            termId={termId}
            defaultTerm={term}
            entries={entries}
            geIndex={geIndex}
            selection={selection}
            onSelectionChange={timetableStore.setCurriculum}
            onAddCourse={onAdd}
            onRandomize={onRandomize}
            onRecommend={(req) => {
              setRequest(req);
              setPanel("recommend");
            }}
          />
        </div>
      ) : panel === "recommend" ? (
        <div className="ui-scroll min-h-0 flex-1 overflow-y-auto">
          <RecommendPanel
            courses={courses}
            entries={entries}
            geIndex={geIndex}
            geLoading={geLoading}
            registration={registration}
            targets={targets}
            homeCampus={cur.facultyEntry?.campus}
            homeFaculty={cur.facultyEntry?.faculty}
            request={request}
            onClearRequest={() => setRequest(null)}
            onAdd={onAdd}
            onPreview={onPreview}
            onDetail={onDetail}
            onOpenRegistration={onOpenRegistration}
          />
        </div>
      ) : (
        <>
          <div className="space-y-2 border-b border-gray-100 p-3">
            <label className="relative block">
              <span className="sr-only">ค้นหารายวิชา</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPaging();
                }}
                placeholder="รหัสวิชา ชื่อวิชา หรือชื่ออาจารย์…"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pr-9 pl-9 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 [&::-webkit-search-cancel-button]:appearance-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    resetPaging();
                  }}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-700"
                  aria-label="ล้างคำค้น"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                label="วิทยาเขต"
                size="sm"
                icon={<MapPin className="h-3.5 w-3.5" />}
                value={campus}
                onChange={(v) => {
                  setCampus(v);
                  setFaculty("all");
                  resetPaging();
                }}
                options={[
                  { value: "all", label: "ทุกวิทยาเขต", meta: courses.length.toLocaleString() },
                  ...campuses.map(([c, n]) => ({ value: c, label: shortCampus(c), meta: n.toLocaleString() })),
                ]}
              />
              <Select
                label="คณะ"
                size="sm"
                icon={<Building2 className="h-3.5 w-3.5" />}
                value={faculty}
                searchable
                onChange={(v) => {
                  setFaculty(v);
                  resetPaging();
                }}
                options={[
                  { value: "all", label: "ทุกคณะ" },
                  ...faculties.map(([f, n]) => ({ value: f, label: f, meta: n })),
                ]}
              />
            </div>
            {/* GE filter chips */}
            <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5" role="group" aria-label="กรองหมวด GE">
              {[
                { value: "all", label: "ทุกวิชา" },
                { value: "any", label: "GE ทั้งหมด" },
                ...GE_AREAS.map((a) => ({ value: a, label: a })),
              ].map((o) => {
                const active = geFilter === o.value;
                const isGe = o.value.startsWith("GE");
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={active}
                    title={isGe ? GE_META[o.value as keyof typeof GE_META].name : undefined}
                    onClick={() => {
                      setGeFilter(o.value);
                      resetPaging();
                    }}
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition ring-inset",
                      active ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-600 ring-gray-200 hover:ring-gray-300"
                    )}
                  >
                    {isGe && <GeIcon ge={o.value as "GE1"} className="h-3 w-3" />}
                    {o.label}
                  </button>
                );
              })}
            </div>
            <Checkbox checked={hideClash} onChange={setHideClash} label="ซ่อนวิชาที่ทุก section ชนกับตารางปัจจุบัน" />
          </div>

          <div className="ui-scroll min-h-0 flex-1 overflow-y-auto p-3" onMouseLeave={() => onPreview(null)}>
            {results === null ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                  <Search className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-gray-800">เริ่มค้นหารายวิชา</p>
                <p className="mt-1 text-xs text-gray-500">พิมพ์รหัสวิชา ชื่อวิชา ชื่ออาจารย์ เลือกคณะ หรือหมวด GE</p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {QUICK.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => {
                        setQuery(q.q);
                        setGeFilter(q.ge);
                        resetPaging();
                      }}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:border-emerald-400 hover:text-emerald-700"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPanel("recommend")}
                  className="mx-auto mt-5 flex items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 ring-1 ring-violet-100 hover:bg-violet-100"
                >
                  <Sparkles className="h-3.5 w-3.5" /> ให้ระบบแนะนำวิชา GE / เลือกเสรีที่ไม่ชนตาราง
                </button>
              </div>
            ) : results.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">ไม่พบรายวิชาที่ตรงกับเงื่อนไข</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-gray-500">พบ {results.length.toLocaleString()} รายวิชา</p>
                <ul className="space-y-2">
                  {results.slice(0, limit).map((c) => (
                    <CourseResult
                      key={c.id}
                      course={c}
                      ge={geById.get(c.id)}
                      open={expanded === c.id}
                      plannedSec={plannedSec.get(c.id)}
                      entries={entries}
                      onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                      onAdd={onAdd}
                      onRemove={onRemove}
                      onPreview={onPreview}
                      onDetail={onDetail}
                    />
                  ))}
                </ul>
                {results.length > limit && (
                  <button
                    type="button"
                    onClick={() => setLimit(limit + PAGE)}
                    className="mt-3 w-full rounded-xl border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    แสดงเพิ่ม ({(results.length - limit).toLocaleString()} รายวิชา)
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CourseResult({
  course,
  ge,
  open,
  plannedSec,
  entries,
  onToggle,
  onAdd,
  onRemove,
  onPreview,
  onDetail,
}: {
  course: Course;
  ge?: GeInfo;
  open: boolean;
  plannedSec?: string;
  entries: PlannedEntry[];
  onToggle: () => void;
  onAdd: (course: Course, sec: string) => void;
  onRemove: (courseId: string) => void;
  onPreview: (ghost: GhostBlock | null) => void;
  onDetail: (course: Course) => void;
}) {
  const added = plannedSec !== undefined;
  return (
    <li
      className={cn(
        "rounded-2xl border bg-white transition",
        added ? "border-emerald-300 ring-1 ring-emerald-200" : "border-gray-200 hover:border-gray-300"
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-2 p-3 text-left" aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-gray-900">{course.code}</span>
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{course.creditNum} หน่วยกิต</span>
            {ge?.levels.slice(0, 1).map((g) => <GeBadge key={g} ge={g} size="xs" />)}
            {added && (
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                เลือก Sec {plannedSec}
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-gray-800">{course.nameTh}</p>
          <p className="truncate text-[11px] text-gray-500 uppercase">{course.nameEn}</p>
          <p className="mt-1 truncate text-[11px] text-gray-400">
            {shortCampus(course.campus)} · {course.faculty} · {course.sections.length} section
          </p>
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-2 border-t border-gray-100 p-2">
          {course.sections.length === 0 && (
            <p className="px-1 py-2 text-xs text-gray-500">ยังไม่มี section ที่เปิดสอนในภาคนี้</p>
          )}
          {course.sections.map((s) => (
            <SectionRow
              key={s.sec}
              course={course}
              section={s}
              selected={plannedSec === s.sec}
              entries={entries}
              onAdd={onAdd}
              onRemove={onRemove}
              onPreview={onPreview}
            />
          ))}
          <button
            type="button"
            onClick={() => onDetail(course)}
            className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          >
            <Info className="h-3.5 w-3.5" /> รายละเอียดวิชา / คำอธิบายรายวิชา
          </button>
        </div>
      )}
    </li>
  );
}

function SectionRow({
  course,
  section,
  selected,
  entries,
  onAdd,
  onRemove,
  onPreview,
}: {
  course: Course;
  section: Section;
  selected: boolean;
  entries: PlannedEntry[];
  onAdd: (course: Course, sec: string) => void;
  onRemove: (courseId: string) => void;
  onPreview: (ghost: GhostBlock | null) => void;
}) {
  const clashes = sectionClashes(section, entries, course.id);
  const examClashes = sectionExamClashes(section, entries, course.id);
  const hasSlots = section.slots.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-2 text-xs",
        selected ? "border-emerald-400 bg-emerald-50/60" : clashes.length ? "border-red-200 bg-red-50/40" : "border-gray-100 bg-gray-50/60"
      )}
      onMouseEnter={() =>
        hasSlots && onPreview({ code: course.code, sec: section.sec, slots: section.slots, clash: clashes.length > 0 })
      }
      onMouseLeave={() => onPreview(null)}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-gray-900">Sec {section.sec}</span>
            {section.seats !== null && (
              <span className="flex items-center gap-0.5 text-gray-500">
                <Users className="h-3 w-3" />
                {section.seats}
              </span>
            )}
            {section.badges.map((b) => (
              <span key={b} className="rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-800">
                {b}
              </span>
            ))}
          </div>
          <div className="text-gray-700">
            {hasSlots ? (
              section.slots.map((sl, i) => (
                <div key={i} className="tabular-nums">
                  <span className="inline-block w-7 font-medium">{DAY_SHORT[sl.day]}</span>
                  {fmtRange(sl.start, sl.end)}
                  {sl.room && (
                    <span className="ml-1 text-gray-500">
                      <MapPin className="inline h-3 w-3" /> {sl.room}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <span className="text-gray-500">{section.dayTime || "ยังไม่มีตารางเรียน"}</span>
            )}
          </div>
          {section.instructors.length > 0 && <p className="text-gray-600">ผู้สอน: {section.instructors.join(", ")}</p>}
          {section.group && <p className="text-gray-500">ผู้เรียน: {section.group}</p>}
          <p className="text-gray-500">
            กลางภาค: {section.midtermAt ? fmtExam(section.midtermAt) : section.midterm}
            <br />
            ปลายภาค: {section.finalAt ? fmtExam(section.finalAt) : section.final}
          </p>
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
          <button
            type="button"
            onClick={() => onRemove(course.id)}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-2 font-medium text-white hover:bg-red-600"
            title="นำออกจากตาราง"
          >
            <Check className="h-3.5 w-3.5" /> เลือกแล้ว
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAdd(course, section.sec)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-600 px-2.5 py-2 font-medium text-emerald-700 hover:bg-emerald-600 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> เลือก
          </button>
        )}
      </div>
    </div>
  );
}
