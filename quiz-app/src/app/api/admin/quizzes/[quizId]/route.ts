import { NextRequest, NextResponse } from "next/server";
import { isValidSession } from "@/lib/admin-store";
import {
  getCustomQuiz,
  updateCustomQuiz,
  deleteCustomQuiz,
} from "@/lib/custom-quiz-store";

function checkAuth(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  return isValidSession(token);
}

// GET /api/admin/quizzes/[quizId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quizId } = await params;
  const quiz = await getCustomQuiz(quizId);

  if (!quiz) {
    return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
  }

  return NextResponse.json({ success: true, quiz });
}

// PATCH /api/admin/quizzes/[quizId] - Update a custom quiz
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quizId } = await params;

  try {
    const body = await request.json();
    const { title, description, questions, pdfInfo, type } = body;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (pdfInfo !== undefined) updates.pdfInfo = pdfInfo;

    if (questions !== undefined) {
      // Validate questions
      if (Array.isArray(questions)) {
        updates.questions = questions.map(
          (q: { text: string; imageUrl?: string; choices: { text: string; isCorrect: boolean; imageUrl?: string }[] }, idx: number) => ({
            id: idx + 1,
            text: q.text,
            imageUrl: q.imageUrl || undefined,
            choices: q.choices.map((c) => ({
              text: c.text,
              isCorrect: c.isCorrect,
              imageUrl: c.imageUrl || undefined,
            })),
          })
        );
      }
    }

    const updated = await updateCustomQuiz(quizId, updates);

    if (!updated) {
      return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
    }

    return NextResponse.json({ success: true, quiz: updated });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/quizzes/[quizId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quizId } = await params;
  const deleted = await deleteCustomQuiz(quizId);

  if (!deleted) {
    return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
