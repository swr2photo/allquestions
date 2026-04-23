"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Download, List, LayoutGrid, Plus, Trash2, Search as SearchIcon, Calendar, BookOpen, Loader2, FileText, CheckCircle2, Cloud, Brain, X, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { domToPng } from "modern-screenshot";

declare global {
  interface Window {
    google: any;
  }
}

interface Course {
  id: number | string;
  subject: string;
  code: string;
  room: string;
  day: string;
  start: string;
  end: string;
  color: string;
  credits: number;
  isGened?: boolean;
}

interface UserInfo {
  email: string;
  name: string;
  picture: string;
  isAdmin?: boolean;
}

const COLORS = [
  "bg-blue-50 border-blue-200 text-blue-800",
  "bg-emerald-50 border-emerald-200 text-emerald-800",
  "bg-violet-50 border-violet-200 text-violet-800",
  "bg-amber-50 border-amber-200 text-amber-800",
  "bg-rose-50 border-rose-200 text-rose-800",
  "bg-indigo-50 border-indigo-200 text-indigo-800",
  "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-800",
  "bg-lime-50 border-lime-200 text-lime-800",
  "bg-sky-50 border-sky-200 text-sky-800",
  "bg-cyan-50 border-cyan-200 text-cyan-800",
  "bg-slate-100 border-slate-200 text-slate-800",
];

const DAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

