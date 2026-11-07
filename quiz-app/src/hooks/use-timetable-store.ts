"use client";

// Client side of the saved-timetable store.
//
// • Always works offline: everything is mirrored to localStorage first.
// • Signed in (Google): pulled from / pushed to /api/timetable/store (Upstash KV)
//   with a short debounce, and flushed with keepalive when the tab is hidden —
//   so a closed tab, cleared browser data or a new phone never loses schedules.
// • Module-level external store (useSyncExternalStore): every component sees the
//   same snapshot and no effect needs to call setState.

import { useEffect, useSyncExternalStore } from "react";
import type { PlanItem } from "@/lib/timetable";
import type { RegistrationHistory } from "@/lib/registration";
import {
  FOLDER_COLORS,
  emptyStore,
  mergeStores,
  newId,
  sanitizeStore,
  storeFingerprint,
  type CurriculumSelection,
  type SavedSchedule,
  type ScheduleFolder,
  type TimetablePrefs,
  type TimetableStore,
} from "@/lib/timetable-store";

const LOCAL_KEY = "psu-timetable:store:v2";
const LEGACY_PREFIX = "psu-timetable:v1:";
const MIGRATED_KEY = "psu-timetable:migrated:v2";

export type SyncStatus = "idle" | "local" | "syncing" | "synced" | "error";

export interface AuthUser {
  email: string;
  name?: string;
  picture?: string;
}

export interface StoreState {
  store: TimetableStore;
  user: AuthUser | null;
  authChecked: boolean;
  status: SyncStatus;
  lastSyncedAt: number | null;
  error?: string;
  ready: boolean;
}

const SERVER_STATE: StoreState = {
  store: emptyStore(),
  user: null,
  authChecked: false,
  status: "idle",
  lastSyncedAt: null,
  ready: false,
};

let state: StoreState = SERVER_STATE;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function patch(p: Partial<StoreState>) {
  state = { ...state, ...p };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ------------------------------------------------------------------ local persistence

function readLocal(): TimetableStore {
  let store = emptyStore();
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) store = sanitizeStore(JSON.parse(raw));
  } catch {
    /* corrupt / unavailable — start empty */
  }
  // one-time migration of the old per-term keys (kept on disk as a fallback copy)
  try {
    if (!localStorage.getItem(MIGRATED_KEY)) {
      let moved = false;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith(LEGACY_PREFIX)) continue;
        const term = k.slice(LEGACY_PREFIX.length);
        if (store.working[term]) continue;
        const migrated = sanitizeStore({ working: { [term]: { items: JSON.parse(localStorage.getItem(k) || "[]"), updatedAt: 1 } } });
        if (migrated.working[term]?.items.length) {
          store.working[term] = migrated.working[term];
          moved = true;
        }
      }
      if (moved) localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
      localStorage.setItem(MIGRATED_KEY, "1");
    }
  } catch {
    /* ignore */
  }
  return store;
}

function writeLocal(s: TimetableStore) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota — cloud copy (if signed in) still works */
  }
}

function applyStore(next: TimetableStore, fromUser: boolean) {
  state = { ...state, store: next };
  writeLocal(next);
  emit();
  if (fromUser) schedulePush();
}

// ------------------------------------------------------------------ cloud sync

let pushTimer: ReturnType<typeof setTimeout> | undefined;
let lastPushed = "";
let pushing = false;
let pushAgain = false;

/** registration history only leaves the device when the user opted in */
function outbound(s: TimetableStore): TimetableStore {
  if (s.prefs.syncRegistration) return s;
  return { ...s, registration: s.registration && s.registration.records.length === 0 ? s.registration : undefined };
}

/** fingerprint of what the server holds, so local and remote compare like-for-like */
function fingerprintOf(s: TimetableStore): string {
  return storeFingerprint(outbound(s));
}

function schedulePush(delay = 1200) {
  if (!state.user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void push(), delay);
}

