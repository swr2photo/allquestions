// Live share links for timetables.
//
// A share link points at a *source* in the owner's saved store (a saved
// schedule, or the autosaved working plan of a term) — not at a copy. Every
// time someone opens or refreshes the link the server resolves it against the
// owner's latest store, so viewers always see the last saved version.

import type { PlanItem } from "./timetable";
import type { TimetableStore } from "./timetable-store";

export const SHARE_KEY_PREFIX = "timetable_share:v1:";
export const SHARE_INDEX_PREFIX = "timetable_shares:v1:";
export const MAX_SHARES_PER_USER = 30;
export const SHARE_ID_RE = /^[A-Za-z0-9_-]{8,24}$/;

export type ShareSource = { kind: "schedule"; scheduleId: string } | { kind: "working"; termId: string };

/** stored in KV — `owner` (email) never leaves the server */
export interface ShareRecord {
  id: string;
  owner: string;
  ownerName?: string;
  source: ShareSource;
  includeCustom: boolean;
  showName: boolean;
  createdAt: number;
}

/** what a viewer receives */
export interface SharedTimetable {
  id: string;
  kind: ShareSource["kind"];
  name: string;
  ownerName?: string;
  termId: string;
  termLabel: string;
  items: PlanItem[];
  updatedAt: number;
  isOwner: boolean;
}

/** what the owner sees in "ลิงก์ที่แชร์อยู่" */
export interface ShareSummary {
  id: string;
  source: ShareSource;
  includeCustom: boolean;
  showName: boolean;
  createdAt: number;
  name: string;
  termId: string;
  termLabel: string;
  updatedAt: number;
  missing: boolean;
}

/** "2569-2" → "2/2569" */
export function termLabelOf(termId: string): string {
  const m = /^(\d{4})-(\d)$/.exec(termId);
  return m ? `${m[2]}/${m[1]}` : termId;
}

export function sameSource(a: ShareSource, b: ShareSource): boolean {
  if (a.kind === "schedule" && b.kind === "schedule") return a.scheduleId === b.scheduleId;
  if (a.kind === "working" && b.kind === "working") return a.termId === b.termId;
  return false;
}

export function parseSource(v: unknown): ShareSource | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.kind === "schedule" && typeof o.scheduleId === "string" && /^[\w-]{1,40}$/.test(o.scheduleId)) {
    return { kind: "schedule", scheduleId: o.scheduleId };
  }
  if (o.kind === "working" && typeof o.termId === "string" && /^\d{4}-\d$/.test(o.termId)) {
    return { kind: "working", termId: o.termId };
  }
  return null;
}

/** Resolve a share against the owner's current store; null when the source is gone. */
export function resolveShare(rec: ShareRecord, store: TimetableStore | null): Omit<SharedTimetable, "isOwner"> | null {
  if (!store) return null;
  let items: PlanItem[];
  let name: string;
  let termId: string;
  let termLabel: string;
  let updatedAt: number;
  if (rec.source.kind === "schedule") {
    const id = rec.source.scheduleId;
    const s = store.schedules.find((x) => x.id === id);
    if (!s) return null;
    items = s.items;
    name = s.name;
    termId = s.termId;
    termLabel = s.termLabel ?? termLabelOf(s.termId);
    updatedAt = s.updatedAt;
  } else {
    termId = rec.source.termId;
    const w = store.working[termId];
    items = w?.items ?? [];
    termLabel = termLabelOf(termId);
    name = `ตารางเรียน ${termLabel}`;
    updatedAt = w?.updatedAt ?? 0;
  }
  if (!rec.includeCustom) items = items.filter((i) => i.kind === "course");
  return {
    id: rec.id,
    kind: rec.source.kind,
    name,
    ownerName: rec.showName ? rec.ownerName : undefined,
    termId,
    termLabel,
    items,
    updatedAt,
  };
}
