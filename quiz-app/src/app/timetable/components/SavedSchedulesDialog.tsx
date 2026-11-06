"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarRange,
  Cloud,
  CloudCheck,
  CloudOff,
  Copy,
  Download,
  Ellipsis,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Loader2,
  LogOut,
  Pencil,
  Pin,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { Dialog, dialogButton } from "@/components/ui/dialog";
import { useDialogs } from "@/components/ui/confirm";
import { Menu } from "@/components/ui/menu";
import { GoogleSignIn } from "@/components/google-sign-in";
import { timetableStore, useTimetableStore } from "@/hooks/use-timetable-store";
import { FOLDER_COLORS, type SavedSchedule, type ScheduleFolder } from "@/lib/timetable-store";
import type { PlanItem } from "@/lib/timetable";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  termId: string;
  termLabel: string;
  items: PlanItem[];
  credits: number;
  courseCount: number;
  activeScheduleId: string | null;
  onOpenSchedule: (s: SavedSchedule) => void;
  onSaved: (s: SavedSchedule) => void;
}

const ALL = "__all";
const NONE = "__none";

const fmtDate = (ts: number) =>
  ts ? new Date(ts).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

export function SavedSchedulesDialog({
  open,
  onClose,
  termId,
  termLabel,
  items,
  credits,
  courseCount,
  activeScheduleId,
  onOpenSchedule,
  onSaved,
}: Props) {
  const { store, user, authChecked, status, lastSyncedAt, error } = useTimetableStore();
  const { confirm, prompt } = useDialogs();
  const [folder, setFolder] = useState<string>(ALL);
  const [moving, setMoving] = useState<SavedSchedule | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const folders = store.folders;
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const schedules = useMemo(
    () =>
      [...store.schedules]
        .filter((s) => (folder === ALL ? true : folder === NONE ? !s.folderId || !folderById.has(s.folderId) : s.folderId === folder))
        .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt),
    [store.schedules, folder, folderById]
  );
  const countIn = (id: string) => store.schedules.filter((s) => s.folderId === id).length;
  const active = activeScheduleId ? store.schedules.find((s) => s.id === activeScheduleId) : undefined;

  const saveNew = async () => {
    const n = store.schedules.filter((s) => s.termId === termId).length + 1;
    const name = await prompt({
      title: "บันทึกตารางปัจจุบัน",
      description: `${termLabel} · ${courseCount} วิชา · ${credits} หน่วยกิต`,
      label: "ชื่อตาราง",
      defaultValue: `ตาราง ${termLabel} แบบที่ ${n}`,
      maxLength: 80,
      validate: (v) => (v.trim() ? null : "กรุณาตั้งชื่อ"),
      confirmText: "บันทึก",
      icon: <Save className="h-5 w-5" />,
    });
    if (!name) return;
    const saved = timetableStore.saveSchedule({
      name,
      folderId: folder !== ALL && folder !== NONE ? folder : null,
      termId,
      termLabel,
      items,
      credits,
      courseCount,
    });
    onSaved(saved);
    toast.success(`บันทึก “${saved.name}” แล้ว${user ? " (ซิงก์ขึ้นบัญชี)" : ""}`);
  };

  const overwrite = () => {
    if (!active) return;
    const saved = timetableStore.saveSchedule({ ...active, items, credits, courseCount, termId, termLabel });
    onSaved(saved);
    toast.success(`อัปเดต “${saved.name}” แล้ว`);
  };

  const newFolder = async () => {
    const name = await prompt({
      title: "สร้างโฟลเดอร์ใหม่",
      label: "ชื่อโฟลเดอร์",
      placeholder: "เช่น ปี 2 เทอม 2, แผนสำรอง",
      maxLength: 60,
      validate: (v) => (v.trim() ? null : "กรุณาตั้งชื่อ"),
      confirmText: "สร้าง",
      icon: <FolderPlus className="h-5 w-5" />,
    });
    if (!name) return;
    const f = timetableStore.createFolder(name);
    setFolder(f.id);
  };

  const renameFolder = async (f: ScheduleFolder) => {
    const name = await prompt({ title: "เปลี่ยนชื่อโฟลเดอร์", defaultValue: f.name, maxLength: 60, validate: (v) => (v.trim() ? null : "กรุณาตั้งชื่อ") });
    if (name) timetableStore.patchFolder(f.id, { name });
  };

  const deleteFolder = async (f: ScheduleFolder) => {
    const n = countIn(f.id);
    const ok = await confirm({
      title: `ลบโฟลเดอร์ “${f.name}”?`,
      description: n ? `ตาราง ${n} รายการในโฟลเดอร์นี้จะย้ายไป “ไม่มีโฟลเดอร์” (ไม่ถูกลบ)` : "โฟลเดอร์ว่าง",
      confirmText: "ลบโฟลเดอร์",
      tone: "danger",
    });
    if (!ok) return;
    timetableStore.deleteFolder(f.id);
    if (folder === f.id) setFolder(ALL);
  };

  const openSchedule = async (s: SavedSchedule) => {
    const hasWork = items.length > 0 && s.id !== activeScheduleId;
    if (hasWork) {
      const ok = await confirm({
        title: `เปิด “${s.name}”?`,
        description: "ตารางที่กำลังจัดอยู่จะถูกแทนที่ — ถ้ายังไม่ได้บันทึก กดยกเลิกแล้วบันทึกก่อน",
        confirmText: "เปิดตารางนี้",
        tone: "warning",
        icon: <FolderOpen className="h-5 w-5" />,
      });
      if (!ok) return;
    }
    onOpenSchedule(s);
    onClose();
  };

  const renameSchedule = async (s: SavedSchedule) => {
    const name = await prompt({ title: "เปลี่ยนชื่อตาราง", defaultValue: s.name, maxLength: 80, validate: (v) => (v.trim() ? null : "กรุณาตั้งชื่อ") });
    if (name) timetableStore.patchSchedule(s.id, { name });
  };

  const deleteSchedule = async (s: SavedSchedule) => {
    const ok = await confirm({
      title: `ลบ “${s.name}”?`,
      description: user ? "ลบออกจากเครื่องนี้และจากบัญชีของคุณ (ทุกอุปกรณ์)" : "ลบออกจากเครื่องนี้",
      confirmText: "ลบตาราง",
      tone: "danger",
    });
    if (ok) timetableStore.deleteSchedule(s.id);
  };

  const exportBackup = () => {
    const blob = new Blob([timetableStore.exportBackup()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `allquiz-timetable-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error("ไฟล์ใหญ่เกินไป");
      const incoming = timetableStore.importBackup(JSON.parse(await file.text()));
      toast.success(`นำเข้า ${incoming.schedules.length} ตาราง ${incoming.folders.length} โฟลเดอร์ (รวมกับของเดิม)`);
    } catch (e) {
      toast.error(e instanceof Error && e.message !== "Unexpected end of JSON input" ? e.message : "ไฟล์สำรองไม่ถูกต้อง");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="lg"
        title="ตารางที่บันทึกไว้"
        description="จัดเก็บหลายแบบ แยกโฟลเดอร์ และเปิดกลับมาแก้ได้ทุกเมื่อ"
        icon={<FolderOpen className="h-5 w-5" />}
      >
        <div className="space-y-4">
          {/* cloud */}
          <SyncCard
            user={user}
            authChecked={authChecked}
            status={status}
            lastSyncedAt={lastSyncedAt}
            error={error}
          />

          {/* save actions */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={saveNew} disabled={!items.length} className={cn(dialogButton.primary, "flex-1")}>
              <Save className="h-4 w-4" /> บันทึกตารางปัจจุบัน
            </button>
            {active && (
              <button type="button" onClick={overwrite} disabled={!items.length} className={cn(dialogButton.secondary, "flex-1")}>
                <RefreshCw className="h-4 w-4" /> อัปเดต “{active.name}”
              </button>
            )}
          </div>

          {/* folders */}
          <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1" role="tablist" aria-label="โฟลเดอร์">
            <FolderChip label="ทั้งหมด" count={store.schedules.length} active={folder === ALL} onClick={() => setFolder(ALL)} />
            {folders.map((f) => (
              <FolderChip
                key={f.id}
                label={f.name}
                color={FOLDER_COLORS[f.color % FOLDER_COLORS.length].dot}
                count={countIn(f.id)}
                active={folder === f.id}
                onClick={() => setFolder(f.id)}
              />
            ))}
            <FolderChip
              label="ไม่มีโฟลเดอร์"
              count={store.schedules.filter((s) => !s.folderId || !folderById.has(s.folderId)).length}
              active={folder === NONE}
              onClick={() => setFolder(NONE)}
            />
            <button
              type="button"
              onClick={newFolder}
              className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700"
            >
              <FolderPlus className="h-3.5 w-3.5" /> โฟลเดอร์ใหม่
            </button>
          </div>

          {folder !== ALL && folder !== NONE && folderById.get(folder) && (
            <div className="-mt-2 flex items-center gap-2 text-xs text-gray-500">
              <Folder className="h-3.5 w-3.5" style={{ color: FOLDER_COLORS[folderById.get(folder)!.color % FOLDER_COLORS.length].dot }} />
              <span className="font-medium text-gray-700">{folderById.get(folder)!.name}</span>
              <button type="button" onClick={() => renameFolder(folderById.get(folder)!)} className="ml-auto rounded-lg px-2 py-1 hover:bg-gray-100">
                <Pencil className="mr-1 inline h-3 w-3" />
                เปลี่ยนชื่อ
              </button>
              <button type="button" onClick={() => deleteFolder(folderById.get(folder)!)} className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50">
                <Trash2 className="mr-1 inline h-3 w-3" />
                ลบ
              </button>
            </div>
          )}

          {/* schedules */}
          {schedules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
              <CalendarRange className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm font-medium text-gray-700">ยังไม่มีตารางในหมวดนี้</p>
              <p className="mt-1 text-xs text-gray-500">จัดตารางแล้วกด “บันทึกตารางปัจจุบัน” เพื่อเก็บไว้เปรียบเทียบหลายแบบ</p>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {schedules.map((s) => {
                const f = s.folderId ? folderById.get(s.folderId) : undefined;
                const isActive = s.id === activeScheduleId;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "group flex flex-col rounded-2xl border bg-white p-3 transition",
                      isActive ? "border-emerald-400 ring-1 ring-emerald-300" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate text-sm font-semibold text-gray-900">
                          {s.pinned && <Pin className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="ปักหมุด" />}
                          <span className="truncate">{s.name}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          ภาค {s.termLabel ?? s.termId} · {s.courseCount ?? s.items.length} วิชา · {s.credits ?? "-"} นก.
                        </p>
                      </div>
                      <Menu
                        label={s.name}
                        trigger={(p) => (
                          <button
                            {...p}
                            type="button"
                            className="-mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            aria-label={`ตัวเลือกของ ${s.name}`}
                          >
                            <Ellipsis className="h-4 w-4" />
                          </button>
                        )}
                        items={[
                          { key: "rename", label: "เปลี่ยนชื่อ", icon: <Pencil />, onSelect: () => renameSchedule(s) },
                          { key: "move", label: "ย้ายไปโฟลเดอร์", icon: <FolderInput />, onSelect: () => setMoving(s) },
                          {
                            key: "pin",
                            label: s.pinned ? "เลิกปักหมุด" : "ปักหมุดไว้บนสุด",
                            icon: <Pin />,
                            onSelect: () => timetableStore.patchSchedule(s.id, { pinned: s.pinned ? undefined : true }),
                          },
                          {
                            key: "dup",
                            label: "ทำสำเนา",
                            icon: <Copy />,
                            onSelect: () => {
                              const d = timetableStore.duplicateSchedule(s.id);
                              if (d) toast.success(`สร้าง “${d.name}”`);
                            },
                          },
                          { key: "del", label: "ลบ", icon: <Trash2 />, danger: true, separator: true, onSelect: () => deleteSchedule(s) },
                        ]}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {f ? (
                        <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", FOLDER_COLORS[f.color % FOLDER_COLORS.length].chip)}>
                          <Folder className="h-3 w-3" /> {f.name}
                        </span>
                      ) : null}
                      <span className="text-[10px] text-gray-400">แก้ไข {fmtDate(s.updatedAt)}</span>
                      <button
                        type="button"
                        onClick={() => openSchedule(s)}
                        className={cn(
                          "ml-auto rounded-xl px-3 py-1.5 text-xs font-semibold",
                          isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-900 text-white hover:bg-gray-700"
                        )}
                      >
                        {isActive ? "กำลังใช้" : s.termId === termId ? "เปิด" : `เปิด (${s.termLabel ?? s.termId})`}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* backup */}
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs">
            <span className="mr-auto text-gray-500">ไฟล์สำรอง (.json)</span>
            <button type="button" onClick={exportBackup} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium text-gray-700 hover:bg-gray-100">
              <Download className="h-3.5 w-3.5" /> ส่งออก
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium text-gray-700 hover:bg-gray-100">
              <Upload className="h-3.5 w-3.5" /> นำเข้า
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importBackup(e.target.files?.[0])} />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!moving}
        onClose={() => setMoving(null)}
        size="sm"
        title="ย้ายไปโฟลเดอร์"
        description={moving?.name}
        icon={<FolderInput className="h-5 w-5" />}
      >
        <div className="space-y-1">
          {[{ id: null as string | null, name: "ไม่มีโฟลเดอร์", color: 7 }, ...folders].map((f) => (
            <button
              key={f.id ?? "none"}
              type="button"
              onClick={() => {
                if (moving) timetableStore.patchSchedule(moving.id, { folderId: f.id });
                setMoving(null);
              }}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-gray-50",
                moving?.folderId === f.id && "bg-emerald-50 font-semibold text-emerald-800"
              )}
            >
              <Folder className="h-4 w-4" style={{ color: FOLDER_COLORS[f.color % FOLDER_COLORS.length].dot }} />
              {f.name}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              const target = moving;
              setMoving(null);
              const name = await prompt({ title: "สร้างโฟลเดอร์ใหม่", label: "ชื่อโฟลเดอร์", maxLength: 60, validate: (v) => (v.trim() ? null : "กรุณาตั้งชื่อ") });
              if (!name || !target) return;
              const f = timetableStore.createFolder(name);
              timetableStore.patchSchedule(target.id, { folderId: f.id });
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-emerald-700 hover:bg-emerald-50"
          >
            <FolderPlus className="h-4 w-4" /> โฟลเดอร์ใหม่…
          </button>
        </div>
      </Dialog>
    </>
  );
}

function FolderChip({ label, count, active, onClick, color }: { label: string; count: number; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ring-inset",
        active ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-700 ring-gray-200 hover:ring-gray-300"
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />}
      {label}
      <span className={cn("tabular-nums", active ? "text-gray-300" : "text-gray-400")}>{count}</span>
    </button>
  );
}

function SyncCard({
  user,
  authChecked,
  status,
  lastSyncedAt,
  error,
}: {
  user: { email: string; name?: string; picture?: string } | null;
  authChecked: boolean;
  status: string;
  lastSyncedAt: number | null;
  error?: string;
}) {
  const { confirm } = useDialogs();
  if (!authChecked) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-xs text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> กำลังตรวจสอบบัญชี…
      </div>
    );
  }
  if (!user) {
    return (
      <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-indigo-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm">
            <CloudOff className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">ตอนนี้บันทึกไว้ในเครื่องนี้เท่านั้น</p>
            <p className="mt-0.5 text-xs text-gray-600">
              เข้าสู่ระบบเพื่อบันทึกลงฐานข้อมูล — ข้อมูลไม่หายแม้ล้างเบราว์เซอร์ และเปิดได้ทุกอุปกรณ์
            </p>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <GoogleSignIn onSignedIn={() => void timetableStore.signedIn()} />
        </div>
      </div>
    );
  }
  const Icon = status === "error" ? AlertCircle : status === "syncing" ? Loader2 : status === "synced" ? CloudCheck : Cloud;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
      {user.picture ? (
        // eslint-disable-next-line @next/next/no-img-element -- Google avatar, tiny and external
        <img src={user.picture} alt="" className="h-9 w-9 rounded-full ring-2 ring-white" referrerPolicy="no-referrer" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
          {(user.name ?? user.email)[0]?.toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{user.name ?? user.email}</p>
        <p className={cn("flex items-center gap-1 text-[11px]", status === "error" ? "text-red-600" : "text-emerald-700")}>
          <Icon className={cn("h-3.5 w-3.5", status === "syncing" && "animate-spin")} />
          {status === "error"
            ? error ?? "ซิงก์ไม่สำเร็จ"
            : status === "syncing"
              ? "กำลังบันทึกลงฐานข้อมูล…"
              : lastSyncedAt
                ? `บันทึกลงฐานข้อมูลแล้ว · ${fmtDate(lastSyncedAt)}`
                : "เชื่อมต่อแล้ว"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void timetableStore.syncNow()}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-emerald-700 hover:bg-emerald-100"
        aria-label="ซิงก์ตอนนี้"
        title="ซิงก์ตอนนี้"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={async () => {
          const ok = await confirm({
            title: "ออกจากระบบ?",
            description: "ตารางยังอยู่ในเครื่องนี้ แต่จะไม่ซิงก์ขึ้นบัญชีจนกว่าจะเข้าสู่ระบบอีกครั้ง",
            confirmText: "ออกจากระบบ",
            tone: "warning",
            icon: <LogOut className="h-5 w-5" />,
          });
          if (ok) void timetableStore.signOut();
        }}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-white hover:text-gray-800"
        aria-label="ออกจากระบบ"
        title="ออกจากระบบ"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
