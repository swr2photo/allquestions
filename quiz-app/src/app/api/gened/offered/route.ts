import { NextRequest, NextResponse } from "next/server";
import { getGenedCourses } from "@/lib/gened";
import { buildGeIndex, classifyCourse, type GeKey } from "@/lib/ge";
import { loadTermData } from "@/lib/term-data.server";

export const dynamic = "force-dynamic";

export interface OfferedCourse {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  creditNum: number;
  campus: string;
  faculty: string;
  ge: GeKey[];
  ge8Groups: string[];
  sdgs: number[];
  source: string;
  link?: string;
  sections: number;
  seats: number | null;
  /** "จ. 13:00–15:50 · ONLINE" of the first section, for the card */
  firstSlot: string;
  online: boolean;
}

// GET /api/gened/offered?term=2569-2 — GE courses that actually open in a SIS term
export async function GET(request: NextRequest) {
  const termId = request.nextUrl.searchParams.get("term");
  const origin = request.nextUrl.origin;
  try {
    const [term, gened] = await Promise.all([
      loadTermData(origin, termId),
      getGenedCourses().catch(() => []),
    ]);
    if (!term) return NextResponse.json({ error: "ไม่พบข้อมูลภาคการศึกษา" }, { status: 404 });
    const index = buildGeIndex(gened);

    const courses: OfferedCourse[] = [];
    for (const c of term.courses) {
      const info = classifyCourse(c, index);
      if (!info?.levels.length) continue;
      const seatsList = c.sections.map((s) => s.seats).filter((n): n is number => typeof n === "number");
      const first = c.sections[0];
      courses.push({
        id: c.id,
        code: c.code,
        nameTh: c.nameTh,
        nameEn: c.nameEn,
        creditNum: c.creditNum,
        campus: c.campus,
        faculty: c.faculty,
        ge: info.levels,
        ge8Groups: info.ge8Groups,
        sdgs: info.sdgs ?? [],
        source: info.source,
        link: info.link,
        sections: c.sections.length,
        seats: seatsList.length ? seatsList.reduce((a, b) => a + b, 0) : null,
        firstSlot: first ? first.dayTime || "ยังไม่มีตารางเรียน" : "",
        online: c.sections.some((s) => /online/i.test(s.room) || s.slots.some((sl) => /online/i.test(sl.room ?? ""))),
      });
    }
    courses.sort((a, b) => a.ge[0].localeCompare(b.ge[0]) || a.code.localeCompare(b.code));

    return NextResponse.json(
      {
        term: { id: term.id, label: term.label, year: term.year, term: term.term, fetchedAt: term.fetchedAt },
        courses,
      },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "โหลดรายวิชาที่เปิดสอนไม่สำเร็จ", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
