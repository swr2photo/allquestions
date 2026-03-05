import { notFound } from "next/navigation";
import Link from "next/link";
import { getCourseWithCustom, getQuizWithCustom } from "@/lib/merged-courses";
import { Button } from "@/components/ui/button";
import { QuizClient } from "./quiz-client";

export const dynamic = "force-dynamic";

interface QuizPageProps {
  params: Promise<{ courseId: string; quizId: string }>;
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { courseId, quizId } = await params;
  const course = getCourseWithCustom(courseId);
  const quiz = getQuizWithCustom(courseId, quizId);

  if (!course || !quiz) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">ไม่พบข้อสอบ</h1>
        <Link href="/">
          <Button>กลับหน้าแรก</Button>
        </Link>
      </div>
    );
  }

  return <QuizClient course={course} quiz={quiz} />;
}
