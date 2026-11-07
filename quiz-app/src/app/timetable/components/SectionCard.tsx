"use client";

import { AlertTriangle, CalendarDays, Check, CheckCircle2, MapPin, Plus, User, Users } from "lucide-react";
import {
  DAY_COLORS,
  DAY_SHORT,
  examsOverlap,
  fmtExamDate,
  fmtRange,
  sectionClashes,
  sectionExamClashes,
  slotsOverlap,
  type Course,
  type ExamTime,
  type PlannedEntry,
  type Section,
  type Slot,
} from "@/lib/timetable";
import { cn } from "@/lib/utils";
import type { GhostBlock } from "./WeekGrid";

/**
 * Tiny week strip: this section's classes (green / red when clashing) over
 * what is already planned (grey). Lets students compare sections at a glance.
 */
export function MiniWeek({ slots, planned, className }: { slots: Slot[]; planned: Slot[]; className?: string }) {
  const all = [...slots, ...planned];
  const weekend = all.some((s) => s.day >= 5);
  const days = weekend ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const start = Math.min(8 * 60, ...all.map((s) => Math.floor(s.start / 60) * 60));
  const end = Math.max(20 * 60, ...all.map((s) => Math.ceil(s.end / 60) * 60));
  const LABEL = 15;
  const W = 150;
  const ROW = 9;
  const H = days.length * ROW + 9;
  const x = (m: number) => LABEL + ((m - start) / (end - start)) * (W - LABEL);
  const noon = x(12 * 60);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-auto w-full", className)} role="img" aria-label="ภาพรวมเวลาเรียนในสัปดาห์">
      {days.map((d, r) => {
        const y = r * ROW;
        return (
          <g key={d}>
            <text x={0} y={y + 6.6} fontSize={6} fill="#9ca3af" fontWeight={600}>
              {DAY_SHORT[d].replace(".", "")}
            </text>
            <rect x={LABEL} y={y + 1} width={W - LABEL} height={ROW - 2} rx={2} fill="#f3f4f6" />
            {planned
              .filter((s) => s.day === d)
              .map((s, i) => (
                <rect key={`p${i}`} x={x(s.start)} y={y + 1} width={Math.max(1.5, x(s.end) - x(s.start))} height={ROW - 2} rx={1.5} fill="#cbd5e1" />
              ))}
            {slots
              .filter((s) => s.day === d)
              .map((s, i) => {
                const clash = planned.some((p) => slotsOverlap(p, s));
                return (
                  <rect
                    key={`s${i}`}
                    x={x(s.start)}
                    y={y + 0.5}
                    width={Math.max(2, x(s.end) - x(s.start))}
                    height={ROW - 1}
                    rx={2}
                    fill={clash ? "#ef4444" : "#10b981"}
                    opacity={0.92}
                  />
                );
              })}
          </g>
        );
      })}
      <line x1={noon} x2={noon} y1={0} y2={days.length * ROW} stroke="#9ca3af" strokeWidth={0.5} strokeDasharray="1.5 1.5" />
      {[start, 12 * 60, end].map((m) => (
        <text key={m} x={x(m)} y={H - 0.5} fontSize={5.5} fill="#9ca3af" textAnchor={m === start ? "start" : m === end ? "end" : "middle"}>
          {m / 60}:00
        </text>
      ))}
    </svg>
  );
}

function ExamTile({ label, at, text, clash }: { label: string; at: ExamTime | null; text: string; clash: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-lg px-2 py-1.5", clash ? "bg-orange-50 ring-1 ring-orange-200" : "bg-gray-50")}>
      <p className={cn("flex items-center gap-1 text-[10px] font-semibold", clash ? "text-orange-700" : "text-gray-500")}>
        <CalendarDays className="h-3 w-3" /> {label}
      </p>
      {at ? (
        <>
          <p className="truncate text-[11px] font-semibold text-gray-800">{fmtExamDate(at.date)}</p>
          <p className="text-[11px] text-gray-600 tabular-nums">{fmtRange(at.start, at.end)}</p>
        </>
      ) : (
        <p className="truncate text-[11px] text-gray-500">{text && text !== "-" ? text : "ไม่ระบุ"}</p>
      )}
    </div>
  );
}

interface SectionCardProps {
  course: Course;
  section: Section;
  entries: PlannedEntry[];
  selected: boolean;
  onAdd?: (course: Course, sec: string) => void;
  onRemove?: (courseId: string) => void;
  onPreview?: (ghost: GhostBlock | null) => void;
}

