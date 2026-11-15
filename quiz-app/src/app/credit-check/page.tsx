"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarRange, ClipboardCheck, ExternalLink, Info, Loader2 } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select";
import { Segmented } from "@/components/ui/checkbox";
import { useGenedIndex } from "@/hooks/use-gened-index";
import { SCI_CREDIT_STRUCTURES, findCreditStructure, structureTotal } from "@/data/credit-structures";
import {
  EMPTY_PREFS,
  buildCatalogCourses,
  readCreditCheckPrefs,
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
import { ImportPanel } from "./components/ImportPanel";
import { SummaryPanel } from "./components/SummaryPanel";
import { CourseList } from "./components/CourseList";

const CURRICULUM_FILE = "/timetable/curricula/sci.json";

function StepCard({ step, title, hint, children }: { step: number; title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{step}</span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function CreditCheckPage() {
  const { courses: geCourses, index: geIndex } = useGenedIndex();
  const [curricula, setCurricula] = useState<CurriculumFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [history, setHistory] = useState<RegistrationHistory>({ records: [], regradeCodes: [] });
  const [prefs, setPrefs] = useState<CreditCheckPrefs>(EMPTY_PREFS);
  const [ready, setReady] = useState(false);

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
      const next = { ...prev, ...patch };
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
    () => (program?.editions ?? []).filter((e) => findCreditStructure(program!.id, e.curriculumYear)),
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

  const catalogCourses = useMemo(
    () =>
      buildCatalogCourses({
        curricula,
        edition,
        plan,
        missing: summary?.missing,
        geCourses,
      }),
    [curricula, edition, plan, summary?.missing, geCourses]
  );

  const programOptions: SelectOption<string>[] = programs.map((p) => ({ value: p.id, label: p.name, group: p.division }));
  const editionOptions: SelectOption<number>[] = editions.map((e) => ({
    value: e.curriculumYear,
    label: `หลักสูตรปรับปรุง พ.ศ. ${e.curriculumYear}`,
    description: e.curriculumYear >= 2569 ? "นักศึกษารหัส 69 เป็นต้นไป" : `นักศึกษารหัส ${String(e.curriculumYear).slice(2)}–68`,
  }));

  // ---------------------------------------------------------------- row actions
  const setBucket = (base: string, bucket: BucketChoice, auto: BucketChoice) => {
    const overrides = { ...prefs.overrides };
    if (bucket === auto) delete overrides[base];
    else overrides[base] = bucket;
    updatePrefs({ overrides });
  };
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  const removeCourse = (c: CheckedCourse) =>
    updateRecords(history.records.filter((r) => !(r.term === c.record.term && r.code === c.record.code && r.sec === c.record.sec)));

  return (
    <div className="container mx-auto max-w-5xl px-3 py-5 sm:px-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-green-600 text-white shadow-md">
          <ClipboardCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">เช็กหน่วยกิต คณะวิทยาศาสตร์ ม.อ.</h1>
          <p className="mt-0.5 text-sm text-gray-500">ใส่ใบลงทะเบียนจาก SIS แล้วดูว่าแต่ละหมวดของหลักสูตรครบหรือยัง ขาดอีกเท่าไร</p>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {loadError}
        </div>
      )}

      <div className="space-y-4">
        <StepCard step={1} title="เลือกหลักสูตรของฉัน" hint="หลักสูตร วท.บ. ทุกสาขาของคณะวิทยาศาสตร์ วิทยาเขตหาดใหญ่ ทั้งฉบับปรับปรุง พ.ศ. 2564 และ 2569">
          {!curricula && !loadError ? (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดหลักสูตร…
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select<string>
                  label="สาขาวิชา"
                  showLabel
                  placeholder="เลือกสาขาวิชา"
                  value={prefs.programId}
                  options={programOptions}
                  onChange={(programId) => updatePrefs({ programId, curriculumYear: undefined, planId: undefined })}
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
                <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-700">
                  <p>
                    <span className="font-semibold text-gray-900">รวมตลอดหลักสูตร {structureTotal(structure, plan)} หน่วยกิต</span> — ศึกษาทั่วไป {structure.ge} ·
                    วิชาเฉพาะ {structure.basic + plan.required + plan.elective} (พื้นฐาน/แกน {structure.basic}, บังคับ {plan.required}, เลือก {plan.elective}) · เลือกเสรี{" "}
                    {structure.free}
                    {structure.extra?.map((e) => ` · ${e.label} ${e.credits}`)}
                  </p>
                  {structure.approx && (
                    <p className="mt-1 flex items-start gap-1.5 text-amber-900">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      สาขานี้ไม่มีเล่มหลักสูตรฉบับเต็มบนเว็บคณะ ตัวเลขรายหมวดประมาณจากแผนการศึกษา — ตรวจกับคู่มือนักศึกษาอีกครั้ง
                    </p>
                  )}
                  {edition?.source && (
                    <a href={edition.source} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline">
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
          title="ใส่ใบลงทะเบียนจาก SIS"
          hint={
            <>
              เข้า sis.psu.ac.th → เมนูผลการลงทะเบียน → เลือกภาคการศึกษา → พิมพ์/บันทึกเป็น PDF ทำซ้ำให้ครบทุกภาคที่เรียนมา
              ข้อมูลเก็บในเครื่องนี้เท่านั้น และใช้ร่วมกับหน้า{" "}
              <Link href="/timetable" className="inline-flex items-center gap-0.5 font-medium text-emerald-700 hover:underline">
                <CalendarRange className="h-3 w-3" /> จัดตารางเรียน
              </Link>
            </>
          }
        >
          {ready && <ImportPanel records={history.records} catalogCourses={catalogCourses} onChange={updateRecords} />}
        </StepCard>

        {summary && history.records.length > 0 && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                ใบลงทะเบียนไม่มีเกรด ระบบจึงนับทุกวิชาที่ลงทะเบียนว่าได้หน่วยกิต — กดปุ่ม <span className="font-semibold">ไม่นับ</span> ที่วิชาที่ติด F หรือถอน (W)
                และปิดสวิตช์ <span className="font-semibold">นับภาคนี้</span> ของภาคที่ยังเรียนไม่จบ ผลนี้ใช้ประกอบการวางแผนเท่านั้น
                การตรวจสอบจบจริงให้ยืนยันกับอาจารย์ที่ปรึกษาหรืองานทะเบียน
              </p>
            </div>

            {(summary.planIncomplete || summary.guessedCount > 0) && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {summary.planIncomplete && "รายชื่อวิชาบังคับของฉบับนี้ที่มีในระบบยังไม่ครบ วิชาของสาขาที่ไม่พบในแผนจึงถูกจัดเป็นวิชาบังคับไว้ก่อน "}
                  {summary.guessedCount > 0 && `มี ${summary.guessedCount} วิชาที่ระบบเดาหมวดจากรหัสภาควิชา — ตรวจและแก้หมวดได้ในรายการด้านล่าง`}
                </p>
              </div>
            )}

            <SummaryPanel summary={summary} />

            <div>
              <h2 className="mb-2 text-base font-bold text-gray-900">รายวิชาที่ลงทะเบียน</h2>
              <CourseList
                courses={summary.courses}
                excludedTerms={prefs.excludedTerms}
                onBucket={setBucket}
                onToggleExcluded={(key) => updatePrefs({ excluded: toggle(prefs.excluded, key) })}
                onToggleTerm={(term) => updatePrefs({ excludedTerms: toggle(prefs.excludedTerms, term) })}
                onRemove={removeCourse}
              />
            </div>
          </>
        )}

        {ready && history.records.length > 0 && !structure && !loadError && curricula && (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-600">
            เลือกสาขาวิชาในขั้นที่ 1 เพื่อดูผลการตรวจหน่วยกิต
          </p>
        )}
      </div>
    </div>
  );
}
