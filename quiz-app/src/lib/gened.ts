// Fetches general-education course data from gened.psu.ac.th (WordPress REST API)
// and normalizes it into a shape that is convenient for the UI.
//
// In-memory cache keeps the upstream load light. TTL 6h is acceptable: the
// upstream site rarely publishes new courses mid-semester.

const GENED_BASE = "https://gened.psu.ac.th/wp-json/wp/v2";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_POSTS = 800;
const MAX_CATEGORY_PAGES = 5;

export interface GenedCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
  // Derived display helpers
  geLevel?: string; // e.g. "GE1", "GE2A", ..., "GE8", "elective"
  campus?: string; // e.g. "หาดใหญ่", "ปัตตานี"
  /** GE8 sub-group, e.g. "ภาษา", "สุนทรียศาสตร์และกีฬา" */
  ge8Group?: string;
  /** SDG number for "SDGs-N" categories */
  sdg?: number;
  /** pre-2565 curriculum learning area ("สาระที่ N") */
  legacyArea?: number;
}

export interface GenedCourse {
  id: number;
  title: string;
  slug: string;
  link: string;
  categories: number[];
  // Derived helpers
  /** SIS course code ("942-222") when the post slug carries one */
  code: string | null;
  courseCode: string | null;
  geLevels: string[];
  campuses: string[];
  ge8Groups: string[];
  sdgs: number[];
  /** pre-2565 curriculum learning areas ("สาระที่ 1–7"); these posts have no GE1–GE8 level */
  legacyAreas: number[];
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

let categoriesCache: CacheEntry<GenedCategory[]> | null = null;
let coursesCache: CacheEntry<GenedCourse[]> | null = null;

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return !!entry && Date.now() < entry.expiresAt;
}

function parseGeLevel(name: string): string | undefined {
  // Match GE1..GE8, GE2A, GE2B etc. and pure "GE 1 หาดใหญ่" type names
  const m = name.match(/GE\s*([0-9]+[AB]?)/i);
  if (m) return `GE${m[1].toUpperCase()}`;
  if (/รายวิชาเลือก/.test(name)) return "elective";
  return undefined;
}

function parseCampus(name: string): string | undefined {
  const campuses = ["หาดใหญ่", "ปัตตานี", "ภูเก็ต", "สุราษฎร์ธานี", "ตรัง", "Hatyai"];
  for (const c of campuses) {
    if (name.includes(c)) return c === "Hatyai" ? "หาดใหญ่" : c;
  }
  return undefined;
}

/** pre-2565 curriculum: "สาระที่ 6 ภาษาและการสื่อสาร" → 6 */
function parseLegacyArea(name: string): number | undefined {
  const m = name.match(/^สาระที่\s*(\d)/);
  return m ? Number(m[1]) : undefined;
}

function parseGe8Group(name: string): string | undefined {
  const m = name.match(/^GE\s*8\s+(.+)$/i);
  if (!m) return undefined;
  const g = m[1].trim();
  if (parseCampus(g)) return undefined; // "GE8 Hatyai" is a campus bucket, not a sub-group
  if (/บังคับเลือกภาษา/.test(g)) return "บังคับเลือกภาษาเพิ่ม";
  if (/^ภาษา/.test(g)) return "ภาษา";
  if (/สุนทรีย/.test(g)) return "สุนทรียศาสตร์และกีฬา";
  if (/มนุษย|สังคม|วิทย์/.test(g)) return "มนุษยศาสตร์/สังคมศาสตร์/วิทย์ฯ";
  return g;
}

function parseSdg(name: string): number | undefined {
  const m = name.match(/^SDGs?-(\d{1,2})$/i);
  return m ? Number(m[1]) : undefined;
}

function parseCourseCode(title: string): string | null {
  // Typical titles: "GE7-มนุษยชาติกับสิ่งแวดล้อม" or slugs like 895-178g7
  const m = title.match(/GE[0-9][A-Z]?/i);
  return m ? m[0].toUpperCase() : null;
}

/** WordPress de-duplicates slugs with "-2", so "941-275-2-2" → "941-275" */
function codeFromSlug(slug: string): string | null {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    /* keep raw slug */
  }
  const m = s.match(/^(\d{3})-?(\d{3})(?![0-9])/);
  return m ? `${m[1]}-${m[2]}` : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "—")
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Next.js-aware cache; re-fetched on our own TTL anyway
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json() as Promise<T>;
}

interface RawCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
}

interface RawPost {
  id: number;
  slug: string;
  link: string;
  categories: number[];
  title: { rendered: string };
}

