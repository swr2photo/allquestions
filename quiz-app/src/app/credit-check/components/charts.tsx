"use client";

// กราฟิกของหน้าเช็กหน่วยกิต: วงแหวนความคืบหน้ารวม, กราฟหน่วยกิตรายภาค, มิเตอร์รายหมวด และจุดหน่วยกิตรายสาระ
// สีเป็นตัวบอก "หมวด" เท่านั้น — ตัวเลขและป้ายกำกับใช้สีตัวอักษรปกติ และทุกกราฟมีข้อความ/ตารางกำกับ

import { useEffect, useId, useState } from "react";
import { BUCKETS, BUCKET_META, type Bucket, type BucketSummary, type CreditSummary, type TermSummary } from "@/lib/credit-check";
import { UNKNOWN_TERM } from "@/lib/registration";
import { cn } from "@/lib/utils";

/** สีเทากลางสำหรับหน่วยกิตที่ไม่นับ (ไม่ใช่สีของหมวดใด) */
export const NOT_COUNTED_COLOR = "#c4c9d2";

/** ลายเส้นทแยงของสีหมวด — ใช้กับหน่วยกิตที่ยังไม่มีเกรด เพื่อไม่ให้แยกด้วยความเข้มสีอย่างเดียว */
export const hatch = (color: string) => `repeating-linear-gradient(135deg, ${color} 0 3px, ${color}55 3px 6px)`;

/** false ในเฟรมแรก แล้วเป็น true — ให้กราฟไล่จาก 0 ไปค่าจริงหนึ่งครั้งตอนเปิดหน้า */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}

// ------------------------------------------------------------------ donut

const SIZE = 220;
const RADIUS = 88;
const STROKE = 18;
const CIRC = 2 * Math.PI * RADIUS;
/** ช่องว่างสีพื้นระหว่างหมวด (หน่วยเป็นความยาวบนเส้นรอบวง) */
const GAP = 5;

interface DonutProps {
  summary: CreditSummary;
  /** หมวดที่กำลังชี้/เลือกอยู่ — แสดงตัวเลขของหมวดนั้นกลางวง */
  active: Bucket | null;
  onActive: (bucket: Bucket | null) => void;
  onSelect: (bucket: Bucket) => void;
}

