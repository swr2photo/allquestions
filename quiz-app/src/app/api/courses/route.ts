import { NextRequest, NextResponse } from "next/server";
import { loadAdminData, isCourseVisible, isValidAdminSession } from "@/lib/admin-store";
import { getAllCoursesWithCustom } from "@/lib/merged-courses";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// GET /api/courses - Admin-only full course & quiz payload
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  if (!isValidAdminSession(token)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }

  try {
    const adminData = await loadAdminData();
    const allCourses = await getAllCoursesWithCustom();

    const visibilityResults = await Promise.all(
      allCourses.map((c) => isCourseVisible(c.id))
    );

    const visibleCourses = allCourses
      .filter((_, i) => visibilityResults[i])
      .map((course) => {
        const settings = adminData.courseSettings[course.id];
        return {
          ...course,
          order: settings?.order ?? 0,
        };
      })
      .sort((a, b) => a.order - b.order);

    return NextResponse.json(
      {
        success: true,
        courses: visibleCourses,
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error("[api/courses GET]", err);
    return NextResponse.json(
      { success: false, error: "Failed to load courses" },
      { status: 500, headers: NO_STORE }
    );
  }
}
