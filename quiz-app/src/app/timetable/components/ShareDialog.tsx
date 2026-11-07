"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bookmark, Check, Copy, Link2, Loader2, PencilLine, Radio, Share2, Trash2, Zap } from "lucide-react";
import { Dialog, dialogButton } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/checkbox";
import { useDialogs } from "@/components/ui/confirm";
import { timetableStore, useTimetableStore } from "@/hooks/use-timetable-store";
import { createShare, revokeShare, shareUrl, useMyShares } from "@/hooks/use-timetable-share";
import { encodePlan, type PlanItem } from "@/lib/timetable";
import { sameSource, type ShareSource } from "@/lib/timetable-share";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  termId: string;
  termLabel: string;
  items: PlanItem[];
  activeScheduleId: string | null;
  /** preselect a source (e.g. "แชร์" on a saved schedule) */
  initialSource?: ShareSource | null;
}

const fmt = (ts: number) =>
  ts ? new Date(ts).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

const keyOf = (s: ShareSource) => (s.kind === "schedule" ? `s:${s.scheduleId}` : `w:${s.termId}`);

export function ShareDialog(props: Props) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      size="lg"
      title="แชร์ตารางเรียน"
      description="ลิงก์สด — เพื่อนเห็นเวอร์ชันล่าสุดเสมอ ทุกครั้งที่คุณบันทึก ตารางในลิงก์จะอัปเดตตาม"
      icon={<Share2 className="h-5 w-5" />}
    >
      {props.open && <ShareBody {...props} />}
    </Dialog>
  );
}

