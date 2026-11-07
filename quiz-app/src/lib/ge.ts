// หมวดวิชาศึกษาทั่วไป (GE) — classification + progress + elective recommendation.
// Pure helpers, safe to import from both client and server code.
//
// Sources of truth, in order:
//   1. SIS course code suffix, e.g. "001-102G6" → GE6 (assigned by the university)
//   2. gened.psu.ac.th WordPress categories, matched by course code in the post slug
//   3. same, matched by normalised Thai course name

import {
  examsOverlap,
  sectionClashes,
  sectionExamClashes,
  slotsOverlap,
  type Course,
  type CurriculumProgram,
  type PlannedEntry,
  type Section,
} from "./timetable";

export const GE_ORDER = ["GE1", "GE2", "GE2A", "GE2B", "GE3", "GE4", "GE5", "GE6", "GE7", "GE8"] as const;
export type GeKey = (typeof GE_ORDER)[number];

/** The seven learning areas + electives used for progress (GE2A/GE2B roll up into GE2). */
export const GE_AREAS = ["GE1", "GE2", "GE3", "GE4", "GE5", "GE6", "GE7", "GE8"] as const;

export interface GeMeta {
  key: GeKey;
  name: string;
  short: string;
  /** tailwind chip classes (always paired with the GE label text, never colour alone) */
  chip: string;
  /** solid accent for small dots / progress fills */
  accent: string;
}

export const GE_META: Record<GeKey, GeMeta> = {
  GE1: { key: "GE1", name: "ศิลปะการสื่อสารและภาษา", short: "สื่อสาร/ภาษา", chip: "bg-sky-50 text-sky-800 ring-sky-200", accent: "#0284c7" },
  GE2: { key: "GE2", name: "การคิดเชิงตรรกะและเชิงระบบ", short: "ตรรกะ/ระบบ", chip: "bg-indigo-50 text-indigo-800 ring-indigo-200", accent: "#4f46e5" },
  GE2A: { key: "GE2A", name: "การคิดเชิงตรรกะและตัวเลข", short: "ตรรกะ/ตัวเลข", chip: "bg-indigo-50 text-indigo-800 ring-indigo-200", accent: "#4f46e5" },
  GE2B: { key: "GE2B", name: "การคิดเชิงระบบ", short: "คิดเชิงระบบ", chip: "bg-violet-50 text-violet-800 ring-violet-200", accent: "#7c3aed" },
  GE3: { key: "GE3", name: "กรอบความคิดผู้ประกอบการ", short: "ผู้ประกอบการ", chip: "bg-amber-50 text-amber-800 ring-amber-200", accent: "#d97706" },
  GE4: { key: "GE4", name: "เทคโนโลยีดิจิทัล", short: "ดิจิทัล", chip: "bg-cyan-50 text-cyan-800 ring-cyan-200", accent: "#0891b2" },
  GE5: { key: "GE5", name: "สุขภาวะองค์รวม", short: "สุขภาวะ", chip: "bg-rose-50 text-rose-800 ring-rose-200", accent: "#e11d48" },
  GE6: { key: "GE6", name: "จิตสาธารณะและการพัฒนาที่ยั่งยืน", short: "จิตสาธารณะ", chip: "bg-teal-50 text-teal-800 ring-teal-200", accent: "#0d9488" },
  GE7: { key: "GE7", name: "มนุษยชาติกับสิ่งแวดล้อม", short: "สิ่งแวดล้อม", chip: "bg-green-50 text-green-800 ring-green-200", accent: "#16a34a" },
  GE8: { key: "GE8", name: "รายวิชาเลือกในหมวดศึกษาทั่วไป", short: "เลือก GE8", chip: "bg-orange-50 text-orange-800 ring-orange-200", accent: "#ea580c" },
};

export function isGeKey(s: string): s is GeKey {
  return (GE_ORDER as readonly string[]).includes(s);
}

/** GE2A/GE2B → GE2 for area roll-ups */
export function geArea(k: GeKey): (typeof GE_AREAS)[number] {
  return k === "GE2A" || k === "GE2B" ? "GE2" : k;
}

// ------------------------------------------------------------------ codes & names

