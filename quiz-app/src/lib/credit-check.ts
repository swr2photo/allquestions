// ตรวจหน่วยกิตตามโครงสร้างหลักสูตร — จัดรายวิชาที่ลงทะเบียน (จากใบผลการลงทะเบียน SIS) ลงหมวด
// แล้วเทียบกับหน่วยกิตที่หลักสูตรกำหนด. Pure helpers (no React, no storage side effects except the prefs I/O at the end).

import { GE_AREA_MIN, GE2_SUB_MIN, findLegacyGeSpec, isLegacyGe, type CreditPlan, type CreditStructure, type LegacyGeSpec } from "@/data/credit-structures";
import {
  GE_AREAS,
  baseCode,
  classifyCourse,
  geArea,
  geFromCode,
  genedLevels,
  isCatalogTerm,
  type GeIndex,
  type GeKey,
  type GenedLite,
} from "./ge";
import type { RegistrationRecord } from "./registration";
import type { CurriculumEdition, CurriculumFile } from "./timetable";

export type Bucket = "ge" | "required" | "elective" | "free";
export type BucketChoice = Bucket | "none";

export const BUCKETS: Bucket[] = ["ge", "required", "elective", "free"];

export const BUCKET_META: Record<Bucket, { label: string; short: string; color: string; chip: string }> = {
  ge: { label: "หมวดวิชาศึกษาทั่วไป", short: "ศึกษาทั่วไป", color: "#2a78d6", chip: "bg-sky-50 text-sky-800 ring-sky-200" },
  required: { label: "วิชาเฉพาะ · พื้นฐานและบังคับ", short: "เฉพาะบังคับ", color: "#1baf7a", chip: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  elective: { label: "วิชาเฉพาะ · วิชาเลือก", short: "เฉพาะเลือก", color: "#7c5cd6", chip: "bg-violet-50 text-violet-800 ring-violet-200" },
  free: { label: "หมวดวิชาเลือกเสรี", short: "เลือกเสรี", color: "#eb6834", chip: "bg-orange-50 text-orange-800 ring-orange-200" },
};

export interface CreditCheckPrefs {
  programId?: string;
  curriculumYear?: number;
  planId?: string;
  /** รหัสวิชา (ไม่มีส่วนท้าย G) → หมวดที่ผู้ใช้กำหนดเอง */
  overrides: Record<string, BucketChoice>;
  /** overrides แยกตาม `${programId}:${curriculumYear}` เพื่อไม่ให้หลักสูตรปีเก่าและปีล่าสุดปนกัน */
  overridesByEdition?: Record<string, Record<string, BucketChoice>>;
  /** รายการที่ไม่นับ (ติด F / ถอน W) — key = `${term}|${code}` */
  excluded: string[];
  /** ภาคการศึกษาที่ไม่นับทั้งภาค (เช่น ภาคที่กำลังเรียน) */
  excludedTerms: string[];
}

export const EMPTY_PREFS: CreditCheckPrefs = { overrides: {}, excluded: [], excludedTerms: [] };

export function editionPrefKey(programId?: string, curriculumYear?: number): string | null {
  return programId && curriculumYear ? `${programId}:${curriculumYear}` : null;
}

export function resolveOverrides(
  prefs: CreditCheckPrefs,
  programId?: string,
  curriculumYear?: number
): Record<string, BucketChoice> {
  const edKey = editionPrefKey(programId, curriculumYear);
  if (prefs.overridesByEdition) {
    if (edKey && prefs.overridesByEdition[edKey]) return prefs.overridesByEdition[edKey];
    if (edKey) return {};
  }
  if (prefs.programId && programId && prefs.programId !== programId) return {};
  if (prefs.curriculumYear && curriculumYear && prefs.curriculumYear !== curriculumYear) return {};
  return prefs.overrides;
}

export type SkipReason = "repeat" | "audit" | "fail" | "excluded" | "term" | "none";

export const SKIP_LABEL: Record<SkipReason, string> = {
  repeat: "ลงซ้ำ — นับครั้งล่าสุด",
  audit: "Audit ไม่นับหน่วยกิต",
  fail: "ไม่ผ่าน / ถอน — ไม่นับหน่วยกิต",
  excluded: "ไม่นับ (F / W)",
  term: "ไม่นับภาคนี้",
  none: "ไม่นับ",
};

/** เกรดในใบผลการเรียนที่ไม่ได้หน่วยกิต (ติด E/F, ไม่ผ่าน U, ถอน W, ไม่สมบูรณ์ I) */
export const NON_EARNED_GRADES: ReadonlySet<string> = new Set(["E", "F", "W", "U", "I"]);

export function isNonEarnedGrade(grade?: string): boolean {
  return !!grade && NON_EARNED_GRADES.has(grade.trim().toUpperCase());
}

export interface CheckedCourse {
  key: string;
  record: RegistrationRecord;
  base: string;
  /** หมวดที่ใช้จริง (override ถ้ามี) */
  bucket: BucketChoice;
  /** หมวดที่ระบบจัดให้ */
  auto: Bucket;
  /** true = อยู่ในรายวิชาบังคับ/GE ที่แผนการศึกษาฉบับนี้ระบุไว้ */
  inPlan: boolean;
  /** true = อยู่ในรายการวิชาเลือกเฉพาะของฉบับนี้ */
  inElectiveCatalog: boolean;
  /** true = ระบบเดาจากรหัสภาควิชา ควรตรวจเอง */
  guessed: boolean;
  overridden: boolean;
  ge: GeKey | null;
  /** เหตุผลที่ไม่นับหน่วยกิต */
  skip: SkipReason | null;
  /** true = นับหน่วยกิตอยู่แต่ยังไม่มีเกรด ทั้งที่ประวัติมีเกรดของวิชาอื่นแล้ว (กำลังเรียน / เพิ่มเอง) */
  pending: boolean;
}

export interface BucketSummary {
  /** หน่วยกิตที่จัดเข้าหมวดนี้โดยตรง */
  earned: number;
  /** หน่วยกิตส่วนเกินจากหมวดอื่นที่ไหลมานับ (เฉพาะเลือกเสรี) */
  overflowIn: number;
  need: number;
  /** หน่วยกิตที่นับเข้าเกณฑ์ของหมวดได้จริง (ไม่เกิน need; หมวด GE นับตามโควตารายสาระ) */
  counted: number;
  /** ส่วนของ counted ที่มาจากวิชาที่ยังไม่มีเกรด */
  pending: number;
  /** หน่วยกิตที่ยังขาด = need - counted */
  short: number;
}

export interface MissingCourse {
  code: string;
  name: string;
  credits: number;
  year: number;
  term: number;
  bucket: "ge" | "required";
  /** คำแนะนำกรณีวิชารหัสเก่าในแผน 2564 มีการเปลี่ยนรหัสหรือยกเลิกในโครงสร้าง GE 2567 */
  note?: string;
}

export interface OverflowCourse {
  /** รายวิชาที่มีหน่วยกิตส่วนเกินไหลไปนับเป็นเลือกเสรี */
  course: CheckedCourse;
  /** หมวดต้นทางของส่วนเกิน */
  from: "ge" | "elective";
  /** จำนวนหน่วยกิตของวิชานี้ที่ถูกปัดไปนับในเลือกเสรี */
  credits: number;
}

export interface GeAreaSummary {
  area: (typeof GE_AREAS)[number];
  /** หน่วยกิตที่ลงผ่านในสาระนี้ทั้งหมด */
  earned: number;
  need: number;
  /** หน่วยกิตที่นับเข้าโควตาของสาระนี้ (GE8 รวมส่วนเกินจากสาระอื่นและวิชา GE ที่ไม่ทราบสาระ) */
  counted: number;
  /** เฉพาะ GE8: หน่วยกิตจากสาระอื่นที่นำมานับเป็นวิชาเลือก */
  extraIn: number;
  short: number;
  sub?: { key: GeKey; short: string; earned: number; need: number }[];
}

export type CheckStatus = "pass" | "fail" | "warn";

/** เกณฑ์หนึ่งข้อในรายการตรวจสำเร็จการศึกษา */
export interface CriterionCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** หมวดที่เกี่ยวข้อง (กดเพื่อเปิดดูรายวิชาในหมวดได้) */
  bucket?: Bucket;
}

