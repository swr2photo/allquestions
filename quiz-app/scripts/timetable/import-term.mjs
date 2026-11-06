#!/usr/bin/env node
/*
 * นำเข้าข้อมูลรายวิชา/ตารางเรียน 1 ภาคการศึกษา เข้าสู่ระบบจัดตารางเรียน (/timetable)
 *
 *   node scripts/timetable/import-term.mjs <input> [--year 2569 --term 2]
 *
 * <input> รับได้ 2 แบบ
 *   - ไฟล์ .json จาก scripts/timetable/sis-scraper.browser.js  ({ year, term, subjects: [...] })
 *   - ไฟล์ subjects_data.js แบบเดิม  (window.PSU_SUBJECTS_DATA = [...])
 *
 * ผลลัพธ์
 *   public/timetable/terms/<year>-<term>.json   ข้อมูลภาคนั้น (รูปแบบมาตรฐาน ดู src/lib/timetable.ts)
 *   public/timetable/index.json                 รายชื่อภาคการศึกษาที่มีในระบบ
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, "public", "timetable");

// ---------------------------------------------------------------- parsing helpers
const DAY_PATTERNS = [
  [0, /^(จันทร์|จ\.|Mon(day)?)$/i],
  [1, /^(อังคาร|อ\.|Tue(s(day)?)?)$/i],
  [2, /^(พุธ|พ\.|Wed(nesday)?)$/i],
  [3, /^(พฤหัสบดี|พฤหัส|พฤ\.|Thu(rs(day)?)?)$/i],
  [4, /^(ศุกร์|ศ\.|Fri(day)?)$/i],
  [5, /^(เสาร์|ส\.|Sat(urday)?)$/i],
  [6, /^(อาทิตย์|อา\.|Sun(day)?)$/i],
];
const DAY_TOKEN =
  "จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์|Monday|Mon|Tuesday|Tues|Tue|Wednesday|Wed|Thursday|Thurs|Thu|Friday|Fri|Saturday|Sat|Sunday|Sun";
const SLOT_RE = new RegExp(
  `(${DAY_TOKEN})\\.?\\s*(\\d{1,2})[:.](\\d{2})\\s*[–—-]\\s*(\\d{1,2})[:.](\\d{2})`,
  "gi"
);

function dayIndex(token) {
  for (const [i, re] of DAY_PATTERNS) if (re.test(token)) return i;
  return -1;
}

/** "จันทร์ 08:00–09:50, พุธ 10:00–11:50" → [{day,start,end}] (minutes from 00:00) */
export function parseSlots(dayTime) {
  const slots = [];
  if (!dayTime) return slots;
  for (const m of dayTime.matchAll(SLOT_RE)) {
    const day = dayIndex(m[1]);
    const start = Number(m[2]) * 60 + Number(m[3]);
    const end = Number(m[4]) * 60 + Number(m[5]);
    if (day < 0 || end <= start) continue;
    slots.push({ day, start, end });
  }
  return slots;
}

const MONTHS = {
  "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
  "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};
const EXAM_RE = /(\d{1,2})\s+([^\s\d]+)\s+(\d{4})\s+(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})/;

