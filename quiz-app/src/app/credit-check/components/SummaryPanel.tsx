"use client";

import { useState } from "react";
import {
  Atom,
  ChartColumn,
  ChevronDown,
  Circle,
  CircleCheck,
  Compass,
  Globe,
  Hourglass,
  ListChecks,
  PartyPopper,
  Puzzle,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { GeBadge, GeIcon } from "@/components/ge-badge";
import { GE_META } from "@/lib/ge";
import {
  BUCKETS,
  BUCKET_META,
  SKIP_LABEL,
  isNonEarnedGrade,
  type Bucket,
  type CheckedCourse,
  type CreditSummary,
  type CriterionCheck,
} from "@/lib/credit-check";
import { UNKNOWN_TERM } from "@/lib/registration";
import { cn } from "@/lib/utils";
import { BucketMeter, CreditDonut, CreditPips, TermChart, hatch } from "./charts";

const BUCKET_ICON: Record<Bucket, LucideIcon> = { ge: Globe, required: Atom, elective: Puzzle, free: Compass };

const CARD = "rounded-3xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]";

function SectionTitle({ icon: Icon, title, hint, aside }: { icon: LucideIcon; title: string; hint?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{hint}</p>}
      </div>
      {aside}
    </div>
  );
}

// ------------------------------------------------------------------ overview

function Verdict({ summary }: { summary: CreditSummary }) {
  const failed = summary.checks.filter((c) => c.status === "fail").length;
  if (summary.verdict === "complete") {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-600 px-4 py-3 text-white">
        <PartyPopper className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-bold">ครบทุกเกณฑ์ตามโครงสร้างหลักสูตรแล้ว</p>
          <p className="mt-0.5 text-xs text-emerald-50">ยืนยันการสำเร็จการศึกษากับงานทะเบียนหรืออาจารย์ที่ปรึกษาอีกครั้ง</p>
        </div>
      </div>
    );
  }
  if (summary.verdict === "pending") {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sky-950 ring-1 ring-sky-200 ring-inset">
        <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
        <div>
          <p className="text-sm font-bold">จะครบทุกเกณฑ์ เมื่อวิชาที่ยังไม่มีเกรดผ่านทั้งหมด</p>
          <p className="mt-0.5 text-xs text-sky-900">มี {summary.pending} หน่วยกิตที่นับอยู่แต่ยังไม่มีเกรด</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-amber-950 ring-1 ring-amber-200 ring-inset">
      <Target className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <div>
        <p className="text-sm font-bold">
          {summary.remaining > 0 ? `ขาดอีก ${summary.remaining} หน่วยกิต` : `หน่วยกิตรวมครบแล้ว แต่ยังไม่ผ่านอีก ${failed} เกณฑ์`}
        </p>
        <p className="mt-0.5 text-xs text-amber-900">
          {summary.remaining > 0 && summary.pace
            ? `ที่อัตราเฉลี่ย ${summary.pace.perTerm.toFixed(1)} หน่วยกิตต่อภาคปกติ ต้องเรียนอีกประมาณ ${summary.pace.termsLeft} ภาค`
            : "ดูข้อที่ยังไม่ครบในรายการตรวจเกณฑ์"}
        </p>
      </div>
    </div>
  );
}

function StatTile({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-3.5 py-3">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1">
        <span className="text-2xl leading-tight font-bold tracking-tight text-gray-900 tabular-nums">{value}</span>
        {unit && <span className="text-xs font-medium text-gray-500">{unit}</span>}
      </p>
      {note && <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{note}</p>}
    </div>
  );
}

function CheckRow({ check, onOpen }: { check: CriterionCheck; onOpen: (b: Bucket) => void }) {
  const Icon = check.status === "pass" ? CircleCheck : check.status === "warn" ? TriangleAlert : Circle;
  const body = (
    <>
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          check.status === "pass" ? "text-emerald-600" : check.status === "warn" ? "text-amber-600" : "text-gray-300"
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[13px] leading-snug font-medium", check.status === "pass" ? "text-gray-500" : "text-gray-900")}>{check.label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-gray-500">
          <span className="sr-only">{check.status === "pass" ? "ผ่าน: " : check.status === "warn" ? "ควรตรวจ: " : "ยังไม่ครบ: "}</span>
          {check.detail}
        </span>
      </span>
    </>
  );
  return (
    <li>
      {check.bucket ? (
        <button
          type="button"
          onClick={() => onOpen(check.bucket!)}
          className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors outline-none hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          {body}
        </button>
      ) : (
        <div className="flex items-start gap-2.5 px-2.5 py-2">{body}</div>
      )}
    </li>
  );
}

