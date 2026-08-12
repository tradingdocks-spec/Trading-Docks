"use client";

import { getGameContextOptions, type GameContextId } from "@/lib/multi-tcg";
import { cn } from "@/lib/utils";

export function GameContextControl({
  value,
  onChange,
  includeAll = true,
  ariaLabel = "Game context",
}: {
  value: GameContextId;
  onChange: (value: GameContextId) => void;
  includeAll?: boolean;
  ariaLabel?: string;
}) {
  const options = getGameContextOptions({ includeAll });

  return (
    <div
      className="inline-flex max-w-full overflow-x-auto rounded-[18px] border border-white/[0.08] bg-black/20 p-1"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-[14px] px-3 text-[10px] font-black uppercase tracking-[0.08em] outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300/70",
              selected
                ? "bg-cyan-300 text-[#031319] shadow-[0_10px_30px_rgba(34,211,238,0.14)]"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200",
            )}
          >
            <span>{option.shortLabel}</span>
            {option.status === "beta" ? (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[8px] tracking-[0.08em]",
                selected ? "bg-[#031319]/10 text-[#031319]" : "bg-white/[0.06] text-cyan-200",
              )}>
                Beta
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
