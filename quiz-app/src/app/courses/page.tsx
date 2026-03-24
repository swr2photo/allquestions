import type { Metadata } from "next";
import { getAllCoursesWithCustom } from "@/lib/merged-courses";
import { CourseCard } from "@/components/course-card";
import { isCourseVisible } from "@/lib/admin-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "รายวิชาทั้งหมด | Allquiz",
  description: "เลือกรายวิชาเพื่อดูข้อสอบและเริ่มฝึกซ้อม",
};

export default async function CoursesPage() {
  const allCourses = await getAllCoursesWithCustom();
  const visibilityResults = await Promise.all(
    allCourses.map((c) => isCourseVisible(c.id))
  );
  const visibleCourses = allCourses.filter((_, i) => visibilityResults[i]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">รายวิชาทั้งหมด</h1>
        <p className="text-gray-500 mt-2">เลือกรายวิชาเพื่อดูข้อสอบและเริ่มฝึกซ้อม</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCourses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}