// ------------------------------------------------------------------ bucket detail

function sourceTag(c: CheckedCourse): { label: string; tone: string } | null {
  if (c.overridden) return { label: "แก้หมวดเอง", tone: "bg-sky-50 text-sky-800 ring-sky-200" };
  if (c.guessed) return { label: "ระบบเดาหมวด", tone: "bg-amber-50 text-amber-900 ring-amber-200" };
  if (c.bucket === "required" && c.inPlan) return { label: "ในแผนหลักสูตร", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200" };
  if (c.bucket === "elective" && c.inElectiveCatalog) return { label: "เลือกในหลักสูตร", tone: "bg-violet-50 text-violet-800 ring-violet-200" };
  return null;
}

const SPILL_TONE = "bg-orange-50 text-orange-800 ring-orange-200";

function DetailRow({ c, tag, creditLabel }: { c: CheckedCourse; tag: { label: string; tone: string } | null; creditLabel?: string }) {
  const grade = c.record.grade;
  const badGrade = !!grade && (isNonEarnedGrade(grade) || grade.trim().toUpperCase() === "AU");
  return (
    <li className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2 text-xs">
      <span className="min-w-[4.75rem] shrink-0 font-mono font-semibold text-gray-900">{c.record.code}</span>
      <div className="min-w-0 flex-1 basis-48">
        <span className="text-sm text-gray-800">{c.record.name}</span>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-gray-500">{c.record.term === UNKNOWN_TERM ? "ไม่ระบุภาค" : `ภาค ${c.record.term}`}</span>
          {grade && (
            <span
              className={cn(
                "rounded px-1.5 py-px font-mono text-[10px] font-semibold ring-1 ring-inset",
                badGrade ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"
              )}
            >
              {grade}
            </span>
          )}
          {c.pending && <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-medium text-gray-700">ยังไม่มีเกรด</span>}
          {c.ge && c.bucket === "ge" && <GeBadge ge={c.ge} size="xs" />}
          {tag && <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium ring-1 ring-inset", tag.tone)}>{tag.label}</span>}
        </div>
      </div>
      <span className="shrink-0 font-semibold text-gray-900 tabular-nums">{creditLabel ?? `${c.record.credits} นก.`}</span>
    </li>
  );
}

function BucketDetail({ b, summary }: { b: Bucket; summary: CreditSummary }) {
  const meta = BUCKET_META[b];
  const s = summary.buckets[b];
  const list = summary.byBucket[b];
  const overflowList = b === "free" ? summary.overflowCourses : [];
  const { basicNeed, majorRequiredNeed, extraNeed, geOverflow, electiveOverflow } = summary.breakdown;
  const planCredits = list.reduce((acc, c) => acc + (c.inPlan ? c.record.credits : 0), 0);
  const missingInBucket = summary.missing.filter((m) => m.bucket === b);
  const have = s.earned + s.overflowIn;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
          <h4 className="text-sm font-bold text-gray-900">{meta.label}</h4>
        </div>
        <span className="text-xs font-semibold text-gray-700 tabular-nums">
          นับเข้าเกณฑ์ {s.counted} / {s.need} นก. · {list.length + overflowList.length} วิชา
        </span>
      </div>

      <p className="text-xs leading-relaxed text-gray-600">
        {b === "required" && (
          <>
            เกณฑ์ {s.need} นก. (พื้นฐาน {basicNeed} + เอกบังคับ {majorRequiredNeed}
            {extraNeed > 0 ? ` + อื่น ๆ ${extraNeed}` : ""}) · ลงผ่านแล้ว {s.earned} นก.
            {planCredits > 0 && ` — ตรงตามแผน ${planCredits} นก.`}
            {planCredits > 0 && s.earned > planCredits && ` · นอกแผน/จัดหมวดเพิ่ม ${s.earned - planCredits} นก.`}
          </>
        )}
        {b === "ge" && (
          <>
            เกณฑ์ {s.need} นก. · ลงผ่านแล้ว {s.earned} นก. · นับเข้าหมวดได้ {s.counted} นก.
            {geOverflow > 0 &&
              (s.short > 0
                ? ` · ${geOverflow} นก. เกินโควตาของสาระ จึงย้ายไปนับเป็นเลือกเสรี (ไม่ทดแทนสาระบังคับที่ยังขาด)`
                : ` · เกินเกณฑ์ ${geOverflow} นก. ย้ายไปนับเป็นเลือกเสรี`)}
          </>
        )}
        {b === "elective" && (
          <>
            เกณฑ์ {s.need} นก. · ลงผ่านแล้ว {s.earned} นก.
            {electiveOverflow > 0 && ` · เกินเกณฑ์ ${electiveOverflow} นก. ย้ายไปนับเป็นเลือกเสรี`}
          </>
        )}
        {b === "free" && (
          <>
            เกณฑ์ {s.need} นก. · ลงในหมวดเสรีโดยตรง {s.earned} นก.
            {geOverflow > 0 && ` + ส่วนเกิน GE ${geOverflow} นก.`}
            {electiveOverflow > 0 && ` + ส่วนเกินวิชาเลือก ${electiveOverflow} นก.`}
            {s.overflowIn > 0 && ` = ${have} นก.`}
            {have > s.need && ` (เกินอีก ${have - s.need} นก. ไม่นับเข้าเกณฑ์รวม)`}
          </>
        )}
        {s.pending > 0 && ` · ในจำนวนนี้ ${s.pending} นก. ยังไม่มีเกรด`}
      </p>

      {list.length + overflowList.length > 0 ? (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {list.map((c) => {
            const spill = b !== "free" ? summary.overflowByKey.get(c.key) : undefined;
            const tag = spill
              ? {
                  label: spill.credits < c.record.credits ? `แบ่งเกิน ${spill.credits} นก. → เลือกเสรี` : "เกินโควตา → นับเป็นเลือกเสรี",
                  tone: SPILL_TONE,
                }
              : sourceTag(c);
            return <DetailRow key={c.key} c={c} tag={tag} />;
          })}
          {overflowList.map((o) => (
            <DetailRow
              key={`overflow:${o.course.key}`}
              c={o.course}
              tag={{ label: o.from === "ge" ? "ปัดจากศึกษาทั่วไป" : "ปัดจากเฉพาะเลือก", tone: SPILL_TONE }}
              creditLabel={o.credits < o.course.record.credits ? `ปัดมา ${o.credits}/${o.course.record.credits} นก.` : `${o.credits} นก.`}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-3 py-3 text-xs text-gray-500">ยังไม่มีรายวิชาที่นับในหมวดนี้</p>
      )}

      {missingInBucket.length > 0 && (
        <p className="text-[11px] leading-relaxed text-amber-800">
          ยังขาดรายวิชาในแผนของหมวดนี้ {missingInBucket.length} วิชา ({missingInBucket.reduce((acc, m) => acc + m.credits, 0)} นก.):{" "}
          {missingInBucket.map((m) => `${m.code} (${m.credits})`).join(", ")}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ panel

export function SummaryPanel({ summary }: { summary: CreditSummary }) {
  const [openBucket, setOpenBucket] = useState<Bucket | null>(null);
  const [hoverBucket, setHoverBucket] = useState<Bucket | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [showMissing, setShowMissing] = useState(() => summary.missing.length > 0 && summary.missing.length <= 6);

  const countedCourses = summary.courses.length - summary.skipped.length;
  const passed = summary.checks.filter((c) => c.status === "pass").length;
  const surplus = summary.earned - summary.counted;
  const requiredMissing = summary.missing.filter((m) => m.bucket === "required");
  const geMissing = summary.missing.filter((m) => m.bucket === "ge");
  const { basicNeed, majorRequiredNeed, extraNeed } = summary.breakdown;

  const openDetail = (b: Bucket) => {
    setOpenBucket(b);
    requestAnimationFrame(() => document.getElementById("credit-bucket-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        {/* ภาพรวม */}
        <section className={cn(CARD, "flex flex-col justify-center gap-4 p-4 sm:p-5 lg:col-span-3")} aria-label="ภาพรวมหน่วยกิต">
          <div className="grid items-center gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
            <CreditDonut summary={summary} active={hoverBucket ?? openBucket} onActive={setHoverBucket} onSelect={openDetail} />
            <div className="space-y-3">
              <Verdict summary={summary} />
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="ยังขาด" value={String(summary.remaining)} unit="หน่วยกิต" note={`จากทั้งหมด ${summary.total} หน่วยกิต`} />
                <StatTile
                  label="ลงผ่านทั้งหมด"
                  value={String(summary.earned)}
                  unit="หน่วยกิต"
                  note={`${countedCourses} วิชา · ${summary.terms.length} ภาคการศึกษา`}
                />
                {summary.pending > 0 ? (
                  <StatTile label="ยังไม่มีเกรด" value={String(summary.pending)} unit="หน่วยกิต" note="นับไว้ก่อน — ต้องสอบผ่านจึงได้จริง" />
                ) : (
                  <StatTile
                    label="เกินเกณฑ์ของหมวด"
                    value={String(surplus)}
                    unit="หน่วยกิต"
                    note={surplus > 0 ? "ไม่ช่วยลดส่วนที่ขาด" : "ทุกหน่วยกิตนับเข้าโครงสร้าง"}
                  />
                )}
                {summary.gpa ? (
                  <StatTile
                    label="เกรดเฉลี่ยสะสม (ประมาณ)"
                    value={summary.gpa.value.toFixed(2)}
                    note={`จาก ${summary.gpa.credits} หน่วยกิตที่มีเกรด`}
                  />
                ) : (
                  <StatTile label="เกรดเฉลี่ยสะสม" value="–" note="นำเข้าใบผลการเรียนเพื่อคำนวณ" />
                )}
              </div>
            </div>
          </div>
          {/* คำอธิบายสีของวงแหวน (ชี้เพื่อเน้นหมวด, กดเพื่อดูรายวิชา) */}
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-gray-100 pt-3 xl:grid-cols-4">
            {BUCKETS.map((b) => (
              <li key={b}>
                <button
                  type="button"
                  onClick={() => openDetail(b)}
                  onMouseEnter={() => setHoverBucket(b)}
                  onMouseLeave={() => setHoverBucket(null)}
                  onFocus={() => setHoverBucket(b)}
                  onBlur={() => setHoverBucket(null)}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs outline-none hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: BUCKET_META[b].color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-700">{BUCKET_META[b].short}</span>
                  <span className="shrink-0 font-semibold text-gray-900 tabular-nums">
                    {summary.buckets[b].counted}/{summary.buckets[b].need}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {summary.pending > 0 && (
            <p className="flex items-center gap-2 text-[11px] text-gray-500">
              <span className="h-2.5 w-5 shrink-0 rounded-full" style={{ backgroundImage: hatch("#6b7280") }} aria-hidden />
              ส่วนลายเส้นในกราฟ = หน่วยกิตของวิชาที่ยังไม่มีเกรด (กำลังเรียนหรือเพิ่มเอง)
            </p>
          )}
        </section>

        {/* รายการตรวจเกณฑ์ */}
        <section className={cn(CARD, "p-4 sm:p-5 lg:col-span-2")} aria-label="รายการตรวจเกณฑ์สำเร็จการศึกษา">
          <SectionTitle
            icon={ListChecks}
            title="ตรวจเกณฑ์สำเร็จการศึกษา"
            hint={`ผ่านแล้ว ${passed} จาก ${summary.checks.length} ข้อ`}
            aside={
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 tabular-nums">
                {passed}/{summary.checks.length}
              </span>
            }
          />
          <ul className="mt-2 -mx-1 space-y-0.5">
            {summary.checks.map((c) => (
              <CheckRow key={c.id} check={c} onOpen={openDetail} />
            ))}
          </ul>
        </section>
      </div>

      {/* รายหมวด */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {BUCKETS.map((b) => {
          const s = summary.buckets[b];
          const meta = BUCKET_META[b];
          const Icon = BUCKET_ICON[b];
          const ok = s.short === 0;
          const open = openBucket === b;
          const count = summary.byBucket[b].length + (b === "free" ? summary.overflowCourses.length : 0);
          const note =
            b === "required"
              ? `พื้นฐาน ${basicNeed} + เอกบังคับ ${majorRequiredNeed}${extraNeed > 0 ? ` + อื่น ๆ ${extraNeed}` : ""}`
              : b === "free"
                ? s.overflowIn > 0
                  ? `ลงตรง ${s.earned} + ส่วนเกินจากหมวดอื่น ${s.overflowIn}`
                  : "รับส่วนเกินจาก GE และวิชาเลือกได้"
                : s.earned > s.counted
                  ? `ลงผ่าน ${s.earned} · ${s.earned - s.counted} นก. ไปนับเป็นเลือกเสรี`
                  : `ลงผ่าน ${s.earned} หน่วยกิต`;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setOpenBucket(open ? null : b)}
              onMouseEnter={() => setHoverBucket(b)}
              onMouseLeave={() => setHoverBucket(null)}
              onFocus={() => setHoverBucket(b)}
              onBlur={() => setHoverBucket(null)}
              aria-expanded={open}
              aria-controls="credit-bucket-detail"
              className={cn(
                CARD,
                "group relative overflow-hidden p-4 text-left transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500/50 motion-reduce:hover:translate-y-0",
                open && "ring-2 ring-gray-900/80"
              )}
            >
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: meta.color }} aria-hidden />
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${meta.color}1f`, color: meta.color }}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
                  )}
                >
                  {ok ? <CircleCheck className="h-3 w-3" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
                  {ok ? "ครบ" : `ขาด ${s.short}`}
                </span>
              </div>
              <h3 className="mt-2.5 text-sm leading-snug font-semibold text-gray-900">{meta.label}</h3>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl leading-none font-bold tracking-tight text-gray-900 tabular-nums">{s.counted}</span>
                <span className="text-sm text-gray-500 tabular-nums">/ {s.need} นก.</span>
              </p>
              <BucketMeter summary={s} color={meta.color} label={meta.label} className="mt-2.5" />
              <p className="mt-2 min-h-8 text-[11px] leading-snug text-gray-500">{note}</p>
              <span className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-[11px] font-semibold text-gray-700">
                {open ? "ซ่อนรายวิชา" : `ดูรายวิชา (${count})`}
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform", open && "rotate-180")} aria-hidden />
              </span>
            </button>
          );
        })}
      </div>

      <div id="credit-bucket-detail" className="scroll-mt-20">
        {openBucket && (
          <section className={cn(CARD, "p-4 sm:p-5")}>
            <BucketDetail b={openBucket} summary={summary} />
          </section>
        )}
      </div>

      <div className={cn("grid gap-4", summary.geAreas.length > 0 && summary.terms.length > 0 && "lg:grid-cols-2")}>
        {/* GE รายสาระ */}
        {summary.geAreas.length > 0 && (
          <section className={cn(CARD, "p-4 sm:p-5")}>
            <SectionTitle
              icon={Globe}
              title="ศึกษาทั่วไปรายสาระ"
              hint={`โครงสร้าง GE 2567: บังคับ GE1–GE7 รวม 18 นก. + วิชาเลือก GE8 ${summary.geAreas.find((a) => a.area === "GE8")?.need ?? 6} นก. · หนึ่งช่อง = 1 หน่วยกิต`}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {summary.geAreas.map(({ area, earned, need, counted, extraIn, short, sub }) => {
                const ok = short === 0;
                return (
                  <div key={area} className={cn("rounded-2xl border px-3 py-2.5", ok ? "border-gray-200 bg-white" : "border-amber-200 bg-amber-50/40")}>
                    <div className="flex items-center gap-1.5">
                      <GeIcon ge={area} className="h-4 w-4 text-gray-500" />
                      <span className="text-xs font-bold text-gray-900">{area}</span>
                      <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-gray-900 tabular-nums">
                        {counted}/{need}
                        {ok ? <CircleCheck className="h-3.5 w-3.5 text-emerald-600" aria-label="ครบ" /> : <Circle className="h-3.5 w-3.5 text-amber-500" aria-label="ยังไม่ครบ" />}
                      </span>
                    </div>
                    <p className="mt-0.5 mb-1.5 truncate text-[11px] text-gray-500">{GE_META[area].short}</p>
                    <CreditPips value={counted} need={need} color={BUCKET_META.ge.color} label={`${area} ${GE_META[area].name}`} />
                    {sub && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {sub.map((s) => (
                          <span
                            key={s.key}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                              s.earned >= s.need ? "bg-emerald-50 text-emerald-800" : "bg-amber-100/70 text-amber-900"
                            )}
                          >
                            {s.short} {Math.min(s.earned, s.need)}/{s.need}
                          </span>
                        ))}
                      </div>
                    )}
                    {earned > counted && area !== "GE8" && <p className="mt-1 text-[10px] text-gray-500">ลงเกิน {earned - counted} นก. → นับเป็นวิชาเลือก</p>}
                    {area === "GE8" && (
                      <p className="mt-1 text-[10px] leading-snug text-gray-500">
                        {extraIn > 0 ? `รวมส่วนเกินจากสาระอื่น ${extraIn} นก. · ` : ""}ต้องมีวิชาด้านภาษา ≥ 2 นก. ตามเกณฑ์สาขา
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* รายภาค */}
        {summary.terms.length > 0 && (
          <section className={cn(CARD, "p-4 sm:p-5")}>
            <SectionTitle
              icon={ChartColumn}
              title="หน่วยกิตรายภาคการศึกษา"
              hint={
                summary.pace
                  ? `เฉลี่ย ${summary.pace.perTerm.toFixed(1)} หน่วยกิตต่อภาคปกติ · ตัวเลขบนแท่ง = หน่วยกิตที่นับ`
                  : "ตัวเลขบนแท่ง = หน่วยกิตที่นับในภาคนั้น"
              }
            />
            <div className="mt-4">
              <TermChart terms={summary.terms} />
            </div>
          </section>
        )}
      </div>

      {/* วิชาในแผนที่ยังไม่ได้ลง */}
      {summary.missing.length > 0 && (
        <section className={CARD}>
          <button
            type="button"
            aria-expanded={showMissing}
            onClick={() => setShowMissing((v) => !v)}
            className="flex w-full items-center gap-3 rounded-3xl px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:px-5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Target className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-gray-900">วิชาในแผนการศึกษาที่ยังไม่ได้ลง</h3>
              <p className="text-xs text-gray-500">
                {summary.missing.length} วิชา · {summary.missingCredits} หน่วยกิต
                {summary.planIncomplete && " (รายชื่อในระบบยังไม่ครบ อาจมีวิชาบังคับอื่นอีก)"}
              </p>
            </div>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-gray-400 transition-transform", showMissing && "rotate-180")} aria-hidden />
          </button>
          {showMissing && (
            <div className="grid gap-4 border-t border-gray-100 px-4 py-4 sm:px-5 lg:grid-cols-2">
              {[
                { title: "วิชาเฉพาะ (พื้นฐาน / บังคับ)", list: requiredMissing, color: BUCKET_META.required.color },
                { title: "ศึกษาทั่วไปที่แผนระบุรหัส", list: geMissing, color: BUCKET_META.ge.color },
              ]
                .filter((g) => g.list.length)
                .map((g) => (
                  <div key={g.title}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                      <span className="h-2 w-2 rounded-full" style={{ background: g.color }} aria-hidden />
                      {g.title} · {g.list.length} วิชา
                    </p>
                    <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
                      {g.list.map((m) => (
                        <li key={m.code} className="flex items-start gap-3 px-3 py-2 text-sm">
                          <span className="mt-0.5 min-w-[4.5rem] shrink-0 font-mono text-xs font-semibold text-gray-900">{m.code}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-gray-800">{m.name}</p>
                            {m.note && <p className="mt-0.5 text-[11px] leading-snug text-amber-800">{m.note}</p>}
                          </div>
                          <span className="mt-0.5 shrink-0 text-[11px] text-gray-500 tabular-nums">
                            ปี {m.year}/{m.term}
                          </span>
                          <span className="mt-0.5 w-10 shrink-0 text-right text-xs font-semibold text-gray-900 tabular-nums">{m.credits} นก.</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* ไม่นับ */}
      {summary.skipped.length > 0 && (
        <section className={CARD}>
          <button
            type="button"
            aria-expanded={showSkipped}
            onClick={() => setShowSkipped((v) => !v)}
            className="flex w-full items-center gap-3 rounded-3xl px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:px-5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
              <Circle className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-gray-900">รายวิชาที่ไม่ได้นับหน่วยกิต</h3>
              <p className="text-xs text-gray-500">
                {summary.skipped.length} วิชา · {summary.skipped.reduce((a, c) => a + c.record.credits, 0)} หน่วยกิต (ติด F/E, ถอน, ลงซ้ำ, Audit หรือปิดการนับ)
              </p>
            </div>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-gray-400 transition-transform", showSkipped && "rotate-180")} aria-hidden />
          </button>
          {showSkipped && (
            <ul className="divide-y divide-gray-100 border-t border-gray-100 px-1 pb-1 sm:px-2">
              {summary.skipped.map((c) => (
                <li key={`${c.key}|${c.record.sec}`} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2 text-xs text-gray-600">
                  <span className="min-w-[4.75rem] font-mono font-semibold text-gray-800">{c.record.code}</span>
                  <span className="min-w-0 flex-1 basis-40 truncate">{c.record.name}</span>
                  <span className="text-[11px] text-gray-500">{c.record.term === UNKNOWN_TERM ? "ไม่ระบุภาค" : `ภาค ${c.record.term}`}</span>
                  {c.record.grade && <span className="rounded bg-gray-100 px-1.5 py-px font-mono text-[10px] font-semibold">{c.record.grade}</span>}
                  {c.skip && <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-medium text-gray-700">{SKIP_LABEL[c.skip]}</span>}
                  <span className="font-medium tabular-nums">{c.record.credits} นก.</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
