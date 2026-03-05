"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  HelpCircle,
  ImagePlus,
  FileText,
  BookOpen,
  X,
  AlertTriangle,
  Check,
  GripVertical,
} from "lucide-react";

interface ChoiceForm {
  text: string;
  isCorrect: boolean;
  imageUrl: string;
}

interface QuestionForm {
  text: string;
  imageUrl: string;
  choices: ChoiceForm[];
}

interface CourseOption {
  id: string;
  title: string;
  icon: string;
}

type ToastType = "success" | "error";

function QuizCreatorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const preselectedCourse = searchParams.get("course");

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Form state
  const [courseId, setCourseId] = useState(preselectedCourse || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quizType, setQuizType] = useState<"quiz" | "pdf">("quiz");
  const [driveFileId, setDriveFileId] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([
    {
      text: "",
      imageUrl: "",
      choices: [
        { text: "", isCorrect: true, imageUrl: "" },
        { text: "", isCorrect: false, imageUrl: "" },
        { text: "", isCorrect: false, imageUrl: "" },
        { text: "", isCorrect: false, imageUrl: "" },
      ],
    },
  ]);

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Fetch courses for the dropdown
  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await fetch("/api/admin/courses");
        if (res.status === 401) {
          router.push("/admin");
          return;
        }
        const data = await res.json();
        if (data.success) {
          setCourses(
            data.courses.map((c: { id: string; title: string; icon: string }) => ({
              id: c.id,
              title: c.title,
              icon: c.icon,
            }))
          );
        }
      } catch {
        showToast("โหลดข้อมูลรายวิชาไม่สำเร็จ", "error");
      } finally {
        setLoading(false);
      }
    }
    loadCourses();
  }, [router, showToast]);

  // Load quiz for editing
  useEffect(() => {
    if (!editId) return;

    async function loadQuiz() {
      try {
        const res = await fetch(`/api/admin/quizzes/${editId}`);
        if (!res.ok) {
          showToast("ไม่พบข้อสอบที่ต้องการแก้ไข", "error");
          return;
        }
        const data = await res.json();
        if (data.success && data.quiz) {
          const q = data.quiz;
          setCourseId(q.courseId);
          setTitle(q.title);
          setDescription(q.description || "");
          setQuizType(q.type);

          if (q.type === "pdf" && q.pdfInfo) {
            setDriveFileId(q.pdfInfo.driveFileId);
          }

          if (q.type === "quiz" && q.questions?.length > 0) {
            setQuestions(
              q.questions.map((qq: { text: string; imageUrl?: string; choices: { text: string; isCorrect: boolean; imageUrl?: string }[] }) => ({
                text: qq.text,
                imageUrl: qq.imageUrl || "",
                choices: qq.choices.map((c) => ({
                  text: c.text,
                  isCorrect: c.isCorrect,
                  imageUrl: c.imageUrl || "",
                })),
              }))
            );
          }
        }
      } catch {
        showToast("โหลดข้อสอบไม่สำเร็จ", "error");
      }
    }
    loadQuiz();
  }, [editId, showToast]);

  // Question management
  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      {
        text: "",
        imageUrl: "",
        choices: [
          { text: "", isCorrect: true, imageUrl: "" },
          { text: "", isCorrect: false, imageUrl: "" },
          { text: "", isCorrect: false, imageUrl: "" },
          { text: "", isCorrect: false, imageUrl: "" },
        ],
      },
    ]);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateQuestion(index: number, field: keyof QuestionForm, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  }

  function updateChoice(
    qIndex: number,
    cIndex: number,
    field: keyof ChoiceForm,
    value: string | boolean
  ) {
    setQuestions((prev) =>
      prev.map((q, qi) => {
        if (qi !== qIndex) return q;
        return {
          ...q,
          choices: q.choices.map((c, ci) => {
            if (field === "isCorrect") {
              // Only one correct answer per question
              return { ...c, isCorrect: ci === cIndex };
            }
            return ci === cIndex ? { ...c, [field]: value } : c;
          }),
        };
      })
    );
  }

  function addChoice(qIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? {
              ...q,
              choices: [...q.choices, { text: "", isCorrect: false, imageUrl: "" }],
            }
          : q
      )
    );
  }

  function removeChoice(qIndex: number, cIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        if (q.choices.length <= 2) return q; // minimum 2 choices
        const newChoices = q.choices.filter((_, ci) => ci !== cIndex);
        // If removed choice was correct, make first one correct
        if (!newChoices.some((c) => c.isCorrect)) {
          newChoices[0].isCorrect = true;
        }
        return { ...q, choices: newChoices };
      })
    );
  }

  // Extract Drive File ID from URL
  function parseDriveUrl(input: string): string {
    // Try to extract ID from various Google Drive URL formats
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,
      /id=([a-zA-Z0-9_-]+)/,
      /^([a-zA-Z0-9_-]{20,})$/,
    ];
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }
    return input;
  }

  // Save quiz
  async function handleSave() {
    if (!courseId) {
      showToast("กรุณาเลือกรายวิชา", "error");
      return;
    }
    if (!title.trim()) {
      showToast("กรุณากรอกชื่อข้อสอบ", "error");
      return;
    }

    setSaving(true);

    try {
      if (quizType === "pdf") {
        const fileId = parseDriveUrl(driveFileId);
        if (!fileId) {
          showToast("กรุณาระบุ Google Drive File ID หรือ URL", "error");
          setSaving(false);
          return;
        }

        const body = {
          courseId,
          title: title.trim(),
          type: "pdf" as const,
          description: description.trim() || undefined,
          pdfInfo: { driveFileId: fileId },
        };

        const url = editId
          ? `/api/admin/quizzes/${editId}`
          : "/api/admin/quizzes";
        const method = editId ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.status === 401) {
          router.push("/admin");
          return;
        }

        const data = await res.json();
        if (res.ok && data.success) {
          showToast(
            editId ? "แก้ไขข้อสอบ PDF สำเร็จ" : "สร้างข้อสอบ PDF สำเร็จ",
            "success"
          );
          setTimeout(() => router.push("/admin/dashboard"), 1000);
        } else {
          showToast(data.error || "บันทึกไม่สำเร็จ", "error");
        }
      } else {
        // Quiz type validation
        const hasEmptyQuestion = questions.some((q) => !q.text.trim());
        if (hasEmptyQuestion) {
          showToast("กรุณากรอกข้อความคำถามทุกข้อ", "error");
          setSaving(false);
          return;
        }

        const hasEmptyChoice = questions.some((q) =>
          q.choices.some((c) => !c.text.trim() && !c.imageUrl.trim())
        );
        if (hasEmptyChoice) {
          showToast("กรุณากรอกข้อความหรือรูปภาพตัวเลือกทุกข้อ", "error");
          setSaving(false);
          return;
        }

        const body = {
          courseId,
          title: title.trim(),
          type: "quiz" as const,
          description: description.trim() || undefined,
          questions: questions.map((q) => ({
            text: q.text.trim(),
            imageUrl: q.imageUrl.trim() || undefined,
            choices: q.choices.map((c) => ({
              text: c.text.trim(),
              isCorrect: c.isCorrect,
              imageUrl: c.imageUrl.trim() || undefined,
            })),
          })),
        };

        const url = editId
          ? `/api/admin/quizzes/${editId}`
          : "/api/admin/quizzes";
        const method = editId ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.status === 401) {
          router.push("/admin");
          return;
        }

        const data = await res.json();
        if (res.ok && data.success) {
          showToast(
            editId ? "แก้ไขข้อสอบสำเร็จ" : "สร้างข้อสอบสำเร็จ",
            "success"
          );
          setTimeout(() => router.push("/admin/dashboard"), 1000);
        } else {
          showToast(data.error || "บันทึกไม่สำเร็จ", "error");
        }
      }
    } catch {
      showToast("เกิดข้อผิดพลาด", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up ${
            toast.type === "success"
              ? "bg-emerald-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-gray-600"
          onClick={() => router.push("/admin/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {editId ? "แก้ไขข้อสอบ" : "เพิ่มข้อสอบใหม่"}
          </h1>
          <p className="text-sm text-gray-500">
            สร้างข้อสอบพร้อมเฉลย หรือเพิ่มไฟล์ PDF
          </p>
        </div>
      </div>

      {/* Basic info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            ข้อมูลพื้นฐาน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Course select */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              รายวิชา <span className="text-red-500">*</span>
            </label>
            <select
              aria-label="เลือกรายวิชา"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={!!editId}
            >
              <option value="">เลือกรายวิชา...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Quiz type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              ประเภท <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <button
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                  quizType === "quiz"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
                onClick={() => setQuizType("quiz")}
              >
                <HelpCircle className="h-4 w-4" />
                ข้อสอบ + เฉลย
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                  quizType === "pdf"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
                onClick={() => setQuizType("pdf")}
              >
                <FileText className="h-4 w-4" />
                ไฟล์ PDF
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              ชื่อข้อสอบ <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="เช่น ข้อสอบกลางภาค บทที่ 1-5"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              คำอธิบาย (ไม่บังคับ)
            </label>
            <Input
              placeholder="เช่น ครอบคลุมเนื้อหาบทที่ 1-5"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* PDF type : Drive File ID */}
      {quizType === "pdf" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-red-600" />
              Google Drive PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Google Drive URL หรือ File ID <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="วาง URL หรือ File ID เช่น https://drive.google.com/file/d/xxx/view"
                value={driveFileId}
                onChange={(e) => setDriveFileId(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1.5">
                วาง URL ของ Google Drive ได้เลย ระบบจะดึง File ID ให้อัตโนมัติ
              </p>
            </div>

            {driveFileId && (
              <div className="bg-gray-50 rounded-xl p-3 border">
                <p className="text-xs text-gray-500 mb-1">ตัวอย่างพรีวิว:</p>
                <p className="text-xs text-gray-700 font-mono break-all">
                  File ID: {parseDriveUrl(driveFileId)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quiz type: Questions */}
      {quizType === "quiz" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              คำถาม ({questions.length} ข้อ)
            </h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={addQuestion}
            >
              <Plus className="h-3.5 w-3.5" />
              เพิ่มคำถาม
            </Button>
          </div>

          {questions.map((q, qIndex) => (
            <Card key={qIndex} className="border-gray-200">
              <CardHeader className="py-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <GripVertical className="h-4 w-4" />
                    <Badge variant="info" className="text-xs">
                      ข้อ {qIndex + 1}
                    </Badge>
                  </div>
                  <div className="flex-1" />
                  {questions.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => removeQuestion(qIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Question text */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    คำถาม <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-15"
                    placeholder="พิมพ์คำถาม..."
                    value={q.text}
                    onChange={(e) =>
                      updateQuestion(qIndex, "text", e.target.value)
                    }
                    rows={2}
                  />
                </div>

                {/* Question image */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
                    <ImagePlus className="h-3.5 w-3.5" />
                    รูปภาพประกอบคำถาม (ไม่บังคับ)
                  </label>
                  <Input
                    placeholder="วาง URL รูปภาพ เช่น https://..."
                    value={q.imageUrl}
                    onChange={(e) =>
                      updateQuestion(qIndex, "imageUrl", e.target.value)
                    }
                    className="text-sm"
                  />
                  {q.imageUrl && (
                    <div className="mt-2 relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={q.imageUrl}
                        alt="พรีวิว"
                        className="max-h-32 rounded-lg border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Choices */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600">
                      ตัวเลือก <span className="text-red-500">*</span>
                      <span className="font-normal text-gray-400 ml-1">
                        (เลือกคำตอบที่ถูกต้อง)
                      </span>
                    </label>
                    {q.choices.length < 6 && (
                      <button
                        className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        onClick={() => addChoice(qIndex)}
                      >
                        <Plus className="h-3 w-3" />
                        เพิ่มตัวเลือก
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {q.choices.map((c, cIndex) => (
                      <div key={cIndex} className="flex items-start gap-2">
                        {/* Correct toggle */}
                        <button
                          className={`mt-2.5 shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            c.isCorrect
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-gray-300 hover:border-emerald-400"
                          }`}
                          onClick={() =>
                            updateChoice(qIndex, cIndex, "isCorrect", true)
                          }
                          title="เลือกเป็นคำตอบที่ถูก"
                        >
                          {c.isCorrect && (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {/* Choice content */}
                        <div className="flex-1 space-y-1.5">
                          <Input
                            placeholder={`ตัวเลือก ${String.fromCharCode(65 + cIndex)}`}
                            value={c.text}
                            onChange={(e) =>
                              updateChoice(
                                qIndex,
                                cIndex,
                                "text",
                                e.target.value
                              )
                            }
                            className={`text-sm ${
                              c.isCorrect
                                ? "border-emerald-300 bg-emerald-50"
                                : ""
                            }`}
                          />
                          {/* Choice image */}
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="URL รูปภาพ (ไม่บังคับ)"
                              value={c.imageUrl}
                              onChange={(e) =>
                                updateChoice(
                                  qIndex,
                                  cIndex,
                                  "imageUrl",
                                  e.target.value
                                )
                              }
                              className="text-xs h-8"
                            />
                          </div>
                          {c.imageUrl && (
                            <div className="inline-block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={c.imageUrl}
                                alt={`ตัวเลือก ${String.fromCharCode(65 + cIndex)}`}
                                className="max-h-20 rounded border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Remove choice */}
                        {q.choices.length > 2 && (
                          <button
                            className="mt-2.5 text-gray-300 hover:text-red-500 transition-colors"
                            onClick={() => removeChoice(qIndex, cIndex)}
                            aria-label="ลบตัวเลือก"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add question button */}
          <button
            onClick={addQuestion}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 text-sm text-gray-400 hover:border-emerald-300 hover:text-emerald-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            เพิ่มคำถามข้อใหม่
          </button>
        </div>
      )}

      {/* Save button */}
      <div className="mt-8 flex gap-3">
        <Button
          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 py-6 text-base"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="h-5 w-5" />
          {saving
            ? "กำลังบันทึก..."
            : editId
            ? "บันทึกการแก้ไข"
            : "สร้างข้อสอบ"}
        </Button>
        <Button
          variant="outline"
          className="py-6"
          onClick={() => router.push("/admin/dashboard")}
        >
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}

export default function QuizCreatorPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-16 max-w-3xl">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <QuizCreatorContent />
    </Suspense>
  );
}
