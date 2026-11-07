#!/usr/bin/env node
/*
 * นำเข้าโครงสร้างหลักสูตร (แผนการศึกษาตามชั้นปี/ภาคการศึกษา) ของแต่ละคณะ ลงระบบจัดตารางเรียน
 *
 *   node scripts/timetable/import-curriculum.mjs
 *
 * ดาวน์โหลด PDF แผนการศึกษาจากเว็บคณะ (ทั้งฉบับปี 2569 และ 2564 ถ้ามี) แล้วแปลงเป็นข้อความด้วย pdftotext (ต้องมีในเครื่อง)
 *
 * ผลลัพธ์
 *   public/timetable/curricula/<คณะ>.json   หลักสูตรทั้งหมดของคณะ แยกเป็นฉบับปี แล้วจัดกลุ่มตามชั้นปีและภาคการศึกษา
 *   public/timetable/curricula/index.json   รายชื่อคณะที่มีแผนการศึกษา
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CURRICULA_DIR = path.join(ROOT, "public", "timetable", "curricula");

const SCI_BASE = "https://www.sci.psu.ac.th/wp-content/uploads";
const AGRO_BASE = "https://agro.psu.ac.th/agro6/wp-content/uploads";

const SCI_PROGRAMS = [
  {
    id: "biology", name: "ชีววิทยา", division: "วิทยาศาสตร์ชีวภาพ",
    editions: [
      { curriculumYear: 2569, pdf: "2026/06/2569-วท.บ.ชีววิทยา.pdf" },
      { curriculumYear: 2564, pdf: "2021/09/Biology2564.pdf" },
    ],
  },
  {
    id: "biotechnology", name: "เทคโนโลยีชีวภาพ", division: "วิทยาศาสตร์ชีวภาพ",
    editions: [
      { curriculumYear: 2569, pdf: "2026/06/2569-วท.บ.เทคโนโลยีชีวภาพ.pdf" },
      { curriculumYear: 2564, pdf: "2021/09/Biotechnology2564.pdf" },
    ],
  },
  {
    id: "microbiology", name: "จุลชีววิทยา", division: "วิทยาศาสตร์ชีวภาพ",
    editions: [
      { curriculumYear: 2569, pdf: "2026/06/2569-วท.บ.จุลชีววิทยา.pdf" },
      { curriculumYear: 2564, pdf: "2021/09/Microbiology2564.pdf" },
    ],
  },
  {
    id: "chemistry", name: "เคมี", division: "วิทยาศาสตร์กายภาพ",
    editions: [
      { curriculumYear: 2569, pdf: "2026/06/2569-วท.บ.เคมี.pdf" },
      { curriculumYear: 2564, pdf: "2021/09/Chemistry2564.pdf" },
    ],
  },
  {
    id: "chemistry-biology", name: "เคมี-ชีววิทยาประยุกต์", division: "วิทยาศาสตร์สุขภาพและวิทยาศาสตร์ประยุกต์",
    editions: [
      { curriculumYear: 2569, pdf: "2026/06/2569-วท.บ.เคมี-ชีววิทยาประยุกต์.pdf" },
      { curriculumYear: 2564, pdf: "2021/09/AppliedChemistryBiology2564.pdf" },
    ],
  },
  {
    id: "physics", name: "ฟิสิกส์", division: "วิทยาศาสตร์กายภาพ",
    editions: [
      { curriculumYear: 2569, pdf: "2026/06/2569-วท.บ.ฟิสิกส์.pdf" },
      { curriculumYear: 2564, pdf: "2021/09/Physics2564-compressed.pdf" },
    ],
  },
  {
    id: "materials-science", name: "วัสดุศาสตร์", division: "วิทยาศาสตร์กายภาพ",
    editions: [
      { curriculumYear: 2569, pdf: "2026/06/2569-วท.บ.วัสดุศาสตร์.pdf" },
      { curriculumYear: 2564, pdf: "2021/09/MaterialsScience2564.pdf" },
    ],
  },
  {
    id: "polymer-science", name: "วิทยาศาสตร์พอลิเมอร์", division: "วิทยาศาสตร์กายภาพ",
    editions: [
      { curriculumYear: 2569, pdf: "2026/06/2569-วท.บ.วิทยาศาสตร์พอลิเมอร์.pdf" },
      { curriculumYear: 2564, pdf: "2021/09/PolymerScience2564.pdf" },
    ],
  },
  {
    id: "mathematics", name: "คณิตศาสตร์", division: "วิทยาศาสตร์การคำนวณ",
    editions: [
      { curriculumYear: 2569, pdf: "2026/06/2569-วท.บ.คณิตศาสตร์.pdf" },
      { curriculumYear: 2564, pdf: "2021/09/Mathematics2564.pdf" },
    ],
  },
  {
    id: "statistics", name: "สถิติประยุกต์และวิทยาการข้อมูล", division: "วิทยาศาสตร์การคำนวณ",
    editions: [
      { curriculumYear: 2569, pdf: "2026/06/2569-วท.บ.สถิติประยุกต์และวิทยาการข้อมูล.pdf" },
      { curriculumYear: 2564, pdf: "2021/09/Statistics2564.pdf" },
    ],
  },
  {
    id: "computer-science", name: "วิทยาการคอมพิวเตอร์", division: "วิทยาศาสตร์การคำนวณ",
    editions: [
      { curriculumYear: 2569, pdf: "2026/06/2569-วท.บ.วิทยาการคอมพิวเตอร์.pdf" },
      { curriculumYear: 2564, pdf: "2023/10/ComputerScience25641.pdf" },
    ],
  },
  {
    id: "information-and-communication-technology", name: "เทคโนโลยีสารสนเทศและการสื่อสาร", division: "วิทยาศาสตร์การคำนวณ",
    editions: [{ curriculumYear: 2564, pdf: "2021/09/ict2564-แผนการศึกษา.pdf" }],
  },
];

const AGRO_PROGRAMS = [
  {
    id: "food-science", name: "วิทยาศาสตร์และเทคโนโลยีอาหาร", division: "อุตสาหกรรมเกษตร",
    editions: [{ curriculumYear: 2565, pdf: "https://agro.psu.ac.th/agro6/wp-content/uploads/2026/07/plan-bachelor-foodsci-2565.pdf" }],
  },
  {
    id: "packaging", name: "เทคโนโลยีบรรจุภัณฑ์และวัสดุ", division: "อุตสาหกรรมเกษตร",
    editions: [{ curriculumYear: 2567, pdf: "https://agro.psu.ac.th/agro6/wp-content/uploads/2026/08/plan-bachelor-packaging-2567.pdf" }],
  },
];

const FACULTIES = [
  { id: "sci", name: "คณะวิทยาศาสตร์", campus: "วิทยาเขตหาดใหญ่", base: SCI_BASE, source: "https://www.sci.psu.ac.th", programs: SCI_PROGRAMS },
  { id: "agro", name: "คณะอุตสาหกรรมเกษตร", campus: "วิทยาเขตหาดใหญ่", base: AGRO_BASE, source: "https://agro.psu.ac.th/agro6/curriculum", programs: AGRO_PROGRAMS },
];

const CODE = String.raw`(?:\d{3}|xxx)-(?:\d{3}[A-Za-z0-9]*|x{3}|\d{2}[A-Za-z0-9]*)`;
// credits are recognised by their "N((…)" shape, so a grade or hours column ("50", "70") is never taken as credits
const ITEM_RE = new RegExp(`(${CODE})\\s+(.+?)\\s+(\\d{1,2})\\s*\\((?:\\(|\\d|x)`, "g");
const YEAR_RE = /^(?:ชั้น)?ป[\s\uE000-\uF8FF]*ี?[\s\uE000-\uF8FF]*ที่\s*(\d)(?:\s*\(?\s*([^\d\s()][^()]*?)\s*\)?)?$/;
const TERM_HIT_RE = /ภาค\s*การศึกษาที่\s*(\d)|ภาคฤดูร้อน/g;
const PLAN_HINT_RE = /\(\s*((?:แผน|การศึกษา)[^()\d]*)\)/;
const PLAN_ONLY_RE = /^(แผน\S+)$/;
const PLAN_HEADER_RE = /^แผนการศึกษา\s*(?:สำหรับหลักสูตร\s*(.*)|ตลอดหลักสูตร)?\s*$/;
const PLAN_END_RE = /^หมวดที่\s*4\s/;
const COURSE_DESC_RE = /^\d+(?:\.\d+)*\s+\S*อธิบายรายวิชา\s*$/;

/** "/** "แผนโครงงาน" / "สำหรับหลักสูตรปกติ" / "(แผนสหกิจศึกษา)" → "โครงงาน" / "ปกติ" / "สหกิจศึกษา" */
function planLabel(raw) {
  if (!raw) return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (/ทุกแผน/.test(text)) return null;
  const label = text.replace(/^แผน/, "").replace(/^การศึกษาแบบ|^การศึกษา/, "").replace(/^แผน/, "").trim();
  return /^[ก-๙ ]{2,30}$/.test(label) && !/^(สำหรับ|ตลอด|หน่วยกิต)/.test(label) ? label : null;
}
function termNo(hit) {
  return /ฤดูร้อน/.test(hit[0]) ? 3 : Number(hit[1]);
}

