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
  /** รายการที่ไม่นับ (ติด F / ถอน W) — key = `${term}|${code}` */
  excluded: string[];
  /** ภาคการศึกษาที่ไม่นับทั้งภาค (เช่น ภาคที่กำลังเรียน) */
  excludedTerms: string[];
}

export const EMPTY_PREFS: CreditCheckPrefs = { overrides: {}, excluded: [], excludedTerms: [] };

export type SkipReason = "repeat" | "audit" | "fail" | "excluded" | "term" | "none";

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
  /** true = ระบบเดาจากรหัสภาควิชา ควรตรวจเอง */
  guessed: boolean;
  overridden: boolean;
  ge: GeKey | null;
  /** เหตุผลที่ไม่นับหน่วยกิต */
  skip: SkipReason | null;
}

export interface BucketSummary {
  /** หน่วยกิตที่จัดเข้าหมวดนี้โดยตรง */
  earned: number;
  /** หน่วยกิตส่วนเกินจากหมวดอื่นที่ไหลมานับ (เฉพาะเลือกเสรี) */
  overflowIn: number;
  need: number;
  /** min(earned + overflowIn, need) */
  counted: number;
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

export interface CreditSummary {
  total: number;
  /** หน่วยกิตที่นับเข้าโครงสร้างได้ (ไม่เกินเกณฑ์ของแต่ละหมวด) */
  counted: number;
  /** หน่วยกิตที่ลงทะเบียนและนับทั้งหมด (รวมส่วนเกิน) */
  earned: number;
  remaining: number;
  buckets: Record<Bucket, BucketSummary>;
  geAreas: {
    area: (typeof GE_AREAS)[number];
    earned: number;
    need: number;
    sub?: { key: GeKey; short: string; earned: number; need: number }[];
  }[];
  courses: CheckedCourse[];
  missing: MissingCourse[];
  /** แผนการศึกษาที่นำเข้ามีหน่วยกิตไม่ครบทั้งหลักสูตร (รายชื่อวิชาบังคับอาจขาดชั้นปีท้าย ๆ) */
  planIncomplete: boolean;
  guessedCount: number;
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
  const legacySpec = structure.curriculumYear < 2567 ? findLegacyGeSpec(record.code, record.name) : undefined;
  const legacyGe = structure.curriculumYear < 2567 && isLegacyGe(record.code, record.name);
  const resolvedGe = geKey ?? legacySpec?.ge ?? null;
  const scienceCode = key[0] === "3";
  // 2) วิชาในแผนการศึกษา: วิชา GE ที่แผนระบุรหัสไว้ยังเป็น GE, ที่เหลือเป็นวิชาบังคับ
  if (lookup.planCourses.has(key)) {
    if (legacyGe || (info && !scienceCode)) return { bucket: "ge", guessed: false, ge: resolvedGe, fromG2567: false };
    return { bucket: "required", guessed: false, ge: null, fromG2567: false };
  }
  // 3) วิชา GE ที่ไม่อยู่ในแผน
  if (legacyGe || info) return { bucket: "ge", guessed: false, ge: resolvedGe, fromG2567: false };
  // 4) วิชาเลือกของหมวดวิชาเฉพาะ
  if (lookup.electiveCodes.has(key)) return { bucket: "elective", guessed: false, ge: null, fromG2567: false };
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

// ------------------------------------------------------------------ summary

export function summarizeCredits(
  records: RegistrationRecord[],
  structure: CreditStructure,
  plan: CreditPlan,
  edition: CurriculumEdition | undefined,
  prefs: CreditCheckPrefs,
  index?: GeIndex | null
): CreditSummary {
  const lookup = buildLookup(edition, plan);
  const extra = (structure.extra ?? []).reduce((a, e) => a + e.credits, 0);
  const need: Record<Bucket, number> = {
    ge: structure.ge,
    required: structure.basic + plan.required + extra,
    elective: plan.elective,
    free: structure.free,
  };
  const total = need.ge + need.required + need.elective + need.free;
  // แผนที่นำเข้าครบหรือไม่: วิชาบังคับที่แผนระบุรหัสควรรวมได้ใกล้เคียงเกณฑ์ของหมวด
  const planRequired = [...lookup.planCourses.values()]
    .filter((c) => classify(c, structure, lookup, false, index).bucket === "required")
    .reduce((a, c) => a + c.credits, 0);
  const planIncomplete = planRequired < need.required - 4;

  const excluded = new Set(prefs.excluded);
  const excludedTerms = new Set(prefs.excludedTerms);
  // ใหม่ → เก่า: วิชาที่ลงซ้ำนับครั้งล่าสุดที่ยังนับอยู่เพียงครั้งเดียว (ถ้าภาคเดียวกันมีทั้งมีเกรดและไม่มีเกรด ให้ดูตัวที่มีเกรดก่อน)
  const ordered = [...records].sort((a, b) => termOrder(b.term) - termOrder(a.term) || (b.grade ? 1 : 0) - (a.grade ? 1 : 0) || a.code.localeCompare(b.code));
  const countedCodes = new Set<string>();
  const courses: CheckedCourse[] = [];
  const earned: Record<Bucket, number> = { ge: 0, required: 0, elective: 0, free: 0 };
  const areaEarned = new Map<string, number>();
  const subEarned = new Map<GeKey, number>();
  const ge2567AreaEarned = new Map<string, number>();
  const ge2567SubEarned = new Map<GeKey, number>();
  let hasGe2567 = false;
  let guessedCount = 0;

  for (const record of ordered) {
    const key = recordKey(record);
    const base = codeKey(record.code);
    const auto = classify(record, structure, lookup, planIncomplete, index);
    const override = prefs.overrides[base];
    const bucket: BucketChoice = override ?? auto.bucket;
    const grade = record.grade?.trim().toUpperCase();
    let skip: SkipReason | null = null;
    if (excludedTerms.has(record.term)) skip = "term";
    else if (excluded.has(key)) skip = "excluded";
    else if (record.type.toUpperCase() === "A" || grade === "AU") skip = "audit";
    else if (isNonEarnedGrade(grade)) skip = "fail";
    else if (bucket === "none") skip = "none";
    else if (countedCodes.has(base)) skip = "repeat";
    if (!skip && bucket !== "none") {
      countedCodes.add(base);
      earned[bucket] += record.credits;
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
      if (auto.guessed && !override) guessedCount++;
    }
    courses.push({ key, record, base, bucket, auto: auto.bucket, guessed: auto.guessed && !override, overridden: !!override, ge: auto.ge, skip });
  }

  // ส่วนเกินของ GE และวิชาเลือกเฉพาะ นับเป็นเลือกเสรีได้
  const overflow = Math.max(0, earned.ge - need.ge) + Math.max(0, earned.elective - need.elective);
  const buckets = {} as Record<Bucket, BucketSummary>;
  for (const b of BUCKETS) {
    const overflowIn = b === "free" ? overflow : 0;
    buckets[b] = { earned: earned[b], overflowIn, need: need[b], counted: Math.min(earned[b] + overflowIn, need[b]) };
  }
  const counted = BUCKETS.reduce((a, b) => a + buckets[b].counted, 0);

  // วิชาในแผนที่ยังไม่พบ: นับรวมรายการที่ยกเว้นไว้ว่ายัง "ไม่พบ" ด้วย
  const missing: MissingCourse[] = [];
  for (const c of lookup.planCourses.values()) {
    if (countedCodes.has(c.code)) continue;
    const auto = classify({ code: c.code, name: c.name }, structure, lookup, planIncomplete, index);
    if (auto.bucket !== "ge" && auto.bucket !== "required") continue;
    const legacySpec = auto.bucket === "ge" && structure.curriculumYear < 2567 ? findLegacyGeSpec(c.code, c.name) : undefined;
    if (
      auto.bucket === "ge" &&
      structure.curriculumYear < 2567 &&
      isLegacyGeSatisfied(legacySpec, auto.ge, {
        geEarned: earned.ge,
        geNeed: need.ge,
        countedCodes,
        hasGe2567,
        areaEarned,
        subEarned,
        ge2567AreaEarned,
        ge2567SubEarned,
      })
    ) {
      continue;
    }
    missing.push({ ...c, bucket: auto.bucket, ...(legacySpec?.note ? { note: legacySpec.note } : {}) });
  }
  missing.sort((a, b) => a.year - b.year || a.term - b.term || a.code.localeCompare(b.code));

  const geAreas =
    structure.curriculumYear >= 2567 || hasGe2567
      ? GE_AREAS.map((area) => ({
          area,
          earned: areaEarned.get(area) ?? 0,
          need: GE_AREA_MIN[area] ?? Math.max(0, structure.ge - 18),
          ...(area === "GE2"
            ? {
                sub: GE2_SUB_MIN.map((s) => ({
                  ...s,
                  earned: subEarned.get(s.key) ?? 0,
                })),
              }
            : {}),
        }))
      : [];

  return {
    total,
    counted,
    earned: BUCKETS.reduce((a, b) => a + earned[b], 0),
    remaining: Math.max(0, total - counted),
    buckets,
    geAreas,
    courses,
    missing,
    planIncomplete,
    guessedCount,
  };
}

// ------------------------------------------------------------------ prefs storage

export const CREDIT_CHECK_STORAGE_KEY = "psu-credit-check:v1";

export function readCreditCheckPrefs(): CreditCheckPrefs {
  try {
    const value = JSON.parse(localStorage.getItem(CREDIT_CHECK_STORAGE_KEY) || "null");
    if (!value || typeof value !== "object") return EMPTY_PREFS;
    return {
      programId: typeof value.programId === "string" ? value.programId : undefined,
      curriculumYear: typeof value.curriculumYear === "number" ? value.curriculumYear : undefined,
      planId: typeof value.planId === "string" ? value.planId : undefined,
      overrides: value.overrides && typeof value.overrides === "object" ? value.overrides : {},
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
  edition?: CurriculumEdition;
  plan?: CreditPlan;
  missing?: MissingCourse[];
  geCourses?: GenedLite[];
}): CatalogCourse[] {
  const byCode = new Map<string, CatalogCourse>();
  const gCodesByBase = new Map<string, Set<string>>();

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
      // รวมเป็นรายการเดียวโดยใช้รหัส G และชื่อที่เป็นทางการกว่า แต่ห้ามปนกับคนละวิชา (เช่น 322-100 คำนวณศิลป์ ≠ 322-100G2A รวยด้วยคณิตศาสตร์)
      const plain = byCode.get(base);
      if (plain && titlesMatch(plain.name, item.name)) {
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
    } else {
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

  if (params.edition) addEdition(params.edition, params.plan, "ในแผน", true);

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
    for (const ed of [...prog.editions].sort((a, b) => b.curriculumYear - a.curriculumYear)) {
      addEdition(ed, undefined, prog.name);
    }
  }

  return [...byCode.values()];
}
