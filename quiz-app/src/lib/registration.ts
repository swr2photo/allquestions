// ประวัติการลงทะเบียนจากไฟล์ PDF "ผลการลงทะเบียน" ของ SIS (เก็บในเครื่องผู้ใช้เท่านั้น)

export const REGISTRATION_STORAGE_KEY = "psu-registration:v1";
/** เวลาที่แก้ไขสำเนาในเครื่องล่าสุด — ใช้เทียบกับสำเนาบนบัญชีในหน้าจัดตารางเรียน */
export const REGISTRATION_AT_KEY = "psu-registration:v1:at";

export interface RegistrationRecord {
  /** ภาคการศึกษา/ปี พ.ศ. เช่น "1/2567" */
  term: string;
  code: string;
  name: string;
  sec: string;
  type: string;
  credits: number;
}

export interface RegistrationHistory {
  records: RegistrationRecord[];
  /** รหัสวิชาที่ผู้ใช้ระบุว่าตามรีเกรดได้ (ไม่นับเป็นวิชาลงซ้ำ) */
  regradeCodes: string[];
}

export interface RegistrationParseResult {
  records: RegistrationRecord[];
  /** รหัสวิชาที่พบในไฟล์แต่ไม่สามารถจับคู่ตอน/หน่วยกิตได้ */
  skippedCodes: string[];
}

export const UNKNOWN_TERM = "ไม่ระบุภาค";

const TERM_WITH_LABEL =
  /(?:ภาค(?:การศึกษา|เรียน)?(?:ที่)?|term|semester)\s*([1-3])\s*\/\s*(25\d{2})/i;
const TERM_YEAR_FIRST =
  /ปีการศึกษา\s*(25\d{2})\s*(?:ภาค(?:การศึกษา|เรียน)?(?:ที่)?)\s*([1-3])/i;
const TERM_BEFORE_YEAR =
  /(?:ภาค(?:การศึกษา|เรียน)?(?:ที่)?)\s*([1-3])\s*ปีการศึกษา\s*(25\d{2})/i;
const TERM_BARE = /^([1-3])\s*\/\s*(25\d{2})$/;

// รหัสวิชา ม.อ. เช่น 322-101, 001-102G6, 117-201G2A, B03-001G4, DII00G4005, 322-N01, AIC-101
const CODE_BODY =
  "(?:[A-Z0-9]{3}\\s*-\\s*(?:\\d{3}|[A-Z]\\d{2})(?:\\s*G[1-8][AB]?(?=\\s|$|[\\u0E00-\\u0E7F])|[A-Z0-9]*)|[A-Z]{3}\\d{2}(?:G[1-8][AB]?\\d{2,3}|[A-Z0-9]{2}\\d{3})(?=\\s|$|[\\u0E00-\\u0E7F]))";
const CODE_PREFIX = new RegExp(
  `^(?:\\d{1,2}\\.?\\s+)?(${CODE_BODY})(?:\\s+(.*)|([\\u0E00-\\u0E7F].*))?$`,
  "i"
);
const REG_TAIL =
  /^(?:(.*?)\s+)?(\d{1,3}[A-Z]?|-)\s+([A-Z])\*?\s+(\d+(?:\.\d+)?)(?:\s*\(\d+-\d+-\d+\))?(?:\s+(?:[ABCDF][+-]?|[SUWIPGR]|AU|-|ลงทะเบียน\S*|ปกติ|ถอน\S*|ผ่าน\S*|รอผล\S*|ไม่นับ\S*|\(\S+\)))*$/;
const TRANSCRIPT_TAIL =
  /^(?:(.*?)\s+)?(\d+(?:\.\d+)?)\s+([ABCDF][+-]?|[SUWIP]|AU)$/i;
const NON_COURSE_LINE =
  /^(?:(?:page|หน้า)\s*\d+|-\s*\d+\s*-|\d+\s*\/\s*\d+|(?:ลำดับ|รหัสวิชา|course\s*code|no\.?\s+code)\b|.*(?:ชื่อ(?:ราย)?วิชา.*หน่วยกิต|ตอนเรียน.*หน่วยกิต)|(?:รวม|รวมหน่วยกิต|จำนวนหน่วยกิต|คะแนนเฉลี่ย|เกรดเฉลี่ย|gp[ax]\b|total\b|remark|หมายเหตุ|พิมพ์เมื่อ|วันที่|printed\b|ลงชื่อ)|[\d\s.,:/\-*()]+)$/i;

