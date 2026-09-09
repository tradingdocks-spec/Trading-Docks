"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";
import { GAME_TABS, artworkIssues, warnArtworkIssues, type MarketCard } from "@/lib/card-artwork/demo-market-artwork";

export function MarketCardArtwork({ card, variant }: { card: MarketCard; variant: "featured" | "thumbnail" }) {
  // An error belongs to a URL, not the mounted component; switching tabs can recover.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const featured = variant === "featured";
  const imageUrl = featured ? card.imageUrl : card.thumbnailUrl;
  const issues = artworkIssues(card, featured);
  warnArtworkIssues(issues);
  const usable = imageUrl && card.hasVerifiedArtwork && issues.length === 0 && imageUrl !== failedUrl;
  const game = GAME_TABS.find((tab) => tab.id === card.game)?.label ?? card.game;
  return (
    <div data-market-artwork={variant} data-artwork-state={usable ? "verified" : "paused"} className={`${featured ? "relative aspect-[5/7] w-[140px] max-w-full sm:w-[180px] lg:w-[210px]" : "relative aspect-[5/7] w-10 shrink-0"} overflow-hidden rounded-md bg-td-ink/[0.035]`}>
      {usable ? (
        <Image src={imageUrl} unoptimized={card.imageSource === "scryfall"} alt={`${card.name} — ${game} card artwork (${card.language})`} fill sizes={featured ? "(min-width: 1024px) 210px, (min-width: 640px) 180px, 140px" : "40px"} className="object-contain" onError={() => setFailedUrl(imageUrl)} />
      ) : (
        <div role="img" aria-label={`${card.name} — ${game}: preview temporarily paused`} className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-md border border-td-ink/10 bg-td-surface text-td-muted">
          <ImageOff aria-hidden="true" className={featured ? "h-7 w-7" : "h-4 w-4"} />
          {featured ? <span className="px-3 text-center text-xs leading-5">Preview paused</span> : null}
        </div>
      )}
    </div>
  );
}