export interface TermSummary {
  term: string;
  /** หน่วยกิตที่ลงทะเบียนทั้งหมดในภาคนี้ */
  registered: number;
  /** หน่วยกิตที่นับ */
  counted: number;
  notCounted: number;
  courses: number;
  byBucket: Record<Bucket, number>;
  /** ผู้ใช้ปิด "นับภาคนี้" ไว้ */
  excluded: boolean;
}

/** complete = ครบทุกเกณฑ์และมีเกรดครบ · pending = ครบถ้าวิชาที่ยังไม่มีเกรดผ่านทั้งหมด · incomplete = ยังขาด */
export type CreditVerdict = "complete" | "pending" | "incomplete";

export interface CreditSummary {
  total: number;
  /** หน่วยกิตที่นับเข้าโครงสร้างได้ (ไม่เกินเกณฑ์ของแต่ละหมวด) */
  counted: number;
  /** หน่วยกิตที่ลงทะเบียนและนับทั้งหมด (รวมส่วนเกิน) */
  earned: number;
  remaining: number;
  /** ส่วนของ counted ที่ยังไม่มีเกรด */
  pending: number;
  /** ประวัติมีเกรดอย่างน้อยหนึ่งวิชา (นำเข้าจากใบผลการเรียน) */
  hasGrades: boolean;
  buckets: Record<Bucket, BucketSummary>;
  /** รายละเอียดเกณฑ์ย่อยและส่วนเกินที่ไหลไปเลือกเสรี */
  breakdown: {
    basicNeed: number;
    majorRequiredNeed: number;
    extraNeed: number;
    geOverflow: number;
    electiveOverflow: number;
  };
  /** รายวิชาจาก GE / เฉพาะเลือก ที่มีหน่วยกิตส่วนเกินปัดไปนับเป็นเลือกเสรี */
  overflowCourses: OverflowCourse[];
  overflowByKey: Map<string, OverflowCourse>;
  geAreas: GeAreaSummary[];
  courses: CheckedCourse[];
  /** รายวิชาที่นับ แยกตามหมวด เรียงตามภาคการศึกษา */
  byBucket: Record<Bucket, CheckedCourse[]>;
  /** รายวิชาที่ไม่นับ เรียงตามภาคการศึกษา */
  skipped: CheckedCourse[];
  terms: TermSummary[];
  missing: MissingCourse[];
  missingCredits: number;
  /** แผนการศึกษาที่นำเข้ามีหน่วยกิตไม่ครบทั้งหลักสูตร (รายชื่อวิชาบังคับอาจขาดชั้นปีท้าย ๆ) */
  planIncomplete: boolean;
  guessedCount: number;
  /** เกรดเฉลี่ยสะสมโดยประมาณจากเกรดในประวัติ (คิดทุกครั้งที่ลงและได้เกรด A–E/F) */
  gpa: { value: number; credits: number; hasRepeat: boolean } | null;
  /** อัตราเฉลี่ยต่อภาคปกติ และจำนวนภาคที่คาดว่าต้องเรียนอีก */
  pace: { perTerm: number; termsLeft: number } | null;
  checks: CriterionCheck[];
  verdict: CreditVerdict;
}

// ------------------------------------------------------------------ terms

/** "2/2567" → 25672 (เรียงตามเวลา); ภาคที่อ่านไม่ได้ไปอยู่ท้ายสุด */
export function termOrder(term: string): number {
  const m = term.match(/^(\d)\s*\/\s*(\d{4})$/);
  return m ? Number(m[2]) * 10 + Number(m[1]) : 99999;
}

export function recordKey(r: RegistrationRecord): string {
  return `${r.term}|${r.code}`;
}

export function codeKey(code: string): string {
  return baseCode(code) ?? code.replace(/\s+/g, "").toUpperCase();
}

// ------------------------------------------------------------------ curriculum lookups

function planMatches(plan: CreditPlan, yearPlan: string | undefined, hasVariant: boolean): boolean {
  if (!yearPlan || plan.id === "all" || !hasVariant) return true;
  return /สหกิจ/.test(yearPlan) === !!plan.coop;
}

interface PlanCourse {
  code: string;
  name: string;
  credits: number;
  year: number;
  term: number;
}

interface CurriculumLookup {
  /** วิชาที่ระบุรหัสในแผนการศึกษาของแผนที่เลือก */
  planCourses: Map<string, PlanCourse>;
  /** วิชาเลือกในหมวดวิชาเฉพาะ */
  electiveCodes: Set<string>;
  /** รหัสภาควิชาของสาขา (สามหลักแรก) */
  homePrefixes: Set<string>;
  /** ผลจัดหมวดของวิชาในแผน (แคชตามดัชนี GE ที่ใช้) */
  planAuto?: PlanAuto;
}

interface PlanAuto {
  index: GeIndex | null;
  curriculumYear: number;
  entries: { course: PlanCourse; auto: AutoBucket }[];
  /** หน่วยกิตรวมของวิชาในแผนที่จัดเป็นวิชาบังคับ */
  requiredCredits: number;
}

// แผนการศึกษาไม่เปลี่ยนระหว่างใช้งาน — สร้างดัชนีครั้งเดียวต่อฉบับ/แผน แทนการไล่ทั้งหลักสูตรทุกครั้งที่ผู้ใช้กดสลับตัวเลือก
const lookupCache = new WeakMap<CurriculumEdition, Map<string, CurriculumLookup>>();

function getLookup(edition: CurriculumEdition | undefined, plan: CreditPlan): CurriculumLookup {
  if (!edition) return buildLookup(undefined, plan);
  let byPlan = lookupCache.get(edition);
  if (!byPlan) lookupCache.set(edition, (byPlan = new Map()));
  const key = `${plan.id}|${plan.coop ? 1 : 0}`;
  let lookup = byPlan.get(key);
  if (!lookup) byPlan.set(key, (lookup = buildLookup(edition, plan)));
  return lookup;
}

