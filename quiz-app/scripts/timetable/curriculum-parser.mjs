/*
 * Study-plan parser for import-curriculum.mjs.
 *
 * Input: the text lines of a study plan (pdftotext -layout output, or a Google Sheet turned into the
 * same layout). Output: { years: [{ year, plan?, terms: [{ term, credits, courses }] }], warnings }.
 *
 * Layouts handled (all seen in PSU faculty documents):
 *   - "ชั้นปีที่ 1" / "ปีที่ 1" / "ปีที่ 2 (แขนงวิชา…)" year headings, "ภาคการศึกษาที่ 1" / "ภาคฤดูร้อน"
 *     term headings, also both terms side by side (two columns) and "ชั้นปีที่ 1 ภาคการศึกษาที่ 1".
 *   - Plan variants ("แผนการศึกษาปกติ", "แผนสหกิจศึกษา", "แผนโครงงาน") at year level, before a term,
 *     inside a term, or after a term's "รวม" line (the variant then repeats that term).
 *   - Rows "330-101  หลักชีววิทยา  2((2)-0-4)", placeholders "xxx-xxx", "324-3xx", "XXX-XXXG1",
 *     "GE 5  สุขภาวะองค์รวม", names wrapped onto the next line, and a code line whose credits sit on
 *     the following line(s) ("xxx-xxx รายวิชาหมวดวิชาศึกษาทั่วไป" / "GE5 สุขภาวะองค์รวม  2((x)-y-z)").
 *   - "รวม 18((x)-y-z)" / "หน่วยกิตรวม 17" / "รวมหน่วยกิต 20" / "รวม 15-18 หน่วยกิต" totals: used as
 *     the term's credits when lower than the rows' sum (alternatives such as "เลือกเรียน 1 วิชา" are
 *     listed with their own credits).
 *   - Credits as "3 หน่วยกิต" or ranges "2-3 หน่วยกิต" (upper bound), bulleted codes ("-001-102"),
 *     dotted placeholders ("......-……"), code-only rows ("890-xxx  2((2)-0-4)") named after their
 *     group heading, and group headings with credits but no rows ("สาระที่ 7 … 1 หน่วยกิต"), which
 *     become a placeholder row.
 *   - Several complete plan tables per document ("แผนการศึกษา (…สหกิจศึกษา 1 ปี)", "แผน 4+0"),
 *     numbered plan sections before the years ("3.1.2 แผนการศึกษาสหกิจศึกษา", FMS), majors and
 *     branches ("สำหรับเอกวิศวกรรมวัสดุที่เลือกเรียนสหกิจ", "แขนงวิชาไฟฟ้ากำลัง") combined with tracks
 *     as "major · track", and "ปีที่ 4 (ทั้ง 3 แขนง)" years shared by all.
 *
 * Headings are matched on a skeleton of the line with Thai combining marks removed, so the mark-order
 * glitches PDF text layers produce ("ภาคการศกึ ษาท่ี") don't matter.
 */

const MARK_RE = /[ัิ-ฺ็-๎]/;
const THAI_RE = /[ก-๙]/;
const THAI_BASE_RE = /[ก-ฮะาำเ-ไ]/;

/** Line without Thai combining marks and without single stray spaces between Thai letters. */
export function skeleton(s) {
  let text = "";
  const map = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (MARK_RE.test(ch)) continue;
    if (ch === " " && THAI_BASE_RE.test(text.at(-1) ?? "") && s[i + 1] !== " " && THAI_BASE_RE.test(s[i + 1] ?? "")) continue;
    text += ch;
    map.push(i);
  }
  return { text, map };
}

