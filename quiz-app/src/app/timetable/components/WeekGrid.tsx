"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, CalendarRange, Clock, MapPin, Minus, Palette, Plus, RotateCcw, X } from "lucide-react";
import {
  DAY_COLORS,
  DAY_EN,
  DAY_NAMES,
  PALETTE,
  fmtDuration,
  fmtRange,
  fmtTime,
  layoutLanes,
  weekdayIndex,
  type PlannedEntry,
  type Slot,
} from "@/lib/timetable";
import { Segmented } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { BLOCK_STYLES, blockLook, useBlockStyle } from "./block-style";

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
  /** read-only (viewing someone else's shared timetable) — hides remove buttons */
  readOnly?: boolean;
}

const DEFAULT_START = 8 * 60;
const DEFAULT_END = 18 * 60;
const DEFAULT_HOUR_PX = 110;
const MIN_HOUR_PX = 60;
const MAX_HOUR_PX = 260;
const HOUR_PX_STEP = 20;
const LANE_PX = 92;
const MIN_ROW_PX = 96;

// a minute-resolution clock shared by every grid on the page (no effect + setState)
function subscribeClock(cb: () => void) {
  const t = setInterval(cb, 20_000);
  return () => clearInterval(t);
}
const minuteNow = () => Math.floor(Date.now() / 60_000);

