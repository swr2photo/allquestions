import type { Metadata } from "next";
import { getCourseWithCustom, getQuizWithCustom } from "@/lib/merged-courses";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}): Promise<Metadata> {
  const { courseId, quizId } = await params;
  const course = await getCourseWithCustom(courseId);
  const quiz = await getQuizWithCustom(courseId, quizId);

  // --- newly added check ---
  const { isCourseVisible, isQuizVisible } = await import("@/lib/admin-store");
  const isVisible = await isCourseVisible(courseId);
  const isQVisible = await isQuizVisible(quizId);
  // -------------------------

  if (!course || !quiz || !isVisible || !isQVisible) {
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
