#!/usr/bin/env node
/*
 * นำเข้าแผนการศึกษา (study plans: courses per year / term) ของแต่ละคณะ ลงระบบจัดตารางเรียน
 *
 *   node scripts/timetable/import-curriculum.mjs                 # every faculty in curriculum-sources.mjs
 *   node scripts/timetable/import-curriculum.mjs eng agro        # only these faculty ids
 *   node scripts/timetable/import-curriculum.mjs --dump eng/ee   # print the normalised text of one program
 *   options: --cache <dir>  keep downloads here (default: <tmp>/psu-curriculum-cache)
 *            --refresh      ignore the cache and download again
 *
 * Sources (see curriculum-sources.mjs): public PDFs, public Google Drive PDFs and public Google
 * Sheets that the faculties link from their own websites. PDFs go through `pdftotext -enc UTF-8
 * -layout` (poppler/xpdf must be on PATH; without -enc UTF-8 some builds silently drop all Thai).
 * Sheets are exported as CSV and turned into the same line format, so one parser handles both.
 *
 * Output
 *   public/timetable/curricula/<faculty id>.json   { faculty, programs: [{ id, name, division,
 *                                                    editions: [{ curriculumYear, source, years }] }] }
 *   public/timetable/curricula/index.json          one entry per faculty (upserted by id) — this is
 *                                                    all the app needs to show a new faculty
 *
 * Parser notes
 *   - A plan section starts at the first "ชั้นปีที่ 1" / "ปีที่ 1" heading and ends at the course
 *     descriptions (คำอธิบายรายวิชา) or at an appendix such as "รายวิชาเลือก…" catalogues. Course
 *     lists outside a "ภาคการศึกษาที่ n" / "ภาคฤดูร้อน" block are ignored, so elective catalogues
 *     no longer show up as an extra "year 4 / term 3".
 *   - A term's `credits` is the plan's own "รวม n หน่วยกิต" when it states one (so alternatives
 *     listed as "เลือก 1 วิชาจาก…" don't inflate it), else the sum of its rows.
 *   - Terms that still look like a catalogue (> 30 credits or > 16 rows) are dropped with a warning.
 *   - The run ends with a per-program credit total; real bachelor plans land at ~120–150.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FACULTIES } from "./curriculum-sources.mjs";
import { parsePlan, planTotals, statedTotal } from "./curriculum-parser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, "public", "timetable", "curricula");

// ---------------------------------------------------------------------------------------------
// Text normalisation

/** Thai glyph variants that some PDF fonts map into the Private Use Area (Windows/Adobe layout). */
const THAI_PUA = {
  "": "ฐ", "": "ิ", "": "ี", "": "ึ", "": "ื",
  "": "่", "": "้", "": "๊", "": "๋", "": "์",
  "": "่", "": "้", "": "๊", "": "๋", "": "์",
  "": "ญ", "": "ั", "": "ํ", "": "็", "": "่",
  "": "้", "": "๊", "": "๋", "": "์", "": "ุ",
  "": "ู", "": "ฺ",
};
const PUA_RE = /[-]/g;

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
  return s.replace(PUA_RE, (c) => THAI_PUA[c]).replace(PDF_MARK_RE, (all, y, yMarks, x, m) => {
    if (!/[่-๋ั็]/.test(m)) return all;
    if (!(yMarks || m.length === 1 || /^ั[่-๋]$/.test(m))) return all;
    return y + m + x;
  });
}

// ---------------------------------------------------------------------------------------------
// Sources

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};

let CACHE_DIR = path.join(os.tmpdir(), "psu-curriculum-cache");
let REFRESH = false;

const UA = { "user-agent": "Mozilla/5.0 (psu-allquiz curriculum importer)" };