const CODE_SRC = String.raw`(?:[\dxX]{3}-[\dxX]{3}[A-Za-z0-9]*|GE\s?\d[AB]?|[.…]{2,}-[.…]+)`;
// credits: "3((2)-3-4)", "1(0-3-0)", "3(x-y-z)", or "3 หน่วยกิต"
// (a range "2-3 หน่วยกิต" counts as its upper bound)
const CREDITS_SRC = String.raw`(\d{1,2}(?:\s*-\s*\d{1,2})?)\s*(?=\(|$|\s{2,}|หน่วย)`;
const cr = (s) => Math.max(...String(s).split("-").map(Number));
// a code may carry a bullet ("-001-102") but never continue another token
const ITEM_RE = new RegExp(`(?<!\\w)(${CODE_SRC})\\**\\s+(\\S.*?)\\s{2,}${CREDITS_SRC}`, "g");
// credits immediately followed by "(" — preferred, so a name ending in "  1" isn't read as 1 credit
// (one space is enough before credits written like "3((2)-3-4)" / "1(0-3-0)" / "3(x-y-z)")
const ITEM_STRICT_RE = new RegExp(`(?<!\\w)(${CODE_SRC})\\**\\s+(\\S.*?)\\s+(\\d{1,2})(?=\\((?:\\(|\\d|x|X))`, "g");
// a code with credits but no name ("890-xxx      2((2)-0-4)") — named after its group heading
const ITEM_NONAME_RE = new RegExp(`^\\s*-?(${CODE_SRC})\\**\\s{2,}(\\d{1,2})(?=\\((?:\\(|\\d|x|X))`);
// "สาระที่ 6 ภาษาและการสื่อสาร*      2 หน่วยกิต" — a group of rows, or a placeholder when none follow
const GROUP_RE = /^\s*(\S.*?\S)\s{2,}(\d{1,2}(?:\s*-\s*\d{1,2})?)\s*(?:\(|หน่วย)/;

/** Rows on a line: strict matches, plus loose ones that don't overlap them (two-column layouts). */
function lineItems(line) {
  const strict = [...line.matchAll(ITEM_STRICT_RE)];
  const loose = [...line.matchAll(ITEM_RE)].filter(
    (l) => !strict.some((s) => l.index < s.index + s[0].length && s.index < l.index + l[0].length)
  );
  return [...strict, ...loose].sort((a, b) => a.index - b.index);
}
const CODE_LINE_RE = new RegExp(`^\\s*-?(${CODE_SRC})\\**\\s+(\\S.*?)\\s*$`);
const CONT_ITEM_RE = new RegExp(`^\\s*(\\S.*?)\\s{2,}${CREDITS_SRC}`);

// on the skeleton
const YEAR_SK = /^(?:ชน)?ปท\s*([1-8])(?:\s+(.*))?$/;
/** what may follow "ชั้นปีที่ n" on a heading line: a plan, a term, "ทุกแผน…", "สำหรับ…" */
const YEAR_REST_SK = /^(?:\(|แผน|ภาค|ทกแผน|ส[ำา]?หรบ|ทางเลอก)/;
const TERM_SK = /(?:ภาค)?(?:การศกษา|เรยน)\s*ท\s*([1-3])|ภาค(?:การศกษา)?ฤดรอน/g;
// "รวม 18((x)-y-z)", "หน่วยกิตรวม 17", "รวม 15-18 หน่วยกิต" (a range: the upper bound caps alternatives)
const TOTAL_SK = /รวม(?:ทงสน)?(?:หนวยกต)?\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?(?=\s*(?:\(|$|\s|หนวยกต))/g;
const TOTAL_LINE_SK = /^(?:หนวยกต)?รวม/;
const PLAN_HEADER_SK = /^(?:\d+\.\s*)?แผนการศกษา(?:ตลอดหลกสตร)?\s*(?:\(|ส[ำา]?หรบ|แผน|$)/;
const END_SK = [
  /^หมวดท\s*\d/,
  /^(?:\d+(?:\.\d+)*\.?|[ก-ฮ]\.)?\s*\S*อธบายรายวชา/,
  /^ภาคผนวก/,
];

function termNo(m) {
  return m[1] ? Number(m[1]) : 3;
}

/**
 * Canonical plan-variant name, so one document's spellings agree:
 *   "แผนการศึกษาปกติ" → "ปกติ", "(แผนทางเลือกสหกิจ)" / "การสหกิจศึกษา" → "สหกิจศึกษา",
 *   "แผนสหกิจ (แบบ 1 ภาคการศึกษา)" → "สหกิจศึกษา 1 ภาค", "ทางเลือกที่ 1 โครงงานวิศวกรรมโยธา" → "โครงงาน",
 *   "สำหรับเอกวิศวกรรมวัสดุที่เลือกเรียนสหกิจ" → "วิศวกรรมวัสดุ · สหกิจศึกษา",
 *   "แขนงวิชาไฟฟ้ากำลัง" → itself (no track word: kept as written).
 */
export function planLabel(raw) {
  if (!raw) return null;
  let text = raw.replace(/[()*]/g, " ").replace(/\s+/g, " ").trim();
  if (/ทุกแผน|ทั้ง\S*\s*(?:ทางเลือก|แผน)|ทุกทางเลือก/.test(text)) return null; // "สำหรับนักศึกษาทั้งสองทางเลือก"
  text = text.replace(/^แผน\s*\d+\s*[-–—.:]*\s*/, "แผน"); // "แผน 2--- วิจัย"
  // co-op variants differ by length: "สหกิจศึกษา 1 ภาคการศึกษา" vs "… 2 ภาคการศึกษา" / "… 1 ปี"
  const dur = text.match(/(\d)\s*(ภาค|ปี)/);
  text = text
    .replace(/\s*แบบ\s*\d.*$/, "")
    .replace(/^(?:แผน|การศึกษา|การเรียน|แบบ|ส[ำา]หรับ|นักศึกษา|ที่เลือกเรียน|ที่เรียน|ที่เลือก|กรณีเลือกเรียน|รายวิชา|ทางเลือก(?:ที่\s*\d)?|\s)+/, "")
    .trim();
  const major = text.match(/(?:^|เอก|การเรียน|แขนง(?:วิชา)?)\s*(วิศวกรรม[ก-๙]+?)(?=ที่|\s|$)/)?.[1] ?? null;
  const rest = major ? text.slice(text.indexOf(major) + major.length) : text;
  let track = null;
  if (/ไม่\S{0,12}สหกิจ|ปกติ|^หลัก$/.test(rest)) track = "ปกติ";
  else if (/สหกิจ/.test(rest)) track = dur ? `สหกิจศึกษา ${dur[1]} ${dur[2]}` : "สหกิจศึกษา";
  else if (/โครง/.test(rest)) track = "โครงงาน";
  else if (/ฝึกงาน/.test(rest)) track = "ฝึกงาน";
  else if (/ผู้ประกอบการ/.test(rest)) track = "ผู้ประกอบการ";
  else if (/ต่างประเทศ/.test(rest)) track = "ศึกษาต่างประเทศ";
  else if (/^วิจัย/.test(rest)) track = "วิจัย";
  if (major || track) return [major, track].filter(Boolean).join(" · ");
  if (!/^[ก-๙ ]{2,30}$/.test(text) || /^(ตลอด|หน่วยกิต|หลักสูตร)/.test(text) || /หลักสูตร|หน่วยกิต/.test(text)) return null;
  return text;
}

/**
 * "แผนการศึกษาปกติและแผนการศึกษาสหกิจศึกษา" → "ปกติ|สหกิจศึกษา". Whether that means "shared by both
 * plans" or one plan named "…และ…" is decided at the end, once every plan of the document is known.
 */
export function planSet(raw) {
  if (!raw) return null;
  const parts = raw.split(/\s*(?:และ|หรือ)\s*|\s*,\s*/).map(planLabel);
  if (parts.length > 1 && parts.every(Boolean)) return [...new Set(parts)].join("|");
  return planLabel(raw);
}

/** Label of a whole plan table: "(แผนสหกิจศึกษา 1 ปี)" → "สหกิจศึกษา 1 ปี", "สำหรับหลักสูตรปกติ" → "ปกติ". */
function tableLabel(raw) {
  let t = raw.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/^ส[ำา]?หรับ\s*/, "").replace(/^หลักสูตร\s*/, "").replace(/^แผน\s*/, "").replace(/^การศึกษา\s*/, "").trim();
  if (!t || /หรือ|ทุกแผน/.test(t)) return null;
  if (/^(?:การ)?สหกิจ/.test(t) && !/\d/.test(t)) return "สหกิจศึกษา";
  return /^[ก-๙0-9 .+]{2,40}$/.test(t) ? t : null; // "4+0", "3+1 แบบออกปฏิบัติสหกิจศึกษา"
}

/** A line that only names a plan variant: "แผนการศึกษาปกติ", "(แผนสหกิจศึกษา)", "แผนสหกิจ (แบบ 1 ภาค…)". */
function planLine(trimmed) {
  if (trimmed.length > 80) return null;
  // "3.1.2 แผนการศึกษาสหกิจศึกษา" (numbered section) / "(แผนสหกิจศึกษา)"
  const t = trimmed.replace(/^\d+(?:\.\d+)*\s+/, "").replace(/^\((.*)\)$/, "$1").trim();
  // a bare branch heading ("แขนงการประกอบและทดสอบเซมิคอนดักเตอร์") names a plan as written
  if (/^แขนง[ก-๙]/.test(t) && t.length <= 60 && !/\d/.test(t)) return t.replace(/\s+/g, " ");
  if (!/^แผน/.test(t) || /\d{3}-/.test(t)) return null;
  if (PLAN_HEADER_SK.test(skeleton(t).text)) return null; // a table header, see tableLabel()
  return planSet(t);
}

const TRACK_RE = /^(?:ปกติ|โครงงาน|ฝึกงาน|ผู้ประกอบการ|วิจัย|ศึกษาต่างประเทศ|สหกิจศึกษา.*)$/;
/**
 * A track chosen inside a major's / branch's year ("วิศวกรรมวัสดุ" or "แขนงวิชาไฟฟ้ากำลัง" + "โครงงาน")
 * is that major's track: "วิศวกรรมวัสดุ · โครงงาน".
 */
function withMajor(base, plan) {
  if (!base || !plan || base.includes(" · ") || base.includes("|") || TRACK_RE.test(base)) return plan;
  const parts = plan.split("|");
  if (!parts.every((p) => TRACK_RE.test(p))) return plan;
  return parts.map((p) => `${base} · ${p}`).join("|");
}

function normCode(code) {
  const ge = code.match(/^GE\s?(\d[AB]?)$/);
  if (ge) return `xxx-xxxG${ge[1]}`;
  if (/^[.…]/.test(code)) return "xxx-xxx";
  return code.replace(/^([\dxX]{3}-[\dxX]{3})/, (s) => s.toLowerCase());
}
function cleanName(code, name) {
  let n = name.replace(/\s+/g, " ").replace(/\s*\*+$/, "").trim();
  const ge = code.match(/^GE\s?(\d[AB]?)$/);
  if (ge && !/^GE/.test(n)) n = `GE${ge[1]} ${n}`;
  return n;
}

function findStart(lines) {
  for (let i = 0; i < lines.length; i++) {
    const sk = skeleton(lines[i].trim()).text;
    const y = sk.match(YEAR_SK);
    if (!y || y[1] !== "1") continue;
    if (y[2] && !YEAR_REST_SK.test(y[2])) continue;
    // a term heading must follow soon (skips tables such as "ปีที่ 1   70   70")
    for (let j = i; j < Math.min(lines.length, i + 15); j++) {
      if (new RegExp(TERM_SK.source).test(skeleton(lines[j]).text)) return i;
    }
  }
  return -1;
}

export function parsePlan(lines) {
  const start = findStart(lines);
  if (start < 0) return { years: [], warnings: ["ไม่พบส่วนแผนการศึกษา"] };
  const warnings = [];

  // A document may hold several complete plan tables, each under its own "แผนการศึกษา (…)" /
  // "แผนการศึกษาสำหรับหลักสูตร…" header (e.g. "โครงงาน" vs "สหกิจศึกษา 1 ปี"). Blocks remember their
  // table so shared (plan-less) years can be resolved per table at the end.
  const tables = [{ label: null }];
  let table = 0;
  const blocks = new Map();
  const blockFor = (year, plan) => {
    const key = `${table}|${year}|${plan ?? ""}`;
    if (!blocks.has(key)) blocks.set(key, { table, year, plan, terms: new Map(), declared: new Map() });
    return blocks.get(key);
  };
  const tableHeader = (i) => {
    const skt = skeleton(lines[i].trim()).text;
    if (!PLAN_HEADER_SK.test(skt)) return undefined;
    const rest = lines[i].trim().replace(/^[\d.\s]*แผนการศึกษา\s*/, "").replace(/^ตลอดหลักสูตร\s*/, "");
    return tableLabel(rest);
  };
  for (let i = Math.max(0, start - 4); i < start; i++) {
    const h = tableHeader(i);
    if (h !== undefined) tables[0].label = h ?? tables[0].label;
  }

  let year = null;
  let yearPlan = null; // plan from the year heading or a plan line before the first term
  let plan = null;
  let block = null;
  let term = null;
  let twoColumn = null;
  let closed = false; // after the term's "รวม" line
  let pendingPlan = null; // plan line seen while no term is open
  // plan line placed right before a year heading ("3.1.1 แผนการศึกษาปกติ" / "ชั้นปีที่ 1"), applying to
  // the years after it — only trusted when the document does that repeatedly (FMS); a lone one is
  // usually a document heading ("แผนการศึกษาแบบปกติ" above a plan whose co-op variant is in year 4)
  let sectionPlan = null;
  const nextLine = (i) => {
    let n = i + 1;
    while (n < lines.length && !lines[n].trim()) n++;
    return skeleton(lines[n] ?? "").text.trim();
  };
  const sectionLines = lines.filter((l, i) => i >= start - 4 && planLine(l.trim()) && YEAR_SK.test(nextLine(i))).length;
  const useSections = sectionLines >= 2;
  if (useSections) for (let i = Math.max(0, start - 4); i < start; i++) sectionPlan = planLine(lines[i].trim()) ?? sectionPlan;
  let pending = null; // code line still waiting for its credits
  let last = null; // last row added (for wrapped names)
  let group = null; // "สาระที่ 6 ภาษาและการสื่อสาร  2 หน่วยกิต" heading and how many rows followed it

  const resetRows = () => {
    pending = null;
    last = null;
  };
  const add = (target, code, name, credits, nameCol) => {
    if (!block.terms.has(target)) block.terms.set(target, []);
    const list = block.terms.get(target);
    const c = normCode(code);
    const n = cleanName(code, name) || group?.name || "รายวิชา";
    const placeholder = /x/.test(c);
    // placeholders repeat legitimately ("332-xxx วิชาเลือก" twice); a real code twice is a layout echo
    if (!placeholder && list.some((x) => x.code === c && x.name === n)) return null;
    const row = { code: c, name: n, credits, ...(placeholder ? { placeholder: true } : {}) };
    list.push(row);
    if (group) group.rows++;
    return { row, nameCol };
  };
  /** A group heading with credits but no rows under it is itself a row ("เลือก 1 วิชาจากสาระที่ 7"). */
  const flushGroup = () => {
    if (group && !group.rows && group.block) {
      const keep = block;
      block = group.block;
      add(group.term, "xxx-xxx", group.name, group.credits, 0);
      block = keep;
    }
    group = null;
  };

  for (let i = start; i < lines.length; i++) {
    const line = lines[i].replace(/\t/g, "    ");
    const trimmed = line.trim();
    if (!trimmed) continue;
    const { text: sk, map } = skeleton(line);
    const skt = sk.trim();

    if (i > start && END_SK.some((re) => re.test(skt))) break;

    const header = tableHeader(i);
    if (header !== undefined) {
      if ([...blocks.values()].some((b) => b.table === table)) {
        tables.push({ label: header });
        table = tables.length - 1;
      } else if (header) {
        tables[table].label = header;
      }
      flushGroup();
      year = null;
      block = null;
      term = null;
      twoColumn = null;
      sectionPlan = null;
      resetRows();
      continue;
    }

    // year heading (optionally with a term on the same line)
    const ym = skt.match(YEAR_SK);
    if (ym && (!ym[2] || YEAR_REST_SK.test(ym[2]))) {
      flushGroup();
      year = Number(ym[1]);
      const rest = trimmed.replace(/^[^\d]*\d\s*/, "");
      const own = /^\(?\s*ภาค/.test(rest) ? null : planSet(rest);
      // "ปีที่ 4 (ทั้ง 3 แขนง …)" / "(เรียนร่วมกัน…)": shared by every plan, whatever section came before
      const shared = !own && /ทั้ง|ร่วมกัน|ทุก/.test(rest);
      if (shared) sectionPlan = null;
      yearPlan = own ? withMajor(sectionPlan, own) : sectionPlan; // "แขนงวิชาไฟฟ้ากำลัง · ปกติ"
      plan = yearPlan;
      block = blockFor(year, plan);
      term = null;
      twoColumn = null;
      closed = false;
      pendingPlan = null;
      resetRows();
      const t = [...sk.matchAll(TERM_SK)];
      if (t.length === 1) term = termNo(t[0]);
      continue;
    }
    if (year == null) continue;

    const label = planLine(trimmed);
    if (label) {
      flushGroup();
      // followed directly by a term heading, it opens a new section rather than splitting this term
      let next = i + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      const nextSk = skeleton(lines[next] ?? "").text.trim();
      const startsSection = new RegExp(`^(?:${TERM_SK.source})`).test(nextSk);
      if (useSections && YEAR_SK.test(nextSk)) {
        // "3.1.1 แผนการศึกษาปกติ" / "ชั้นปีที่ 1" …: the plan of every year until the next such line
        sectionPlan = label;
        pendingPlan = null;
      } else if (term != null && !closed && !startsSection) {
        plan = withMajor(yearPlan, label); // switch inside the open term
        block = blockFor(year, plan);
      } else {
        pendingPlan = withMajor(yearPlan, label);
      }
      resetRows();
      continue;
    }

    // term heading(s)
    const hits = [...sk.matchAll(TERM_SK)];
    const atStart = hits.length && skt.indexOf(hits[0][0]) <= 2;
    // two terms side by side: "ภาคการศึกษาที่ 1        …        ภาคการศึกษาที่ 2" (not a sentence that
    // mentions two terms, e.g. "…ในภาคการศึกษาที่ 3 ของปีการศึกษาที่ 3")
    const twoCol = hits.length === 2 && atStart && /\s{8,}/.test(sk.slice(hits[0].index + hits[0][0].length, hits[1].index));
    const headingHit = twoCol || (hits.length === 1 && atStart);
    if (hits.length && headingHit) {
      flushGroup();
      if (pendingPlan) yearPlan = pendingPlan;
      pendingPlan = null;
      plan = yearPlan;
      // "ภาคการศึกษาที่ 2 (แผนทางเลือกฝึกงาน)" / "ภาคฤดูร้อน (สำหรับนักศึกษาทางเลือกโครงงาน)"
      // (also without parentheses: "ภาคการศึกษาที่ 1 สำหรับทางเลือกโครงงาน")
      const hint = trimmed.match(/\(?\s*((?:แผน|สำหรับ|ทางเลือก)[^()]*)\)?/);
      if (hint && planSet(hint[1])) plan = withMajor(yearPlan, planSet(hint[1]));
      block = blockFor(year, plan);
      const wasClosed = closed;
      closed = false;
      resetRows();
      if (twoCol) {
        const at = (h) => map[sk.indexOf(h[0], h.index)] ?? h.index;
        twoColumn = { split: at(hits[1]) - 25, left: termNo(hits[0]), right: termNo(hits[1]) };
        term = termNo(hits[0]);
      } else {
        twoColumn = null;
        const t = termNo(hits[0]);
        // the same term heading twice in a row within one year is a typo in the source
        // (FMS Accounting: co-op year 1 has "ภาคการศึกษาที่ 1" twice) — it's the next term
        // ("หรือ …" right above it means an alternative for the same term instead)
        let prev = i - 1;
        while (prev > 0 && !lines[prev].trim()) prev--;
        const alternative = /^หรือ/.test(lines[prev]?.trim() ?? "");
        term = wasClosed && !alternative && term === t && t < 3 && block.terms.has(t) ? t + 1 : t;
      }
      continue;
    }

    // totals
    if (TOTAL_LINE_SK.test(skt) || (/รวม/.test(skt) && !lineItems(line).length && [...sk.matchAll(TOTAL_SK)].length)) {
      flushGroup();
      const totals = [...sk.matchAll(TOTAL_SK)].map((m) => ({ n: Number(m[2] ?? m[1]), at: map[m.index] ?? m.index }));
      if (block && term != null && !closed && totals.length) {
        if (twoColumn) {
          for (const t of totals) block.declared.set(t.at >= twoColumn.split ? twoColumn.right : twoColumn.left, t.n);
        } else {
          block.declared.set(term, totals.at(-1).n);
        }
      }
      if (term != null) closed = true;
      resetRows();
      continue;
    }

    if (!block || term == null) continue;

    const items = lineItems(line);
    const noName = items.length ? null : line.match(ITEM_NONAME_RE);
    const codeOnly = items.length || noName ? null : line.match(CODE_LINE_RE);
    // "GE8 รายวิชาเลือก" under a "xxx-xxx รายวิชาหมวดวิชาศึกษาทั่วไป  2((x)-y-z)" row names that row
    if (codeOnly && /^GE/.test(codeOnly[1]) && last?.row.placeholder && !closed) {
      last.row.name = `${last.row.name} ${cleanName(codeOnly[1], codeOnly[2])}`;
      last = null;
      continue;
    }
    if ((items.length || noName || codeOnly) && closed) {
      if (!pendingPlan) continue;
      plan = pendingPlan; // a plan variant repeating the term that just closed
      pendingPlan = null;
      block = blockFor(year, plan);
      closed = false;
    }
    if (closed) continue;

    if (items.length) {
      pending = null;
      last = null;
      for (const m of items) {
        const target = twoColumn ? (m.index >= twoColumn.split ? twoColumn.right : twoColumn.left) : term;
        const nameCol = m.index + m[0].indexOf(m[2], m[1].length);
        last = add(target, m[1], m[2], cr(m[3]), nameCol) ?? last;
      }
      if (twoColumn) last = null;
      continue;
    }
    if (twoColumn) continue;

    if (noName) {
      pending = null;
      last = add(term, noName[1], group?.name ?? "รายวิชา", Number(noName[2]), 0);
      continue;
    }

    if (codeOnly && THAI_RE.test(codeOnly[2])) {
      pending = { code: codeOnly[1], name: codeOnly[2], nameCol: line.indexOf(codeOnly[2]) };
      last = null;
      continue;
    }

    // continuation lines (no code)
    if (!THAI_RE.test(trimmed) || /^(\*|หมายเหตุ|นักศึกษา|และ|หรือ)/.test(trimmed)) {
      if (/^(\*|หมายเหตุ)/.test(trimmed)) resetRows();
      continue;
    }
    const cont = line.match(CONT_ITEM_RE);
    if (pending) {
      if (cont) {
        last = add(term, pending.code, `${pending.name} ${cont[1]}`, cr(cont[2]), pending.nameCol);
      } else if (!last) {
        pending.name = `${pending.name} ${trimmed}`;
      }
      continue;
    }
    const grp = line.match(GROUP_RE);
    if (grp && !/^(รวม|จำนวน|จํานวน)/.test(grp[1])) {
      flushGroup();
      group = { name: grp[1].replace(/\s*\*+$/, "").replace(/\s+/g, " "), credits: cr(grp[2]), rows: 0, block, term };
      last = null;
      continue;
    }
    if (last && !cont) {
      const indent = line.length - line.trimStart().length;
      if (indent >= last.nameCol - 3 || last.row.placeholder) last.row.name = `${last.row.name} ${trimmed.replace(/\s+/g, " ")}`;
      last = null;
    }
  }

  flushGroup();

  // results
  const out = resolvePlans([...blocks.values()].filter((b) => b.terms.size > 0), tables);
  const hasSibling = (b, t) =>
    out.some((o) => o !== b && o.year === b.year && o.terms.has(t) && (!o.plan || !b.plan));
  const years = out
    .sort((a, b) => a.year - b.year || (a.plan ?? "").localeCompare(b.plan ?? "", "th"))
    .map((b) => ({
      year: b.year,
      ...(b.plan ? { plan: b.plan } : {}),
      terms: [...b.terms.entries()]
        .sort((a, c) => a[0] - c[0])
        .map(([t, courses]) => {
          const sum = courses.reduce((n, c) => n + c.credits, 0);
          const declared = b.declared.get(t);
          let credits = sum;
          if (declared != null && declared < sum) credits = declared;
          if (declared != null && declared > sum && !hasSibling(b, t)) {
            warnings.push(`ปี ${b.year}${b.plan ? ` (${b.plan})` : ""} ภาค ${t}: แผนระบุรวม ${declared} แต่อ่านรายวิชาได้ ${sum}`);
          }
          return { term: t, credits, courses };
        })
        .filter((t) => {
          if (t.credits <= 30) return true;
          warnings.push(`ตัดปี ${b.year} ภาค ${t.term} ทิ้ง (${t.courses.length} วิชา ${t.credits} หน่วยกิต — น่าจะเป็นรายการวิชาเลือก ไม่ใช่ภาคการศึกษา)`);
          return false;
        }),
    }))
    .filter((y) => y.terms.length);
  return { years, warnings };
}

/**
 * Turn raw block plans into the shape the app reads ("a year without `plan` applies to every plan"):
 *   - "a|b" (from "…aและb…") is shared by a and b when both exist as plans on their own, else it is
 *     one plan named "aและb";
 *   - a major-level year ("วิศวกรรมวัสดุ") is copied into each of that major's tracks
 *     ("วิศวกรรมวัสดุ · โครงงาน", "วิศวกรรมวัสดุ · สหกิจศึกษา");
 *   - with several plan tables, shared years get their own table's plan(s) so tables don't mix;
 *   - a document with a single plan name ends up with no plan names at all.
 */
function resolvePlans(blocks, tables) {
  const usedTables = [...new Set(blocks.map((b) => b.table))];
  const multiTable = usedTables.length > 1;
  const singles = new Set(blocks.filter((b) => b.plan && !b.plan.includes("|")).map((b) => b.plan));
  const known = (p) => singles.has(p) || [...singles].some((s) => s.endsWith(` · ${p}`) || s.startsWith(`${p} · `));
  const children = (p) => [...singles].filter((s) => s.startsWith(`${p} · `));
  // first pass: what each block's plan list really is
  const planned = blocks.map((b) => {
    let plans = [b.plan];
    if (b.plan?.includes("|")) {
      const parts = b.plan.split("|");
      if (parts.every(known)) plans = parts;
      // "โครงงานและสหกิจ" in a document whose tracks are "ฝึกงาน" / "สหกิจ": shared by every track
      else if (parts.some(known)) plans = [null];
      else plans = [parts.join("และ")];
    }
    plans = plans.flatMap((p) => (p && children(p).length ? children(p) : [p]));
    return { b, plans };
  });
  const resolved = new Map();
  const put = (b, plan) => {
    const key = `${b.year}|${plan ?? ""}`;
    let r = resolved.get(key);
    if (!r) resolved.set(key, (r = { table: b.table, year: b.year, plan, terms: new Map(), declared: new Map() }));
    for (const [t, courses] of b.terms) r.terms.set(t, [...(r.terms.get(t) ?? []), ...courses]);
    for (const [t, d] of b.declared) r.declared.set(t, Math.max(d, r.declared.get(t) ?? 0));
  };
  usedTables.forEach((ti, n) => {
    const own = planned.filter((x) => x.b.table === ti);
    const variants = [...new Set(own.flatMap((x) => x.plans.filter(Boolean)))];
    const label = multiTable ? tables[ti].label : null; // "4+0" → "4+0 · ปกติ"
    const named = (p) => (label ? `${label} · ${p}` : p);
    const fallback = label ?? (n === 0 ? "ปกติ" : `แผน ${n + 1}`);
    for (const { b, plans } of own) {
      if (plans[0] != null) plans.forEach((p) => put(b, named(p)));
      else if (!multiTable) put(b, null);
      else if (variants.length) variants.forEach((v) => put(b, named(v)));
      else put(b, fallback);
    }
  });
  let out = [...resolved.values()];
  const names = new Set(out.map((b) => b.plan).filter(Boolean));
  if (names.size === 1 && !out.some((b) => !b.plan)) {
    // one plan name for the whole document is just a title, not a choice
    const merged = new Map();
    for (const b of out) {
      const key = `${b.year}`;
      if (!merged.has(key)) merged.set(key, { ...b, plan: null });
    }
    out = [...merged.values()];
  }
  return out;
}

/** The document's own "จำนวนหน่วยกิตรวมตลอดหลักสูตร (ไม่น้อยกว่า) N หน่วยกิต", if it states one. */
export function statedTotal(lines) {
  // only before the plan: appendices compare old vs new curricula and repeat the phrase
  const end = findStart(lines);
  for (let i = 0; i < (end < 0 ? lines.length : end); i++) {
    const sk = skeleton(`${lines[i]} ${lines[i + 1] ?? ""}`).text;
    const m = sk.match(/หนวยกตรวมตลอดหลกสตร(?:\s*[^\d\s]{0,12}\s*)(\d{3})(?!\d)/);
    if (m && Number(m[1]) >= 90 && Number(m[1]) <= 200) return Number(m[1]);
  }
  return null;
}

/** Credits per plan variant (a plan-less year applies to every plan — the app reads it the same way). */
export function planTotals(years) {
  const plans = [...new Set(years.map((y) => y.plan).filter(Boolean))];
  return (plans.length ? plans : [null]).map((plan) => ({
    plan,
    credits: years
      .filter((y) => !y.plan || !plan || y.plan === plan)
      .reduce((n, y) => n + y.terms.reduce((m, t) => m + t.credits, 0), 0),
  }));
}
