"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { QuestionCard } from "@/components/question-card";
import { PdfViewer } from "@/components/pdf-viewer";
import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Course, Quiz } from "@/types";
import {
  ArrowLeft,
  BookOpen,
  Eye,
  PenLine,
  RotateCcw,
  HelpCircle,
  FileText,
} from "lucide-react";

interface QuizClientProps {
  course: Course;
  quiz: Quiz;
}

export function QuizClient({ course, quiz }: QuizClientProps) {
  return (
    <Suspense fallback={<QuizLoadingSkeleton />}>
      <QuizContentInner course={course} quiz={quiz} />
    </Suspense>
  );
}

function QuizLoadingSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse mb-6" />
      <div className="h-10 w-64 bg-gray-200 rounded-lg animate-pulse mb-4" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function QuizContentInner({ course, quiz }: QuizClientProps) {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as "study" | "exam") || "study";

  const [searchQuery, setSearchQuery] = useState("");
  const [currentMode, setCurrentMode] = useState<"study" | "exam">(mode);
  const [key, setKey] = useState(0);

  const courseId = course.id;

  const filteredQuestions = useMemo(() => {
    if (!quiz) return [];
    if (!searchQuery.trim()) return quiz.questions;

    const query = searchQuery.toLowerCase();
    return quiz.questions.filter(
      (q) =>
        q.text.toLowerCase().includes(query) ||
        q.choices.some((c) => c.text.toLowerCase().includes(query))
    );
  }, [quiz, searchQuery]);

  // PDF Quiz Type
  if (quiz.type === "pdf" && quiz.pdfInfo) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back button */}
        <Link href={`/course/${courseId}`}>
          <Button variant="ghost" size="sm" className="mb-6 gap-2 text-gray-600">
            <ArrowLeft className="h-4 w-4" />
            กลับ {course.title}
          </Button>
        </Link>

        {/* Quiz header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{course.icon}</span>
            <div>
              <p className="text-sm text-gray-500">{course.title}</p>
              <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <Badge variant="warning" className="gap-1">
              <FileText className="h-3 w-3" />
              PDF
            </Badge>
            {quiz.description && (
              <span className="text-sm text-gray-500">{quiz.description}</span>
            )}
          </div>
        </div>

        {/* PDF Viewer */}
        <PdfViewer driveFileId={quiz.pdfInfo.driveFileId} title={quiz.title} />

        {/* Bottom navigation */}
        <div className="mt-8 pt-6 border-t flex justify-between">
          <Link href={`/course/${courseId}`}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              กลับรายการข้อสอบ
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Regular Quiz Type
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Back button */}
      <Link href={`/course/${courseId}`}>
        <Button variant="ghost" size="sm" className="mb-6 gap-2 text-gray-600">
          <ArrowLeft className="h-4 w-4" />
          กลับ {course.title}
        </Button>
      </Link>

      {/* Quiz header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{course.icon}</span>
          <div>
            <p className="text-sm text-gray-500">{course.title}</p>
            <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Badge variant="info" className="gap-1">
            <HelpCircle className="h-3 w-3" />
            {quiz.questions.length} คำถาม
          </Badge>
          <Badge
            variant={currentMode === "study" ? "success" : "warning"}
            className="gap-1"
          >
            {currentMode === "study" ? (
              <>
                <Eye className="h-3 w-3" />
                โหมดดูเฉลย
              </>
            ) : (
              <>
                <PenLine className="h-3 w-3" />
                โหมดทำข้อสอบ
              </>
            )}
          </Badge>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            variant={currentMode === "study" ? "default" : "outline"}
            className={
              currentMode === "study"
                ? "bg-emerald-600 hover:bg-emerald-700 gap-2"
                : "gap-2"
            }
            onClick={() => {
              setCurrentMode("study");
              setKey((k) => k + 1);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            ดูเฉลย
          </Button>
          <Button
            size="sm"
            variant={currentMode === "exam" ? "default" : "outline"}
            className={
              currentMode === "exam"
                ? "bg-emerald-600 hover:bg-emerald-700 gap-2"
                : "gap-2"
            }
            onClick={() => {
              setCurrentMode("exam");
              setKey((k) => k + 1);
            }}
          >
            <PenLine className="h-3.5 w-3.5" />
            ทำข้อสอบ
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setKey((k) => k + 1)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            รีเซ็ต
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchBar onSearch={setSearchQuery} placeholder="ค้นหาคำถาม..." />
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span>แสดง {filteredQuestions.length} จาก {quiz.questions.length} คำถาม</span>
        </div>
        <Progress value={filteredQuestions.length} max={quiz.questions.length} />
      </div>

      {/* Questions */}
      <div className="space-y-4" key={key}>
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">ไม่พบคำถามที่ค้นหา</p>
            <p className="text-sm mt-1">ลองค้นหาด้วยคำอื่น</p>
          </div>
        ) : (
          filteredQuestions.map((question, index) => (
            <QuestionCard
              key={`${key}-${question.id}`}
              question={question}
              index={index}
              mode={currentMode}
            />
          ))
        )}
      </div>

      {/* Bottom navigation */}
      <div className="mt-8 pt-6 border-t flex justify-between">
        <Link href={`/course/${courseId}`}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            กลับรายการข้อสอบ
          </Button>
        </Link>
      </div>
    </div>
  );
}
