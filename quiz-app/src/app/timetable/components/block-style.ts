"use client";

// Look of the course blocks on the week grid / agenda — shared so both views match.
// The choice is a per-browser convenience, kept in localStorage.

import { useSyncExternalStore, type CSSProperties } from "react";
import type { PALETTE } from "@/lib/timetable";

export type BlockStyle = "soft" | "vivid" | "outline";

export const BLOCK_STYLES: { value: BlockStyle; label: string }[] = [
  { value: "soft", label: "ละมุน" },
  { value: "vivid", label: "สีสด" },
  { value: "outline", label: "เส้นขอบ" },
];

const KEY = "psu-timetable:block-style:v1";
const listeners = new Set<() => void>();

function read(): BlockStyle {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "soft" || v === "vivid" || v === "outline") return v;
  } catch {
    /* private mode */
  }
  return "soft";
}

export function useBlockStyle(): [BlockStyle, (s: BlockStyle) => void] {
  const style = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "soft" as BlockStyle
  );
  const set = (s: BlockStyle) => {
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  };
  return [style, set];
}

type Color = (typeof PALETTE)[number];

const CLASH_STRIPES = "repeating-linear-gradient(135deg, rgba(220,38,38,0.13) 0 6px, transparent 6px 12px)";

/** inline styles for one block; colours come from PALETTE so every view stays consistent */
export function blockLook(style: BlockStyle, c: Color, clash: boolean): { box: CSSProperties; accent: string; text: string; sub: string } {
  if (style === "vivid") {
    const base = `linear-gradient(140deg, ${c.border} 0%, color-mix(in oklab, ${c.border} 72%, black) 100%)`;
    return {
      box: {
        background: clash ? `${CLASH_STRIPES}, ${base}` : `linear-gradient(180deg, rgba(255,255,255,0.18), transparent 55%), ${base}`,
        color: "#fff",
        boxShadow: `0 6px 16px -8px ${c.border}, inset 0 1px 0 rgba(255,255,255,0.25)`,
        border: clash ? "2px solid #dc2626" : "1px solid rgba(255,255,255,0.12)",
      },
      accent: "rgba(255,255,255,0.75)",
      text: "#fff",
      sub: "rgba(255,255,255,0.85)",
    };
  }
  if (style === "outline") {
    return {
      box: {
        background: clash ? `${CLASH_STRIPES}, #fff` : "#fff",
        color: c.text,
        border: `2px solid ${clash ? "#dc2626" : c.border}`,
        boxShadow: `0 3px 0 -1px color-mix(in oklab, ${c.border} 35%, transparent)`,
      },
      accent: c.border,
      text: c.text,
      sub: "#4b5563",
    };
  }
  const base = `linear-gradient(140deg, ${c.bg} 0%, color-mix(in oklab, ${c.bg} 55%, white) 100%)`;
  return {
    box: {
      background: clash ? `${CLASH_STRIPES}, ${base}` : base,
      color: c.text,
      border: `1px solid ${clash ? "#dc2626" : `color-mix(in oklab, ${c.border} 28%, transparent)`}`,
      boxShadow: `0 1px 2px rgba(15,23,42,0.05), 0 6px 14px -10px ${c.border}`,
    },
    accent: clash ? "#dc2626" : c.border,
    text: c.text,
    sub: `color-mix(in oklab, ${c.text} 80%, transparent)`,
  };
}