// pdftotext emits Thai above/below marks one glyph too late and follows them with a space:
// "เบือ้ งต้น" → "เบื้องต้น", "ขอ้ มูล" → "ข้อมูล", "ถนิ่ " → "ถิ่น". Move the marks back onto the
// preceding consonant and drop the stray space. ์ (thanthakhat) is excluded: "ศาสตร์ มหา" is correct.
// Conservative on purpose — some PDFs instead insert a space *without* moving the mark
// ("การสื่ อสาร"), and a vowel-final word before a real space ("ภาพดี ชีวี") looks identical, so we
// only move marks that contain a tone mark / ั / ็ (these can never end a correct syllable this way),
// and only when Y already carries a vowel, or the moved run is a single mark or ั+tone.
// ห/อ without marks are excluded as Y because they lead clusters legitimately ("ใหม่ ").
const THAI_MARKS = "ัิ-ฺ็-๋ํ๎";
const PDF_MARK_RE = new RegExp(
  `((?:[ก-สฬฮ]|[หอ](?=[${THAI_MARKS}]))([${THAI_MARKS}]*))([ก-ฮเ-ไ])([${THAI_MARKS}]+) (?=[ก-ฮเ-ไ])`,
  "g"
);
export function fixThaiPdfText(s) {
  return s.replace(PDF_MARK_RE, (all, y, yMarks, x, m) => {
    if (!/[่-๋ั็]/.test(m)) return all;
    if (!(yMarks || m.length === 1 || /^ั[่-๋]$/.test(m))) return all;
    return y + m + x;
  });
}

