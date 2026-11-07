"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Dices, Download, FileImage, ImageDown, LayoutTemplate, Loader2, Paintbrush, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, dialogButton } from "@/components/ui/dialog";
import { Segmented, Switch } from "@/components/ui/checkbox";
import type { PlannedEntry } from "@/lib/timetable";
import {
  DEFAULT_EXPORT,
  EXPORT_BLOCK_STYLES,
  EXPORT_LAYOUTS,
  EXPORT_PATTERNS,
  EXPORT_THEMES,
  canvasToBlob,
  exportFontFamily,
  normalizeExportOptions,
  printCanvasAsPdf,
  renderPatternSwatch,
  renderTimetable,
  type ExportBlockStyle,
  type ExportLayoutId,
  type ExportOptions,
  type ExportPatternId,
  type ExportThemeId,
} from "@/lib/timetable-export";
import { cn } from "@/lib/utils";

const PREF_KEY = "psu-timetable:export:v1";

function loadPrefs(): ExportOptions {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return normalizeExportOptions(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return DEFAULT_EXPORT;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entries: PlannedEntry[];
  termId: string;
  termLabel: string;
  totalCredits: number;
  isGe: (e: PlannedEntry) => boolean;
}

type Tab = "design" | "content" | "file";

export function ExportDialog(props: Props) {
  // mount the heavy body only while open (fresh prefs + canvas each time)
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      size="full"
      title="ส่งออกรูปตารางเรียน"
      description="เลือกธีม ลวดลาย สไตล์กล่อง และข้อมูลที่จะแสดง แล้วบันทึกเป็นรูป หรือ PDF"
      icon={<ImageDown className="h-5 w-5" />}
      bodyClassName="px-0 pb-0"
    >
      {props.open && <ExportBody {...props} />}
    </Dialog>
  );
}