function ShareBody({ termId, termLabel, items, activeScheduleId, initialSource }: Props) {
  const { store, user } = useTimetableStore();
  const shares = useMyShares(true);
  const { confirm } = useDialogs();

  const schedules = store.schedules
    .filter((s) => s.termId === termId || (initialSource?.kind === "schedule" && s.id === initialSource.scheduleId))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const sources: { source: ShareSource; title: string; sub: string; badge: string; icon: typeof Radio; live: boolean }[] = [
    {
      source: { kind: "working", termId },
      title: `ตารางที่กำลังจัด · ${termLabel}`,
      sub: `${items.length} รายการ · บันทึกอัตโนมัติทุกครั้งที่แก้ เพื่อนเห็นภายในไม่กี่วินาที`,
      badge: "อัปเดตทันที",
      icon: Radio,
      live: true,
    },
    ...schedules.map((s) => ({
      source: { kind: "schedule", scheduleId: s.id } as ShareSource,
      title: `“${s.name}”`,
      sub: `ตารางที่บันทึก · ${s.courseCount ?? s.items.length} วิชา · บันทึกล่าสุด ${fmt(s.updatedAt)}`,
      badge: "อัปเดตเมื่อกดบันทึก",
      icon: Bookmark,
      live: false,
    })),
  ];

  const defaultSource: ShareSource =
    initialSource ?? (activeScheduleId && schedules.some((s) => s.id === activeScheduleId) ? { kind: "schedule", scheduleId: activeScheduleId } : { kind: "working", termId });
  const [selected, setSelected] = useState<string>(keyOf(defaultSource));
  const [includeCustom, setIncludeCustom] = useState(false);
  const [showName, setShowName] = useState(true);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const current = sources.find((s) => keyOf(s.source) === selected) ?? sources[0];
  const existing = shares?.find((s) => sameSource(s.source, current.source));
  const hasCustom = items.some((i) => i.kind === "custom");

  const copy = async (url: string, key: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
      toast.success("คัดลอกลิงก์แล้ว");
    } catch {
      toast.error("คัดลอกไม่ได้ — กดค้างที่ลิงก์เพื่อคัดลอกเอง");
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      await timetableStore.flush();
      const src = current.source;
      const id = await createShare(src, { includeCustom, showName });
      const url = shareUrl(id, src.kind === "working" ? src.termId : store.schedules.find((s) => s.id === src.scheduleId)?.termId);
      setLink(url);
      await copy(url, "new");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "สร้างลิงก์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const nativeShare = async (url: string) => {
    try {
      await navigator.share({ title: "ตารางเรียนของฉัน", text: `ตารางเรียน ${termLabel}`, url });
    } catch {
      /* cancelled */
    }
  };

  const revoke = async (id: string, name: string) => {
    const ok = await confirm({
      title: `ยกเลิกลิงก์ของ “${name}”?`,
      description: "คนที่มีลิงก์นี้จะเปิดไม่ได้อีก — ตารางของคุณไม่ถูกลบ",
      confirmText: "ยกเลิกลิงก์",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await revokeShare(id);
      if (link?.includes(id)) setLink(null);
      toast.success("ยกเลิกลิงก์แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ");
    }
  };

  const snapshot = async () => {
    const url = new URL("/timetable", window.location.origin);
    url.searchParams.set("term", termId);
    url.searchParams.set("p", encodePlan(items));
    await copy(url.toString(), "snap");
  };

  const canShareNative = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="space-y-4">
      {/* source */}
      <div className="space-y-2" role="radiogroup" aria-label="ตารางที่จะแชร์">
        {sources.map((s) => {
          const k = keyOf(s.source);
          const active = k === selected;
          const shared = shares?.some((x) => sameSource(x.source, s.source));
          const Icon = s.icon;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setSelected(k);
                setLink(null);
              }}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
                active ? "border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-300" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  s.live ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white" : "bg-amber-100 text-amber-700"
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-gray-900">{s.title}</span>
                  <span
                    className={cn(
                      "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      s.live ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {s.live ? <Zap className="h-3 w-3" /> : <PencilLine className="h-3 w-3" />} {s.badge}
                  </span>
                  {shared && <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">แชร์อยู่</span>}
                </span>
                <span className="mt-0.5 block text-[11px] text-gray-500">{s.sub}</span>
              </span>
              <span
                className={cn(
                  "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  active ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300"
                )}
              >
                {active && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-100 px-3 py-1">
        <Switch
          checked={showName}
          onChange={setShowName}
          label="แสดงชื่อของฉันบนลิงก์"
          description={user?.name ? `ผู้เปิดลิงก์จะเห็นว่าแชร์โดย “${user.name}”` : undefined}
        />
        <Switch
          checked={includeCustom}
          onChange={setIncludeCustom}
          label="รวมกิจกรรมที่เพิ่มเอง"
          description={hasCustom ? "เช่น ชมรม งานพิเศษ — ปิดไว้ถ้าเป็นเรื่องส่วนตัว" : "ตารางนี้ยังไม่มีกิจกรรมที่เพิ่มเอง"}
        />
      </div>

      {link ? (
        <div className="tt-pop space-y-2 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <span className="tt-live relative h-2 w-2 rounded-full bg-emerald-500" /> ลิงก์สดพร้อมแชร์ — อัปเดตตามที่คุณบันทึก
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-3 font-mono text-xs text-gray-700 outline-none"
              aria-label="ลิงก์แชร์"
            />
            <button type="button" onClick={() => copy(link, "new")} className={cn(dialogButton.primary, "h-10 sm:h-10")}>
              {copied === "new" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} คัดลอก
            </button>
          </div>
          {canShareNative && (
            <button type="button" onClick={() => nativeShare(link)} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
              <Share2 className="h-3.5 w-3.5" /> แชร์ผ่านแอปอื่น
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={create} disabled={busy || !user} className={cn(dialogButton.primary, "w-full")}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {existing ? "คัดลอกลิงก์สด (อัปเดตการตั้งค่า)" : "สร้างลิงก์สดและคัดลอก"}
        </button>
      )}

      {/* existing links */}
      <div className="space-y-2 border-t border-gray-100 pt-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          ลิงก์ที่แชร์อยู่
          {shares && <span className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-600">{shares.length}</span>}
          {!shares && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
        </p>
        {shares && shares.length === 0 && <p className="text-xs text-gray-400">ยังไม่มีลิงก์ — สร้างลิงก์ด้านบนเพื่อแชร์ให้เพื่อน</p>}
        <ul className="space-y-1.5">
          {shares?.map((s) => {
            const url = shareUrl(s.id, s.termId || undefined);
            return (
              <li key={s.id} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", s.missing ? "border-red-200 bg-red-50/60" : "border-gray-100 bg-white")}>
                {s.source.kind === "working" ? <Radio className="h-4 w-4 shrink-0 text-emerald-600" /> : <Bookmark className="h-4 w-4 shrink-0 text-amber-600" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-900">{s.name}</p>
                  <p className={cn("truncate text-[10.5px]", s.missing ? "text-red-600" : "text-gray-500")}>
                    {s.missing
                      ? "ต้นฉบับถูกลบ — ลิงก์นี้เปิดไม่ได้แล้ว"
                      : `ภาค ${s.termLabel} · เวอร์ชันล่าสุด ${fmt(s.updatedAt)}${s.includeCustom ? " · รวมกิจกรรม" : ""}`}
                  </p>
                </div>
                {!s.missing && (
                  <button
                    type="button"
                    onClick={() => copy(url, s.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    aria-label={`คัดลอกลิงก์ ${s.name}`}
                    title="คัดลอกลิงก์"
                  >
                    {copied === s.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => revoke(s.id, s.name)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`ยกเลิกลิงก์ ${s.name}`}
                  title="ยกเลิกลิงก์"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        onClick={snapshot}
        disabled={!items.some((i) => i.kind === "course")}
        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 disabled:opacity-40"
      >
        {copied === "snap" ? <Check className="h-3 w-3 text-emerald-600" /> : <Link2 className="h-3 w-3" />}
        หรือคัดลอกลิงก์แบบภาพนิ่ง (ไม่อัปเดตตาม เปิดแล้วนำเข้าเป็นตารางของผู้รับ)
      </button>
    </div>
  );
}
