"use client";

// Custom dropdown/action menu: popover on desktop, action sheet on phones.

import { createPortal } from "react-dom";
import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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

export interface MenuItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  /** draws a divider above this item */
  separator?: boolean;
}

export function Menu({
  trigger,
  items,
  label,
  align = "end",
  className,
}: {
  /** render the trigger; spread `props` onto a button */
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
  }) => ReactNode;
  items: MenuItem[];
  label: string;
  align?: "start" | "end";
  className?: string;
}) {
  const isClient = useIsClient();
  const isDesktop = useIsDesktop();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const [active, setActive] = useState(0);
  const shown = items.filter((i) => !i.hidden);

  const close = useCallback(() => setOpen(false), []);
  useAnchorTracking(open && isDesktop, triggerRef, setRect);
  useOutsideDismiss(open && isDesktop, triggerRef, panelRef, close);

  const openMenu = () => {
    if (triggerRef.current) setRect(measure(triggerRef.current));
    setActive(0);
    setOpen(true);
    if (isDesktop) requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
  };

  const pick = (item: MenuItem | undefined) => {
    if (!item || item.disabled) return;
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
    item.onSelect();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + shown.length) % shown.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") setOpen(false);
  };

  const list = (
    <div role="menu" aria-label={label} className="p-1">
      {shown.map((item, i) => (
        <div key={item.key}>
          {item.separator && <div className="mx-2 my-1 h-px bg-gray-100" role="separator" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onPointerMove={() => setActive(i)}
            onClick={() => pick(item)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 text-left transition-colors disabled:opacity-40",
              isDesktop ? "min-h-9 py-1.5 text-[13px]" : "min-h-12 py-2 text-[15px]",
              i === active && isDesktop && "bg-gray-100",
              item.danger ? "text-red-600" : "text-gray-700",
              !isDesktop && "active:bg-gray-100"
            )}
          >
            {item.icon && (
              <span className={cn("flex shrink-0 items-center [&>svg]:h-4 [&>svg]:w-4", item.danger ? "text-red-500" : "text-gray-500")}>
                {item.icon}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{item.label}</span>
              {item.description && <span className="block text-[11px] text-gray-400">{item.description}</span>}
            </span>
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {trigger({ ref: triggerRef, onClick: () => (open ? close() : openMenu()), "aria-haspopup": "menu", "aria-expanded": open })}
      {isClient &&
        open &&
        isDesktop &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            tabIndex={-1}
            onKeyDown={onKey}
            style={popoverStyle(rect, { minWidth: 230, maxWidth: 320, maxHeight: 420, align })}
            className={cn(
              "ui-pop z-[70] overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-xl ring-1 ring-black/5 outline-none",
              className
            )}
          >
            {list}
          </div>,
          document.body
        )}
      {!isDesktop && (
        <Dialog open={open} onClose={close} title={label} size="sm" bodyClassName="px-2 pb-3">
          <div ref={panelRef}>{list}</div>
        </Dialog>
      )}
    </>
  );
}