async function push(keepalive = false) {
  if (!state.user) return;
  if (pushing) {
    pushAgain = true;
    return;
  }
  const snapshot = state.store;
  if (fingerprintOf(snapshot) === lastPushed) {
    if (state.status !== "synced") patch({ status: "synced" });
    return;
  }
  pushing = true;
  if (!keepalive) patch({ status: "syncing" });
  try {
    const res = await fetch("/api/timetable/store", {
      method: keepalive ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store: outbound(snapshot) }),
      keepalive,
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      patch({ user: null, status: "local" });
      return;
    }
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const server = sanitizeStore(json.store);
    lastPushed = fingerprintOf(server);
    const merged = mergeStores(state.store, server);
    applyStore(merged, false);
    const dirty = fingerprintOf(merged) !== lastPushed;
    patch({ status: dirty ? "syncing" : "synced", lastSyncedAt: Date.now(), error: undefined });
    if (dirty) schedulePush(400);
  } catch (e) {
    patch({ status: "error", error: e instanceof Error ? e.message : "บันทึกขึ้นคลาวด์ไม่สำเร็จ" });
  } finally {
    pushing = false;
    if (pushAgain) {
      pushAgain = false;
      schedulePush(300);
    }
  }
}

async function pull() {
  if (!state.user) return;
  patch({ status: "syncing" });
  try {
    const res = await fetch("/api/timetable/store", { cache: "no-store" });
    if (res.status === 401) {
      patch({ user: null, status: "local" });
      return;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const remote = json.store ? sanitizeStore(json.store) : null;
    lastPushed = remote ? fingerprintOf(remote) : "";
    const merged = remote ? mergeStores(state.store, remote) : state.store;
    applyStore(merged, false);
    if (fingerprintOf(merged) !== lastPushed) await push();
    else patch({ status: "synced", lastSyncedAt: Date.now(), error: undefined });
  } catch (e) {
    patch({ status: "error", error: e instanceof Error ? e.message : "เชื่อมต่อฐานข้อมูลไม่สำเร็จ" });
  }
}

async function connect() {
  try {
    const res = await fetch("/api/auth/user", { cache: "no-store" });
    const json = await res.json();
    const user: AuthUser | null = json.authenticated && json.user?.email ? json.user : null;
    patch({ user, authChecked: true, status: user ? state.status : "local" });
    if (user) await pull();
  } catch {
    patch({ authChecked: true, status: "local" });
  }
}

let started = false;

function init() {
  if (started || typeof window === "undefined") return;
  started = true;
  state = { ...state, store: readLocal(), ready: true, status: "local" };
  emit();
  void connect();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && state.user) {
      clearTimeout(pushTimer);
      void push(true);
    } else if (document.visibilityState === "visible" && state.user && state.lastSyncedAt && Date.now() - state.lastSyncedAt > 60_000) {
      void pull();
    }
  });
  // another tab saved → adopt its changes
  window.addEventListener("storage", (e) => {
    if (e.key !== LOCAL_KEY || !e.newValue) return;
    try {
      const other = sanitizeStore(JSON.parse(e.newValue));
      state = { ...state, store: mergeStores(state.store, other) };
      emit();
    } catch {
      /* ignore */
    }
  });
}