function buildLookup(edition: CurriculumEdition | undefined, plan: CreditPlan): CurriculumLookup {
  const planCourses = new Map<string, PlanCourse>();
  const electiveCodes = new Set<string>();
  const prefixCount = new Map<string, number>();
  // บางฉบับนำเข้าได้เฉพาะแผนเดียว (เช่น มีแต่แผนโครงงาน) — ถ้าไม่มีชั้นปีของแผนที่เลือก ใช้ทุกชั้นปีแทน
  const hasVariant = (edition?.years ?? []).some((y) => y.plan && /สหกิจ/.test(y.plan) === !!plan.coop);
  for (const y of edition?.years ?? []) {
    for (const t of y.terms) {
      if (isCatalogTerm(t)) {
        // ภาคผนวกรายวิชาเลือกที่ตัวนำเข้าเก็บเป็น "ภาค" — นับเป็นวิชาเลือก
        for (const c of t.courses) if (!c.placeholder) electiveCodes.add(codeKey(c.code));
        continue;
      }
      const mine = planMatches(plan, y.plan, hasVariant);
      for (const c of t.courses) {
        if (c.placeholder) continue;
        const key = codeKey(c.code);
        if (Number(key[4]) >= 2) prefixCount.set(key.slice(0, 3), (prefixCount.get(key.slice(0, 3)) ?? 0) + 1);
        if (mine && !planCourses.has(key)) planCourses.set(key, { code: key, name: c.name, credits: c.credits, year: y.year, term: t.term });
      }
    }
  }
  for (const area of edition?.electives?.areas ?? []) for (const c of area.courses) electiveCodes.add(codeKey(c.code));
  for (const key of planCourses.keys()) electiveCodes.delete(key);
  const homePrefixes = new Set([...prefixCount].filter(([, n]) => n >= 3).map(([p]) => p));
  return { planCourses, electiveCodes, homePrefixes };
}

// ------------------------------------------------------------------ classification

interface AutoBucket {
  bucket: Bucket;
  guessed: boolean;
  ge: GeKey | null;
  /** true เมื่อเป็นรหัส GE โครงสร้าง 2567 ที่มีส่วนท้าย G1–G8 */
  fromG2567: boolean;
}

function classify(
  record: { code: string; name: string },
  structure: CreditStructure,
  lookup: CurriculumLookup,
  planIncomplete: boolean,
  index: GeIndex | null | undefined
): AutoBucket {
  const key = codeKey(record.code);
  const info = classifyCourse({ code: record.code, name: record.name }, index);
  const geKey = info?.levels[0] ?? null;
  // 1) รหัสมีส่วนท้าย G1–G8 = มหาวิทยาลัยกำหนดให้เป็น GE
  if (info?.source === "sis-code") return { bucket: "ge", guessed: false, ge: geKey, fromG2567: true };
  const centralSpec = findLegacyGeSpec(record.code, record.name);
  const centralGe = isLegacyGe(record.code, record.name);
  const legacyGe = structure.curriculumYear < 2567 && centralGe;
  const resolvedGe = geKey ?? centralSpec?.ge ?? null;
  const scienceCode = key[0] === "3";
  // 2) วิชาในแผนการศึกษา: วิชา GE ที่แผนระบุรหัสไว้ยังเป็น GE, ที่เหลือเป็นวิชาบังคับ
  if (lookup.planCourses.has(key)) {
    if (legacyGe || (info && !scienceCode)) return { bucket: "ge", guessed: false, ge: resolvedGe, fromG2567: false };
    return { bucket: "required", guessed: false, ge: null, fromG2567: false };
  }
  // 3) วิชา GE ดั้งเดิมของหลักสูตรปี < 2567 ที่ไม่อยู่ในแผน
  if (legacyGe) return { bucket: "ge", guessed: false, ge: resolvedGe, fromG2567: false };
  // 4) วิชาเลือกของหมวดวิชาเฉพาะ (เช็กก่อนการเทียบชื่อ/รหัส GE ทั่วไป เพื่อไม่ให้ GE ดึงวิชาเลือกของสาขาไป)
  if (lookup.electiveCodes.has(key)) return { bucket: "elective", guessed: false, ge: null, fromG2567: false };
  // 5) วิชา GE อื่นๆ ตามดัชนี GE (ที่ไม่ใช่รหัสลงท้าย G)
  if (info) return { bucket: "ge", guessed: false, ge: resolvedGe, fromG2567: false };
  // 5b) รายวิชา GE ส่วนกลางที่เป็นที่รู้จัก (ครอบคลุมหลักสูตร >= 2567 เมื่อดัชนี GE ยังไม่โหลดหรือไม่มี geLevels เช่น 003-001)
  if (centralGe && (centralSpec || !scienceCode)) {
    return { bucket: "ge", guessed: false, ge: resolvedGe, fromG2567: false };
  }
  // 5) วิชาของภาควิชาเดียวกันที่ไม่พบในรายการ — เดา: ถ้าแผนที่นำเข้าไม่ครบ น่าจะเป็นวิชาบังคับปีท้าย ๆ
  if (lookup.homePrefixes.has(key.slice(0, 3))) return { bucket: planIncomplete ? "required" : "elective", guessed: true, ge: null, fromG2567: false };
  return { bucket: "free", guessed: false, ge: null, fromG2567: false };
}

function isLegacyGeSatisfied(
  spec: LegacyGeSpec | undefined,
  autoGe: GeKey | null,
  ctx: {
    geEarned: number;
    geNeed: number;
    countedCodes: Set<string>;
    hasGe2567: boolean;
    areaEarned: Map<string, number>;
    subEarned: Map<GeKey, number>;
    ge2567AreaEarned: Map<string, number>;
    ge2567SubEarned: Map<GeKey, number>;
  }
): boolean {
  if (ctx.geEarned >= ctx.geNeed) return true;
  if (spec?.replacedBy?.some((r) => ctx.countedCodes.has(r))) return true;
  const targetGe = spec?.ge ?? autoGe;
  if (!targetGe) return false;
  if (targetGe === "GE2A" || targetGe === "GE2B") {
    if ((ctx.ge2567SubEarned.get(targetGe) ?? 0) >= 2) return true;
    return !!(spec?.discontinued && ctx.hasGe2567 && (ctx.subEarned.get(targetGe) ?? 0) >= 2);
  }
  const area = geArea(targetGe);
  const minNeed = GE_AREA_MIN[area] ?? 2;
  if ((ctx.ge2567AreaEarned.get(area) ?? 0) >= minNeed) return true;
  return !!(spec?.discontinued && ctx.hasGe2567 && (ctx.areaEarned.get(area) ?? 0) >= minNeed);
}

