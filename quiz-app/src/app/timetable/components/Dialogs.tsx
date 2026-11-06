"use client";

import { useState, type ReactNode } from "react";
import { ExternalLink, Plus, Trash2, AlertTriangle, CheckCircle2, CalendarPlus, ShieldCheck } from "lucide-react";
import { Dialog, dialogButton } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
  DAY_NAMES,
  fmtExam,
  fmtRange,
  shortCampus,
  type Conflict,
  type Course,
  type Slot,
} from "@/lib/timetable";

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

export function CourseDetailDialog({ course: incoming, onClose }: { course: Course | null; onClose: () => void }) {
  // keep showing the last course while the sheet animates out
  const [course, setCourse] = useState(incoming);
  if (incoming && incoming !== course) setCourse(incoming);
  return (
    <Modal
      open={!!incoming}
      onClose={onClose}
      wide
      title={
        course && (
          <>
            <span className="font-mono">{course.code}</span> {course.nameTh}
            <p className="text-xs font-normal text-gray-500 uppercase">{course.nameEn}</p>
          </>
        )
      }
    >
      {course && (
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-gray-500">หน่วยกิต</dt>
              <dd className="font-medium">{course.credits}</dd>
            </div>
            <div>
              <dt className="text-gray-500">วิทยาเขต</dt>
              <dd className="font-medium">{shortCampus(course.campus)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-500">คณะ / ภาควิชา</dt>
              <dd className="font-medium">
                {course.faculty}
                {course.dept && ` · ${course.dept}`}
              </dd>
            </div>
          </dl>
          {course.conditions?.map((c) => (
            <div key={c.title} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">{c.title}:</span> {c.body}
            </div>
          ))}
          {course.desc && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-gray-700">คำอธิบายรายวิชา</h4>
              <p className="leading-relaxed text-gray-700">{course.desc}</p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="py-1.5 pr-2">Sec</th>
                  <th className="py-1.5 pr-2">วัน / เวลา / ห้อง</th>
                  <th className="py-1.5 pr-2">ผู้สอน</th>
                  <th className="py-1.5">สอบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 align-top">
                {course.sections.map((s) => (
                  <tr key={s.sec}>
                    <td className="py-2 pr-2 font-semibold">
                      {s.sec}
                      {s.seats !== null && <p className="font-normal text-gray-500">{s.seats} ที่</p>}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">
                      {s.slots.length
                        ? s.slots.map((sl, i) => (
                            <div key={i}>
                              {DAY_NAMES[sl.day]} {fmtRange(sl.start, sl.end)}
                              {sl.room && <span className="text-gray-500"> · {sl.room}</span>}
                            </div>
                          ))
                        : s.dayTime}
                      {s.group && <p className="mt-0.5 text-gray-500">ผู้เรียน: {s.group}</p>}
                    </td>
                    <td className="py-2 pr-2">{s.instructors.join(", ") || "-"}</td>
                    <td className="py-2 text-gray-600">
                      <div>กลาง: {s.midtermAt ? fmtExam(s.midtermAt) : s.midterm}</div>
                      <div>ปลาย: {s.finalAt ? fmtExam(s.finalAt) : s.final}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {course.url && (
            <a
              href={course.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
            >
              เปิดใน SIS <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </Modal>
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
