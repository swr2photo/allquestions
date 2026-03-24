import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { courses } from "@/data/courses";
import { getCourseWithCustom } from "@/lib/merged-courses";
import { isCourseVisible, loadAdminData } from "@/lib/admin-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";
import {
  ArrowLeft,
  BookOpen,
  HelpCircle,
  ChevronRight,
  Eye,
  PenLine,
  FileText,
} from "lucide-react";

export function generateStaticParams() {
  return courses.map((course) => ({ courseId: course.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseId: string }>;
}): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getCourseWithCustom(courseId);
  if (!course) {
    return { title: "ไม่พบรายวิชา | Allquiz" };
  }
  return {
    title: `${course.title} | Allquiz`,
    description: course.description,
  };
}

interface CoursePageProps {
  params: Promise<{ courseId: string }>;
}

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseId } = await params;
  const course = await getCourseWithCustom(courseId);
  
  if (!course) {
    notFound();
  }
  
  const isVisible = await isCourseVisible(courseId);
  if (!isVisible) {
    notFound();
  }

  const adminData = await loadAdminData();
  const quizSettings = adminData.quizSettings || {};

  function getQuizStatus(quizId: string) {
    const settings = quizSettings[quizId] || { isActive: true, scheduleStart: null, scheduleEnd: null };
    if (!settings.isActive) return { visible: false, text: "ปิดใช้งาน" };
    const now = new Date();
    if (settings.scheduleStart && now < new Date(settings.scheduleStart)) return { visible: false, text: "ยังไม่เปิดสอบ" };
    if (settings.scheduleEnd && now > new Date(settings.scheduleEnd)) return { visible: false, text: "หมดเวลาทำข้อสอบแล้ว" };
    return { visible: true, text: "" };
  }

  const totalQuestions = course.quizzes.reduce(
    (sum, q) => sum + q.questions.length,
    0
  );
  const pdfCount = course.quizzes.filter((q) => q.type === "pdf").length;
  const quizCount = course.quizzes.filter((q) => q.type === "quiz").length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back button */}
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-6 gap-2 text-gray-600">
          <ArrowLeft className="h-4 w-4" />
          กลับหน้าแรก
        </Button>
      </Link>

      {/* Course header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-5xl">{course.icon}</span>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-gray-500 mt-1">{course.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Badge variant="info" className="gap-1">
            <BookOpen className="h-3 w-3" />
            {course.quizzes.length} ข้อสอบ
          </Badge>
          {totalQuestions > 0 && (
            <Badge variant="secondary" className="gap-1">
              <HelpCircle className="h-3 w-3" />
              {totalQuestions} คำถาม
            </Badge>
          )}
          {pdfCount > 0 && (
            <Badge variant="warning" className="gap-1">
              <FileText className="h-3 w-3" />
              {pdfCount} PDF
            </Badge>
          )}
        </div>
      </div>

      {/* Quiz list */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">รายการข้อสอบ</h2>

        {course.quizzes.map((quiz, index) => {
          const status = getQuizStatus(quiz.id);
          return (
          <Card
            key={quiz.id}
            className={`group relative transition-all duration-300 border-gray-100 overflow-hidden ${
              status.visible ? "hover:shadow-md" : "opacity-60 bg-gray-50/50"
            }`}
          >
            {status.visible && (
              <BorderBeam
                size={80}
                duration={8}
                colorFrom={quiz.type === "pdf" ? "#ef4444" : "#10b981"}
                colorTo={quiz.type === "pdf" ? "#f97316" : "#14b8a6"}
                borderWidth={1.5}
              />
            )}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm ${
                    quiz.type === "pdf"
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {quiz.type === "pdf" ? (
                      <FileText className="h-5 w-5" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{quiz.title}</CardTitle>
                      {quiz.type === "pdf" && (
                        <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                          PDF
                        </Badge>
                      )}
                      {!status.visible && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-200 text-gray-700 shrink-0">
                          {status.text}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {quiz.type === "pdf"
                        ? "ดูไฟล์ PDF"
                        : `${quiz.questions.length} คำถาม`}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {quiz.type === "pdf" ? (
                  <Link href={`/course/${course.id}/quiz/${quiz.id}`} className={!status.visible ? "pointer-events-none" : ""}>
                    <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700" disabled={!status.visible}>
                      <FileText className="h-3.5 w-3.5" />
                      เปิดดู PDF
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href={`/course/${course.id}/quiz/${quiz.id}?mode=study`} className={!status.visible ? "pointer-events-none" : ""}>
                      <Button size="sm" variant="outline" className="gap-2 text-xs sm:text-sm" disabled={!status.visible}>
                        <Eye className="h-3.5 w-3.5" />
                        ดูเฉลย
                      </Button>
                    </Link>
                    <Link href={`/course/${course.id}/quiz/${quiz.id}?mode=exam`} className={!status.visible ? "pointer-events-none" : ""}>
                      <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm" disabled={!status.visible}>
                        <PenLine className="h-3.5 w-3.5" />
                        ทำข้อสอบ
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )})}
      </div>
    </div>
  );
}
