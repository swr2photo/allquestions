// ระบบจัดตารางเรียน — data model + pure helpers (no React here)
//
// ข้อมูลแต่ละภาคการศึกษาอยู่ที่ public/timetable/terms/<year>-<term>.json
// สร้างโดย scripts/timetable/import-term.mjs จากข้อมูล SIS (sis.psu.ac.th)

export const DAY_NAMES = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"] as const;
export const DAY_SHORT = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."] as const;
export const DAY_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export interface Slot {
  /** 0 = จันทร์ … 6 = อาทิตย์ */
  day: number;
  /** minutes from 00:00 */
  start: number;
  end: number;
  room?: string;
}

export interface ExamTime {
  /** ISO date (ค.ศ.) YYYY-MM-DD */
  date: string;
  start: number;
  end: number;
}

export interface Section {
  sec: string;
  seats: number | null;
  group: string;
  badges: string[];
  room: string;
  instructors: string[];
  dayTime: string;
  slots: Slot[];
  midterm: string;
  final: string;
  midtermAt: ExamTime | null;
  finalAt: ExamTime | null;
}

export interface Course {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  credits: string;
  creditNum: number;
  faculty: string;
  dept: string;
  campus: string;
  desc: string;
  url: string;
  conditions?: { title: string; body: string }[];
  sections: Section[];
}

export interface TermData {
  id: string;
  year: number;
  term: number;
  label: string;
  source: string;
  fetchedAt: string;
  courses: Course[];
}

export interface TermIndexEntry {
  id: string;
  year: number;
  term: number;
  label: string;
  file: string;
  courses: number;
  sections: number;
  campuses: Record<string, number>;
  faculties: number;
  fetchedAt: string;
  complete: boolean;
  source: string;
}

export interface CurriculumCourse {
  code: string;
  name: string;
  credits: number;
  /** รายวิชาแบบ placeholder เช่น "344-xxx วิชาเลือก" ไม่มีรหัสจริง */
  placeholder?: boolean;
}

export interface CurriculumTerm {
  term: number;
  credits: number;
  courses: CurriculumCourse[];
}

export interface CurriculumYear {
  year: number;
  /** ชื่อแผนการศึกษา เช่น "โครงงาน" / "สหกิจศึกษา" ถ้าหลักสูตรแยกแผน */
  plan?: string;
  terms: CurriculumTerm[];
}

export interface CurriculumEdition {
  /** ปีของหลักสูตร (พ.ศ.) เช่น 2569 / 2564 */
  curriculumYear: number;
  source: string;
  years: CurriculumYear[];
}

export interface CurriculumProgram {
  id: string;
  name: string;
  division: string;
  editions: CurriculumEdition[];
}

export interface CurriculumFile {
  faculty: string;
  programs: CurriculumProgram[];
}

/** public/timetable/curricula/index.json — faculties that have imported study plans */
export interface CurriculaIndexEntry {
  id: string;
  /** SIS faculty name, e.g. "คณะวิทยาศาสตร์" */
  faculty: string;
  campus: string;
  file: string;
  programs: number;
  source?: string;
  updatedAt?: string;
}

export interface CurriculaIndex {
  faculties: CurriculaIndexEntry[];
}
export interface TermIndex {
  updatedAt: string;
  terms: TermIndexEntry[];
}

/** One entry in the user's plan. Custom entries are activities the user typed in. */
export type PlanItem =
  | { kind: "course"; courseId: string; sec: string; color: number }
  | {
      kind: "custom";
      id: string;
      code: string;
      name: string;
      room: string;
      credits: number;
      slots: Slot[];
      color: number;
    };

/** Normalised view of a plan item used for rendering & conflict checks. */
export interface PlannedEntry {
  key: string;
  item: PlanItem;
  code: string;
  name: string;
  nameEn: string;
  sec: string;
  credits: number;
  slots: Slot[];
  instructors: string[];
  room: string;
  midterm: ExamTime | null;
  final: ExamTime | null;
  midtermText: string;
  finalText: string;
  course?: Course;
  section?: Section;
  color: number;
}

