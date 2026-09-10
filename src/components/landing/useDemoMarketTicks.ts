"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { advanceDemoFeed, createDemoMarketCards, startDemoTickLoop } from "@/lib/market-preview";
import type { ArtworkGame } from "@/lib/card-artwork/providers";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

// The caller keys its feed by game, giving each game a deterministic opening snapshot.
export function useDemoMarketTicks(game: ArtworkGame, regionRef: RefObject<HTMLDivElement | null>, paused: boolean) {
  const [feed, setFeed] = useState(() => ({ cards: createDemoMarketCards(game), tick: 0 }));
  const [inView, setInView] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia(motionQuery).matches, () => true);
  const documentVisible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => false);
  const running = inView && documentVisible && !reducedMotion && !paused;

  useEffect(() => {
    const node = regionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, [regionRef]);

  useEffect(() => startDemoTickLoop(() => setFeed(advanceDemoFeed), running), [running]);

  return { ...feed, reducedMotion, running };
}
