"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarRange,
  ChartColumn,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  Info,
  ListChecks,
  Loader2,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select";
import { Segmented } from "@/components/ui/checkbox";
import { useGenedIndex } from "@/hooks/use-gened-index";
import { SCI_CREDIT_STRUCTURES, findCreditStructure, structureTotal } from "@/data/credit-structures";
import {
  EMPTY_PREFS,
  buildCatalogCourses,
  editionPrefKey,
  readCreditCheckPrefs,
  resolveOverrides,
  summarizeCredits,
  termOrder,
  writeCreditCheckPrefs,
  type BucketChoice,
  type CheckedCourse,
  type CreditCheckPrefs,
} from "@/lib/credit-check";
import {
  REGISTRATION_AT_KEY,
  readRegistrationHistory,
  writeRegistrationHistory,
  type RegistrationHistory,
  type RegistrationRecord,
} from "@/lib/registration";
import type { CurriculumFile } from "@/lib/timetable";
import { cn } from "@/lib/utils";
import { Hero } from "./components/Hero";
import { ImportPanel } from "./components/ImportPanel";
import { SummaryPanel } from "./components/SummaryPanel";
import { CourseList } from "./components/CourseList";

const CURRICULUM_FILE = "/timetable/curricula/sci.json";

const CARD = "rounded-3xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]";

function StepCard({ step, title, hint, children }: { step: number; title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={cn(CARD, "p-4 sm:p-5")}>
      <div className="mb-3.5 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm shadow-emerald-600/30">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const PREVIEW: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Target, title: "ขาดอีกเท่าไร", text: "วงแหวนความคืบหน้ารวม และหน่วยกิตที่นับได้ของแต่ละหมวดเทียบกับเกณฑ์" },
  { icon: ListChecks, title: "ผ่านเกณฑ์ข้อไหนแล้ว", text: "ตรวจหน่วยกิตรายหมวด สาระ GE วิชาบังคับในแผน และเกรดเฉลี่ยสะสม" },
  { icon: ChartColumn, title: "เรียนไปแล้วแค่ไหน", text: "กราฟหน่วยกิตรายภาค แยกตามหมวด พร้อมประมาณจำนวนภาคที่เหลือ" },
];

