"use client";

import { AlertTriangle, BookmarkPlus, CopyPlus, Link2, Loader2, RefreshCw, X } from "lucide-react";
import type { SharedState } from "@/hooks/use-timetable-share";
import { cn } from "@/lib/utils";

const fmt = (ts: number) =>
  ts ? new Date(ts).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

/** Shown above the plan while viewing someone's live share link. */
export function SharedBanner({
  state,
  onFork,
  onSave,
  onRefresh,
  onExit,
}: {
  state: SharedState;
  onFork: () => void;
  onSave: () => void;
  onRefresh: () => void;
  onExit: () => void;
}) {
  const { status, share, error, changedAt } = state;
  const gone = status === "gone";
  const failed = status === "error";
  return (
    <div
      key={changedAt ?? 0}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-3 shadow-sm sm:p-4 print:hidden",
        gone || failed ? "border-red-200 bg-red-50" : "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50",
        changedAt && "tt-flash"
      )}
      role="status"
    >
      <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-sky-200/30" />
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
            gone || failed ? "bg-red-500" : "bg-gradient-to-br from-sky-500 to-indigo-500"
          )}
        >
          {status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : gone || failed ? <AlertTriangle className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          {status === "loading" && !share ? (
            <p className="pt-2 text-sm font-semibold text-gray-700">กำลังเปิดตารางที่แชร์…</p>
          ) : (
            <>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-gray-900">
                {share ? (
                  share.isOwner ? (
                    "ลิงก์แชร์ของคุณ (มุมมองผู้รับ)"
                  ) : (
                    <>ตารางที่แชร์โดย {share.ownerName || "เพื่อน"}</>
                  )
                ) : (
                  "เปิดตารางที่แชร์ไม่ได้"
                )}
                {status === "live" && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <span className="tt-live relative h-1.5 w-1.5 rounded-full bg-emerald-500" /> ติดตามสด
                  </span>
                )}
              </p>
              {share && (
                <p className="mt-0.5 truncate text-xs text-gray-600">
                  “{share.name}” · ภาค {share.termLabel} · บันทึกล่าสุด {fmt(share.updatedAt)}
                </p>
              )}
              <p className={cn("mt-0.5 text-[11px]", gone || failed ? "font-medium text-red-700" : "text-gray-500")}>
                {gone
                  ? `${error ?? "ลิงก์นี้ใช้ไม่ได้แล้ว"}${share ? " — ยังคัดลอกเวอร์ชันล่าสุดเก็บไว้ได้" : ""}`
                  : failed
                    ? error ?? "โหลดไม่สำเร็จ"
                    : "อ่านอย่างเดียว · ต้นฉบับบันทึกเมื่อไร ตารางนี้อัปเดตตามอัตโนมัติ"}
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-gray-700"
          aria-label="ออกจากมุมมองตารางที่แชร์"
          title="กลับไปตารางของฉัน"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {share && (
        <div className="relative mt-3 flex flex-wrap gap-2 pl-0 sm:pl-[52px]">
          <button
            type="button"
            onClick={onFork}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98]"
          >
            <CopyPlus className="h-4 w-4" /> คัดลอกมาแก้ไข
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.98]"
          >
            <BookmarkPlus className="h-4 w-4" /> บันทึกเป็นตารางของฉัน
          </button>
          {!gone && (
            <button
              type="button"
              onClick={onRefresh}
              className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-gray-500 hover:bg-white hover:text-gray-800"
            >
              <RefreshCw className="h-3.5 w-3.5" /> รีเฟรช
            </button>
          )}
        </div>
      )}
    </div>
  );
}
