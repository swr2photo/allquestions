import { NextRequest, NextResponse } from "next/server";
import { isValidSession, updateQuizSettings } from "@/lib/admin-store";
import { getCourse } from "@/data/courses";
import {
  getCustomCourse,
  updateQuizInCustomCourse,
  deleteQuizFromCustomCourse,
  addQuizToCustomCourse,
  setQuizOverride,
  getQuizOverride,
} from "@/lib/custom-course-store";

function checkAuth(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  return isValidSession(token);
}

// GET /api/admin/courses/[courseId]/quizzes/[quizId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId, quizId } = await params;

  // Check custom course
  const customCourse = await getCustomCourse(courseId);
  if (customCourse) {
    const quiz = customCourse.quizzes.find((q) => q.id === quizId);
    if (!quiz) {
      return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
    }
    return NextResponse.json({ success: true, quiz, isCustomCourse: true });
  }

  // Static course
  const course = getCourse(courseId);
  if (!course) {
    return NextResponse.json({ error: "ไม่พบรายวิชา" }, { status: 404 });
  }

  const quiz = course.quizzes.find((q) => q.id === quizId);
  if (!quiz) {
    return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
  }

  // Apply override if exists
  const override = await getQuizOverride(courseId, quizId);
  const mergedQuiz = override
    ? {
        ...quiz,
        title: override.title ?? quiz.title,
        description: override.description ?? quiz.description,
        questions: override.questions ?? quiz.questions,
      }
    : quiz;

  return NextResponse.json({ success: true, quiz: mergedQuiz, isCustomCourse: false });
}

// PUT /api/admin/courses/[courseId]/quizzes/[quizId] - Update a quiz
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId, quizId } = await params;

  try {
    const body = await request.json();
    const { title, description, questions, pdfInfo } = body;

    // Check custom course
    const customCourse = await getCustomCourse(courseId);
    if (customCourse) {
      const result = await updateQuizInCustomCourse(courseId, quizId, {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(questions !== undefined && { questions }),
        ...(pdfInfo !== undefined && { pdfInfo }),
      });

      if (!result) {
        return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
      }
      return NextResponse.json({ success: true, quiz: result });
    }

    // Static course: use quiz override
    const course = getCourse(courseId);
    if (!course) {
      return NextResponse.json({ error: "ไม่พบรายวิชา" }, { status: 404 });
    }

    const quiz = course.quizzes.find((q) => q.id === quizId);
    if (!quiz) {
      return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
    }

    // Save as override
    const override = await setQuizOverride(courseId, quizId, {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(questions !== undefined && { questions }),
    });

    return NextResponse.json({ success: true, override });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/courses/[courseId]/quizzes/[quizId] - Update quiz settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quizId } = await params;

  try {
    const body = await request.json();
    const { isActive, scheduleStart, scheduleEnd } = body;

    // Update settings if provided
    if (isActive !== undefined || scheduleStart !== undefined || scheduleEnd !== undefined) {
      const updated = await updateQuizSettings(quizId, {
        ...(isActive !== undefined && { isActive }),
        ...(scheduleStart !== undefined && { scheduleStart }),
        ...(scheduleEnd !== undefined && { scheduleEnd }),
      });
      return NextResponse.json({ success: true, settings: updated });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/courses/[courseId]/quizzes/[quizId] - Delete a quiz
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId, quizId } = await params;

  // Only custom course quizzes can be deleted
  const customCourse = await getCustomCourse(courseId);
  if (!customCourse) {
    return NextResponse.json(
      { error: "ไม่สามารถลบข้อสอบของรายวิชาระบบได้" },
      { status: 400 }
    );
  }

  const result = await deleteQuizFromCustomCourse(courseId, quizId);
  if (!result) {
    return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// POST /api/admin/courses/[courseId]/quizzes - Add new quiz to custom course
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;

  // Only custom courses can have quizzes added directly
  const customCourse = await getCustomCourse(courseId);
  if (!customCourse) {
    return NextResponse.json(
      { error: "ใช้ระบบเพิ่มข้อสอบ (custom quiz) สำหรับรายวิชาระบบ" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { title, type, description, questions, pdfInfo } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "กรุณากรอกชื่อข้อสอบ" }, { status: 400 });
    }

    const result = await addQuizToCustomCourse(courseId, {
      id: "",
      title: title.trim(),
      type: type || "quiz",
      description: description || "",
      questions: questions || [],
      pdfInfo: pdfInfo,
    });

    return NextResponse.json({ success: true, course: result });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
