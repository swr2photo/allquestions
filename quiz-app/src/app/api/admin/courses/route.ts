import { NextRequest, NextResponse } from "next/server";
import { isValidSession, loadAdminData, updateCourseSettings } from "@/lib/admin-store";
import { courses } from "@/data/courses";
import { getCustomQuizzesForCourse } from "@/lib/custom-quiz-store";
import {
  getAllCustomCourses,
  createCustomCourse,
  loadCustomCourseData,
} from "@/lib/custom-course-store";

function checkAuth(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  return isValidSession(token);
}

// GET /api/admin/courses - Get all courses with admin settings
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminData = await loadAdminData();
  const customCourseData = await loadCustomCourseData();

  // Static courses with overrides applied
  const staticCoursesWithSettings = await Promise.all(
    courses.map(async (course) => {
      const customQuizzes = await getCustomQuizzesForCourse(course.id);
      const allQuizzes = [...course.quizzes, ...customQuizzes];

      // Apply course override if exists
      const override = customCourseData.courseOverrides.find(
        (o) => o.courseId === course.id
      );

      return {
        id: course.id,
        title: override?.title ?? course.title,
        description: override?.description ?? course.description,
        icon: override?.icon ?? course.icon,
        color: override?.color ?? course.color,
        quizCount: allQuizzes.length,
        questionCount: allQuizzes.reduce((sum, q) => sum + q.questions.length, 0),
        pdfCount: allQuizzes.filter((q) => q.type === "pdf").length,
        customQuizCount: customQuizzes.length,
        isCustomCourse: false,
        settings: adminData.courseSettings[course.id] || {
          isActive: true,
          scheduleStart: null,
          scheduleEnd: null,
          order: 0,
        },
      };
    })
  );

  // Custom courses
  const allCustomCourses = await getAllCustomCourses();
  const customCourses = allCustomCourses.map((cc) => ({
    id: cc.id,
    title: cc.title,
    description: cc.description,
    icon: cc.icon,
    color: cc.color,
    quizCount: cc.quizzes.length,
    questionCount: cc.quizzes.reduce((sum, q) => sum + q.questions.length, 0),
    pdfCount: cc.quizzes.filter((q) => q.type === "pdf").length,
    customQuizCount: 0,
    isCustomCourse: true,
    settings: adminData.courseSettings[cc.id] || {
      isActive: true,
      scheduleStart: null,
      scheduleEnd: null,
      order: staticCoursesWithSettings.length + allCustomCourses.indexOf(cc),
    },
  }));

  const allCourses = [...staticCoursesWithSettings, ...customCourses];
  allCourses.sort((a, b) => a.settings.order - b.settings.order);

  return NextResponse.json({ success: true, courses: allCourses });
}

// POST /api/admin/courses - Create a new custom course
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, description, icon, color } = await request.json();

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อรายวิชา" },
        { status: 400 }
      );
    }

    const newCourse = await createCustomCourse({
      title: title.trim(),
      description: description?.trim() || "",
      icon: icon || "📚",
      color: color || "from-gray-500 to-gray-600",
      quizzes: [],
    });

    const allCustomCourses = await getAllCustomCourses();

    // Auto-create course settings
    await updateCourseSettings(newCourse.id, {
      isActive: true,
      scheduleStart: null,
      scheduleEnd: null,
      order: courses.length + allCustomCourses.length - 1,
    });

    return NextResponse.json({ success: true, course: newCourse });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/courses - Batch update course settings
export async function PATCH(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { updates } = await request.json();

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: "กรุณาส่งข้อมูลการอัปเดต" },
        { status: 400 }
      );
    }

    const results: Record<string, unknown> = {};
    for (const update of updates) {
      const { courseId, ...settings } = update;
      if (courseId) {
        results[courseId] = await updateCourseSettings(courseId, settings);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