const LOOSE_COURSE = new RegExp(
  `^(?:\\d{1,2}\\.?\\s+)?(${CODE_BODY})\\s+(.+?)\\s+(\\d{1,2})(?:\\.\\d+)?(?:\\s*[A-DFWSPUI][+-]?)?(?:\\s*\\(.*)?$`,
  "i"
);

function cleanRegistrationLine(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\t\u00A0]+/g, " ")
    .replace(/([A-Z0-9]{3})\s*[‐‑‒–—-]\s*(\d{3}|[A-Z]\d{2})/gi, "$1-$2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCourseCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function extractRegistrationTerm(line: string): string | null {
  const m1 = line.match(TERM_WITH_LABEL);
  if (m1) return `${m1[1]}/${m1[2]}`;
  const m2 = line.match(TERM_YEAR_FIRST);
  if (m2) return `${m2[2]}/${m2[1]}`;
  const m3 = line.match(TERM_BEFORE_YEAR);
  if (m3) return `${m3[1]}/${m3[2]}`;
  const m4 = line.match(TERM_BARE);
  if (m4) return `${m4[1]}/${m4[2]}`;
  return null;
}

interface ParsedTail {
  namePart: string;
  sec: string;
  type: string;
  credits: number;
}

function parseCourseTail(text: string): ParsedTail | null {
  const reg = text.match(REG_TAIL);
  if (reg) {
    const credits = Number(reg[4]);
    if (credits >= 0 && credits <= 15) {
      return {
        namePart: (reg[1] ?? "").trim(),
        sec: reg[2],
        type: reg[3],
        credits,
      };
    }
  }
  const tr = text.match(TRANSCRIPT_TAIL);
  if (tr) {
    const credits = Number(tr[2]);
    if (credits >= 0 && credits <= 15) {
      return {
        namePart: (tr[1] ?? "").trim(),
        sec: "",
        type: "C",
        credits,
      };
    }
  }
  return null;
}

/**
 * แปลงบรรทัดจากไฟล์ PDF "ผลการลงทะเบียน" ของ SIS พร้อมรายงานรหัสวิชาที่อาจตกหล่น
 * รองรับทั้งบรรทัดเดียว, ชื่อวิชาที่ตัดขึ้นหลายบรรทัด (จัดชิดบน/กลาง/ล่าง), และใบรายงานผลการศึกษา
 */
