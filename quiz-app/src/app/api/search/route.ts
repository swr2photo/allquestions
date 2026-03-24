import { NextRequest, NextResponse } from "next/server";
import { getAllCoursesWithCustom } from "@/lib/merged-courses";

export const dynamic = "force-dynamic";

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
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const courses = await getAllCoursesWithCustom();
  const results: SearchResult[] = [];

  for (const course of courses) {
    for (const quiz of course.quizzes) {
      if (quiz.type === "pdf") continue;

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
        }
      }
    }

    if (results.length >= 50) break; // cap results
  }

  return NextResponse.json({ results });
}
