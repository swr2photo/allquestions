"use client";

import { AlertTriangle, CalendarDays } from "lucide-react";
import { PALETTE, examsOverlap, fmtExamDate, fmtRange, type ExamTime, type PlannedEntry } from "@/lib/timetable";

interface ExamRow {
  entry: PlannedEntry;
  exam: ExamTime;
  clash: boolean;
}

function buildRows(entries: PlannedEntry[], pick: (e: PlannedEntry) => ExamTime | null): ExamRow[] {
  const rows = entries
    .map((entry) => ({ entry, exam: pick(entry) }))
    .filter((r): r is { entry: PlannedEntry; exam: ExamTime } => !!r.exam);
  return rows
    .map((r) => ({
      ...r,
      clash: rows.some((o) => o !== r && examsOverlap(o.exam, r.exam)),
    }))
    .sort((a, b) => a.exam.date.localeCompare(b.exam.date) || a.exam.start - b.exam.start);
}

function ExamList({ title, rows, missing }: { title: string; rows: ExamRow[]; missing: PlannedEntry[] }) {
  // group by date for a calendar-like reading order
  const byDate = new Map<string, ExamRow[]>();
  rows.forEach((r) => byDate.set(r.exam.date, [...(byDate.get(r.exam.date) ?? []), r]));

  return (
    <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <div className="min-w-[440px]">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-500">{rows.length} วิชา</span>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-500">ยังไม่มีวันสอบสำหรับวิชาที่เลือก</p>
      ) : (
        <ol className="divide-y divide-gray-100">
          {[...byDate.entries()].map(([date, list]) => (
            <li key={date} className="flex gap-3 px-4 py-3">
              <div className="w-24 shrink-0 text-xs">
                <p className="font-semibold text-gray-900">{fmtExamDate(date)}</p>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {list.map((r) => {
                  const c = PALETTE[r.entry.color % PALETTE.length];
                  return (
                    <div
                      key={r.entry.key}
                      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${r.clash ? "bg-red-50 ring-1 ring-red-300" : ""}`}
                    >
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.border }} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">
                          <span className="tabular-nums">{fmtRange(r.exam.start, r.exam.end)}</span>
                          <span className="ml-2 font-mono">{r.entry.code}</span>
                          <span className="ml-1 text-gray-500">Sec {r.entry.sec}</span>
                        </p>
                        <p className="truncate text-gray-600">{r.entry.name}</p>
                      </div>
                      {r.clash && (
                        <span className="flex shrink-0 items-center gap-1 font-medium text-red-600">
                          <AlertTriangle className="h-3.5 w-3.5" /> ชน
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      )}
      {missing.length > 0 && (
        <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500">
          ไม่มีกำหนดสอบ/ยังไม่ประกาศ: {missing.map((m) => m.code).join(", ")}
        </p>
      )}
      </div>
    </section>
  );
}

export function ExamSchedule({ entries, termLabel }: { entries: PlannedEntry[]; termLabel: string }) {
  const courseEntries = entries.filter((e) => e.item.kind === "course");
  const mid = buildRows(courseEntries, (e) => e.midterm);
  const fin = buildRows(courseEntries, (e) => e.final);

  if (courseEntries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm text-gray-500">เลือกรายวิชาก่อน แล้วตารางสอบจะแสดงที่นี่</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white">
        <p className="text-[11px] tracking-[0.2em] uppercase opacity-80">PSU Exam Schedule</p>
        <h2 className="text-lg font-bold">ตารางสอบ ภาคการศึกษา {termLabel}</h2>
        <p className="text-xs opacity-90">อ้างอิงวันสอบจาก SIS — ตรวจสอบประกาศล่าสุดของมหาวิทยาลัยอีกครั้งก่อนสอบ</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ExamList title="สอบกลางภาค (Midterm)" rows={mid} missing={courseEntries.filter((e) => !e.midterm)} />
        <ExamList title="สอบปลายภาค (Final)" rows={fin} missing={courseEntries.filter((e) => !e.final)} />
      </div>
    </div>
  );
}
