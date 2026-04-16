import { NextRequest, NextResponse } from "next/server";
import {
  getGenedCategories,
  getGenedCourses,
  invalidateGenedCache,
  summarizeCourses,
} from "@/lib/gened";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "1";
  if (force) invalidateGenedCache();

  try {
    const [courses, categories] = await Promise.all([
      getGenedCourses(force),
      getGenedCategories(force),
    ]);
    const summary = summarizeCourses(courses);

    return NextResponse.json({
      courses,
      categories,
      summary,
      source: "https://gened.psu.ac.th",
      fetchedAt: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "ไม่สามารถดึงข้อมูลจาก gened.psu.ac.th ได้",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
