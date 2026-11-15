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

const TERM_LINE = /ภาคการศึกษา\s*(\d)\s*\/\s*(\d{4})/;
const COURSE_LINE = /^([A-Z0-9]{3}-\d{3}[A-Z0-9]*)\s+(.+?)\s+(\d{2})\s+([A-Z])\s+(\d+(?:\.\d+)?)$/;
const NAME_CONTINUATION = /^[A-Z][A-Z &():,.\-/']*$/;

export function parseRegistrationLines(lines: string[]): RegistrationRecord[] {
  const records: RegistrationRecord[] = [];
  let term = "";
  let pending: RegistrationRecord | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const termMatch = line.match(TERM_LINE);
    if (termMatch) {
      term = `${termMatch[1]}/${termMatch[2]}`;
      pending = null;
      continue;
    }
    const course = line.match(COURSE_LINE);
    if (course && term) {
      pending = {
        term,
        code: course[1],
        name: course[2],
        sec: course[3],
        type: course[4],
        credits: Number(course[5]),
      };
      records.push(pending);
      continue;
    }
    if (pending && NAME_CONTINUATION.test(line)) {
      pending.name += ` ${line}`;
      continue;
    }
    pending = null;
  }
  return records;
}

const LOOSE_TERM = /(?:ภาค(?:การศึกษา|เรียน)?(?:ที่)?|term|semester)\s*(\d)\s*\/\s*(25\d{2})|^(\d)\s*\/\s*(25\d{2})$/i;
const LOOSE_COURSE = /^([A-Z0-9]{3}-\d{3}[A-Z0-9]*)\s+(.+?)\s+(\d{1,2})(?:\.\d+)?(?:\s*\(.*)?$/;
export const UNKNOWN_TERM = "ไม่ระบุภาค";

/**
 * ข้อความที่คัดลอกจากหน้า "ผลการลงทะเบียน" ของ SIS (หรือพิมพ์เอง) → รายการวิชา
 * ลองรูปแบบเดียวกับ PDF ก่อน ถ้าไม่พบจึงใช้รูปแบบหลวม "รหัส ชื่อวิชา … หน่วยกิต" (ไม่ต้องมีตอน/ประเภท)
 */
export function parseRegistrationText(text: string): RegistrationRecord[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[\t ]+/g, " "));
  const strict = parseRegistrationLines(lines);
  if (strict.length) return strict;
  const records: RegistrationRecord[] = [];
  let term = UNKNOWN_TERM;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const termMatch = line.match(LOOSE_TERM);
    if (termMatch) {
      term = `${termMatch[1] ?? termMatch[3]}/${termMatch[2] ?? termMatch[4]}`;
      continue;
    }
    const course = line.match(LOOSE_COURSE);
    if (!course) continue;
    const credits = Number(course[3]);
    if (credits > 15) continue;
    // "ชื่อวิชา 01 C" → ตัดตอน/ประเภทที่ติดท้ายชื่อออก
    const tail = course[2].match(/^(.*?)\s+(\d{2})\s+([A-Z])$/);
    records.push({
      term,
      code: course[1],
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

/** อ่านข้อความทุกหน้าของ PDF เป็นบรรทัด (pdf.js ทำงานในเบราว์เซอร์ ไม่ส่งไฟล์ขึ้นเซิร์ฟเวอร์) */
export async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    let current = "";
    let lastY = NaN;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5]);
      if (y !== lastY) {
        if (current.trim()) lines.push(current);
        current = "";
        lastY = y;
      }
      current += `${item.str} `;
    }
    if (current.trim()) lines.push(current);
  }
  return lines;
}
