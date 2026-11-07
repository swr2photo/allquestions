"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, FileUp, Info, MapPin, Plus, Sparkles, Users, X } from "lucide-react";
import {
  DAY_SHORT,
  fmtRange,
  shortCampus,
  type Course,
  type CurriculumElectives,
  type PlannedEntry,
} from "@/lib/timetable";
import {
  GE_AREAS,
  GE_META,
  baseCode,
  geProgress,
  plausibleGeTarget,
  recommendElectives,
  type CreditItem,
  type CurriculumTargets,
  type GeIndex,
  type GeKey,
} from "@/lib/ge";
import type { RegistrationHistory } from "@/lib/registration";
import { Select } from "@/components/ui/select";
import { Checkbox, Segmented } from "@/components/ui/checkbox";
import { GeBadge, GeIcon } from "@/components/ge-badge";
import { cn } from "@/lib/utils";
import type { GhostBlock } from "./WeekGrid";
import type { RecommendRequest } from "./CurriculumPicker";
import { MajorElectives } from "./MajorElectives";

type Mode = "ge" | "major" | "free";

interface Props {
  /** elective areas of the selected curriculum (หมวดวิชาเฉพาะ กลุ่มวิชาเลือก) */
  electives?: CurriculumElectives;
  programLabel?: string;
  onChangeCurriculum: () => void;
  courses: Course[];
  entries: PlannedEntry[];
  geIndex: GeIndex | null;
  geLoading: boolean;
  registration: RegistrationHistory;
  targets: CurriculumTargets | null;
  /** campus of the student's curriculum (default filter) */
  homeCampus?: string;
  homeFaculty?: string;
  request: RecommendRequest | null;
  onClearRequest: () => void;
  onAdd: (course: Course, sec: string) => void;
  onPreview: (g: GhostBlock | null) => void;
  onDetail: (c: Course) => void;
  onOpenRegistration: () => void;
}

