"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, ShieldCheck, X } from "lucide-react";
import { createPortal } from "react-dom";

import { cardImage, estimateCardEconomics } from "./scryfall";
import type { AppraisalCard, BuyingSettings } from "./types";

type PreviewState = {
  item: AppraisalCard;
  anchor: DOMRect;
} | null;

export function CardPreviewPortal({
  preview,
  settings,
  onClose,
}: {
  preview: PreviewState;
  settings: BuyingSettings;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const position = useMemo(() => {
    if (!preview || typeof window === "undefined") return null;

    const width = 430;
    const height = 354;
    const gap = 14;
    const roomRight = window.innerWidth - preview.anchor.right;
    const left =
      roomRight >= width + gap
        ? preview.anchor.right + gap
        : Math.max(12, preview.anchor.left - width - gap);

    const preferredTop = preview.anchor.top + preview.anchor.height / 2 - height / 2;
    const top = Math.min(
      Math.max(12, preferredTop),
      Math.max(12, window.innerHeight - height - 12),
    );

    return { left, top, width };
  }, [preview]);

  if (!mounted || !preview || !position || !preview.item.card) return null;

  const item = preview.item;
  const card = item.card;

  if (!card) {
    return null;
  }

  const economics = estimateCardEconomics(item, settings);
  const imageUrl =
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.normal ??
    cardImage(card);

  return createPortal(
    <div
      className="fixed z-[500] overflow-hidden rounded-[22px] border border-td-accent/[0.2] bg-td-surface/98 shadow-[0_30px_100px_rgb(var(--td-shadow-rgb)/calc(0.82*var(--td-shadow-strength)))] backdrop-blur-xl"
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
      }}
      role="dialog"
      aria-label={`Card preview for ${card.name}`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-td-ink/[0.08] bg-black/45 text-td-secondary hover:text-td-primary"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex gap-4 p-4">
        <img
          src={imageUrl}
          alt={card.name}
          className="h-[322px] w-[230px] shrink-0 rounded-xl object-contain shadow-2xl"
        />

        <div className="min-w-0 flex-1 py-1">
          <p className="pr-7 text-sm font-semibold text-td-primary">{card.name}</p>
          <p className="mt-1 text-[11px] leading-4 text-td-muted">
            {card.set_name}
          </p>
          <p className="text-[11px] text-td-muted">
            {card.set.toUpperCase()} #{card.collector_number}
          </p>

          <div className="mt-4 space-y-2 rounded-xl border border-td-ink/[0.06] bg-black/[0.14] p-3">
            <PreviewRow label="Market" value={currency(item.unitMarket)} />
            <PreviewRow
              label="Adjusted"
              value={currency(item.adjustedUnitValue)}
            />
            <PreviewRow
              label="Line offer"
              value={currency(economics.offer)}
              accent
            />
            <PreviewRow label="Condition" value={item.condition} />
            <PreviewRow label="Finish" value={capitalize(item.finish)} />
            <PreviewRow label="Rarity" value={capitalize(card.rarity)} />
            <PreviewRow
              label="EDHREC rank"
              value={
                card.edhrec_rank
                  ? `#${card.edhrec_rank.toLocaleString("en-US")}`
                  : "Unavailable"
              }
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.reserved ? (
              <span className="rounded-md border border-td-warning/[0.15] bg-td-warning/[0.05] px-2 py-1 text-[11px] text-td-warning">
                Reserved List
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-md border border-td-accent/[0.13] bg-td-accent/[0.04] px-2 py-1 text-[11px] text-td-accent-text">
              <ShieldCheck className="h-2.5 w-2.5" />
              Verify printing
            </span>
          </div>

          {card.purchase_uris?.tcgplayer ? (
            <a
              href={card.purchase_uris.tcgplayer}
              target="_blank"
              rel="noreferrer"
              className="pointer-events-auto mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-td-accent-text hover:text-td-accent-text"
            >
              View market listing
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PreviewRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="text-td-muted">{label}</span>
      <span
        className={
          accent
            ? "truncate font-semibold text-td-success"
            : "truncate font-semibold text-td-secondary"
        }
      >
        {value}
      </span>
    </div>
  );
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export type { PreviewState };
