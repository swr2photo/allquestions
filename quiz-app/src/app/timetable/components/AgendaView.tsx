"use client";

import { AlertTriangle, CalendarRange, Clock, MapPin, User, X } from "lucide-react";
import { DAY_COLORS, DAY_EN, DAY_NAMES, PALETTE, fmtDuration, fmtRange, type PlannedEntry } from "@/lib/timetable";
import { Segmented } from "@/components/ui/checkbox";
import { BLOCK_STYLES, blockLook, useBlockStyle } from "./block-style";

/** Phone-friendly day-by-day list of the week (no horizontal scrolling). */
export function AgendaView({
  entries,
  conflictKeys,
  onSelect,
  onRemove,
  readOnly,
}: {
  entries: PlannedEntry[];
  conflictKeys: Set<string>;
  onSelect: (e: PlannedEntry) => void;
  onRemove: (e: PlannedEntry) => void;
  readOnly?: boolean;
}) {
  const [style, setStyle] = useBlockStyle();
  const byDay = [0, 1, 2, 3, 4, 5, 6].map((day) =>
    entries
      .flatMap((e) => e.slots.filter((s) => s.day === day).map((s) => ({ e, s })))
      .sort((a, b) => a.s.start - b.s.start)
  );
  const days = byDay.some((_, d) => d >= 5 && byDay[d].length) ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];

  if (!entries.some((e) => e.slots.length)) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center">
        <CalendarRange className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm text-gray-500">ยังไม่มีวิชาที่มีเวลาเรียน</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end print:hidden">
        <Segmented aria-label="สไตล์กล่องวิชา" size="sm" value={style} onChange={setStyle} options={BLOCK_STYLES} />
      </div>
      <ol className="space-y-3">
        {days.map((day) => {
          const list = byDay[day];
          const busy = list.reduce((n, { s }) => n + (s.end - s.start), 0);
          return (
            <li key={day} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
                <span className="h-4 w-1 rounded-full" style={{ background: DAY_COLORS[day] }} aria-hidden />
                <span className="text-sm font-bold text-gray-900">{DAY_NAMES[day]}</span>
                <span className="text-[10px] tracking-wider text-gray-400">{DAY_EN[day]}</span>
                <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  {list.length ? `${list.length} คาบ · ${Math.round((busy / 60) * 2) / 2} ชม.` : "ว่างทั้งวัน 🎉"}
                </span>
              </div>
              {list.length > 0 && (
                <ul className="space-y-1.5 p-2">
                  {list.map(({ e, s }, i) => {
                    const c = PALETTE[e.color % PALETTE.length];
                    const clash = conflictKeys.has(e.key);
                    const look = blockLook(style, c, clash);
                    const prev = list[i - 1];
                    const gap = prev ? s.start - prev.s.end : 0;
                    return (
                      <li key={`${e.key}-${i}`}>
                        {gap >= 60 && (
                          <p className="flex items-center gap-2 px-2 py-1 text-[10px] text-gray-400">
                            <span className="h-px flex-1 border-t border-dashed border-gray-200" />
                            ว่าง {Math.floor(gap / 60)} ชม.{gap % 60 ? ` ${gap % 60} นาที` : ""}
                            <span className="h-px flex-1 border-t border-dashed border-gray-200" />
                          </p>
                        )}
                        <div className="tt-pop flex items-stretch gap-2" style={{ animationDelay: `${i * 40}ms` }}>
                          <div className="w-12 shrink-0 pt-1.5 text-right text-[11px] leading-tight text-gray-500 tabular-nums">
                            <div className="font-bold text-gray-800">{fmtRange(s.start, s.end).split("–")[0]}</div>
                            <div>{fmtRange(s.start, s.end).split("–")[1]}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSelect(e)}
                            className={`relative min-w-0 flex-1 overflow-hidden rounded-xl py-2 pr-3 pl-4 text-left transition active:scale-[0.99] ${clash ? "tt-clash" : ""}`}
                            style={look.box}
                          >
                            {style !== "vivid" && (
                              <span className="absolute inset-y-2 left-1.5 w-[3px] rounded-full" style={{ background: look.accent }} aria-hidden />
                            )}
                            <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: look.text }}>
                              {clash && <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-label="ชนกัน" />}
                              <span className="font-mono">{e.code}</span>
                              {e.sec !== "-" && <span className="font-medium opacity-80">· Sec {e.sec}</span>}
                              <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold opacity-80">
                                <Clock className="h-3 w-3" /> {fmtDuration(s.start, s.end)}
                              </span>
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug" style={{ color: look.text }}>
                              {e.name}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]" style={{ color: look.sub }}>
                              {s.room && s.room !== "-" && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {s.room}
                                </span>
                              )}
                              {e.instructors.length > 0 && (
                                <span className="flex min-w-0 items-center gap-1">
                                  <User className="h-3 w-3 shrink-0" /> <span className="truncate">{e.instructors[0]}</span>
                                </span>
                              )}
                            </span>
                          </button>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => onRemove(e)}
                              className="flex w-9 shrink-0 items-center justify-center rounded-xl text-gray-300 hover:bg-red-50 hover:text-red-600"
                              aria-label={`ลบ ${e.code}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
