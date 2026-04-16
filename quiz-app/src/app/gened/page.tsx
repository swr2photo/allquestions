"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  ExternalLink,
  RefreshCw,
  Search,
  GraduationCap,
  MapPin,
  Loader2,
  AlertTriangle,
  Filter,
} from "lucide-react";

interface Course {
  id: number;
  title: string;
  slug: string;
  link: string;
  categories: number[];
  courseCode: string | null;
  geLevels: string[];
  campuses: string[];
}

interface Summary {
  totalCourses: number;
  byGeLevel: Record<string, number>;
  byCampus: Record<string, number>;
}

interface ApiResponse {
  courses: Course[];
  categories: unknown[];
  summary: Summary;
  source: string;
  fetchedAt: number;
}

const GE_ORDER = ["GE1", "GE2", "GE2A", "GE2B", "GE3", "GE4", "GE5", "GE6", "GE7", "GE8"];
const CAMPUS_ORDER = ["หาดใหญ่", "ปัตตานี", "ภูเก็ต", "สุราษฎร์ธานี", "ตรัง"];

const GE_DESCRIPTIONS: Record<string, string> = {
  GE1: "ศิลปะการสื่อสารและภาษา",
  GE2: "การคิดเชิงตรรกะและเชิงระบบ",
  GE2A: "การคิดเชิงตรรกะและตัวเลข",
  GE2B: "การคิดเชิงระบบ",
  GE3: "กรอบความคิดผู้ประกอบการ",
  GE4: "เทคโนโลยีดิจิทัล",
  GE5: "สุขภาวะองค์รวม",
  GE6: "จิตสาธารณะและการพัฒนายั่งยืน",
  GE7: "มนุษยชาติและสิ่งแวดล้อม",
  GE8: "รายวิชาเลือกเสรี",
};

export default function GenEdPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [geFilter, setGeFilter] = useState<string>("all");
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const fetchCourses = async (force?: boolean) => {
    try {
      if (force) setRefreshing(true);
      const res = await fetch(`/api/gened/courses${force ? "?refresh=1" : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError("ไม่สามารถโหลดข้อมูลจาก gened.psu.ac.th ได้");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setError(null);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [] as Course[];
    const q = query.trim().toLowerCase();
    return data.courses.filter((c) => {
      if (geFilter !== "all" && !c.geLevels.includes(geFilter)) return false;
      if (campusFilter !== "all" && !c.campuses.includes(campusFilter)) return false;
      if (q && !c.title.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, geFilter, campusFilter, query]);

  const geLevels = useMemo(() => {
    if (!data) return [] as string[];
    const present = new Set(Object.keys(data.summary.byGeLevel));
    return GE_ORDER.filter((g) => present.has(g));
  }, [data]);

  const campuses = useMemo(() => {
    if (!data) return [] as string[];
    const present = new Set(Object.keys(data.summary.byCampus));
    return CAMPUS_ORDER.filter((c) => present.has(c));
  }, [data]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-500 text-white shadow-md">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">รายวิชาเลือกเสรี</h1>
              <p className="text-gray-500 mt-1">
                หมวดวิชาศึกษาทั่วไป (GenEd) จาก{" "}
                <Link
                  href="https://gened.psu.ac.th/"
                  target="_blank"
                  className="text-amber-600 hover:underline"
                >
                  gened.psu.ac.th
                  <ExternalLink className="inline h-3 w-3 ml-0.5" />
                </Link>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fetchCourses(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            อัปเดตข้อมูล
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100 text-amber-600">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{data.summary.totalCourses}</p>
                <p className="text-xs text-gray-500">รายวิชาทั้งหมด</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-600">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{geLevels.length}</p>
                <p className="text-xs text-gray-500">หมวด GE</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{campuses.length}</p>
                <p className="text-xs text-gray-500">วิทยาเขต</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-violet-100 text-violet-600">
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{filtered.length}</p>
                <p className="text-xs text-gray-500">ตรงกับการค้นหา</p>
              </div>
            </div>
          </div>

          {/* Filter bar */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <Input
                placeholder="ค้นหาด้วยชื่อวิชา หรือรหัสวิชา..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="text-sm border-gray-200"
              />
            </div>

            {/* GE level chips */}
            <div>
              <p className="text-xs text-gray-500 mb-2">หมวด GE</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <FilterChip
                  label={`ทั้งหมด (${data.summary.totalCourses})`}
                  active={geFilter === "all"}
                  onClick={() => setGeFilter("all")}
                />
                {geLevels.map((g) => (
                  <FilterChip
                    key={g}
                    label={`${g} (${data.summary.byGeLevel[g] ?? 0})`}
                    title={GE_DESCRIPTIONS[g]}
                    active={geFilter === g}
                    onClick={() => setGeFilter(g)}
                  />
                ))}
              </div>
            </div>

            {/* Campus chips */}
            <div>
              <p className="text-xs text-gray-500 mb-2">วิทยาเขต</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <FilterChip
                  label="ทุกวิทยาเขต"
                  active={campusFilter === "all"}
                  onClick={() => setCampusFilter("all")}
                />
                {campuses.map((c) => (
                  <FilterChip
                    key={c}
                    label={`${c} (${data.summary.byCampus[c] ?? 0})`}
                    active={campusFilter === c}
                    onClick={() => setCampusFilter(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Course list */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-dashed border-gray-200">
              <p className="text-sm text-gray-400">ไม่พบรายวิชาที่ตรงกับเงื่อนไข</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((course) => (
                <a
                  key={course.id}
                  href={course.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Card className="border-gray-200 hover:border-amber-300 hover:shadow-md transition-all h-full">
                    <CardHeader className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-amber-100 to-orange-100 text-amber-600 text-xs font-bold shrink-0">
                          {course.courseCode || "GE"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm leading-snug text-gray-900 group-hover:text-amber-700 transition-colors">
                            {course.title}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 flex-wrap mt-2">
                            {course.geLevels.map((g) => (
                              <Badge key={g} variant="info" className="text-[10px] px-1.5 py-0">
                                {g}
                              </Badge>
                            ))}
                            {course.campuses.map((c) => (
                              <Badge key={c} variant="secondary" className="text-[10px] px-1.5 py-0">
                                <MapPin className="h-2.5 w-2.5 mr-0.5" />
                                {c}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-2 truncate">
                            รหัสหลักสูตร: {course.slug} · คลิกเพื่อดูรายละเอียด
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-amber-500 transition-colors shrink-0 mt-1" />
                      </div>
                    </CardHeader>
                  </Card>
                </a>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            ข้อมูลอัปเดตล่าสุด:{" "}
            {new Date(data.fetchedAt).toLocaleString("th-TH", {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            · แคชบนเซิร์ฟเวอร์ 6 ชั่วโมง
          </p>
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? "bg-amber-500 text-white shadow-sm"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}