export const TERM_NAMES: Record<number, string> = { 1: "ภาคเรียนที่ 1", 2: "ภาคเรียนที่ 2", 3: "ภาคฤดูร้อน" };

// ------------------------------------------------------------------ formatting

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtRange(start: number, end: number): string {
  return `${fmtTime(start)}–${fmtTime(end)}`;
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/** "2027-03-08" → "จ. 8 มี.ค. 2570" */
export function fmtExamDate(iso: string, withWeekday = true): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${withWeekday ? TH_WEEKDAYS[wd] + " " : ""}${d} ${TH_MONTHS[m - 1]} ${y + 543}`;
}

export function fmtExam(e: ExamTime | null, fallback = "-"): string {
  if (!e) return fallback;
  return `${fmtExamDate(e.date)} ${fmtRange(e.start, e.end)}`;
}

// ------------------------------------------------------------------ search

/** Normalise for search: lower-case, drop spaces/dashes so "322102" matches "322-102". */
export function normalizeQuery(s: string): string {
  return s.toLowerCase().replace(/[\s\-–_.]/g, "");
}

export function courseHaystack(c: Course): string {
  const instructors = new Set<string>();
  c.sections.forEach((s) => s.instructors.forEach((i) => instructors.add(i)));
  return normalizeQuery(`${c.code} ${c.nameTh} ${c.nameEn} ${c.dept} ${[...instructors].join(" ")}`);
}

/** Rank: exact code > code prefix > name/instructor contains. Lower is better, -1 = no match. */
export function matchScore(c: Course, haystack: string, q: string): number {
  if (!q) return 0;
  const code = normalizeQuery(c.code);
  if (code === q) return 0;
  if (code.startsWith(q)) return 1;
  const idx = haystack.indexOf(q);
  if (idx < 0) return -1;
  return idx < code.length + 2 ? 2 : 3;
}

// ------------------------------------------------------------------ conflicts

export function slotsOverlap(a: Slot, b: Slot): boolean {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}

export function examsOverlap(a: ExamTime | null, b: ExamTime | null): boolean {
  return !!a && !!b && a.date === b.date && a.start < b.end && b.start < a.end;
}

export interface Conflict {
  type: "class" | "midterm" | "final";
  a: PlannedEntry;
  b: PlannedEntry;
  detail: string;
}

export function findConflicts(entries: PlannedEntry[]): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      for (const sa of a.slots) {
        const sb = b.slots.find((s) => slotsOverlap(sa, s));
        if (sb) {
          out.push({
            type: "class",
            a,
            b,
            detail: `${DAY_NAMES[sa.day]} ${fmtRange(Math.max(sa.start, sb.start), Math.min(sa.end, sb.end))}`,
          });
          break;
        }
      }
      if (examsOverlap(a.midterm, b.midterm)) {
        out.push({ type: "midterm", a, b, detail: fmtExam(a.midterm) });
      }
      if (examsOverlap(a.final, b.final)) {
        out.push({ type: "final", a, b, detail: fmtExam(a.final) });
      }
    }
  }
  return out;
}

/** Does this section clash (class time) with anything already planned, ignoring `ignoreKey`? */
export function sectionClashes(section: Section, entries: PlannedEntry[], ignoreCourseId?: string): PlannedEntry[] {
  return entries.filter(
    (e) =>
      e.course?.id !== ignoreCourseId &&
      e.slots.some((s) => section.slots.some((t) => slotsOverlap(s, t)))
  );
}

export function sectionExamClashes(section: Section, entries: PlannedEntry[], ignoreCourseId?: string): PlannedEntry[] {
  return entries.filter(
    (e) =>
      e.course?.id !== ignoreCourseId &&
      (examsOverlap(e.midterm, section.midtermAt) || examsOverlap(e.final, section.finalAt))
  );
}

// ------------------------------------------------------------------ plan resolution

export function resolvePlan(plan: PlanItem[], byId: Map<string, Course>): PlannedEntry[] {
  const out: PlannedEntry[] = [];
  for (const item of plan) {
    if (item.kind === "custom") {
      out.push({
        key: `custom:${item.id}`,
        item,
        code: item.code || "กิจกรรม",
        name: item.name,
        nameEn: "",
        sec: "-",
        credits: item.credits,
        slots: item.slots.map((s) => ({ ...s, room: s.room || item.room })),
        instructors: [],
        room: item.room,
        midterm: null,
        final: null,
        midtermText: "-",
        finalText: "-",
        color: item.color,
      });
      continue;
    }
    const course = byId.get(item.courseId);
    if (!course) continue;
    const section = course.sections.find((s) => s.sec === item.sec) ?? course.sections[0];
    if (!section) continue;
    out.push({
      key: `course:${course.id}`,
      item,
      code: course.code,
      name: course.nameTh || course.nameEn,
      nameEn: course.nameEn,
      sec: section.sec,
      credits: course.creditNum,
      slots: section.slots,
      instructors: section.instructors,
      room: section.room,
      midterm: section.midtermAt,
      final: section.finalAt,
      midtermText: section.midterm,
      finalText: section.final,
      course,
      section,
      color: item.color,
    });
  }
  return out;
}

// ------------------------------------------------------------------ share link
// compact: "<courseId>.<sec>~<courseId>.<sec>"  (custom items are not shared)

export function encodePlan(plan: PlanItem[]): string {
  return plan
    .filter((p): p is Extract<PlanItem, { kind: "course" }> => p.kind === "course")
    .map((p) => `${p.courseId}.${p.sec}`)
    .join("~");
}

export function decodePlan(s: string): { courseId: string; sec: string }[] {
  return s
    .split("~")
    .map((part) => {
      const dot = part.lastIndexOf(".");
      return dot > 0 ? { courseId: part.slice(0, dot), sec: part.slice(dot + 1) } : null;
    })
    .filter((x): x is { courseId: string; sec: string } => !!x);
}

// ------------------------------------------------------------------ calendar export (exams)

function icsDate(date: string, min: number): string {
  return `${date.replace(/-/g, "")}T${String(Math.floor(min / 60)).padStart(2, "0")}${String(min % 60).padStart(2, "0")}00`;
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Exams as an iCalendar file (times in Asia/Bangkok). */
export function examsToIcs(entries: PlannedEntry[], termLabel: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Allquiz//PSU Timetable//TH",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:ตารางสอบ ${termLabel}`,
    "X-WR-TIMEZONE:Asia/Bangkok",
  ];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  for (const e of entries) {
    for (const [kind, ex] of [
      ["สอบกลางภาค", e.midterm],
      ["สอบปลายภาค", e.final],
    ] as const) {
      if (!ex) continue;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${e.key}-${kind === "สอบกลางภาค" ? "mid" : "final"}-${termLabel.replace("/", "-")}@allquiz`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Bangkok:${icsDate(ex.date, ex.start)}`,
        `DTEND;TZID=Asia/Bangkok:${icsDate(ex.date, ex.end)}`,
        `SUMMARY:${icsEscape(`${kind} ${e.code} ${e.name}`)}`,
        `DESCRIPTION:${icsEscape(`Section ${e.sec}`)}`,
        "END:VEVENT"
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ------------------------------------------------------------------ layout

export interface Lane {
  lane: number;
  lanes: number;
}

/** จัดช่องเวลาที่ซ้อนทับกันให้อยู่คนละเลนในวันเดียวกัน (กลุ่มที่ซ้อนกันจะแบ่งความสูงเท่ากัน) */
export function layoutLanes(items: Slot[]): Lane[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].start - items[b].start || items[a].end - items[b].end);
  const result: Lane[] = items.map(() => ({ lane: 0, lanes: 1 }));
  let cluster: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((i) => result[i].lane + 1));
    cluster.forEach((i) => (result[i].lanes = lanes));
    cluster = [];
  };
  const laneEnds: number[] = [];
  for (const i of order) {
    const slot = items[i];
    if (cluster.length && slot.start >= clusterEnd) {
      flush();
      laneEnds.length = 0;
    }
    let lane = laneEnds.findIndex((end) => end <= slot.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = slot.end;
    result[i].lane = lane;
    cluster.push(i);
    clusterEnd = Math.max(clusterEnd, slot.end);
  }
  if (cluster.length) flush();
  return result;
}

