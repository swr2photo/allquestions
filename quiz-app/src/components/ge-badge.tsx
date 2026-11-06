import { Brain, Calculator, Cpu, HandHeart, HeartPulse, Languages, Leaf, Network, Palette, Rocket, type LucideIcon } from "lucide-react";
import { GE_META, type GeKey } from "@/lib/ge";
import { cn } from "@/lib/utils";

export const GE_ICON: Record<GeKey, LucideIcon> = {
  GE1: Languages,
  GE2: Brain,
  GE2A: Calculator,
  GE2B: Network,
  GE3: Rocket,
  GE4: Cpu,
  GE5: HeartPulse,
  GE6: HandHeart,
  GE7: Leaf,
  GE8: Palette,
};

/** Compact GE chip — always shows the GE code as text, colour is only a secondary cue. */
export function GeBadge({
  ge,
  withName,
  className,
  size = "sm",
}: {
  ge: GeKey;
  withName?: boolean;
  className?: string;
  size?: "xs" | "sm";
}) {
  const meta = GE_META[ge];
  const Icon = GE_ICON[ge];
  return (
    <span
      title={`${ge} ${meta.name}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ring-1 ring-inset",
        size === "xs" ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]",
        meta.chip,
        className
      )}
    >
      <Icon className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
      {ge}
      {withName && <span className="font-medium opacity-80">{meta.short}</span>}
    </span>
  );
}

export function GeIcon({ ge, className }: { ge: GeKey; className?: string }) {
  const Icon = GE_ICON[ge];
  return <Icon className={className} aria-hidden />;
}
