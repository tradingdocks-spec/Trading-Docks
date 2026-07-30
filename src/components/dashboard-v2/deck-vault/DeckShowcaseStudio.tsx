"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Download, Share2, Sparkles, X } from "lucide-react";

import type { DeckCard, DeckFormat } from "@/lib/deck-vault/types";

type ShowcaseTheme = "harbor" | "midnight" | "color";
type ShowcaseSize = "portrait" | "square" | "story";

type ShowcaseGroup = {
  name: string;
  cards: DeckCard[];
  count: number;
};

const groupOrder = [
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Battle",
  "Land",
  "Sideboard",
  "Other",
];

const themeTokens = {
  harbor: {
    accent: "#55e7f3",
    accentSoft: "#153a47",
    background: "#020a10",
    surface: "#071823",
    surfaceStrong: "#0a202c",
    preview: "from-[#0b3444] via-[#04141f] to-[#02070b]",
  },
  midnight: {
    accent: "#a78bfa",
    accentSoft: "#29234a",
    background: "#04050d",
    surface: "#101329",
    surfaceStrong: "#171b37",
    preview: "from-[#222750] via-[#090b1b] to-[#03040a]",
  },
  color: {
    accent: "#5ee6a8",
    accentSoft: "#173d31",
    background: "#020b07",
    surface: "#092119",
    surfaceStrong: "#0e2e23",
    preview: "from-[#174633] via-[#071b12] to-[#020905]",
  },
} satisfies Record<ShowcaseTheme, Record<string, string>>;

function cardGroup(card: DeckCard) {
  if (card.board === "sideboard") return "Sideboard";
  const typeLine = card.typeLine.toLowerCase();
  return (
    groupOrder.find(
      (type) =>
        type !== "Sideboard" &&
        type !== "Other" &&
        typeLine.includes(type.toLowerCase()),
    ) ?? "Other"
  );
}

function buildGroups(cards: DeckCard[]): ShowcaseGroup[] {
  const grouped = new Map<string, DeckCard[]>();
  cards
    .filter((card) => card.board !== "commander" && card.category !== "Commander")
    .forEach((card) => {
      const name = cardGroup(card);
      grouped.set(name, [...(grouped.get(name) ?? []), card]);
    });

  return groupOrder
    .filter((name) => grouped.has(name))
    .map((name) => {
      const groupCards = grouped.get(name) ?? [];
      return {
        name,
        cards: groupCards,
        count: groupCards.reduce((sum, card) => sum + card.quantity, 0),
      };
    });
}

function distributeGroups(groups: ShowcaseGroup[], columnCount: number) {
  const columns = Array.from({ length: columnCount }, () => ({
    weight: 0,
    groups: [] as ShowcaseGroup[],
  }));
  groups.forEach((group) => {
    const target = columns.reduce((best, column) =>
      column.weight < best.weight ? column : best,
    );
    target.groups.push(group);
    target.weight += 42 + group.cards.length * 45;
  });
  return columns;
}

