"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Custom checkbox (no native input styling) with a large touch target. */
export function Checkbox({ checked, onChange, label, description, disabled, className, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={rest["aria-label"]}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group flex min-h-8 items-center gap-2.5 rounded-lg text-left text-xs text-gray-700 outline-none disabled:opacity-50",
        className
      )}
    >
      <span
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 transition-all group-focus-visible:ring-2 group-focus-visible:ring-emerald-500/40",
          checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300 bg-white group-hover:border-emerald-400"
        )}
      >
        <Check className={cn("h-3 w-3 transition-transform", checked ? "scale-100" : "scale-0")} strokeWidth={3.5} />
      </span>
      {(label || description) && (
        <span className="min-w-0 flex-1">
          {label && <span className="block leading-snug">{label}</span>}
          {description && <span className="block text-[11px] leading-snug text-gray-400">{description}</span>}
        </span>
      )}
    </button>
  );
}

/** iOS-style switch. */
export function Switch({ checked, onChange, label, description, disabled, className, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest["aria-label"]}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("group flex min-h-9 w-full items-center gap-3 text-left text-sm outline-none disabled:opacity-50", className)}
    >
      {(label || description) && (
        <span className="min-w-0 flex-1">
          {label && <span className="block leading-snug font-medium text-gray-800">{label}</span>}
          {description && <span className="block text-xs leading-snug text-gray-500">{description}</span>}
        </span>
      )}
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-emerald-500/40",
          checked ? "bg-emerald-600" : "bg-gray-300"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

/** Segmented control — replaces radio groups / small selects. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex rounded-xl bg-gray-100 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
