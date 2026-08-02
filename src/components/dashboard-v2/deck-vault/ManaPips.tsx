"use client";

import { useState } from "react";
import type { ManaColor } from "@/lib/deck-vault/types";

export function ManaPips({
  colors,
  size = "md",
}: {
  colors: ManaColor[];
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((color) => (
        <ManaSymbol
          key={color}
          color={color}
          size={size}
        />
      ))}
    </div>
  );
}

function ManaSymbol({
  color,
  size,
}: {
  color: ManaColor;
  size: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);

  const wrapperSize = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  }[size];

  const fallbackSize = {
    sm: "text-[11px]",
    md: "text-[13px]",
    lg: "text-[15px]",
  }[size];

  return (
    <span
      title={`${name(color)} mana`}
      className={[
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-slate-950 shadow-[0_2px_8px_rgba(0,0,0,0.38)]",
        wrapperSize,
      ].join(" ")}
    >
      {!failed ? (
        <img
          src={`/mana/${color}.svg`}
          alt={`${name(color)} mana`}
          loading="eager"
          onError={() => setFailed(true)}
          className="h-[92%] w-[92%] object-contain"
        />
      ) : (
        <span
          className={[
            "font-black",
            fallbackSize,
            fallbackColor(color),
          ].join(" ")}
        >
          {color}
        </span>
      )}
    </span>
  );
}

function fallbackColor(color: ManaColor) {
  return {
    W: "text-amber-100",
    U: "text-sky-300",
    B: "text-stone-200",
    R: "text-rose-300",
    G: "text-emerald-300",
    C: "text-slate-300",
  }[color];
}

function name(color: ManaColor) {
  return {
    W: "White",
    U: "Blue",
    B: "Black",
    R: "Red",
    G: "Green",
    C: "Colorless",
  }[color];
}