// --cache <dir>: re-use the pdftotext output of an earlier run (<faculty>-<program>-<edition>.txt)
// instead of downloading the PDFs again — handy when the faculty site is slow or blocks scripts.
const CACHE_ARG = process.argv.indexOf("--cache");
const CACHE_DIR = CACHE_ARG > 0 ? process.argv[CACHE_ARG + 1] : null;

function fetchPdfText(base, pdfPath, workDir, name) {
  if (CACHE_DIR) {
    const cached = path.join(CACHE_DIR, `${name}.txt`);
    if (!fs.existsSync(cached)) return Promise.reject(new Error(`ไม่พบไฟล์แคช ${cached}`));
    return Promise.resolve(fs.readFileSync(cached, "utf8").split(/\r?\n/).map(fixThaiPdfText));
  }
  const pdfFile = path.join(workDir, `${name}.pdf`);
  const txtFile = path.join(workDir, `${name}.txt`);
  const url = /^https?:/.test(pdfPath) ? pdfPath : `${base}/${pdfPath}`;
  return fetch(encodeURI(url))
    .then(async (res) => {
      if (!res.ok) throw new Error(`ดาวน์โหลดไม่สำเร็จ ${res.status}: ${pdfPath}`);
      fs.writeFileSync(pdfFile, Buffer.from(await res.arrayBuffer()));
      execFileSync("pdftotext", ["-layout", pdfFile, txtFile]);
      return fs.readFileSync(txtFile, "utf8").split(/\r?\n/).map(fixThaiPdfText);
    });
}

