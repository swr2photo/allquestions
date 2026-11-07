"use client";

// Custom select (no native <select>): popover listbox on desktop, bottom sheet
// on phones. Keyboard: ↑ ↓ Home End Enter Esc + type-ahead / search box.

import { createPortal } from "react-dom";
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "./dialog";
import {
  measure,
  popoverStyle,
  useAnchorTracking,
  useIsClient,
  useIsDesktop,
  useOutsideDismiss,
  type AnchorRect,
} from "./popover";

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: ReactNode;
  /** plain text used for search/type-ahead when `label` is not a string */
  textValue?: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** right-aligned meta, e.g. counts */
  meta?: ReactNode;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps<T extends string | number> {
  value: T | null | undefined;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  /** accessible name + mobile sheet title */
  label: string;
  placeholder?: string;
  className?: string;
  /** sm = 36px (dense side panels), md = 40px */
  size?: "sm" | "md";
  searchable?: boolean;
  disabled?: boolean;
  /** leading icon inside the trigger */
  icon?: ReactNode;
  /** show the label above the value inside the trigger */
  showLabel?: boolean;
  align?: "start" | "end";
  minPopoverWidth?: number;
}

function optionText<T extends string | number>(o: SelectOption<T>): string {
  if (o.textValue) return o.textValue;
  if (typeof o.label === "string" || typeof o.label === "number") return String(o.label);
  return String(o.value);
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  label,
  placeholder = "เลือก…",
  className,
  size = "md",
  searchable,
  disabled,
  icon,
  showLabel,
  align = "start",
  minPopoverWidth = 220,
}: SelectProps<T>) {
  const isClient = useIsClient();
  const isDesktop = useIsDesktop();
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);

  const selected = options.find((o) => o.value === value);
  const canSearch = searchable ?? options.length > 10;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => optionText(o).toLowerCase().includes(q));
  }, [options, query]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setQuery("");
    if (refocus) requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);
  const dismiss = useCallback(() => close(false), [close]);

  useAnchorTracking(open && isDesktop, triggerRef, setRect);
  useOutsideDismiss(open && isDesktop, triggerRef, panelRef, dismiss);

  const scrollIntoView = (index: number) => {
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
    });
  };

  const openList = () => {
    if (disabled) return;
    if (triggerRef.current) setRect(measure(triggerRef.current));
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setActive(idx);
    setOpen(true);
    scrollIntoView(idx);
    // phones: never auto-focus the search box (it would pop the keyboard over the sheet)
    if (isDesktop) {
      requestAnimationFrame(() => {
        const input = panelRef.current?.querySelector<HTMLInputElement>("input");
        (input ?? listRef.current)?.focus({ preventScroll: true });
      });
    }
  };

  const commit = (o: SelectOption<T> | undefined) => {
    if (!o || o.disabled) return;
    onChange(o.value);
    close();
  };

  const move = (delta: number) => {
    if (!visible.length) return;
    let i = active;
    for (let n = 0; n < visible.length; n++) {
      i = (i + delta + visible.length) % visible.length;
      if (!visible[i].disabled) break;
    }
    setActive(i);
    scrollIntoView(i);
  };

  const onListKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        scrollIntoView(0);
        break;
      case "End":
        e.preventDefault();
        setActive(visible.length - 1);
        scrollIntoView(visible.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        commit(visible[active]);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (!canSearch && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          const now = performance.now();
          const ta = typeahead.current;
          ta.text = now - ta.at > 700 ? e.key : ta.text + e.key;
          ta.at = now;
          const i = visible.findIndex((o) => optionText(o).toLowerCase().startsWith(ta.text.toLowerCase()));
          if (i >= 0) {
            setActive(i);
            scrollIntoView(i);
          }
        }
    }
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  const listId = `${id}-list`;
  const h = size === "sm" ? "h-9 text-xs" : "h-10 text-sm";

  const list = (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      aria-label={label}
      tabIndex={-1}
      aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
      onKeyDown={onListKey}
      className={cn("overflow-y-auto overscroll-contain p-1 outline-none", isDesktop ? "max-h-[inherit]" : "pb-2")}
    >
      {visible.length === 0 && <li className="px-3 py-6 text-center text-xs text-gray-400">ไม่พบตัวเลือก</li>}
      {visible.map((o, i) => {
        const isSel = o.value === value;
        const showGroup = o.group && (i === 0 || visible[i - 1].group !== o.group);
        return (
          <li key={`${String(o.value)}-${i}`} role="presentation">
            {showGroup && (
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">{o.group}</p>
            )}
            <div
              id={`${id}-opt-${i}`}
              role="option"
              data-index={i}
              aria-selected={isSel}
              aria-disabled={o.disabled || undefined}
              onPointerMove={() => active !== i && setActive(i)}
              onClick={() => commit(o)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 transition-colors select-none",
                isDesktop ? "min-h-9 py-1.5 text-[13px]" : "min-h-12 py-2 text-[15px]",
                i === active && !o.disabled && "bg-emerald-50",
                isSel ? "font-semibold text-emerald-800" : "text-gray-700",
                o.disabled && "cursor-not-allowed opacity-40"
              )}
            >
              {o.icon && <span className="flex shrink-0 items-center text-gray-500">{o.icon}</span>}
              <span className="min-w-0 flex-1">
                <span className="block leading-snug">{o.label}</span>
                {o.description && <span className="block text-[11px] leading-snug font-normal text-gray-400">{o.description}</span>}
              </span>
              {o.meta !== undefined && <span className="shrink-0 text-[11px] font-normal text-gray-400 tabular-nums">{o.meta}</span>}
              <Check className={cn("h-4 w-4 shrink-0 text-emerald-600", isSel ? "opacity-100" : "opacity-0")} />
            </div>
          </li>
        );
      })}
    </ul>
  );

  const searchBox = canSearch && (
    <div className={cn("border-b border-gray-100 p-2", !isDesktop && "px-0 pt-0")}>
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onListKey}
          placeholder="ค้นหา…"
          aria-controls={listId}
          className="h-10 w-full rounded-xl bg-gray-100 pr-3 pl-9 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
        />
      </label>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
        className={cn(
          "group flex w-full min-w-0 items-center gap-2 rounded-xl border bg-white px-3 text-left transition outline-none",
          "border-gray-200 hover:border-gray-300 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/25",
          open && "border-emerald-500 ring-2 ring-emerald-500/20",
          disabled && "cursor-not-allowed opacity-50",
          showLabel ? "h-auto py-1.5" : h,
          className
        )}
      >
        {icon && <span className="flex shrink-0 items-center text-gray-400">{icon}</span>}
        <span className="min-w-0 flex-1">
          {showLabel && <span className="block text-[10px] leading-tight font-medium text-gray-400">{label}</span>}
          <span className={cn("block truncate", selected ? "font-medium text-gray-900" : "text-gray-400", showLabel && "text-sm")}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:text-gray-600" />
      </button>

      {isClient && open && isDesktop && rect &&
        createPortal(
          <div
            ref={panelRef}
            style={popoverStyle(rect, { minWidth: minPopoverWidth, maxWidth: 420, align })}
            className="ui-pop z-[70] flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl ring-1 ring-black/5"
          >
            {searchBox}
            {list}
          </div>,
          document.body
        )}

      {!isDesktop && (
        <Dialog open={open} onClose={() => close()} title={label} size="md" bodyClassName="px-3 pb-3" initialFocus={listRef}>
          <div ref={panelRef}>
            {searchBox}
            {list}
          </div>
        </Dialog>
      )}
    </>
  );
}
