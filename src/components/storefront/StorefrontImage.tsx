"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import { showcaseImageCandidates, type ShowcaseImageCard } from "@/lib/showcase-image";
import styles from "./storefront.module.css";

export function StorefrontImage({ card, alt }: { card: ShowcaseImageCard; alt: string }) {
  const candidates = useMemo(() => showcaseImageCandidates(card), [card]);
  const [index, setIndex] = useState(0);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const source = candidates[index];
  return <div className={styles.image}>
    {source ? <>
      {loadedSource !== source ? <div className={styles.imageSkeleton} aria-hidden="true" /> : null}
      <Image key={source} src={source} alt={alt} fill unoptimized loading="lazy" decoding="async"
        sizes="(max-width: 599px) 45vw, (max-width: 1023px) 24vw, 200px"
        onLoad={() => setLoadedSource(source)} onError={() => setIndex((current) => current + 1)} />
    </> : <div className={styles.imageFallback}><ImageOff size={22} aria-hidden="true" /><span>Artwork unavailable</span><span>View card details</span></div>}
  </div>;
}
