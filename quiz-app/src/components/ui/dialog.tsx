"use client";

// Custom modal: centered card on desktop, swipe-style bottom sheet on phones.
// Replaces every native/ad-hoc popup in the app (confirm, prompt, detail views).

import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusables, lockBodyScroll, unlockBodyScroll, useIsClient } from "./popover";

const stack: string[] = [];

/** Keep content mounted for the exit animation. */
export function usePresence(open: boolean, ms = 170) {
  const [render, setRender] = useState(open);
  const [prev, setPrev] = useState(open);
  if (open !== prev) {
    setPrev(open);
    if (open) setRender(true);
  }
  useEffect(() => {
    if (open || !render) return;
    const t = setTimeout(() => setRender(false), ms);
    return () => clearTimeout(t);
  }, [open, render, ms]);
  return { render, state: open ? "open" : "closed" } as const;
}

export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";

const SIZE: Record<DialogSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-6xl",
};

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** tailwind classes for the icon bubble, e.g. "bg-emerald-100 text-emerald-700" */
  iconClassName?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  className?: string;
  bodyClassName?: string;
  /** do not close on backdrop click (e.g. forms with unsaved input) */
  persistent?: boolean;
  hideClose?: boolean;
  /** element to focus first (defaults to first focusable in the body) */
  initialFocus?: React.RefObject<HTMLElement | null>;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  iconClassName,
  children,
  footer,
  size = "md",
  className,
  bodyClassName,
  persistent,
  hideClose,
  initialFocus,
}: DialogProps) {
  const isClient = useIsClient();
  const { render, state } = usePresence(open);
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  // stack + scroll lock + focus restore
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    stack.push(id);
    lockBodyScroll();
    const t = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = initialFocus?.current ?? panel.querySelector<HTMLElement>("[data-autofocus]") ?? null;
      (target ?? panel).focus({ preventScroll: true });
    }, 30);
    return () => {
      clearTimeout(t);
      const i = stack.lastIndexOf(id);
      if (i >= 0) stack.splice(i, 1);
      unlockBodyScroll();
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open, id, initialFocus]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (stack[stack.length - 1] !== id) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, id, onClose]);

  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = focusables(panelRef.current);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!isClient || !render) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] print:hidden" data-state={state}>
      <div
        className="ui-backdrop absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        data-state={state}
        aria-hidden
      />
      <div
        className="absolute inset-0 flex items-end justify-center sm:items-center sm:p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !persistent) onClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          data-state={state}
          onKeyDown={trapTab}
          className={cn(
            "ui-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl ring-1 ring-black/5 outline-none sm:max-h-[88vh] sm:rounded-2xl",
            SIZE[size],
            className
          )}
        >
          {/* grab handle (phones) */}
          <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
            <span className="h-1.5 w-10 rounded-full bg-gray-200" />
          </div>
          {(title || !hideClose) && (
            <div className="flex items-start gap-3 px-5 pt-3 pb-3 sm:pt-5">
              {icon && (
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700",
                    iconClassName
                  )}
                >
                  {icon}
                </div>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                {title && (
                  <h2 id={titleId} className="text-base leading-snug font-semibold text-gray-900">
                    {title}
                  </h2>
                )}
                {description && (
                  <div id={descId} className="mt-1 text-sm leading-relaxed text-gray-500">
                    {description}
                  </div>
                )}
              </div>
              {!hideClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="-mt-1 -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label="ปิด"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
          <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5", bodyClassName)}>{children}</div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Button styles shared by dialogs/footers so every popup looks the same. */
export const dialogButton = {
  primary:
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:h-10",
  danger:
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:h-10",
  warning:
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:h-10",
  secondary:
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:h-10",
};
