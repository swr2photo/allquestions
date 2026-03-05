import type { Metadata } from "next";
import { getCourseWithCustom, getQuizWithCustom } from "@/lib/merged-courses";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}): Promise<Metadata> {
  const { courseId, quizId } = await params;
  const course = getCourseWithCustom(courseId);
  const quiz = getQuizWithCustom(courseId, quizId);

  if (!course || !quiz) {
    return { title: "ไม่พบข้อสอบ | Allquiz" };
  }

  return {
    title: `${quiz.title} - ${course.title} | Allquiz`,
    description: `ข้อสอบ ${quiz.title} จากรายวิชา ${course.title} (${quiz.questions.length} คำถาม)`,
  };
}

export default function QuizLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
