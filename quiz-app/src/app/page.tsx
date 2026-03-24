import { getAllCoursesWithCustom, getTotalQuestionsWithCustom, getTotalQuizzesWithCustom, getTotalPdfQuizzesWithCustom } from "@/lib/merged-courses";
import { CourseCard } from "@/components/course-card";
import { GraduationCap, BookOpen, HelpCircle, FileText } from "lucide-react";
import { isCourseVisible } from "@/lib/admin-store";
import { SparklesText } from "@/components/ui/sparkles-text";
import { NumberTicker } from "@/components/ui/number-ticker";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { Particles } from "@/components/ui/particles";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const allCourses = await getAllCoursesWithCustom();
  
  // Await each isCourseVisible call since it's async now
  const visibilityResults = await Promise.all(
    allCourses.map((c) => isCourseVisible(c.id))
  );
  const visibleCourses = allCourses.filter((_, i) => visibilityResults[i]);

  const totalQuestions = await getTotalQuestionsWithCustom();
  const totalQuizzes = await getTotalQuizzesWithCustom();
  const totalPdf = await getTotalPdfQuizzesWithCustom();

  const stats = [
    {
      label: "รายวิชา",
      value: allCourses.length,
      icon: GraduationCap,
      color: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "ข้อสอบ",
      value: totalQuizzes,
      icon: BookOpen,
      color: "text-teal-600 bg-teal-100",
    },
    {
      label: "คำถาม",
      value: totalQuestions,
      icon: HelpCircle,
      color: "text-green-600 bg-green-100",
    },
    {
      label: "ไฟล์ PDF",
      value: totalPdf,
      icon: FileText,
      color: "text-amber-600 bg-amber-100",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-br from-emerald-600 via-green-600 to-teal-700 text-white cursor-crosshair">
        <Particles
          className="absolute inset-0 z-0"
          quantity={800}
          color="#ffffff"
          size={0.6}
          staticity={40}
          ease={50}
        />
        <div className="py-16 sm:py-24" />
      </section>

      {/* Stats */}
      <section className="container mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow"
              >
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    <NumberTicker value={stat.value} className="text-gray-900" />
                  </p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Courses */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">รายวิชาทั้งหมด</h2>
            <p className="text-gray-500 mt-1">เลือกรายวิชาเพื่อเริ่มทำข้อสอบ</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8 mt-8">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; 2026 Allquiz - ระบบจัดการข้อสอบออนไลน์</p>
          <p className="mt-2">
            <a
              href="https://instagram.com/doralaikon_th"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-pink-500 hover:text-pink-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              doralaikon_th
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
