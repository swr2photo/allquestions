"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  FileText,
  Info,
  Layers,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Dialog, dialogButton } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DAY_NAMES,
  sectionClashes,
  shortCampus,
  type Conflict,
  type Course,
  type PlannedEntry,
  type Slot,
} from "@/lib/timetable";
import { SectionCard } from "./SectionCard";

/** Thin wrapper kept for older call sites — renders the shared custom Dialog. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  description,
  icon,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  description?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} icon={icon} footer={footer} size={wide ? "lg" : "md"}>
      {children}
    </Dialog>
  );
}

export function CourseDetailDialog({
  course: incoming,
  onClose,
  entries = [],
  onAdd,
  onRemove,
}: {
  course: Course | null;
  onClose: () => void;
  /** current plan — enables clash checks and the "เลือก" buttons */
  entries?: PlannedEntry[];
  onAdd?: (course: Course, sec: string) => void;
  onRemove?: (courseId: string) => void;
}) {
  // keep showing the last course while the sheet animates out
  const [course, setCourse] = useState(incoming);
  const [showAllDesc, setShowAllDesc] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  if (incoming && incoming !== course) {
    setCourse(incoming);
    setShowAllDesc(false);
    setFreeOnly(false);
  }
  const plannedSec = course ? entries.find((e) => e.course?.id === course.id)?.sec : undefined;
  const sections = course
    ? course.sections.filter((s) => !freeOnly || s.sec === plannedSec || !sectionClashes(s, entries, course.id).length)
    : [];
  const freeCount = course ? course.sections.filter((s) => !sectionClashes(s, entries, course.id).length).length : 0;
  const longDesc = (course?.desc.length ?? 0) > 260;

  return (
    <Modal
      open={!!incoming}
      onClose={onClose}
      wide
      icon={<BookOpen className="h-5 w-5" />}
      title={
        course && (
          <>
            <span className="mr-1.5 inline-block rounded-lg bg-emerald-50 px-2 py-0.5 font-mono text-emerald-700 ring-1 ring-emerald-100">{course.code}</span>
            {course.nameTh}
            <p className="mt-0.5 text-xs font-normal tracking-wide text-gray-500 uppercase">{course.nameEn}</p>
          </>
        )
      }
    >
      {course && (
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <InfoTile icon={<Award className="h-4 w-4" />} label="หน่วยกิต" value={course.credits || String(course.creditNum)} tone="emerald" />
            <InfoTile icon={<MapPin className="h-4 w-4" />} label="วิทยาเขต" value={shortCampus(course.campus)} tone="sky" />
            <InfoTile icon={<Layers className="h-4 w-4" />} label="Section" value={`${course.sections.length} กลุ่ม`} tone="violet" />
            <InfoTile
              icon={<CalendarCheck className="h-4 w-4" />}
              label="ไม่ชนกับตาราง"
              value={entries.length ? `${freeCount} / ${course.sections.length} Sec` : "—"}
              tone={entries.length && !freeCount ? "red" : "amber"}
            />
            <div className="col-span-2 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2 sm:col-span-4">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold text-gray-500">คณะ / ภาควิชา</dt>
                <dd className="font-medium text-gray-800">
                  {course.faculty}
                  {course.dept && <span className="text-gray-500"> · {course.dept}</span>}
                </dd>
              </div>
            </div>
          </dl>

          {course.conditions?.map((c) => (
            <div key={c.title} className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                <span className="font-semibold">{c.title}:</span> {c.body}
              </p>
            </div>
          ))}

          {course.desc && (
            <div className="rounded-xl border border-gray-100 px-3 py-2.5">
              <h4 className="mb-1 flex items-center gap-1 text-xs font-semibold text-gray-700">
                <FileText className="h-3.5 w-3.5 text-gray-400" /> คำอธิบายรายวิชา
              </h4>
              <p className={`text-[13px] leading-relaxed text-gray-700 ${longDesc && !showAllDesc ? "line-clamp-4" : ""}`}>{course.desc}</p>
              {longDesc && (
                <button type="button" onClick={() => setShowAllDesc((v) => !v)} className="mt-1 text-xs font-semibold text-emerald-700 hover:underline">
                  {showAllDesc ? "ย่อ" : "อ่านทั้งหมด"}
                </button>
              )}
            </div>
          )}

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                Section ที่เปิดสอน <span className="rounded-full bg-gray-100 px-2 text-xs font-semibold text-gray-600">{course.sections.length}</span>
              </h4>
              {entries.length > 0 && course.sections.length > 1 && (
                <Checkbox checked={freeOnly} onChange={setFreeOnly} label="เฉพาะ Sec ที่ไม่ชนกับตาราง" />
              )}
            </div>
            {course.sections.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">ยังไม่มี section ที่เปิดสอนในภาคนี้</p>
            ) : sections.length === 0 ? (
              <p className="rounded-xl bg-red-50 px-3 py-4 text-center text-xs text-red-700">ทุก Section ชนกับตารางปัจจุบัน</p>
            ) : (
              <div className="space-y-2">
                {sections.map((s) => (
                  <SectionCard
                    key={s.sec}
                    course={course}
                    section={s}
                    entries={entries}
                    selected={plannedSec === s.sec}
                    onAdd={onAdd}
                    onRemove={onRemove}
                  />
                ))}
              </div>
            )}
          </div>

          {course.url && (
            <a
              href={course.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-1 text-xs font-semibold text-emerald-700 hover:underline"
            >
              เปิดใน SIS <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </Modal>
  );
}

const TILE_TONE = {
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
} as const;

function InfoTile({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: keyof typeof TILE_TONE }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-2.5 py-2">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TILE_TONE[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold text-gray-500">{label}</dt>
        <dd className="truncate text-[13px] font-bold text-gray-900">{value}</dd>
      </div>
    </div>
  );
}

export interface CustomActivityInput {
  code: string;
  name: string;
  room: string;
  credits: number;
  slots: Slot[];
}

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// 06:00 – 22:00 every 10 minutes (SIS periods end at :50)
const TIME_OPTIONS = Array.from({ length: (22 - 6) * 6 + 1 }, (_, i) => 6 * 60 + i * 10).map((m) => ({
  value: m,
  label: toHHMM(m),
}));
const DAY_OPTIONS = DAY_NAMES.map((d, i) => ({ value: i, label: d }));
const CREDIT_OPTIONS = Array.from({ length: 10 }, (_, i) => ({ value: i, label: i === 0 ? "ไม่นับหน่วยกิต" : `${i} หน่วยกิต` }));

const fieldClass =
  "mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

export function CustomActivityDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: CustomActivityInput) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [credits, setCredits] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([{ day: 0, start: 9 * 60, end: 12 * 60 }]);
  const valid = name.trim() && slots.length > 0 && slots.every((s) => s.end > s.start);

  const reset = () => {
    setCode("");
    setName("");
    setRoom("");
    setCredits(0);
    setSlots([{ day: 0, start: 9 * 60, end: 12 * 60 }]);
  };

  const submit = () => {
    if (!valid) return;
    onSave({ code: code.trim(), name: name.trim(), room: room.trim(), credits, slots });
    reset();
  };

  const patchSlot = (i: number, p: Partial<Slot>) => setSlots(slots.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="เพิ่มวิชา / กิจกรรมเอง"
      description="สำหรับวิชาที่ไม่มีใน SIS ชั่วโมงทำงานพิเศษ ชมรม ฯลฯ"
      icon={<CalendarPlus className="h-5 w-5" />}
      footer={
        <>
          <button type="button" onClick={onClose} className={dialogButton.secondary}>
            ยกเลิก
          </button>
          <button type="button" onClick={submit} disabled={!valid} className={dialogButton.primary}>
            <Plus className="h-4 w-4" /> เพิ่มลงตาราง
          </button>
        </>
      }
    >
      <form
        className="space-y-4 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs font-medium text-gray-600">
            รหัส
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น ชมรม" className={fieldClass} />
          </label>
          <label className="col-span-2 text-xs font-medium text-gray-600">
            ชื่อ *
            <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} data-autofocus />
          </label>
          <label className="col-span-2 text-xs font-medium text-gray-600">
            สถานที่
            <input value={room} onChange={(e) => setRoom(e.target.value)} className={fieldClass} />
          </label>
          <div className="text-xs font-medium text-gray-600">
            หน่วยกิต
            <div className="mt-1">
              <Select label="หน่วยกิต" value={credits} onChange={setCredits} options={CREDIT_OPTIONS} className="h-11" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">วัน / เวลา</p>
          {slots.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto_1fr_auto] items-center gap-1.5">
              <Select label="วัน" value={s.day} onChange={(day) => patchSlot(i, { day })} options={DAY_OPTIONS} />
              <Select label="เวลาเริ่ม" value={s.start} onChange={(start) => patchSlot(i, { start, end: Math.max(s.end, start + 50) })} options={TIME_OPTIONS} />
              <span className="text-gray-400">–</span>
              <Select
                label="เวลาสิ้นสุด"
                value={s.end}
                onChange={(end) => patchSlot(i, { end })}
                options={TIME_OPTIONS.map((o) => ({ ...o, disabled: o.value <= s.start }))}
              />
              <button
                type="button"
                onClick={() => setSlots(slots.filter((_, j) => j !== i))}
                disabled={slots.length === 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                aria-label="ลบช่วงเวลา"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSlots([...slots, { day: 0, start: 13 * 60, end: 16 * 60 }])}
            className="flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            <Plus className="h-3.5 w-3.5" /> เพิ่มช่วงเวลา
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const CONFLICT_LABEL: Record<Conflict["type"], string> = {
  class: "เวลาเรียนชนกัน",
  midterm: "สอบกลางภาคชนกัน",
  final: "สอบปลายภาคชนกัน",
};

export function ConflictsDialog({
  open,
  onClose,
  conflicts,
  unscheduled,
  totalCredits,
  maxCredits,
}: {
  open: boolean;
  onClose: () => void;
  conflicts: Conflict[];
  unscheduled: string[];
  totalCredits: number;
  maxCredits: number;
}) {
  const ok = conflicts.length === 0;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="ตรวจสอบตาราง"
      icon={ok ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      iconClassName={ok ? undefined : "bg-red-100 text-red-600"}
      description={ok ? "ไม่พบเวลาเรียนหรือวันสอบที่ชนกัน" : `พบ ${conflicts.length} รายการที่ต้องแก้`}
    >
      <div className="space-y-3 text-sm">
        {ok ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" /> ตารางพร้อมลงทะเบียน
          </div>
        ) : (
          <ul className="space-y-2">
            {conflicts.map((c, i) => (
              <li key={i} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                <p className="flex items-center gap-1 text-xs font-semibold text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> {CONFLICT_LABEL[c.type]}
                </p>
                <p className="mt-0.5 text-gray-800">
                  <span className="font-mono">{c.a.code}</span> (Sec {c.a.sec}) ↔ <span className="font-mono">{c.b.code}</span> (Sec {c.b.sec})
                </p>
                <p className="text-xs text-gray-600">{c.detail}</p>
              </li>
            ))}
          </ul>
        )}
        {unscheduled.length > 0 && (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
            ยังไม่มีเวลาเรียนใน SIS (ไม่แสดงบนตาราง): {unscheduled.join(", ")}
          </p>
        )}
        <p className={`text-xs ${totalCredits > maxCredits ? "font-semibold text-orange-600" : "text-gray-500"}`}>
          รวม {totalCredits} หน่วยกิต
          {totalCredits > maxCredits &&
            ` — เกิน ${maxCredits} หน่วยกิต ตรวจสอบเงื่อนไขการลงทะเบียนเกินหน่วยกิตของคณะ/หลักสูตร`}
        </p>
      </div>
    </Dialog>
  );
}
