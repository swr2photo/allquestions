// Saved timetables, folders and preferences — one JSON document per user.
//
// Pure data model + merge (shared by the client store and the API route).
// Merge is last-write-wins per entity with tombstones, so two devices that
// edit different schedules offline never overwrite each other.

import type { PlanItem } from "./timetable";
import type { RegistrationHistory } from "./registration";

export const STORE_VERSION = 1;
export const MAX_STORE_BYTES = 512 * 1024;
const TOMBSTONE_TTL_MS = 120 * 24 * 60 * 60 * 1000;

export interface ScheduleFolder {
  id: string;
  name: string;
  /** index into FOLDER_COLORS */
  color: number;
  createdAt: number;
  updatedAt: number;
}

export interface SavedSchedule {
  id: string;
  name: string;
  folderId: string | null;
  termId: string;
  termLabel?: string;
  items: PlanItem[];
  credits?: number;
  courseCount?: number;
  note?: string;
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CurriculumSelection {
  curriculumId: string;
  division: string;
  programId: string;
  editionYear: number;
  plan: string;
  year: number;
  /** remembered only for the SIS term it was picked in */
  term?: number;
  termOf?: string;
}

export interface TimetablePrefs {
  curriculum?: CurriculumSelection;
  panel?: "search" | "curriculum" | "recommend";
  syncRegistration?: boolean;
  updatedAt: number;
}

export interface WorkingPlan {
  items: PlanItem[];
  updatedAt: number;
}

export interface TimetableStore {
  version: number;
  folders: ScheduleFolder[];
  schedules: SavedSchedule[];
  /** autosaved "current" timetable per SIS term */
  working: Record<string, WorkingPlan>;
  prefs: TimetablePrefs;
  registration?: RegistrationHistory & { updatedAt: number };
  /** id → deletedAt */
  deleted: Record<string, number>;
  updatedAt: number;
}

export const FOLDER_COLORS = [
  { dot: "#059669", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { dot: "#2563eb", chip: "bg-blue-50 text-blue-700 ring-blue-200" },
  { dot: "#d97706", chip: "bg-amber-50 text-amber-800 ring-amber-200" },
  { dot: "#db2777", chip: "bg-pink-50 text-pink-700 ring-pink-200" },
  { dot: "#7c3aed", chip: "bg-violet-50 text-violet-700 ring-violet-200" },
  { dot: "#0891b2", chip: "bg-cyan-50 text-cyan-700 ring-cyan-200" },
  { dot: "#dc2626", chip: "bg-red-50 text-red-700 ring-red-200" },
  { dot: "#4b5563", chip: "bg-gray-100 text-gray-700 ring-gray-200" },
] as const;

export function emptyStore(): TimetableStore {
  return { version: STORE_VERSION, folders: [], schedules: [], working: {}, prefs: { updatedAt: 0 }, deleted: {}, updatedAt: 0 };
}

export function newId(prefix = ""): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix + rnd;
}

// ------------------------------------------------------------------ validation

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function cleanItems(v: unknown): PlanItem[] {
  if (!Array.isArray(v)) return [];
  const out: PlanItem[] = [];
  for (const it of v.slice(0, 60)) {
    if (!isObj(it)) continue;
    if (it.kind === "course" && typeof it.courseId === "string") {
      out.push({ kind: "course", courseId: str(it.courseId, 40), sec: str(it.sec, 10), color: num(it.color) });
    } else if (it.kind === "custom" && Array.isArray(it.slots)) {
      out.push({
        kind: "custom",
        id: str(it.id, 40),
        code: str(it.code, 30),
        name: str(it.name, 120),
        room: str(it.room, 60),
        credits: num(it.credits),
        color: num(it.color),
        slots: it.slots.slice(0, 14).filter(isObj).map((s) => ({
          day: Math.max(0, Math.min(6, num(s.day))),
          start: num(s.start),
          end: num(s.end),
          room: s.room ? str(s.room, 60) : undefined,
        })),
      });
    }
  }
  return out;
}

/** Coerce untrusted JSON (from localStorage or the network) into a valid store. */
export function sanitizeStore(input: unknown): TimetableStore {
  const s = emptyStore();
  if (!isObj(input)) return s;
  s.updatedAt = num(input.updatedAt);
  if (Array.isArray(input.folders)) {
    s.folders = input.folders.slice(0, 100).filter(isObj).map((f) => ({
      id: str(f.id, 40),
      name: str(f.name, 60) || "โฟลเดอร์",
      color: num(f.color) % FOLDER_COLORS.length,
      createdAt: num(f.createdAt),
      updatedAt: num(f.updatedAt),
    })).filter((f) => f.id);
  }
  if (Array.isArray(input.schedules)) {
    s.schedules = input.schedules.slice(0, 300).filter(isObj).map((x) => ({
      id: str(x.id, 40),
      name: str(x.name, 80) || "ตารางเรียน",
      folderId: typeof x.folderId === "string" ? str(x.folderId, 40) : null,
      termId: str(x.termId, 20),
      termLabel: x.termLabel ? str(x.termLabel, 30) : undefined,
      items: cleanItems(x.items),
      credits: x.credits === undefined ? undefined : num(x.credits),
      courseCount: x.courseCount === undefined ? undefined : num(x.courseCount),
      note: x.note ? str(x.note, 300) : undefined,
      pinned: x.pinned === true || undefined,
      createdAt: num(x.createdAt),
      updatedAt: num(x.updatedAt),
    })).filter((x) => x.id && x.termId);
  }
  if (isObj(input.working)) {
    for (const [termId, w] of Object.entries(input.working).slice(0, 40)) {
      if (isObj(w)) s.working[str(termId, 20)] = { items: cleanItems(w.items), updatedAt: num(w.updatedAt) };
    }
  }
  if (isObj(input.prefs)) {
    const p = input.prefs;
    s.prefs = { updatedAt: num(p.updatedAt) };
    if (p.panel === "search" || p.panel === "curriculum" || p.panel === "recommend") s.prefs.panel = p.panel;
    if (typeof p.syncRegistration === "boolean") s.prefs.syncRegistration = p.syncRegistration;
    if (isObj(p.curriculum)) {
      const c = p.curriculum;
      s.prefs.curriculum = {
        curriculumId: str(c.curriculumId, 40),
        division: str(c.division, 120),
        programId: str(c.programId, 80),
        editionYear: num(c.editionYear),
        plan: str(c.plan, 80),
        year: num(c.year, 1),
        term: c.term === undefined ? undefined : num(c.term),
        termOf: c.termOf ? str(c.termOf, 20) : undefined,
      };
    }
  }
  if (isObj(input.registration) && Array.isArray(input.registration.records)) {
    const r = input.registration;
    const records = (r.records as unknown[]).slice(0, 600).filter(isObj).map((x) => ({
      term: str(x.term, 10),
      code: str(x.code, 20),
      name: str(x.name, 160),
      sec: str(x.sec, 6),
      type: str(x.type, 4),
      credits: num(x.credits),
    }));
    s.registration = {
      records,
      regradeCodes: Array.isArray(r.regradeCodes) ? r.regradeCodes.filter((c): c is string => typeof c === "string").slice(0, 200) : [],
      updatedAt: num(r.updatedAt),
    };
  }
  if (isObj(input.deleted)) {
    for (const [id, at] of Object.entries(input.deleted).slice(0, 2000)) s.deleted[str(id, 40)] = num(at);
  }
  return s;
}

// ------------------------------------------------------------------ merge

function mergeById<T extends { id: string; updatedAt: number }>(a: T[], b: T[], deleted: Record<string, number>): T[] {
  const map = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const prev = map.get(x.id);
    if (!prev || x.updatedAt > prev.updatedAt) map.set(x.id, x);
  }
  return [...map.values()].filter((x) => !(deleted[x.id] && deleted[x.id] >= x.updatedAt));
}