function ExportBody({ entries, termId, termLabel, totalCredits, isGe, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opt, setOpt] = useState<ExportOptions>(loadPrefs);
  const [family, setFamily] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "download" | "share" | "copy">(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("design");

  const set = (p: Partial<ExportOptions>) =>
    setOpt((o) => {
      const next = { ...o, ...p };
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  const shuffle = () => {
    const pick = <T,>(xs: readonly T[], not?: T) => {
      const pool = xs.filter((x) => x !== not);
      return pool[Math.floor(Math.random() * pool.length)];
    };
    set({
      theme: pick(EXPORT_THEMES.map((t) => t.id), opt.theme),
      pattern: pick(EXPORT_PATTERNS.map((p) => p.id).filter((id) => id !== "none"), opt.pattern),
      blockStyle: pick(EXPORT_BLOCK_STYLES.map((b) => b.id)),
    });
  };

  useEffect(() => {
    let cancelled = false;
    exportFontFamily().then((f) => !cancelled && setFamily(f));
    return () => {
      cancelled = true;
    };
  }, []);

  // live preview (rendered at 1× for speed)
  useEffect(() => {
    if (!family || !canvasRef.current) return;
    renderTimetable(
      canvasRef.current,
      {
        entries,
        termLabel,
        totalCredits,
        isGe,
        fontFamily: family,
        generatedAt: new Date().toLocaleDateString("th-TH", { dateStyle: "medium" }),
      },
      { ...opt, scale: 1 }
    );
  }, [family, opt, entries, termLabel, totalCredits, isGe]);

  const renderFull = () => {
    const c = document.createElement("canvas");
    renderTimetable(
      c,
      {
        entries,
        termLabel,
        totalCredits,
        isGe,
        fontFamily: family ?? "system-ui, sans-serif",
        generatedAt: new Date().toLocaleDateString("th-TH", { dateStyle: "medium" }),
      },
      opt
    );
    return c;
  };

  const fileName = `ตารางเรียน-${termId}-${opt.theme}-${opt.pattern}.${opt.format === "jpeg" ? "jpg" : "png"}`;

  const download = async () => {
    setBusy("download");
    try {
      const canvas = renderFull();
      if (opt.format === "pdf") {
        printCanvasAsPdf(canvas, !EXPORT_LAYOUTS[opt.layout].vertical, opt.title);
        toast.info("เลือก “บันทึกเป็น PDF” ในหน้าต่างพิมพ์", { duration: 3000 });
        return;
      }
      const blob = await canvasToBlob(canvas, opt.format);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast.success("บันทึกรูปตารางเรียนแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งออกไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const canShare = typeof navigator !== "undefined" && "canShare" in navigator;
  const share = async () => {
    setBusy("share");
    try {
      const blob = await canvasToBlob(renderFull(), opt.format === "jpeg" ? "jpeg" : "png");
      const file = new File([blob], fileName.replace(/\.jpg$|\.png$/, opt.format === "jpeg" ? ".jpg" : ".png"), { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: opt.title, text: `ตารางเรียน ${termLabel}` });
      } else {
        toast.info("อุปกรณ์นี้แชร์ไฟล์ไม่ได้ — ใช้ปุ่มบันทึกรูปแทน");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) toast.error("แชร์ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    setBusy("copy");
    try {
      const blob = await canvasToBlob(renderFull(), "png");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("คัดลอกรูปแล้ว วางในแชตได้เลย");
    } catch {
      toast.error("เบราว์เซอร์นี้คัดลอกรูปไม่ได้ — ใช้ปุ่มบันทึกรูปแทน");
    } finally {
      setBusy(null);
    }
  };

  const layout = EXPORT_LAYOUTS[opt.layout];

  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* preview */}
      <div className="flex items-start justify-center bg-[radial-gradient(circle_at_1px_1px,#d1d5db_1px,transparent_0)] [background-size:16px_16px] bg-gray-100/80 p-3 sm:p-5">
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-xl shadow-xl ring-1 ring-black/5 lg:sticky lg:top-5",
            layout.vertical && "max-w-[300px] sm:max-w-[340px]"
          )}
          style={{ aspectRatio: `${layout.w} / ${layout.h}` }}
        >
          {!family && (
            <div className="absolute inset-0 flex items-center justify-center bg-white text-xs text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังเตรียมฟอนต์…
            </div>
          )}
          <canvas ref={canvasRef} className="block h-full w-full" aria-label="ตัวอย่างรูปตารางเรียน" />
        </div>
      </div>

      {/* options */}
      <div className="flex min-w-0 flex-col border-t border-gray-100 lg:border-t-0 lg:border-l">
        <div className="flex items-center gap-2 px-5 pt-4">
          <Segmented
            aria-label="หมวดการตั้งค่า"
            size="sm"
            className="flex flex-1"
            value={tab}
            onChange={setTab}
            options={[
              { value: "design", label: "ดีไซน์", icon: <Paintbrush className="h-3.5 w-3.5" /> },
              { value: "content", label: "เนื้อหา", icon: <LayoutTemplate className="h-3.5 w-3.5" /> },
              { value: "file", label: "ไฟล์", icon: <FileImage className="h-3.5 w-3.5" /> },
            ]}
          />
          <button
            type="button"
            onClick={shuffle}
            className="flex h-8 shrink-0 items-center gap-1 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-95"
            title="สุ่มธีม ลวดลาย และสไตล์กล่อง"
          >
            <Dices className="h-3.5 w-3.5" /> สุ่ม
          </button>
        </div>

        <div className="flex-1 space-y-5 p-5">
          {tab === "design" && (
            <>
              <section>
                <p className="mb-2 text-xs font-semibold text-gray-700">ธีมสี</p>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="ธีม">
                  {EXPORT_THEMES.map((t) => {
                    const bg = Array.isArray(t.bg) ? `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})` : t.bg;
                    const active = opt.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => set({ theme: t.id })}
                        className={cn(
                          "group rounded-xl p-1 text-left ring-2 transition",
                          active ? "ring-emerald-500" : "ring-transparent hover:ring-gray-200"
                        )}
                      >
                        <span className="relative block h-12 overflow-hidden rounded-lg ring-1 ring-black/5" style={{ background: bg }}>
                          <span className="absolute inset-x-2 top-2 bottom-0 rounded-t-md shadow-sm" style={{ background: t.surface }}>
                            <span className="mt-2 ml-1.5 flex gap-1">
                              {t.blocks.slice(0, 3).map((b, i) => (
                                <span key={i} className="h-3 w-4 rounded-sm" style={{ background: b.bg, borderLeft: `2px solid ${b.border}` }} />
                              ))}
                            </span>
                          </span>
                          {active && (
                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block truncate text-center text-[11px] font-medium text-gray-700">{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-700">ลวดลายพื้นหลัง</p>
                  <Segmented
                    aria-label="ความเข้มของลวดลาย"
                    size="sm"
                    value={String(opt.patternStrength) as "1" | "2" | "3"}
                    onChange={(v) => set({ patternStrength: Number(v) as 1 | 2 | 3 })}
                    options={[
                      { value: "1", label: "จาง" },
                      { value: "2", label: "กลาง" },
                      { value: "3", label: "เข้ม" },
                    ]}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="ลวดลาย">
                  {EXPORT_PATTERNS.map((p) => (
                    <PatternSwatch
                      key={p.id}
                      id={p.id}
                      name={p.name}
                      theme={opt.theme}
                      strength={opt.patternStrength}
                      active={opt.pattern === p.id}
                      onSelect={() => set({ pattern: p.id })}
                    />
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold text-gray-700">สไตล์กล่องวิชา</p>
                <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="สไตล์กล่องวิชา">
                  {EXPORT_BLOCK_STYLES.map((b) => (
                    <BlockStyleOption key={b.id} id={b.id} name={b.name} active={opt.blockStyle === b.id} onSelect={() => set({ blockStyle: b.id })} />
                  ))}
                </div>
              </section>

              <div className="rounded-xl border border-gray-100 px-3 py-1.5">
                <Switch
                  checked={opt.dayColors}
                  onChange={(v) => set({ dayColors: v })}
                  label="สีประจำวัน"
                  description="จันทร์เหลือง อังคารชมพู พุธเขียว … แต่งช่องวันและกราฟ"
                />
              </div>
            </>
          )}

          {tab === "content" && (
            <>
              <label className="block text-xs font-semibold text-gray-700">
                หัวข้อบนรูป
                <input
                  value={opt.title}
                  maxLength={60}
                  onChange={(e) => set({ title: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>

              <div>
                <p className="mb-2 text-xs font-semibold text-gray-700">ขนาดรูป</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(EXPORT_LAYOUTS) as ExportLayoutId[]).map((id) => {
                    const l = EXPORT_LAYOUTS[id];
                    const active = opt.layout === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => set({ layout: id })}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition",
                          active ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-gray-200 text-gray-700 hover:border-gray-300"
                        )}
                      >
                        <span
                          className={cn("shrink-0 rounded-[3px] border-2", active ? "border-emerald-600" : "border-gray-400")}
                          style={{ width: l.w > l.h ? 20 : l.w === l.h ? 16 : 11, height: l.w > l.h ? 13 : l.w === l.h ? 16 : 19 }}
                        />
                        <span className="font-medium">{l.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1 rounded-xl border border-gray-100 px-3 py-1.5">
                <p className="pt-1 text-[11px] font-semibold tracking-wide text-gray-400">ในกล่องวิชา</p>
                <Switch checked={opt.showTime} onChange={(v) => set({ showTime: v })} label="เวลาเรียน + จำนวนชั่วโมง" />
                <Switch checked={opt.showRoom} onChange={(v) => set({ showRoom: v })} label="ห้องเรียน" />
                <Switch checked={opt.showSec} onChange={(v) => set({ showSec: v })} label="Section" />
                <Switch checked={opt.showInstructor} onChange={(v) => set({ showInstructor: v })} label="ชื่อผู้สอน" />
              </div>
              <div className="space-y-1 rounded-xl border border-gray-100 px-3 py-1.5">
                <p className="pt-1 text-[11px] font-semibold tracking-wide text-gray-400">ส่วนสรุป</p>
                <Switch checked={opt.showSummary} onChange={(v) => set({ showSummary: v })} label="สรุปรายวิชา + กราฟหน่วยกิต" />
                <Switch checked={opt.showExams} onChange={(v) => set({ showExams: v })} label="วันสอบกลางภาค / ปลายภาค" disabled={!opt.showSummary} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">วันเสาร์–อาทิตย์</p>
                <Segmented
                  aria-label="วันเสาร์อาทิตย์"
                  size="sm"
                  className="flex w-full"
                  value={opt.weekend}
                  onChange={(v) => set({ weekend: v })}
                  options={[
                    { value: "auto", label: "อัตโนมัติ" },
                    { value: "show", label: "แสดง" },
                    { value: "hide", label: "ซ่อน" },
                  ]}
                />
              </div>
            </>
          )}

          {tab === "file" && (
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">ชนิดไฟล์</p>
                <Segmented
                  aria-label="รูปแบบไฟล์"
                  size="sm"
                  className="flex w-full"
                  value={opt.format}
                  onChange={(v) => set({ format: v })}
                  options={[
                    { value: "png", label: "PNG" },
                    { value: "jpeg", label: "JPG" },
                    { value: "pdf", label: "PDF" },
                  ]}
                />
                <p className="text-[11px] text-gray-500">
                  {opt.format === "png" ? "คมชัดที่สุด เหมาะกับแชร์ในแชต" : opt.format === "jpeg" ? "ไฟล์เล็กกว่า เหมาะกับโซเชียล" : "เปิดหน้าต่างพิมพ์ แล้วเลือกบันทึกเป็น PDF"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">ความคมชัด</p>
                <Segmented
                  aria-label="ความคมชัด"
                  size="sm"
                  className="flex w-full"
                  value={String(opt.scale) as "1" | "2" | "3"}
                  onChange={(v) => set({ scale: Number(v) as 1 | 2 | 3 })}
                  options={[
                    { value: "1", label: "1× ปกติ" },
                    { value: "2", label: "2× คม" },
                    { value: "3", label: "3× พิมพ์" },
                  ]}
                />
                <p className="text-[11px] text-gray-400">
                  ขนาดไฟล์ {layout.w * opt.scale} × {layout.h * opt.scale} px
                </p>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-gray-100 bg-white/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <button type="button" onClick={download} disabled={!family || !!busy} className={dialogButton.primary}>
            {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {opt.format === "pdf" ? "บันทึกเป็น PDF" : `บันทึกรูป ${opt.format === "jpeg" ? "JPG" : "PNG"}`}
          </button>
          <div className="grid grid-cols-2 gap-2">
            {canShare && (
              <button type="button" onClick={share} disabled={!family || !!busy} className={dialogButton.secondary}>
                {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} แชร์
              </button>
            )}
            <button type="button" onClick={copy} disabled={!family || !!busy} className={cn(dialogButton.secondary, !canShare && "col-span-2")}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} คัดลอกรูป
            </button>
          </div>
          <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-800 sm:hidden">
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

function PatternSwatch({
  id,
  name,
  theme,
  strength,
  active,
  onSelect,
}: {
  id: ExportPatternId;
  name: string;
  theme: ExportThemeId;
  strength: 1 | 2 | 3;
  active: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderPatternSwatch(ref.current, theme, id, strength);
  }, [theme, id, strength]);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn("rounded-xl p-0.5 ring-2 transition", active ? "ring-emerald-500" : "ring-transparent hover:ring-gray-200")}
    >
      <span className="relative block overflow-hidden rounded-lg ring-1 ring-black/5">
        <canvas ref={ref} className="block h-11 w-full" aria-hidden />
        {active && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="mt-1 block truncate text-center text-[10.5px] font-medium text-gray-700">{name}</span>
    </button>
  );
}

function BlockStyleOption({ id, name, active, onSelect }: { id: ExportBlockStyle; name: string; active: boolean; onSelect: () => void }) {
  const sample = (bg: string, border: string) => {
    if (id === "solid") return { background: `linear-gradient(140deg, ${border}, color-mix(in oklab, ${border} 70%, black))` };
    if (id === "outline") return { background: "#fff", border: `2px solid ${border}` };
    if (id === "sticker") return { background: bg, border: "2px solid #111827", boxShadow: "2px 2px 0 #111827" };
    return { background: bg, borderLeft: `3px solid ${border}` };
  };
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2 text-[11px] font-medium transition",
        active ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-gray-200 text-gray-700 hover:border-gray-300"
      )}
    >
      <span className="flex gap-1">
        <span className="h-6 w-5 rounded-md" style={sample("#e0f2fe", "#0284c7")} />
        <span className="h-6 w-5 rounded-md" style={sample("#fce7f3", "#db2777")} />
      </span>
      {name}
    </button>
  );
}
