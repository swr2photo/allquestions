"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Cloud,
  CloudCheck,
  CloudOff,
  Download,
  Ellipsis,
  FileText,
  FolderOpen,
  ImageDown,
  LayoutList,
  Link2,
  ListChecks,
  Loader2,
  Printer,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  PALETTE,
  TERM_NAMES,
  decodePlan,
  encodePlan,
  examsToIcs,
  findConflicts,
  fmtExam,
  nextColor,
  randomSchedule,
  resolvePlan,
  sectionClashes,
  sectionExamClashes,
  shortCampus,
  type Course,
  type PlanItem,
  type PlannedEntry,
  type ScheduleGroup,
  type TermData,
  type TermIndex,
  type TermIndexEntry,
} from "@/lib/timetable";
import {
  mergeRegistrationRecords,
  priorTermsFor,
  readRegistrationHistory,
  writeRegistrationHistory,
  type RegistrationHistory,
} from "@/lib/registration";
import { classifyCourse } from "@/lib/ge";
import type { SavedSchedule } from "@/lib/timetable-store";
import { timetableStore, useTimetableStore } from "@/hooks/use-timetable-store";
import { useGenedIndex } from "@/hooks/use-gened-index";
import { useDialogs } from "@/components/ui/confirm";
import { Select } from "@/components/ui/select";
import { Menu } from "@/components/ui/menu";
import { useIsDesktop } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { WeekGrid, type GhostBlock } from "./components/WeekGrid";
import { AgendaView } from "./components/AgendaView";
import { CourseSearch } from "./components/CourseSearch";
import { ExamSchedule } from "./components/ExamSchedule";
import { ConflictsDialog, CourseDetailDialog, CustomActivityDialog } from "./components/Dialogs";
import { RegistrationDialog } from "./components/RegistrationDialog";
import { SavedSchedulesDialog } from "./components/SavedSchedulesDialog";
import { ExportDialog } from "./components/ExportDialog";
import { StatsPanel } from "./components/StatsPanel";

const REG_AT_KEY = "psu-registration:v1:at";
const EMPTY_ITEMS: PlanItem[] = [];

function termTitle(t: { year: number; term: number }) {
  return `ปีการศึกษา ${t.year} · ${TERM_NAMES[t.term] ?? `ภาค ${t.term}`}`;
}

type View = "week" | "agenda" | "exam";