/** Locate the study-plan section: from the first "ชั้นปีที่ 1" heading to the start of หมวดที่ 4. */
function planRange(lines) {
  const start = lines.findIndex((l) => YEAR_RE.test(l.trim()) && YEAR_RE.exec(l.trim())[1] === "1");
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && (COURSE_DESC_RE.test(l.trim()) || PLAN_END_RE.test(l.trim())));
  if (end < 0) end = lines.length;
  return [start, end];
}

export function parsePlan(lines) {
  const range = planRange(lines);
  if (!range) return { years: [], warning: "ไม่พบส่วนแผนการศึกษา" };
  const [start, end] = range;

  const blocks = new Map();
  const blockFor = (year, plan) => {
    const key = `${year}|${plan ?? ""}`;
    if (!blocks.has(key)) blocks.set(key, { year, plan, terms: new Map() });
    return blocks.get(key);
  };

  let year = null;
  let plan = null;
  let block = null;
  let twoColumn = null;
  let term = null;

  for (let i = start; i < end; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    const ym = trimmed.match(YEAR_RE);
    if (ym) {
      year = Number(ym[1]);
      plan = planLabel(ym[2]);
      block = blockFor(year, plan);
      term = null;
      twoColumn = null;
      continue;
    }

        const planOnly = trimmed.match(PLAN_ONLY_RE);
    if (planOnly && year != null) {
      plan = planLabel(planOnly[1]);
      block = blockFor(year, plan);
      term = null;
      twoColumn = null;
      continue;
    }

    if (/^รวม\s/.test(trimmed) || /^รวม$/.test(trimmed)) {
      term = null;
      twoColumn = null;
      continue;
    }

    const header = trimmed.match(PLAN_HEADER_RE);
    if (header) {
      plan = planLabel(header[1]);
      year = null;
      block = null;
      term = null;
      twoColumn = null;
      continue;
    }

    const hits = [...line.matchAll(TERM_HIT_RE)];
    if (hits.length && year != null) {
      const hint = line.match(PLAN_HINT_RE);
      if (hint) {
        plan = planLabel(hint[1]);
        block = blockFor(year, plan);
      }
      if (hits.length >= 2) {
        twoColumn = { split: hits[1].index - 25, left: termNo(hits[0]), right: termNo(hits[1]) };
        term = null;
      } else {
        twoColumn = null;
        term = termNo(hits[0]);
      }
      continue;
    }
if (!block || (term == null && !twoColumn)) continue;

    for (const m of line.matchAll(ITEM_RE)) {
      const code = m[1];
      const name = m[2].replace(/\s+/g, " ").trim();
      const credits = Number(m[3]);
      const placeholder = code.includes("x");
      let target = term;
      if (twoColumn) target = m.index >= twoColumn.split ? twoColumn.right : twoColumn.left;
      if (target == null) continue;
      if (!block.terms.has(target)) block.terms.set(target, []);
      const list = block.terms.get(target);
      if (list.some((c) => c.code === code && c.name === name)) continue;
      list.push({ code, name, credits, ...(placeholder ? { placeholder: true } : {}) });
    }
  }

  const years = [...blocks.values()]
    .filter((b) => b.terms.size > 0)
    .sort((a, b) => a.year - b.year || (a.plan ?? "").localeCompare(b.plan ?? "", "th"))
    .map((b) => ({
      year: b.year,
      ...(b.plan ? { plan: b.plan } : {}),
      terms: [...b.terms.entries()]
        .sort((a, c) => a[0] - c[0])
        .map(([t, courses]) => ({
          term: t,
          credits: courses.reduce((n, c) => n + c.credits, 0),
          courses,
        })),
    }));
  return { years };
}

// ------------------------------------------------------------------ elective groups (หมวดวิชาเฉพาะ กลุ่มวิชาเลือก)
//
// The course-structure section lists every elective, grouped by area — "ด้านที่ 1 : การพัฒนาซอฟต์แวร์",
// "กลุ่มวิชาเลือกด้านพฤกษศาสตร์", "๒. กลุ่มวิชาธรณีฟิสิกส์", "รายวิชาที่เปิดสอนโดยหลักสูตรเคมี" …
// The study plan only says "344-xxx วิชาเฉพาะ - กลุ่มวิชาเลือก", so the app needs these lists to
// recommend real courses per area.