// ------------------------------------------------------------------ colours
// Each pair: block background / border / text — chosen for AA contrast on white.

export const PALETTE = [
  { bg: "#e0f2fe", border: "#0284c7", text: "#075985" },
  { bg: "#dcfce7", border: "#16a34a", text: "#166534" },
  { bg: "#fef3c7", border: "#d97706", text: "#92400e" },
  { bg: "#fce7f3", border: "#db2777", text: "#9d174d" },
  { bg: "#ede9fe", border: "#7c3aed", text: "#5b21b6" },
  { bg: "#ffedd5", border: "#ea580c", text: "#9a3412" },
  { bg: "#ccfbf1", border: "#0d9488", text: "#115e59" },
  { bg: "#fee2e2", border: "#dc2626", text: "#991b1b" },
  { bg: "#e0e7ff", border: "#4f46e5", text: "#3730a3" },
  { bg: "#ecfccb", border: "#65a30d", text: "#3f6212" },
] as const;

export function nextColor(plan: PlanItem[]): number {
  const used = new Set(plan.map((p) => p.color));
  for (let i = 0; i < PALETTE.length; i++) if (!used.has(i)) return i;
  return plan.length % PALETTE.length;
}

export function shortCampus(c: string): string {
  return c.replace(/^วิทยาเขต/, "");
}

