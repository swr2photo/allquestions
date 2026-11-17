import { NextRequest, NextResponse } from "next/server";
import { isSettingsActive, loadAdminData } from "@/lib/admin-store";
import { getAllCoursesWithCustom } from "@/lib/merged-courses";
import { sessionUser } from "@/lib/session.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

interface SearchResult {
  courseId: string;
  courseTitle: string;
  courseIcon: string;
  quizId: string;
  quizTitle: string;
  questionIndex: number;
  questionText: string;
  correctAnswer: string;
  allChoices: { text: string; isCorrect: boolean }[];
}

export async function GET(request: NextRequest) {
  if (!sessionUser(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q")?.trim() ?? "").slice(0, 200).toLowerCase();

  if (query.length < 2) {
    return NextResponse.json({ results: [] }, { headers: NO_STORE });
  }

  const [courses, adminData] = await Promise.all([
    getAllCoursesWithCustom(),
    loadAdminData(),
  ]);
  const results: SearchResult[] = [];

  for (const course of courses) {
    if (!isSettingsActive(adminData.courseSettings[course.id])) continue;

    for (const quiz of course.quizzes) {
      if (quiz.type === "pdf") continue;
      if (!isSettingsActive(adminData.quizSettings?.[quiz.id])) continue;

      for (let i = 0; i < quiz.questions.length; i++) {
        const q = quiz.questions[i];
        const questionMatch = q.text.toLowerCase().includes(query);
        const choiceMatch = q.choices.some((c) =>
          c.text.toLowerCase().includes(query)
        );

        if (questionMatch || choiceMatch) {
          const correct = q.choices.find((c) => c.isCorrect);
          results.push({
            courseId: course.id,
            courseTitle: course.title,
            courseIcon: course.icon,
            quizId: quiz.id,
            quizTitle: quiz.title,
            questionIndex: i + 1,
            questionText: q.text,
            correctAnswer: correct?.text ?? "ไม่พบคำตอบที่ถูกต้อง",
            allChoices: q.choices.map((c) => ({
              text: c.text,
              isCorrect: c.isCorrect,
            })),
          });
          if (results.length >= 50) break;
        }
      }

      if (results.length >= 50) break;
    }

    if (results.length >= 50) break; // cap results
  }

  return NextResponse.json({ results }, { headers: NO_STORE });
}