/** "001-102G6" / "001102" / "895-178g7" → "001-102" */
export function baseCode(code: string): string | null {
  const m = code.match(/(\d{3})\s*-?\s*(\d{3})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** SIS code suffix → GE key ("117-201G2A" → "GE2A") */
export function geFromCode(code: string): GeKey | null {
  const m = code.trim().match(/^\d{3}-\d{3}\s*G\s*(\d)([AB])?$/i);
  if (!m) return null;
  const key = `GE${m[1]}${(m[2] ?? "").toUpperCase()}`;
  return isGeKey(key) ? key : null;
}

/** For name matching: drop spaces/punctuation, unify Thai sara-am variants. */
export function normName(s: string): string {
  return s
    .normalize("NFC")
    .replace(/ํา/g, "ำ")
    .replace(/[\s()（）\-–—:.,"'“”‘’/|]/g, "")
    .toLowerCase();
}

// ------------------------------------------------------------------ gened index

export interface GenedLite {
  id: number;
  title: string;
  slug: string;
  link: string;
  code?: string | null;
  geLevels: string[];
  campuses: string[];
  ge8Groups?: string[];
  sdgs?: number[];
}

export interface GeInfo {
  levels: GeKey[];
  ge8Groups: string[];
  source: "sis-code" | "gened-code" | "gened-name";
  link?: string;
  sdgs?: number[];
}

export interface GeIndex {
  byCode: Map<string, GenedLite[]>;
  byName: Map<string, GenedLite[]>;
}

export function genedLevels(g: GenedLite): GeKey[] {
  const out = new Set<GeKey>();
  for (const l of g.geLevels) {
    if (isGeKey(l)) out.add(l);
    else if (l === "elective") out.add("GE8");
  }
  // the parent "GE 2" category is implied by GE2A/GE2B — keep the specific one
  if (out.has("GE2A") || out.has("GE2B")) out.delete("GE2");
  return GE_ORDER.filter((k) => out.has(k));
}

export function buildGeIndex(courses: GenedLite[]): GeIndex {
  const byCode = new Map<string, GenedLite[]>();
  const byName = new Map<string, GenedLite[]>();
  for (const c of courses) {
    if (!genedLevels(c).length) continue;
    const code = c.code ?? baseCode(c.slug);
    if (code) byCode.set(code, [...(byCode.get(code) ?? []), c]);
    const n = normName(c.title);
    if (n) byName.set(n, [...(byName.get(n) ?? []), c]);
  }
  return { byCode, byName };
}

function fromGened(list: GenedLite[], source: GeInfo["source"], campus?: string): GeInfo {
  // prefer the post for the same campus if the course exists on several campuses
  const short = campus?.replace(/^วิทยาเขต/, "");
  const ranked = short ? [...list].sort((a, b) => Number(b.campuses.includes(short)) - Number(a.campuses.includes(short))) : list;
  const levels = new Set<GeKey>();
  const groups = new Set<string>();
  const sdgs = new Set<number>();
  for (const g of ranked) {
    genedLevels(g).forEach((l) => levels.add(l));
    g.ge8Groups?.forEach((x) => groups.add(x));
    g.sdgs?.forEach((x) => sdgs.add(x));
  }
  return { levels: [...levels], ge8Groups: [...groups], source, link: ranked[0]?.link, sdgs: [...sdgs].sort((a, b) => a - b) };
}

/** GE classification of a SIS course (or any {code,name}); null = not a GE course as far as we know. */
export function classifyCourse(
  c: { code: string; nameTh?: string; name?: string; campus?: string },
  index?: GeIndex | null
): GeInfo | null {
  const direct = geFromCode(c.code);
  const base = baseCode(c.code);
  const hit = index && base ? index.byCode.get(base) : undefined;
  const name = normName(c.nameTh ?? c.name ?? "");
  const byName = index && name ? index.byName.get(name) : undefined;
  if (direct) {
    const extra = hit ?? byName;
    const info = extra ? fromGened(extra, "sis-code", c.campus) : null;
    return { levels: [direct], ge8Groups: info?.ge8Groups ?? [], source: "sis-code", link: info?.link, sdgs: info?.sdgs };
  }
  if (hit?.length) return fromGened(hit, "gened-code", c.campus);
  // name-only matches are limited to undergraduate codes (x00–x4xx): graduate
  // courses reuse generic titles such as "ภาษาอังกฤษเชิงวิชาการ"
  const level = base ? Number(base[4]) : 0;
  if (byName?.length && level < 5) return fromGened(byName, "gened-name", c.campus);
  return null;
}

// ------------------------------------------------------------------ curriculum placeholders

export type PlaceholderKind = "ge" | "free" | "major";

export interface PlaceholderInfo {
  kind: PlaceholderKind;
  /** GE keys this row is explicitly about, if the plan says so */
  hint: GeKey[];
  /** GE8 sub-group hint, e.g. "สุนทรียศาสตร์และกีฬา" */
  ge8Group?: string;
}

/** "รายวิชาในหมวดวิชาศึกษาทั่วไป (บังคับ)" → ge; "วิชาเลือกเสรี" → free; else major elective */
export function classifyPlaceholder(name: string): PlaceholderInfo {
  const n = name.replace(/\s+/g, "");
  if (/เสรี|อิสระ(?!กลุ่มรายวิชาศึกษาทั่วไป)/.test(n) && !/ศึกษาทั่วไป/.test(n)) return { kind: "free", hint: [] };
  const isGe = /ศึกษาทั่วไป|กลุ่มสาระ|สาระ|G\d|GE\d|ภาษาและการสื่อสาร|ภาษาและ|สุนทรีย|สุทรีย|การคิดเชิงตรรกะ/.test(n);
  if (!isGe) return { kind: "major", hint: [] };
  const hint = new Set<GeKey>();
  let ge8Group: string | undefined;
  if (/G1-G7/i.test(n)) ["GE1", "GE2", "GE3", "GE4", "GE5", "GE6", "GE7"].forEach((k) => hint.add(k as GeKey));
  const explicit = n.match(/G(?:E)?(\d)([AB])?/gi) ?? [];
  if (!/G1-G7/i.test(n)) {
    for (const e of explicit) {
      const m = e.match(/(\d)([AB])?/i);
      const key = m ? `GE${m[1]}${(m[2] ?? "").toUpperCase()}` : "";
      if (isGeKey(key)) hint.add(key);
    }
  }
  if (/ภาษา/.test(n)) {
    hint.add("GE1");
    if (!/บังคับ/.test(n)) {
      hint.add("GE8");
      ge8Group = "ภาษา";
    }
  }
  if (/สุนทรีย|สุทรีย|กีฬา/.test(n)) {
    hint.add("GE8");
    ge8Group = "สุนทรียศาสตร์และกีฬา";
  }
  if (/ตรรกะ|ตัวเลข/.test(n)) hint.add("GE2A");
  return { kind: "ge", hint: [...hint], ge8Group };
}

/**
 * Safety net for an appendix course list ("รายวิชาเลือก …") imported as a term — no real term carries
 * > 30 credits. The importer (scripts/timetable/curriculum-parser.mjs) already drops those; a real
 * term may list many rows when it offers alternatives ("เลือก 1 วิชาจาก …"), so rows alone don't count.
 */
export function isCatalogTerm(t: { credits: number; courses: unknown[] }): boolean {
  return t.credits > 30;
}

/** Some imported plans miss GE rows; only trust a total in the usual 18–45 credit band. */
export function plausibleGeTarget(t: CurriculumTargets | null | undefined): number {
  const n = t?.geCredits ?? 0;
  return n >= 18 && n <= 45 ? n : 0;
}

export interface CurriculumTargets {
  geCredits: number;
  freeCredits: number;
  /** GE keys the plan mentions explicitly (e.g. "สุนทรียศาสตร์และกีฬา" → GE8) */
  mentioned: GeKey[];
}

/** Sum GE / free-elective credits a curriculum edition asks for (placeholders + coded GE courses). */
export function curriculumTargets(
  program: CurriculumProgram | undefined,
  curriculumYear: number | undefined,
  plan: string | undefined,
  index?: GeIndex | null
): CurriculumTargets | null {
  const edition = program?.editions.find((e) => e.curriculumYear === curriculumYear) ?? program?.editions[0];
  if (!edition) return null;
  let ge = 0;
  let free = 0;
  const mentioned = new Set<GeKey>();
  for (const y of edition.years) {
    if (y.plan && plan && y.plan !== plan) continue;
    for (const t of y.terms) {
      if (isCatalogTerm(t)) continue;
      // Plans sometimes list alternatives ("เลือก 1 วิชาจาก …") inside a term, so
      // the rows add up to more than the term's credits. Treat the excess as
      // alternatives and take it off the GE-coded rows.
      let all = 0;
      let geCoded = 0;
      let gePlaceholder = 0;
      const seen = new Set<string>();
      for (const c of t.courses) {
        if (c.placeholder) {
          all += c.credits;
          const p = classifyPlaceholder(c.name);
          if (p.kind === "ge") gePlaceholder += c.credits;
          if (p.kind === "free") free += c.credits;
          p.hint.forEach((h) => mentioned.add(h));
          continue;
        }
        const key = baseCode(c.code) ?? c.code;
        if (seen.has(key)) continue;
        seen.add(key);
        all += c.credits;
        if (classifyCourse({ code: c.code, name: c.name }, index)) geCoded += c.credits;
      }
      const overflow = t.credits > 0 ? Math.max(0, all - t.credits) : 0;
      ge += gePlaceholder + Math.max(0, geCoded - overflow);
    }
  }
  return { geCredits: ge, freeCredits: free, mentioned: [...mentioned] };
}

// ------------------------------------------------------------------ progress

export interface CreditItem {
  code: string;
  name: string;
  credits: number;
  /** done = in registration history, planned = in the current timetable */
  status: "done" | "planned";
  term?: string;
}

export interface GeProgress {
  byArea: Record<(typeof GE_AREAS)[number], { done: number; planned: number; items: (CreditItem & { ge: GeKey })[] }>;
  totalDone: number;
  totalPlanned: number;
  /** areas GE1–GE7 with no credits at all (done or planned) */
  missingAreas: (typeof GE_AREAS)[number][];
}

export function geProgress(items: CreditItem[], index?: GeIndex | null): GeProgress {
  const byArea = {} as GeProgress["byArea"];
  for (const a of GE_AREAS) byArea[a] = { done: 0, planned: 0, items: [] };
  const seen = new Set<string>();
  let totalDone = 0;
  let totalPlanned = 0;
  for (const it of items) {
    const key = `${baseCode(it.code) ?? it.code}|${it.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const info = classifyCourse({ code: it.code, name: it.name }, index);
    if (!info?.levels.length) continue;
    const ge = info.levels[0];
    const area = byArea[geArea(ge)];
    area.items.push({ ...it, ge });
    if (it.status === "done") {
      area.done += it.credits;
      totalDone += it.credits;
    } else {
      area.planned += it.credits;
      totalPlanned += it.credits;
    }
  }
  const missingAreas = GE_AREAS.filter((a) => a !== "GE8" && byArea[a].done + byArea[a].planned === 0);
  return { byArea, totalDone, totalPlanned, missingAreas };
}

// ------------------------------------------------------------------ recommendations

export interface Recommendation {
  course: Course;
  info: GeInfo;
  /** best section that fits the current timetable (or the first one if none fit) */
  section: Section;
  fits: boolean;
  score: number;
  reasons: string[];
}

export interface RecommendOptions {
  courses: Course[];
  index: GeIndex | null;
  entries: PlannedEntry[];
  /** base codes already passed / registered (exclude) */
  takenCodes: Set<string>;
  progress: GeProgress;
  /** restrict to these GE keys (e.g. a curriculum placeholder hint) */
  only?: GeKey[];
  ge8Group?: string;
  campus?: string | "all";
  /** include courses whose every section clashes (flagged, ranked last) */
  includeClashing?: boolean;
  /** "ge" = GE courses only; "free" = also non-GE courses from other faculties */
  mode?: "ge" | "free";
  ownFaculty?: string;
  limit?: number;
}

function bestSection(course: Course, entries: PlannedEntry[]): { section: Section; fits: boolean } | null {
  if (!course.sections.length) return null;
  let fallback: Section | null = null;
  for (const s of course.sections) {
    const clash = sectionClashes(s, entries, course.id).length > 0 || sectionExamClashes(s, entries, course.id).length > 0;
    if (!clash && (s.seats === null || s.seats > 0)) return { section: s, fits: true };
    if (!clash && !fallback) fallback = s;
  }
  if (fallback) return { section: fallback, fits: true };
  return { section: course.sections[0], fits: false };
}

/** Hours (per week) a section adds — used to prefer compact options. */
function weeklyHours(s: Section) {
  return s.slots.reduce((n, sl) => n + (sl.end - sl.start) / 60, 0);
}

/** Does this section sit right next to something already planned (same day, ≤ 1h gap)? */
function packsWell(s: Section, entries: PlannedEntry[]) {
  return s.slots.some((sl) =>
    entries.some((e) =>
      e.slots.some(
        (o) =>
          o.day === sl.day &&
          !slotsOverlap(o, sl) &&
          (Math.abs(o.end - sl.start) <= 60 || Math.abs(sl.end - o.start) <= 60)
      )
    )
  );
}

export function recommendElectives(o: RecommendOptions): Recommendation[] {
  const plannedBase = new Set(o.entries.map((e) => baseCode(e.code) ?? e.code));
  const missing = new Set<string>(o.progress.missingAreas);
  const out: Recommendation[] = [];
  const seenBase = new Map<string, number>();

  for (const course of o.courses) {
    if (o.campus && o.campus !== "all" && course.campus !== o.campus) continue;
    const base = baseCode(course.code) ?? course.code;
    if (o.takenCodes.has(base) || plannedBase.has(base)) continue;

    let info = classifyCourse(course, o.index);
    if (!info) {
      if (o.mode !== "free") continue;
      if (o.ownFaculty && course.faculty === o.ownFaculty) continue;
      if (course.creditNum < 1 || course.creditNum > 3) continue;
      info = { levels: [], ge8Groups: [], source: "gened-name" };
    }
    if (o.only?.length && !info.levels.some((l) => o.only!.includes(l) || o.only!.includes(geArea(l)))) continue;
    if (o.ge8Group && info.levels.includes("GE8") && info.ge8Groups.length && !info.ge8Groups.some((g) => g.includes(o.ge8Group!.slice(0, 5)))) continue;

    const best = bestSection(course, o.entries);
    if (!best) continue;
    if (!best.fits && !o.includeClashing) continue;

    const reasons: string[] = [];
    let score = 0;
    const area = info.levels[0] ? geArea(info.levels[0]) : null;
    if (area && missing.has(area)) {
      score += 60;
      reasons.push(`ยังไม่มีหน่วยกิตหมวด ${area}`);
    } else if (area) {
      const have = o.progress.byArea[area].done + o.progress.byArea[area].planned;
      score += Math.max(0, 20 - have * 4);
    } else {
      reasons.push("วิชานอกคณะ (เลือกเสรี)");
    }
    if (best.fits) {
      score += 30;
      reasons.push(`ไม่ชนตาราง (Sec ${best.section.sec})`);
    } else reasons.push("ทุก Sec ชนกับตารางปัจจุบัน");
    const seats = best.section.seats;
    if (seats !== null && seats >= 30) {
      score += 6;
      reasons.push(`รับ ${seats} ที่`);
    }
    if (best.fits && packsWell(best.section, o.entries)) {
      score += 8;
      reasons.push("ต่อเนื่องกับวิชาอื่นในวันเดียวกัน");
    }
    if (best.section.slots.some((s) => /online/i.test(s.room ?? "")) || /online/i.test(best.section.room)) {
      score += 3;
      reasons.push("เรียนออนไลน์");
    }
    if (!best.section.midtermAt && !best.section.finalAt) score += 2;
    score -= weeklyHours(best.section) * 0.5;
    if (info.source !== "sis-code" && info.levels.length) score -= 2;

    // the same course code at several campuses — keep the best-scoring copy only
    const prev = seenBase.get(base);
    if (prev !== undefined) {
      if (out[prev].score >= score) continue;
      out[prev] = { course, info, section: best.section, fits: best.fits, score, reasons };
      continue;
    }
    seenBase.set(base, out.length);
    out.push({ course, info, section: best.section, fits: best.fits, score, reasons });
  }

  out.sort((a, b) => b.score - a.score || a.course.code.localeCompare(b.course.code));
  return out.slice(0, o.limit ?? 30);
}

/** Exams that would clash if `s` were added — for UI warnings. */
export function examClashCodes(s: Section, entries: PlannedEntry[], courseId: string): string[] {
  return entries
    .filter((e) => e.course?.id !== courseId && (examsOverlap(e.midterm, s.midtermAt) || examsOverlap(e.final, s.finalAt)))
    .map((e) => e.code);
}