const chronologicalOrder = (a: CheckedCourse, b: CheckedCourse) =>
  termOrder(a.record.term) - termOrder(b.record.term) || a.record.code.localeCompare(b.record.code);

/** ลำดับการนับเข้าโควตา: วิชาที่มีเกรดแล้วก่อน แล้วจึงเรียงตามภาคการศึกษา (วิชาที่ยังไม่มีเกรดจะเป็นส่วนเกินก่อน) */
const allocationOrder = (a: CheckedCourse, b: CheckedCourse) => Number(a.pending) - Number(b.pending) || chronologicalOrder(a, b);

/** หน่วยกิตบังคับรวมของสาระ GE1–GE7 ในโครงสร้าง GE 2567 */
const GE_MANDATORY_TOTAL = Object.values(GE_AREA_MIN).reduce((a, b) => a + b, 0);

interface Allocation {
  /** key ของรายวิชา → หน่วยกิตที่นับเข้าหมวด */
  kept: Map<string, number>;
  used: number;
}

interface GeAllocation extends Allocation {
  /** สาระ (GE1, GE2A, GE2B, GE2, GE3…GE7) → หน่วยกิตที่นับเข้าโควตาบังคับ */
  areaUsed: Map<string, number>;
  /** หน่วยกิตที่นับเป็นวิชาเลือก (GE8) */
  electiveUsed: number;
  /** ส่วนของ electiveUsed ที่มาจากสาระอื่น / วิชา GE ที่ไม่ทราบสาระ */
  electiveFromOther: number;
}

/**
 * นับหน่วยกิตหมวดศึกษาทั่วไปเข้าเกณฑ์
 * - โครงสร้าง GE 2567: แต่ละสาระ GE1–GE7 นับได้ไม่เกินเกณฑ์ขั้นต่ำของสาระ (GE2 แยก 2A/2B อย่างละ 2)
 *   ส่วนที่เกินจากสาระบังคับและวิชา GE8 นับเป็นวิชาเลือกได้ไม่เกิน (เกณฑ์ GE − 18)
 *   → หน่วยกิต GE8 ที่เกินโควตา "ไม่" ทดแทนสาระบังคับที่ยังขาด
 * - โครงสร้างเดิม (2564): นับวิชา GE ที่แผนระบุรหัสก่อน แล้วตามด้วยวิชา GE อื่นจนครบเกณฑ์
 */
function allocateGe(list: CheckedCourse[], need: number, useAreas: boolean): GeAllocation {
  const order = [...list].sort(allocationOrder);
  const kept = new Map<string, number>();
  const areaUsed = new Map<string, number>();
  let used = 0;
  let electiveUsed = 0;
  let electiveFromOther = 0;
  const give = (c: CheckedCourse, n: number) => {
    kept.set(c.key, (kept.get(c.key) ?? 0) + n);
    used += n;
  };

  if (useAreas) {
    const electiveQuota = Math.max(0, need - GE_MANDATORY_TOTAL);
    const areaRoom = (ge: GeKey): number => {
      const ge2Room = Math.max(0, 4 - (areaUsed.get("GE2A") ?? 0) - (areaUsed.get("GE2B") ?? 0) - (areaUsed.get("GE2") ?? 0));
      if (ge === "GE2") return ge2Room;
      if (ge === "GE2A" || ge === "GE2B") return Math.min(ge2Room, Math.max(0, 2 - (areaUsed.get(ge) ?? 0)));
      return Math.max(0, (GE_AREA_MIN[ge] ?? 0) - (areaUsed.get(ge) ?? 0));
    };
    for (const c of order) {
      if (!c.ge || c.ge === "GE8") continue;
      const take = Math.min(c.record.credits, areaRoom(c.ge), need - used);
      if (take <= 0) continue;
      give(c, take);
      areaUsed.set(c.ge, (areaUsed.get(c.ge) ?? 0) + take);
    }
    // วิชาเลือก: วิชา GE8 ก่อน แล้วจึงส่วนเกินของสาระอื่น
    for (const ge8Pass of [true, false]) {
      for (const c of order) {
        if ((c.ge === "GE8") !== ge8Pass) continue;
        const take = Math.min(c.record.credits - (kept.get(c.key) ?? 0), electiveQuota - electiveUsed, need - used);
        if (take <= 0) continue;
        give(c, take);
        electiveUsed += take;
        if (!ge8Pass) electiveFromOther += take;
      }
    }
  } else {
    for (const inPlanPass of [true, false]) {
      for (const c of order) {
        if (c.inPlan !== inPlanPass) continue;
        const take = Math.min(c.record.credits, need - used);
        if (take > 0) give(c, take);
      }
    }
  }
  return { kept, used, areaUsed, electiveUsed, electiveFromOther };
}

/** นับหน่วยกิตเข้าหมวดตามลำดับจนเต็มเกณฑ์ ที่เหลือเป็นส่วนเกิน */
function allocateCapped(list: CheckedCourse[], need: number): Allocation {
  const kept = new Map<string, number>();
  let used = 0;
  for (const c of [...list].sort(allocationOrder)) {
    const take = Math.min(c.record.credits, need - used);
    if (take <= 0) continue;
    kept.set(c.key, take);
    used += take;
  }
  return { kept, used };
}

function spillOf(list: CheckedCourse[], alloc: Allocation, from: OverflowCourse["from"]): OverflowCourse[] {
  const out: OverflowCourse[] = [];
  for (const c of list) {
    const credits = c.record.credits - (alloc.kept.get(c.key) ?? 0);
    if (credits > 0) out.push({ course: c, from, credits });
  }
  return out;
}

// ------------------------------------------------------------------ grades

/** แต้มระดับคะแนนของ ม.อ. (S/U/G/P/W/I/AU ไม่นำมาคิดเกรดเฉลี่ย) */
const GRADE_POINTS: Readonly<Record<string, number>> = { A: 4, "B+": 3.5, B: 3, "C+": 2.5, C: 2, "D+": 1.5, D: 1, E: 0, F: 0 };

/** เกรดเฉลี่ยสะสมขั้นต่ำเพื่อสำเร็จการศึกษาระดับปริญญาตรี */
export const MIN_GRADUATION_GPA = 2;

function estimateGpa(records: RegistrationRecord[]): CreditSummary["gpa"] {
  let points = 0;
  let credits = 0;
  const seen = new Set<string>();
  let hasRepeat = false;
  for (const r of records) {
    const grade = r.grade?.trim().toUpperCase();
    const point = grade ? GRADE_POINTS[grade] : undefined;
    if (point === undefined || !(r.credits > 0) || r.type.toUpperCase() === "A") continue;
    points += point * r.credits;
    credits += r.credits;
    const base = codeKey(r.code);
    if (seen.has(base)) hasRepeat = true;
    seen.add(base);
  }
  return credits > 0 ? { value: points / credits, credits, hasRepeat } : null;
}

// ------------------------------------------------------------------ summary

