"use client";

import { useState } from "react";
import { ChartColumn, Clock, Sun } from "lucide-react";
import { DAY_NAMES, DAY_SHORT, fmtTime, type PlannedEntry } from "@/lib/timetable";
import type { GeKey } from "@/lib/ge";
import { GeBadge } from "@/components/ge-badge";

// validated categorical slots 1–3 (light) — see dataviz palette; labels carry identity
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"] as const;
const BAR = "#2a78d6";

interface Props {
  entries: PlannedEntry[];
  geOf: (e: PlannedEntry) => GeKey | null;
}

export function StatsPanel({ entries, geOf }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (!entries.length) return null;

  let ge = 0;
  let other = 0;
  let custom = 0;
  const geKeys = new Map<GeKey, number>();
  for (const e of entries) {
    if (e.item.kind === "custom") custom += e.credits;
    else {
      const k = geOf(e);
      if (k) {
        ge += e.credits;
        geKeys.set(k, (geKeys.get(k) ?? 0) + e.credits);
      } else other += e.credits;
    }
  }
  const total = ge + other + custom;
  const parts = [
    { label: "ศึกษาทั่วไป (GE)", v: ge, color: SERIES[0] },
    { label: "วิชาเฉพาะ / อื่น ๆ", v: other, color: SERIES[1] },
    { label: "เพิ่มเอง", v: custom, color: SERIES[2] },
  ].filter((p) => p.v > 0);

  const hrs = [0, 0, 0, 0, 0, 0, 0];
  const first: (number | null)[] = [null, null, null, null, null, null, null];
  const last: (number | null)[] = [null, null, null, null, null, null, null];
  for (const e of entries)
    for (const s of e.slots) {
      hrs[s.day] += (s.end - s.start) / 60;
      first[s.day] = Math.min(first[s.day] ?? 9999, s.start);
      last[s.day] = Math.max(last[s.day] ?? 0, s.end);
    }
  const days = hrs[5] || hrs[6] ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const max = Math.max(1, ...days.map((d) => hrs[d]));
  const weekHours = hrs.reduce((a, v) => a + v, 0);
  const freeDays = days.filter((d) => d < 5 && hrs[d] === 0).map((d) => DAY_NAMES[d]);
  const earliest = Math.min(...first.filter((v): v is number => v !== null));
  const latest = Math.max(...last.filter((v): v is number => v !== null));

  const W = 300;
  const H = 120;
  const slot = W / days.length;
  const barW = Math.min(30, slot * 0.5);

  return (
    <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-[1fr_1.1fr] print:hidden" aria-label="สรุปตารางเรียน">
      <div className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <ChartColumn className="h-4 w-4 text-gray-500" /> สัดส่วนหน่วยกิต
          <span className="ml-auto text-xs font-normal text-gray-500 tabular-nums">{total} นก.</span>
        </h3>
        <div className="flex h-3 gap-[2px] overflow-hidden rounded bg-gray-100" role="img" aria-label={parts.map((p) => `${p.label} ${p.v} หน่วยกิต`).join(", ")}>
          {parts.map((p) => (
            <span key={p.label} className="h-full rounded-[4px]" style={{ width: `${(p.v / Math.max(1, total)) * 100}%`, background: p.color }} title={`${p.label}: ${p.v} หน่วยกิต`} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
          {parts.map((p) => (
            <li key={p.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden />
              {p.label} <span className="font-semibold tabular-nums">{p.v}</span>
            </li>
          ))}
        </ul>
        {geKeys.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {[...geKeys.entries()].map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 text-[11px] text-gray-600">
                <GeBadge ge={k} size="xs" /> {v} นก.
              </span>
            ))}
          </div>
        )}
        <dl className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="rounded-xl bg-gray-50 px-2 py-2">
            <dt className="flex items-center justify-center gap-1 text-[10px] text-gray-500">
              <Clock className="h-3 w-3" /> ชม./สัปดาห์
            </dt>
            <dd className="text-base font-bold text-gray-900 tabular-nums">{+weekHours.toFixed(1)}</dd>
          </div>
          <div className="rounded-xl bg-gray-50 px-2 py-2">
            <dt className="text-[10px] text-gray-500">เริ่มเช้าสุด / เลิกช้าสุด</dt>
            <dd className="text-sm font-bold text-gray-900 tabular-nums">
              {Number.isFinite(earliest) ? `${fmtTime(earliest)}–${fmtTime(latest)}` : "-"}
            </dd>
          </div>
          <div className="rounded-xl bg-gray-50 px-2 py-2">
            <dt className="flex items-center justify-center gap-1 text-[10px] text-gray-500">
              <Sun className="h-3 w-3" /> วันว่าง
            </dt>
            <dd className="truncate text-sm font-bold text-gray-900" title={freeDays.join(", ")}>
              {freeDays.length ? freeDays.map((d) => DAY_SHORT[DAY_NAMES.indexOf(d as (typeof DAY_NAMES)[number])]).join(" ") : "ไม่มี"}
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Clock className="h-4 w-4 text-gray-500" /> ชั่วโมงเรียนต่อวัน
        </h3>
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label={days.map((d) => `${DAY_NAMES[d]} ${+hrs[d].toFixed(1)} ชั่วโมง`).join(", ")}>
            <line x1={0} x2={W} y1={H} y2={H} stroke="#d1d5db" strokeWidth={1} />
            {days.map((d, i) => {
              const v = hrs[d];
              const h = (v / max) * (H - 18);
              const x = i * slot + (slot - barW) / 2;
              const r = Math.min(4, h);
              return (
                <g key={d} onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)}>
                  {/* hit target larger than the mark */}
                  <rect x={i * slot} y={0} width={slot} height={H + 22} fill="transparent" />
                  {v > 0 && (
                    <path
                      d={`M${x},${H} V${H - h + r} Q${x},${H - h} ${x + r},${H - h} H${x + barW - r} Q${x + barW},${H - h} ${x + barW},${H - h + r} V${H} Z`}
                      fill={BAR}
                      opacity={hover === null || hover === d ? 1 : 0.45}
                    />
                  )}
                  <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize={11} fill="#6b7280">
                    {DAY_SHORT[d]}
                  </text>
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute -top-1 rounded-lg bg-gray-900 px-2 py-1 text-[11px] whitespace-nowrap text-white shadow-lg"
              style={{ left: `${((days.indexOf(hover) + 0.5) / days.length) * 100}%`, transform: "translate(-50%, -100%)" }}
            >
              <b>{DAY_NAMES[hover]}</b> · {+hrs[hover].toFixed(1)} ชม.
              {first[hover] !== null && (
                <span className="text-gray-300">
                  {" "}
                  ({fmtTime(first[hover]!)}–{fmtTime(last[hover]!)})
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