export function RecommendPanel({
  electives,
  programLabel,
  onChangeCurriculum,
  courses,
  entries,
  geIndex,
  geLoading,
  registration,
  targets,
  homeCampus,
  homeFaculty,
  request,
  onClearRequest,
  onAdd,
  onPreview,
  onDetail,
  onOpenRegistration,
}: Props) {
  const [mode, setMode] = useState<Mode>(request?.kind ?? "ge");
  const [area, setArea] = useState<string>("auto");
  const [campus, setCampus] = useState<string>(homeCampus ?? "all");
  const [includeClashing, setIncludeClashing] = useState(false);
  const [limit, setLimit] = useState(15);

  // the request (from a curriculum placeholder row) overrides the manual filters
  const [reqKey, setReqKey] = useState(request);
  if (request !== reqKey) {
    setReqKey(request);
    if (request) {
      setMode(request.kind);
      setArea("auto");
      setLimit(15);
    }
  }

  const regrade = useMemo(() => new Set(registration.regradeCodes), [registration.regradeCodes]);
  const historyBase = useMemo(
    () => new Set(registration.records.filter((r) => !regrade.has(r.code)).map((r) => baseCode(r.code) ?? r.code)),
    [registration.records, regrade]
  );

  const progress = useMemo(() => {
    const items: CreditItem[] = registration.records.map((r) => ({
      code: r.code,
      name: r.name,
      credits: r.credits,
      status: "done",
      term: r.term,
    }));
    for (const e of entries) {
      if (!e.course) continue;
      if (historyBase.has(baseCode(e.code) ?? e.code)) continue;
      items.push({ code: e.code, name: e.name, credits: e.credits, status: "planned" });
    }
    return geProgress(items, geIndex);
  }, [registration.records, entries, historyBase, geIndex]);

  const only: GeKey[] | undefined = useMemo(() => {
    if (area !== "auto") return [area as GeKey];
    if (request?.hint.length) return request.hint;
    return undefined;
  }, [area, request]);

  const campuses = useMemo(() => {
    const m = new Map<string, number>();
    courses.forEach((c) => m.set(c.campus, (m.get(c.campus) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [courses]);

  const recs = useMemo(
    () =>
      mode === "major"
        ? []
        : recommendElectives({
            courses,
            index: geIndex,
            entries,
            takenCodes: historyBase,
            progress,
            only,
            ge8Group: area === "auto" ? request?.ge8Group : undefined,
            campus,
            includeClashing,
            mode,
            ownFaculty: homeFaculty,
            limit: 120,
          }),
    [courses, geIndex, entries, historyBase, progress, only, request, area, campus, includeClashing, mode, homeFaculty]
  );

  const geTotal = progress.totalDone + progress.totalPlanned;
  const target = plausibleGeTarget(targets);

  return (
    <div className="space-y-3 p-3">
      {request && (
        <div className="flex items-start gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900 ring-1 ring-violet-100">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="min-w-0 flex-1">
            แนะนำสำหรับ <span className="font-semibold">“{request.name}”</span> ({request.credits} นก.)
            {request.hint.length > 0 && <> · เน้น {request.hint.join(", ")}</>}
          </p>
          <button type="button" onClick={onClearRequest} className="rounded-md p-0.5 hover:bg-violet-100" aria-label="ล้างตัวกรองจากหลักสูตร">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Segmented
        aria-label="ประเภทคำแนะนำ"
        size="sm"
        className="flex w-full"
        value={mode}
        onChange={(v) => {
          setMode(v);
          setLimit(15);
        }}
        options={[
          { value: "ge", label: "วิชา GE" },
          { value: "major", label: "วิชาเลือกหลักสูตร" },
          { value: "free", label: "เลือกเสรี" },
        ]}
      />

      {mode === "major" ? (
        electives?.areas.length ? (
          <MajorElectives
            electives={electives}
            programLabel={programLabel ?? ""}
            courses={courses}
            entries={entries}
            takenCodes={historyBase}
            homeCampus={homeCampus}
            onAdd={onAdd}
            onPreview={onPreview}
            onDetail={onDetail}
            onChangeCurriculum={onChangeCurriculum}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-700">ยังไม่มีรายการวิชาเลือกของหลักสูตรนี้</p>
            <p className="mt-1 text-xs text-gray-500">{programLabel ? `${programLabel} — ` : ""}เลือกหลักสูตรของคุณในแท็บ “ตามหลักสูตร”</p>
            <button
              type="button"
              onClick={onChangeCurriculum}
              className="mt-3 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
            >
              เลือกหลักสูตร
            </button>
          </div>
        )
      ) : (
        <>
      {/* GE progress */}
      <section className="rounded-2xl border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-gray-900">ความคืบหน้าหมวดศึกษาทั่วไป</h3>
          <span className="text-[11px] text-gray-500 tabular-nums">
            {geTotal} {target ? `/ ${target}` : ""} นก.
          </span>
        </div>
        {target > 0 && (
          <div
            className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100"
            role="img"
            aria-label={`เรียนแล้ว ${progress.totalDone} หน่วยกิต วางแผน ${progress.totalPlanned} หน่วยกิต จาก ${target}`}
          >
            <span className="bg-emerald-600" style={{ width: `${Math.min(100, (progress.totalDone / target) * 100)}%` }} />
            <span
              className="ml-[2px] bg-emerald-300"
              style={{ width: `${Math.min(100, (progress.totalPlanned / target) * 100)}%` }}
            />
          </div>
        )}
        <div className="mt-1.5 flex gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-600" /> เรียนแล้ว {progress.totalDone}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-300" /> ในตารางนี้ {progress.totalPlanned}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {GE_AREAS.map((a) => {
            const v = progress.byArea[a];
            const credits = v.done + v.planned;
            const missing = progress.missingAreas.includes(a);
            const active = area === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setArea(active ? "auto" : a);
                  setMode("ge");
                  setLimit(15);
                }}
                title={`${a} ${GE_META[a].name}: ${credits} หน่วยกิต`}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl border px-1 py-1.5 text-center transition",
                  active
                    ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500"
                    : missing
                      ? "border-dashed border-amber-300 bg-amber-50/50 hover:border-amber-400"
                      : "border-gray-100 bg-gray-50/70 hover:border-gray-300"
                )}
              >
                <GeIcon ge={a} className={cn("h-4 w-4", missing ? "text-amber-600" : "text-gray-500")} />
                <span className="text-[10px] font-bold text-gray-800">{a}</span>
                <span className={cn("text-[10px] tabular-nums", missing ? "font-medium text-amber-700" : "text-gray-500")}>
                  {missing ? "ยังไม่มี" : `${credits} นก.`}
                </span>
              </button>
            );
          })}
        </div>
        {registration.records.length === 0 && (
          <button
            type="button"
            onClick={onOpenRegistration}
            className="mt-2.5 flex w-full items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-left text-[11px] text-sky-900 ring-1 ring-sky-100 hover:bg-sky-100"
          >
            <FileUp className="h-4 w-4 shrink-0" />
            <span>
              นำเข้า <b>ผลการลงทะเบียน (PDF)</b> เพื่อนับหน่วยกิต GE ที่เรียนแล้ว และไม่แนะนำวิชาที่เคยลง
            </span>
          </button>
        )}
      </section>

      {/* filters */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="หมวด"
            size="sm"
            value={area}
            onChange={(v) => {
              setArea(v);
              setLimit(15);
            }}
            options={[
              { value: "auto", label: "อัตโนมัติ (หมวดที่ขาด)" },
              ...GE_AREAS.map((a) => ({
                value: a,
                label: `${a} ${GE_META[a].short}`,
                textValue: `${a} ${GE_META[a].name}`,
                icon: <GeIcon ge={a} className="h-4 w-4" />,
                meta: progress.missingAreas.includes(a) ? "ขาด" : undefined,
              })),
            ]}
          />
          <Select
            label="วิทยาเขต"
            size="sm"
            icon={<MapPin className="h-3.5 w-3.5" />}
            value={campus}
            onChange={(v) => {
              setCampus(v);
              setLimit(15);
            }}
            options={[{ value: "all", label: "ทุกวิทยาเขต" }, ...campuses.map((c) => ({ value: c, label: shortCampus(c) }))]}
          />
        </div>
        <Checkbox checked={includeClashing} onChange={setIncludeClashing} label="แสดงวิชาที่ชนกับตารางด้วย" />
      </div>

      {/* results */}
      {geLoading && !geIndex ? (
        <p className="py-6 text-center text-xs text-gray-500">กำลังโหลดข้อมูลหมวด GE…</p>
      ) : recs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">ยังไม่มีวิชาที่แนะนำตามเงื่อนไขนี้</p>
          <p className="mt-1 text-xs text-gray-500">ลองเปลี่ยนวิทยาเขต หรือติ๊กแสดงวิชาที่ชนตาราง</p>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-gray-500">
            {recs.length} วิชาที่เข้าเงื่อนไข · เรียงตามหมวดที่ยังขาดและความพอดีกับตาราง
          </p>
          <ul className="space-y-2" onMouseLeave={() => onPreview(null)}>
            {recs.slice(0, limit).map((r) => {
              const s = r.section;
              return (
                <li
                  key={r.course.id}
                  className={cn("rounded-2xl border bg-white p-3 transition", r.fits ? "border-gray-200 hover:border-violet-300" : "border-red-200 bg-red-50/30")}
                  onMouseEnter={() =>
                    s.slots.length && onPreview({ code: r.course.code, sec: s.sec, slots: s.slots, clash: !r.fits })
                  }
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm font-bold text-gray-900">{r.course.code}</span>
                        {r.info.levels.slice(0, 1).map((g) => (
                          <GeBadge key={g} ge={g} size="xs" withName />
                        ))}
                        <span className="text-[10px] text-gray-400">{r.course.creditNum} นก.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDetail(r.course)}
                        className="mt-0.5 line-clamp-2 text-left text-[13px] text-gray-800 hover:text-violet-700 hover:underline"
                      >
                        {r.course.nameTh}
                      </button>
                      <p className="mt-1 text-[11px] text-gray-600 tabular-nums">
                        Sec {s.sec} ·{" "}
                        {s.slots.length
                          ? s.slots.map((sl) => `${DAY_SHORT[sl.day]} ${fmtRange(sl.start, sl.end)}`).join(", ")
                          : s.dayTime || "ยังไม่มีเวลาเรียน"}
                        {s.seats !== null && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-gray-400">
                            <Users className="h-3 w-3" />
                            {s.seats}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400">{shortCampus(r.course.campus)} · {r.course.faculty}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.reasons.slice(0, 3).map((reason) => (
                          <span
                            key={reason}
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px]",
                              reason.startsWith("ทุก Sec") ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                            )}
                          >
                            {reason.startsWith("ทุก Sec") ? <AlertTriangle className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAdd(r.course, s.sec)}
                      className="flex shrink-0 items-center gap-1 rounded-xl bg-violet-600 px-2.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
                      aria-label={`เพิ่ม ${r.course.code} Sec ${s.sec}`}
                    >
                      <Plus className="h-3.5 w-3.5" /> เพิ่ม
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {recs.length > limit && (
            <button
              type="button"
              onClick={() => setLimit(limit + 15)}
              className="w-full rounded-xl border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50"
            >
              แสดงเพิ่ม ({recs.length - limit})
            </button>
          )}
        </>
      )}

      <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-gray-400">
        <Info className="mt-px h-3 w-3 shrink-0" />
        หมวด GE จากรหัสวิชาใน SIS (…G1–G8) และ{" "}
        <Link href="/gened" className="underline hover:text-gray-600">
          gened.psu.ac.th
        </Link>{" "}
        — เงื่อนไขหน่วยกิตแต่ละหมวดขึ้นกับเล่มหลักสูตรของคุณ โปรดตรวจสอบก่อนลงทะเบียน
      </p>
        </>
      )}
    </div>
  );
}
