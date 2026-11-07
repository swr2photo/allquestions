"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarPlus,
  Check,
  ExternalLink,
  FileUp,
  Earth,
  GraduationCap,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/checkbox";
import { GeBadge, GeIcon } from "@/components/ge-badge";
import { GE_AREAS, GE_META, baseCode, geArea, geProgress, genedLevels, type CreditItem, type GeKey } from "@/lib/ge";
import { readRegistrationHistory, type RegistrationHistory } from "@/lib/registration";
import { timetableStore, useTimetableStore } from "@/hooks/use-timetable-store";
import { useGenedIndex } from "@/hooks/use-gened-index";
import { shortCampus } from "@/lib/timetable";
import { cn } from "@/lib/utils";
import type { OfferedCourse } from "@/app/api/gened/offered/route";

interface GenedPost {
  id: number;
  title: string;
  slug: string;
  link: string;
  code: string | null;
  geLevels: string[];
  campuses: string[];
  ge8Groups: string[];
  sdgs: number[];
  legacyAreas: number[];
}

interface Summary {
  totalCourses: number;
  byGeLevel: Record<string, number>;
  byCampus: Record<string, number>;
  byGe8Group: Record<string, number>;
  bySdg: Record<string, number>;
  legacy: number;
}

interface CoursesResponse {
  courses: GenedPost[];
  summary: Summary;
  fetchedAt: number;
}

interface OfferedResponse {
  term: { id: string; label: string; year: number; term: number; fetchedAt: string };
  courses: OfferedCourse[];
}

const CAMPUS_ORDER = ["หาดใหญ่", "ปัตตานี", "ภูเก็ต", "สุราษฎร์ธานี", "ตรัง"];
const LEGACY_AREA: Record<number, string> = {
  1: "ศาสตร์พระราชาและประโยชน์เพื่อนมนุษย์",
  2: "ความเป็นพลเมืองและชีวิตที่สันติ",
  3: "การเป็นผู้ประกอบการ",
  4: "การรู้เท่าทันและการรู้ดิจิทัล",
  5: "การคิดเชิงระบบ ตรรกะและตัวเลข",
  6: "ภาษาและการสื่อสาร",
  7: "สุนทรียศาสตร์และกีฬา",
};

type Tab = "offered" | "all";