const REAL_CODE = String.raw`\d{3}-\d{3}[A-Za-z0-9]*`;
// credits are recognised by their "3((3)-0-6)" / "1(0-2-1)" shape, so long names with a single space still match
const COURSE_LINE_RE = new RegExp(`^\\s*(${REAL_CODE})\\s+(.+?)\\s+(\\d{1,2})\\s*\\((?:\\(|\\d|x)`);
/**
 * Section headings: "2.2) วิชาเลือก", "3) กลุ่มวิชาเลือก", "3) หมวดวิชาเฉพาะ – กลุ่มวิชาเลือก",
 * "2.4 กลุ่มวิชาชีพเลือก", "3) กลุ่มวิชาเฉพาะด้าน" (choose-a-track), and the bare "- เลือก".
 */
const ELECTIVE_HEAD_RE = /^(\d+(?:\.\d+)*)(?:\)|\.(?!\d)|\s)\s*(?:หมวดวิชาเฉพาะ\s*[–-]\s*)?(?:กลุ่ม)?(?:ราย)?วิชา(?:ชีพ)?(?:เลือก|เฉพาะด้าน)/;
const DASH_HEAD_RE = /^-\s*เลือก(?:\s|$)/;
const NUMBERED_RE = /^(\d+(?:\.\d+)*)(?:\)|\.(?!\d))\s*[ก-๙]/;
const SECTION_END_RE = /หมวดวิชาเลือกเสรี|^[คง]\.\s*หมวด|^หมวดที่\s*\d|^\d+\.\d+\.\d+\s|^ชั้นปีที่\s*1\b/;
const AREA_RE =
  /^(?:[•▪]\s*)?(?:ด้านที่\s*\d+|ด้าน(?!ล่าง)\S|[๐-๙\d]+\.\s*กลุ่ม|กลุ่มวิชาเลือก(?:ด้าน|ทาง|ที่เปิดสอน)|กลุ่มวิชา(?!ที่)\S|กลุ่มชุดวิชา|ชุดวิชา\S*เลือก|หมวดวิชา\s+\S|(?:ราย)?วิชา(?:เลือก)?ที่เปิดสอนโดย|รายวิชาเลือก(?:ทาง|อ|บูรณาการ|ที่เปิดสอน)|\d+\.\d+\)\s*(?:ราย)?วิชา)/;
const SUBGROUP_RE = /^กลุ่มวิชาที่\s*\d+\.\d+/;
const NOT_HEADING_RE = /เลือกเรียน|นักศึกษา|ต่อไปนี้$|ได้แก่|^และ|^หรือ/;
const CREDITS_RE = /(\d+)\s*หน่?วยกิต/;
const GENERIC_SECTION_RE = /^(?:กลุ่ม)?(?:ราย)?วิชา(?:ชีพ)?เลือก$|^เลือก$/;

function cleanHeading(t) {
  const s = t
    .replace(/อืน่/g, "อื่น") // pdftotext mark-order glitch the generic fix leaves alone
    .replace(/^[•▪-]\s*/, "")
    .replace(/^\d+(?:\.\d+)*(?:\)|\.(?!\d)|\s)\s*/, "")
    .replace(/^หมวดวิชาเฉพาะ\s*[–-]\s*/, "")
    .replace(/\(\s*รหัสกลุ่มวิชา[^)]*\)/, "")
    .replace(/\s*ประกอบด้วย.*$/, "")
    .replace(/\s*\(\s*(?:Module|[A-Za-z])[^)]*\)?\s*$/, "")
    .replace(/\s*(?:ไม่น้อยกว่า\s*)?\d+\s*หน่?วยกิต.*$/, "")
    .replace(/\s{2,}.*$/, "")
    .trim();
  const m = s.match(/^(ด้านที่\s*\d+|กลุ่มวิชาที่\s*[\d.]+|[๐-๙]+\.)\s*:?\s*(.*)$/);
  if (m && m[2]) return { label: m[1].replace(/\.$/, "").replace(/\s+/g, " "), name: m[2].trim() };
  return { label: undefined, name: s };
}