export function mergeStores(a: TimetableStore, b: TimetableStore, now = Date.now()): TimetableStore {
  const deleted: Record<string, number> = {};
  for (const [id, at] of [...Object.entries(a.deleted), ...Object.entries(b.deleted)]) {
    if (now - at > TOMBSTONE_TTL_MS) continue;
    deleted[id] = Math.max(deleted[id] ?? 0, at);
  }
  const working: Record<string, WorkingPlan> = { ...a.working };
  for (const [term, w] of Object.entries(b.working)) {
    if (!working[term] || w.updatedAt > working[term].updatedAt) working[term] = w;
  }
  const regA = a.registration;
  const regB = b.registration;
  return {
    version: STORE_VERSION,
    folders: mergeById(a.folders, b.folders, deleted),
    schedules: mergeById(a.schedules, b.schedules, deleted),
    working,
    prefs: b.prefs.updatedAt > a.prefs.updatedAt ? b.prefs : a.prefs,
    registration: !regA ? regB : !regB ? regA : regB.updatedAt > regA.updatedAt ? regB : regA,
    deleted,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

/** Cheap structural fingerprint to skip no-op uploads. */
export function storeFingerprint(s: TimetableStore): string {
  const parts = [
    s.folders.map((f) => `${f.id}:${f.updatedAt}`).join(","),
    s.schedules.map((x) => `${x.id}:${x.updatedAt}`).join(","),
    Object.entries(s.working).map(([k, w]) => `${k}:${w.updatedAt}`).join(","),
    s.prefs.updatedAt,
    s.registration?.updatedAt ?? 0,
    Object.keys(s.deleted).length,
  ];
  return parts.join("|");
}

export function summarize(items: PlanItem[], creditsOf: (courseId: string) => number | undefined) {
  let credits = 0;
  let courseCount = 0;
  for (const it of items) {
    if (it.kind === "course") {
      courseCount++;
      credits += creditsOf(it.courseId) ?? 0;
    } else credits += it.credits;
  }
  return { credits, courseCount };
}
