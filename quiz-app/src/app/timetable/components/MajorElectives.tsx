"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BookMarked, CalendarCheck, Check, ChevronDown, ChevronRight, GraduationCap, Plus, Users } from "lucide-react";
import {
  DAY_SHORT,
  fmtRange,
  sectionClashes,
  sectionExamClashes,
  shortCampus,
  type Course,
  type CurriculumElectiveArea,
  type CurriculumElectiveCourse,
  type CurriculumElectives,
  type PlannedEntry,
  type Section,
} from "@/lib/timetable";
import { baseCode } from "@/lib/ge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { GhostBlock } from "./WeekGrid";

interface Props {
  electives: CurriculumElectives;
  /** e.g. "วิทยาการคอมพิวเตอร์ · หลักสูตร 2569" */
  programLabel: string;
  courses: Course[];
  entries: PlannedEntry[];
  /** base codes already passed (registration history, minus regrade) */
  takenCodes: Set<string>;
  homeCampus?: string;
  onAdd: (course: Course, sec: string) => void;
  onPreview: (g: GhostBlock | null) => void;
  onDetail: (c: Course) => void;
  onChangeCurriculum: () => void;
}

interface Offer {
  course: Course;
  section: Section;
  fits: boolean;
  clashWith: string[];
  examClashWith: string[];
}

interface AreaView {
  area: CurriculumElectiveArea;
  key: string;
  done: CurriculumElectiveCourse[];
  planned: CurriculumElectiveCourse[];
  doneCredits: number;
  plannedCredits: number;
  offered: { item: CurriculumElectiveCourse; offer: Offer }[];
  notOffered: CurriculumElectiveCourse[];
  target: number;
}

const code = (c: string) => baseCode(c) ?? c;

/** "ต้องเลือกเรียนรายวิชาในด้าน… ด้านใดด้านหนึ่ง ไม่น้อยกว่า 12 หน่วยกิต" → 12 */
function focusMinimum(note?: string): number {
  const m = note?.replace(/\s+/g, "").match(/ด้านใดด้านหนึ่ง(?:ไม่น้อยกว่า|อย่างน้อย)(\d+)หน่วยกิต/);
  return m ? Number(m[1]) : 0;
}

function bestOffer(options: Course[], entries: PlannedEntry[], homeCampus?: string): Offer | null {
  const ordered = [...options].sort((a, b) => Number(b.campus === homeCampus) - Number(a.campus === homeCampus));
  let fallback: Offer | null = null;
  for (const course of ordered) {
    for (const section of course.sections) {
      const clash = sectionClashes(section, entries, course.id);
      const exam = sectionExamClashes(section, entries, course.id);
      const offer: Offer = {
        course,
        section,
        fits: clash.length === 0,
        clashWith: clash.map((e) => e.code),
        examClashWith: exam.map((e) => e.code),
      };
      if (offer.fits && !exam.length) return offer;
      if (!fallback || (offer.fits && !fallback.fits)) fallback = offer;
    }
  }
  return fallback;
}

