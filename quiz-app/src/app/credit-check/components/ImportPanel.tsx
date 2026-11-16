"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, FileUp, Loader2, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm";
import { normalizeQuery } from "@/lib/timetable";
import { codeKey, type CatalogCourse } from "@/lib/credit-check";
import type { FacultyCourse } from "@/app/api/faculties/route";
import { cn } from "@/lib/utils";
import {
  UNKNOWN_TERM,
  extractRegistrationFromPdf,
  mergeRegistrationRecords,
  parseRegistrationText,
  type RegistrationRecord,
} from "@/lib/registration";

interface Props {
  records: RegistrationRecord[];
  /** สร้างฐานข้อมูลรายวิชาสำหรับหน้าเพิ่มวิชาเอง — เรียกเมื่อเปิดหน้าต่างเท่านั้น (รายการใหญ่ ไม่ควรสร้างทุกครั้งที่หน้าหลักเปลี่ยน) */
  buildCatalog?: () => CatalogCourse[];
  onChange: (records: RegistrationRecord[]) => void;
}

const NO_CATALOG: CatalogCourse[] = [];

const FIELD =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
const SECONDARY =
  "flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

export function ImportPanel({ records, buildCatalog, onChange }: Props) {
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ code: "", name: "", credits: "3", term: "" });
  const [catalogQuery, setCatalogQuery] = useState("");
  const [sisCache, setSisCache] = useState<Record<string, CatalogCourse[]>>({});
  const [loadingQuery, setLoadingQuery] = useState<string | null>(null);

  const normalizedQuery = normalizeQuery(catalogQuery);
  const catalogCourses = useMemo(() => (manualOpen && buildCatalog ? buildCatalog() : NO_CATALOG), [manualOpen, buildCatalog]);

  useEffect(() => {
    if (!manualOpen || normalizedQuery.length < 2 || normalizedQuery in sisCache) return;
    const ctrl = new AbortController();
    const qKey = normalizedQuery;
    const rawQ = catalogQuery.trim();
    const timer = setTimeout(() => {
      setLoadingQuery(qKey);
      fetch(`/api/faculties?only=courses&q=${encodeURIComponent(rawQ)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((json: { courses?: FacultyCourse[] }) => {
          const mapped: CatalogCourse[] = (json.courses ?? []).map((c) => ({
            code: c.code,
            name: c.nameTh || c.nameEn || c.code,
            nameSub: c.nameTh && c.nameEn && c.nameTh !== c.nameEn ? c.nameEn : undefined,
            credits: c.creditNum || 2,
            source: "sis",
            tag: c.ge[0] ?? (c.faculty || undefined),
          }));
          setSisCache((prev) => ({ ...prev, [qKey]: mapped }));
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setSisCache((prev) => ({ ...prev, [qKey]: [] }));
        })
        .finally(() => setLoadingQuery((cur) => (cur === qKey ? null : cur)));
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [manualOpen, catalogQuery, normalizedQuery, sisCache]);

  const addedCodes = useMemo(() => new Set(records.map((r) => codeKey(r.code))), [records]);

  const catalogMatches = useMemo(() => {
    if (!normalizedQuery) {
      const missingOrPlan = catalogCourses.filter(
        (c) =>
          (c.source === "missing" || c.source === "elective" || (c.tag?.startsWith("ในแผน") ?? false)) &&
          !addedCodes.has(codeKey(c.code))
      );
      return (missingOrPlan.length ? missingOrPlan : catalogCourses).slice(0, 30);
    }

    const sisHits = sisCache[normalizedQuery] ?? [];
    const byKey = new Map<string, CatalogCourse & { score: number }>();
    const consider = (c: CatalogCourse) => {
      const codeNorm = normalizeQuery(c.code);
      const hayNorm = normalizeQuery(`${c.code} ${c.name} ${c.nameSub ?? ""} ${c.tag ?? ""}`);
      let score = -1;
      if (codeNorm === normalizedQuery) score = 0;
      else if (codeNorm.startsWith(normalizedQuery)) score = 1;
      else if (codeNorm.includes(normalizedQuery)) score = 2;
      else if (hayNorm.includes(normalizedQuery)) score = 3;
      if (score < 0) return;

      const k = codeKey(c.code);
      const prev = byKey.get(k);
      if (!prev) {
        byKey.set(k, { ...c, score });
        return;
      }
      // Prefer SIS/curriculum exact credits over GE default 2, and preserve local plan/GE labels
      byKey.set(k, {
        ...prev,
        credits: prev.creditsEstimated && !c.creditsEstimated ? c.credits : prev.credits,
        creditsEstimated: prev.creditsEstimated && c.creditsEstimated,
        nameSub: prev.nameSub ?? c.nameSub,
        score: Math.min(prev.score, score),
      });
    };

    catalogCourses.forEach(consider);
    sisHits.forEach(consider);

    return [...byKey.values()]
      .sort((a, b) => a.score - b.score || a.code.localeCompare(b.code))
      .slice(0, 40);
  }, [catalogCourses, sisCache, normalizedQuery, addedCodes]);

  const searchingSis = normalizedQuery.length >= 2 && loadingQuery === normalizedQuery;

  const pickCourse = (c: CatalogCourse) => {
    setManual((m) => ({ ...m, code: c.code, name: c.name, credits: String(c.credits) }));
  };

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
      if (files?.length) toast.error("รองรับเฉพาะไฟล์ PDF ผลการลงทะเบียนหรือผลการเรียน (ใบเกรด) จาก SIS");
      return;
    }
    setBusy(true);
    try {
      const parsed: RegistrationRecord[] = [];
      const failed: string[] = [];
      const skipped: string[] = [];
      for (const file of list) {
        try {
          const { records: found, skippedCodes } = await extractRegistrationFromPdf(file);
          if (found.length) {
            parsed.push(...found);
            for (const code of skippedCodes) {
              if (!skipped.includes(code)) skipped.push(code);
            }
          } else {
            failed.push(file.name);
          }
        } catch {
          failed.push(file.name);
        }
      }
      if (parsed.length) addRecords(parsed, `ไฟล์ PDF ${list.length - failed.length} ไฟล์`);
      if (skipped.length) {
        toast.warning(
          `พบรหัสวิชาที่อ่านไม่ครบ ${skipped.length} วิชา (${skipped.join(", ")}) — เพิ่มได้จากปุ่ม "+ เพิ่มวิชาเอง"`,
          { duration: 6000 }
        );
      }
      if (failed.length) toast.error(`ไม่พบรายวิชาใน ${failed.join(", ")} — ต้องเป็นไฟล์ "ผลการลงทะเบียน" หรือ "ผลการเรียน" จาก SIS`);
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
    const code = manual.code.trim().replace(/\s+/g, "").toUpperCase();
    const credits = Number(manual.credits);
    const term = manual.term.trim();
    if (!/^(?:[A-Z0-9]{3}-(?:\d{3}|[A-Z]\d{2})[A-Z0-9]*|[A-Z]{3}\d{2}(?:G[1-8][AB]?\d{2,3}|[A-Z0-9]{2}\d{3}))$/.test(code)) {
      return toast.error("รหัสวิชาต้องอยู่ในรูป 322-101, B03-001G4 หรือ DII00G4005");
    }
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
          "group flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-60",
          dragging ? "border-emerald-500 bg-emerald-50" : "border-emerald-200 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50"
        )}
      >
        <span className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inset-0 rotate-6 rounded-2xl bg-emerald-200/70 transition-transform group-hover:rotate-12 motion-reduce:transition-none" aria-hidden />
          <span className="relative flex h-full w-full items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
          </span>
        </span>
        <span className="text-sm font-semibold text-gray-900">
          {busy ? "กำลังอ่านไฟล์…" : dragging ? "ปล่อยไฟล์ที่นี่" : "เลือกหรือลากไฟล์ PDF จาก SIS มาวาง"}
        </span>
        <span className="max-w-md text-xs leading-relaxed text-gray-600">
          ใบผลการเรียน (ใบเกรด) รวมทุกภาค หรือใบผลการลงทะเบียนหลายไฟล์พร้อมกันก็ได้
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200 ring-inset">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> อ่านในเบราว์เซอร์ ไม่ส่งไฟล์ออกนอกเครื่อง
        </span>
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
        {records.length
          ? `นำเข้าแล้ว ${records.length} รายการ จาก ${termCount} ภาคการศึกษา`
          : "ยังไม่มีรายวิชา — นำเข้า PDF ผลการเรียน (ใบเกรด) หรือใบลงทะเบียนจาก SIS"}
      </p>

      <Dialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        size="lg"
        persistent
        title="วางข้อความจาก SIS"
        description="คัดลอกตารางรายวิชาจากหน้าผลการเรียนหรือผลการลงทะเบียนแล้ววางที่นี่ ใส่บรรทัด “ภาคการศึกษา 1/2568” คั่นแต่ละภาคได้"
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
          aria-label="ข้อความผลการเรียนหรือผลการลงทะเบียน"
          placeholder={"ภาคการศึกษา 1/2568\n322-101 CALCULUS I 05 3 C+\n324-101 GENERAL CHEMISTRY I 02 C 3\n…"}
          className="w-full rounded-xl border border-gray-200 bg-white p-3 font-mono text-xs leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </Dialog>

      <Dialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        size="lg"
        title="เพิ่มวิชาเอง"
        description="สำหรับวิชาที่ไม่มีในใบผลการเรียนหรือใบลงทะเบียน เช่น วิชาเทียบโอน — เลือกจากฐานข้อมูลหรือกรอกเองด้านล่าง"
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
        <div className="space-y-4 text-sm">
          {/* เลือกจากฐานข้อมูลรายวิชา */}
          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-800">เลือกจากฐานข้อมูลรายวิชา (หลักสูตร · GE · SIS)</span>
              {searchingSis && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                  <Loader2 className="h-3 w-3 animate-spin" /> กำลังค้นหารายวิชา ม.อ.…
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="ค้นหารหัสหรือชื่อวิชา เช่น 322-101, Calculus, DII00G4005…"
                aria-label="ค้นหารายวิชาจากฐานข้อมูล"
                className={cn(FIELD, "pr-8 pl-9")}
              />
              {catalogQuery && (
                <button
                  type="button"
                  onClick={() => setCatalogQuery("")}
                  aria-label="ล้างคำค้นหา"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {catalogMatches.length > 0 ? (
              <div className="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                {catalogMatches.map((c) => {
                  const alreadyAdded = addedCodes.has(codeKey(c.code));
                  const selected = normalizeQuery(manual.code) === normalizeQuery(c.code);
                  return (
                    <button
                      key={`${c.source}:${c.code}`}
                      type="button"
                      onClick={() => pickCourse(c)}
                      className={cn(
                        "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-emerald-50/60",
                        selected && "bg-emerald-50/80"
                      )}
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-xs font-semibold text-gray-900">{c.code}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-gray-800">{c.name}</p>
                        {c.nameSub && <p className="truncate text-[11px] text-gray-500">{c.nameSub}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {c.tag && (
                          <span
                            className={cn(
                              "hidden rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline-block",
                              c.source === "missing"
                                ? "bg-amber-50 text-amber-800"
                                : c.source === "gened"
                                  ? "bg-sky-50 text-sky-800"
                                  : "bg-gray-100 text-gray-600"
                            )}
                          >
                            {c.tag}
                          </span>
                        )}
                        {alreadyAdded && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                            มีแล้ว
                          </span>
                        )}
                        <span className="text-xs font-semibold tabular-nums text-gray-700">{c.credits} นก.</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-2 text-center text-xs text-gray-500">
                {normalizedQuery
                  ? searchingSis
                    ? "กำลังค้นหารายวิชาในระบบ…"
                    : `ไม่พบ “${catalogQuery.trim()}” ในฐานข้อมูล — กรอกรหัสและชื่อวิชาเองด้านล่างได้`
                  : "พิมพ์รหัสหรือชื่อวิชา (อย่างน้อย 2 ตัวอักษรเพื่อค้นหารายวิชา ม.อ. ทั้งหมด) หรือเลือกสาขาในขั้นที่ 1 เพื่อดูวิชาในแผน"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-1 space-y-1">
              <span className="text-xs font-medium text-gray-700">รหัสวิชา</span>
              <input
                className={cn(FIELD, "font-mono")}
                placeholder="322-101 หรือ DII00G4005"
                value={manual.code}
                onChange={(e) => setManual({ ...manual, code: e.target.value })}
              />
            </label>
            <label className="col-span-1 space-y-1">
              <span className="text-xs font-medium text-gray-700">หน่วยกิต</span>
              <input
                className={FIELD}
                inputMode="numeric"
                value={manual.credits}
                onChange={(e) => setManual({ ...manual, credits: e.target.value })}
              />
            </label>
            <label className="col-span-2 space-y-1">
              <span className="text-xs font-medium text-gray-700">ชื่อวิชา</span>
              <input
                className={FIELD}
                placeholder="CALCULUS I"
                value={manual.name}
                onChange={(e) => setManual({ ...manual, name: e.target.value })}
              />
            </label>
            <label className="col-span-2 space-y-1">
              <span className="text-xs font-medium text-gray-700">ภาคการศึกษา (ไม่บังคับ)</span>
              <input
                className={FIELD}
                placeholder="1/2568 (เว้นว่างไว้ได้สำหรับวิชาเทียบโอน)"
                value={manual.term}
                onChange={(e) => setManual({ ...manual, term: e.target.value })}
              />
            </label>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