export async function getGenedCategories(force = false): Promise<GenedCategory[]> {
  if (!force && isFresh(categoriesCache)) return categoriesCache.data;

  // The site has >100 categories — read every page, otherwise courses filed
  // under the later categories lose their GE level.
  const raw: RawCategory[] = [];
  for (let page = 1; page <= MAX_CATEGORY_PAGES; page++) {
    let batch: RawCategory[];
    try {
      batch = await fetchJson<RawCategory[]>(`${GENED_BASE}/categories?per_page=100&page=${page}`);
    } catch (e) {
      if (page === 1) throw e;
      break;
    }
    raw.push(...batch);
    if (batch.length < 100) break;
  }

  const categories: GenedCategory[] = raw.map((c) => {
    const name = decodeHtmlEntities(c.name).trim();
    return {
      id: c.id,
      name,
      slug: c.slug,
      parent: c.parent,
      count: c.count,
      geLevel: parseGeLevel(name),
      campus: parseCampus(name),
      ge8Group: parseGe8Group(name),
      sdg: parseSdg(name),
      legacyArea: parseLegacyArea(name),
    };
  });

  categoriesCache = { data: categories, expiresAt: Date.now() + CACHE_TTL_MS };
  return categories;
}

export async function getGenedCourses(force = false): Promise<GenedCourse[]> {
  if (!force && isFresh(coursesCache)) return coursesCache.data;

  const all: RawPost[] = [];
  const perPage = 100;
  for (let page = 1; page <= Math.ceil(MAX_POSTS / perPage); page++) {
    const url = `${GENED_BASE}/posts?per_page=${perPage}&page=${page}&_fields=id,slug,link,categories,title`;
    let batch: RawPost[];
    try {
      batch = await fetchJson<RawPost[]>(url);
    } catch {
      // WP returns 400 once we run past the last page — treat as end of list
      break;
    }
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < perPage) break;
  }

  // Need categories to derive GE levels / campus
  const cats = await getGenedCategories(force);
  const catMap = new Map(cats.map((c) => [c.id, c]));

  // walk up the category tree so a post filed only under a child ("GE 8 ภาษา")
  // still inherits the campus from its parent ("รายวิชาเลือก-หาดใหญ่")
  const lineage = (c: GenedCategory): GenedCategory[] => {
    const out: GenedCategory[] = [];
    let cur: GenedCategory | undefined = c;
    for (let i = 0; cur && i < 6; i++) {
      out.push(cur);
      cur = cur.parent ? catMap.get(cur.parent) : undefined;
    }
    return out;
  };

  const courses: GenedCourse[] = all.map((p) => {
    const title = decodeHtmlEntities(p.title.rendered).trim();
    const own = p.categories.map((id) => catMap.get(id)).filter(Boolean) as GenedCategory[];
    const catObjs = own.flatMap(lineage);
    const levels = new Set(own.map((c) => c.geLevel).filter(Boolean) as string[]);
    // "รายวิชาเลือก" (electives) are the GE8 pool on the gened site
    if (levels.has("elective")) {
      levels.delete("elective");
      if (![...levels].some((l) => l.startsWith("GE"))) levels.add("GE8");
    }
    // inherit a level from the parent chain only when the post has none of its own
    if (!levels.size) {
      catObjs.forEach((c) => {
        if (c.geLevel === "elective") levels.add("GE8");
        else if (c.geLevel) levels.add(c.geLevel);
      });
    }
    const campuses = Array.from(new Set(catObjs.map((c) => c.campus).filter(Boolean) as string[]));
    const ge8Groups = Array.from(new Set(own.map((c) => c.ge8Group).filter(Boolean) as string[]));
    const sdgs = Array.from(
      new Set(own.map((c) => c.sdg).filter((n): n is number => typeof n === "number"))
    ).sort((a, b) => a - b);
    const legacyAreas = Array.from(
      new Set(own.map((c) => c.legacyArea).filter((n): n is number => typeof n === "number"))
    ).sort((a, b) => a - b);
    return {
      id: p.id,
      title,
      slug: p.slug,
      link: p.link,
      categories: p.categories,
      code: codeFromSlug(p.slug),
      courseCode: parseCourseCode(title),
      geLevels: Array.from(levels),
      campuses,
      ge8Groups,
      sdgs,
      legacyAreas,
    };
  });

  coursesCache = { data: courses, expiresAt: Date.now() + CACHE_TTL_MS };
  return courses;
}

export function invalidateGenedCache(): void {
  categoriesCache = null;
  coursesCache = null;
}

export interface GenedSummary {
  totalCourses: number;
  byGeLevel: Record<string, number>;
  byCampus: Record<string, number>;
  byGe8Group: Record<string, number>;
  bySdg: Record<string, number>;
  legacy: number;
}

export function summarizeCourses(courses: GenedCourse[]): GenedSummary {
  const byGeLevel: Record<string, number> = {};
  const byCampus: Record<string, number> = {};
  const byGe8Group: Record<string, number> = {};
  const bySdg: Record<string, number> = {};
  let legacy = 0;
  for (const c of courses) {
    for (const g of c.geLevels) byGeLevel[g] = (byGeLevel[g] || 0) + 1;
    for (const camp of c.campuses) byCampus[camp] = (byCampus[camp] || 0) + 1;
    for (const g of c.ge8Groups) byGe8Group[g] = (byGe8Group[g] || 0) + 1;
    for (const s of c.sdgs) bySdg[s] = (bySdg[s] || 0) + 1;
    if (c.legacyAreas.length && !c.geLevels.length) legacy++;
  }
  return { totalCourses: courses.length, byGeLevel, byCampus, byGe8Group, bySdg, legacy };
}
