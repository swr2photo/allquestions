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
 *   - "รวม 18((x)-y-z)" / "หน่วยกิตรวม 17" totals: used as the term's credits when they are lower
 *     than the rows' sum (alternatives such as "เลือกเรียน 1 วิชา" are listed with their own credits).
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
const CREDITS_SRC = String.raw`(\d{1,2})\s*(?=\(|$|\s{2,})`;
const ITEM_RE = new RegExp(`(?<![\\w-])(${CODE_SRC})\\**\\s+(\\S.*?)\\s{2,}${CREDITS_SRC}`, "g");
// credits immediately followed by "(" — preferred, so a name ending in "  1" isn't read as 1 credit
// (one space is enough before credits written like "3((2)-3-4)" / "1(0-3-0)" / "3(x-y-z)")
const ITEM_STRICT_RE = new RegExp(`(?<![\\w-])(${CODE_SRC})\\**\\s+(\\S.*?)\\s+(\\d{1,2})(?=\\((?:\\(|\\d|x|X))`, "g");

/** Rows on a line: strict matches, plus loose ones that don't overlap them (two-column layouts). */
function lineItems(line) {
  const strict = [...line.matchAll(ITEM_STRICT_RE)];
  const loose = [...line.matchAll(ITEM_RE)].filter(
    (l) => !strict.some((s) => l.index < s.index + s[0].length && s.index < l.index + l[0].length)
  );
  return [...strict, ...loose].sort((a, b) => a.index - b.index);
}
const CODE_LINE_RE = new RegExp(`^\\s*(${CODE_SRC})\\**\\s+(\\S.*?)\\s*$`);
const CONT_ITEM_RE = new RegExp(`^\\s*(\\S.*?)\\s{2,}${CREDITS_SRC}`);

