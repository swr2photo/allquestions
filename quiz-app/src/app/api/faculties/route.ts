import { NextRequest, NextResponse } from "next/server";
import { loadCurriculaIndex, loadCurriculumFile, loadTermData } from "@/lib/term-data.server";
import { classifyCourse, isCatalogTerm, type GeKey } from "@/lib/ge";
import { normalizeQuery, type CurriculumProgram, type TermData } from "@/lib/timetable";

export const dynamic = "force-dynamic";

export interface FacultyProgram {
  id: string;
  name: string;
  division: string;
  editions: number[];
  /** credits per edition from the study plan */
  credits: Record<number, number>;
}

export interface FacultySummary {
  key: string;
  name: string;
  campus: string;
  courses: number;
  sections: number;
  geCourses: number;
  depts: { name: string; courses: number }[];
  curriculumId?: string;
  programs: FacultyProgram[];
}

export interface FacultyCourse {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  creditNum: number;
  dept: string;
  faculty: string;
  campus: string;
  sections: number;
  ge: GeKey[];
}

const facultyKey = (campus: string, name: string) => `${campus}|${name}`;

function programSummary(p: CurriculumProgram): FacultyProgram {
  const credits: Record<number, number> = {};
  for (const e of p.editions) {
    // credits of the first plan only (plans repeat the shared years)
    const firstPlan = e.years.find((y) => y.plan)?.plan;
    // appendix course lists are imported as fake terms — leave them out of the total
    credits[e.curriculumYear] = e.years
      .filter((y) => !y.plan || y.plan === firstPlan)
      .reduce((n, y) => n + y.terms.filter((t) => !isCatalogTerm(t)).reduce((m, t) => m + t.credits, 0), 0);
  }
  return { id: p.id, name: p.name, division: p.division, editions: p.editions.map((e) => e.curriculumYear), credits };
}

async function summaries(term: TermData, origin: string): Promise<FacultySummary[]> {
  const map = new Map<string, FacultySummary & { deptMap: Map<string, number> }>();
  for (const c of term.courses) {
    if (!c.faculty) continue;
    const key = facultyKey(c.campus, c.faculty);
    let f = map.get(key);
    if (!f) {
      f = { key, name: c.faculty, campus: c.campus, courses: 0, sections: 0, geCourses: 0, depts: [], programs: [], deptMap: new Map() };
      map.set(key, f);
    }
    f.courses++;
    f.sections += c.sections.length;
    if (classifyCourse(c)) f.geCourses++;
    const dept = c.dept || "ไม่ระบุสาขา";
    f.deptMap.set(dept, (f.deptMap.get(dept) ?? 0) + 1);
  }

  const curricula = await loadCurriculaIndex(origin);
  for (const entry of curricula.faculties) {
    const f = map.get(facultyKey(entry.campus, entry.faculty));
    if (!f) continue;
    try {
      const file = await loadCurriculumFile(entry.file, origin);
      f.curriculumId = entry.id;
      f.programs = file.programs.map(programSummary);
    } catch {
      /* study plan file missing — faculty still listed */
    }
  }

  return [...map.values()]
    .map(({ deptMap, ...f }) => ({
      ...f,
      depts: [...deptMap.entries()].map(([name, courses]) => ({ name, courses })).sort((a, b) => b.courses - a.courses),
    }))
    .sort((a, b) => a.campus.localeCompare(b.campus, "th") || b.courses - a.courses);
}

function toCourse(c: TermData["courses"][number]): FacultyCourse {
  return {
    id: c.id,
    code: c.code,
    nameTh: c.nameTh,
    nameEn: c.nameEn,
    creditNum: c.creditNum,
    dept: c.dept,
    faculty: c.faculty,
    campus: c.campus,
    sections: c.sections.length,
    ge: classifyCourse(c)?.levels ?? [],
  };
}

// GET /api/faculties                       → every faculty (per campus) with departments + study plans
// GET /api/faculties?faculty=…&campus=…    → that faculty's courses this term
// GET /api/faculties?q=…                   → search faculties / departments / programs / courses
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const origin = request.nextUrl.origin;
  try {
    const term = await loadTermData(origin, sp.get("term"));
    if (!term) return NextResponse.json({ error: "ไม่พบข้อมูลภาคการศึกษา" }, { status: 404 });
    const termInfo = { id: term.id, label: term.label, year: term.year, term: term.term };
    const headers = { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" };

    const faculty = sp.get("faculty");
    if (faculty) {
      const campus = sp.get("campus");
      const courses = term.courses
        .filter((c) => c.faculty === faculty && (!campus || c.campus === campus))
        .map(toCourse)
        .sort((a, b) => a.dept.localeCompare(b.dept, "th") || a.code.localeCompare(b.code));
      return NextResponse.json({ term: termInfo, courses }, { headers });
    }

    const list = await summaries(term, origin);
    const q = normalizeQuery(sp.get("q") ?? "");
    if (!q) return NextResponse.json({ term: termInfo, faculties: list }, { headers });

    const has = (s: string) => normalizeQuery(s).includes(q);
    const faculties = list.filter((f) => has(f.name) || has(f.campus));
    const depts = list.flatMap((f) =>
      f.depts.filter((d) => has(d.name)).map((d) => ({ ...d, faculty: f.name, campus: f.campus, key: f.key }))
    );
    const programs = list.flatMap((f) =>
      f.programs
        .filter((p) => has(p.name) || has(p.division))
        .map((p) => ({ ...p, faculty: f.name, campus: f.campus, key: f.key, curriculumId: f.curriculumId }))
    );
    const courses = term.courses
      .filter((c) => has(`${c.code} ${c.nameTh} ${c.nameEn}`))
      .slice(0, 60)
      .map(toCourse);
    return NextResponse.json({ term: termInfo, faculties, depts: depts.slice(0, 60), programs, courses }, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: "โหลดข้อมูลคณะไม่สำเร็จ", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