export default function TimetablePage() {
  const { store, user, status } = useTimetableStore();
  const { index: geIndex } = useGenedIndex();
  const { confirm, prompt } = useDialogs();
  const isDesktop = useIsDesktop();

  const [index, setIndex] = useState<TermIndex | null>(null);
  const [termId, setTermId] = useState<string>("");
  const [data, setData] = useState<TermData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [mobilePane, setMobilePane] = useState<"pick" | "plan">("pick");
  const [ghost, setGhost] = useState<GhostBlock | null>(null);
  const [detail, setDetail] = useState<Course | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [initialQuery, setInitialQuery] = useState("");
  const [localReg, setLocalReg] = useState<{ h: RegistrationHistory; at: number }>({
    h: { records: [], regradeCodes: [] },
    at: 0,
  });
  useEffect(() => {
    let at = 0;
    try {
      at = Number(localStorage.getItem(REG_AT_KEY)) || 0;
    } catch {
      /* ignore */
    }
    setLocalReg({ h: readRegistrationHistory(), at });
  }, []);

  const cache = useRef(new Map<string, TermData>());
  const sharedRef = useRef<{ termId: string; items: { courseId: string; sec: string }[] } | null>(null);
  const pendingAdd = useRef<string | null>(null);

  const effectiveView: View = view ?? (isDesktop ? "week" : "agenda");

  // registration history: local copy, or the account copy when sync is on and it is newer
  const remoteReg = store.registration;
  const syncReg = !!store.prefs.syncRegistration;
  const registration: RegistrationHistory = useMemo(
    () =>
      syncReg && remoteReg && remoteReg.updatedAt > localReg.at
        ? { records: remoteReg.records, regradeCodes: remoteReg.regradeCodes }
        : localReg.h,
    [syncReg, remoteReg, localReg]
  );

  // ---------------------------------------------------------------- loading
  const loadTerm = useCallback(
    async (entry: TermIndexEntry) => {
      setLoading(true);
      setError(null);
      setTermId(entry.id);
      try {
        let td = cache.current.get(entry.id);
        if (!td) {
          const res = await fetch(entry.file);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          td = (await res.json()) as TermData;
          cache.current.set(entry.id, td);
        }
        const shared = sharedRef.current;
        if (shared && shared.termId === entry.id) {
          sharedRef.current = null;
          const ids = new Set(td.courses.map((c) => c.id));
          const incoming: PlanItem[] = shared.items
            .filter((s) => ids.has(s.courseId))
            .map((s, i) => ({ kind: "course", courseId: s.courseId, sec: s.sec, color: i % PALETTE.length }));
          const existing = timetableStore.get().store.working[entry.id]?.items ?? [];
          if (
            incoming.length &&
            (existing.length === 0 ||
              (await confirm({
                title: "เปิดตารางที่แชร์มา?",
                description: `มี ${incoming.length} วิชา — ตารางที่จัดไว้ของภาคนี้จะถูกแทนที่ (บันทึกเก็บไว้ก่อนได้ที่ “ตารางที่บันทึก”)`,
                confirmText: "เปิดตารางที่แชร์",
                tone: "warning",
                icon: <Link2 className="h-5 w-5" />,
              })))
          ) {
            timetableStore.setWorking(entry.id, () => incoming);
            setActiveScheduleId(null);
          }
        }
        setData(td);
        const url = new URL(window.location.href);
        url.searchParams.set("term", entry.id);
        url.searchParams.delete("p");
        url.searchParams.delete("add");
        window.history.replaceState(null, "", url);
      } catch (e) {
        setError(`โหลดข้อมูลภาค ${entry.label} ไม่สำเร็จ (${e instanceof Error ? e.message : e})`);
      } finally {
        setLoading(false);
      }
    },
    [confirm]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/timetable/index.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const idx = (await res.json()) as TermIndex;
        if (cancelled) return;
        setIndex(idx);
        if (!idx.terms.length) {
          setError("ยังไม่มีข้อมูลภาคการศึกษาใดในระบบ");
          setLoading(false);
          return;
        }
        const params = new URLSearchParams(window.location.search);
        const entry = idx.terms.find((t) => t.id === params.get("term")) ?? idx.terms[0];
        const p = params.get("p");
        if (p) sharedRef.current = { termId: entry.id, items: decodePlan(p) };
        const q = params.get("q");
        if (q) {
          setInitialQuery(q);
          timetableStore.setPrefs({ panel: "search" });
        }
        pendingAdd.current = params.get("add");
        loadTerm(entry);
      } catch (e) {
        if (!cancelled) {
          setError(`โหลดรายการภาคการศึกษาไม่สำเร็จ (${e instanceof Error ? e.message : e})`);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTerm]);

  // ---------------------------------------------------------------- derived
  const items = (data && store.working[data.id]?.items) || EMPTY_ITEMS;
  const byId = useMemo(() => new Map((data?.courses ?? []).map((c) => [c.id, c])), [data]);
  const entries = useMemo(() => resolvePlan(items, byId), [items, byId]);
  const conflicts = useMemo(() => findConflicts(entries), [entries]);
  const conflictKeys = useMemo(() => {
    const s = new Set<string>();
    conflicts.filter((c) => c.type === "class").forEach((c) => (s.add(c.a.key), s.add(c.b.key)));
    return s;
  }, [conflicts]);
  const totalCredits = entries.reduce((n, e) => n + (e.credits || 0), 0);
  const courseCount = entries.filter((e) => e.item.kind === "course").length;
  const unscheduled = entries.filter((e) => e.slots.length === 0);
  const currentTerm = index?.terms.find((t) => t.id === termId);
  const geOf = useCallback(
    (e: PlannedEntry) => (e.course ? (classifyCourse(e.course, geIndex)?.levels[0] ?? null) : null),
    [geIndex]
  );
  const isGe = useCallback((e: PlannedEntry) => geOf(e) !== null, [geOf]);

  // ---------------------------------------------------------------- actions
  const setItems = useCallback(
    (fn: (items: PlanItem[]) => PlanItem[]) => {
      if (data) timetableStore.setWorking(data.id, fn);
    },
    [data]
  );

  const updateRegistration = (next: RegistrationHistory) => {
    const at = Date.now();
    setLocalReg({ h: next, at });
    writeRegistrationHistory(next);
    try {
      localStorage.setItem(REG_AT_KEY, String(at));
    } catch {
      /* ignore */
    }
    if (syncReg) timetableStore.setRegistrationMirror(next);
  };

  const setRegistrationSync = (on: boolean) => {
    if (on) {
      const merged: RegistrationHistory = {
        records: mergeRegistrationRecords(remoteReg?.records ?? [], registration.records),
        regradeCodes: [...new Set([...(remoteReg?.regradeCodes ?? []), ...registration.regradeCodes])],
      };
      timetableStore.setPrefs({ syncRegistration: true });
      setLocalReg({ h: merged, at: Date.now() });
      writeRegistrationHistory(merged);
      timetableStore.setRegistrationMirror(merged);
      toast.success("เปิดสำรองประวัติขึ้นบัญชีแล้ว");
    } else {
      // keep the local copy, wipe the server copy
      writeRegistrationHistory(registration);
      timetableStore.setPrefs({ syncRegistration: false });
      timetableStore.setRegistrationMirror({ records: [], regradeCodes: [] });
      toast.success("ปิดการสำรอง — ลบข้อมูลบนเซิร์ฟเวอร์แล้ว ข้อมูลในเครื่องยังอยู่");
    }
  };
  const addCourse = useCallback(
    (course: Course, sec: string) => {
      setItems((list) => {
        const existing = list.find((i) => i.kind === "course" && i.courseId === course.id);
        if (existing) return list.map((i) => (i === existing ? { ...existing, sec } : i));
        // same code from a different campus/curriculum already planned → replace it
        const sameCode = list.find((i) => i.kind === "course" && byId.get(i.courseId)?.code === course.code);
        const base = sameCode ? list.filter((i) => i !== sameCode) : list;
        return [...base, { kind: "course", courseId: course.id, sec, color: sameCode?.color ?? nextColor(list) }];
      });
      const section = course.sections.find((s) => s.sec === sec);
      const clashWith = section ? sectionClashes(section, entries, course.id) : [];
      if (clashWith.length) {
        toast.warning(`เพิ่ม ${course.code} Sec ${sec} แล้ว แต่เวลาเรียนชนกับ ${clashWith.map((e) => e.code).join(", ")}`, { duration: 4000 });
      } else {
        toast.success(`เพิ่ม ${course.code} Sec ${sec}`, { duration: 1500 });
      }
      const priorTerms = currentTerm
        ? priorTermsFor(registration, course.code, `${currentTerm.term}/${currentTerm.year}`)
        : [];
      if (priorTerms.length) {
        toast.warning(`${course.code} เคยลงทะเบียนแล้วใน ${priorTerms.join(", ")} (ถ้าเป็นวิชาตามรีเกรดให้ติ๊กในประวัติการลงทะเบียน)`, { duration: 6000 });
      }
    },
    [setItems, byId, entries, currentTerm, registration]
  );

  // ?add=<courseId> from the GenEd page
  useEffect(() => {
    const id = pendingAdd.current;
    if (!id || !data || !store.working) return;
    pendingAdd.current = null;
    const course = byId.get(id);
    if (!course) return;
    if (entries.some((e) => e.course?.id === id)) {
      toast.info(`${course.code} อยู่ในตารางแล้ว`);
      return;
    }
    const fit = course.sections.find(
      (s) => !sectionClashes(s, entries, course.id).length && !sectionExamClashes(s, entries, course.id).length
    );
    if (fit) {
      addCourse(course, fit.sec);
      return;
    }
    // every section clashes — let the student pick one instead of adding a clash silently
    timetableStore.setPrefs({ panel: "search" });
    setInitialQuery(course.code);
    setMobilePane("pick");
    toast.warning(`ทุก Sec ของ ${course.code} ชนกับตารางปัจจุบัน — เลือก Sec เองจากรายการค้นหา`, { duration: 5000 });
  }, [data, byId, entries, addCourse, store.working]);

  const randomizeTerm = (groups: ScheduleGroup[]) => {
    const customs = items.filter((i): i is Extract<PlanItem, { kind: "custom" }> => i.kind === "custom");
    const { picks, missing } = randomSchedule(groups, resolvePlan(customs, byId));
    setItems(() => {
      let next: PlanItem[] = customs;
      for (const { course, sec } of picks) next = [...next, { kind: "course", courseId: course.id, sec, color: nextColor(next) }];
      return next;
    });
    toast.success(`ล้างตารางเดิมและสุ่มใหม่ ${picks.length} วิชา`, { duration: 1500 });
    if (missing.length) toast.warning(`สุ่มไม่ได้ (ชนเวลา): ${missing.join(", ")}`, { duration: 4000 });
  };

  const removeEntry = (e: PlannedEntry) => setItems((list) => list.filter((i) => i !== e.item));
  const removeCourse = (courseId: string) =>
    setItems((list) => list.filter((i) => !(i.kind === "course" && i.courseId === courseId)));
  const changeSection = (e: PlannedEntry, sec: string) =>
    setItems((list) => list.map((i) => (i === e.item && i.kind === "course" ? { ...i, sec } : i)));

  const clearAll = async () => {
    if (!items.length) return;
    const ok = await confirm({
      title: `ล้างตารางเรียน ${currentTerm?.label ?? ""}?`,
      description: `${entries.length} รายการจะถูกนำออก — ตารางที่บันทึกไว้ในโฟลเดอร์ไม่ได้รับผลกระทบ`,
      confirmText: "ล้างตาราง",
      tone: "danger",
    });
    if (ok) {
      setItems(() => []);
      setActiveScheduleId(null);
    }
  };

  const share = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("term", termId);
    url.searchParams.set("p", encodePlan(items));
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success("คัดลอกลิงก์ตารางเรียนแล้ว");
    } catch {
      await prompt({ title: "ลิงก์ตารางเรียน", description: "คัดลอกลิงก์นี้ไปแชร์", defaultValue: url.toString(), copyOnly: true, icon: <Link2 className="h-5 w-5" /> });
    }
  };

  const downloadIcs = () => {
    const ics = examsToIcs(entries, currentTerm?.label ?? termId);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ตารางสอบ-${termId}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const openSchedule = (s: SavedSchedule) => {
    timetableStore.setWorking(s.termId, () => s.items);
    setActiveScheduleId(s.id);
    if (s.termId !== termId) {
      const entry = index?.terms.find((t) => t.id === s.termId);
      if (entry) loadTerm(entry);
      else toast.warning(`ไม่มีข้อมูลภาค ${s.termLabel ?? s.termId} ในระบบแล้ว`);
    }
    toast.success(`เปิด “${s.name}”`);
    setMobilePane("plan");
  };

  const hasExams = entries.some((e) => e.midterm || e.final);

  // ---------------------------------------------------------------- render
  return (
    <div className="mx-auto max-w-[1600px] px-3 pt-3 pb-28 sm:px-4 sm:pt-5 lg:pb-8">
      {/* header */}
      <div className="mb-3 flex flex-col gap-3 sm:mb-4 lg:flex-row lg:items-center lg:justify-between print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
            <CalendarRange className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-gray-900 sm:text-2xl">จัดตารางเรียน ม.อ.</h1>
            <p className="truncate text-xs text-gray-500">
              {currentTerm
                ? `${termTitle(currentTerm)} · ${currentTerm.courses.toLocaleString()} รายวิชา · ข้อมูลจาก SIS`
                : "ข้อมูลรายวิชาจาก SIS มหาวิทยาลัยสงขลานครินทร์"}
            </p>
          </div>
          <SyncPill status={status} signedIn={!!user} onClick={() => setSavedOpen(true)} className="lg:hidden" />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-32 shrink-0 sm:w-40">
            <Select
              label="ภาคการศึกษา"
              icon={<CalendarClock className="h-4 w-4" />}
              value={termId}
              disabled={!index || loading}
              onChange={(id) => {
                const t = index?.terms.find((x) => x.id === id);
                if (t) {
                  setActiveScheduleId(null);
                  loadTerm(t);
                }
              }}
              options={(index?.terms ?? []).map((t) => ({
                value: t.id,
                label: t.label,
                textValue: `ภาค ${t.label}`,
                description: `${t.courses.toLocaleString()} รายวิชา${t.complete ? "" : " · ข้อมูลไม่ครบ"}`,
              }))}
            />
          </div>
          <SyncPill status={status} signedIn={!!user} onClick={() => setSavedOpen(true)} className="hidden lg:flex" />
          <button
            type="button"
            onClick={() => setCheckOpen(true)}
            className={cn(
              "hidden h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold sm:flex",
              conflicts.length ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            )}
          >
            {conflicts.length ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            ตรวจสอบ{conflicts.length ? ` (${conflicts.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setSavedOpen(true)}
            className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 sm:flex-none"
          >
            <FolderOpen className="h-4 w-4 shrink-0" /> <span className="truncate sm:hidden">บันทึก</span>
            <span className="hidden truncate sm:inline">ตารางที่บันทึก</span>
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            disabled={!entries.length}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
          >
            <ImageDown className="h-4 w-4" /> <span className="hidden sm:inline">ส่งออกรูป</span>
          </button>
          <Menu
            label="เมนูเพิ่มเติม"
            trigger={(p) => (
              <button
                {...p}
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                aria-label="เมนูเพิ่มเติม"
              >
                <Ellipsis className="h-5 w-5" />
              </button>
            )}
            items={[
              {
                key: "check",
                label: `ตรวจสอบตาราง${conflicts.length ? ` (${conflicts.length})` : ""}`,
                icon: conflicts.length ? <AlertTriangle /> : <ShieldCheck />,
                onSelect: () => setCheckOpen(true),
              },
              { key: "reg", label: "ประวัติการลงทะเบียน (PDF)", icon: <FileText />, onSelect: () => setRegistrationOpen(true) },
              { key: "custom", label: "เพิ่มวิชา / กิจกรรมเอง", icon: <CalendarPlus />, onSelect: () => setCustomOpen(true) },
              { key: "save", label: "บันทึกเป็นตารางใหม่", icon: <Save />, onSelect: () => setSavedOpen(true), disabled: !items.length },
              { key: "share", label: "คัดลอกลิงก์แชร์", icon: <Link2 />, onSelect: share, disabled: !items.some((i) => i.kind === "course"), separator: true },
              { key: "ics", label: "ตารางสอบ .ics ลงปฏิทิน", icon: <Download />, onSelect: downloadIcs, disabled: !hasExams },
              { key: "print", label: "พิมพ์หน้านี้", icon: <Printer />, onSelect: () => window.print() },
              { key: "clear", label: "ล้างตาราง", icon: <Trash2 />, danger: true, separator: true, onSelect: clearAll, disabled: !items.length },
            ]}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* course picker */}
        <aside
          className={cn(
            "h-[calc(100dvh-13rem)] min-h-[26rem] overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/60 lg:sticky lg:top-20 lg:block lg:h-[calc(100vh-6.5rem)] print:hidden",
            mobilePane === "pick" ? "block" : "hidden"
          )}
        >
          {data ? (
            <CourseSearch
              key={data.id}
              courses={data.courses}
              termId={data.id}
              term={data.term}
              entries={entries}
              registration={registration}
              initialQuery={initialQuery}
              onAdd={addCourse}
              onRandomize={randomizeTerm}
              onRemove={removeCourse}
              onPreview={setGhost}
              onDetail={setDetail}
              onOpenRegistration={() => setRegistrationOpen(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} กำลังโหลดรายวิชา…
            </div>
          )}
        </aside>

        {/* plan */}
        <section className={cn("min-w-0 space-y-4 lg:block", mobilePane === "plan" ? "block" : "hidden")}>
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <div className="inline-flex rounded-xl bg-gray-100 p-1 text-sm" role="tablist">
              {(
                [
                  ["week", "ตารางเรียน", CalendarRange],
                  ["agenda", "รายวัน", LayoutList],
                  ["exam", "ตารางสอบ", CalendarDays],
                ] as const
              ).map(([v, label, Icon]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={effectiveView === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition",
                    effectiveView === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                {entries.length} วิชา · <span className="font-semibold text-gray-900">{totalCredits}</span> หน่วยกิต
              </span>
              {effectiveView === "exam" && hasExams && (
                <button type="button" onClick={downloadIcs} className="flex items-center gap-1 font-medium text-emerald-700 hover:underline">
                  <Download className="h-3.5 w-3.5" /> .ics
                </button>
              )}
            </div>
          </div>

          {activeScheduleId && store.schedules.find((s) => s.id === activeScheduleId) && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500 print:hidden">
              <FolderOpen className="h-3.5 w-3.5" /> กำลังแก้ “{store.schedules.find((s) => s.id === activeScheduleId)!.name}” — กด
              <button type="button" onClick={() => setSavedOpen(true)} className="font-semibold text-emerald-700 hover:underline">
                ตารางที่บันทึก → อัปเดต
              </button>
              เพื่อบันทึกการแก้ไข
            </p>
          )}

          <h2 className="hidden text-lg font-bold print:block">
            {effectiveView === "exam" ? "ตารางสอบ" : "ตารางเรียน"} {currentTerm && termTitle(currentTerm)} · {totalCredits} หน่วยกิต
          </h2>

          {effectiveView === "exam" ? (
            <ExamSchedule entries={entries} termLabel={currentTerm?.label ?? ""} />
          ) : (
            <>
              {effectiveView === "week" ? (
                <WeekGrid
                  entries={entries}
                  ghost={ghost}
                  conflictKeys={conflictKeys}
                  onSelect={(e) => e.course && setDetail(e.course)}
                  onRemove={removeEntry}
                />
              ) : (
                <AgendaView entries={entries} conflictKeys={conflictKeys} onSelect={(e) => e.course && setDetail(e.course)} onRemove={removeEntry} />
              )}
              {unscheduled.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-600">
                  <span className="font-medium">ยังไม่มีเวลาเรียนใน SIS:</span>
                  {unscheduled.map((e) => (
                    <span key={e.key} className="rounded-full bg-gray-100 px-2 py-0.5 font-mono">
                      {e.code} · Sec {e.sec}
                    </span>
                  ))}
                </div>
              )}
              <StatsPanel entries={entries} geOf={geOf} />
              <SelectedTable entries={entries} conflictKeys={conflictKeys} onRemove={removeEntry} onChangeSection={changeSection} onDetail={setDetail} />
            </>
          )}

          <p className="text-[11px] leading-relaxed text-gray-400 print:hidden">
            ข้อมูลรายวิชา section ผู้สอน เวลาเรียน และวันสอบ ดึงจาก sis.psu.ac.th
            {currentTerm && ` เมื่อ ${new Date(currentTerm.fetchedAt).toLocaleDateString("th-TH", { dateStyle: "medium" })}`} —
            ที่นั่งและเวลาอาจเปลี่ยนแปลง โปรดตรวจสอบกับระบบลงทะเบียนจริงก่อนลงทะเบียน ·{" "}
            {user ? "ตารางบันทึกลงบัญชีของคุณอัตโนมัติ" : "ตารางบันทึกไว้ในเบราว์เซอร์นี้ — เข้าสู่ระบบเพื่อบันทึกลงฐานข้อมูล"}
          </p>
        </section>
      </div>

      {/* mobile bottom bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur lg:hidden print:hidden"
        aria-label="สลับมุมมอง"
      >
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button
            type="button"
            onClick={() => setMobilePane("pick")}
            className={cn(
              "flex h-12 flex-1 flex-col items-center justify-center rounded-2xl text-[11px] font-semibold transition",
              mobilePane === "pick" ? "bg-emerald-600 text-white" : "text-gray-600"
            )}
          >
            <Search className="h-5 w-5" /> เลือกวิชา
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("plan")}
            className={cn(
              "relative flex h-12 flex-1 flex-col items-center justify-center rounded-2xl text-[11px] font-semibold transition",
              mobilePane === "plan" ? "bg-emerald-600 text-white" : "text-gray-600"
            )}
          >
            <ListChecks className="h-5 w-5" /> ตารางของฉัน
            {entries.length > 0 && (
              <span
                className={cn(
                  "absolute top-1 right-[22%] min-w-5 rounded-full px-1.5 text-[10px] leading-5",
                  conflicts.length ? "bg-red-500 text-white" : mobilePane === "plan" ? "bg-white text-emerald-700" : "bg-emerald-600 text-white"
                )}
              >
                {conflicts.length ? `!${conflicts.length}` : entries.length}
              </span>
            )}
          </button>
          <div className="flex h-12 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-gray-50 text-center">
            <span className="text-base leading-none font-bold text-gray-900 tabular-nums">{totalCredits}</span>
            <span className="text-[10px] text-gray-500">หน่วยกิต</span>
          </div>
        </div>
      </nav>

      <CourseDetailDialog course={detail} onClose={() => setDetail(null)} />
      <RegistrationDialog
        open={registrationOpen}
        onClose={() => setRegistrationOpen(false)}
        history={registration}
        onChange={updateRegistration}
        canSync={!!user}
        syncEnabled={syncReg}
        onSyncChange={setRegistrationSync}
      />
      <CustomActivityDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onSave={(v) => {
          setItems((list) => [
            ...list,
            { kind: "custom", id: Math.random().toString(36).slice(2, 10), ...v, color: nextColor(list) },
          ]);
          setCustomOpen(false);
        }}
      />
      <ConflictsDialog
        open={checkOpen}
        onClose={() => setCheckOpen(false)}
        conflicts={conflicts}
        unscheduled={unscheduled.map((e) => e.code)}
        totalCredits={totalCredits}
        maxCredits={currentTerm?.term === 3 ? 9 : 22}
      />
      <SavedSchedulesDialog
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        termId={termId}
        termLabel={currentTerm?.label ?? termId}
        items={items}
        credits={totalCredits}
        courseCount={courseCount}
        activeScheduleId={activeScheduleId}
        onOpenSchedule={openSchedule}
        onSaved={(s) => setActiveScheduleId(s.id)}
      />
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entries={entries}
        termId={termId}
        termLabel={currentTerm?.label ?? termId}
        totalCredits={totalCredits}
        isGe={isGe}
      />
    </div>
  );
}

function SyncPill({ status, signedIn, onClick, className }: { status: string; signedIn: boolean; onClick: () => void; className?: string }) {
  const meta = !signedIn
    ? { icon: CloudOff, text: "ในเครื่อง", cls: "border-gray-200 bg-white text-gray-500" }
    : status === "syncing"
      ? { icon: Loader2, text: "กำลังบันทึก", cls: "border-sky-200 bg-sky-50 text-sky-700" }
      : status === "error"
        ? { icon: AlertTriangle, text: "ซิงก์ไม่สำเร็จ", cls: "border-red-200 bg-red-50 text-red-700" }
        : status === "synced"
          ? { icon: CloudCheck, text: "บันทึกแล้ว", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" }
          : { icon: Cloud, text: "เชื่อมต่อแล้ว", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={signedIn ? "สถานะการบันทึกลงฐานข้อมูล" : "บันทึกในเบราว์เซอร์นี้เท่านั้น — แตะเพื่อเข้าสู่ระบบ"}
      className={cn("h-10 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold", meta.cls, className ?? "flex")}
    >
      <Icon className={cn("h-4 w-4", status === "syncing" && signedIn && "animate-spin")} />
      <span className="hidden sm:inline">{meta.text}</span>
    </button>
  );
}

function SelectedTable({
  entries,
  conflictKeys,
  onRemove,
  onChangeSection,
  onDetail,
}: {
  entries: PlannedEntry[];
  conflictKeys: Set<string>;
  onRemove: (e: PlannedEntry) => void;
  onChangeSection: (e: PlannedEntry, sec: string) => void;
  onDetail: (c: Course) => void;
}) {
  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
        ค้นหารายวิชา แล้วกด <span className="font-medium text-emerald-700">เลือก</span> ที่ section ที่ต้องการ — หรือใช้แท็บ{" "}
        <span className="font-medium text-violet-700">แนะนำ</span> ให้ระบบเลือกวิชาที่ไม่ชนตารางให้
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* phones: cards */}
      <ul className="divide-y divide-gray-100 md:hidden">
        {entries.map((e) => {
          const c = PALETTE[e.color % PALETTE.length];
          return (
            <li key={e.key} className={cn("flex items-start gap-3 px-3 py-3", conflictKeys.has(e.key) && "bg-red-50/60")}>
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: c.border }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-mono font-semibold text-gray-900">{e.code}</span>{" "}
                  <span className="text-xs text-gray-500">{e.credits || "-"} นก.</span>
                </p>
                <button type="button" onClick={() => e.course && onDetail(e.course)} className="text-left text-[13px] text-gray-700">
                  {e.name}
                </button>
                <div className="mt-1.5 flex items-center gap-2">
                  {e.course && e.course.sections.length > 1 ? (
                    <div className="w-28">
                      <Select
                        label={`Section ของ ${e.code}`}
                        size="sm"
                        value={e.sec}
                        onChange={(sec) => onChangeSection(e, sec)}
                        options={e.course.sections.map((s) => ({ value: s.sec, label: `Sec ${s.sec}`, description: s.dayTime }))}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">Sec {e.sec}</span>
                  )}
                  {e.final && <span className="truncate text-[11px] text-gray-500">ปลายภาค {fmtExam(e.final)}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(e)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`ลบ ${e.code}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
      {/* tablets / desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2">รหัสวิชา</th>
              <th className="px-3 py-2">ชื่อวิชา</th>
              <th className="px-3 py-2">Sec</th>
              <th className="px-3 py-2 text-center">นก.</th>
              <th className="px-3 py-2">ผู้สอน</th>
              <th className="px-3 py-2">สอบกลางภาค / ปลายภาค</th>
              <th className="px-3 py-2 print:hidden" aria-label="จัดการ" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 align-top">
            {entries.map((e) => {
              const c = PALETTE[e.color % PALETTE.length];
              return (
                <tr key={e.key} className={conflictKeys.has(e.key) ? "bg-red-50/60" : ""}>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2 font-mono font-semibold text-gray-900">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.border }} />
                      {e.code}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {e.course ? (
                      <button type="button" onClick={() => onDetail(e.course!)} className="text-left text-gray-800 hover:text-emerald-700 hover:underline">
                        {e.name}
                      </button>
                    ) : (
                      <span className="text-gray-800">{e.name}</span>
                    )}
                    {e.course && <p className="text-[10px] text-gray-400">{shortCampus(e.course.campus)}</p>}
                  </td>
                  <td className="px-3 py-2">
                    {e.course && e.course.sections.length > 1 ? (
                      <div className="w-24 print:hidden">
                        <Select
                          label={`Section ของ ${e.code}`}
                          size="sm"
                          value={e.sec}
                          onChange={(sec) => onChangeSection(e, sec)}
                          options={e.course.sections.map((s) => ({ value: s.sec, label: s.sec, description: s.dayTime }))}
                          minPopoverWidth={240}
                        />
                      </div>
                    ) : (
                      e.sec
                    )}
                    <span className="hidden print:inline">{e.sec}</span>
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{e.credits || "-"}</td>
                  <td className="px-3 py-2 text-gray-600">{e.instructors.join(", ") || "-"}</td>
                  <td className="px-3 py-2 text-gray-600">
                    <div>{e.midterm ? fmtExam(e.midterm) : e.midtermText}</div>
                    <div>{e.final ? fmtExam(e.final) : e.finalText}</div>
                  </td>
                  <td className="px-3 py-2 text-right print:hidden">
                    <button
                      type="button"
                      onClick={() => onRemove(e)}
                      className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`ลบ ${e.code}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