// on the skeleton
const YEAR_SK = /^(?:ชน)?ปท\s*([1-8])(?:\s+(.*))?$/;
/** what may follow "ชั้นปีที่ n" on a heading line: a plan, a term, "ทุกแผน…", "สำหรับ…" */
const YEAR_REST_SK = /^(?:\(|แผน|ภาค|ทกแผน|ส[ำา]?หรบ)/;
const TERM_SK = /(?:ภาค)?(?:การศกษา|เรยน)\s*ท\s*([1-3])|ภาค(?:การศกษา)?ฤดรอน/g;
const TOTAL_SK = /รวม(?:ทงสน)?\s*(\d{1,3})(?=\s*(?:\(|$|\s|หนวยกต))/g;
const TOTAL_LINE_SK = /^(?:หนวยกต)?รวม/;
const PLAN_HEADER_SK = /^(?:\d+\.\s*)?แผนการศกษา(?:ตลอดหลกสตร)?\s*(?:\(|ส[ำา]?หรบ|$)/;
const END_SK = [
  /^หมวดท\s*\d/,
  /^(?:\d+(?:\.\d+)*\.?|[ก-ฮ]\.)?\s*\S*อธบายรายวชา/,
  /^ภาคผนวก/,
];

function termNo(m) {
  return m[1] ? Number(m[1]) : 3;
}

/** "แผนการศึกษาปกติ" / "สหกิจ" / "การสหกิจศึกษา" / "แบบโครงงาน" → "ปกติ" / "สหกิจศึกษา" / … */
export function planLabel(raw) {
  if (!raw) return null;
  let text = raw.replace(/[()*]/g, " ").replace(/\s+/g, " ").trim();
  if (/ทุกแผน/.test(text)) return null;
  text = text.replace(/^แผน\s*\d+\s*[-–—.:]*\s*/, "แผน"); // "แผน 2--- วิจัย"
  // co-op variants differ by length: "สหกิจศึกษา 1 ภาคการศึกษา" vs "… 2 ภาคการศึกษา" / "… 1 ปี"
  const dur = text.match(/(\d)\s*(ภาค|ปี)/);
  text = text.replace(/\s*แบบ\s*\d.*$/, "").replace(/^แผน/, "").replace(/^การศึกษา/, "").replace(/^แบบ/, "").replace(/^แผน/, "").trim();
  if (/^(?:การ)?สหกิจ/.test(text)) return dur ? `สหกิจศึกษา ${dur[1]} ${dur[2]}` : "สหกิจศึกษา";
  if (!/^[ก-๙ ]{2,30}$/.test(text) || /^(สำหรับ|ตลอด|หน่วยกิต|หลักสูตร)/.test(text) || /หลักสูตร|หน่วยกิต/.test(text)) return null;
  return text;
}

/** "แผนการศึกษาปกติ และแผนการศึกษาสหกิจศึกษา 1 ภาคการศึกษา" → "ปกติ|สหกิจศึกษา 1 ภาค" (expanded at the end). */
export function planSet(raw) {
  if (!raw) return null;
  const parts = raw.split(/\s+และ\s*|\s*,\s*/).map(planLabel);
  if (parts.some((p) => !p)) return parts.length === 1 ? null : planLabel(raw);
  return [...new Set(parts)].join("|");
}

/** Label of a whole plan table: "(แผนสหกิจศึกษา 1 ปี)" → "สหกิจศึกษา 1 ปี", "สำหรับหลักสูตรปกติ" → "ปกติ". */
function tableLabel(raw) {
  let t = raw.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/^ส[ำา]?หรับ\s*/, "").replace(/^หลักสูตร\s*/, "").replace(/^แผน\s*/, "").replace(/^การศึกษา\s*/, "").trim();
  if (!t || /หรือ|ทุกแผน/.test(t)) return null;
  if (/^(?:การ)?สหกิจ/.test(t) && !/\d/.test(t)) return "สหกิจศึกษา";
  return /^[ก-๙0-9 .]{2,40}$/.test(t) ? t : null;
}

/** A line that only names a plan variant: "แผนการศึกษาปกติ", "(แผนสหกิจศึกษา)", "แผนสหกิจ (แบบ 1 ภาค…)". */
function planLine(trimmed) {
  if (trimmed.length > 80) return null;
  const t = trimmed.replace(/^\((.*)\)$/, "$1").trim();
  if (!/^แผน/.test(t) || /\d{3}-/.test(t)) return null;
  return planSet(t);
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
  let pending = null; // code line still waiting for its credits
  let last = null; // last row added (for wrapped names)

  const resetRows = () => {
    pending = null;
    last = null;
  };
  const add = (target, code, name, credits, nameCol) => {
    if (!block.terms.has(target)) block.terms.set(target, []);
    const list = block.terms.get(target);
    const c = normCode(code);
    const n = cleanName(code, name);
    const placeholder = /x/.test(c);
    // placeholders repeat legitimately ("332-xxx วิชาเลือก" twice); a real code twice is a layout echo
    if (!placeholder && list.some((x) => x.code === c && x.name === n)) return null;
    const row = { code: c, name: n, credits, ...(placeholder ? { placeholder: true } : {}) };
    list.push(row);
    return { row, nameCol };
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
      year = null;
      block = null;
      term = null;
      twoColumn = null;
      resetRows();
      continue;
    }

    // year heading (optionally with a term on the same line)
    const ym = skt.match(YEAR_SK);
    if (ym && (!ym[2] || YEAR_REST_SK.test(ym[2]))) {
      year = Number(ym[1]);
      const rest = trimmed.replace(/^[^\d]*\d\s*/, "");
      yearPlan = /^\(?\s*ภาค/.test(rest) ? null : planSet(rest);
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
      if (term != null && !closed) {
        plan = label; // switch inside the open term
        block = blockFor(year, plan);
      } else {
        pendingPlan = label;
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
      if (pendingPlan) yearPlan = pendingPlan;
      pendingPlan = null;
      plan = yearPlan;
      const hint = trimmed.match(/\(\s*(แผน[^()]*)\)/);
      if (hint && planSet(hint[1])) plan = planSet(hint[1]);
      block = blockFor(year, plan);
      closed = false;
      resetRows();
      if (twoCol) {
        const at = (h) => map[sk.indexOf(h[0], h.index)] ?? h.index;
        twoColumn = { split: at(hits[1]) - 25, left: termNo(hits[0]), right: termNo(hits[1]) };
        term = termNo(hits[0]);
      } else {
        twoColumn = null;
        term = termNo(hits[0]);
      }
      continue;
    }

    // totals
    if (TOTAL_LINE_SK.test(skt) || (/รวม/.test(skt) && !lineItems(line).length && [...sk.matchAll(TOTAL_SK)].length)) {
      const totals = [...sk.matchAll(TOTAL_SK)].map((m) => ({ n: Number(m[1]), at: map[m.index] ?? m.index }));
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
    const codeOnly = items.length ? null : line.match(CODE_LINE_RE);
    // "GE8 รายวิชาเลือก" under a "xxx-xxx รายวิชาหมวดวิชาศึกษาทั่วไป  2((x)-y-z)" row names that row
    if (codeOnly && /^GE/.test(codeOnly[1]) && last?.row.placeholder && !closed) {
      last.row.name = `${last.row.name} ${cleanName(codeOnly[1], codeOnly[2])}`;
      last = null;
      continue;
    }
    if ((items.length || codeOnly) && closed) {
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
        last = add(target, m[1], m[2], Number(m[3]), nameCol) ?? last;
      }
      if (twoColumn) last = null;
      continue;
    }
    if (twoColumn) continue;

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
        last = add(term, pending.code, `${pending.name} ${cont[1]}`, Number(cont[2]), pending.nameCol);
      } else if (!last) {
        pending.name = `${pending.name} ${trimmed}`;
      }
      continue;
    }
    if (last && !cont) {
      const indent = line.length - line.trimStart().length;
      if (indent >= last.nameCol - 3 || last.row.placeholder) last.row.name = `${last.row.name} ${trimmed.replace(/\s+/g, " ")}`;
      last = null;
    }
  }

  // results
  let out = [...blocks.values()].filter((b) => b.terms.size > 0);
  const usedTables = [...new Set(out.map((b) => b.table))];
  const multiTable = usedTables.length > 1;
  if (multiTable || out.some((b) => b.plan?.includes("|"))) {
    // Expand "ปกติ|สหกิจศึกษา 1 ภาค" blocks into each plan. With several tables, also give every
    // shared year its own table's plan(s), so "a plan-less year applies to every plan" (how the app
    // reads it) can't mix tables.
    const resolved = new Map();
    const put = (b, plan) => {
      const key = `${b.year}|${plan ?? ""}`;
      let r = resolved.get(key);
      if (!r) resolved.set(key, (r = { table: b.table, year: b.year, plan, terms: new Map(), declared: new Map() }));
      for (const [t, courses] of b.terms) r.terms.set(t, [...(r.terms.get(t) ?? []), ...courses]);
      for (const [t, d] of b.declared) r.declared.set(t, Math.max(d, r.declared.get(t) ?? 0));
    };
    usedTables.forEach((ti, n) => {
      const own = out.filter((b) => b.table === ti);
      const variants = [...new Set(own.flatMap((b) => b.plan?.split("|") ?? []))];
      const fallback = tables[ti].label ?? (n === 0 ? "ปกติ" : `แผน ${n + 1}`);
      for (const b of own) {
        if (b.plan) b.plan.split("|").forEach((p) => put(b, p));
        else if (!multiTable) put(b, null);
        else if (variants.length && !tables[ti].label) variants.forEach((v) => put(b, v));
        else put(b, fallback);
      }
    });
    out = [...resolved.values()];
  }
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