/** a long sentence line that does not end a clause — the next line continues it, so it is not a heading */
function isParagraph(t) {
  return t.length > 45 && !/(?:หน่?วยกิต|ต่อไปนี้|ดังนี้|:)\s*$/.test(t);
}

function findSections(lines, trimmed, stop) {
  const sections = [];
  for (let h = 0; h < stop; h++) {
    const t = trimmed[h];
    const head = t.match(ELECTIVE_HEAD_RE);
    const dash = !head && DASH_HEAD_RE.test(t);
    if ((!head && !dash) || /เสรี|ศึกษาทั่วไป/.test(t)) continue;
    const depth = head ? head[1].split(".").length : 99;
    // "3) …" ends at the next "4) …", not at an inner "1. …" instruction list (and vice versa)
    const paren = head ? t.slice(head[1].length).startsWith(")") : true;
    let end = h + 1;
    for (; end < Math.min(stop, h + 700); end++) {
      const x = trimmed[end];
      if (SECTION_END_RE.test(x)) break;
      const num = x.match(NUMBERED_RE);
      if (num && num[1].split(".").length <= depth && x.slice(num[1].length).startsWith(")") === paren) break;
    }
    const courseLines = lines.slice(h + 1, end).filter((l) => COURSE_LINE_RE.test(l)).length;
    if (courseLines < 3) continue;
    const name = cleanHeading(t).name;
    sections.push({
      h,
      end,
      // "วิชาเฉพาะด้าน" is compulsory in some books — keep it only when it really splits into areas
      track: /เฉพาะด้าน/.test(t) && !/เลือก/.test(t),
      credits: Number(t.match(CREDITS_RE)?.[1]) || undefined,
      defaultName: !name || GENERIC_SECTION_RE.test(name) ? "รายวิชาเลือกของหลักสูตร" : name,
    });
  }
  return sections;
}

/** Collect every elective course list in the course-structure part of a curriculum (before the study plan). */
export function parseElectives(lines) {
  const range = planRange(lines);
  const stop = range ? range[0] : lines.length;
  const trimmed = lines.map((l) => l.trim());
  const sections = findSections(lines, trimmed, stop);
  if (!sections.length) return null;

  const areas = [];
  const byKey = new Map();
  let note = "";
  let credits;
  for (const sec of sections) {
    const local = [];
    let area = null;
    let group;
    let prevText = "";
    const pendingNote = [];
    const areaFor = (label, name) => {
      let a = local.find((x) => x.label === label && x.name === name);
      if (!a) {
        a = { ...(label ? { label } : {}), name, courses: [] };
        local.push(a);
      }
      return a;
    };
    for (let i = sec.h + 1; i < sec.end; i++) {
      const raw = lines[i];
      const t = trimmed[i];
      if (!t || /^\d+$/.test(t)) {
        prevText = "";
        continue;
      }
      const course = raw.match(COURSE_LINE_RE);
      if (course) {
        area ??= areaFor(undefined, sec.defaultName);
        const code = course[1];
        prevText = "";
        if (area.courses.some((c) => c.code === code)) continue;
        area.courses.push({
          code,
          name: course[2].replace(/\s+/g, " ").trim(),
          credits: Number(course[3]),
          ...(group ? { group } : {}),
        });
        continue;
      }
      if (/^[A-Za-z(*]/.test(t)) {
        prevText = "";
        continue; // English name lines / footnotes
      }
      if (SUBGROUP_RE.test(t) && area) {
        group = cleanHeading(t).name;
        prevText = "";
        continue;
      }
      const bullet = /^[•▪]/.test(t);
      if (
        AREA_RE.test(t) &&
        !NOT_HEADING_RE.test(t.replace(/\(.*$/, "")) &&
        t.length < 130 &&
        (bullet || !prevText || !isParagraph(prevText))
      ) {
        const { label, name } = cleanHeading(t);
        if (name.length >= 3) {
          area = areaFor(label, name);
          group = undefined;
          const min = t.match(/ไม่น้อยกว่า\s*(\d+)\s*หน่?วยกิต/);
          if (min) area.minCredits = Number(min[1]);
          prevText = "";
          continue;
        }
      }
      // instruction text: the section intro becomes the note; "เลือก … N หน่วยกิต" right under an area is its minimum
      if (area && !area.courses.length) {
        const min = t.match(/(?:ไม่น้อยกว่า|จำนวน|จานวน)\s*(\d+)\s*หน่?วยกิต/);
        if (min && !area.minCredits) area.minCredits = Number(min[1]);
      } else if (!area) {
        pendingNote.push(t);
      }
      prevText = t;
    }

    const filled = local.filter((a) => a.courses.length);
    if (sec.track && !filled.some((a) => a.name !== sec.defaultName)) continue;
    credits ??= sec.credits;
    if (!note && pendingNote.length) note = pendingNote.join(" ").replace(/\s+/g, " ").slice(0, 400);
    for (const a of filled) {
      const key = `${a.label ?? ""}|${a.name}`;
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, a);
        areas.push(a);
      } else {
        for (const c of a.courses) if (!prev.courses.some((x) => x.code === c.code)) prev.courses.push(c);
      }
    }
  }

  if (!areas.length) return null;
  return {
    ...(credits ? { credits } : {}),
    ...(note ? { note } : {}),
    areas,
  };
}

