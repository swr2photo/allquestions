"use client";

// Low-level helpers shared by the custom Select / Menu / Dialog components.
// Positions are measured in event handlers (never during render) so the
// components stay compatible with the React Compiler lint rules.

import { useCallback, useEffect, useSyncExternalStore, type CSSProperties, type RefObject } from "react";

const noopSubscribe = () => () => {};

/** true only on the client after hydration — safe guard for portals. */
export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useMediaQuery(query: string, serverValue = false) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => serverValue);
}

/** sm breakpoint (640px) — below it popovers become bottom sheets */
export function useIsDesktop() {
  return useMediaQuery("(min-width: 640px)", true);
}

export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
  vw: number;
  vh: number;
}

export function measure(el: HTMLElement): AnchorRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, vw: window.innerWidth, vh: window.innerHeight };
}

export function popoverStyle(
  a: AnchorRect,
  opts: { minWidth?: number; maxWidth?: number; maxHeight?: number; align?: "start" | "end" } = {}
): CSSProperties {
  const gap = 6;
  const margin = 8;
  const width = Math.min(Math.max(a.width, opts.minWidth ?? 200), opts.maxWidth ?? 9999, a.vw - margin * 2);
  let left = opts.align === "end" ? a.left + a.width - width : a.left;
  left = Math.max(margin, Math.min(left, a.vw - width - margin));
  const below = a.vh - (a.top + a.height) - gap - margin;
  const above = a.top - gap - margin;
  const maxH = opts.maxHeight ?? 340;
  if (below >= Math.min(maxH, 220) || below >= above) {
    return { position: "fixed", left, top: a.top + a.height + gap, width, maxHeight: Math.max(120, Math.min(maxH, below)) };
  }
  return { position: "fixed", left, bottom: a.vh - a.top + gap, width, maxHeight: Math.max(120, Math.min(maxH, above)) };
}

/** Re-measure the anchor while open (scroll inside any container, resize). */
export function useAnchorTracking(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  onRect: (r: AnchorRect) => void
) {
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (anchorRef.current) onRect(measure(anchorRef.current));
      });
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, onRect]);
}

/** Close when pointer goes down outside both the trigger and the floating panel. */
export function useOutsideDismiss(
  open: boolean,
  a: RefObject<HTMLElement | null>,
  b: RefObject<HTMLElement | null>,
  onDismiss: () => void
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (a.current?.contains(t) || b.current?.contains(t)) return;
      onDismiss();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, a, b, onDismiss]);
}

let scrollLocks = 0;
export function lockBodyScroll() {
  if (scrollLocks++ === 0) document.documentElement.classList.add("ui-scroll-locked");
}
export function unlockBodyScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.documentElement.classList.remove("ui-scroll-locked");
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
}