export function SectionCard({ course, section, entries, selected, onAdd, onRemove, onPreview }: SectionCardProps) {
  const clashes = sectionClashes(section, entries, course.id);
  const examClashes = sectionExamClashes(section, entries, course.id);
  const hasSlots = section.slots.length > 0;
  const others = entries.filter((e) => e.course?.id !== course.id);
  const planned = others.flatMap((e) => e.slots);
  const midClash = others.some((e) => examsOverlap(e.midterm, section.midtermAt));
  const finClash = others.some((e) => examsOverlap(e.final, section.finalAt));

  const tone = selected ? "selected" : clashes.length ? "clash" : examClashes.length ? "exam" : "ok";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-white text-xs shadow-sm transition hover:shadow-md",
        tone === "selected" && "border-emerald-400 ring-1 ring-emerald-300",
        tone === "clash" && "border-red-200",
        tone === "exam" && "border-orange-200",
        tone === "ok" && "border-gray-200 hover:border-emerald-300"
      )}
      onMouseEnter={() => hasSlots && onPreview?.({ code: course.code, sec: section.sec, slots: section.slots, clash: clashes.length > 0 })}
      onMouseLeave={() => onPreview?.(null)}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          tone === "selected" ? "bg-emerald-500" : tone === "clash" ? "bg-red-500" : tone === "exam" ? "bg-orange-400" : "bg-emerald-200"
        )}
      />
      <div className="space-y-2 py-2.5 pr-2.5 pl-3.5">
        {/* header */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-lg px-2 py-0.5 text-[12px] font-bold",
              selected ? "bg-emerald-600 text-white" : "bg-gray-900 text-white"
            )}
          >
            Sec {section.sec}
          </span>
          {section.seats !== null && (
            <span className="flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600" title="จำนวนที่นั่ง">
              <Users className="h-3 w-3" /> {section.seats} ที่นั่ง
            </span>
          )}
          {section.badges.map((b) => (
            <span key={b} className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              {b}
            </span>
          ))}
          {onAdd &&
            (selected ? (
              <button
                type="button"
                onClick={() => onRemove?.(course.id)}
                className="group/btn ml-auto flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white transition hover:bg-red-600"
                title="นำออกจากตาราง"
              >
                <Check className="h-3.5 w-3.5 group-hover/btn:hidden" />
                <span className="group-hover/btn:hidden">เลือกแล้ว</span>
                <span className="hidden group-hover/btn:inline">นำออก</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAdd(course, section.sec)}
                className={cn(
                  "ml-auto flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold transition active:scale-95",
                  clashes.length
                    ? "border border-red-300 text-red-700 hover:bg-red-600 hover:text-white"
                    : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                )}
              >
                <Plus className="h-3.5 w-3.5" /> เลือก
              </button>
            ))}
        </div>

        {/* schedule + mini week */}
        <div className="flex gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            {hasSlots ? (
              section.slots.map((sl, i) => (
                <div key={i} className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="w-7 shrink-0 rounded-md py-0.5 text-center text-[10px] font-bold text-white"
                    style={{ background: DAY_COLORS[sl.day] }}
                  >
                    {DAY_SHORT[sl.day]}
                  </span>
                  <span className="shrink-0 font-semibold text-gray-800 tabular-nums">{fmtRange(sl.start, sl.end)}</span>
                  {sl.room && sl.room !== "-" && (
                    <span className="flex min-w-0 items-center gap-0.5 text-gray-500">
                      <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{sl.room}</span>
                    </span>
                  )}
                </div>
              ))
            ) : (
              <span className="text-gray-500">{section.dayTime || "ยังไม่มีตารางเรียน"}</span>
            )}
          </div>
          {hasSlots && <MiniWeek slots={section.slots} planned={planned} className="w-[120px] shrink-0 sm:w-[136px]" />}
        </div>

        {/* people */}
        {(section.instructors.length > 0 || section.group) && (
          <div className="space-y-0.5 text-[11px] text-gray-600">
            {section.instructors.length > 0 && (
              <p className="flex items-start gap-1">
                <User className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
                <span>{section.instructors.join(", ")}</span>
              </p>
            )}
            {section.group && (
              <p className="flex items-start gap-1">
                <Users className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
                <span>ผู้เรียน: {section.group}</span>
              </p>
            )}
          </div>
        )}

        {/* exams */}
        <div className="grid grid-cols-2 gap-1.5">
          <ExamTile label="สอบกลางภาค" at={section.midtermAt} text={section.midterm} clash={midClash} />
          <ExamTile label="สอบปลายภาค" at={section.finalAt} text={section.final} clash={finClash} />
        </div>

        {/* status */}
        {clashes.length > 0 ? (
          <p className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 font-medium text-red-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> เวลาเรียนชนกับ {clashes.map((c) => c.code).join(", ")}
          </p>
        ) : examClashes.length > 0 ? (
          <p className="flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 font-medium text-orange-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> วันสอบชนกับ {examClashes.map((c) => c.code).join(", ")}
          </p>
        ) : (
          !selected &&
          entries.length > 0 &&
          hasSlots && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> ไม่ชนกับตารางปัจจุบัน
            </p>
          )
        )}
      </div>
    </div>
  );
}