/** วงแหวนแบ่ง 4 ส่วนตามสัดส่วนเกณฑ์ของแต่ละหมวด แต่ละส่วนเติมตามหน่วยกิตที่นับได้ */
export function CreditDonut({ summary, active, onActive, onSelect }: DonutProps) {
  const mounted = useMounted();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const shown = BUCKETS.filter((b) => summary.buckets[b].need > 0);
  const segments = shown.map((b, i) => {
    const s = summary.buckets[b];
    const before = shown.slice(0, i).reduce((a, x) => a + summary.buckets[x].need, 0);
    const len = Math.max(0, (s.need / summary.total) * CIRC - GAP);
    const confirmed = len * ((s.counted - s.pending) / s.need);
    return { b, s, start: (before / summary.total) * CIRC + GAP / 2, len, confirmed, pending: len * (s.pending / s.need) };
  });
  const pct = summary.total > 0 ? Math.floor((summary.counted / summary.total) * 100) : 0;
  const focus = active ? summary.buckets[active] : null;
  const center = SIZE / 2;
  const arc = (start: number, len: number) => ({
    cx: center,
    cy: center,
    r: RADIUS,
    fill: "none",
    strokeDasharray: `${Math.max(0, len)} ${CIRC}`,
    strokeDashoffset: -start,
  });

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[220px]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-full w-full"
        role="img"
        aria-label={`นับเข้าโครงสร้างหลักสูตรได้ ${summary.counted} จาก ${summary.total} หน่วยกิต (${pct}%) — ${shown
          .map((b) => `${BUCKET_META[b].short} ${summary.buckets[b].counted}/${summary.buckets[b].need}`)
          .join(", ")}`}
      >
        <defs>
          {shown.map((b) => (
            <pattern key={b} id={`${uid}-${b}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={BUCKET_META[b].color} opacity="0.3" />
              <rect width="3" height="6" fill={BUCKET_META[b].color} />
            </pattern>
          ))}
        </defs>
        <g transform={`rotate(-90 ${center} ${center})`}>
          {segments.map(({ b, start, len, confirmed, pending }) => {
            const color = BUCKET_META[b].color;
            const dim = active !== null && active !== b;
            return (
              <g key={b} className="transition-opacity duration-200" opacity={dim ? 0.3 : 1}>
                <circle {...arc(start, len)} stroke={color} strokeOpacity={0.16} strokeWidth={STROKE} />
                <circle
                  {...arc(start, mounted ? confirmed : 0)}
                  stroke={color}
                  strokeWidth={STROKE}
                  className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
                />
                {pending > 0 && (
                  <circle
                    {...arc(start + confirmed, mounted ? pending : 0)}
                    stroke={`url(#${uid}-${b})`}
                    strokeWidth={STROKE}
                    className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
                  />
                )}
                {/* เป้าชี้กว้างกว่าเส้นจริง */}
                <circle
                  {...arc(start - GAP / 2, len + GAP)}
                  stroke="transparent"
                  strokeWidth={STROKE + 20}
                  className="cursor-pointer"
                  onMouseEnter={() => onActive(b)}
                  onMouseLeave={() => onActive(null)}
                  onClick={() => onSelect(b)}
                />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-9 text-center" aria-hidden>
        {active && focus ? (
          <>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
              <span className="h-2 w-2 rounded-full" style={{ background: BUCKET_META[active].color }} />
              {BUCKET_META[active].short}
            </span>
            <span className="mt-0.5 text-4xl leading-none font-bold tracking-tight text-gray-900 tabular-nums">{focus.counted}</span>
            <span className="mt-1 text-xs font-medium text-gray-500 tabular-nums">/ {focus.need} หน่วยกิต</span>
            <span className="mt-1.5 text-[11px] font-semibold text-gray-700">{focus.short === 0 ? "ครบแล้ว" : `ขาดอีก ${focus.short}`}</span>
          </>
        ) : (
          <>
            <span className="text-[11px] font-semibold text-gray-500">นับเข้าโครงสร้าง</span>
            <span className="mt-0.5 text-5xl leading-none font-bold tracking-tight text-gray-900 tabular-nums">{summary.counted}</span>
            <span className="mt-1 text-xs font-medium text-gray-500 tabular-nums">/ {summary.total} หน่วยกิต</span>
            <span className="mt-1.5 rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">{pct}%</span>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ meters

/** แถบความคืบหน้าของหมวด: ส่วนทึบ = มีเกรดแล้ว, ส่วนลายเส้น = ยังไม่มีเกรด */
export function BucketMeter({ summary, color, label, className }: { summary: BucketSummary; color: string; label: string; className?: string }) {
  const mounted = useMounted();
  const pct = (n: number) => (summary.need > 0 ? `${Math.min(100, (n / summary.need) * 100)}%` : "0%");
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={summary.need}
      aria-valuenow={summary.counted}
      className={cn("flex h-2.5 w-full overflow-hidden rounded-full", className)}
      style={{ background: `${color}24` }}
    >
      <div
        className="h-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
        style={{ width: mounted ? pct(summary.counted - summary.pending) : 0, background: color }}
      />
      {summary.pending > 0 && (
        <div
          className="h-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: mounted ? pct(summary.pending) : 0, backgroundImage: hatch(color) }}
        />
      )}
    </div>
  );
}

/** จุดหน่วยกิต: หนึ่งช่อง = 1 หน่วยกิตของเกณฑ์ (ใช้กับสาระ GE ที่เกณฑ์เป็นเลขน้อย ๆ) */
export function CreditPips({ value, need, color, label }: { value: number; need: number; color: string; label: string }) {
  const filled = Math.min(value, need);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={need} aria-valuenow={filled} className="flex gap-0.5">
      {Array.from({ length: need }, (_, i) => (
        <span key={i} className="h-1.5 min-w-0 flex-1 rounded-full" style={{ background: i < filled ? color : `${color}26` }} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ per-term chart

const PLOT_HEIGHT = 168;
/** ลำดับการซ้อนจากฐานขึ้นบน — ตรงกับลำดับในคำอธิบายสี */
const STACK: readonly Bucket[] = BUCKETS;

function termParts(term: string): { no: string; year: string } {
  const m = term.match(/^(\d)\s*\/\s*\d{2}(\d{2})$/);
  return m ? { no: m[1], year: m[2] } : { no: "?", year: "" };
}

/** กราฟแท่งซ้อน: หน่วยกิตที่นับในแต่ละภาค แยกตามหมวด (ส่วนสีเทา = ลงแล้วแต่ไม่นับ) */
export function TermChart({ terms }: { terms: TermSummary[] }) {
  const mounted = useMounted();
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(...terms.map((t) => t.registered), 1);
  const step = top > 30 ? 10 : 6;
  const max = Math.max(step * 2, Math.ceil(top / step) * step);
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const hasNotCounted = terms.some((t) => t.notCounted > 0);
  const h = (credits: number) => (credits / max) * PLOT_HEIGHT;

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] font-medium text-gray-600">
        {BUCKETS.map((b) => (
          <li key={b} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BUCKET_META[b].color }} aria-hidden />
            {BUCKET_META[b].short}
          </li>
        ))}
        {hasNotCounted && (
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundImage: hatch(NOT_COUNTED_COLOR) }} aria-hidden />
            ไม่นับ (F / W / ซ้ำ / ปิดภาค)
          </li>
        )}
      </ul>

      <div className="flex gap-2" aria-hidden>
        {/* แกน Y */}
        <div className="relative w-5 shrink-0 text-right text-[10px] text-gray-400 tabular-nums" style={{ height: PLOT_HEIGHT }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: h(t) }}>
              {t}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: PLOT_HEIGHT }}>
            {ticks.map((t) => (
              <span key={t} className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-gray-300" : "bg-gray-100")} style={{ bottom: h(t) }} />
            ))}
            <div className="absolute inset-0 flex items-end">
              {terms.map((t, i) => {
                const parts = STACK.filter((b) => t.byBucket[b] > 0);
                const open = hover === i;
                const alignEnd = i > 1 && i >= terms.length - 2;
                const alignStart = i < 2;
                return (
                  <div
                    key={t.term}
                    className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))}
                  >
                    {open && <span className="absolute inset-x-0.5 inset-y-0 rounded-md bg-gray-900/[0.04]" />}
                    <span className={cn("mb-1 text-[11px] font-semibold tabular-nums", t.counted ? "text-gray-700" : "text-gray-400")}>{t.counted}</span>
                    <div className="flex w-full max-w-6 flex-col-reverse gap-0.5 px-px">
                      {parts.map((b, j) => (
                        <span
                          key={b}
                          className={cn(
                            "w-full transition-[height] duration-700 ease-out motion-reduce:transition-none",
                            j === parts.length - 1 && !t.notCounted && "rounded-t-[4px]"
                          )}
                          style={{ height: mounted ? Math.max(2, h(t.byBucket[b]) - 2) : 0, background: BUCKET_META[b].color }}
                        />
                      ))}
                      {t.notCounted > 0 && (
                        <span
                          className="w-full rounded-t-[4px] transition-[height] duration-700 ease-out motion-reduce:transition-none"
                          style={{ height: mounted ? Math.max(2, h(t.notCounted) - 2) : 0, backgroundImage: hatch(NOT_COUNTED_COLOR) }}
                        />
                      )}
                    </div>
                    {open && (
                      <div
                        className={cn(
                          "pointer-events-none absolute bottom-full z-20 mb-1 w-44 rounded-xl border border-gray-200 bg-white p-2.5 text-left shadow-lg",
                          alignStart ? "left-0" : alignEnd ? "right-0" : "left-1/2 -translate-x-1/2"
                        )}
                      >
                        <p className="text-xs font-semibold text-gray-900">{t.term === UNKNOWN_TERM ? "ไม่ระบุภาค" : `ภาคการศึกษา ${t.term}`}</p>
                        <p className="text-[11px] text-gray-500 tabular-nums">
                          นับ {t.counted} จาก {t.registered} หน่วยกิต · {t.courses} วิชา
                        </p>
                        <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-700">
                          {BUCKETS.filter((b) => t.byBucket[b] > 0).map((b) => (
                            <li key={b} className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-[2px]" style={{ background: BUCKET_META[b].color }} />
                              <span className="flex-1">{BUCKET_META[b].short}</span>
                              <span className="font-semibold tabular-nums">{t.byBucket[b]}</span>
                            </li>
                          ))}
                          {t.notCounted > 0 && (
                            <li className="flex items-center gap-1.5 text-gray-500">
                              <span className="h-2 w-2 rounded-[2px]" style={{ backgroundImage: hatch(NOT_COUNTED_COLOR) }} />
                              <span className="flex-1">{t.excluded ? "ปิดการนับภาคนี้" : "ไม่นับ"}</span>
                              <span className="font-semibold tabular-nums">{t.notCounted}</span>
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* แกน X: เลขภาคทุกแท่ง, ปีการศึกษาเฉพาะแท่งแรกของปี */}
          <div className="mt-1.5 flex text-center text-[10px] leading-tight text-gray-500 tabular-nums">
            {terms.map((t, i) => {
              const { no, year } = termParts(t.term);
              const newYear = i === 0 || termParts(terms[i - 1].term).year !== year;
              return (
                <div key={t.term} className="min-w-0 flex-1">
                  <span className={cn("block font-medium", t.excluded && "text-gray-300 line-through")}>{no}</span>
                  <span className="block h-3 text-gray-400">{newYear ? year : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-1 pl-7 text-[10px] text-gray-400">ภาคการศึกษา / ปี พ.ศ. (สองหลักท้าย) · ชี้ที่แท่งเพื่อดูรายละเอียด</p>

      <table className="sr-only">
        <caption>หน่วยกิตที่นับในแต่ละภาคการศึกษา แยกตามหมวด</caption>
        <thead>
          <tr>
            <th scope="col">ภาคการศึกษา</th>
            {BUCKETS.map((b) => (
              <th key={b} scope="col">
                {BUCKET_META[b].short}
              </th>
            ))}
            <th scope="col">ไม่นับ</th>
            <th scope="col">รวมที่นับ</th>
          </tr>
        </thead>
        <tbody>
          {terms.map((t) => (
            <tr key={t.term}>
              <th scope="row">{t.term}</th>
              {BUCKETS.map((b) => (
                <td key={b}>{t.byBucket[b]}</td>
              ))}
              <td>{t.notCounted}</td>
              <td>{t.counted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
