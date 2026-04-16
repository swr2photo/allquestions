// Fetches general-education course data from gened.psu.ac.th (WordPress REST API)
// and normalizes it into a shape that is convenient for the UI.
//
// In-memory cache keeps the upstream load light. TTL 6h is acceptable: the
// upstream site rarely publishes new courses mid-semester.

const GENED_BASE = "https://gened.psu.ac.th/wp-json/wp/v2";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_POSTS = 500;

export interface GenedCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
  // Derived display helpers
  geLevel?: string;  // e.g. "GE1", "GE2", ..., "GE8", "elective"
  campus?: string;   // e.g. "หาดใหญ่", "ปัตตานี"
}

export interface GenedCourse {
  id: number;
  title: string;
  slug: string;
  link: string;
  categories: number[];
  // Derived helpers
  courseCode: string | null;
  geLevels: string[];
  campuses: string[];
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
  const m = name.match(/GE\s*([0-9]+[A-Z]?)/i);
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

function parseCourseCode(title: string): string | null {
  // Typical titles: "GE7-มนุษยชาติกับสิ่งแวดล้อม" or slugs like 895-178g7
  // We return the GE-prefix + any digit/code portion. Upstream has many shapes.
  const m = title.match(/GE[0-9][A-Z]?/i);
  return m ? m[0].toUpperCase() : null;
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
    headers: { "Accept": "application/json" },
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

  const raw = await fetchJson<RawCategory[]>(`${GENED_BASE}/categories?per_page=100`);
  const categories: GenedCategory[] = raw.map((c) => ({
    id: c.id,
    name: decodeHtmlEntities(c.name).trim(),
    slug: c.slug,
    parent: c.parent,
    count: c.count,
    geLevel: parseGeLevel(c.name),
    campus: parseCampus(c.name),
  }));

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

  const courses: GenedCourse[] = all.map((p) => {
    const title = decodeHtmlEntities(p.title.rendered).trim();
    const catObjs = p.categories.map((id) => catMap.get(id)).filter(Boolean) as GenedCategory[];
    const geLevels = Array.from(new Set(catObjs.map((c) => c.geLevel).filter(Boolean) as string[]));
    const campuses = Array.from(new Set(catObjs.map((c) => c.campus).filter(Boolean) as string[]));
    return {
      id: p.id,
      title,
      slug: p.slug,
      link: p.link,
      categories: p.categories,
      courseCode: parseCourseCode(title),
      geLevels,
      campuses,
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
}

export function summarizeCourses(courses: GenedCourse[]): GenedSummary {
  const byGeLevel: Record<string, number> = {};
  const byCampus: Record<string, number> = {};
  for (const c of courses) {
    for (const g of c.geLevels) byGeLevel[g] = (byGeLevel[g] || 0) + 1;
    for (const camp of c.campuses) byCampus[camp] = (byCampus[camp] || 0) + 1;
  }
  return { totalCourses: courses.length, byGeLevel, byCampus };
}