export function MajorElectives({
  electives,
  programLabel,
  courses,
  entries,
  takenCodes,
  homeCampus,
  onAdd,
  onPreview,
  onDetail,
  onChangeCurriculum,
}: Props) {
  const [selected, setSelected] = useState<string>("all");
  const [hideClash, setHideClash] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [openLater, setOpenLater] = useState<string | null>(null);

  const byCode = useMemo(() => {
    const m = new Map<string, Course[]>();
    for (const c of courses) m.set(code(c.code), [...(m.get(code(c.code)) ?? []), c]);
    return m;
  }, [courses]);
  const plannedCodes = useMemo(() => new Set(entries.map((e) => code(e.code))), [entries]);
  const focusMin = focusMinimum(electives.note);

  const views: AreaView[] = useMemo(
    () =>
      electives.areas.map((area, i) => {
        const done = area.courses.filter((c) => takenCodes.has(code(c.code)));
        const planned = area.courses.filter((c) => !takenCodes.has(code(c.code)) && plannedCodes.has(code(c.code)));
        const offered: AreaView["offered"] = [];
        const notOffered: CurriculumElectiveCourse[] = [];
        for (const item of area.courses) {
          const k = code(item.code);
          if (takenCodes.has(k) || plannedCodes.has(k)) continue;
          const offer = bestOffer(byCode.get(k) ?? [], entries, homeCampus);
          if (offer) offered.push({ item, offer });
          else notOffered.push(item);
        }
        offered.sort(
          (a, b) =>
            Number(b.offer.fits) - Number(a.offer.fits) ||
            Number(!b.offer.examClashWith.length) - Number(!a.offer.examClashWith.length) ||
            a.item.code.localeCompare(b.item.code)
        );
        return {
          area,
          key: String(i),
          done,
          planned,
          doneCredits: done.reduce((n, c) => n + c.credits, 0),
          plannedCredits: planned.reduce((n, c) => n + c.credits, 0),
          offered,
          notOffered,
          target: area.minCredits ?? focusMin,
        };
      }),
    [electives, takenCodes, plannedCodes, byCode, entries, homeCampus, focusMin]
  );

  const totalDone = views.reduce((n, v) => n + v.doneCredits, 0);
  const totalPlanned = views.reduce((n, v) => n + v.plannedCredits, 0);
  const lead = [...views].sort((a, b) => b.doneCredits + b.plannedCredits - (a.doneCredits + a.plannedCredits))[0];
  const shown = selected === "all" ? views : views.filter((v) => v.key === selected);

  const renderOffer = ({ item, offer }: AreaView["offered"][number]) => {
    const s = offer.section;
    return (
      <li
        key={item.code}
        className={cn(
          "rounded-2xl border bg-white p-3 transition",
          offer.fits ? "border-gray-200 hover:border-violet-300 hover:shadow-sm" : "border-red-200 bg-red-50/30"
        )}
        onMouseEnter={() => s.slots.length && onPreview({ code: offer.course.code, sec: s.sec, slots: s.slots, clash: !offer.fits })}
        onMouseLeave={() => onPreview(null)}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-sm font-bold text-gray-900">{offer.course.code}</span>
              <span className="text-[10px] text-gray-400">{item.credits} นก.</span>
              {item.group && (
                <span className="max-w-[12rem] truncate rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                  {item.group}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDetail(offer.course)}
              className="mt-0.5 line-clamp-2 text-left text-[13px] text-gray-800 hover:text-violet-700 hover:underline"
            >
              {offer.course.nameTh || item.name}
            </button>
            <p className="mt-1 text-[11px] text-gray-600 tabular-nums">
              Sec {s.sec} ·{" "}
              {s.slots.length ? s.slots.map((sl) => `${DAY_SHORT[sl.day]} ${fmtRange(sl.start, sl.end)}`).join(", ") : s.dayTime || "ยังไม่มีเวลาเรียน"}
              {s.seats !== null && (
                <span className="ml-1 inline-flex items-center gap-0.5 text-gray-400">
                  <Users className="h-3 w-3" />
                  {s.seats}
                </span>
              )}
            </p>
            {offer.course.campus !== homeCampus && homeCampus && (
              <p className="text-[10px] text-gray-400">{shortCampus(offer.course.campus)}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {offer.fits ? (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  <Check className="h-2.5 w-2.5" /> ไม่ชนตาราง
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                  <AlertTriangle className="h-2.5 w-2.5" /> ทุก Sec ชนกับ {offer.clashWith.join(", ")}
                </span>
              )}
              {offer.examClashWith.length > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                  <AlertTriangle className="h-2.5 w-2.5" /> สอบชนกับ {offer.examClashWith.join(", ")}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onAdd(offer.course, s.sec)}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-violet-600 px-2.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 active:scale-95"
            aria-label={`เพิ่ม ${offer.course.code} Sec ${s.sec}`}
          >
            <Plus className="h-3.5 w-3.5" /> เพิ่ม
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      {/* summary */}
      <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-fuchsia-50/40 p-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">วิชาเลือกหมวดวิชาเฉพาะ</p>
            <p className="truncate text-[11px] text-gray-600">{programLabel}</p>
          </div>
          <button
            type="button"
            onClick={onChangeCurriculum}
            className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-violet-700 ring-1 ring-violet-100 hover:bg-violet-100"
          >
            เปลี่ยนหลักสูตร
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {electives.credits && (
            <span className="rounded-full bg-white px-2 py-0.5 font-medium text-gray-700 ring-1 ring-violet-100">
              ต้องเรียน {electives.credits} นก.
            </span>
          )}
          <span className="rounded-full bg-white px-2 py-0.5 font-medium text-gray-700 ring-1 ring-violet-100">
            เรียนแล้ว {totalDone} · ในตาราง {totalPlanned} นก.
          </span>
          {focusMin > 0 && (
            <span className="rounded-full bg-white px-2 py-0.5 font-medium text-violet-800 ring-1 ring-violet-200">
              ต้องเน้นด้านใดด้านหนึ่ง ≥ {focusMin} นก.
            </span>
          )}
        </div>
        {electives.note && (
          <button type="button" onClick={() => setShowNote((v) => !v)} className="mt-2 block w-full text-left">
            <p className={cn("text-[11px] leading-relaxed text-gray-600", !showNote && "line-clamp-2")}>{electives.note}</p>
            <span className="text-[10px] font-semibold text-violet-700">{showNote ? "ย่อ" : "อ่านเงื่อนไขทั้งหมด"}</span>
          </button>
        )}
      </section>

      {/* areas */}
      <div className="space-y-1.5" role="radiogroup" aria-label="ด้านของวิชาเลือก">
        <button
          type="button"
          role="radio"
          aria-checked={selected === "all"}
          onClick={() => setSelected("all")}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition",
            selected === "all" ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-gray-200 bg-white hover:border-gray-300"
          )}
        >
          <BookMarked className="h-4 w-4 shrink-0 text-violet-600" />
          <span className="flex-1 font-semibold text-gray-900">ทุกด้าน</span>
          <span className="text-[11px] text-gray-500">
            {views.reduce((n, v) => n + v.offered.length, 0)} วิชาเปิดภาคนี้
          </span>
        </button>
        {views.map((v) => {
          const active = selected === v.key;
          const got = v.doneCredits + v.plannedCredits;
          const pct = v.target ? Math.min(100, (v.doneCredits / v.target) * 100) : 0;
          const pctPlanned = v.target ? Math.min(100 - pct, (v.plannedCredits / v.target) * 100) : 0;
          return (
            <button
              key={v.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(active ? "all" : v.key)}
              className={cn(
                "block w-full rounded-xl border px-3 py-2 text-left text-xs transition",
                active ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <span className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  {v.area.label && <span className="mr-1 font-bold text-violet-700">{v.area.label}</span>}
                  <span className="font-semibold text-gray-900">{v.area.name}</span>
                  {lead === v && got > 0 && (
                    <span className="ml-1.5 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white">ด้านหลักของคุณ</span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] text-gray-500 tabular-nums">
                  {v.target ? `${got}/${v.target}` : got} นก.
                </span>
              </span>
              {v.target > 0 && (
                <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                  <span className="bg-violet-600" style={{ width: `${pct}%` }} />
                  <span className="bg-violet-300" style={{ width: `${pctPlanned}%` }} />
                </span>
              )}
              <span className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-gray-500">
                <span>เปิดภาคนี้ {v.offered.length}</span>
                <span>· ยังไม่ได้ลง {v.offered.length + v.notOffered.length} วิชา</span>
                {v.done.length > 0 && <span className="text-emerald-700">· เรียนแล้ว {v.done.length}</span>}
                {v.planned.length > 0 && <span className="text-violet-700">· ในตาราง {v.planned.length}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <Checkbox checked={hideClash} onChange={setHideClash} label="ซ่อนวิชาที่ทุก Sec ชนกับตาราง" />

      {/* recommendations */}
      {shown.map((v) => {
        const list = v.offered.filter((o) => !hideClash || o.offer.fits);
        const limited = selected === "all" ? list.slice(0, 3) : list;
        const groups = selected === "all" ? [undefined] : [...new Set(limited.map((o) => o.item.group))];
        return (
          <section key={v.key} className="space-y-2">
            <div className="flex items-center gap-2 pt-1">
              <h4 className="min-w-0 flex-1 truncate text-xs font-bold text-gray-900">
                {v.area.label ? `${v.area.label} · ` : ""}
                {v.area.name}
              </h4>
              {selected === "all" && list.length > limited.length && (
                <button
                  type="button"
                  onClick={() => setSelected(v.key)}
                  className="flex shrink-0 items-center text-[11px] font-semibold text-violet-700 hover:underline"
                >
                  ดูทั้งหมด {list.length} <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>

            {(v.done.length > 0 || v.planned.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {v.done.map((c) => (
                  <span key={c.code} className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700" title={c.name}>
                    <Check className="h-2.5 w-2.5" /> {c.code}
                  </span>
                ))}
                {v.planned.map((c) => (
                  <span key={c.code} className="inline-flex items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700" title={c.name}>
                    <CalendarCheck className="h-2.5 w-2.5" /> {c.code}
                  </span>
                ))}
              </div>
            )}

            {limited.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-3 py-3 text-center text-[11px] text-gray-500">
                {v.offered.length ? "ทุกวิชาที่เปิดภาคนี้ชนกับตาราง" : "ไม่มีวิชาที่ยังไม่ได้ลงเปิดสอนในภาคนี้"}
              </p>
            ) : (
              groups.map((g) => (
                <div key={g ?? "-"} className="space-y-2">
                  {g && <p className="pl-1 text-[11px] font-semibold text-violet-700">{g}</p>}
                  <ul className="space-y-2">{limited.filter((o) => selected === "all" || o.item.group === g).map(renderOffer)}</ul>
                </div>
              ))
            )}

            {selected !== "all" && v.notOffered.length > 0 && (
              <div className="rounded-xl bg-gray-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setOpenLater(openLater === v.key ? null : v.key)}
                  className="flex w-full items-center justify-between text-[11px] font-semibold text-gray-600"
                  aria-expanded={openLater === v.key}
                >
                  ยังไม่เปิดสอนภาคนี้ ({v.notOffered.length}) — วางแผนลงภาคอื่น
                  <ChevronDown className={cn("h-3.5 w-3.5 transition", openLater === v.key && "rotate-180")} />
                </button>
                {openLater === v.key && (
                  <ul className="mt-1.5 space-y-1">
                    {v.notOffered.map((c) => (
                      <li key={c.code} className="flex gap-2 text-[11px] text-gray-600">
                        <span className="shrink-0 font-mono text-gray-500">{c.code}</span>
                        <span className="min-w-0 flex-1">{c.name}</span>
                        <span className="shrink-0 text-gray-400">{c.credits}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })}

      <p className="text-[10px] leading-relaxed text-gray-400">
        รายวิชาเลือกตามด้านจากเล่มหลักสูตรของคณะ · “ยังไม่ได้ลง” นับจากประวัติการลงทะเบียน (PDF) และตารางนี้ — ตรวจสอบเงื่อนไขกับเล่มหลักสูตรก่อนลงทะเบียน
      </p>
    </div>
  );
}
