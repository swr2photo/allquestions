"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, FileUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";
import {
  UNKNOWN_TERM,
  extractPdfLines,
  mergeRegistrationRecords,
  parseRegistrationLines,
  parseRegistrationText,
  type RegistrationRecord,
} from "@/lib/registration";

interface Props {
  records: RegistrationRecord[];
  onChange: (records: RegistrationRecord[]) => void;
}

const FIELD =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
const SECONDARY =
  "flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

export function ImportPanel({ records, onChange }: Props) {
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ code: "", name: "", credits: "3", term: "" });

  const termCount = new Set(records.map((r) => r.term)).size;

  const addRecords = (incoming: RegistrationRecord[], source: string) => {
    const merged = mergeRegistrationRecords(records, incoming);
    const added = merged.length - records.length;
    onChange(merged);
    toast.success(`อ่านได้ ${incoming.length} รายการจาก${source}${added < incoming.length ? ` (ใหม่ ${added} รายการ)` : ""}`, { duration: 2500 });
  };

  const handleFiles = async (files: FileList | File[] | null | undefined) => {
    const list = [...(files ?? [])].filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (!list.length) {
      if (files?.length) toast.error("รองรับเฉพาะไฟล์ PDF ผลการลงทะเบียนจาก SIS");
      return;
    }
    setBusy(true);
    try {
      const parsed: RegistrationRecord[] = [];
      const failed: string[] = [];
      for (const file of list) {
        try {
          const found = parseRegistrationLines(await extractPdfLines(file));
          if (found.length) parsed.push(...found);
          else failed.push(file.name);
        } catch {
          failed.push(file.name);
        }
      }
      if (parsed.length) addRecords(parsed, `ไฟล์ PDF ${list.length - failed.length} ไฟล์`);
      if (failed.length) toast.error(`ไม่พบรายวิชาใน ${failed.join(", ")} — ต้องเป็นไฟล์ "ผลการลงทะเบียน" จาก SIS`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submitPaste = () => {
    const parsed = parseRegistrationText(pasteText);
    if (!parsed.length) {
      toast.error("ไม่พบรายวิชาในข้อความ — แต่ละบรรทัดต้องมี รหัสวิชา ชื่อวิชา และหน่วยกิต");
      return;
    }
    addRecords(parsed, "ข้อความที่วาง");
    setPasteText("");
    setPasteOpen(false);
  };

  const submitManual = () => {
    const code = manual.code.trim().toUpperCase();
    const credits = Number(manual.credits);
    const term = manual.term.trim();
    if (!/^[A-Z0-9]{3}-\d{3}[A-Z0-9]*$/.test(code)) return toast.error("รหัสวิชาต้องอยู่ในรูป 322-101");
    if (!(credits > 0 && credits <= 15)) return toast.error("หน่วยกิตไม่ถูกต้อง");
    if (term && !/^\d\/25\d{2}$/.test(term)) return toast.error("ภาคการศึกษาต้องอยู่ในรูป 1/2568");
    addRecords([{ term: term || UNKNOWN_TERM, code, name: manual.name.trim() || code, sec: "", type: "C", credits }], "รายการที่เพิ่มเอง");
    setManual((m) => ({ ...m, code: "", name: "" }));
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-60",
          dragging ? "border-emerald-500 bg-emerald-50" : "border-gray-300 bg-gray-50/60 hover:border-emerald-400 hover:bg-emerald-50/50"
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
        </span>
        <span className="text-sm font-semibold text-gray-900">{busy ? "กำลังอ่านไฟล์…" : "เลือกหรือลากไฟล์ PDF ผลการลงทะเบียนมาวาง"}</span>
        <span className="text-xs text-gray-500">เลือกได้หลายไฟล์พร้อมกัน (ภาคละไฟล์) · ไฟล์อ่านในเบราว์เซอร์ ไม่ถูกอัปโหลด</span>
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setPasteOpen(true)} className={SECONDARY}>
          <ClipboardPaste className="h-4 w-4" /> วางข้อความจาก SIS
        </button>
        <button type="button" onClick={() => setManualOpen(true)} className={SECONDARY}>
          <Plus className="h-4 w-4" /> เพิ่มวิชาเอง
        </button>
        {records.length > 0 && (
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: "ลบประวัติการลงทะเบียนทั้งหมด?",
                description: "รายวิชาที่นำเข้าจะถูกลบออกจากเครื่องนี้ รวมถึงที่ใช้ในหน้าจัดตารางเรียน",
                confirmText: "ลบประวัติ",
                tone: "danger",
              });
              if (ok) onChange([]);
            }}
            className={cn(SECONDARY, "ml-auto text-red-700 hover:bg-red-50")}
          >
            <Trash2 className="h-4 w-4" /> ล้างข้อมูล
          </button>
        )}
      </div>

      <p className="text-xs text-gray-600" aria-live="polite">
        {records.length ? `นำเข้าแล้ว ${records.length} รายการ จาก ${termCount} ภาคการศึกษา` : "ยังไม่มีรายวิชา — นำเข้าใบลงทะเบียนของทุกภาคที่เรียนมาแล้ว"}
      </p>

      <Dialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        size="lg"
        persistent
        title="วางข้อความจาก SIS"
        description="คัดลอกตารางรายวิชาจากหน้าผลการลงทะเบียนแล้ววางที่นี่ ใส่บรรทัด “ภาคการศึกษา 1/2568” คั่นแต่ละภาคได้"
        icon={<ClipboardPaste className="h-5 w-5" />}
        iconClassName="bg-sky-100 text-sky-700"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPasteOpen(false)} className={SECONDARY}>
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submitPaste}
              disabled={!pasteText.trim()}
              className="flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              นำเข้ารายวิชา
            </button>
          </div>
        }
      >
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={10}
          spellCheck={false}
          aria-label="ข้อความผลการลงทะเบียน"
          placeholder={"ภาคการศึกษา 1/2568\n322-101 CALCULUS I 01 C 3\n324-101 GENERAL CHEMISTRY I 02 C 3\n…"}
          className="w-full rounded-xl border border-gray-200 bg-white p-3 font-mono text-xs leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </Dialog>

      <Dialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="เพิ่มวิชาเอง"
        description="สำหรับวิชาที่ไม่มีในใบลงทะเบียน เช่น วิชาเทียบโอน"
        icon={<Plus className="h-5 w-5" />}
        iconClassName="bg-emerald-100 text-emerald-700"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setManualOpen(false)} className={SECONDARY}>
              ปิด
            </button>
            <button
              type="button"
              onClick={submitManual}
              className="flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              เพิ่มวิชา
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-1 space-y-1">
            <span className="text-xs font-medium text-gray-700">รหัสวิชา</span>
            <input className={cn(FIELD, "font-mono")} placeholder="322-101" value={manual.code} onChange={(e) => setManual({ ...manual, code: e.target.value })} />
          </label>
          <label className="col-span-1 space-y-1">
            <span className="text-xs font-medium text-gray-700">หน่วยกิต</span>
            <input className={FIELD} inputMode="numeric" value={manual.credits} onChange={(e) => setManual({ ...manual, credits: e.target.value })} />
          </label>
          <label className="col-span-2 space-y-1">
            <span className="text-xs font-medium text-gray-700">ชื่อวิชา</span>
            <input className={FIELD} placeholder="CALCULUS I" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
          </label>
          <label className="col-span-2 space-y-1">
            <span className="text-xs font-medium text-gray-700">ภาคการศึกษา (ไม่บังคับ)</span>
            <input className={FIELD} placeholder="1/2568" value={manual.term} onChange={(e) => setManual({ ...manual, term: e.target.value })} />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