export default function SchedulePage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mySchedule, setMySchedule] = useState<Course[]>([]);
  const [genedCourses, setGenedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [semester, setSemester] = useState("2/2568");
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const scheduleRef = useRef<HTMLDivElement>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const loadCloudSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule");
      if (res.ok) {
        const data = await res.json();
        if (data.schedule && data.schedule.length > 0) {
          setMySchedule(data.schedule);
        }
      }
    } catch (e) {
      console.warn("Failed to load cloud schedule", e);
    }
  }, []);

  // Authentication check
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/user");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
          loadCloudSchedule();
        }
      }
    } catch (e) {
      console.error("Auth check failed", e);
    } finally {
      setAuthLoading(false);
    }
  }, [loadCloudSchedule]);

  const handleGoogleResponse = useCallback(async (response: { credential?: string }) => {
    try {
      const res = await fetch("/api/auth/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        loadCloudSchedule();
        toast.success(`สวัสดีครับคุณ ${data.user.name}`);
      }
    } catch (err) {
      console.error("Login failed", err);
      toast.error("เข้าสู่ระบบไม่สำเร็จ");
    }
  }, [loadCloudSchedule]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load Google Script
  useEffect(() => {
    if (!user && !authLoading) {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) return;

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google && googleBtnRef.current) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleResponse,
          });
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: "outline", size: "large", width: 300, text: "signin_with"
          });
        }
      };
      document.head.appendChild(script);
      return () => {
        const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
        if (existing) existing.remove();
      };
    }
  }, [user, authLoading, handleGoogleResponse]);

  const saveToCloud = useCallback(async (currentSchedule: Course[]) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: currentSchedule }),
      });
    } catch (e) {
      console.error("Save failed", e);
      toast.error("บันทึกลงคลาวไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  // Fetch real GenEd courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch("/api/gened/courses");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        
        const mapped: Course[] = data.courses.map((c: { id: number; title: string; courseCode?: string; slug?: string; campuses: string[] }, index: number) => ({
          id: c.id,
          subject: c.title,
          code: c.slug || c.courseCode || "GENED",
          room: c.campuses.join(", ") || "N/A",
          day: DAYS[c.id % 5],
          start: `${(9 + (c.id % 4))}:00`.padStart(5, "0"),
          end: `${(11 + (c.id % 4))}:00`.padStart(5, "0"),
          color: COLORS[index % COLORS.length],
          credits: 3,
          isGened: true
        }));
        
        setGenedCourses(mapped);
      } catch (error) {
        console.error("Error fetching courses:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourses();
  }, []);

  const totalCredits = useMemo(() => {
    return mySchedule.reduce((sum, c) => sum + (c.credits || 0), 0);
  }, [mySchedule]);

  const filteredCourses = useMemo(() => {
    if (!searchQuery) return [];
    const lowerQuery = searchQuery.toLowerCase().trim();
    return genedCourses.filter(c => 
      c.subject.toLowerCase().includes(lowerQuery) ||
      (c.code && c.code.toLowerCase().includes(lowerQuery)) ||
      c.id.toString().includes(lowerQuery)
    ).slice(0, 30);
  }, [searchQuery, genedCourses]);

  const addCourse = (course: Course) => {
    const conflict = mySchedule.find(c => c.day === course.day && (
      (parseFloat(course.start.replace(':', '.')) >= parseFloat(c.start.replace(':', '.')) && parseFloat(course.start.replace(':', '.')) < parseFloat(c.end.replace(':', '.'))) ||
      (parseFloat(course.end.replace(':', '.')) > parseFloat(c.start.replace(':', '.')) && parseFloat(course.end.replace(':', '.')) <= parseFloat(c.end.replace(':', '.')))
    ));

    if (conflict) {
      toast.error(`เวลาเรียนซ้อนทับกับวิชา: ${conflict.subject}`);
      return;
    }

    const newSchedule = [...mySchedule, course];
    setMySchedule(newSchedule);
    saveToCloud(newSchedule);
    toast.success(`เพิ่มวิชา ${course.subject} เรียบร้อยแล้ว`);
  };

  const removeCourse = (id: number | string) => {
    const newSchedule = mySchedule.filter(c => c.id !== id);
    setMySchedule(newSchedule);
    saveToCloud(newSchedule);
    toast.success("ลบวิชาเรียบร้อยแล้ว");
  };

  const handleDownload = async () => {
    if (!scheduleRef.current) return;
    setIsExporting(true);
    const loadingToast = toast.loading("กำลังเตรียมไฟล์ตารางเรียน...");
    try {
      const dataUrl = await domToPng(scheduleRef.current, {
        scale: 2, backgroundColor: "#ffffff", quality: 1
      });
      const link = document.createElement("a");
      link.download = `ตารางเรียน_${semester.replace("/", "-")}.png`;
      link.href = dataUrl;
      link.click();
      toast.dismiss(loadingToast);
      toast.success("ดาวน์โหลดตารางเรียนเรียบร้อยแล้ว");
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("เกิดข้อผิดพลาดในการดาวน์โหลด");
    } finally {
      setIsExporting(false);
    }
  };

  const getStyleForClass = (start: string, end: string) => {
    const startHour = parseFloat(start.split(":")[0]) + parseFloat(start.split(":")[1]) / 60;
    const endHour = parseFloat(end.split(":")[0]) + parseFloat(end.split(":")[1]) / 60;
    const duration = endHour - startHour;
    
    // Grid starts at 08:00
    const offset = startHour - 8;
    
    return {
      left: `${(offset / 10) * 100}%`,
      width: `${(duration / 10) * 100}%`,
    };
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#fcfcfd] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl shadow-emerald-500/10 border border-gray-100 p-8 text-center animate-in zoom-in-95 duration-500">
          <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
            <Cloud className="h-10 w-10 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">เข้าสู่ระบบเพื่อจัดตารางเรียน</h1>
          <p className="text-gray-500 text-sm mb-8 font-medium leading-relaxed">
            กรุณาเข้าสู่ระบบด้วย Google เพื่อบันทึกตารางเรียนของคุณลงบนคลาวด์ 
            และเข้าถึงฟีเจอร์คำนวณหน่วยกิตอัตโนมัติ
          </p>
          
          <div className="flex flex-col items-center gap-4">
            <div ref={googleBtnRef} />
            <Button variant="ghost" className="text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:bg-gray-50" onClick={() => window.location.href="/"}>
              กลับหน้าแรก
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#fcfcfd] flex items-center justify-center p-4">
        <div className="max-w-md w-full relative">
          {/* Decorative backgrounds */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-emerald-100/50 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-100/50 rounded-full blur-3xl" />
          
          <div className="relative bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-emerald-500/10 border border-white/50 p-10 text-center overflow-hidden animate-in fade-in zoom-in duration-700">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-emerald-400 via-teal-500 to-blue-500" />
            
            <div className="relative mb-8">
              <div className="h-24 w-24 bg-linear-to-br from-emerald-500 to-teal-600 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-emerald-200 rotate-3 transition-transform hover:rotate-0 duration-500">
                <Calendar className="h-12 w-12" />
              </div>
              <div className="absolute -top-2 -right-2 h-10 w-10 bg-amber-400 text-white rounded-2xl flex items-center justify-center shadow-lg animate-bounce">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>
            
            <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
              Coming Soon!
            </h1>
            
            <div className="space-y-4 mb-10">
              <p className="text-gray-600 font-medium leading-relaxed">
                ฟีเจอร์ <span className="text-emerald-600 font-bold">จัดตารางเรียน</span> กำลังอยู่ระหว่างการปรับแต่งให้สมบูรณ์แบบ
              </p>
              <div className="flex items-center justify-center gap-2 py-2 px-4 bg-emerald-50 rounded-2xl w-fit mx-auto border border-emerald-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">In Development</span>
              </div>
            </div>
            
            <Button 
              className="w-full h-14 rounded-2xl bg-gray-900 hover:bg-black text-white font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-gray-200 active:scale-95 transition-all"
              onClick={() => window.location.href="/"}
            >
              กลับหน้าแรก
            </Button>
            
            <p className="mt-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              แล้วพบกันเร็ว ๆ นี้
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex flex-col pb-20 overflow-x-hidden">
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl animate-in fade-in duration-700">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Side: Search and List */}
          <div className="w-full lg:w-1/3 flex flex-col gap-6 no-export">
            {/* Credits Dashboard */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-500/10 bg-linear-to-br from-white to-emerald-50/30">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <Brain className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-black text-gray-900 leading-tight">
                    ภาพรวมหน่วยกิต
                  </h2>
                </div>
                <div className="shrink-0 flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                  <span className="text-xs font-black leading-none">{totalCredits}</span>
                  <span className="text-[8px] font-bold uppercase tracking-tighter mt-0.5">หน่วยกิต</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200 p-0.5">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.4)]" 
                    style={{ width: `${Math.min((totalCredits / 22) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center px-1">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                    {totalCredits >= 22 ? "⚠️ เกินโควตาปกติ" : `ลงได้อีก ${22 - totalCredits} หน่วยกิต`}
                  </p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Max 22</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-black text-gray-900 leading-tight">
                  ค้นหาวิชาเรียน
                </h2>
              </div>
              
              <div className="relative">
                <Input 
                  placeholder="รหัสวิชา หรือ ชื่อวิชา..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 h-12 bg-gray-50 border-gray-100 focus:ring-emerald-500 rounded-2xl text-sm font-medium"
                />
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors">
                    <X className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">กำลังดึงข้อมูลวิชา...</p>
                </div>
              ) : searchQuery && (
                <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredCourses.length > 0 ? (
                    filteredCourses.map(course => (
                      <div key={course.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:border-emerald-200 transition-all group">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[9px] font-black text-emerald-700 uppercase">{course.day}</span>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{course.start}-{course.end}</span>
                            </div>
                            <h4 className="text-sm font-bold text-gray-900 leading-tight mb-1">{course.subject}</h4>
                            <p className="text-[10px] text-gray-500 font-medium truncate">📍 {course.room} | 💎 {course.credits} Cr.</p>
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 rounded-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 shrink-0"
                            onClick={() => addCourse(course)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-4 text-sm text-gray-500">ไม่พบวิชาที่ค้นหา</p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex-1">
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <List className="h-5 w-5 text-emerald-500" />
                วิชาที่เลือก ({mySchedule.length})
              </h2>
              <div className="space-y-3">
                {mySchedule.length > 0 ? (
                  mySchedule.map(course => (
                    <div key={course.id} className="p-3 rounded-xl border border-gray-100 flex justify-between items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-gray-800 truncate">{course.subject}</h4>
                        <p className="text-[10px] text-gray-500">{course.day} | {course.start} - {course.end} ({course.credits} Cr.)</p>
                      </div>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 rounded-full text-red-400 hover:bg-red-50 hover:text-red-500 shrink-0"
                        onClick={() => removeCourse(course.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">ยังไม่ได้เลือกวิชาเรียน</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Visual Schedule */}
          <div className="flex-1 flex flex-col gap-8" ref={scheduleRef}>
            {/* Toolbar Area */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="p-3.5 bg-emerald-500 text-white rounded-[1.5rem] shadow-lg shadow-emerald-500/25 transition-transform hover:scale-105">
                  <Calendar className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">ตารางเรียนของฉัน</h1>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    ) : (
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-tighter animate-in fade-in border border-emerald-100 shadow-xs">
                        <Cloud className="h-2.5 w-2.5" />
                        Cloud Synced
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">Semester {semester} • {user.name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto no-export">
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-200 shadow-xs">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ภาคการศึกษา</span>
                  <select 
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="bg-transparent text-sm font-black text-gray-700 focus:outline-none cursor-pointer"
                  >
                    <option value="2/2568">2/2568</option>
                    <option value="1/2568">1/2568</option>
                  </select>
                </div>
                
                <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
                  <button 
                    className={`p-2 rounded-xl transition-all duration-300 ${viewMode === "grid" ? "bg-white text-emerald-600 shadow-sm scale-105" : "text-gray-400 hover:text-gray-600"}`}
                    onClick={() => setViewMode("grid")}
                    title="มุมมองตาราง"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button 
                    className={`p-2 rounded-xl transition-all duration-300 ${viewMode === "list" ? "bg-white text-emerald-600 shadow-sm scale-105" : "text-gray-400 hover:text-gray-600"}`}
                    onClick={() => setViewMode("list")}
                    title="มุมมองรายการ"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
                
                <Button 
                  className="rounded-2xl gap-2 bg-[#2d4b5a] hover:bg-[#1f3642] text-white px-5 h-11 font-black shadow-lg shadow-slate-900/10 active:scale-95 transition-all"
                  onClick={handleDownload}
                  disabled={isExporting}
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span className="hidden sm:inline uppercase tracking-widest text-[11px]">Export</span>
                </Button>
              </div>
            </div>

            {viewMode === "grid" ? (
              /* New Refined Schedule Grid Display */
              <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-gray-100 p-6 sm:p-8">
                <div className="overflow-x-auto custom-scrollbar pb-4">
                  <div className="min-w-[950px]">
                    {/* Time Header Labels */}
                    <div className="flex mb-6">
                      <div className="w-24 shrink-0" />
                      <div className="flex-1 flex">
                        {HOURS.slice(0, -1).map((hour) => (
                          <div key={hour} className="flex-1 text-center">
                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">{hour}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Schedule Rows */}
                    <div className="space-y-4">
                      {DAYS.map((day) => (
                        <div key={day} className="flex gap-4 group">
                          {/* Day Label */}
                          <div className="w-24 shrink-0 flex items-center justify-center">
                            <span className="text-sm font-black text-gray-700 uppercase tracking-widest group-hover:text-emerald-500 transition-colors duration-300">{day}</span>
                          </div>
                          
                          {/* Time Slots Row */}
                          <div className="flex-1 relative h-24 bg-gray-50/30 rounded-[1.5rem] border border-gray-100 transition-all duration-500 group-hover:bg-white group-hover:border-emerald-100 group-hover:shadow-lg group-hover:shadow-emerald-500/5 overflow-hidden">
                            {/* Visual Grid Lines */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {HOURS.slice(0, -1).map((hour) => (
                                <div key={hour} className="flex-1 border-r border-gray-100/50 last:border-r-0" />
                              ))}
                            </div>

                            {/* Class Content Container */}
                            <div className="absolute inset-0 px-1 py-2">
                              <div className="relative w-full h-full">
                                {mySchedule.filter(c => c.day === day).map((cls) => (
                                  <div 
                                    key={cls.id}
                                    className={`absolute top-0 bottom-0 rounded-2xl border ${cls.color} p-3.5 flex flex-col justify-between shadow-sm cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:brightness-95 transition-all duration-500 animate-in zoom-in-95 group/card z-10`}
                                    style={getStyleForClass(cls.start, cls.end)}
                                    title={cls.subject}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-[10px] font-black truncate leading-tight uppercase tracking-tight group-hover/card:whitespace-normal group-hover/card:overflow-visible group-hover/card:bg-white group-hover/card:rounded group-hover/card:p-1 group-hover/card:shadow-lg group-hover/card:relative group-hover/card:z-50 transition-all">{cls.subject}</div>
                                      <div className="text-[9px] font-bold mt-1.5 opacity-60 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                        {cls.room}
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-end mt-1">
                                      <div className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-white/40 border border-black/5 opacity-60 uppercase">{cls.credits} Cr.</div>
                                      <div className="text-[8px] font-black text-gray-500 opacity-60 tabular-nums">{cls.start} - {cls.end}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Schedule List Display */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
                {DAYS.map(day => {
                  const dayCourses = mySchedule.filter(c => c.day === day);
                  if (dayCourses.length === 0) return null;
                  
                  return (
                    <div key={day} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
                      <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
                        <div className="w-2 h-7 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/20" />
                        วัน{day}
                      </h3>
                      <div className="space-y-4">
                        {dayCourses.map(course => (
                          <div key={course.id} className={`p-5 rounded-2xl border ${course.color.replace('bg-', 'bg-opacity-60 bg-')} hover:scale-[1.02] transition-transform duration-300`}>
                            <div className="flex justify-between items-start gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-white/50 text-gray-700 border border-white shadow-xs">{course.start} - {course.end}</span>
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-emerald-500 text-white shadow-sm">{course.credits} Credits</span>
                                </div>
                                <h4 className="text-base font-bold text-gray-900 leading-tight tracking-tight">{course.subject}</h4>
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="p-1 rounded-md bg-white/30"><SearchIcon className="h-3 w-3 text-gray-400" /></div>
                                  <p className="text-xs font-bold text-gray-500 truncate uppercase tracking-tighter">{course.code}</p>
                                  <span className="text-gray-300">|</span>
                                  <p className="text-xs font-bold text-emerald-600 truncate">📍 {course.room}</p>
                                </div>
                              </div>
                              <div className="p-2.5 bg-white/60 rounded-xl shadow-sm">
                                <FileText className="h-5 w-5 text-emerald-500/60" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {mySchedule.length === 0 && (
                  <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border border-dashed border-gray-300 animate-pulse">
                    <Calendar className="h-16 w-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-sm">ไม่พบข้อมูลรายวิชาในตาราง</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Footer Info */}
      <div className="container mx-auto px-4 mt-8 no-export animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="bg-emerald-500 text-white rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-emerald-500/20 border border-emerald-400">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-md">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest leading-none mb-1">ตารางเรียนของคุณพร้อมใช้งานแล้ว</p>
              <p className="text-[10px] text-emerald-50 font-medium opacity-80">
                ข้อมูลในหน้านี้ถูกจัดเก็บลงบนระบบ Cloud อัตโนมัติ (kv-database) ข้อมูลอาจมีการเปลี่ยนแปลงตามประกาศของมหาวิทยาลัย
              </p>
            </div>
          </div>
          <Button variant="outline" className="bg-white/10 hover:bg-white/20 border-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            กลับไปข้างบน
          </Button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-export { display: none !important; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
    </div>
  );
}