export function WeekGrid({ entries, ghost, conflictKeys, onSelect, onRemove, readOnly }: Props) {
  const [hourPx, setHourPx] = useState(DEFAULT_HOUR_PX);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [style, setStyle] = useBlockStyle();
  const minute = useSyncExternalStore(subscribeClock, minuteNow, () => null);
  const now = minute === null ? null : new Date(minute * 60_000);
  const today = now ? weekdayIndex(now) : -1;
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : -1;

  const allSlots = [...entries.flatMap((e) => e.slots), ...(ghost?.slots ?? [])];
  const startMin = Math.min(DEFAULT_START, ...allSlots.map((s) => Math.floor(s.start / 60) * 60));
  const endMin = Math.max(DEFAULT_END, ...allSlots.map((s) => Math.ceil(s.end / 60) * 60));
  const hours: number[] = [];
  for (let m = startMin; m < endMin; m += 60) hours.push(m);
  const timelinePx = hours.length * hourPx;
  const nowX = nowMin >= startMin && nowMin <= endMin ? ((nowMin - startMin) / 60) * hourPx : null;

  const usesWeekend = allSlots.some((s) => s.day >= 5);
  const days = usesWeekend ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const empty = !entries.some((e) => e.slots.length) && !ghost;

  const pos = (s: Slot) => ({
    left: `${((s.start - startMin) / 60) * hourPx}px`,
    width: `${((s.end - s.start) / 60) * hourPx}px`,
  });

  let order = 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 print:hidden">
        <div className="flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-gray-400" aria-hidden />
          <Segmented aria-label="สไตล์กล่องวิชา" size="sm" value={style} onChange={setStyle} options={BLOCK_STYLES} />
        </div>
        <div className="flex items-center gap-1">
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
      </div>

      <div className="ui-scroll overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm" role="region" aria-label="ตารางเรียนรายสัปดาห์">
        <div style={{ minWidth: timelinePx + 80 }}>
          {/* hour header */}
          <div className="flex border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white text-[11px] font-semibold text-gray-500">
            <div className="w-16 shrink-0 px-2 py-2.5 sm:w-20">วัน / เวลา</div>
            <div className="relative flex" style={{ width: timelinePx }}>
              {hours.map((h) => (
                <div key={h} className="shrink-0 border-l border-gray-200 px-1.5 py-2.5 tabular-nums" style={{ width: hourPx }}>
                  {String(h / 60).padStart(2, "0")}:00
                </div>
              ))}
              {nowX !== null && today >= 0 && days.includes(today) && (
                <span
                  className="absolute top-1 z-10 -translate-x-1/2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow tabular-nums"
                  style={{ left: nowX }}
                >
                  {fmtTime(nowMin)}
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            {days.map((day, rowIdx) => {
              const blocks = entries.flatMap((e) => e.slots.filter((s) => s.day === day).map((s, i) => ({ e, s, i })));
              const lanes = layoutLanes(blocks.map((b) => b.s));
              const laneCount = Math.max(1, ...lanes.map((l) => l.lanes));
              const ghostSlots = ghost?.slots.filter((s) => s.day === day) ?? [];
              const isToday = day === today;
              const busyMin = blocks.reduce((n, b) => n + (b.s.end - b.s.start), 0);
              return (
                <div
                  key={day}
                  className={cn(
                    "flex border-b border-gray-100 last:border-b-0",
                    isToday ? "bg-emerald-50/40" : rowIdx % 2 === 1 && "bg-gray-50/50"
                  )}
                >
                  <div className="flex w-16 shrink-0 items-stretch gap-2 py-3 pr-1 pl-2 sm:w-20">
                    <span className="w-1 shrink-0 rounded-full" style={{ background: DAY_COLORS[day] }} aria-hidden />
                    <span className="flex min-w-0 flex-col justify-center">
                      <span className="text-sm leading-tight font-bold text-gray-800">{DAY_NAMES[day]}</span>
                      <span className="text-[10px] tracking-wider text-gray-400">{DAY_EN[day]}</span>
                      {isToday ? (
                        <span className="mt-1 w-fit rounded-full bg-emerald-600 px-1.5 text-[9px] leading-4 font-bold text-white">วันนี้</span>
                      ) : busyMin > 0 ? (
                        <span className="mt-1 text-[9px] text-gray-400 tabular-nums">{Math.round((busyMin / 60) * 2) / 2} ชม.</span>
                      ) : null}
                    </span>
                  </div>
                  <div className="relative" style={{ width: timelinePx, minHeight: Math.max(MIN_ROW_PX, laneCount * LANE_PX) }}>
                    {/* hour + half-hour lines */}
                    <div className="absolute inset-0 flex" aria-hidden>
                      {hours.map((h) => (
                        <div key={h} className="relative shrink-0 border-l border-gray-100" style={{ width: hourPx }}>
                          <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-gray-100" />
                        </div>
                      ))}
                    </div>

                    {isToday && nowX !== null && (
                      <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-rose-500/80" style={{ left: nowX }} aria-hidden>
                        <span className="absolute -top-1 -left-[3px] h-2 w-2 rounded-full bg-rose-500" />
                      </div>
                    )}

                    {blocks.map(({ e, s, i }, idx) => {
                      const c = PALETTE[e.color % PALETTE.length];
                      const clash = conflictKeys.has(e.key);
                      const look = blockLook(style, c, clash);
                      const { lane, lanes: laneTotal } = lanes[idx];
                      const laneHeight = 100 / laneTotal;
                      const live = isToday && nowMin >= s.start && nowMin < s.end;
                      const dimmed = hoverKey !== null && hoverKey !== e.key;
                      const chipBg = style === "vivid" ? "rgba(255,255,255,0.22)" : style === "outline" ? c.bg : "rgba(255,255,255,0.75)";
                      const delay = Math.min(order++, 14) * 35;
                      return (
                        <div
                          key={`${e.key}-${i}`}
                          className="tt-pop group absolute px-0.5"
                          style={{
                            ...pos(s),
                            top: `calc(${lane * laneHeight}% + 6px)`,
                            height: `calc(${laneHeight}% - 12px)`,
                            animationDelay: `${delay}ms`,
                            zIndex: hoverKey === e.key ? 5 : undefined,
                          }}
                          onMouseEnter={() => setHoverKey(e.key)}
                          onMouseLeave={() => setHoverKey(null)}
                        >
                          <button
                            type="button"
                            onClick={() => onSelect(e)}
                            className={cn(
                              "@container relative flex h-full w-full flex-col overflow-hidden rounded-xl py-1.5 pr-1.5 pl-2.5 text-left transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:scale-[0.98] print:shadow-none",
                              clash && "tt-clash",
                              dimmed && "opacity-40 saturate-50",
                              hoverKey === e.key && "-translate-y-0.5 shadow-lg"
                            )}
                            style={look.box}
                            title={`${e.code} ${e.name}\nSec ${e.sec} · ${fmtRange(s.start, s.end)}${s.room ? ` · ${s.room}` : ""}${
                              e.instructors.length ? `\nผู้สอน: ${e.instructors.join(", ")}` : ""
                            }`}
                          >
                            {style !== "vivid" && (
                              <span className="absolute inset-y-1.5 left-1 w-[3px] rounded-full" style={{ background: look.accent }} aria-hidden />
                            )}
                            <span
                              aria-hidden
                              className="pointer-events-none absolute -top-6 -right-6 h-16 w-16 rounded-full opacity-[0.14] transition-transform duration-300 group-hover:scale-125"
                              style={{ background: style === "vivid" ? "#fff" : c.border }}
                            />
                            <span className="relative flex min-w-0 items-center gap-1 text-[11px] leading-tight font-bold" style={{ color: look.text }}>
                              {clash && <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" aria-label="ชนกัน" />}
                              <span className="truncate font-mono tracking-tight">{e.code}</span>
                              <span
                                className="ml-auto hidden shrink-0 rounded-full px-1.5 text-[9px] leading-4 font-semibold @min-[110px]:inline"
                                style={{ background: chipBg }}
                              >
                                {fmtDuration(s.start, s.end)}
                              </span>
                            </span>
                            <span className="relative mt-0.5 line-clamp-2 text-[11px] leading-tight" style={{ color: look.sub }}>
                              {e.name}
                            </span>
                            <span className="relative mt-auto flex min-w-0 items-center gap-1 text-[10px] font-medium tabular-nums" style={{ color: look.sub }}>
                              <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />
                              <span className="truncate">{fmtRange(s.start, s.end)}</span>
                            </span>
                            {((s.room && s.room !== "-") || e.sec !== "-") && (
                              <span className="relative flex min-w-0 items-center gap-1 text-[10px] font-medium" style={{ color: look.sub }}>
                                {s.room && s.room !== "-" ? (
                                  <>
                                    <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden />
                                    <span className="truncate">{s.room}</span>
                                  </>
                                ) : null}
                                {e.sec !== "-" && (
                                  <span className="ml-auto shrink-0 rounded px-1 text-[9px] leading-4 font-bold" style={{ background: chipBg }}>
                                    {e.sec}
                                  </span>
                                )}
                              </span>
                            )}
                          </button>
                          {live && (
                            <span className="pointer-events-none absolute -top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                              <span className="tt-live relative h-1.5 w-1.5 rounded-full bg-white" /> กำลังเรียน
                            </span>
                          )}
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => onRemove(e)}
                              className="absolute -top-1.5 -right-1 hidden h-5 w-5 items-center justify-center rounded-full bg-white text-gray-500 shadow ring-1 ring-gray-200 transition hover:scale-110 hover:bg-red-50 hover:text-red-600 group-hover:flex group-focus-within:flex [@media(hover:none)]:flex print:hidden"
                              aria-label={`ลบ ${e.code}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {ghost &&
                      ghostSlots.map((s, i) => (
                        <div key={`ghost-${i}`} className="tt-pop pointer-events-none absolute top-1.5 bottom-1.5 z-20 px-0.5" style={pos(s)}>
                          <div
                            className={cn(
                              "flex h-full w-full flex-col justify-center rounded-xl border-2 border-dashed px-2 text-[11px] font-semibold shadow-lg backdrop-blur-[1px]",
                              ghost.clash ? "border-red-500 bg-red-50/85 text-red-700" : "border-emerald-500 bg-emerald-50/85 text-emerald-700"
                            )}
                          >
                            <span className="flex items-center gap-1 truncate">
                              {ghost.clash && <AlertTriangle className="h-3 w-3 shrink-0" />}
                              {ghost.code}
                            </span>
                            <span className="truncate text-[10px] font-normal">
                              Sec {ghost.sec} · {fmtRange(s.start, s.end)}
                            </span>
                            <span className="truncate text-[10px] font-bold">{ghost.clash ? "ชนกับตาราง" : "ว่าง ลงได้"}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}

            {empty && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-2xl bg-white/90 px-5 py-4 text-center shadow-sm ring-1 ring-gray-100 backdrop-blur">
                  <CalendarRange className="mx-auto h-7 w-7 text-emerald-500" />
                  <p className="mt-1.5 text-sm font-semibold text-gray-800">ตารางยังว่างอยู่</p>
                  <p className="text-xs text-gray-500">ค้นหารายวิชาแล้วกด “เลือก” ที่ Section — ชี้ที่ Section เพื่อดูตัวอย่างบนตาราง</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
