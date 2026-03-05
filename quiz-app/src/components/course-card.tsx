import Link from "next/link";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronRight, FileText, HelpCircle } from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import type { Course } from "@/types";

interface CourseCardProps {
  course: Course;
}

export function CourseCard({ course }: CourseCardProps) {
  const quizCount = course.quizzes.filter((q) => q.type === "quiz").length;
  const pdfCount = course.quizzes.filter((q) => q.type === "pdf").length;
  const totalQuestions = course.quizzes.reduce(
    (sum, q) => sum + q.questions.length,
    0
  );

  return (
    <Link href={`/course/${course.id}`}>
      <MagicCard
        className="group cursor-pointer overflow-hidden border border-gray-100 rounded-xl bg-white hover:-translate-y-1 transition-all duration-300"
        gradientColor="#f0fdf4"
        gradientOpacity={0.3}
        gradientFrom="#10b981"
        gradientTo="#14b8a6"
      >
        {/* Color bar */}
        <div className={`h-2 bg-linear-to-r ${course.color}`} />

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{course.icon}</span>
              <div>
                <CardTitle className="text-lg group-hover:text-emerald-600 transition-colors">
                  {course.title}
                </CardTitle>
                <CardDescription className="mt-1 line-clamp-2">
                  {course.description}
                </CardDescription>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
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
        </CardContent>
      </MagicCard>
    </Link>
  );
}
