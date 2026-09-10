"use client";

import { useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import { showcaseImageCandidates, type ShowcaseImageCard } from "@/lib/showcase-image";

export function ShowcaseCardImage({ card, alt }: { card: ShowcaseImageCard; alt: string }) {
  const candidates = useMemo(() => showcaseImageCandidates(card), [card]);
  const [index, setIndex] = useState(0);
  const source = candidates[index];
  if (!source) return <div className="flex h-full w-full items-center justify-center bg-[#0d202b] px-4 text-center text-white/35"><span className="flex flex-col items-center gap-2 text-xs"><ImageOff className="h-5 w-5" /> Image unavailable</span></div>;
  return <div className="relative h-full w-full bg-[#0d202b]"><div className="absolute inset-0 animate-pulse bg-white/[.05]" aria-hidden="true" /><img src={source} alt={alt} loading="lazy" decoding="async" className="relative h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]" onLoad={(event) => { event.currentTarget.previousElementSibling?.classList.add("hidden"); }} onError={() => setIndex((current) => current + 1)} /></div>;
}