async function main() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "psu-curriculum-"));
  for (const faculty of FACULTIES) {
    const programs = [];
    for (const [index, p] of faculty.programs.entries()) {
      const editions = [];
      for (const [editionIndex, ed] of p.editions.entries()) {
        const lines = await fetchPdfText(faculty.base, ed.pdf, workDir, `${faculty.id}-${index}-${editionIndex}`);
        const plan = parsePlan(lines);
        const electives = parseElectives(lines);
        const courseCount = plan.years.reduce((n, y) => n + y.terms.reduce((m, t) => m + t.courses.length, 0), 0);
        const electiveCount = electives?.areas.reduce((n, a) => n + a.courses.length, 0) ?? 0;
        console.log(
          `✔ ${p.name} ${ed.curriculumYear}: ${plan.years.length} กลุ่มแผน, ${courseCount} รายการ` +
            `, วิชาเลือก ${electives?.areas.length ?? 0} กลุ่ม ${electiveCount} วิชา${plan.warning ? ` (${plan.warning})` : ""}`
        );
        const source = /^https?:/.test(ed.pdf) ? ed.pdf : `${faculty.base}/${ed.pdf}`;
        editions.push({ curriculumYear: ed.curriculumYear, source, years: plan.years, ...(electives ? { electives } : {}) });
      }
      programs.push({ id: p.id, name: p.name, division: p.division, editions });
    }

    const outFile = path.join(CURRICULA_DIR, `${faculty.id}.json`);
    fs.mkdirSync(CURRICULA_DIR, { recursive: true });
    fs.writeFileSync(
      outFile,
      JSON.stringify({ faculty: `${faculty.name} มหาวิทยาลัยสงขลานครินทร์`, programs }, null, 2)
    );
    console.log(`→ ${path.relative(ROOT, outFile)}`);
    writeCurriculaIndex({ id: faculty.id, faculty: faculty.name, campus: faculty.campus, programs: programs.length, source: faculty.source });
  }
}

/** public/timetable/curricula/index.json — list of faculties that have study plans (read by the app). */
function writeCurriculaIndex(entry) {
  const indexFile = path.join(CURRICULA_DIR, "index.json");
  let index = { faculties: [] };
  try {
    index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
  } catch {
    /* first run */
  }
  const row = {
    id: entry.id,
    faculty: entry.faculty,
    campus: entry.campus,
    file: `/timetable/curricula/${entry.id}.json`,
    programs: entry.programs,
    source: entry.source,
    updatedAt: new Date().toISOString(),
  };
  index.faculties = [...(index.faculties ?? []).filter((f) => f.id !== row.id), row];
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
  console.log(`→ ${path.relative(ROOT, indexFile)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();