export function useTimetableStore(): StoreState {
  useEffect(init, []);
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

// ------------------------------------------------------------------ actions

function update(fn: (s: TimetableStore) => TimetableStore) {
  // Actions can be called from pages that never mounted useTimetableStore()
  // (e.g. /faculties → "ใช้แผนนี้จัดตาราง"). Load the saved store first, or the
  // write below would replace everything on disk with an empty store.
  init();
  if (!state.ready) return;
  const next = fn(state.store);
  next.updatedAt = Date.now();
  applyStore(next, true);
}

const touch = <T extends { updatedAt: number }>(x: T): T => ({ ...x, updatedAt: Date.now() });

export const timetableStore = {
  get: () => {
    init();
    return state;
  },

  setWorking(termId: string, fn: (items: PlanItem[]) => PlanItem[]) {
    update((s) => ({
      ...s,
      working: { ...s.working, [termId]: { items: fn(s.working[termId]?.items ?? []), updatedAt: Date.now() } },
    }));
  },

  setPrefs(p: Partial<Omit<TimetablePrefs, "updatedAt">>) {
    update((s) => ({ ...s, prefs: { ...s.prefs, ...p, updatedAt: Date.now() } }));
  },

  setCurriculum(c: CurriculumSelection) {
    init();
    const prev = state.store.prefs.curriculum;
    if (prev && JSON.stringify(prev) === JSON.stringify(c)) return;
    timetableStore.setPrefs({ curriculum: c });
  },

  saveSchedule(input: Omit<SavedSchedule, "id" | "createdAt" | "updatedAt"> & { id?: string }): SavedSchedule {
    const now = Date.now();
    const existing = input.id ? state.store.schedules.find((x) => x.id === input.id) : undefined;
    const saved: SavedSchedule = existing
      ? { ...existing, ...input, id: existing.id, updatedAt: now }
      : { ...input, id: newId("s_"), createdAt: now, updatedAt: now };
    update((s) => ({ ...s, schedules: [...s.schedules.filter((x) => x.id !== saved.id), saved] }));
    return saved;
  },

  patchSchedule(id: string, p: Partial<Omit<SavedSchedule, "id" | "createdAt">>) {
    update((s) => ({ ...s, schedules: s.schedules.map((x) => (x.id === id ? touch({ ...x, ...p }) : x)) }));
  },

  duplicateSchedule(id: string): SavedSchedule | null {
    const src = state.store.schedules.find((x) => x.id === id);
    if (!src) return null;
    const { id: _omit, createdAt: _c, updatedAt: _u, ...rest } = src;
    void _omit;
    void _c;
    void _u;
    return timetableStore.saveSchedule({ ...rest, name: `${src.name} (สำเนา)`, pinned: undefined });
  },

  deleteSchedule(id: string) {
    update((s) => ({ ...s, schedules: s.schedules.filter((x) => x.id !== id), deleted: { ...s.deleted, [id]: Date.now() } }));
  },

  createFolder(name: string): ScheduleFolder {
    const now = Date.now();
    const folder: ScheduleFolder = {
      id: newId("f_"),
      name: name.trim().slice(0, 60) || "โฟลเดอร์ใหม่",
      color: state.store.folders.length % FOLDER_COLORS.length,
      createdAt: now,
      updatedAt: now,
    };
    update((s) => ({ ...s, folders: [...s.folders, folder] }));
    return folder;
  },

  patchFolder(id: string, p: Partial<Pick<ScheduleFolder, "name" | "color">>) {
    update((s) => ({ ...s, folders: s.folders.map((f) => (f.id === id ? touch({ ...f, ...p }) : f)) }));
  },

  /** deleting a folder keeps its schedules (moved to "ไม่มีโฟลเดอร์") unless withSchedules */
  deleteFolder(id: string, withSchedules = false) {
    const now = Date.now();
    update((s) => {
      const deleted = { ...s.deleted, [id]: now };
      const schedules = s.schedules.flatMap((x) => {
        if (x.folderId !== id) return [x];
        if (withSchedules) {
          deleted[x.id] = now;
          return [];
        }
        return [{ ...x, folderId: null, updatedAt: now }];
      });
      return { ...s, folders: s.folders.filter((f) => f.id !== id), schedules, deleted };
    });
  },

  setRegistrationMirror(history: RegistrationHistory) {
    update((s) => ({ ...s, registration: { ...history, updatedAt: Date.now() } }));
  },

  /** import a backup file (merged, never replaces) */
  importBackup(json: unknown) {
    const incoming = sanitizeStore(json);
    update((s) => mergeStores(s, incoming));
    return incoming;
  },

  exportBackup(): string {
    return JSON.stringify({ ...state.store, exportedAt: new Date().toISOString(), app: "allquiz-timetable" }, null, 2);
  },

  async signedIn() {
    await connect();
  },

  async signOut() {
    clearTimeout(pushTimer);
    if (state.user) await push();
    await fetch("/api/auth/user", { method: "DELETE" }).catch(() => {});
    lastPushed = "";
    patch({ user: null, status: "local", lastSyncedAt: null });
  },

  syncNow() {
    return pull();
  },

  /** push pending changes now (e.g. right before creating a share link) */
  async flush() {
    if (!state.user) return;
    clearTimeout(pushTimer);
    await push();
  },
};