// ------------------------------------------------------------------ random timetable

export interface ScheduleOption {
  code: string;
  course: Course;
  section: Section;
}

export interface ScheduleGroup {
  code: string;
  options: ScheduleOption[];
}

const MAX_SCHEDULE_STEPS = 20000;

function sectionsOverlap(a: Section, b: Section): boolean {
  return (
    a.slots.some((slot) => b.slots.some((other) => slotsOverlap(slot, other))) ||
    examsOverlap(a.midtermAt, b.midtermAt) ||
    examsOverlap(a.finalAt, b.finalAt)
  );
}

/** สุ่มเลือก 1 Sec ต่อวิชา โดยไม่ให้เวลาเรียนหรือวันสอบชนกันเอง และไม่ชนกับกิจกรรมที่ตั้งไว้ (fixed) */
export function randomSchedule(
  groups: ScheduleGroup[],
  fixed: PlannedEntry[],
  random: () => number = Math.random
): { picks: { course: Course; sec: string }[]; missing: string[] } {
  const pool = groups
    .map((group) => ({
      code: group.code,
      options: group.options.filter(
        (option) =>
          sectionClashes(option.section, fixed, "").length === 0 &&
          sectionExamClashes(option.section, fixed, "").length === 0
      ),
    }))
    .filter((group) => group.options.length > 0)
    .sort((a, b) => a.options.length - b.options.length);

  const shuffle = (options: ScheduleOption[]) => {
    const copy = [...options];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const chosen: ScheduleOption[] = [];
  let best: ScheduleOption[] = [];
  let steps = 0;
  const search = (index: number): boolean => {
    if (chosen.length > best.length) best = [...chosen];
    if (index === pool.length) return chosen.length === pool.length;
    if (steps++ > MAX_SCHEDULE_STEPS) return false;
    for (const option of shuffle(pool[index].options)) {
      if (chosen.some((other) => sectionsOverlap(other.section, option.section))) continue;
      chosen.push(option);
      if (search(index + 1)) return true;
      chosen.pop();
    }
    return search(index + 1);
  };
  search(0);

  const pickedCodes = new Set(best.map((option) => option.code));
  return {
    picks: best.map((option) => ({ course: option.course, sec: option.section.sec })),
    missing: groups.map((group) => group.code).filter((code) => !pickedCodes.has(code)),
  };
}
