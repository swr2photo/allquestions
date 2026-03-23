"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search,
  X,
  CheckCircle2,
  XCircle,
  BookOpen,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  courseId: string;
  courseTitle: string;
  courseIcon: string;
  quizId: string;
  quizTitle: string;
  questionIndex: number;
  questionText: string;
  correctAnswer: string;
  allChoices: { text: string; isCorrect: boolean }[];
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b sticky top-16 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-gray-500">
                <ArrowLeft className="h-4 w-4" />
                กลับ
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Search className="h-5 w-5 text-emerald-600" />
              ค้นหาคำตอบ
            </h1>
          </div>

          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="พิมพ์คำถามหรือคำตอบที่ต้องการค้นหา..."
              className="pl-12 pr-12 h-12 rounded-2xl bg-gray-50 border-gray-200 text-base focus-visible:ring-emerald-500 focus-visible:bg-white"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setSearched(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {searched && !loading && (
            <p className="text-sm text-gray-500 mt-3">
              พบ {results.length} ผลลัพธ์
              {results.length >= 50 && " (แสดงสูงสุด 50 รายการ)"}
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-16">
            <Search className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">ไม่พบผลลัพธ์สำหรับ &quot;{query}&quot;</p>
            <p className="text-gray-400 text-sm mt-1">ลองใช้คำค้นหาอื่น</p>
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-400 text-lg">พิมพ์คำค้นหาเพื่อค้นหาคำถามและคำตอบที่ถูกต้อง</p>
          </div>
        )}

        <div className="space-y-4">
          {results.map((r, idx) => (
            <Card
              key={`${r.quizId}-${r.questionIndex}-${idx}`}
              className="border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{r.courseIcon}</span>
                  <Badge variant="info" className="text-[10px]">
                    {r.courseTitle}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {r.quizTitle}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    ข้อ {r.questionIndex}
                  </Badge>
                </div>
                <CardTitle className="text-sm sm:text-base font-medium text-gray-900 mt-2">
                  {r.questionText}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {r.allChoices.map((choice, ci) => (
                    <div
                      key={ci}
                      className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${
                        choice.isCorrect
                          ? "bg-emerald-50 text-emerald-800 font-medium border border-emerald-200"
                          : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {choice.isCorrect ? (
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 mt-0.5 text-gray-300 shrink-0" />
                      )}
                      <span>{choice.text}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-end">
                  <Link href={`/course/${r.courseId}/quiz/${r.quizId}?mode=study`}>
                    <Button size="sm" variant="outline" className="text-xs gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      ดูข้อสอบเต็ม
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
