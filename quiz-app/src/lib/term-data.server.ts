// Server-only loader for the static timetable JSON under /public/timetable.
// Reads from disk when available (dev / node server) and falls back to fetching
// the deployed static asset from our own origin (serverless platforms don't
// ship /public inside the function bundle).

import fs from "node:fs/promises";
import path from "node:path";
import type { CurriculaIndex, CurriculumFile, TermData, TermIndex } from "./timetable";

const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; data: Promise<unknown> }>();

async function readPublicJson<T>(rel: string, origin?: string): Promise<T> {
  const clean = rel.replace(/^\/+/, "");
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", clean), "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if (!origin) throw err;
    const res = await fetch(new URL(`/${clean}`, origin), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} for /${clean}`);
    return (await res.json()) as T;
  }
}

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as Promise<T>;
  const data = load();
  cache.set(key, { at: Date.now(), data });
  data.catch(() => cache.delete(key));
  return data;
}

export function loadTermIndex(origin?: string) {
  return cached("index", () => readPublicJson<TermIndex>("timetable/index.json", origin));
}

export async function loadTermData(origin?: string, termId?: string | null): Promise<TermData | null> {
  const index = await loadTermIndex(origin);
  const entry = index.terms.find((t) => t.id === termId) ?? index.terms[0];
  if (!entry) return null;
  return cached(`term:${entry.id}`, () => readPublicJson<TermData>(entry.file, origin));
}

export async function loadCurriculaIndex(origin?: string): Promise<CurriculaIndex> {
  try {
    return await cached("curricula", () => readPublicJson<CurriculaIndex>("timetable/curricula/index.json", origin));
  } catch {
    return { faculties: [] };
  }
}

export function loadCurriculumFile(file: string, origin?: string) {
  return cached(`curriculum:${file}`, () => readPublicJson<CurriculumFile>(file, origin));
}
