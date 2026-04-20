import { NextRequest, NextResponse } from "next/server";
import { isValidSession } from "@/lib/admin-store";
import {
  getCustomQuizzesForCourse,
  createCustomQuiz,
} from "@/lib/custom-quiz-store";
import { courses } from "@/data/courses";
import { CustomQuiz } from "@/types";

function checkAuth(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  return isValidSession(token);
}

// GET /api/admin/quizzes?courseId=xxx - Get custom quizzes for a course
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courseId = request.nextUrl.searchParams.get("courseId");

  if (courseId) {
    const quizzes = await getCustomQuizzesForCourse(courseId);
    return NextResponse.json({ success: true, quizzes });
  }

  // Return all custom quizzes grouped by course
  const allQuizzes: Record<string, CustomQuiz[]> = {};
  await Promise.all(
    courses.map(async (course) => {
      const cq = await getCustomQuizzesForCourse(course.id);
      if (cq.length > 0) {
        allQuizzes[course.id] = cq;
      }
    })
  );

  return NextResponse.json({ success: true, quizzes: allQuizzes });
}

// POST /api/admin/quizzes - Create a new custom quiz
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { courseId, title, type, description, questions, pdfInfo } = body;

    if (!courseId || !title || !type) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบ (courseId, title, type)" },
        { status: 400 }
      );
    }

    // Verify course exists
    const course = courses.find((c) => c.id === courseId);
    if (!course) {
      return NextResponse.json({ error: "ไม่พบรายวิชา" }, { status: 404 });
    }

    if (type === "pdf") {
      if (!pdfInfo?.driveFileId) {
        return NextResponse.json(
          { error: "กรุณาระบุ Drive File ID สำหรับ PDF" },
          { status: 400 }
        );
      }

      const quiz = await createCustomQuiz({
        courseId,
        title,
        type: "pdf",
        description,
        questions: [],
        pdfInfo: {
          driveFileId: pdfInfo.driveFileId,
          driveUrl: `https://drive.google.com/file/d/${pdfInfo.driveFileId}/preview`,
        },
      });

      return NextResponse.json({ success: true, quiz });
    }

    // Quiz type
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อ" },
        { status: 400 }
      );
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text || !q.choices || q.choices.length < 2) {
        return NextResponse.json(
          { error: `คำถามข้อที่ ${i + 1}: กรุณากรอกข้อความและตัวเลือกอย่างน้อย 2 ตัวเลือก` },
          { status: 400 }
        );
      }
      const hasCorrect = q.choices.some((c: { isCorrect: boolean }) => c.isCorrect);
      if (!hasCorrect) {
        return NextResponse.json(
          { error: `คำถามข้อที่ ${i + 1}: กรุณาเลือกคำตอบที่ถูกต้อง` },
          { status: 400 }
        );
      }
    }

    const quiz = await createCustomQuiz({
      courseId,
      title,
      type: "quiz",
      description,
      questions: questions.map((q: { text: string; imageUrl?: string; choices: { text: string; isCorrect: boolean; imageUrl?: string }[] }, idx: number) => ({
        id: idx + 1,
        text: q.text,
        imageUrl: q.imageUrl || undefined,
        choices: q.choices.map((c) => ({
          text: c.text,
          isCorrect: c.isCorrect,
          imageUrl: c.imageUrl || undefined,
        })),
      })),
    });

    return NextResponse.json({ success: true, quiz });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างข้อสอบ" },
      { status: 500 }
    );
  }
}
