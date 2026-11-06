"use client";

import { useState } from "react";
import { X, AlertTriangle, Minus, Plus, RotateCcw } from "lucide-react";
import { DAY_EN, DAY_NAMES, PALETTE, fmtRange, layoutLanes, type PlannedEntry, type Slot } from "@/lib/timetable";

export interface GhostBlock {
  code: string;
  sec: string;
  slots: Slot[];
  clash: boolean;
}

interface Props {
  entries: PlannedEntry[];
  ghost: GhostBlock | null;
  conflictKeys: Set<string>;
  onSelect: (entry: PlannedEntry) => void;
  onRemove: (entry: PlannedEntry) => void;
}

const DEFAULT_START = 8 * 60;
const DEFAULT_END = 18 * 60;
const DEFAULT_HOUR_PX = 110;
const MIN_HOUR_PX = 60;
const MAX_HOUR_PX = 260;
const HOUR_PX_STEP = 20;
const LANE_PX = 78;
const MIN_ROW_PX = 84;

export function WeekGrid({ entries, ghost, conflictKeys, onSelect, onRemove }: Props) {
  const [hourPx, setHourPx] = useState(DEFAULT_HOUR_PX);
  const allSlots = [...entries.flatMap((e) => e.slots), ...(ghost?.slots ?? [])];
  const startMin = Math.min(DEFAULT_START, ...allSlots.map((s) => Math.floor(s.start / 60) * 60));
  const endMin = Math.max(DEFAULT_END, ...allSlots.map((s) => Math.ceil(s.end / 60) * 60));
  const hours: number[] = [];
  for (let m = startMin; m < endMin; m += 60) hours.push(m);
  const timelinePx = (hours.length * hourPx);

  const usesWeekend = allSlots.some((s) => s.day >= 5);
  const days = usesWeekend ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];

  const pos = (s: Slot) => ({
    left: `${((s.start - startMin) / 60) * hourPx}px`,
    width: `${((s.end - s.start) / 60) * hourPx}px`,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1 text-xs text-gray-500 print:hidden">
        <span className="mr-1">ขนาดเวลา</span>
        <button
          type="button"
          onClick={() => setHourPx((v) => Math.max(MIN_HOUR_PX, v - HOUR_PX_STEP))}
          disabled={hourPx <= MIN_HOUR_PX}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
          aria-label="ย่อตารางเวลา"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setHourPx((v) => Math.min(MAX_HOUR_PX, v + HOUR_PX_STEP))}
          disabled={hourPx >= MAX_HOUR_PX}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
          aria-label="ขยายตารางเวลา"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setHourPx(DEFAULT_HOUR_PX)}
          disabled={hourPx === DEFAULT_HOUR_PX}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
          aria-label="รีเซ็ตขนาดตาราง"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white" role="region" aria-label="ตารางเรียนรายสัปดาห์">
      <div style={{ minWidth: timelinePx + 80 }}>
        {/* hour header */}
        <div className="flex border-b border-gray-200 bg-gray-50/80 text-[11px] font-medium text-gray-500">
          <div className="w-16 shrink-0 px-2 py-2 sm:w-20">วัน</div>
          <div className="relative flex" style={{ width: timelinePx }}>
            {hours.map((h) => (
              <div key={h} className="shrink-0 border-l border-gray-200 px-1.5 py-2 tabular-nums" style={{ width: hourPx }}>
                {String(h / 60).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>

        {days.map((day) => {
          const blocks = entries.flatMap((e) =>
            e.slots.filter((s) => s.day === day).map((s, i) => ({ e, s, i }))
          );
          const lanes = layoutLanes(blocks.map((b) => b.s));
          const laneCount = Math.max(1, ...lanes.map((l) => l.lanes));
          const ghostSlots = ghost?.slots.filter((s) => s.day === day) ?? [];
          return (
            <div key={day} className="flex border-b border-gray-100 last:border-b-0">
              <div className="flex w-16 shrink-0 flex-col justify-center px-2 py-3 sm:w-20">
                <span className="text-sm font-semibold text-gray-800">{DAY_NAMES[day]}</span>
                <span className="text-[10px] tracking-wider text-gray-400">{DAY_EN[day]}</span>
              </div>
              <div className="relative" style={{ width: timelinePx, minHeight: Math.max(MIN_ROW_PX, laneCount * LANE_PX) }}>
                {/* hour lines */}
                <div className="absolute inset-0 flex" aria-hidden>
                  {hours.map((h) => (
                    <div key={h} className="shrink-0 border-l border-gray-100" style={{ width: hourPx }} />
                  ))}
                </div>

                {blocks.map(({ e, s, i }, idx) => {
                  const c = PALETTE[e.color % PALETTE.length];
                  const clash = conflictKeys.has(e.key);
                  const { lane, lanes: laneTotal } = lanes[idx];
                  const laneHeight = 100 / laneTotal;
                  return (
                    <div
                      key={`${e.key}-${i}`}
                      className="group absolute px-0.5"
                      style={{
                        ...pos(s),
                        top: `calc(${lane * laneHeight}% + 6px)`,
                        height: `calc(${laneHeight}% - 12px)`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(e)}
                        className="flex h-full w-full flex-col overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-1"
                        style={{
                          background: c.bg,
                          borderColor: clash ? "#dc2626" : c.border,
                          color: c.text,
                          outline: clash ? "2px solid #dc2626" : undefined,
                        }}
                        title={`${e.code} ${e.name}\nSec ${e.sec} · ${fmtRange(s.start, s.end)}${s.room ? ` · ${s.room}` : ""}`}
                      >
                        <span className="flex items-center gap-1 text-[11px] font-bold leading-tight">
                          {clash && <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" aria-label="ชนกัน" />}
                          <span className="truncate">{e.code}</span>
                        </span>
                        <span className="line-clamp-2 text-[11px] leading-tight opacity-90">{e.name}</span>
                        <span className="mt-auto truncate text-[10px] opacity-80">
                          {e.sec !== "-" && <>Sec {e.sec} · </>}
                          {s.room && s.room !== "-" ? s.room : fmtRange(s.start, s.end)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(e)}
                        className="absolute -top-1 -right-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-white text-gray-500 shadow ring-1 ring-gray-200 hover:text-red-600 group-hover:flex group-focus-within:flex [@media(hover:none)]:flex print:hidden"
                        aria-label={`ลบ ${e.code}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}

                {ghost &&
                  ghostSlots.map((s, i) => (
                    <div
                      key={`ghost-${i}`}
                      className="pointer-events-none absolute top-1.5 bottom-1.5 px-0.5"
                      style={pos(s)}
                    >
                      <div
                        className={`flex h-full w-full flex-col justify-center rounded-lg border-2 border-dashed px-1.5 text-[11px] font-semibold ${
                          ghost.clash
                            ? "border-red-500 bg-red-50/80 text-red-700"
                            : "border-emerald-500 bg-emerald-50/80 text-emerald-700"
                        }`}
                      >
                        <span className="truncate">{ghost.code}</span>
                        <span className="truncate text-[10px] font-normal">
                          Sec {ghost.sec} · {fmtRange(s.start, s.end)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}
