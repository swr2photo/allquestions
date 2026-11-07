"use client";

// Loads gened.psu.ac.th course categories once per session (memory + sessionStorage)
// and exposes the GE lookup index used to classify SIS courses.

import { useEffect, useSyncExternalStore } from "react";
import { buildGeIndex, type GeIndex, type GenedLite } from "@/lib/ge";

const SESSION_KEY = "gened-index:v2";
const TTL_MS = 6 * 60 * 60 * 1000;

interface State {
  courses: GenedLite[];
  index: GeIndex | null;
  loading: boolean;
  error: string | null;
}

const SERVER: State = { courses: [], index: null, loading: true, error: null };
let state: State = SERVER;
let started = false;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function slim(raw: GenedLite[]): GenedLite[] {
  return raw.map(({ id, title, slug, link, code, geLevels, campuses, ge8Groups, sdgs }) => ({
    id,
    title,
    slug,
    link,
    code,
    geLevels,
    campuses,
    ge8Groups,
    sdgs,
  }));
}

function load() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    const cached = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") as { at: number; courses: GenedLite[] } | null;
    if (cached && Date.now() - cached.at < TTL_MS && Array.isArray(cached.courses)) {
      set({ courses: cached.courses, index: buildGeIndex(cached.courses), loading: false, error: null });
      return;
    }
  } catch {
    /* ignore */
  }
  fetch("/api/gened/courses")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((json: { courses: GenedLite[] }) => {
      const courses = slim(json.courses ?? []);
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now(), courses }));
      } catch {
        /* ignore */
      }
      set({ courses, index: buildGeIndex(courses), loading: false, error: null });
    })
    .catch(() => {
      // SIS code suffixes (…G1–G8) still classify most GE courses without the index
      set({ courses: [], index: null, loading: false, error: "โหลดข้อมูลหมวด GE จาก gened.psu.ac.th ไม่สำเร็จ" });
      started = false;
    });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useGenedIndex(): State {
  useEffect(load, []);
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}
