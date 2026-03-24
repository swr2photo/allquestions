import { NextResponse } from "next/server";
import { loadAdminData, isCourseVisible } from "@/lib/admin-store";
import { getAllCoursesWithCustom } from "@/lib/merged-courses";

// GET /api/courses - Get publicly visible courses
export async function GET() {
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

    return NextResponse.json({
      success: true,
      courses: visibleCourses,
    });
  } catch {
    // Fallback: return all courses if admin data fails
    const allCourses = await getAllCoursesWithCustom();
    return NextResponse.json({
      success: true,
      courses: allCourses,
    });
  }
}