function planAutoOf(lookup: CurriculumLookup, structure: CreditStructure, index: GeIndex | null): PlanAuto {
  const cached = lookup.planAuto;
  if (cached && cached.index === index && cached.curriculumYear === structure.curriculumYear) return cached;
  let requiredCredits = 0;
  const entries: PlanAuto["entries"] = [];
  for (const course of lookup.planCourses.values()) {
    // วิชาในแผนถูกตัดสินตั้งแต่ขั้นที่ 1–2 ของ classify จึงไม่ขึ้นกับ planIncomplete
    const auto = classify(course, structure, lookup, false, index);
    entries.push({ course, auto });
    if (auto.bucket === "required") requiredCredits += course.credits;
  }
  const next: PlanAuto = { index, curriculumYear: structure.curriculumYear, entries, requiredCredits };
  lookup.planAuto = next;
  return next;
}

export function summarizeCredits(
  records: RegistrationRecord[],
  structure: CreditStructure,
  plan: CreditPlan,
  edition: CurriculumEdition | undefined,
  prefs: CreditCheckPrefs,
  index?: GeIndex | null
): CreditSummary {
  const geIndex = index ?? null;
  const lookup = getLookup(edition, plan);
  const extra = (structure.extra ?? []).reduce((a, e) => a + e.credits, 0);
  const need: Record<Bucket, number> = {
    ge: structure.ge,
    required: structure.basic + plan.required + extra,
    elective: plan.elective,
    free: structure.free,
  };
  const total = need.ge + need.required + need.elective + need.free;
  // แผนที่นำเข้าครบหรือไม่: วิชาบังคับที่แผนระบุรหัสควรรวมได้ใกล้เคียงเกณฑ์ของหมวด
  const planAuto = planAutoOf(lookup, structure, geIndex);
  const planIncomplete = planAuto.requiredCredits < need.required - 4;

  const excluded = new Set(prefs.excluded);
  const excludedTerms = new Set(prefs.excludedTerms);
  const overrides = resolveOverrides(prefs, structure.programId, structure.curriculumYear);
  const hasGrades = records.some((r) => !!r.grade?.trim());
  // ใหม่ → เก่า: วิชาที่ลงซ้ำนับครั้งล่าสุดที่ยังนับอยู่เพียงครั้งเดียว (ถ้าภาคเดียวกันมีทั้งมีเกรดและไม่มีเกรด ให้ดูตัวที่มีเกรดก่อน)
  const ordered = [...records].sort((a, b) => termOrder(b.term) - termOrder(a.term) || (b.grade ? 1 : 0) - (a.grade ? 1 : 0) || a.code.localeCompare(b.code));
  let earliestTermYear: number | null = null;
  const countedCodes = new Set<string>();
  const courses: CheckedCourse[] = [];
  const byBucket: Record<Bucket, CheckedCourse[]> = { ge: [], required: [], elective: [], free: [] };
  const skipped: CheckedCourse[] = [];
  const earned: Record<Bucket, number> = { ge: 0, required: 0, elective: 0, free: 0 };
  const areaEarned = new Map<string, number>();
  const subEarned = new Map<GeKey, number>();
  const ge2567AreaEarned = new Map<string, number>();
  const ge2567SubEarned = new Map<GeKey, number>();
  const termMap = new Map<string, TermSummary>();
  const autoMemo = new Map<string, AutoBucket>();
  let hasGe2567 = false;
  let guessedCount = 0;

  for (const record of ordered) {
    const key = recordKey(record);
    const base = codeKey(record.code);
    const order = termOrder(record.term);
    if (order < 99999) {
      const year = Math.floor(order / 10);
      if (earliestTermYear === null || year < earliestTermYear) earliestTermYear = year;
    }
    const memoKey = `${record.code}\u0000${record.name}`;
    let auto = autoMemo.get(memoKey);
    if (!auto) autoMemo.set(memoKey, (auto = classify(record, structure, lookup, planIncomplete, geIndex)));
    const override = overrides[base];
    const bucket: BucketChoice = override ?? auto.bucket;
    const grade = record.grade?.trim().toUpperCase();
    let skip: SkipReason | null = null;
    if (excludedTerms.has(record.term)) skip = "term";
    else if (excluded.has(key)) skip = "excluded";
    else if (record.type.toUpperCase() === "A" || grade === "AU") skip = "audit";
    else if (isNonEarnedGrade(grade)) skip = "fail";
    else if (bucket === "none") skip = "none";
    else if (countedCodes.has(base)) skip = "repeat";

    const course: CheckedCourse = {
      key,
      record,
      base,
      bucket,
      auto: auto.bucket,
      inPlan: lookup.planCourses.has(base),
      inElectiveCatalog: lookup.electiveCodes.has(base),
      guessed: auto.guessed && !override,
      overridden: !!override,
      ge: auto.ge,
      skip,
      pending: !skip && hasGrades && !grade,
    };
    courses.push(course);

    let term = termMap.get(record.term);
    if (!term) {
      term = {
        term: record.term,
        registered: 0,
        counted: 0,
        notCounted: 0,
        courses: 0,
        byBucket: { ge: 0, required: 0, elective: 0, free: 0 },
        excluded: excludedTerms.has(record.term),
      };
      termMap.set(record.term, term);
    }
    term.registered += record.credits;
    term.courses++;

    if (skip || bucket === "none") {
      skipped.push(course);
      term.notCounted += record.credits;
      continue;
    }
    countedCodes.add(base);
    earned[bucket] += record.credits;
    byBucket[bucket].push(course);
    term.counted += record.credits;
    term.byBucket[bucket] += record.credits;
    if (bucket === "ge" && auto.ge) {
      const area = geArea(auto.ge);
      areaEarned.set(area, (areaEarned.get(area) ?? 0) + record.credits);
      if (auto.fromG2567) {
        hasGe2567 = true;
        ge2567AreaEarned.set(area, (ge2567AreaEarned.get(area) ?? 0) + record.credits);
      }
      if (auto.ge === "GE2A" || auto.ge === "GE2B") {
        subEarned.set(auto.ge, (subEarned.get(auto.ge) ?? 0) + record.credits);
        if (auto.fromG2567) ge2567SubEarned.set(auto.ge, (ge2567SubEarned.get(auto.ge) ?? 0) + record.credits);
      }
    }
    if (course.guessed) guessedCount++;
  }
  for (const b of BUCKETS) byBucket[b].sort(chronologicalOrder);
  skipped.sort(chronologicalOrder);
  const terms = [...termMap.values()].sort((a, b) => termOrder(a.term) - termOrder(b.term));

  // ---- นับเข้าเกณฑ์รายหมวด: ส่วนเกินของ GE และวิชาเลือกเฉพาะ นับเป็นเลือกเสรีได้
  const useGe2567 = structure.curriculumYear >= 2567 || (hasGe2567 && (earliestTermYear === null || earliestTermYear >= 2567));
  const geAlloc = allocateGe(byBucket.ge, need.ge, useGe2567);
  const electiveAlloc = allocateCapped(byBucket.elective, need.elective);
  const overflowCourses = [...spillOf(byBucket.ge, geAlloc, "ge"), ...spillOf(byBucket.elective, electiveAlloc, "elective")];
  const overflowByKey = new Map(overflowCourses.map((o) => [o.course.key, o]));
  const geOverflow = earned.ge - geAlloc.used;
  const electiveOverflow = earned.elective - electiveAlloc.used;
  const overflow = geOverflow + electiveOverflow;

  const gradedSum = (list: CheckedCourse[], credit: (c: CheckedCourse) => number) =>
    list.reduce((a, c) => a + (c.pending ? 0 : credit(c)), 0);
  const gradedOverflow = overflowCourses.reduce((a, o) => a + (o.course.pending ? 0 : o.credits), 0);
  const countedOf: Record<Bucket, number> = {
    ge: geAlloc.used,
    required: Math.min(earned.required, need.required),
    elective: electiveAlloc.used,
    free: Math.min(earned.free + overflow, need.free),
  };
  const confirmedOf: Record<Bucket, number> = {
    ge: gradedSum(byBucket.ge, (c) => geAlloc.kept.get(c.key) ?? 0),
    required: Math.min(gradedSum(byBucket.required, (c) => c.record.credits), need.required),
    elective: gradedSum(byBucket.elective, (c) => electiveAlloc.kept.get(c.key) ?? 0),
    free: Math.min(gradedSum(byBucket.free, (c) => c.record.credits) + gradedOverflow, need.free),
  };
  const buckets = {} as Record<Bucket, BucketSummary>;
  for (const b of BUCKETS) {
    buckets[b] = {
      earned: earned[b],
      overflowIn: b === "free" ? overflow : 0,
      need: need[b],
      counted: countedOf[b],
      pending: Math.max(0, countedOf[b] - confirmedOf[b]),
      short: Math.max(0, need[b] - countedOf[b]),
    };
  }
  const counted = BUCKETS.reduce((a, b) => a + buckets[b].counted, 0);
  const pending = BUCKETS.reduce((a, b) => a + buckets[b].pending, 0);
  const remaining = Math.max(0, total - counted);

  // ---- วิชาในแผนที่ยังไม่พบ: นับรวมรายการที่ยกเว้นไว้ว่ายัง "ไม่พบ" ด้วย
  const missing: MissingCourse[] = [];
  const legacyCtx = { geEarned: earned.ge, geNeed: need.ge, countedCodes, hasGe2567, areaEarned, subEarned, ge2567AreaEarned, ge2567SubEarned };
  for (const { course: c, auto } of planAuto.entries) {
    if (countedCodes.has(c.code)) continue;
    if (auto.bucket !== "ge" && auto.bucket !== "required") continue;
    const legacyGe = auto.bucket === "ge" && structure.curriculumYear < 2567;
    const legacySpec = legacyGe ? findLegacyGeSpec(c.code, c.name) : undefined;
    if (legacyGe && isLegacyGeSatisfied(legacySpec, auto.ge, legacyCtx)) continue;
    missing.push({ ...c, bucket: auto.bucket, ...(legacySpec?.note ? { note: legacySpec.note } : {}) });
  }
  missing.sort((a, b) => a.year - b.year || a.term - b.term || a.code.localeCompare(b.code));
  const missingCredits = missing.reduce((a, m) => a + m.credits, 0);

  // ---- ศึกษาทั่วไปรายสาระ (โครงสร้าง GE 2567)
  const geAreas: GeAreaSummary[] = useGe2567
    ? GE_AREAS.map((area) => {
        const areaNeed = GE_AREA_MIN[area] ?? Math.max(0, need.ge - GE_MANDATORY_TOTAL);
        const areaCounted =
          area === "GE8"
            ? geAlloc.electiveUsed
            : area === "GE2"
              ? (geAlloc.areaUsed.get("GE2A") ?? 0) + (geAlloc.areaUsed.get("GE2B") ?? 0) + (geAlloc.areaUsed.get("GE2") ?? 0)
              : (geAlloc.areaUsed.get(area) ?? 0);
        return {
          area,
          earned: areaEarned.get(area) ?? 0,
          need: areaNeed,
          counted: areaCounted,
          extraIn: area === "GE8" ? geAlloc.electiveFromOther : 0,
          short: Math.max(0, areaNeed - areaCounted),
          ...(area === "GE2" ? { sub: GE2_SUB_MIN.map((s) => ({ ...s, earned: subEarned.get(s.key) ?? 0 })) } : {}),
        };
      })
    : [];

  // ---- เกรดเฉลี่ยและอัตราการเก็บหน่วยกิต
  const gpa = hasGrades ? estimateGpa(records) : null;
  const regularTerms = terms.filter((t) => /^[12]\//.test(t.term) && t.counted > 0);
  const perTerm = regularTerms.length ? regularTerms.reduce((a, t) => a + t.counted, 0) / regularTerms.length : 0;
  const pace = perTerm > 0 && remaining > 0 ? { perTerm, termsLeft: Math.ceil(remaining / perTerm) } : null;

  // ---- รายการตรวจเกณฑ์สำเร็จการศึกษา
  const checks: CriterionCheck[] = [
    {
      id: "total",
      label: `หน่วยกิตรวมตลอดหลักสูตร ${total} หน่วยกิต`,
      status: remaining === 0 ? "pass" : "fail",
      detail: remaining === 0 ? `นับเข้าโครงสร้างครบ ${counted} หน่วยกิต` : `นับได้ ${counted} หน่วยกิต — ขาดอีก ${remaining}`,
    },
  ];
  for (const b of BUCKETS) {
    const s = buckets[b];
    if (!s.need) continue;
    const mandatoryShort = b === "ge" ? geAreas.filter((a) => a.area !== "GE8" && a.short > 0) : [];
    checks.push({
      id: `bucket:${b}`,
      bucket: b,
      label: `${BUCKET_META[b].label} ${s.need} หน่วยกิต`,
      status: s.short === 0 ? "pass" : "fail",
      detail:
        s.short === 0
          ? `ครบ ${s.counted}/${s.need}${s.earned + s.overflowIn > s.need ? ` (ลงเกิน ${s.earned + s.overflowIn - s.need})` : ""}`
          : `นับได้ ${s.counted}/${s.need} — ขาดอีก ${s.short}${
              mandatoryShort.length && s.earned >= s.need ? " เพราะหน่วยกิตเกินโควตาของบางสาระ ไม่ทดแทนสาระบังคับที่ยังขาด" : ""
            }`,
    });
  }
  if (geAreas.length) {
    const shortAreas = geAreas.filter((a) => a.short > 0);
    const subShort = (geAreas.find((a) => a.area === "GE2")?.sub ?? []).filter((s) => s.earned < s.need);
    const parts = shortAreas.map((a) =>
      a.area === "GE2" && subShort.length ? subShort.map((s) => `${s.key} ${s.need - s.earned}`).join(", ") : `${a.area} ${a.short}`
    );
    checks.push({
      id: "ge-areas",
      bucket: "ge",
      label: "ศึกษาทั่วไปครบทุกสาระ (GE1–GE7 และวิชาเลือก GE8)",
      status: shortAreas.length ? "fail" : "pass",
      detail: shortAreas.length ? `ยังขาด ${parts.join(" · ")} หน่วยกิต` : "ครบเกณฑ์ขั้นต่ำทุกสาระ",
    });
  }
  if (lookup.planCourses.size > 0) {
    const reqMissing = missing.filter((m) => m.bucket === "required").length;
    const geMissing = missing.length - reqMissing;
    checks.push({
      id: "plan-courses",
      bucket: reqMissing || !geMissing ? "required" : "ge",
      label: "รายวิชาบังคับที่แผนการศึกษาระบุรหัส",
      status: missing.length ? "fail" : planIncomplete ? "warn" : "pass",
      detail: missing.length
        ? `ยังไม่พบ ${missing.length} วิชา (${missingCredits} หน่วยกิต)${geMissing && reqMissing ? ` — วิชาเฉพาะ ${reqMissing} · ศึกษาทั่วไป ${geMissing}` : ""}`
        : planIncomplete
          ? "พบครบตามรายชื่อที่มีในระบบ แต่รายชื่อของฉบับนี้ยังไม่ครบทั้งหลักสูตร"
          : "ลงครบทุกวิชาในแผน",
    });
  }
  if (gpa) {
    checks.push({
      id: "gpa",
      label: `เกรดเฉลี่ยสะสมไม่ต่ำกว่า ${MIN_GRADUATION_GPA.toFixed(2)}`,
      status: gpa.value >= MIN_GRADUATION_GPA ? "pass" : "warn",
      detail: `ประมาณ ${gpa.value.toFixed(2)} จาก ${gpa.credits} หน่วยกิตที่มีเกรด${gpa.hasRepeat ? " (คิดทุกครั้งที่ลงซ้ำ ค่าใน SIS อาจต่างเล็กน้อย)" : ""}`,
    });
  }
  if (pending > 0) {
    checks.push({
      id: "pending",
      label: "รายวิชาที่ยังไม่มีเกรด",
      status: "warn",
      detail: `${pending} หน่วยกิตที่นับอยู่ยังไม่มีเกรด — ต้องสอบผ่านจึงจะได้หน่วยกิตจริง`,
    });
  }
  if (guessedCount > 0) {
    checks.push({
      id: "review",
      label: "รายวิชาที่ระบบเดาหมวด",
      status: "warn",
      detail: `${guessedCount} วิชาถูกจัดหมวดจากรหัสภาควิชา — ตรวจและแก้หมวดในรายการรายวิชา`,
    });
  }
  const failed = checks.some((c) => c.status === "fail");
  const verdict: CreditVerdict = failed ? "incomplete" : pending > 0 ? "pending" : "complete";

  return {
    total,
    counted,
    earned: BUCKETS.reduce((a, b) => a + earned[b], 0),
    remaining,
    pending,
    hasGrades,
    buckets,
    breakdown: {
      basicNeed: structure.basic,
      majorRequiredNeed: plan.required,
      extraNeed: extra,
      geOverflow,
      electiveOverflow,
    },
    overflowCourses,
    overflowByKey,
    geAreas,
    courses,
    byBucket,
    skipped,
    terms,
    missing,
    missingCredits,
    planIncomplete,
    guessedCount,
    gpa,
    pace,
    checks,
    verdict,
  };
}

// ------------------------------------------------------------------ prefs storage

export const CREDIT_CHECK_STORAGE_KEY = "psu-credit-check:v1";

export function readCreditCheckPrefs(): CreditCheckPrefs {
  try {
    const value = JSON.parse(localStorage.getItem(CREDIT_CHECK_STORAGE_KEY) || "null");
    if (!value || typeof value !== "object") return EMPTY_PREFS;
    const programId = typeof value.programId === "string" ? value.programId : undefined;
    const curriculumYear = typeof value.curriculumYear === "number" ? value.curriculumYear : undefined;
    const overrides: Record<string, BucketChoice> =
      value.overrides && typeof value.overrides === "object" ? value.overrides : {};
    let overridesByEdition: Record<string, Record<string, BucketChoice>> | undefined =
      value.overridesByEdition && typeof value.overridesByEdition === "object"
        ? value.overridesByEdition
        : undefined;
    const edKey = editionPrefKey(programId, curriculumYear);
    if (!overridesByEdition && edKey && Object.keys(overrides).length > 0) {
      overridesByEdition = { [edKey]: overrides };
    }
    return {
      programId,
      curriculumYear,
      planId: typeof value.planId === "string" ? value.planId : undefined,
      overrides,
      ...(overridesByEdition ? { overridesByEdition } : {}),
      excluded: Array.isArray(value.excluded) ? value.excluded : [],
      excludedTerms: Array.isArray(value.excludedTerms) ? value.excludedTerms : [],
    };
  } catch {
    return EMPTY_PREFS;
  }
}

export function writeCreditCheckPrefs(prefs: CreditCheckPrefs) {
  try {
    localStorage.setItem(CREDIT_CHECK_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable — choices just won't persist */
  }
}

// ------------------------------------------------------------------ course catalog for manual pick

export interface CatalogCourse {
  code: string;
  name: string;
  nameSub?: string;
  credits: number;
  creditsEstimated?: boolean;
  source: "missing" | "curriculum" | "elective" | "gened" | "sis";
  tag?: string;
}

function isRealCourseCode(code: string): boolean {
  return !/xxx/i.test(code) && !!baseCode(code);
}

function genedDisplayCode(g: GenedLite): string | null {
  const fromTitle = g.title.match(
    /^([A-Z0-9]{3}\s*-\s*(?:\d{3}|[A-Z]\d{2})\s*G[1-8][AB]?|[A-Z]{3}\d{2}G[1-8][AB]?\d{2,3})(?![A-Z0-9])/i
  );
  if (fromTitle) return fromTitle[1].replace(/\s+/g, "").toUpperCase();
  const fromSlug = g.slug.match(/^([A-Za-z0-9]{3}-(?:\d{3}|[A-Za-z]\d{2})g[1-8][ab]?)(?![A-Za-z0-9])/i);
  if (fromSlug) return fromSlug[1].toUpperCase();
  return g.code ?? baseCode(g.slug);
}

function cleanGenedTitle(title: string): string {
  return (
    title
      .replace(/^(?:[A-Z0-9]{3}\s*-\s*[A-Z0-9]{3,6}|[A-Z]{3}\d{2}[A-Z0-9]{4,6})\s*[:\-–—]?\s*/i, "")
      .replace(/^GE\d[AB]?\s*[:\-–—]\s*/i, "")
      .trim() || title.trim()
  );
}

function normCatalogCode(code: string): string {
  return code.trim().toUpperCase().replace(/[‐–—−]/g, "-").replace(/\s+/g, "");
}

function titlesMatch(a: string, b: string): boolean {
  // ใช้ NFKD แตกสระอำ (\u0E33 → \u0E4D+\u0E32) แล้วตัดช่องว่าง สระบน/ล่าง วรรณยุกต์ และ PUA glyph จาก PDF (เช่น คานวณศิลป์ ↔ คำนวณศิลป์)
  const strip = (s: string) => s.normalize("NFKD").replace(/[\s\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\uF700-\uF7FF]/g, "").toLowerCase();
  const na = strip(a);
  const nb = strip(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const minLen = Math.min(na.length, nb.length);
  return minLen >= 8 && (na.includes(nb) || nb.includes(na));
}

/** รวมฐานข้อมูลรายวิชาที่มีในฝั่ง client (วิชาในแผนที่ยังขาด, หลักสูตรคณะวิทย์ฯ, และหมวด GE) สำหรับหน้าเพิ่มวิชาเอง */
export function buildCatalogCourses(params: {
  curricula?: CurriculumFile | null;
  programId?: string;
  edition?: CurriculumEdition;
  plan?: CreditPlan;
  missing?: MissingCourse[];
  geCourses?: GenedLite[];
}): CatalogCourse[] {
  const byCode = new Map<string, CatalogCourse>();
  const gCodesByBase = new Map<string, Set<string>>();
  const targetYear = params.edition?.curriculumYear;
  const allowGMerge = targetYear === undefined || targetYear >= 2567;

  const upsert = (item: CatalogCourse) => {
    if (!isRealCourseCode(item.code)) return;
    const exact = normCatalogCode(item.code);
    const base = codeKey(item.code);
    const isG = !!geFromCode(item.code);

    if (isG) {
      let gSet = gCodesByBase.get(base);
      if (!gSet) {
        gSet = new Set();
        gCodesByBase.set(base, gSet);
      }
      gSet.add(exact);

      // ถ้ารายการเดิมเป็นรหัสไม่มี G ที่เป็นชื่อวิชาเดียวกัน (เช่น 315-100 คานวณศิลป์ → 315-100G2A คำนวณศิลป์)
      // รวมเป็นรายการเดียวเฉพาะหลักสูตร 2567+ เพื่อไม่ให้ลบรหัสปีเก่า (2564) ทิ้งจากรายการค้นหา
      const plain = byCode.get(base);
      if (plain && (allowGMerge || plain.source === "gened") && titlesMatch(plain.name, item.name)) {
        byCode.delete(base);
        byCode.set(exact, {
          ...item,
          name: item.source === "gened" ? item.name : plain.name,
          credits: !plain.creditsEstimated ? plain.credits : item.credits,
          creditsEstimated: plain.creditsEstimated && item.creditsEstimated,
          tag: plain.source === "missing" ? plain.tag : item.tag,
        });
        return;
      }
    } else if (allowGMerge) {
      for (const gKey of gCodesByBase.get(base) ?? []) {
        const gItem = byCode.get(gKey);
        if (gItem && titlesMatch(gItem.name, item.name)) {
          if (gItem.creditsEstimated && !item.creditsEstimated) {
            byCode.set(gKey, { ...gItem, credits: item.credits, creditsEstimated: false });
          }
          return;
        }
      }
    }

    const prev = byCode.get(exact);
    if (!prev) {
      byCode.set(exact, item);
      return;
    }
    const betterName = item.source === "gened" && prev.source !== "gened" ? item.name : prev.name;
    const betterCredits = prev.creditsEstimated && !item.creditsEstimated ? item.credits : prev.credits;
    const stillEst = prev.creditsEstimated && item.creditsEstimated;
    if (betterName !== prev.name || betterCredits !== prev.credits || stillEst !== prev.creditsEstimated) {
      byCode.set(exact, { ...prev, name: betterName, credits: betterCredits, creditsEstimated: stillEst });
    }
  };

  for (const m of params.missing ?? []) {
    if (m.bucket === "ge" && findLegacyGeSpec(m.code, m.name)?.discontinued) continue;
    upsert({
      code: m.code,
      name: m.name,
      credits: m.credits,
      source: "missing",
      tag: m.year >= 90 ? "ขาดในแผน" : `ขาด · ปี ${m.year}/${m.term}`,
    });
  }

  const addEdition = (ed: CurriculumEdition, p: CreditPlan | undefined, tagPrefix: string, skipDiscontinued = false) => {
    const hasVariant = p ? ed.years.some((y) => y.plan && /สหกิจ/.test(y.plan) === !!p.coop) : false;
    for (const y of ed.years) {
      if (p && !planMatches(p, y.plan, hasVariant)) continue;
      for (const t of y.terms) {
        if (isCatalogTerm(t)) continue;
        for (const c of t.courses) {
          if (c.placeholder) continue;
          const legacySpec = ed.curriculumYear < 2567 ? findLegacyGeSpec(c.code, c.name) : undefined;
          if (skipDiscontinued && legacySpec?.discontinued) continue;
          upsert({
            code: c.code,
            name: c.name,
            credits: c.credits,
            source: "curriculum",
            tag: legacySpec?.discontinued ? `รหัสเก่า · ${legacySpec.ge}` : `${tagPrefix} ${y.year}/${t.term}`,
          });
        }
      }
    }
    for (const area of ed.electives?.areas ?? []) {
      for (const c of area.courses) {
        upsert({
          code: c.code,
          name: c.name,
          credits: c.credits,
          source: "elective",
          tag: area.label ?? area.name,
        });
      }
    }
  };

  if (params.edition) addEdition(params.edition, params.plan, "ในแผน", targetYear !== undefined && targetYear >= 2567);

  for (const g of params.geCourses ?? []) {
    const code = genedDisplayCode(g);
    if (!code) continue;
    const levels = genedLevels(g);
    upsert({
      code,
      name: cleanGenedTitle(g.title),
      credits: 2,
      creditsEstimated: true,
      source: "gened",
      tag: levels[0] ?? "GE",
    });
  }

  for (const prog of params.curricula?.programs ?? []) {
    const sorted = [...prog.editions].sort((a, b) => b.curriculumYear - a.curriculumYear);
    if (!sorted.length) continue;
    if (params.edition) {
      // แยกฉบับปีเก่าและปีล่าสุดออกจากกัน: ไม่นำฉบับอื่นของสาขาเดียวกันหรือคนละปีมาทับรหัส/หน่วยกิต
      if ((params.programId && prog.id === params.programId) || (!params.programId && prog.editions.includes(params.edition))) {
        continue;
      }
      const matched = sorted.find((e) => e.curriculumYear === targetYear);
      if (matched) {
        addEdition(matched, undefined, prog.name, matched.curriculumYear >= 2567);
      } else {
        const fallback = targetYear! < sorted[sorted.length - 1].curriculumYear ? sorted[sorted.length - 1] : sorted[0];
        addEdition(fallback, undefined, `${prog.name} (${fallback.curriculumYear})`, targetYear! >= 2567);
      }
    } else {
      const latest = sorted[0];
      addEdition(latest, undefined, prog.name, latest.curriculumYear >= 2567);
    }
  }

  return [...byCode.values()];
}