export function inspectRegistrationLines(lines: string[]): RegistrationParseResult {
  const records: RegistrationRecord[] = [];
  const skippedCodes: string[] = [];
  let term = "";
  let pending: RegistrationRecord | null = null;
  let pendingExtras: string[] = [];
  let openDraft: { term: string; code: string; nameParts: string[] } | null = null;
  let orphanLines: string[] = [];

  const flushPending = () => {
    if (!pending) return;
    if (pendingExtras.length) {
      pending.name = [pending.name, ...pendingExtras].filter(Boolean).join(" ").trim();
    }
    if (!pending.name) pending.name = pending.code;
    pending = null;
    pendingExtras = [];
  };

  const dropOpenDraft = () => {
    if (!openDraft) return;
    if (!skippedCodes.includes(openDraft.code)) skippedCodes.push(openDraft.code);
    openDraft = null;
  };

  for (const raw of lines) {
    const line = cleanRegistrationLine(raw);
    if (!line || NON_COURSE_LINE.test(line)) {
      flushPending();
      dropOpenDraft();
      orphanLines = [];
      continue;
    }

    const foundTerm = extractRegistrationTerm(line);
    if (foundTerm) {
      flushPending();
      dropOpenDraft();
      orphanLines = [];
      term = foundTerm;
      continue;
    }

    const codeMatch = line.match(CODE_PREFIX);
    if (codeMatch) {
      dropOpenDraft();
      const code = normalizeCourseCode(codeMatch[1]);
      const rest = (codeMatch[2] ?? codeMatch[3] ?? "").trim();
      const activeTerm = term || UNKNOWN_TERM;
      const tail = rest ? parseCourseTail(rest) : null;

      if (tail) {
        let name = tail.namePart;
        // กรณีชื่อวิชาอยู่บรรทัดบน-ล่างล้อมแถวที่จัดกึ่งกลาง (รหัส+ตอน+หน่วยกิตอยู่บรรทัดกลางเดี่ยว)
        if (!name) {
          if (pendingExtras.length) name = pendingExtras.pop()!;
          else if (orphanLines.length) name = orphanLines.pop()!;
        }
        flushPending();
        orphanLines = [];
        pending = {
          term: activeTerm,
          code,
          name,
          sec: tail.sec,
          type: tail.type,
          credits: tail.credits,
        };
        records.push(pending);
      } else {
        let nameParts = rest ? [rest] : [];
        if (!nameParts.length) {
          if (pendingExtras.length) nameParts = [pendingExtras.pop()!];
          else if (orphanLines.length) nameParts = [orphanLines.pop()!];
        }
        flushPending();
        orphanLines = [];
        openDraft = { term: activeTerm, code, nameParts };
      }
      continue;
    }

    if (openDraft) {
      const tail = parseCourseTail(line);
      if (tail) {
        const name = [...openDraft.nameParts, tail.namePart].filter(Boolean).join(" ").trim();
        pending = {
          term: openDraft.term,
          code: openDraft.code,
          name: name || openDraft.code,
          sec: tail.sec,
          type: tail.type,
          credits: tail.credits,
        };
        records.push(pending);
        openDraft = null;
        continue;
      }
      if (line.length <= 120 && openDraft.nameParts.length < 4) {
        openDraft.nameParts.push(line);
      } else {
        dropOpenDraft();
      }
      continue;
    }

    if (pending) {
      if (line.length <= 120 && pendingExtras.length < 3) {
        pendingExtras.push(line);
      } else {
        flushPending();
      }
      continue;
    }

    if (line.length <= 120) {
      orphanLines.push(line);
      if (orphanLines.length > 2) orphanLines.shift();
    }
  }

  flushPending();
  dropOpenDraft();
  return { records, skippedCodes };
}

export function parseRegistrationLines(lines: string[]): RegistrationRecord[] {
  return inspectRegistrationLines(lines).records;
}

/**
 * ข้อความที่คัดลอกจากหน้า "ผลการลงทะเบียน" ของ SIS (หรือพิมพ์เอง) → รายการวิชา
 * ลองรูปแบบเดียวกับ PDF ก่อน ถ้าไม่พบจึงใช้รูปแบบหลวม "รหัส ชื่อวิชา … หน่วยกิต" (ไม่ต้องมีตอน/ประเภท)
 */
export function parseRegistrationText(text: string): RegistrationRecord[] {
  const lines = text.split(/\r?\n/).map((l) => cleanRegistrationLine(l));
  const strict = parseRegistrationLines(lines);
  if (strict.length) return strict;
  const records: RegistrationRecord[] = [];
  let term = UNKNOWN_TERM;
  for (const line of lines) {
    if (!line) continue;
    const termMatch = extractRegistrationTerm(line);
    if (termMatch) {
      term = termMatch;
      continue;
    }
    const course = line.match(LOOSE_COURSE);
    if (!course) continue;
    const credits = Number(course[3]);
    if (credits > 15) continue;
    // "ชื่อวิชา 01 C" → ตัดตอน/ประเภทที่ติดท้ายชื่อออก
    const tail = course[2].match(/^(.*?)\s+(\d{1,3}[A-Z]?)\s+([A-Z])$/);
    records.push({
      term,
      code: normalizeCourseCode(course[1]),
      name: (tail ? tail[1] : course[2]).trim(),
      sec: tail ? tail[2] : "",
      type: tail ? tail[3] : "C",
      credits,
    });
  }
  return records;
}

export function mergeRegistrationRecords(
  existing: RegistrationRecord[],
  incoming: RegistrationRecord[]
): RegistrationRecord[] {
  const byKey = new Map<string, RegistrationRecord>();
  for (const record of [...existing, ...incoming]) {
    byKey.set(`${record.term}|${record.code}|${record.sec}`, record);
  }
  return [...byKey.values()].sort(
    (a, b) => a.term.localeCompare(b.term) || a.code.localeCompare(b.code)
  );
}

