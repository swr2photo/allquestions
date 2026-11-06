"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, FileUp, Loader2, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm";
import { Checkbox, Switch } from "@/components/ui/checkbox";
import {
  extractPdfLines,
  mergeRegistrationRecords,
  parseRegistrationLines,
  type RegistrationHistory,
} from "@/lib/registration";

interface Props {
  open: boolean;
  onClose: () => void;
  history: RegistrationHistory;
  onChange: (next: RegistrationHistory) => void;
  /** signed-in users may back the history up to their account (opt-in) */
  canSync?: boolean;
  syncEnabled?: boolean;
  onSyncChange?: (on: boolean) => void;
}

export function RegistrationDialog({ open, onClose, history, onChange, canSync, syncEnabled, onSyncChange }: Props) {
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const termCount = new Set(history.records.map((r) => r.term)).size;
  const termsByCode = new Map<string, string[]>();
  for (const record of history.records) {
    const terms = termsByCode.get(record.code) ?? [];
    if (!terms.includes(record.term)) terms.push(record.term);
    termsByCode.set(record.code, terms);
  }
  const nameByCode = new Map(history.records.map((r) => [r.code, r.name]));
  const repeated = [...termsByCode.entries()]
    .filter(([code, terms]) => terms.length > 1 || history.regradeCodes.includes(code))
    .sort(([a], [b]) => a.localeCompare(b));

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = parseRegistrationLines(await extractPdfLines(file));
      if (!parsed.length) {
        toast.error("ไม่พบรายวิชาในไฟล์นี้ (ต้องเป็นไฟล์ผลการลงทะเบียนจาก SIS)");
        return;
      }
      onChange({ ...history, records: mergeRegistrationRecords(history.records, parsed) });
      toast.success(`นำเข้า ${parsed.length} รายการจากไฟล์`, { duration: 2000 });
    } catch {
      toast.error("อ่านไฟล์ PDF ไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleRegrade = (code: string) => {
    const exempt = history.regradeCodes.includes(code)
      ? history.regradeCodes.filter((c) => c !== code)
      : [...history.regradeCodes, code];
    onChange({ ...history, regradeCodes: exempt });
  };

  return (
    <Dialog open={open} onClose={onClose} size="lg" title="ประวัติการลงทะเบียน (PDF)" icon={<FileText className="h-5 w-5" />} iconClassName="bg-sky-100 text-sky-700">
      <div className="space-y-4 text-sm">
        <p className="text-xs text-gray-500">
          นำเข้าไฟล์ &quot;ผลการลงทะเบียน&quot; จาก SIS เพื่อเตือนเมื่อเลือกวิชาที่เคยลงทะเบียนแล้ว และนับหน่วยกิตหมวด GE ที่เรียนไปแล้ว
          ไฟล์ PDF อ่านในเบราว์เซอร์ ไม่ถูกอัปโหลด — ข้อมูลเก็บในเครื่องนี้ เว้นแต่คุณเปิดสำรองขึ้นบัญชีด้านล่าง
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            นำเข้าไฟล์ PDF
          </button>
          {history.records.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: "ลบประวัติการลงทะเบียนทั้งหมด?",
                  description: "ข้อมูลที่นำเข้าจาก PDF จะถูกลบออกจากเครื่องนี้ (และจากบัญชี ถ้าเปิดสำรองไว้)",
                  confirmText: "ลบประวัติ",
                  tone: "danger",
                });
                if (ok) onChange({ records: [], regradeCodes: [] });
              }}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Trash2 className="h-4 w-4" /> ล้างประวัติ
            </button>
          )}
        </div>

        {canSync && onSyncChange && (
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2">
            <Switch
              checked={!!syncEnabled}
              onChange={onSyncChange}
              label="สำรองประวัติขึ้นบัญชี Google ของฉัน"
              description="ใช้ได้ทุกอุปกรณ์ที่เข้าสู่ระบบ — ปิดเมื่อใดก็ได้ ข้อมูลบนเซิร์ฟเวอร์จะถูกลบ"
            />
          </div>
        )}

        <p className="text-xs text-gray-600">
          {history.records.length
            ? `มี ${history.records.length} รายการ จาก ${termCount} ภาคการศึกษา`
            : "ยังไม่มีประวัติการลงทะเบียน"}
        </p>

        {repeated.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-800">วิชาที่ลงซ้ำ (ติ๊กถ้าเป็นวิชาตามรีเกรด ไม่ต้องเตือน)</p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {repeated.map(([code, terms]) => (
                <li key={code} className="flex items-center gap-3 px-3 py-2">
                  <Checkbox
                    className="min-w-0 flex-1"
                    checked={history.regradeCodes.includes(code)}
                    onChange={() => toggleRegrade(code)}
                    label={
                      <>
                        <span className="font-mono font-semibold">{code}</span> <span className="text-gray-700">{nameByCode.get(code)}</span>
                      </>
                    }
                  />
                  <span className="shrink-0 text-[11px] text-gray-500">{terms.join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}