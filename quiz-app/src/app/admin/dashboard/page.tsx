"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  LogOut,
  BookOpen,
  HelpCircle,
  FileText,
  Power,
  PowerOff,
  Calendar,
  Clock,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  GraduationCap,
  ArrowUpDown,
  Plus,
  Trash2,
  PenLine,
  Sparkles,
  RefreshCw,
  User,
  Loader2,
} from "lucide-react";
import type { CourseSettings } from "@/types";

interface CourseWithSettings {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  quizCount: number;
  questionCount: number;
  pdfCount: number;
  isCustomCourse?: boolean;
  settings: CourseSettings;
}

interface AIQuota {
  email: string;
  usage: number;
  limit: number;
}

type ToastType = "success" | "error";

interface CustomQuizItem {
  id: string;
  courseId: string;
  title: string;
  type: "quiz" | "pdf";
  questionCount: number;
  createdAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseWithSettings[]>([]);
  const [customQuizzes, setCustomQuizzes] = useState<CustomQuizItem[]>([]);
  const [aiQuotas, setAiQuotas] = useState<AIQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingQuota, setResettingQuota] = useState<string | null>(null);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // User info state (Google account)
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; picture: string } | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchAIQuotas = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/quotas");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAiQuotas(data.quotas);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const [coursesRes, quizzesRes] = await Promise.all([
        fetch("/api/admin/courses"),
        fetch("/api/admin/quizzes"),
        fetchAIQuotas(),
      ]);

      if (coursesRes.status === 401) {
        router.push("/admin");
        return;
      }

      const coursesData = await coursesRes.json();
      if (coursesData.success) {
        setCourses(coursesData.courses);
      }

      if (quizzesRes.ok) {
        const quizzesData = await quizzesRes.json();
        if (quizzesData.success && quizzesData.quizzes) {
          // Flatten grouped quizzes into a flat list
          const flat: CustomQuizItem[] = [];
          const grouped = quizzesData.quizzes;
          for (const courseId of Object.keys(grouped)) {
            for (const q of grouped[courseId]) {
              flat.push({
                id: q.id,
                courseId: q.courseId,
                title: q.title,
                type: q.type,
                questionCount: q.questions?.length || 0,
                createdAt: q.createdAt,
              });
            }
          }
          setCustomQuizzes(flat);
        }
      }
    } catch {
      showToast("โหลดข้อมูลไม่สำเร็จ", "error");
    } finally {
      setLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    fetchCourses();
    // Fetch user info
    fetch("/api/admin/auth")
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push("/admin");
        } else if (data.user) {
          setUserInfo(data.user);
        }
      })
      .catch(() => {});
  }, [fetchCourses, router]);

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin");
  }

  // Toggle course active/inactive
  async function toggleCourse(courseId: string) {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;

    const newActive = !course.settings.isActive;

    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });

      if (res.status === 401) {
        router.push("/admin");
        return;
      }

      if (res.ok) {
        setCourses((prev) =>
          prev.map((c) =>
            c.id === courseId
              ? { ...c, settings: { ...c.settings, isActive: newActive } }
              : c
          )
        );
        showToast(
          `${course.title}: ${newActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}แล้ว`,
          "success"
        );
      }
    } catch {
      showToast("เกิดข้อผิดพลาด", "error");
    }
  }

  // Update schedule
  async function updateSchedule(
    courseId: string,
    field: "scheduleStart" | "scheduleEnd",
    value: string
  ) {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === courseId
          ? {
              ...c,
              settings: {
                ...c.settings,
                [field]: value || null,
              },
            }
          : c
      )
    );
  }

  // Save schedule for a course
  async function saveSchedule(courseId: string) {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleStart: course.settings.scheduleStart,
          scheduleEnd: course.settings.scheduleEnd,
        }),
      });

      if (res.status === 401) {
        router.push("/admin");
        return;
      }

      if (res.ok) {
        showToast(`บันทึกตั้งเวลา ${course.title} สำเร็จ`, "success");
      }
    } catch {
      showToast("บันทึกไม่สำเร็จ", "error");
    } finally {
      setSaving(false);
    }
  }

  // Clear schedule for a course
  async function clearSchedule(courseId: string) {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;

    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleStart: null,
          scheduleEnd: null,
        }),
      });

      if (res.ok) {
        setCourses((prev) =>
          prev.map((c) =>
            c.id === courseId
              ? {
                  ...c,
                  settings: {
                    ...c.settings,
                    scheduleStart: null,
                    scheduleEnd: null,
                  },
                }
              : c
          )
        );
        showToast(`ล้างการตั้งเวลา ${course.title} สำเร็จ`, "success");
      }
    } catch {
      showToast("เกิดข้อผิดพลาด", "error");
    }
  }

  // Move course order
  async function moveCourse(courseId: string, direction: "up" | "down") {
    const idx = courses.findIndex((c) => c.id === courseId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === courses.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newCourses = [...courses];
    const temp = newCourses[idx];
    newCourses[idx] = newCourses[swapIdx];
    newCourses[swapIdx] = temp;

    // Update order values
    newCourses.forEach((c, i) => {
      c.settings.order = i;
    });

    setCourses(newCourses);

    // Save batch
    try {
      await fetch("/api/admin/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: newCourses.map((c, i) => ({
            courseId: c.id,
            order: i,
          })),
        }),
      });
    } catch {
      showToast("บันทึกลำดับไม่สำเร็จ", "error");
    }
  }

  // Delete custom quiz
  async function deleteQuiz(quizId: string) {
    if (!confirm("ต้องการลบข้อสอบนี้ใช่หรือไม่?")) return;

    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCustomQuizzes((prev) => prev.filter((q) => q.id !== quizId));
        showToast("ลบข้อสอบสำเร็จ", "success");
      }
    } catch {
      showToast("ลบไม่สำเร็จ", "error");
    }
  }

  // Reset AI quota for a user
  async function resetAIQuota(email: string) {
    if (!confirm(`ต้องการรีเซ็ตโควตาของ ${email} ใช่หรือไม่?`)) return;
    
    setResettingQuota(email);
    try {
      const res = await fetch(`/api/admin/ai/quotas?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAiQuotas(prev => prev.filter(q => q.email !== email));
        showToast(`รีเซ็ตโควตาของ ${email} สำเร็จ`, "success");
      }
    } catch {
      showToast("รีเซ็ตไม่สำเร็จ", "error");
    } finally {
      setResettingQuota(null);
    }
  }

  // Get visibility status text
  function getVisibilityStatus(settings: CourseSettings): {
    text: string;
    variant: "success" | "destructive" | "warning" | "secondary";
  } {
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

  // Format datetime for input
  function formatDatetimeLocal(isoString: string | null): string {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toISOString().slice(0, 16);
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const activeCourses = courses.filter((c) => c.settings.isActive).length;
  const totalQuestions = courses.reduce((sum, c) => sum + c.questionCount, 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Toast notification */}
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
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-green-600 text-white shadow-md overflow-hidden">
            {userInfo?.picture ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={userInfo.picture} alt="" className="h-12 w-12 object-cover" />
            ) : (
              <Shield className="h-6 w-6" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">แผงควบคุมผู้ดูแลระบบ</h1>
            <p className="text-sm text-gray-500">
              {userInfo ? userInfo.email : "จัดการรายวิชาและการแสดงผล"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/quiz">
            <Button
              size="sm"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">เพิ่มข้อสอบ</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-600">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{courses.length}</p>
            <p className="text-xs text-gray-500">รายวิชาทั้งหมด</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-600">
            <Power className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{activeCourses}</p>
            <p className="text-xs text-gray-500">เปิดใช้งาน</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-teal-100 text-teal-600">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{totalQuestions}</p>
            <p className="text-xs text-gray-500">คำถามทั้งหมด</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-red-100 text-red-600">
            <PowerOff className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">
              {courses.length - activeCourses}
            </p>
            <p className="text-xs text-gray-500">ปิดใช้งาน</p>
          </div>
        </div>
      </div>

      {/* Course list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">จัดการรายวิชา</h2>
          <div className="flex items-center gap-2">
            <Link href="/admin/courses">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                สร้างรายวิชา
              </Button>
            </Link>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <ArrowUpDown className="h-3.5 w-3.5" />
              กดลูกศรเพื่อเรียงลำดับ
            </div>
          </div>
        </div>

        {courses.map((course, index) => {
          const status = getVisibilityStatus(course.settings);
          const isExpanded = expandedCourse === course.id;

          return (
            <Card
              key={course.id}
              className={`transition-all duration-200 ${
                !course.settings.isActive
                  ? "opacity-60 border-gray-200 bg-gray-50"
                  : "border-gray-200"
              }`}
            >
              <CardHeader className="py-4">
                <div className="flex items-center gap-3">
                  {/* Order controls */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      onClick={() => moveCourse(course.id, "up")}
                      disabled={index === 0}
                      aria-label="เลื่อนขึ้น"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      onClick={() => moveCourse(course.id, "down")}
                      disabled={index === courses.length - 1}
                      aria-label="เลื่อนลง"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Course info */}
                  <span className="text-2xl">{course.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{course.title}</CardTitle>
                      <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                        {status.text}
                      </Badge>
                      {course.isCustomCourse && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          กำหนดเอง
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {course.quizCount} ข้อสอบ
                      </span>
                      <span className="flex items-center gap-1">
                        <HelpCircle className="h-3 w-3" />
                        {course.questionCount} คำถาม
                      </span>
                      {course.pdfCount > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {course.pdfCount} PDF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={course.settings.isActive ? "default" : "outline"}
                      className={`gap-1.5 text-xs ${
                        course.settings.isActive
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "text-gray-500"
                      }`}
                      onClick={() => toggleCourse(course.id)}
                    >
                      {course.settings.isActive ? (
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

                    <Link href={`/admin/courses?edit=${course.id}`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs text-emerald-600 hover:text-emerald-700"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">แก้ไข</span>
                      </Button>
                    </Link>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-xs"
                      onClick={() =>
                        setExpandedCourse(isExpanded ? null : course.id)
                      }
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">ตั้งเวลา</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Expanded schedule section */}
              {isExpanded && (
                <CardContent className="pt-0 pb-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      ตั้งเวลาแสดงผล
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          เริ่มแสดง
                        </label>
                        <Input
                          type="datetime-local"
                          className="bg-white text-sm"
                          value={formatDatetimeLocal(
                            course.settings.scheduleStart
                          )}
                          onChange={(e) =>
                            updateSchedule(
                              course.id,
                              "scheduleStart",
                              e.target.value
                                ? new Date(e.target.value).toISOString()
                                : ""
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          หยุดแสดง
                        </label>
                        <Input
                          type="datetime-local"
                          className="bg-white text-sm"
                          value={formatDatetimeLocal(
                            course.settings.scheduleEnd
                          )}
                          onChange={(e) =>
                            updateSchedule(
                              course.id,
                              "scheduleEnd",
                              e.target.value
                                ? new Date(e.target.value).toISOString()
                                : ""
                            )
                          }
                        />
                      </div>
                    </div>

                    {/* Schedule status info */}
                    {(course.settings.scheduleStart ||
                      course.settings.scheduleEnd) && (
                      <div className="mt-3 text-xs text-gray-500 bg-white rounded-lg px-3 py-2 border">
                        {course.settings.scheduleStart && (
                          <p>
                            เริ่ม:{" "}
                            {new Date(
                              course.settings.scheduleStart
                            ).toLocaleString("th-TH")}
                          </p>
                        )}
                        {course.settings.scheduleEnd && (
                          <p>
                            สิ้นสุด:{" "}
                            {new Date(
                              course.settings.scheduleEnd
                            ).toLocaleString("th-TH")}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs"
                        onClick={() => saveSchedule(course.id)}
                        disabled={saving}
                      >
                        <Save className="h-3 w-3" />
                        {saving ? "กำลังบันทึก..." : "บันทึกเวลา"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => clearSchedule(course.id)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        ล้างเวลา
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="mt-8 text-center text-xs text-gray-400">
        <p>ข้อมูลจะมีผลทันทีเมื่อบันทึก • รายวิชาที่ปิดจะไม่แสดงในหน้าสาธารณะ</p>
      </div>

      {/* Custom quizzes section */}
      {customQuizzes.length > 0 && (
        <div className="mt-10 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Plus className="h-5 w-5" />
              ข้อสอบที่สร้างเอง ({customQuizzes.length})
            </h2>
            <Link href="/admin/quiz">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                เพิ่มข้อสอบ
              </Button>
            </Link>
          </div>

          {customQuizzes.map((quiz) => {
            const course = courses.find((c) => c.id === quiz.courseId);
            return (
              <Card key={quiz.id} className="border-gray-200">
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
                        <Badge
                          variant={quiz.type === "pdf" ? "warning" : "info"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {quiz.type === "pdf" ? "PDF" : `${quiz.questionCount} ข้อ`}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          กำหนดเอง
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {course?.icon} {course?.title || quiz.courseId} •{" "}
                        {new Date(quiz.createdAt).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/admin/quiz?edit=${quiz.id}`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-emerald-600"
                        >
                          <PenLine className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                        onClick={() => deleteQuiz(quiz.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
      {/* AI Usage Section */}
      <div className="mt-10 space-y-3 pb-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            การใช้งาน AI ของผู้ใช้ ({aiQuotas.length})
          </h2>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-xs text-gray-500 gap-1.5"
            onClick={fetchAIQuotas}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            โหลดข้อมูลใหม่
          </Button>
        </div>

        {aiQuotas.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-dashed border-gray-200">
            <p className="text-sm text-gray-400">ยังไม่มีข้อมูลการใช้งาน AI ในขณะนี้</p>
          </div>
        ) : (
          <div className="space-y-2">
            {aiQuotas.map((quota) => (
              <Card key={quota.email} className="border-gray-200 hover:shadow-sm transition-shadow">
                <CardHeader className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{quota.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[150px]">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              quota.usage >= quota.limit ? "bg-red-500" : "bg-violet-500"
                            }`}
                            style={{ width: `${Math.min(100, (quota.usage / quota.limit) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold ${
                          quota.usage >= quota.limit ? "text-red-500" : "text-violet-600"
                        }`}>
                          {quota.usage} / {quota.limit}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5 px-2 h-8"
                      onClick={() => resetAIQuota(quota.email)}
                      disabled={resettingQuota === quota.email}
                    >
                      {resettingQuota === quota.email ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      <span className="hidden sm:inline">รีเซ็ต</span>
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
