"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Building2,
  CalendarRange,
  ChevronRight,
  GraduationCap,
  Layers,
  Loader2,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/checkbox";
import { GeBadge } from "@/components/ge-badge";
import { timetableStore } from "@/hooks/use-timetable-store";
import { shortCampus } from "@/lib/timetable";
import { cn } from "@/lib/utils";
import type { FacultyCourse, FacultyProgram, FacultySummary } from "@/app/api/faculties/route";

interface ListResponse {
  term: { id: string; label: string };
  faculties: FacultySummary[];
}

interface SearchResponse {
  faculties: FacultySummary[];
  depts: { name: string; courses: number; faculty: string; campus: string; key: string }[];
  programs: (FacultyProgram & { faculty: string; campus: string; key: string; curriculumId?: string })[];
  courses: FacultyCourse[];
}

const CAMPUS_TONE: Record<string, string> = {
  หาดใหญ่: "from-emerald-500 to-teal-600",
  ปัตตานี: "from-sky-500 to-indigo-600",
  ภูเก็ต: "from-cyan-500 to-blue-600",
  สุราษฎร์ธานี: "from-amber-500 to-orange-600",
  ตรัง: "from-rose-500 to-pink-600",
};

export default function FacultiesPage() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campus, setCampus] = useState("all");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const [search, setSearch] = useState<{ q: string; res: SearchResponse } | null>(null);
  const [selected, setSelected] = useState<FacultySummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/faculties")
      .then((r) => (r.ok ? (r.json() as Promise<ListResponse>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError("โหลดข้อมูลคณะไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (deferred.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/faculties?q=${encodeURIComponent(deferred)}`)
        .then((r) => (r.ok ? (r.json() as Promise<SearchResponse>) : null))
        .then((res) => !cancelled && res && setSearch({ q: deferred, res }));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [deferred]);

  const campuses = useMemo(() => {
    const m = new Map<string, number>();
    data?.faculties.forEach((f) => m.set(shortCampus(f.campus), (m.get(shortCampus(f.campus)) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const groups = useMemo(() => {
    const out = new Map<string, FacultySummary[]>();
    for (const f of data?.faculties ?? []) {
      const c = shortCampus(f.campus);
      if (campus !== "all" && c !== campus) continue;
      out.set(c, [...(out.get(c) ?? []), f]);
    }
    // biggest campus first, biggest faculty first within a campus
    return [...out.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([c, list]) => [c, [...list].sort((x, y) => y.programs.length - x.programs.length || y.courses - x.courses)] as const);
  }, [data, campus]);

  const totals = useMemo(() => {
    const f = data?.faculties ?? [];
    return {
      faculties: f.filter((x) => x.name.startsWith("คณะ") || x.name.startsWith("วิทยาลัย")).length,
      depts: f.reduce((n, x) => n + x.depts.length, 0),
      courses: f.reduce((n, x) => n + x.courses, 0),
      programs: f.reduce((n, x) => n + x.programs.length, 0),
    };
  }, [data]);

  const usePlan = (f: { campus: string; curriculumId?: string }, p: FacultyProgram) => {
    timetableStore.setCurriculum({
      curriculumId: f.curriculumId ?? "sci",
      division: p.division,
      programId: p.id,
      editionYear: p.editions[0] ?? 0,
      plan: "",
      year: 1,
    });
    timetableStore.setPrefs({ panel: "curriculum" });
    router.push("/timetable");
  };

  const showingSearch = deferred.length >= 2 && search?.q === deferred;

  return (
    <div className="container mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">คณะ & หลักสูตร ม.อ.</h1>
          <p className="text-sm text-gray-500">
            ทุกคณะ ทุกวิทยาเขต จากข้อมูลรายวิชาใน SIS{data ? ` ภาค ${data.term.label}` : ""} พร้อมแผนการศึกษาที่มีในระบบ
          </p>
        </div>
      </div>

      {/* stats */}
      <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "คณะ / วิทยาลัย", value: totals.faculties, icon: Building2 },
          { label: "สาขา / ภาควิชา", value: totals.depts, icon: Layers },
          { label: "แผนการศึกษา", value: totals.programs, icon: BookMarked },
          { label: "รายวิชาที่เปิดสอน", value: totals.courses, icon: BookOpen },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <dd className="text-lg font-bold text-gray-900 tabular-nums">{data ? value.toLocaleString() : "–"}</dd>
              <dt className="text-[11px] text-gray-500">{label}</dt>
            </div>
          </div>
        ))}
      </dl>

      {/* search + campus */}
      <div className="sticky top-16 z-20 -mx-3 mb-5 space-y-2 border-b border-gray-100 bg-gray-50/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:px-4 sm:shadow-sm">
        <label className="relative block">
          <span className="sr-only">ค้นหาคณะ สาขา หลักสูตร หรือรายวิชา</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาคณะ สาขา หลักสูตร หรือรายวิชา เช่น “วิศวกรรม”, “ชีววิทยา”, “240-”"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pr-9 pl-9 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-700" aria-label="ล้างคำค้น">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        {!showingSearch && (
          <div className="no-scrollbar -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <Segmented
              aria-label="วิทยาเขต"
              size="sm"
              value={campus}
              onChange={setCampus}
              options={[{ value: "all", label: "ทุกวิทยาเขต" }, ...campuses.map(([c, n]) => ({ value: c, label: `${c} (${n})` }))]}
            />
          </div>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {showingSearch ? (
        <SearchResults res={search!.res} faculties={data?.faculties ?? []} onOpen={setSelected} onUsePlan={usePlan} />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([c, list]) => (
            <section key={c}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-800">
                <span className={cn("h-2.5 w-2.5 rounded-full bg-linear-to-br", CAMPUS_TONE[c] ?? "from-gray-400 to-gray-600")} />
                วิทยาเขต{c} <span className="font-normal text-gray-400">· {list.length} หน่วยงาน</span>
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((f) => (
                  <li key={f.key}>
                    <button
                      type="button"
                      onClick={() => setSelected(f)}
                      className="group flex h-full w-full flex-col rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm", CAMPUS_TONE[c] ?? "from-gray-400 to-gray-600")}>
                          <GraduationCap className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug font-semibold text-gray-900 group-hover:text-indigo-700">{f.name}</p>
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            {f.courses.toLocaleString()} รายวิชา · {f.depts.length} สาขา
                            {f.geCourses ? ` · GE ${f.geCourses}` : ""}
                          </p>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-300 group-hover:text-indigo-500" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {f.programs.length > 0 && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                            มีแผนการศึกษา {f.programs.length} หลักสูตร
                          </span>
                        )}
                        {f.depts.slice(0, 2).map((d) => (
                          <span key={d.name} className="max-w-full truncate rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                            {d.name.replace(/^(ภาควิชา|สาขาวิชา)/, "")}
                          </span>
                        ))}
                        {f.depts.length > 2 && <span className="text-[10px] text-gray-400">+{f.depts.length - 2}</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <FacultyDialog faculty={selected} termLabel={data?.term.label} onClose={() => setSelected(null)} onUsePlan={usePlan} />
    </div>
  );
}

function SearchResults({
  res,
  faculties,
  onOpen,
  onUsePlan,
}: {
  res: SearchResponse;
  faculties: FacultySummary[];
  onOpen: (f: FacultySummary) => void;
  onUsePlan: (f: { campus: string; curriculumId?: string }, p: FacultyProgram) => void;
}) {
  const byKey = new Map(faculties.map((f) => [f.key, f]));
  const empty = !res.faculties.length && !res.depts.length && !res.programs.length && !res.courses.length;
  if (empty) return <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">ไม่พบผลลัพธ์</p>;
  return (
    <div className="space-y-5">
      {res.programs.length > 0 && (
        <ResultSection title="แผนการศึกษา (หลักสูตร)" count={res.programs.length}>
          {res.programs.map((p) => (
            <li key={`${p.key}-${p.id}`} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3">
              <BookMarked className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                <p className="text-[11px] text-gray-500">
                  {p.division} · {p.faculty} · หลักสูตร {p.editions.join(" / ")}
                </p>
              </div>
              <button type="button" onClick={() => onUsePlan(p, p)} className="flex shrink-0 items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                จัดตาราง <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ResultSection>
      )}
      {res.faculties.length > 0 && (
        <ResultSection title="คณะ" count={res.faculties.length}>
          {res.faculties.map((f) => (
            <li key={f.key}>
              <button type="button" onClick={() => onOpen(byKey.get(f.key) ?? f)} className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left hover:border-indigo-300">
                <Building2 className="h-5 w-5 shrink-0 text-indigo-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-900">{f.name}</span>
                  <span className="text-[11px] text-gray-500">{f.campus} · {f.courses} รายวิชา</span>
                </span>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
            </li>
          ))}
        </ResultSection>
      )}
      {res.depts.length > 0 && (
        <ResultSection title="สาขา / ภาควิชา" count={res.depts.length}>
          {res.depts.map((d) => (
            <li key={`${d.key}-${d.name}`}>
              <button
                type="button"
                onClick={() => {
                  const f = byKey.get(d.key);
                  if (f) onOpen(f);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left hover:border-indigo-300"
              >
                <Layers className="h-5 w-5 shrink-0 text-violet-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-900">{d.name}</span>
                  <span className="text-[11px] text-gray-500">
                    {d.faculty} · {shortCampus(d.campus)} · {d.courses} รายวิชา
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ResultSection>
      )}
      {res.courses.length > 0 && (
        <ResultSection title="รายวิชา" count={res.courses.length}>
          {res.courses.map((c) => (
            <li key={c.id}>
              <CourseRow c={c} />
            </li>
          ))}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-gray-800">
        {title} <span className="font-normal text-gray-400">· {count}</span>
      </h2>
      <ul className="grid gap-2 md:grid-cols-2">{children}</ul>
    </section>
  );
}

function CourseRow({ c }: { c: FacultyCourse }) {
  return (
    <Link
      href={`/timetable?q=${encodeURIComponent(c.code)}`}
      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 hover:border-emerald-300"
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-mono font-semibold text-gray-900">{c.code}</span>
          {c.ge[0] && <GeBadge ge={c.ge[0]} size="xs" />}
          <span className="text-[11px] text-gray-400">{c.creditNum} นก. · {c.sections} Sec</span>
        </p>
        <p className="truncate text-[13px] text-gray-700">{c.nameTh}</p>
        <p className="truncate text-[10px] text-gray-400">
          {c.dept || c.faculty} · {shortCampus(c.campus)}
        </p>
      </div>
      <CalendarRange className="h-4 w-4 shrink-0 text-gray-300" />
    </Link>
  );
}

function FacultyDialog({
  faculty: incoming,
  termLabel,
  onClose,
  onUsePlan,
}: {
  faculty: FacultySummary | null;
  termLabel?: string;
  onClose: () => void;
  onUsePlan: (f: { campus: string; curriculumId?: string }, p: FacultyProgram) => void;
}) {
  const [faculty, setFaculty] = useState(incoming);
  if (incoming && incoming !== faculty) setFaculty(incoming);
  const [courses, setCourses] = useState<{ key: string; list: FacultyCourse[] } | null>(null);
  const [dept, setDept] = useState("all");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"programs" | "courses">("programs");
  const [prevKey, setPrevKey] = useState<string | null>(null);
  if (faculty && faculty.key !== prevKey) {
    setPrevKey(faculty.key);
    setDept("all");
    setQ("");
    setTab(faculty.programs.length ? "programs" : "courses");
  }

  useEffect(() => {
    if (!incoming) return;
    let cancelled = false;
    fetch(`/api/faculties?faculty=${encodeURIComponent(incoming.name)}&campus=${encodeURIComponent(incoming.campus)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ courses: FacultyCourse[] }>) : null))
      .then((d) => !cancelled && d && setCourses({ key: incoming.key, list: d.courses }));
    return () => {
      cancelled = true;
    };
  }, [incoming]);

  const list = courses && faculty && courses.key === faculty.key ? courses.list : null;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list ?? []).filter((c) => (dept === "all" || c.dept === dept) && (!s || `${c.code} ${c.nameTh} ${c.nameEn}`.toLowerCase().includes(s)));
  }, [list, dept, q]);

  const divisions = useMemo(() => {
    const m = new Map<string, FacultyProgram[]>();
    faculty?.programs.forEach((p) => m.set(p.division, [...(m.get(p.division) ?? []), p]));
    return [...m.entries()];
  }, [faculty]);

  return (
    <Dialog
      open={!!incoming}
      onClose={onClose}
      size="lg"
      title={faculty?.name}
      description={faculty ? `${faculty.campus} · ${faculty.courses.toLocaleString()} รายวิชาในภาค ${termLabel ?? ""} · ${faculty.depts.length} สาขา` : undefined}
      icon={<Building2 className="h-5 w-5" />}
      iconClassName="bg-indigo-100 text-indigo-700"
    >
      {faculty && (
        <div className="space-y-4">
          <Segmented
            aria-label="ข้อมูลคณะ"
            className="flex w-full"
            value={tab}
            onChange={setTab}
            options={[
              { value: "programs", label: faculty.programs.length ? `หลักสูตร (${faculty.programs.length})` : "สาขา" },
              { value: "courses", label: "รายวิชาภาคนี้" },
            ]}
          />

          {tab === "programs" ? (
            <div className="space-y-4">
              {divisions.map(([division, programs]) => (
                <div key={division}>
                  <p className="mb-1.5 text-xs font-semibold text-gray-500">{division}</p>
                  <ul className="space-y-1.5">
                    {programs.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                        <BookMarked className="h-4 w-4 shrink-0 text-emerald-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                          <p className="text-[11px] text-gray-500">
                            {p.editions.map((y) => `หลักสูตร ${y}`).join(" · ")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onUsePlan(faculty, p)}
                          className="flex shrink-0 items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          ใช้แผนนี้จัดตาราง <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-gray-500">สาขา / ภาควิชาที่เปิดสอนภาคนี้</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {faculty.depts.map((d) => (
                    <li key={d.name}>
                      <button
                        type="button"
                        onClick={() => {
                          setDept(d.name);
                          setTab("courses");
                        }}
                        className="flex w-full items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 text-left text-xs hover:border-indigo-300"
                      >
                        <Layers className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                        <span className="min-w-0 flex-1 truncate text-gray-800">{d.name}</span>
                        <span className="text-gray-400 tabular-nums">{d.courses}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {!faculty.programs.length && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  ยังไม่มีแผนการศึกษารายภาคของคณะนี้ในระบบ — ดูรายวิชาที่เปิดสอนแยกตามสาขาได้ที่แท็บ “รายวิชาภาคนี้”
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="ค้นหารหัส / ชื่อวิชา"
                    className="h-10 w-full rounded-xl border border-gray-200 pr-3 pl-9 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </label>
                {dept !== "all" && (
                  <button type="button" onClick={() => setDept("all")} className="flex h-10 items-center gap-1 rounded-xl bg-violet-50 px-3 text-xs font-medium text-violet-700">
                    <span className="max-w-48 truncate">{dept}</span> <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {!list ? (
                <p className="flex items-center justify-center gap-2 py-8 text-xs text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดรายวิชา…
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-gray-500">{filtered.length} รายวิชา · แตะเพื่อเปิดในหน้าจัดตารางเรียน</p>
                  <ul className="grid gap-2">
                    {filtered.slice(0, 120).map((c) => (
                      <li key={c.id}>
                        <CourseRow c={c} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <p className="flex items-center gap-1 text-[10px] text-gray-400">
            <MapPin className="h-3 w-3" /> สาขาและรายวิชาจากข้อมูลการเปิดสอนใน SIS — หลักสูตรที่ไม่เปิดสอนวิชาในภาคนี้อาจไม่ปรากฏ
          </p>
        </div>
      )}
    </Dialog>
  );
}