/** ภาคการศึกษาที่เคยลงวิชานี้ (ไม่รวม exceptTerm) ว่างเมื่อตั้งเป็นวิชาตามรีเกรดแล้ว */
export function priorTermsFor(history: RegistrationHistory, code: string, exceptTerm?: string): string[] {
  if (history.regradeCodes.includes(code)) return [];
  const terms = history.records
    .filter((r) => r.code === code && r.term !== exceptTerm)
    .map((r) => r.term);
  return [...new Set(terms)];
}

export function readRegistrationHistory(): RegistrationHistory {
  try {
    const raw = localStorage.getItem(REGISTRATION_STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (!value || !Array.isArray(value.records)) return { records: [], regradeCodes: [] };
    return {
      records: value.records,
      regradeCodes: Array.isArray(value.regradeCodes) ? value.regradeCodes : [],
    };
  } catch {
    return { records: [], regradeCodes: [] };
  }
}

export function writeRegistrationHistory(history: RegistrationHistory) {
  try {
    if (history.records.length) localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(history));
    else localStorage.removeItem(REGISTRATION_STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) — history just won't persist */
  }
}

export interface PdfTextItemLike {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
}

/** จัดเรียง text items ของ PDF หนึ่งหน้าตามพิกัด (บน→ล่าง, ซ้าย→ขวา) พร้อมรวมแถวที่ baseline ต่างกันเล็กน้อย */
export function buildPdfPageLines(rawItems: PdfTextItemLike[]): string[] {
  const tokens = rawItems
    .filter((it) => it.str.replace(/[\u200B-\u200D\uFEFF]/g, "").trim().length > 0)
    .map((it) => {
      const a = it.transform[0] ?? 10;
      const b = it.transform[1] ?? 0;
      const fontSize = Math.hypot(a, b) || it.height || 10;
      return {
        str: it.str.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " "),
        x: it.transform[4] ?? 0,
        y: it.transform[5] ?? 0,
        width: it.width ?? 0,
        fontSize,
      };
    });

  if (!tokens.length) return [];

  tokens.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: (typeof tokens)[] = [];
  let currentRow: typeof tokens = [];
  let rowAnchorY = NaN;

  for (const tok of tokens) {
    const tolerance = Math.min(3.5, Math.max(2.2, tok.fontSize * 0.28));
    if (!currentRow.length || Math.abs(tok.y - rowAnchorY) <= tolerance) {
      if (!currentRow.length) rowAnchorY = tok.y;
      currentRow.push(tok);
    } else {
      rows.push(currentRow);
      currentRow = [tok];
      rowAnchorY = tok.y;
    }
  }
  if (currentRow.length) rows.push(currentRow);

  const lines: string[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let line = "";
    let prevRight = NaN;
    let prevHasWidth = false;

    for (const tok of row) {
      const gap = tok.x - prevRight;
      const spaceThreshold = Math.max(1.2, tok.fontSize * 0.14);
      if (line) {
        const needsSpace = !prevHasWidth || gap > spaceThreshold;
        if (needsSpace && !line.endsWith(" ") && !tok.str.startsWith(" ")) {
          line += " ";
        }
      }
      line += tok.str;
      if (tok.width > 0) {
        prevRight = tok.x + tok.width;
        prevHasWidth = true;
      } else {
        prevHasWidth = false;
      }
    }

    const cleaned = line.replace(/\s+/g, " ").trim();
    if (cleaned) lines.push(cleaned);
  }
  return lines;
}

/** อ่านข้อความทุกหน้าของ PDF เป็นบรรทัด (pdf.js ทำงานในเบราว์เซอร์ ไม่ส่งไฟล์ขึ้นเซิร์ฟเวอร์) */
export async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const items = content.items.filter((item): item is typeof item & PdfTextItemLike => "str" in item);
    lines.push(...buildPdfPageLines(items));
  }
  return lines;
}

/** อ่านไฟล์ PDF ผลการลงทะเบียนจาก SIS พร้อม fallback และกรองรหัสวิชาที่กู้คืนได้แล้วออกจาก skippedCodes */
export async function extractRegistrationFromPdf(file: File): Promise<RegistrationParseResult> {
  const lines = await extractPdfLines(file);
  const inspected = inspectRegistrationLines(lines);
  const records = inspected.records.length
    ? inspected.records
    : parseRegistrationText(lines.join("\n"));
  const parsedCodes = new Set(records.map((r) => r.code));
  return {
    records,
    skippedCodes: inspected.skippedCodes.filter((code) => !parsedCodes.has(code)),
  };
}