export default function CreditCheckPage() {
  const { courses: geCourses, index: geIndex } = useGenedIndex();
  const [curricula, setCurricula] = useState<CurriculumFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [history, setHistory] = useState<RegistrationHistory>({ records: [], regradeCodes: [] });
  const [prefs, setPrefs] = useState<CreditCheckPrefs>(EMPTY_PREFS);
  const [ready, setReady] = useState(false);
  /** null = ตามสถานะ (ย่อเมื่อเลือกหลักสูตรและมีรายวิชาแล้ว) */
  const [setupOpen, setSetupOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    // localStorage is only readable after mount; apply it in a callback so the first paint matches the server render
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setHistory(readRegistrationHistory());
      setPrefs(readCreditCheckPrefs());
      setReady(true);
    });
    fetch(CURRICULUM_FILE)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: CurriculumFile) => !cancelled && setCurricula(json))
      .catch((e) => !cancelled && setLoadError(`โหลดข้อมูลหลักสูตรไม่สำเร็จ (${e instanceof Error ? e.message : e})`));
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePrefs = (patch: Partial<CreditCheckPrefs>) => {
    setPrefs((prev) => {
      const prevEdKey = editionPrefKey(prev.programId, prev.curriculumYear);
      const migrated =
        !prev.overridesByEdition && prevEdKey && Object.keys(prev.overrides).length > 0
          ? { [prevEdKey]: prev.overrides }
          : prev.overridesByEdition;
      const next: CreditCheckPrefs = {
        ...prev,
        ...(migrated ? { overridesByEdition: migrated } : {}),
        ...patch,
      };
      if (patch.programId !== undefined || patch.curriculumYear !== undefined) {
        const nextEdKey = editionPrefKey(next.programId, next.curriculumYear);
        next.overrides = nextEdKey ? (next.overridesByEdition?.[nextEdKey] ?? {}) : {};
      }
      writeCreditCheckPrefs(next);
      return next;
    });
  };

  const updateRecords = (records: RegistrationRecord[]) => {
    const next = { ...history, records };
    setHistory(next);
    writeRegistrationHistory(next);
    try {
      localStorage.setItem(REGISTRATION_AT_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  // ---------------------------------------------------------------- curriculum choice
  const programs = useMemo(
    () => (curricula?.programs ?? []).filter((p) => SCI_CREDIT_STRUCTURES.some((s) => s.programId === p.id)),
    [curricula]
  );
  const program = programs.find((p) => p.id === prefs.programId);
  const editions = useMemo(
    () =>
      (program?.editions ?? [])
        .filter((e) => findCreditStructure(program!.id, e.curriculumYear))
        .sort((a, b) => b.curriculumYear - a.curriculumYear),
    [program]
  );
  /** นักศึกษารหัส 69 ขึ้นไปใช้หลักสูตร 2569 — เดาจากภาคแรกที่ลงทะเบียน */
  const guessedYear = useMemo(() => {
    const first = Math.min(...history.records.map((r) => termOrder(r.term)).filter((n) => n < 99999));
    const years = editions.map((e) => e.curriculumYear).sort((a, b) => b - a);
    if (!years.length) return undefined;
    if (!Number.isFinite(first)) return years[0];
    return years.find((y) => Math.floor(first / 10) >= y) ?? years[years.length - 1];
  }, [history.records, editions]);
  const curriculumYear = editions.some((e) => e.curriculumYear === prefs.curriculumYear) ? prefs.curriculumYear : guessedYear;
  const edition = editions.find((e) => e.curriculumYear === curriculumYear);
  const structure = program && curriculumYear ? findCreditStructure(program.id, curriculumYear) : undefined;
  const plan = structure?.plans.find((p) => p.id === prefs.planId) ?? structure?.plans[0];

  const summary = useMemo(
    () => (structure && plan ? summarizeCredits(history.records, structure, plan, edition, prefs, geIndex) : null),
    [history.records, structure, plan, edition, prefs, geIndex]
  );

  // ฐานข้อมูลรายวิชา (ทุกสาขา + GE) มีขนาดใหญ่ — สร้างเมื่อเปิดหน้าต่าง "เพิ่มวิชาเอง" เท่านั้น
  const missing = summary?.missing;
  const programId = program?.id;
  const buildCatalog = useCallback(
    () => buildCatalogCourses({ curricula, programId, edition, plan, missing, geCourses }),
    [curricula, programId, edition, plan, missing, geCourses]
  );

  const programOptions: SelectOption<string>[] = programs.map((p) => ({ value: p.id, label: p.name, group: p.division }));
  const latestEditionYear = editions[0]?.curriculumYear;
  const editionOptions: SelectOption<number>[] = editions.map((e) => ({
    value: e.curriculumYear,
    label:
      editions.length > 1
        ? `หลักสูตรปรับปรุง พ.ศ. ${e.curriculumYear} (${e.curriculumYear === latestEditionYear ? "ล่าสุด" : "ปีเก่า"})`
        : `หลักสูตรปรับปรุง พ.ศ. ${e.curriculumYear}`,
    description: e.curriculumYear >= 2569 ? "นักศึกษารหัส 69 เป็นต้นไป" : `นักศึกษารหัส ${String(e.curriculumYear).slice(2)}–68`,
  }));

  // ---------------------------------------------------------------- row actions
  const setBucket = (base: string, bucket: BucketChoice, auto: BucketChoice) => {
    const edKey = editionPrefKey(program?.id, curriculumYear);
    setPrefs((prev) => {
      const current = resolveOverrides(prev, program?.id, curriculumYear);
      const nextOverrides = { ...current };
      if (bucket === auto) delete nextOverrides[base];
      else nextOverrides[base] = bucket;
      const prevEdKey = editionPrefKey(prev.programId, prev.curriculumYear);
      const overridesByEdition: Record<string, Record<string, BucketChoice>> = {
        ...(prev.overridesByEdition ?? {}),
        ...(!prev.overridesByEdition && prevEdKey && Object.keys(prev.overrides).length > 0
          ? { [prevEdKey]: prev.overrides }
          : {}),
        ...(edKey ? { [edKey]: nextOverrides } : {}),
      };
      const next: CreditCheckPrefs = {
        ...prev,
        overrides: nextOverrides,
        overridesByEdition,
      };
      writeCreditCheckPrefs(next);
      return next;
    });
  };
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  const removeCourse = (c: CheckedCourse) =>
    updateRecords(history.records.filter((r) => !(r.term === c.record.term && r.code === c.record.code && r.sec === c.record.sec)));

  const hasRecords = history.records.length > 0;
  const configured = !!structure && !!plan && hasRecords;
  const showSetup = setupOpen ?? !configured;
  const termCount = summary?.terms.length ?? 0;

  return (
    <div className="bg-linear-to-b from-emerald-50/70 via-gray-50 to-gray-50">
      <div className="container mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
        <Hero />

        {loadError && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {loadError}
          </div>
        )}

        {/* แถบสรุปการตั้งค่า (เมื่อเลือกหลักสูตรและนำเข้ารายวิชาแล้ว) */}
        {ready && configured && (
          <button
            type="button"
            onClick={() => setSetupOpen(!showSetup)}
            aria-expanded={showSetup}
            aria-controls="credit-setup"
            className={cn(
              CARD,
              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:px-5"
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <GraduationCap className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-gray-900">{program?.name}</span>
              <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-gray-500">
                <span>หลักสูตรปรับปรุง พ.ศ. {curriculumYear}</span>
                {structure!.plans.length > 1 && <span>· {plan!.label}</span>}
                <span className="tabular-nums">
                  · {history.records.length} รายการ จาก {termCount} ภาคการศึกษา
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
              <span className="hidden sm:inline">{showSetup ? "ซ่อนการตั้งค่า" : "เปลี่ยนหลักสูตร / นำเข้าเพิ่ม"}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showSetup && "rotate-180")} aria-hidden />
            </span>
          </button>
        )}

        {!ready && (
          <div className={cn(CARD, "flex items-center gap-2 px-5 py-6 text-sm text-gray-500")}>
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังเตรียมข้อมูล…
          </div>
        )}

        {ready && showSetup && (
          <div id="credit-setup" className="grid items-start gap-4 lg:grid-cols-2">
            <StepCard step={1} title="เลือกหลักสูตรของฉัน" hint="หลักสูตร วท.บ. ทุกสาขาของคณะวิทยาศาสตร์ ทั้งฉบับปรับปรุง พ.ศ. 2564 และ 2569">
              {!curricula && !loadError ? (
                <p className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดหลักสูตร…
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Select<string>
                      label="สาขาวิชา"
                      showLabel
                      placeholder="เลือกสาขาวิชา"
                      value={prefs.programId}
                      options={programOptions}
                      onChange={(id) => updatePrefs({ programId: id, curriculumYear: undefined, planId: undefined })}
                      className="w-full"
                      searchable
                    />
                    <Select<number>
                      label="ฉบับหลักสูตร"
                      showLabel
                      placeholder="เลือกสาขาก่อน"
                      disabled={!program}
                      value={curriculumYear}
                      options={editionOptions}
                      onChange={(year) => updatePrefs({ curriculumYear: year, planId: undefined })}
                      className="w-full"
                    />
                  </div>
                  {structure && plan && structure.plans.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">แผนการศึกษา</span>
                      <Segmented
                        size="sm"
                        aria-label="แผนการศึกษา"
                        value={plan.id}
                        onChange={(planId) => updatePrefs({ planId })}
                        options={structure.plans.map((p) => ({ value: p.id, label: p.label }))}
                      />
                    </div>
                  )}
                  {structure && plan && (
                    <div className="rounded-2xl bg-gray-50 px-3.5 py-3 text-xs leading-relaxed text-gray-700">
                      <p className="font-semibold text-gray-900">รวมตลอดหลักสูตร {structureTotal(structure, plan)} หน่วยกิต</p>
                      <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
                        <li>ศึกษาทั่วไป {structure.ge}</li>
                        <li>พื้นฐาน / แกน {structure.basic}</li>
                        <li>เอกบังคับ {plan.required}</li>
                        <li>เอกเลือก {plan.elective}</li>
                        <li>เลือกเสรี {structure.free}</li>
                        {structure.extra?.map((e) => (
                          <li key={e.label}>
                            {e.label} {e.credits}
                          </li>
                        ))}
                      </ul>
                      {structure.approx && (
                        <p className="mt-2 flex items-start gap-1.5 text-amber-900">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          สาขานี้ไม่มีเล่มหลักสูตรฉบับเต็มบนเว็บคณะ ตัวเลขรายหมวดประมาณจากแผนการศึกษา — ตรวจกับคู่มือนักศึกษาอีกครั้ง
                        </p>
                      )}
                      {edition?.source && (
                        <a
                          href={edition.source}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                        >
                          เปิดเล่มหลักสูตร (PDF) <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </StepCard>

            <StepCard
              step={2}
              title="นำเข้ารายวิชาจาก SIS"
              hint={
                <>
                  เข้า sis.psu.ac.th → เมนูผลการเรียน (PDF ใบเดียวครบทุกภาค) หรือผลการลงทะเบียน → พิมพ์/บันทึกเป็น PDF · ใช้ข้อมูลร่วมกับหน้า{" "}
                  <Link href="/timetable" className="inline-flex items-center gap-0.5 font-medium text-emerald-700 hover:underline">
                    <CalendarRange className="h-3 w-3" /> จัดตารางเรียน
                  </Link>
                </>
              }
            >
              <ImportPanel records={history.records} buildCatalog={buildCatalog} onChange={updateRecords} />
            </StepCard>
          </div>
        )}

        {/* ยังไม่ครบสองขั้น: บอกว่าจะได้อะไร */}
        {ready && !configured && (
          <section className={cn(CARD, "p-4 sm:p-5")}>
            <p className="text-sm font-bold text-gray-900">
              {hasRecords && !structure && curricula
                ? "เลือกสาขาวิชาในขั้นที่ 1 เพื่อดูผลการตรวจหน่วยกิต"
                : structure
                  ? "นำเข้ารายวิชาในขั้นที่ 2 เพื่อดูผลการตรวจหน่วยกิต"
                  : "ทำสองขั้นด้านบนให้ครบ แล้วผลการตรวจจะแสดงที่นี่"}
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {PREVIEW.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-2xl bg-gray-50 p-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm ring-1 ring-gray-200/80">
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <p className="mt-2.5 text-sm font-semibold text-gray-900">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{text}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {summary && hasRecords && (
          <>
            <SummaryPanel summary={summary} />

            <section aria-labelledby="credit-courses-title" className="space-y-3 pt-2">
              <div>
                <h2 id="credit-courses-title" className="text-lg font-bold text-gray-900">
                  รายวิชาที่ลงทะเบียน
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                  แก้หมวดของแต่ละวิชาได้เอง · ปิดสวิตช์ “นับภาคนี้” สำหรับภาคที่ยังไม่อยากนับ · กดปุ่มไม่นับที่วิชาที่ติด F / ถอน W เมื่อใบที่นำเข้าไม่มีเกรด
                </p>
              </div>
              <CourseList
                summary={summary}
                onBucket={setBucket}
                onToggleExcluded={(key) => updatePrefs({ excluded: toggle(prefs.excluded, key) })}
                onToggleTerm={(term) => updatePrefs({ excludedTerms: toggle(prefs.excludedTerms, term) })}
                onRemove={removeCourse}
              />
            </section>

            <p className="flex items-start gap-2 rounded-2xl bg-white/70 px-4 py-3 text-xs leading-relaxed text-gray-500 ring-1 ring-gray-200/80 ring-inset">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              <span>
                เมื่อนำเข้าใบผลการเรียน ระบบไม่นับวิชาที่ติด F/E, ถอน (W), ไม่ผ่าน (U) หรือ I ให้อัตโนมัติ และนับวิชาที่ลงซ้ำเพียงครั้งล่าสุด
                เกรดเฉลี่ยสะสมเป็นค่าประมาณจากเกรดที่นำเข้า ผลทั้งหมดใช้ประกอบการวางแผนเท่านั้น —
                การตรวจสอบจบจริงให้ยืนยันกับอาจารย์ที่ปรึกษาหรืองานทะเบียน
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