/** "08 มี.ค. 2570 09:00–11:00" | "9 JAN 2027 09:00–12:00" → { date:"2027-03-08", start, end } */
export function parseExam(text) {
  if (!text || text.trim() === "-") return null;
  const m = text.match(EXAM_RE);
  if (!m) return null;
  const month = MONTHS[m[2].toUpperCase()] ?? MONTHS[m[2]];
  if (!month) return null;
  let year = Number(m[3]);
  if (year > 2400) year -= 543; // พ.ศ. → ค.ศ.
  const date = `${year}-${String(month).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
  return {
    date,
    start: Number(m[4]) * 60 + Number(m[5]),
    end: Number(m[6]) * 60 + Number(m[7]),
  };
}

const clean = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");
const seatsNum = (s) => {
  const m = String(s || "").match(/\d[\d,]*/);
  return m ? Number(m[0].replace(/,/g, "")) : null;
};
const EN_CAMPUS = [
  [/Hat\s*Yai/i, "วิทยาเขตหาดใหญ่"],
  [/Pattani/i, "วิทยาเขตปัตตานี"],
  [/Phuket/i, "วิทยาเขตภูเก็ต"],
  [/Surat/i, "วิทยาเขตสุราษฎร์ธานี"],
  [/Trang/i, "วิทยาเขตตรัง"],
];
function normCampus(c) {
  const v = clean(c);
  for (const [re, th] of EN_CAMPUS) if (re.test(v)) return th;
  return v;
}

function normSection(raw) {
  // Prefer the scraper's per-row schedule (keeps room/lecturer per row); fall back to legacy fields.
  const rows =
    Array.isArray(raw.schedule) && raw.schedule.length
      ? raw.schedule
      : [{ dayTime: raw.dayTime, room: raw.room, lecturers: raw.instructors }];

  // SIS repeats the same day/time once per lecturer row → merge identical slots.
  const slotMap = new Map();
  for (const row of rows) {
    const rowSlots = parseSlots(row.dayTime);
    // rooms are listed positionally ("L2, -" = first slot L2, second slot no room)
    const rawRooms = clean(row.room).split(/\s*,\s*/);
    const realRooms = rawRooms.filter((r) => r && r !== "-");
    rowSlots.forEach((s, i) => {
      const key = `${s.day}-${s.start}-${s.end}`;
      const positional = rawRooms.length === rowSlots.length ? rawRooms[i] : realRooms.join(", ");
      const room = positional && positional !== "-" ? positional : "";
      const prev = slotMap.get(key);
      if (!prev) slotMap.set(key, room ? { ...s, room } : { ...s });
      else if (room && prev.room && !prev.room.split(", ").includes(room)) prev.room += `, ${room}`;
      else if (room && !prev.room) prev.room = room;
    });
  }
  const slots = [...slotMap.values()];

  const dayTime = [...new Set(rows.flatMap((r) => clean(r.dayTime).split(/\s*,\s*/)).filter(Boolean))].join(", ");
  const instructors = [
    ...new Set(
      (raw.instructors && raw.instructors.length ? raw.instructors : rows.flatMap((r) => r.lecturers || []))
        .map(clean)
        .filter((n) => n && n !== "-")
    ),
  ];

  return {
    sec: clean(raw.sec),
    seats: seatsNum(raw.seats),
    group: clean(raw.group),
    badges: (raw.badges || []).map(clean).filter(Boolean),
    room: clean(raw.room) || "-",
    instructors,
    dayTime: slots.length ? dayTime : dayTime || "ยังไม่มีตารางเรียน",
    slots,
    midterm: clean(raw.midterm) || "-",
    final: clean(raw.final) || "-",
    midtermAt: parseExam(raw.midterm),
    finalAt: parseExam(raw.final),
  };
}

function normCourse(raw) {
  const course = {
    id: String(raw.id),
    code: clean(raw.code),
    nameTh: clean(raw.nameTh),
    nameEn: clean(raw.nameEn),
    credits: clean(raw.credits).replace(/\s*หน่วยกิต$/, ""),
    creditNum: Number(raw.creditNum) || Number((String(raw.credits).match(/\d+/) || [0])[0]),
    faculty: clean(raw.faculty),
    dept: clean(raw.dept) === "-" ? "" : clean(raw.dept),
    campus: normCampus(raw.campus),
    desc: clean(raw.desc),
    url: raw.url ? String(raw.url).replace(/&(keyword|page)=[^&]*/g, "") : "",
    sections: (raw.sections || []).map(normSection),
  };
  const conditions = (raw.conditions || []).filter((c) => c && (c.title || c.body));
  if (conditions.length) course.conditions = conditions.map((c) => ({ title: clean(c.title), body: clean(c.body) }));
  return course;
}

// ---------------------------------------------------------------- input loading
function loadInput(file) {
  const src = fs.readFileSync(file, "utf8");
  if (/\.json$/i.test(file) || src.trimStart().startsWith("{") || src.trimStart().startsWith("[")) {
    const data = JSON.parse(src);
    if (Array.isArray(data)) return { subjects: data };
    return { subjects: data.subjects || data.courses || [], year: data.year, term: data.term, scrapedAt: data.scrapedAt, complete: data.complete };
  }
  // legacy browser bundle: window.PSU_SUBJECTS_DATA = [...]
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { timeout: 30000 });
  const subjects = sandbox.window.PSU_SUBJECTS_DATA || sandbox.PSU_SUBJECTS_DATA;
  if (!Array.isArray(subjects)) throw new Error("ไม่พบ window.PSU_SUBJECTS_DATA ในไฟล์");
  return { subjects };
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

// ---------------------------------------------------------------- main
function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args._[0];
  if (!input) {
    console.error("usage: node scripts/timetable/import-term.mjs <subjects_data.js | sis_subjects_YYYY-T.json> [--year 2569 --term 2]");
    process.exit(1);
  }
  const data = loadInput(path.resolve(input));
  let { year, term } = data;
  if (args.year) year = Number(args.year);
  if (args.term) term = Number(args.term);
  if (!year || !term) {
    const sem = data.subjects.find((s) => s.semester)?.semester || "";
    const m = sem.match(/(\d)\s*\/\s*(\d{4})/);
    if (m) {
      term = term || Number(m[1]);
      year = year || Number(m[2]);
    }
  }
  if (year && year < 2400) year += 543; // allow ค.ศ.
  if (!year || ![1, 2, 3].includes(Number(term))) {
    console.error("ระบุปี/ภาคไม่ได้ — ใส่ --year <พ.ศ.> --term <1|2|3>");
    process.exit(1);
  }

  // de-duplicate by SIS id (scraper may meet the same subject from two listings)
  const byId = new Map();
  for (const s of data.subjects) {
    if (!s || !s.code) continue;
    byId.set(String(s.id || `${s.code}-${s.campus}`), s);
  }
  const courses = [...byId.values()]
    .map(normCourse)
    .sort((a, b) => a.code.localeCompare(b.code) || a.campus.localeCompare(b.campus, "th"));

  const id = `${year}-${term}`;
  const fetchedAt = data.scrapedAt || fs.statSync(input).mtime.toISOString();
  const termFile = {
    id,
    year,
    term,
    label: `${term}/${year}`,
    source: "sis.psu.ac.th",
    fetchedAt,
    courses,
  };

  // stats + sanity report
  let sections = 0;
  let noSlots = 0;
  let unparsedSlots = 0;
  let exams = 0;
  const campuses = {};
  const faculties = new Set();
  for (const c of courses) {
    campuses[c.campus] = (campuses[c.campus] || 0) + 1;
    if (c.faculty) faculties.add(c.faculty);
    for (const s of c.sections) {
      sections++;
      if (!s.slots.length) {
        noSlots++;
        if (/\d{1,2}[:.]\d{2}/.test(s.dayTime)) unparsedSlots++;
      }
      if (s.midtermAt || s.finalAt) exams++;
    }
  }

  fs.mkdirSync(path.join(OUT_DIR, "terms"), { recursive: true });
  const termPath = path.join(OUT_DIR, "terms", `${id}.json`);
  fs.writeFileSync(termPath, JSON.stringify(termFile));

  const indexPath = path.join(OUT_DIR, "index.json");
  const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : { terms: [] };
  const entry = {
    id,
    year,
    term,
    label: termFile.label,
    file: `/timetable/terms/${id}.json`,
    courses: courses.length,
    sections,
    campuses,
    faculties: faculties.size,
    fetchedAt,
    complete: data.complete !== false,
    source: termFile.source,
  };
  index.terms = [...index.terms.filter((t) => t.id !== id), entry].sort(
    (a, b) => b.year - a.year || b.term - a.term
  );
  index.updatedAt = new Date().toISOString();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  const kb = (fs.statSync(termPath).size / 1024).toFixed(0);
  console.log(`✔ ${termFile.label}: ${courses.length} วิชา, ${sections} sections → ${path.relative(ROOT, termPath)} (${kb} KB)`);
  console.log(`  ไม่มีเวลาเรียน ${noSlots} sections (อ่านเวลาไม่ได้ ${unparsedSlots}), มีวันสอบ ${exams} sections`);
  console.log(`  วิทยาเขต:`, campuses);
  if (data.complete === false) console.warn("  ⚠ ไฟล์นี้เป็นผลดึงข้อมูลที่ยังไม่ครบ (scraper ถูกหยุดกลางทาง)");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