export default function GenEdPage() {
  const router = useRouter();
  const { store } = useTimetableStore();
  const { index: geIndex } = useGenedIndex();
  const [data, setData] = useState<CoursesResponse | null>(null);
  const [offered, setOffered] = useState<OfferedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<RegistrationHistory>({ records: [], regradeCodes: [] });

  const [tab, setTab] = useState<Tab>("offered");
  const [area, setArea] = useState<string>("all");
  const [campus, setCampus] = useState<string>("all");
  const [ge8Group, setGe8Group] = useState<string>("all");
  const [sdg, setSdg] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);

  const load = async (force?: boolean) => {
    if (force) setRefreshing(true);
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/gened/courses${force ? "?refresh=1" : ""}`, { cache: "no-store" }),
        fetch("/api/gened/offered"),
      ]);
      if (a.ok) setData((await a.json()) as CoursesResponse);
      else setError("ไม่สามารถโหลดข้อมูลจาก gened.psu.ac.th ได้ — แสดงเฉพาะวิชาที่เปิดสอนจาก SIS");
      if (b.ok) setOffered((await b.json()) as OfferedResponse);
      if (a.ok) setError(null);
      if (force && a.ok) {
        try {
          sessionStorage.removeItem("gened-index:v2");
        } catch {
          /* ignore */
        }
        toast.success("อัปเดตข้อมูลจาก gened.psu.ac.th แล้ว");
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/gened/courses").then((r) => (r.ok ? (r.json() as Promise<CoursesResponse>) : null)),
      fetch("/api/gened/offered").then((r) => (r.ok ? (r.json() as Promise<OfferedResponse>) : null)),
    ])
      .then(([a, b]) => {
        if (cancelled) return;
        setData(a);
        setOffered(b);
        if (!a) setError("ไม่สามารถโหลดข้อมูลจาก gened.psu.ac.th ได้ — แสดงเฉพาะวิชาที่เปิดสอนจาก SIS");
        setRegistration(readRegistrationHistory());
      })
      .catch(() => !cancelled && setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------------ personal GE progress
  const termId = offered?.term.id;
  const offeredById = useMemo(() => new Map((offered?.courses ?? []).map((c) => [c.id, c])), [offered]);
  const plannedIds = useMemo(() => {
    const items = termId ? (store.working[termId]?.items ?? []) : [];
    return new Set(items.flatMap((i) => (i.kind === "course" ? [i.courseId] : [])));
  }, [store.working, termId]);

  const progress = useMemo(() => {
    const items: CreditItem[] = registration.records.map((r) => ({ code: r.code, name: r.name, credits: r.credits, status: "done" }));
    for (const id of plannedIds) {
      const c = offeredById.get(id);
      if (c) items.push({ code: c.code, name: c.nameTh, credits: c.creditNum, status: "planned" });
    }
    return geProgress(items, geIndex);
  }, [registration.records, plannedIds, offeredById, geIndex]);
  const hasPersonal = registration.records.length > 0 || plannedIds.size > 0;
  const takenBase = useMemo(
    () => new Set(registration.records.filter((r) => !registration.regradeCodes.includes(r.code)).map((r) => baseCode(r.code) ?? r.code)),
    [registration]
  );

  // ------------------------------------------------------------------ filters
  const offeredBase = useMemo(() => {
    const m = new Map<string, OfferedCourse[]>();
    for (const c of offered?.courses ?? []) {
      const b = baseCode(c.code) ?? c.code;
      m.set(b, [...(m.get(b) ?? []), c]);
    }
    return m;
  }, [offered]);

  const campuses = useMemo(() => {
    const s = new Set<string>();
    (offered?.courses ?? []).forEach((c) => s.add(shortCampus(c.campus)));
    Object.keys(data?.summary.byCampus ?? {}).forEach((c) => s.add(c));
    return CAMPUS_ORDER.filter((c) => s.has(c));
  }, [offered, data]);

  const q = query.trim().toLowerCase();
  const matchArea = (levels: string[]) => area === "all" || levels.some((l) => (GE_AREAS as readonly string[]).includes(area) && geArea(l as GeKey) === area);

  const offeredList = useMemo(() => {
    const list = (offered?.courses ?? []).filter((c) => {
      if (!matchArea(c.ge)) return false;
      if (campus !== "all" && shortCampus(c.campus) !== campus) return false;
      if (ge8Group !== "all" && !c.ge8Groups.includes(ge8Group)) return false;
      if (sdg !== "all" && !c.sdgs.includes(Number(sdg))) return false;
      if (q && !`${c.code} ${c.nameTh} ${c.nameEn}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // courses in areas you still miss first, then not-yet-taken, then by code
    const missing = new Set<string>(progress.missingAreas);
    return list.sort(
      (a, b) =>
        Number(missing.has(geArea(b.ge[0]))) - Number(missing.has(geArea(a.ge[0]))) ||
        Number(takenBase.has(baseCode(a.code) ?? "")) - Number(takenBase.has(baseCode(b.code) ?? "")) ||
        a.code.localeCompare(b.code)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchArea depends only on `area`
  }, [offered, area, campus, ge8Group, sdg, q, progress.missingAreas, takenBase]);

  const allList = useMemo(() => {
    return (data?.courses ?? []).filter((c) => {
      const levels = genedLevels(c);
      if (area === "legacy") {
        if (!(c.legacyAreas?.length && !levels.length)) return false;
      } else if (!matchArea(levels)) return false;
      if (campus !== "all" && !c.campuses.includes(campus)) return false;
      if (ge8Group !== "all" && !c.ge8Groups.includes(ge8Group)) return false;
      if (sdg !== "all" && !c.sdgs.includes(Number(sdg))) return false;
      if (q && !`${c.title} ${c.slug} ${c.code ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchArea depends only on `area`
  }, [data, area, campus, ge8Group, sdg, q]);

  const countsByArea = useMemo(() => {
    const m: Record<string, { offered: number; all: number }> = {};
    for (const a of GE_AREAS) m[a] = { offered: 0, all: 0 };
    for (const c of offered?.courses ?? []) if (c.ge[0]) m[geArea(c.ge[0])].offered++;
    for (const c of data?.courses ?? []) {
      const l = genedLevels(c)[0];
      if (l) m[geArea(l)].all++;
    }
    return m;
  }, [offered, data]);

  const resetPaging = () => setLimit(30);
  const filtersActive = area !== "all" || campus !== "all" || ge8Group !== "all" || sdg !== "all" || !!q;
  const shown = tab === "offered" ? offeredList : allList;

  const goRecommend = () => {
    timetableStore.setPrefs({ panel: "recommend" });
    router.push("/timetable");
  };

  return (
    <div className="container mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500 to-orange-500 text-white shadow-md">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">วิชาศึกษาทั่วไป & เลือกเสรี</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              หมวด GE1–GE8 จาก{" "}
              <a href="https://gened.psu.ac.th/" target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">
                gened.psu.ac.th <ExternalLink className="inline h-3 w-3" />
              </a>{" "}
              + วิชาที่เปิดสอนจริงจาก SIS
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} อัปเดตข้อมูล
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* personal */}
      <section className="mb-5 overflow-hidden rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 via-white to-amber-50/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">หมวดที่ควรลงเพิ่ม</h2>
            <p className="text-xs text-gray-600">
              {hasPersonal
                ? `คำนวณจากประวัติลงทะเบียน (${registration.records.length} รายการ) และตารางเรียนภาค ${offered?.term.label ?? ""}`
                : "นำเข้าประวัติลงทะเบียน (PDF) ในหน้าจัดตารางเรียน เพื่อดูว่ายังขาดหมวดไหน"}
            </p>
          </div>
          <button
            type="button"
            onClick={goRecommend}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            แนะนำวิชาที่ไม่ชนตาราง <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {GE_AREAS.map((a) => {
            const v = progress.byArea[a];
            const credits = v.done + v.planned;
            const missing = hasPersonal && progress.missingAreas.includes(a);
            const active = area === a;
            return (
              <button
                key={a}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setArea(active ? "all" : a);
                  setGe8Group("all");
                  resetPaging();
                }}
                title={`${a} ${GE_META[a].name}`}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl border bg-white/80 px-1 py-2 text-center transition",
                  active ? "border-violet-500 ring-2 ring-violet-500/30" : missing ? "border-dashed border-amber-400" : "border-gray-100 hover:border-gray-300"
                )}
              >
                <GeIcon ge={a} className={cn("h-5 w-5", missing ? "text-amber-600" : "text-gray-600")} />
                <span className="text-xs font-bold text-gray-900">{a}</span>
                <span className="line-clamp-1 text-[10px] text-gray-500">{GE_META[a].short}</span>
                <span className={cn("text-[10px] font-semibold tabular-nums", missing ? "text-amber-700" : credits ? "text-emerald-700" : "text-gray-400")}>
                  {!hasPersonal ? `${countsByArea[a].offered} เปิด` : missing ? "ยังไม่มี" : `${credits} นก.`}
                </span>
              </button>
            );
          })}
        </div>
        {!hasPersonal && (
          <Link
            href="/timetable"
            onClick={() => timetableStore.setPrefs({ panel: "recommend" })}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 hover:underline"
          >
            <FileUp className="h-3.5 w-3.5" /> ไปนำเข้าผลการลงทะเบียน
          </Link>
        )}
      </section>

      {/* filters */}
      <div className="sticky top-16 z-20 -mx-3 mb-4 space-y-3 border-b border-gray-100 bg-gray-50/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:px-4 sm:shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Segmented
            aria-label="แหล่งข้อมูล"
            className="flex w-full sm:w-auto"
            value={tab}
            onChange={(v) => {
              setTab(v);
              if (v === "offered" && area === "legacy") setArea("all");
              resetPaging();
            }}
            options={[
              { value: "offered", label: `เปิดสอน ${offered ? `ภาค ${offered.term.label}` : "ภาคนี้"}` },
              { value: "all", label: "ทั้งหมดจาก gened" },
            ]}
          />
          <label className="relative block flex-1">
            <span className="sr-only">ค้นหา</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                resetPaging();
              }}
              placeholder="ค้นหาชื่อวิชา หรือรหัสวิชา…"
              className="h-10 w-full rounded-xl border border-gray-200 bg-white pr-9 pl-9 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-700" aria-label="ล้างคำค้น">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select
            label="หมวด"
            size="sm"
            value={area}
            onChange={(v) => {
              setArea(v);
              setGe8Group("all");
              resetPaging();
            }}
            options={[
              { value: "all", label: "ทุกหมวด" },
              ...GE_AREAS.map((a) => ({
                value: a,
                label: `${a} ${GE_META[a].short}`,
                textValue: `${a} ${GE_META[a].name}`,
                description: GE_META[a].name,
                icon: <GeIcon ge={a} className="h-4 w-4" />,
                meta: tab === "offered" ? countsByArea[a].offered : countsByArea[a].all,
              })),
              ...(tab === "all" && data?.summary.legacy
                ? [{ value: "legacy", label: "หลักสูตรก่อน 2565", description: "สาระที่ 1–7 (ไม่ใช่ GE1–GE8)", meta: data.summary.legacy }]
                : []),
            ]}
          />
          <Select
            label="วิทยาเขต"
            size="sm"
            icon={<MapPin className="h-3.5 w-3.5" />}
            value={campus}
            onChange={(v) => {
              setCampus(v);
              resetPaging();
            }}
            options={[{ value: "all", label: "ทุกวิทยาเขต" }, ...campuses.map((c) => ({ value: c, label: c }))]}
          />
          <Select
            label="กลุ่ม GE8"
            size="sm"
            value={ge8Group}
            disabled={area !== "all" && area !== "GE8"}
            onChange={(v) => {
              setGe8Group(v);
              resetPaging();
            }}
            options={[
              { value: "all", label: "ทุกกลุ่ม GE8" },
              ...Object.entries(data?.summary.byGe8Group ?? {})
                .sort((a, b) => b[1] - a[1])
                .map(([g, n]) => ({ value: g, label: g, meta: n })),
            ]}
          />
          <Select
            label="เป้าหมาย SDGs"
            size="sm"
            icon={<Earth className="h-3.5 w-3.5" />}
            value={sdg}
            onChange={(v) => {
              setSdg(v);
              resetPaging();
            }}
            options={[
              { value: "all", label: "ทุก SDG" },
              ...Object.entries(data?.summary.bySdg ?? {})
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([n, count]) => ({ value: n, label: `SDG ${n}`, meta: count })),
            ]}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            พบ <b className="text-gray-900">{shown.length.toLocaleString()}</b> {tab === "offered" ? "วิชาที่เปิดสอน" : "รายวิชา"}
          </span>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setArea("all");
                setCampus("all");
                setGe8Group("all");
                setSdg("all");
                setQuery("");
                resetPaging();
              }}
              className="font-medium text-amber-700 hover:underline"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* list */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">ไม่พบรายวิชาที่ตรงกับเงื่อนไข</p>
        </div>
      ) : tab === "offered" ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {offeredList.slice(0, limit).map((c) => {
            const planned = plannedIds.has(c.id);
            const taken = takenBase.has(baseCode(c.code) ?? "");
            const missing = hasPersonal && progress.missingAreas.includes(geArea(c.ge[0]));
            return (
              <li key={c.id} className={cn("flex flex-col rounded-2xl border bg-white p-4 transition hover:shadow-md", missing ? "border-amber-200" : "border-gray-200")}>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 ring-1 ring-gray-100">
                    <GeIcon ge={c.ge[0]} className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-sm font-bold text-gray-900">{c.code}</span>
                      <GeBadge ge={c.ge[0]} size="xs" withName />
                      {missing && <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-800">หมวดที่ขาด</span>}
                      {taken && <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] text-gray-600">เคยลงแล้ว</span>}
                    </div>
                    <p className="mt-1 text-sm leading-snug font-medium text-gray-900">{c.nameTh}</p>
                    <p className="truncate text-[11px] text-gray-400 uppercase">{c.nameEn}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {shortCampus(c.campus)}
                  </span>
                  <span>{c.creditNum} นก. · {c.sections} Sec</span>
                  {c.seats !== null && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {c.seats.toLocaleString()} ที่
                    </span>
                  )}
                  {c.online && (
                    <span className="flex items-center gap-1 text-sky-700">
                      <Wifi className="h-3 w-3" /> ออนไลน์
                    </span>
                  )}
                  <span className="truncate">{c.firstSlot}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-gray-50 pt-3">
                  {c.link && (
                    <a href={c.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-700">
                      รายละเอียด <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {planned ? (
                    <span className="ml-auto flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <Check className="h-3.5 w-3.5" /> อยู่ในตารางแล้ว
                    </span>
                  ) : (
                    <Link
                      href={`/timetable?term=${encodeURIComponent(termId ?? "")}&add=${encodeURIComponent(c.id)}`}
                      className="ml-auto flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" /> เพิ่มลงตาราง
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {allList.slice(0, limit).map((c) => {
            const levels = genedLevels(c);
            const base = c.code ?? baseCode(c.slug);
            const open = base ? offeredBase.get(base) : undefined;
            return (
              <li key={c.id}>
                <a
                  href={c.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-amber-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                      {levels[0] ? <GeIcon ge={levels[0]} className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug font-semibold text-gray-900 group-hover:text-amber-800">{c.title}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {levels.map((g) => (
                          <GeBadge key={g} ge={g} size="xs" />
                        ))}
                        {!levels.length &&
                          c.legacyAreas?.map((n) => (
                            <span key={n} title={LEGACY_AREA[n]} className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-medium text-gray-600">
                              หลักสูตรเก่า สาระ {n}
                            </span>
                          ))}
                        {c.ge8Groups.map((g) => (
                          <span key={g} className="rounded-full bg-orange-50 px-1.5 py-px text-[10px] text-orange-800">
                            {g}
                          </span>
                        ))}
                        {c.campuses.map((camp) => (
                          <span key={camp} className="flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-px text-[10px] text-gray-600">
                            <MapPin className="h-2.5 w-2.5" /> {camp}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-gray-300 group-hover:text-amber-500" />
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-[11px] text-gray-400">
                    {base && <span className="font-mono">{base}</span>}
                    {c.sdgs.length > 0 && <span>SDG {c.sdgs.join(", ")}</span>}
                    {open ? (
                      <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                        เปิดสอนภาคนี้ {open.length > 1 ? `(${open.length} วิทยาเขต)` : ""}
                      </span>
                    ) : (
                      <span className="ml-auto">ไม่เปิดภาคนี้</span>
                    )}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {shown.length > limit && (
        <button
          type="button"
          onClick={() => setLimit(limit + 30)}
          className="mx-auto mt-5 flex h-10 items-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          แสดงเพิ่ม ({(shown.length - limit).toLocaleString()})
        </button>
      )}

      <p className="mt-8 text-center text-xs text-gray-400">
        {data && (
          <>
            gened.psu.ac.th อัปเดต {new Date(data.fetchedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
          </>
        )}
        {offered && <>SIS ภาค {offered.term.label} · </>}
        หมวด GE ของวิชาใน SIS อ้างอิงรหัสวิชา (…G1–G8) และหมวดบน gened.psu.ac.th
      </p>
    </div>
  );
}