export function DeckShowcaseStudio({
  deckName,
  commanderName,
  format,
  cards,
  marketValue,
  onClose,
}: {
  deckName: string;
  commanderName: string;
  format: DeckFormat;
  cards: DeckCard[];
  marketValue: number;
  onClose: () => void;
}) {
  const [theme, setTheme] = useState<ShowcaseTheme>("harbor");
  const [size, setSize] = useState<ShowcaseSize>("portrait");
  const [showValue, setShowValue] = useState(false);
  const [showLink, setShowLink] = useState(true);
  const [exporting, setExporting] = useState(false);
  const commander =
    cards.find((card) => card.board === "commander" || card.category === "Commander") ??
    cards[0];
  const groups = useMemo(() => buildGroups(cards), [cards]);
  const previewColumns = useMemo(
    () => distributeGroups(groups, size === "story" ? 2 : 3),
    [groups, size],
  );
  const cardCount = cards.reduce((total, card) => total + card.quantity, 0);
  const uniqueCount = cards.reduce((total, card) => total + (card.quantity > 0 ? 1 : 0), 0);
  const publicUrl =
    typeof window === "undefined" ? "tradingdocks.com/decks" : window.location.href;
  const tokens = themeTokens[theme];

  async function loadCanvasImage(src: string) {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function exportShowcase() {
    setExporting(true);
    try {
      const dimensions = {
        portrait: [1080, 1350],
        square: [1080, 1080],
        story: [1080, 1920],
      }[size];
      const canvas = document.createElement("canvas");
      canvas.width = dimensions[0];
      canvas.height = dimensions[1];
      const context = canvas.getContext("2d");
      if (!context) return;

      const width = canvas.width;
      const height = canvas.height;
      const edge = 56;
      const footerHeight = 78;
      const headerHeight = size === "story" ? 330 : 270;
      const boardTop = headerHeight + 32;
      const boardBottom = height - footerHeight - 26;

      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, tokens.surfaceStrong);
      gradient.addColorStop(0.38, tokens.background);
      gradient.addColorStop(1, "#010306");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      const glow = context.createRadialGradient(180, 120, 20, 180, 120, 560);
      glow.addColorStop(0, `${tokens.accent}30`);
      glow.addColorStop(1, `${tokens.accent}00`);
      context.fillStyle = glow;
      context.fillRect(0, 0, width, 650);

      context.globalAlpha = 0.08;
      context.strokeStyle = tokens.accent;
      context.lineWidth = 1;
      for (let x = -height; x < width; x += 92) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + height, height);
        context.stroke();
      }
      context.globalAlpha = 1;

      const commanderImage = commander
        ? commander.image ||
          `/api/deck-vault/card-image?name=${encodeURIComponent(commander.name)}`
        : "";
      const commanderWidth = size === "story" ? 170 : 142;
      const commanderHeight = Math.round(commanderWidth * 1.4);
      if (commanderImage) {
        try {
          const image = await loadCanvasImage(commanderImage);
          drawRoundedImage(context, image, edge, 42, commanderWidth, commanderHeight, 16);
          context.strokeStyle = tokens.accent;
          context.lineWidth = 3;
          roundedRect(context, edge, 42, commanderWidth, commanderHeight, 16);
          context.stroke();
        } catch {
          context.fillStyle = tokens.surfaceStrong;
          roundedRect(context, edge, 42, commanderWidth, commanderHeight, 16);
          context.fill();
        }
      }

      const titleX = edge + commanderWidth + 34;
      context.fillStyle = tokens.accent;
      context.font = "800 18px Arial";
      context.fillText("TRADING DOCKS  /  DECK VAULT", titleX, 66);
      context.fillStyle = "#ffffff";
      context.font = "800 49px Arial";
      wrapCanvasText(
        context,
        deckName || "Untitled Deck",
        titleX,
        124,
        width - titleX - edge,
        54,
        2,
      );
      context.fillStyle = "#a8b7c5";
      context.font = "600 20px Arial";
      context.fillText(
        `COMMANDER  •  ${commanderName || commander?.name || "Not selected"}`,
        titleX,
        size === "story" ? 252 : 224,
      );

      const statY = size === "story" ? 282 : 252;
      context.fillStyle = "rgba(255,255,255,.055)";
      roundedRect(context, titleX, statY, width - titleX - edge, 50, 14);
      context.fill();
      context.fillStyle = "#e6f1f7";
      context.font = "700 17px Arial";
      context.fillText(
        `${String(format).toUpperCase()}   •   ${cardCount} CARDS   •   ${uniqueCount} UNIQUE${
          showValue ? `   •   $${marketValue.toFixed(2)}` : ""
        }`,
        titleX + 18,
        statY + 31,
      );

      const columnCount = size === "story" ? 2 : 3;
      const gap = 18;
      const columnWidth = (width - edge * 2 - gap * (columnCount - 1)) / columnCount;
      const availableHeight = boardBottom - boardTop;
      const columns = distributeGroups(groups, columnCount);
      const maxWeight = Math.max(...columns.map((column) => column.weight), 1);
      const rowHeight = Math.min(52, Math.max(29, (availableHeight - 32) / maxWeight * 45));
      const headingHeight = Math.max(34, rowHeight * 0.86);

      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        const column = columns[columnIndex];
        const x = edge + columnIndex * (columnWidth + gap);
        let y = boardTop;
        for (const group of column.groups) {
          const moduleHeight = headingHeight + group.cards.length * rowHeight + 10;
          context.fillStyle = "rgba(6,20,30,.92)";
          roundedRect(context, x, y, columnWidth, moduleHeight, 17);
          context.fill();
          context.strokeStyle = "rgba(255,255,255,.08)";
          context.lineWidth = 1;
          roundedRect(context, x, y, columnWidth, moduleHeight, 17);
          context.stroke();

          context.fillStyle = tokens.accent;
          context.font = "800 14px Arial";
          context.fillText(group.name.toUpperCase(), x + 14, y + headingHeight * 0.66);
          context.fillStyle = "#8da0af";
          context.textAlign = "right";
          context.fillText(String(group.count), x + columnWidth - 14, y + headingHeight * 0.66);
          context.textAlign = "left";

          for (let index = 0; index < group.cards.length; index += 1) {
            const card = group.cards[index];
            const rowY = y + headingHeight + index * rowHeight;
            const thumbWidth = Math.min(62, rowHeight * 1.55);
            try {
              const image = await loadCanvasImage(
                card.artCrop ||
                  card.image ||
                  `/api/deck-vault/card-image?name=${encodeURIComponent(card.name)}`,
              );
              drawRoundedImage(context, image, x + 7, rowY + 4, thumbWidth, rowHeight - 8, 7);
            } catch {
              context.fillStyle = tokens.accentSoft;
              roundedRect(context, x + 7, rowY + 4, thumbWidth, rowHeight - 8, 7);
              context.fill();
            }
            context.fillStyle = index % 2 === 0 ? "rgba(255,255,255,.025)" : "transparent";
            context.fillRect(x + thumbWidth + 13, rowY, columnWidth - thumbWidth - 20, rowHeight);
            context.fillStyle = "#f4f8fb";
            context.font = `700 ${Math.max(11, Math.min(15, rowHeight * 0.29))}px Arial`;
            const nameX = x + thumbWidth + 20;
            const quantityWidth = card.quantity > 1 ? 34 : 0;
            fillTruncatedText(
              context,
              card.name,
              nameX,
              rowY + rowHeight * 0.59,
              x + columnWidth - nameX - 12 - quantityWidth,
            );
            if (card.quantity > 1) {
              context.fillStyle = tokens.accent;
              context.textAlign = "right";
              context.font = `800 ${Math.max(11, Math.min(14, rowHeight * 0.28))}px Arial`;
              context.fillText(`×${card.quantity}`, x + columnWidth - 12, rowY + rowHeight * 0.59);
              context.textAlign = "left";
            }
          }
          y += moduleHeight + 12;
        }
      }

      context.fillStyle = "rgba(255,255,255,.09)";
      context.fillRect(edge, height - footerHeight, width - edge * 2, 1);
      context.fillStyle = "#ffffff";
      context.font = "800 16px Arial";
      context.fillText("CRAFTED ON TRADING DOCKS", edge, height - 35);
      context.fillStyle = tokens.accent;
      context.textAlign = "right";
      context.font = "700 15px Arial";
      context.fillText(
        showLink ? publicUrl.replace(/^https?:\/\//, "").slice(0, 72) : "TRADINGDOCKS.COM",
        width - edge,
        height - 35,
      );
      context.textAlign = "left";

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1),
      );
      if (!blob) return;
      const fileName = `${(deckName || "trading-docks-deck")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-deck-story.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${deckName} — Trading Docks Deck Vault`,
          text: `Check out my ${format} deck crafted on Trading Docks.`,
          files: [file],
        });
      } else {
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(href);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#01070c]/95 p-3 backdrop-blur-xl sm:p-5">
      <div className="mx-auto flex min-h-full max-w-[1540px] items-center justify-center">
        <section className="w-full overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[#06131f] shadow-[0_30px_120px_rgba(0,0,0,.7)]">
          <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-7 sm:py-5">
            <div>
              <div className="flex items-center gap-2 text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]">
                  Deck Story Studio
                </p>
              </div>
              <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
                Make your deck worth sharing
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close showcase"
              onClick={onClose}
              className="rounded-xl border border-white/10 p-2.5 text-slate-400 transition hover:border-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="border-b border-white/[0.07] p-5 lg:border-b-0 lg:border-r">
              <ShowcaseControl title="Where are you sharing?">
                {([
                  ["portrait", "Facebook / Feed"],
                  ["square", "Square"],
                  ["story", "Story"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSize(value)}
                    className={`rounded-xl border px-3 py-2 text-[11px] font-semibold transition ${
                      size === value
                        ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                        : "border-white/[0.07] text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </ShowcaseControl>
              <ShowcaseControl title="Visual theme">
                {([
                  ["harbor", "Harbor"],
                  ["midnight", "Midnight"],
                  ["color", "Identity"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={`rounded-xl border px-3 py-2 text-[11px] font-semibold transition ${
                      theme === value
                        ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                        : "border-white/[0.07] text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </ShowcaseControl>
              <ShowcaseControl title="Include">
                <ShowcaseToggle label="Deck value" checked={showValue} onChange={setShowValue} />
                <ShowcaseToggle label="Shareable deck link" checked={showLink} onChange={setShowLink} />
              </ShowcaseControl>

              <div className="mt-7 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4">
                <p className="text-[11px] font-semibold text-cyan-100">Designed for social</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  Every card is included in a compact category module. Your commander and deck
                  identity stay readable in the Facebook feed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void exportShowcase()}
                disabled={exporting}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 text-[12px] font-black text-[#00121c] shadow-[0_10px_35px_rgba(34,211,238,.16)] transition hover:brightness-105 disabled:opacity-60"
              >
                {typeof navigator !== "undefined" && "share" in navigator ? (
                  <Share2 className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {exporting ? "Building your deck story…" : "Share or Download HD"}
              </button>
            </aside>

            <main className="flex min-h-[650px] items-center justify-center overflow-auto bg-[#02090e] p-4 sm:p-7">
              <div
                className={`relative w-full overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br ${tokens.preview} p-5 shadow-[0_24px_80px_rgba(0,0,0,.58)] sm:p-7 ${
                  size === "square"
                    ? "max-w-[720px] aspect-square"
                    : size === "story"
                      ? "max-w-[430px] aspect-[9/16]"
                      : "max-w-[690px] aspect-[4/5]"
                }`}
              >
                <div
                  className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg,transparent 0,transparent 32px,currentColor 33px,currentColor 34px)",
                    color: tokens.accent,
                  }}
                />
                <div className="relative flex h-full min-h-0 flex-col">
                  <div className="grid grid-cols-[22%_1fr] gap-4">
                    <img
                      loading="eager"
                      decoding="async"
                      src={
                        commander?.image ||
                        `/api/deck-vault/card-image?name=${encodeURIComponent(
                          commander?.name || commanderName,
                        )}`
                      }
                      alt=""
                      className="w-full rounded-lg border-2 object-cover shadow-[0_12px_40px_rgba(0,0,0,.5)]"
                      style={{ borderColor: `${tokens.accent}aa` }}
                    />
                    <div className="min-w-0">
                      <p
                        className="text-[7px] font-black uppercase tracking-[0.18em] sm:text-[9px]"
                        style={{ color: tokens.accent }}
                      >
                        Trading Docks / Deck Vault
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-[clamp(18px,4vw,36px)] font-black leading-[1.02] text-white">
                        {deckName || "Untitled Deck"}
                      </h3>
                      <p className="mt-2 truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-300 sm:text-[10px]">
                        {commanderName || commander?.name}
                      </p>
                      <p className="mt-1 text-[7px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:text-[9px]">
                        {format} · {cardCount} cards · {uniqueCount} unique{" "}
                        {showValue ? `· $${marketValue.toFixed(2)}` : ""}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`mt-4 grid min-h-0 flex-1 items-start gap-2.5 ${
                      size === "story" ? "grid-cols-2" : "grid-cols-3"
                    }`}
                  >
                    {previewColumns.map((column, columnIndex) => (
                      <div key={columnIndex} className="grid content-start gap-2.5">
                        {column.groups.map((group) => (
                          <PreviewGroup key={group.name} group={group} accent={tokens.accent} />
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
                    <p className="text-[6px] font-black uppercase tracking-[0.13em] text-white sm:text-[8px]">
                      Crafted on Trading Docks
                    </p>
                    <p
                      className="max-w-[55%] truncate text-right text-[6px] font-semibold sm:text-[8px]"
                      style={{ color: tokens.accent }}
                    >
                      {showLink ? publicUrl.replace(/^https?:\/\//, "") : "tradingdocks.com"}
                    </p>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </section>
      </div>
    </div>
  );
}

function PreviewGroup({ group, accent }: { group: ShowcaseGroup; accent: string }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-white/[0.09] bg-[#06141e]/95">
      <header className="flex items-center justify-between px-2 py-1.5">
        <p
          className="truncate text-[5px] font-black uppercase tracking-[0.11em] sm:text-[7px]"
          style={{ color: accent }}
        >
          {group.name}
        </p>
        <span className="ml-1 text-[5px] font-bold text-slate-500 sm:text-[7px]">
          {group.count}
        </span>
      </header>
      <div>
        {group.cards.map((card) => (
          <div
            key={card.id}
            className="grid grid-cols-[22%_1fr_auto] items-center gap-1 border-t border-white/[0.045] p-0.5 pr-1"
          >
            <img
              loading="lazy"
              decoding="async"
              src={
                card.artCrop ||
                card.image ||
                `/api/deck-vault/card-image?name=${encodeURIComponent(card.name)}`
              }
              alt=""
              className="aspect-[1.6] h-full w-full rounded-[3px] object-cover"
            />
            <p className="truncate text-[4px] font-semibold text-slate-100 sm:text-[6px]">
              {card.name}
            </p>
            {card.quantity > 1 ? (
              <span className="text-[4px] font-black sm:text-[6px]" style={{ color: accent }}>
                ×{card.quantity}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ShowcaseControl({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ShowcaseToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2.5 text-[11px] text-slate-300">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-cyan-300"
      />
    </label>
  );
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawRoundedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, x, y, width, height);
  context.restore();
}

function fillTruncatedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  if (context.measureText(text).width <= maxWidth) {
    context.fillText(text, x, y);
    return;
  }
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  context.fillText(`${shortened}…`, x, y);
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(" ");
  let line = "";
  let lineNumber = 0;
  for (const word of words) {
    const test = `${line}${word} `;
    if (context.measureText(test).width > maxWidth && line) {
      context.fillText(line.trim(), x, y + lineNumber * lineHeight);
      line = `${word} `;
      lineNumber += 1;
      if (lineNumber >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (lineNumber < maxLines) context.fillText(line.trim(), x, y + lineNumber * lineHeight);
}
