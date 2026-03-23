import { NextRequest, NextResponse } from "next/server";
import { isValidSession, updateCourseSettings, getCourseSettings, loadAdminData } from "@/lib/admin-store";
import { getCourse } from "@/data/courses";
import {
  getCustomCourse,
  updateCustomCourse,
  deleteCustomCourse,
  setCourseOverride,
  getCourseOverride,
  loadCustomCourseData,
} from "@/lib/custom-course-store";

function checkAuth(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  return isValidSession(token);
}

// GET /api/admin/courses/[courseId] - Get single course with settings and quizzes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;

  const adminData = await loadAdminData();
  const quizSettings = adminData.quizSettings || {};

  // Check custom course first
  const customCourse = await getCustomCourse(courseId);
  if (customCourse) {
    const settings = await getCourseSettings(courseId);
    return NextResponse.json({
      success: true,
      course: {
        id: customCourse.id,
        title: customCourse.title,
        description: customCourse.description,
        icon: customCourse.icon,
        color: customCourse.color,
        isCustomCourse: true,
        quizzes: customCourse.quizzes.map((q) => ({
          id: q.id,
          title: q.title,
          type: q.type,
          description: q.description,
          questionCount: q.questions.length,
          questions: q.questions,
          pdfInfo: q.pdfInfo,
        })),
      },
      settings,
      quizSettings,
    });
  }

  // Static course
  const course = getCourse(courseId);
  if (!course) {
    return NextResponse.json({ error: "ไม่พบรายวิชา" }, { status: 404 });
  }

  const settings = await getCourseSettings(courseId);
  const override = await getCourseOverride(courseId);
  const customCourseData = await loadCustomCourseData();
  const quizOverrides = customCourseData.quizOverrides.filter(
    (o) => o.courseId === courseId
  );

  return NextResponse.json({
    success: true,
    course: {
      id: course.id,
      title: override?.title ?? course.title,
      description: override?.description ?? course.description,
      icon: override?.icon ?? course.icon,
      color: override?.color ?? course.color,
      isCustomCourse: false,
      quizzes: course.quizzes.map((q) => {
        const qOverride = quizOverrides.find((o) => o.quizId === q.id);
        return {
          id: q.id,
          title: qOverride?.title ?? q.title,
          type: q.type,
          description: qOverride?.description ?? q.description,
          questionCount: (qOverride?.questions ?? q.questions).length,
          questions: qOverride?.questions ?? q.questions,
          pdfInfo: q.pdfInfo,
        };
      }),
    },
    settings,
    quizSettings,
  });
}

// PATCH /api/admin/courses/[courseId] - Update course settings and/or metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;

  try {
    const body = await request.json();
    const { isActive, scheduleStart, scheduleEnd, order, title, description, icon, color } = body;

    // Update settings if provided
    if (isActive !== undefined || scheduleStart !== undefined || scheduleEnd !== undefined || order !== undefined) {
      await updateCourseSettings(courseId, {
        ...(isActive !== undefined && { isActive }),
        ...(scheduleStart !== undefined && { scheduleStart }),
        ...(scheduleEnd !== undefined && { scheduleEnd }),
        ...(order !== undefined && { order }),
      });
    }

    // Update metadata if provided
    if (title !== undefined || description !== undefined || icon !== undefined || color !== undefined) {
      const customCourse = await getCustomCourse(courseId);
      if (customCourse) {
        // Custom course: update directly
        await updateCustomCourse(courseId, {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(icon !== undefined && { icon }),
          ...(color !== undefined && { color }),
        });
      } else {
        // Static course: create/update override
        const existing = await getCourseOverride(courseId);
        await setCourseOverride(courseId, {
          title: title ?? existing?.title,
          description: description ?? existing?.description,
          icon: icon ?? existing?.icon,
          color: color ?? existing?.color,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/courses/[courseId] - Delete a custom course
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;

  // Only custom courses can be deleted
  const customCourse = await getCustomCourse(courseId);
  if (!customCourse) {
    return NextResponse.json(
      { error: "ไม่สามารถลบรายวิชาระบบได้ สามารถแก้ไขได้เท่านั้น" },
      { status: 400 }
    );
  }

  await deleteCustomCourse(courseId);
  return NextResponse.json({ success: true });
}
