"use client";

import { AlertTriangle, CalendarRange, MapPin, X } from "lucide-react";
import { DAY_EN, DAY_NAMES, PALETTE, fmtRange, type PlannedEntry } from "@/lib/timetable";

/** Phone-friendly day-by-day list of the week (no horizontal scrolling). */
export function AgendaView({
  entries,
  conflictKeys,
  onSelect,
  onRemove,
}: {
  entries: PlannedEntry[];
  conflictKeys: Set<string>;
  onSelect: (e: PlannedEntry) => void;
  onRemove: (e: PlannedEntry) => void;
}) {
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
    <ol className="space-y-3">
      {days.map((day) => {
        const list = byDay[day];
        return (
          <li key={day} className="rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-baseline gap-2 border-b border-gray-100 px-4 py-2.5">
              <span className="text-sm font-bold text-gray-900">{DAY_NAMES[day]}</span>
              <span className="text-[10px] tracking-wider text-gray-400">{DAY_EN[day]}</span>
              <span className="ml-auto text-[11px] text-gray-500">{list.length ? `${list.length} คาบ` : "ว่าง"}</span>
            </div>
            {list.length > 0 && (
              <ul className="divide-y divide-gray-50">
                {list.map(({ e, s }, i) => {
                  const c = PALETTE[e.color % PALETTE.length];
                  const clash = conflictKeys.has(e.key);
                  const prev = list[i - 1];
                  const gap = prev ? s.start - prev.s.end : 0;
                  return (
                    <li key={`${e.key}-${i}`}>
                      {gap >= 60 && (
                        <p className="px-4 pt-1.5 text-[10px] text-gray-400">ว่าง {Math.floor(gap / 60)} ชม.{gap % 60 ? ` ${gap % 60} นาที` : ""}</p>
                      )}
                      <div className="flex items-stretch gap-3 px-3 py-2.5">
                        <div className="w-14 shrink-0 pt-0.5 text-right text-[11px] leading-tight text-gray-500 tabular-nums">
                          <div className="font-semibold text-gray-800">{fmtRange(s.start, s.end).split("–")[0]}</div>
                          <div>{fmtRange(s.start, s.end).split("–")[1]}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelect(e)}
                          className="min-w-0 flex-1 rounded-xl border-l-4 px-3 py-2 text-left"
                          style={{ background: c.bg, borderColor: clash ? "#dc2626" : c.border, color: c.text }}
                        >
                          <span className="flex items-center gap-1 text-xs font-bold">
                            {clash && <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-label="ชนกัน" />}
                            {e.code}
                            {e.sec !== "-" && <span className="font-medium opacity-75">· Sec {e.sec}</span>}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug">{e.name}</span>
                          {s.room && s.room !== "-" && (
                            <span className="mt-1 flex items-center gap-1 text-[11px] opacity-80">
                              <MapPin className="h-3 w-3" /> {s.room}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(e)}
                          className="flex w-9 shrink-0 items-center justify-center rounded-xl text-gray-300 hover:bg-red-50 hover:text-red-600"
                          aria-label={`ลบ ${e.code}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
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
  );
}