function cacheName(key) {
  return key.replace(/^https?:\/\//, "").replace(/[^A-Za-z0-9ก-๙._-]+/g, "_").slice(-150);
}

async function download(url, key) {
  const file = path.join(CACHE_DIR, cacheName(key));
  if (!REFRESH && fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  const res = await fetch(new URL(url).href, { headers: UA, redirect: "follow" });
  if (!res.ok) throw new Error(`ดาวน์โหลดไม่สำเร็จ ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, buf);
  return file;
}

/**
 * Poppler's pdftotext is required: xpdf 4.x (e.g. the one bundled with Git for Windows) reorders
 * Thai marks ("ภาคการศกึ ษาท่ี") and drops Thai entirely without -enc. Set PDFTOTEXT to pick a binary.
 */
let PDFTOTEXT = null;
function pdftotext() {
  if (PDFTOTEXT) return PDFTOTEXT;
  const candidates = [
    process.env.PDFTOTEXT,
    "pdftotext",
    path.join(process.env.LOCALAPPDATA ?? "", "Programs", "MiKTeX", "miktex", "bin", "x64", "pdftotext.exe"),
    "C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\pdftotext.exe",
  ].filter(Boolean);
  for (const bin of candidates) {
    const v = spawnSync(bin, ["-v"], { encoding: "utf8" }); // prints the version on stderr
    if (/poppler/i.test(`${v.stdout ?? ""}${v.stderr ?? ""}`)) return (PDFTOTEXT = bin);
  }
  throw new Error("ต้องใช้ pdftotext ของ Poppler (ตั้ง PDFTOTEXT=/path/to/pdftotext ได้)");
}

function pdfLines(pdfFile) {
  const txtFile = `${pdfFile}.poppler.txt`;
  if (REFRESH || !fs.existsSync(txtFile)) execFileSync(pdftotext(), ["-enc", "UTF-8", "-layout", pdfFile, txtFile]);
  return fs.readFileSync(txtFile, "utf8").split(/\r?\n/);
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** A sheet row → one text line in the PDF layout the parser expects (cells ≥ 4 spaces apart). */
function sheetRowLine(cells) {
  return cells.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean).join("    ");
}

async function sheetLines(id) {
  // Every tab: the htmlview page lists them as {name, …, gid}.
  const view = fs.readFileSync(await download(`https://docs.google.com/spreadsheets/d/${id}/htmlview`, `sheet-${id}.html`), "utf8");
  const gids = [...new Set([...view.matchAll(/gid: "(\d+)"/g)].map((m) => m[1]))];
  const lines = [];
  for (const gid of gids.length ? gids : [null]) {
    const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
    const csv = fs.readFileSync(await download(url, `sheet-${id}-${gid ?? 0}.csv`), "utf8");
    for (const cells of parseCsv(csv)) lines.push(sheetRowLine(cells));
    lines.push("");
  }
  return lines;
}

export function editionSource(ed) {
  if (ed.pdf) return ed.pdf;
  if (ed.drive) return ed.page ?? `https://drive.google.com/file/d/${ed.drive}/view`;
  if (ed.sheet) return `https://docs.google.com/spreadsheets/d/${ed.sheet}`;
  throw new Error("edition has no source");
}

async function editionLines(ed) {
  let lines;
  if (ed.pdf) lines = pdfLines(await download(ed.pdf, ed.pdf.endsWith(".pdf") ? ed.pdf : `${ed.pdf}.pdf`));
  else if (ed.drive) lines = pdfLines(await download(`https://drive.google.com/uc?export=download&id=${ed.drive}`, `drive-${ed.drive}.pdf`));
  else if (ed.sheet) lines = await sheetLines(ed.sheet);
  lines = lines.map(fixThaiPdfText);
  if (ed.section) {
    const s = lines.findIndex((l) => ed.section.start.test(l));
    if (s < 0) throw new Error(`ไม่พบจุดเริ่ม section ${ed.section.start}`);
    let e = ed.section.end ? lines.findIndex((l, i) => i > s && ed.section.end.test(l)) : -1;
    if (e < 0) e = lines.length;
    lines = lines.slice(s, e);
  }
  return lines;
}

// ---------------------------------------------------------------------------------------------

async function importFaculty(fac) {
  const programs = [];
  const report = [];
  for (const p of fac.programs) {
    const editions = [];
    for (const ed of p.editions) {
      const lines = await editionLines(ed);
      const plan = parsePlan(lines);
      const courses = plan.years.reduce((n, y) => n + y.terms.reduce((m, t) => m + t.courses.length, 0), 0);
      const totals = planTotals(plan.years);
      const stated = ed.statedTotal ?? statedTotal(lines);
      const totalText = totals.map((t) => `${t.plan ? `${t.plan} ` : ""}${t.credits}`).join(" / ");
      console.log(
        `  ${courses ? "✔" : "✘"} ${p.name} ${ed.curriculumYear}: ${courses} วิชา, ${totalText} หน่วยกิต` +
          (stated ? ` (หลักสูตรระบุ ${stated})` : "")
      );
      for (const w of plan.warnings) console.log(`      ⚠ ${w}`);
      report.push({ faculty: fac.id, program: p.name, curriculumYear: ed.curriculumYear, source: editionSource(ed), courses, totals, stated, warnings: plan.warnings });
      if (!courses) continue;
      editions.push({ curriculumYear: ed.curriculumYear, source: editionSource(ed), years: plan.years });
    }
    if (editions.length) programs.push({ id: p.id, name: p.name, division: p.division, editions });
  }

  const outFile = path.join(OUT_DIR, `${fac.id}.json`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ faculty: fac.title, programs }, null, 2));
  console.log(`→ ${path.relative(ROOT, outFile)} (${programs.length} หลักสูตร)`);
  writeCurriculaIndex(fac, programs.length);
  return report;
}

/** public/timetable/curricula/index.json — faculties that have study plans (read by the app). */
function writeCurriculaIndex(fac, programCount) {
  const indexFile = path.join(OUT_DIR, "index.json");
  let index = { faculties: [] };
  try {
    index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
  } catch {
    /* first run */
  }
  const entry = {
    id: fac.id,
    faculty: fac.faculty,
    campus: fac.campus,
    file: `/timetable/curricula/${fac.id}.json`,
    programs: programCount,
    source: fac.source,
    updatedAt: new Date().toISOString(),
  };
  const rest = (index.faculties ?? []).filter((f) => f.id !== entry.id);
  index.faculties = programCount ? [...rest, entry] : rest;
  const order = FACULTIES.map((f) => f.id);
  index.faculties.sort((a, b) => (order.indexOf(a.id) + 1 || 999) - (order.indexOf(b.id) + 1 || 999));
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
}

async function main() {
  CACHE_DIR = flag("--cache") ?? CACHE_DIR;
  const dump = flag("--dump");
  const reportFile = flag("--report");
  REFRESH = argv.includes("--refresh");
  const ids = argv.filter((a) => !a.startsWith("--"));

  if (dump) {
    const [fid, pid, year] = dump.split("/");
    const p = FACULTIES.find((f) => f.id === fid)?.programs.find((x) => x.id === pid);
    if (!p) throw new Error(`ไม่พบ ${dump}`);
    const ed = year ? p.editions.find((e) => String(e.curriculumYear) === year) : p.editions[0];
    console.log((await editionLines(ed)).join("\n"));
    return;
  }

  const unknown = ids.filter((id) => !FACULTIES.some((f) => f.id === id));
  if (unknown.length) throw new Error(`ไม่รู้จักคณะ: ${unknown.join(", ")}`);
  const report = [];
  for (const fac of FACULTIES.filter((f) => !ids.length || ids.includes(f.id))) {
    console.log(`${fac.faculty} (${fac.campus})`);
    report.push(...(await importFaculty(fac)));
  }
  console.log(`→ ${path.relative(ROOT, path.join(OUT_DIR, "index.json"))}`);
  if (reportFile) fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
