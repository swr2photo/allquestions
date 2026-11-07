"use client";

// Client side of live share links (see src/lib/timetable-share.ts).
// • Owners: create / list / revoke links — cached in a tiny module store so the
//   saved-schedules dialog can show which schedules are shared.
// • Viewers: useSharedTimetable(id) polls the link while the tab is visible and
//   picks up every save the owner makes.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ShareSource, ShareSummary, SharedTimetable } from "@/lib/timetable-share";

// ------------------------------------------------------------------ owner side

let myShares: ShareSummary[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setMyShares(s: ShareSummary[]) {
  myShares = s;
  emit();
}

async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { cache: "no-store", ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `HTTP ${res.status}`);
  return json as T;
}

export async function refreshMyShares(): Promise<ShareSummary[]> {
  const { shares } = await api<{ shares: ShareSummary[] }>("/api/timetable/share");
  setMyShares(shares);
  return shares;
}

export async function createShare(source: ShareSource, opts: { includeCustom: boolean; showName: boolean }) {
  const { id, shares } = await api<{ id: string; shares: ShareSummary[] }>("/api/timetable/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, ...opts }),
  });
  setMyShares(shares);
  return id;
}

export async function revokeShare(id: string) {
  const { shares } = await api<{ shares: ShareSummary[] }>(`/api/timetable/share?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  setMyShares(shares);
}

/** cached list of the user's share links; fetched on first use */
export function useMyShares(enabled = true): ShareSummary[] | null {
  const shares = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => myShares,
    () => null
  );
  useEffect(() => {
    if (enabled && myShares === null) refreshMyShares().catch(() => setMyShares([]));
  }, [enabled]);
  return shares;
}

export function isScheduleShared(shares: ShareSummary[] | null, scheduleId: string) {
  return !!shares?.some((s) => s.source.kind === "schedule" && s.source.scheduleId === scheduleId);
}

export function shareUrl(id: string, termId?: string) {
  const url = new URL("/timetable", window.location.origin);
  url.searchParams.set("share", id);
  if (termId) url.searchParams.set("term", termId);
  return url.toString();
}

// ------------------------------------------------------------------ viewer side

const POLL_MS = 12_000;

export type SharedStatus = "loading" | "live" | "gone" | "error";

export interface SharedState {
  status: SharedStatus;
  share: SharedTimetable | null;
  error?: string;
  /** when the owner's newer save arrived (for a highlight) */
  changedAt?: number;
  checkedAt?: number;
}

const INITIAL: SharedState = { status: "loading", share: null };

export function useSharedTimetable(
  id: string | null,
  onUpdate?: (share: SharedTimetable, first: boolean) => void
): SharedState & { refresh: () => void } {
  const [state, setState] = useState<SharedState>(INITIAL);
  const [forId, setForId] = useState(id);
  if (forId !== id) {
    setForId(id);
    setState(INITIAL);
  }
  const loadRef = useRef<() => void>(() => {});
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  useEffect(() => {
    if (!id) return;
    let stopped = false;
    let current: SharedTimetable | null = null;
    let inFlight = false;

    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const q = current ? `?since=${current.updatedAt}` : "";
        const res = await fetch(`/api/timetable/share/${encodeURIComponent(id)}${q}`, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as { share?: SharedTimetable; unchanged?: boolean; error?: string };
        if (stopped) return;
        if (res.status === 404 || res.status === 410) {
          setState((s) => ({ ...s, status: "gone", error: json.error }));
          return;
        }
        if (!res.ok || (!json.share && !json.unchanged)) throw new Error(json.error || `HTTP ${res.status}`);
        if (json.unchanged || !json.share) {
          setState((s) => ({ ...s, status: "live", error: undefined, checkedAt: Date.now() }));
          return;
        }
        const first = current === null;
        current = json.share;
        const share = json.share;
        setState((s) => ({
          status: "live",
          share,
          error: undefined,
          checkedAt: Date.now(),
          changedAt: first ? s.changedAt : Date.now(),
        }));
        onUpdateRef.current?.(share, first);
      } catch (e) {
        if (stopped) return;
        setState((s) => ({ ...s, status: s.share ? "live" : "error", error: e instanceof Error ? e.message : "โหลดไม่สำเร็จ" }));
      } finally {
        inFlight = false;
      }
    };

    loadRef.current = () => void load();
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [id]);

  return { ...(id ? state : INITIAL), refresh: () => loadRef.current() };
}
