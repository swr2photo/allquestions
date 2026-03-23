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
  Palette,
  PenLine,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Power,
  PowerOff,
  Calendar,
  Clock,
  RotateCcw,
} from "lucide-react";
import type { Question, Choice } from "@/types";

// ============ Types ============

interface QuizItem {
  id: string;
  title: string;
  type: "quiz" | "pdf";
  description?: string;
  questionCount: number;
  questions: Question[];
  pdfInfo?: { driveFileId: string; driveUrl: string };
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  isCustomCourse: boolean;
  quizzes: QuizItem[];
}

type ToastType = "success" | "error";

interface ChoiceForm {
  text: string;
  isCorrect: boolean;
  imageUrl: string;
}

interface QuestionForm {
  id: number;
  text: string;
  imageUrl: string;
  choices: ChoiceForm[];
}

// ============ Color Options ============

const COLOR_OPTIONS = [
  { label: "เขียว-ฟ้าเขียว", value: "from-emerald-500 to-teal-600" },
  { label: "เขียว-เขียวเข้ม", value: "from-green-500 to-emerald-700" },
  { label: "ม่วง-ชมพู", value: "from-purple-500 to-pink-600" },
  { label: "ส้ม-แดง", value: "from-orange-500 to-red-600" },
  { label: "ฟ้า-น้ำเงิน", value: "from-cyan-500 to-blue-600" },
  { label: "ชมพู-ม่วง", value: "from-pink-500 to-purple-600" },
  { label: "เหลือง-ส้ม", value: "from-yellow-500 to-orange-600" },
  { label: "น้ำเงิน-คราม", value: "from-blue-500 to-indigo-600" },
  { label: "เทา-เทาเข้ม", value: "from-gray-500 to-gray-600" },
];

const ICON_OPTIONS = [
  "📚", "📖", "📝", "📐", "🔬", "🧪", "💻", "🌍", "⚖️", "🌿",
  "🎓", "🎯", "🏥", "🧠", "💡", "🔧", "📊", "🎨", "🎵", "⚽",
  "🏛️", "🔭", "🧬", "🌐", "📱", "🖥️", "🤖", "🧮", "📈", "🗺️",
];

// ============ Main Component ============

function CourseManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editCourseId = searchParams.get("edit");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Course form
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseIcon, setCourseIcon] = useState("📚");
  const [courseColor, setCourseColor] = useState("from-emerald-500 to-teal-600");
  const [isCustomCourse, setIsCustomCourse] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Course quizzes (for editing existing course)
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<string | null>(null);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [quizSettings, setQuizSettings] = useState<Record<string, { isActive: boolean; scheduleStart: string | null; scheduleEnd: string | null }>>({});

  // Quiz edit form
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizType, setQuizType] = useState<"quiz" | "pdf">("quiz");
  const [driveFileId, setDriveFileId] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([]);

  // New quiz form
  const [showNewQuiz, setShowNewQuiz] = useState(false);

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load course data for editing
  useEffect(() => {
    async function loadCourse() {
      if (!editCourseId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/admin/courses/${editCourseId}`);
        if (res.status === 401) {
          router.push("/admin");
          return;
        }

        if (!res.ok) {
          showToast("ไม่พบรายวิชา", "error");
          router.push("/admin/dashboard");
          return;
        }

        const data = await res.json();
        if (data.success && data.course) {
          const c: CourseDetail = data.course;
          setCourseTitle(c.title);
          setCourseDescription(c.description);
          setCourseIcon(c.icon);
          setCourseColor(c.color);
          setIsCustomCourse(c.isCustomCourse);
          setQuizzes(c.quizzes);
          setQuizSettings(data.quizSettings || {});
        }
      } catch {
        showToast("โหลดข้อมูลไม่สำเร็จ", "error");
      } finally {
        setLoading(false);
      }
    }

    loadCourse();
  }, [editCourseId, router, showToast]);

  // ============ Course Actions ============

  async function saveCourse() {
    if (!courseTitle.trim()) {
      showToast("กรุณากรอกชื่อรายวิชา", "error");
      return;
    }

    setSaving(true);
    try {
      if (editCourseId) {
        // Update existing course
        const res = await fetch(`/api/admin/courses/${editCourseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: courseTitle.trim(),
            description: courseDescription.trim(),
            icon: courseIcon,
            color: courseColor,
          }),
        });

        if (res.status === 401) {
          router.push("/admin");
          return;
        }

        if (res.ok) {
          showToast("บันทึกรายวิชาสำเร็จ", "success");
        } else {
          showToast("บันทึกไม่สำเร็จ", "error");
        }
      } else {
        // Create new course
        const res = await fetch("/api/admin/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: courseTitle.trim(),
            description: courseDescription.trim(),
            icon: courseIcon,
            color: courseColor,
          }),
        });

        if (res.status === 401) {
          router.push("/admin");
          return;
        }

        if (res.ok) {
          const data = await res.json();
          showToast("สร้างรายวิชาสำเร็จ", "success");
          // Redirect to edit page of new course
          router.push(`/admin/courses?edit=${data.course.id}`);
        } else {
          showToast("สร้างไม่สำเร็จ", "error");
        }
      }
    } catch {
      showToast("เกิดข้อผิดพลาด", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCourse() {
    if (!editCourseId || !isCustomCourse) return;
    if (!confirm("ต้องการลบรายวิชานี้ใช่หรือไม่? ข้อสอบทั้งหมดในรายวิชาจะถูกลบด้วย")) return;

    try {
      const res = await fetch(`/api/admin/courses/${editCourseId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast("ลบรายวิชาสำเร็จ", "success");
        router.push("/admin/dashboard");
      } else {
        const data = await res.json();
        showToast(data.error || "ลบไม่สำเร็จ", "error");
      }
    } catch {
      showToast("เกิดข้อผิดพลาด", "error");
    }
  }

  // ============ Quiz Edit Actions ============

  function startEditQuiz(quiz: QuizItem) {
    setEditingQuiz(quiz.id);
    setQuizTitle(quiz.title);
    setQuizDescription(quiz.description || "");
    setQuizType(quiz.type);
    setDriveFileId(quiz.pdfInfo?.driveFileId || "");
    setQuestions(
      quiz.questions.map((q) => ({
        id: q.id,
        text: q.text,
        imageUrl: q.imageUrl || "",
        choices: q.choices.map((c) => ({
          text: c.text,
          isCorrect: c.isCorrect,
          imageUrl: c.imageUrl || "",
        })),
      }))
    );
    setShowNewQuiz(false);
  }

  function cancelQuizEdit() {
    setEditingQuiz(null);
    setQuizTitle("");
    setQuizDescription("");
    setQuizType("quiz");
    setDriveFileId("");
    setQuestions([]);
    setShowNewQuiz(false);
  }

  function startNewQuiz() {
    setEditingQuiz(null);
    setShowNewQuiz(true);
    setQuizTitle("");
    setQuizDescription("");
    setQuizType("quiz");
    setDriveFileId("");
    setQuestions([
      {
        id: 1,
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

  async function saveQuiz() {
    if (!quizTitle.trim()) {
      showToast("กรุณากรอกชื่อข้อสอบ", "error");
      return;
    }

    if (!editCourseId) return;

    setSaving(true);
    try {
      const formattedQuestions: Question[] = questions.map((q, i) => ({
        id: q.id || i + 1,
        text: q.text,
        imageUrl: q.imageUrl || undefined,
        choices: q.choices.map((c) => ({
          text: c.text,
          isCorrect: c.isCorrect,
          imageUrl: c.imageUrl || undefined,
        })),
      }));

      if (showNewQuiz && isCustomCourse) {
        // Add new quiz to custom course
        const res = await fetch(`/api/admin/courses/${editCourseId}/quizzes/_new`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: quizTitle.trim(),
            type: quizType,
            description: quizDescription.trim(),
            questions: quizType === "quiz" ? formattedQuestions : [],
            pdfInfo: quizType === "pdf" && driveFileId
              ? {
                  driveFileId,
                  driveUrl: `https://drive.google.com/file/d/${driveFileId}/preview`,
                }
              : undefined,
          }),
        });

        if (res.ok) {
          showToast("เพิ่มข้อสอบสำเร็จ", "success");
          // Reload
          window.location.reload();
        } else {
          showToast("เพิ่มไม่สำเร็จ", "error");
        }
      } else if (editingQuiz) {
        // Update existing quiz
        const res = await fetch(
          `/api/admin/courses/${editCourseId}/quizzes/${editingQuiz}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: quizTitle.trim(),
              description: quizDescription.trim(),
              questions: quizType === "quiz" ? formattedQuestions : undefined,
              pdfInfo: quizType === "pdf" && driveFileId
                ? {
                    driveFileId,
                    driveUrl: `https://drive.google.com/file/d/${driveFileId}/preview`,
                  }
                : undefined,
            }),
          }
        );

        if (res.ok) {
          showToast("บันทึกข้อสอบสำเร็จ", "success");
          // Update local state
          setQuizzes((prev) =>
            prev.map((q) =>
              q.id === editingQuiz
                ? {
                    ...q,
                    title: quizTitle.trim(),
                    description: quizDescription.trim(),
                    questions: formattedQuestions,
                    questionCount: formattedQuestions.length,
                  }
                : q
            )
          );
          cancelQuizEdit();
        } else {
          showToast("บันทึกไม่สำเร็จ", "error");
        }
      }
    } catch {
      showToast("เกิดข้อผิดพลาด", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuiz(quizId: string) {
    if (!editCourseId || !isCustomCourse) return;
    if (!confirm("ต้องการลบข้อสอบนี้ใช่หรือไม่?")) return;

    try {
      const res = await fetch(
        `/api/admin/courses/${editCourseId}/quizzes/${quizId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
        showToast("ลบข้อสอบสำเร็จ", "success");
      } else {
        const data = await res.json();
        showToast(data.error || "ลบไม่สำเร็จ", "error");
      }
    } catch {
      showToast("เกิดข้อผิดพลาด", "error");
    }
  }

  // ============ Quiz Settings Actions ============

  async function toggleQuiz(quizId: string) {
    if (!editCourseId) return;
    const settings = quizSettings[quizId] || { isActive: true, scheduleStart: null, scheduleEnd: null };
    const newActive = !settings.isActive;

    try {
      const res = await fetch(`/api/admin/courses/${editCourseId}/quizzes/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });

      if (res.status === 401) {
        router.push("/admin");
        return;
      }

      if (res.ok) {
        setQuizSettings((prev) => ({
          ...prev,
          [quizId]: { ...settings, isActive: newActive },
        }));
        showToast(
          `การแสดงผลข้อสอบ: ${newActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}แล้ว`,
          "success"
        );
      }
    } catch {
      showToast("เกิดข้อผิดพลาด", "error");
    }
  }

  function updateQuizSchedule(quizId: string, field: "scheduleStart" | "scheduleEnd", value: string) {
    const settings = quizSettings[quizId] || { isActive: true, scheduleStart: null, scheduleEnd: null };
    setQuizSettings((prev) => ({
      ...prev,
      [quizId]: { ...settings, [field]: value || null },
    }));
  }

  async function saveQuizSchedule(quizId: string) {
    if (!editCourseId) return;
    const settings = quizSettings[quizId] || { isActive: true, scheduleStart: null, scheduleEnd: null };

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/courses/${editCourseId}/quizzes/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleStart: settings.scheduleStart,
          scheduleEnd: settings.scheduleEnd,
        }),
      });

      if (res.ok) {
        showToast(`บันทึกเวลาข้อสอบสำเร็จ`, "success");
      } else {
        showToast("บันทึกไม่สำเร็จ", "error");
      }
    } catch {
      showToast("เกิดข้อผิดพลาด", "error");
    } finally {
      setSaving(false);
    }
  }

  async function clearQuizSchedule(quizId: string) {
    if (!editCourseId) return;
    try {
      const res = await fetch(`/api/admin/courses/${editCourseId}/quizzes/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleStart: null,
          scheduleEnd: null,
        }),
      });

      if (res.ok) {
        setQuizSettings((prev) => {
          const s = prev[quizId] || { isActive: true };
          return {
            ...prev,
            [quizId]: { ...s, scheduleStart: null, scheduleEnd: null },
          };
        });
        showToast(`ล้างเวลาข้อสอบสำเร็จ`, "success");
      }
    } catch {
      showToast("เกิดข้อผิดพลาด", "error");
    }
  }

  function getQuizVisibilityStatus(quizId: string): {
    text: string;
    variant: "success" | "destructive" | "warning" | "secondary";
  } {
    const settings = quizSettings[quizId] || { isActive: true, scheduleStart: null, scheduleEnd: null };
    if (!settings.isActive) {
      return { text: "ปิดใช้งาน", variant: "destructive" };
    }

    const now = new Date();
    if (settings.scheduleStart) {
      const start = new Date(settings.scheduleStart);
      if (now < start) {
        return { text: "รอเปิด", variant: "warning" };
      }
    }
    if (settings.scheduleEnd) {
      const end = new Date(settings.scheduleEnd);
      if (now > end) {
        return { text: "หมดเวลา", variant: "secondary" };
      }
    }

    return { text: "แสดงอยู่", variant: "success" };
  }

  function formatDatetimeLocal(isoString: string | null): string {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toISOString().slice(0, 16);
  }

  // ============ Question Helpers ============

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      {
        id: prev.length + 1,
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
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateQuestion(index: number, field: keyof QuestionForm, value: string) {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function updateChoice(qIndex: number, cIndex: number, field: keyof ChoiceForm, value: string | boolean) {
    setQuestions((prev) => {
      const updated = [...prev];
      const q = { ...updated[qIndex] };
      const choices = [...q.choices];

      if (field === "isCorrect" && value === true) {
        // Uncheck all others
        choices.forEach((c, i) => {
          choices[i] = { ...c, isCorrect: i === cIndex };
        });
      } else {
        choices[cIndex] = { ...choices[cIndex], [field]: value };
      }

      q.choices = choices;
      updated[qIndex] = q;
      return updated;
    });
  }

  function addChoice(qIndex: number) {
    setQuestions((prev) => {
      const updated = [...prev];
      const q = { ...updated[qIndex] };
      q.choices = [...q.choices, { text: "", isCorrect: false, imageUrl: "" }];
      updated[qIndex] = q;
      return updated;
    });
  }

  function removeChoice(qIndex: number, cIndex: number) {
    setQuestions((prev) => {
      const updated = [...prev];
      const q = { ...updated[qIndex] };
      q.choices = q.choices.filter((_, i) => i !== cIndex);
      updated[qIndex] = q;
      return updated;
    });
  }

  // ============ Render ============

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const isEditing = !!editCourseId;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
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
          className="gap-1.5"
          onClick={() => router.push("/admin/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? "แก้ไขรายวิชา" : "สร้างรายวิชาใหม่"}
          </h1>
          <p className="text-sm text-gray-500">
            {isEditing
              ? isCustomCourse
                ? "รายวิชาที่สร้างเอง — แก้ไขได้ทั้งหมด"
                : "รายวิชาระบบ — แก้ไขข้อมูลและข้อสอบได้"
              : "สร้างหมวดหมู่รายวิชาใหม่พร้อมข้อสอบ"}
          </p>
        </div>
        {isEditing && isCustomCourse && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={deleteCourse}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ลบรายวิชา</span>
          </Button>
        )}
      </div>

      {/* Course Info Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-emerald-500" />
            ข้อมูลรายวิชา
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Icon & Title */}
          <div className="flex gap-3 items-start">
            <div className="relative">
              <button
                className="h-14 w-14 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-2xl hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                onClick={() => setShowIconPicker(!showIconPicker)}
                title="เลือกไอคอน"
              >
                {courseIcon}
              </button>
              {showIconPicker && (
                <div className="absolute top-16 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72">
                  <p className="text-xs text-gray-500 mb-2">เลือกไอคอน</p>
                  <div className="grid grid-cols-10 gap-1">
                    {ICON_OPTIONS.map((icon) => (
                      <button
                        key={icon}
                        className={`h-8 w-8 rounded-lg flex items-center justify-center text-lg hover:bg-gray-100 ${
                          courseIcon === icon
                            ? "bg-emerald-100 ring-2 ring-emerald-400"
                            : ""
                        }`}
                        onClick={() => {
                          setCourseIcon(icon);
                          setShowIconPicker(false);
                        }}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <Input
                      placeholder="หรือพิมพ์ emoji..."
                      className="text-sm"
                      value={courseIcon}
                      onChange={(e) => setCourseIcon(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                ชื่อรายวิชา *
              </label>
              <Input
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="เช่น พลเมืองที่ดี, ธรรมชาติบำบัด"
                className="text-base"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              คำอธิบายรายวิชา
            </label>
            <Input
              value={courseDescription}
              onChange={(e) => setCourseDescription(e.target.value)}
              placeholder="คำอธิบายสั้นๆ เกี่ยวกับรายวิชา..."
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              สีรายวิชา
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`h-8 w-8 rounded-full bg-linear-to-br ${opt.value} ${
                    courseColor === opt.value
                      ? "ring-2 ring-offset-2 ring-emerald-500 scale-110"
                      : "hover:scale-105"
                  } transition-transform`}
                  onClick={() => setCourseColor(opt.value)}
                  title={opt.label}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-xs text-gray-400 mb-2">ตัวอย่าง</p>
            <div className="flex items-center gap-3">
              <div
                className={`h-12 w-12 rounded-xl bg-linear-to-br ${courseColor} flex items-center justify-center text-xl shadow-sm`}
              >
                <span className="drop-shadow">{courseIcon}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {courseTitle || "ชื่อรายวิชา"}
                </p>
                <p className="text-xs text-gray-500">
                  {courseDescription || "คำอธิบายรายวิชา"}
                </p>
              </div>
            </div>
          </div>

          {/* Save Course Button */}
          <div className="flex gap-2 pt-2">
            <Button
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={saveCourse}
              disabled={saving}
            >
              <Save className="h-4 w-4" />
              {saving
                ? "กำลังบันทึก..."
                : isEditing
                ? "บันทึกการเปลี่ยนแปลง"
                : "สร้างรายวิชา"}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/admin/dashboard")}
            >
              ยกเลิก
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quiz Management (only when editing) */}
      {isEditing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-500" />
              ข้อสอบในรายวิชา ({quizzes.length})
            </h2>
            {isCustomCourse && (
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onClick={startNewQuiz}
              >
                <Plus className="h-3.5 w-3.5" />
                เพิ่มข้อสอบ
              </Button>
            )}
          </div>

          {/* Quiz List */}
          {quizzes.map((quiz) => {
            const isExpanded = expandedQuiz === quiz.id;
            const status = getQuizVisibilityStatus(quiz.id);
            const settings = quizSettings[quiz.id] || { isActive: true, scheduleStart: null, scheduleEnd: null };

            return (
              <Card
                key={quiz.id}
                className={`transition-all duration-200 ${
                  !settings.isActive ? "opacity-60 bg-gray-50 border-gray-200" : "border-gray-200"
                } ${editingQuiz === quiz.id ? "ring-2 ring-emerald-300" : ""}`}
              >
              <CardHeader className="py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {quiz.type === "pdf" ? (
                      <FileText className="h-5 w-5 text-red-500" />
                    ) : (
                      <HelpCircle className="h-5 w-5 text-emerald-500" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm">{quiz.title}</CardTitle>
                      <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                        {status.text}
                      </Badge>
                      <Badge
                        variant={quiz.type === "pdf" ? "warning" : "info"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {quiz.type === "pdf"
                          ? "PDF"
                          : `${quiz.questionCount} ข้อ`}
                      </Badge>
                    </div>
                    {quiz.description && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {quiz.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 sm:mt-0 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    <Button
                      size="sm"
                      variant={settings.isActive ? "default" : "outline"}
                      className={`gap-1.5 text-xs ${
                        settings.isActive
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "text-gray-500"
                      }`}
                      onClick={() => toggleQuiz(quiz.id)}
                    >
                      {settings.isActive ? (
                        <>
                          <Power className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">เปิด</span>
                        </>
                      ) : (
                        <>
                          <PowerOff className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">ปิด</span>
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-xs px-2"
                      onClick={() => setExpandedQuiz(isExpanded ? null : quiz.id)}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">ตั้งเวลา</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-emerald-600 shrink-0"
                      onClick={() =>
                        editingQuiz === quiz.id
                          ? cancelQuizEdit()
                          : startEditQuiz(quiz)
                      }
                    >
                      <PenLine className="h-3.5 w-3.5" />
                    </Button>
                    {isCustomCourse && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 shrink-0"
                        onClick={() => deleteQuiz(quiz.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {/* Schedule Form */}
              {isExpanded && !editingQuiz && (
                <CardContent className="pt-0 pb-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      ตั้งเวลาข้อสอบ
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          เริ่มทำข้อสอบได้
                        </label>
                        <Input
                          type="datetime-local"
                          className="bg-white text-sm"
                          value={formatDatetimeLocal(settings.scheduleStart)}
                          onChange={(e) =>
                            updateQuizSchedule(
                              quiz.id,
                              "scheduleStart",
                              e.target.value ? new Date(e.target.value).toISOString() : ""
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          ปิดรับข้อสอบ
                        </label>
                        <Input
                          type="datetime-local"
                          className="bg-white text-sm"
                          value={formatDatetimeLocal(settings.scheduleEnd)}
                          onChange={(e) =>
                            updateQuizSchedule(
                              quiz.id,
                              "scheduleEnd",
                              e.target.value ? new Date(e.target.value).toISOString() : ""
                            )
                          }
                        />
                      </div>
                    </div>

                    {(settings.scheduleStart || settings.scheduleEnd) && (
                      <div className="mt-3 text-xs text-gray-500 bg-white rounded-lg px-3 py-2 border">
                        {settings.scheduleStart && (
                          <p>
                            เริ่ม:{" "}
                            {new Date(settings.scheduleStart).toLocaleString("th-TH")}
                          </p>
                        )}
                        {settings.scheduleEnd && (
                          <p>
                            สิ้นสุด:{" "}
                            {new Date(settings.scheduleEnd).toLocaleString("th-TH")}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs"
                        onClick={() => saveQuizSchedule(quiz.id)}
                        disabled={saving}
                      >
                        <Save className="h-3 w-3" />
                        {saving ? "กำลังบันทึก..." : "บันทึกเวลา"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => clearQuizSchedule(quiz.id)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        ล้างเวลา
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}

              {/* Expanded quiz editor */}
              {editingQuiz === quiz.id && (
                <CardContent className="pt-0 pb-4">
                  <QuizEditor
                    quizTitle={quizTitle}
                    setQuizTitle={setQuizTitle}
                    quizDescription={quizDescription}
                    setQuizDescription={setQuizDescription}
                    quizType={quizType}
                    setQuizType={setQuizType}
                    driveFileId={driveFileId}
                    setDriveFileId={setDriveFileId}
                    questions={questions}
                    addQuestion={addQuestion}
                    removeQuestion={removeQuestion}
                    updateQuestion={updateQuestion}
                    updateChoice={updateChoice}
                    addChoice={addChoice}
                    removeChoice={removeChoice}
                    onSave={saveQuiz}
                    onCancel={cancelQuizEdit}
                    saving={saving}
                    isStaticQuiz={!isCustomCourse}
                  />
                </CardContent>
              )}
            </Card>
          )})}

          {/* New Quiz Editor */}
          {showNewQuiz && (
            <Card className="ring-2 ring-emerald-300">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-5 w-5 text-emerald-500" />
                  เพิ่มข้อสอบใหม่
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QuizEditor
                  quizTitle={quizTitle}
                  setQuizTitle={setQuizTitle}
                  quizDescription={quizDescription}
                  setQuizDescription={setQuizDescription}
                  quizType={quizType}
                  setQuizType={setQuizType}
                  driveFileId={driveFileId}
                  setDriveFileId={setDriveFileId}
                  questions={questions}
                  addQuestion={addQuestion}
                  removeQuestion={removeQuestion}
                  updateQuestion={updateQuestion}
                  updateChoice={updateChoice}
                  addChoice={addChoice}
                  removeChoice={removeChoice}
                  onSave={saveQuiz}
                  onCancel={cancelQuizEdit}
                  saving={saving}
                  isStaticQuiz={false}
                />
              </CardContent>
            </Card>
          )}

          {quizzes.length === 0 && !showNewQuiz && (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">ยังไม่มีข้อสอบในรายวิชานี้</p>
              {isCustomCourse && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5"
                  onClick={startNewQuiz}
                >
                  <Plus className="h-3.5 w-3.5" />
                  เพิ่มข้อสอบแรก
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Quiz Editor Component ============

interface QuizEditorProps {
  quizTitle: string;
  setQuizTitle: (v: string) => void;
  quizDescription: string;
  setQuizDescription: (v: string) => void;
  quizType: "quiz" | "pdf";
  setQuizType: (v: "quiz" | "pdf") => void;
  driveFileId: string;
  setDriveFileId: (v: string) => void;
  questions: QuestionForm[];
  addQuestion: () => void;
  removeQuestion: (i: number) => void;
  updateQuestion: (i: number, field: keyof QuestionForm, value: string) => void;
  updateChoice: (qi: number, ci: number, field: keyof ChoiceForm, value: string | boolean) => void;
  addChoice: (qi: number) => void;
  removeChoice: (qi: number, ci: number) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isStaticQuiz: boolean;
}

function QuizEditor({
  quizTitle,
  setQuizTitle,
  quizDescription,
  setQuizDescription,
  quizType,
  setQuizType,
  driveFileId,
  setDriveFileId,
  questions,
  addQuestion,
  removeQuestion,
  updateQuestion,
  updateChoice,
  addChoice,
  removeChoice,
  onSave,
  onCancel,
  saving,
  isStaticQuiz,
}: QuizEditorProps) {
  return (
    <div className="space-y-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
      {/* Quiz Title */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            ชื่อข้อสอบ *
          </label>
          <Input
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder="ชื่อข้อสอบ"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            คำอธิบาย
          </label>
          <Input
            value={quizDescription}
            onChange={(e) => setQuizDescription(e.target.value)}
            placeholder="คำอธิบายเพิ่มเติม (ไม่จำเป็น)"
          />
        </div>
      </div>

      {/* Quiz Type (only for non-static) */}
      {!isStaticQuiz && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={quizType === "quiz" ? "default" : "outline"}
            className={`gap-1.5 text-xs ${
              quizType === "quiz" ? "bg-emerald-600" : ""
            }`}
            onClick={() => setQuizType("quiz")}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            ข้อสอบ
          </Button>
          <Button
            size="sm"
            variant={quizType === "pdf" ? "default" : "outline"}
            className={`gap-1.5 text-xs ${
              quizType === "pdf" ? "bg-red-600" : ""
            }`}
            onClick={() => setQuizType("pdf")}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      )}

      {/* PDF input */}
      {quizType === "pdf" && (
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            Google Drive File ID
          </label>
          <Input
            value={driveFileId}
            onChange={(e) => setDriveFileId(e.target.value)}
            placeholder="เช่น 1wfaqi8ASthG8BJ3Sx_kybpB9FCDLVY98"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            คัดลอก ID จาก URL ของ Google Drive
          </p>
        </div>
      )}

      {/* Questions */}
      {quizType === "quiz" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              คำถาม ({questions.length} ข้อ)
            </p>
          </div>

          {questions.map((q, qi) => (
            <div
              key={qi}
              className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
            >
              <div className="flex items-start gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold mt-0.5">
                  {qi + 1}
                </span>
                <div className="flex-1 space-y-2">
                  <Input
                    value={q.text}
                    onChange={(e) => updateQuestion(qi, "text", e.target.value)}
                    placeholder="คำถาม..."
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={q.imageUrl}
                      onChange={(e) =>
                        updateQuestion(qi, "imageUrl", e.target.value)
                      }
                      placeholder="URL รูปประกอบ (ไม่จำเป็น)"
                      className="text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 shrink-0"
                      onClick={() => removeQuestion(qi)}
                      disabled={questions.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Choices */}
              <div className="ml-9 space-y-2">
                {q.choices.map((choice, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <button
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        choice.isCorrect
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-gray-300 hover:border-emerald-400"
                      }`}
                      onClick={() =>
                        updateChoice(qi, ci, "isCorrect", true)
                      }
                      title="ตั้งเป็นคำตอบที่ถูก"
                    >
                      {choice.isCorrect && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </button>
                    <Input
                      value={choice.text}
                      onChange={(e) =>
                        updateChoice(qi, ci, "text", e.target.value)
                      }
                      placeholder={`ตัวเลือก ${String.fromCharCode(65 + ci)}`}
                      className={`text-xs flex-1 ${
                        choice.isCorrect
                          ? "border-emerald-300 bg-emerald-50"
                          : ""
                      }`}
                    />
                    <Input
                      value={choice.imageUrl}
                      onChange={(e) =>
                        updateChoice(qi, ci, "imageUrl", e.target.value)
                      }
                      placeholder="URL รูป"
                      className="text-xs w-32 hidden sm:block"
                    />
                    {q.choices.length > 2 && (
                      <button
                        className="text-gray-400 hover:text-red-500 shrink-0"
                        onClick={() => removeChoice(qi, ci)}
                        aria-label="ลบตัวเลือก"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {q.choices.length < 6 && (
                  <button
                    className="text-xs text-emerald-500 hover:text-emerald-600 flex items-center gap-1 ml-7"
                    onClick={() => addChoice(qi)}
                  >
                    <Plus className="h-3 w-3" />
                    เพิ่มตัวเลือก
                  </button>
                )}
              </div>
            </div>
          ))}

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 w-full"
            onClick={addQuestion}
          >
            <Plus className="h-3.5 w-3.5" />
            เพิ่มคำถาม
          </Button>
        </div>
      )}

      {/* Save/Cancel */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <Button
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          onClick={onSave}
          disabled={saving}
        >
          <Save className="h-4 w-4" />
          {saving ? "กำลังบันทึก..." : "บันทึกข้อสอบ"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}

// ============ Page Export ============

export default function CourseManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-200 rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
      }
    >
      <CourseManagementContent />
    </Suspense>
  );
}
