"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Download, Share2, Sparkles, X } from "lucide-react";

import type { DeckCard, DeckFormat } from "@/lib/deck-vault/types";

type ShowcaseTheme = "color" | "harbor" | "midnight" | "paper";
type ShowcaseSize = "portrait" | "square" | "story";
type ShowcaseDisplay = "cards" | "text";
type ShowcaseGroup = { name: string; cards: DeckCard[]; count: number };

const groupOrder = [
  "Creature",
  "Planeswalker",
  "Artifact",
  "Enchantment",
  "Instant",
  "Sorcery",
  "Battle",
  "Land",
  "Sideboard",
  "Other",
];

const themes = {
  color: {
    accent: "#67e8f9",
    background: "#06131d",
    board: "#071b26",
    ink: "#f8fbfd",
    muted: "#b6c5ce",
    panel: "rgba(3,12,18,.78)",
    preview: "",
  },
  harbor: {
    accent: "#4ce8f4",
    background: "#03131d",
    board: "#071b26",
    ink: "#f8fbfd",
    muted: "#9fb2bf",
    panel: "#0a2632",
    preview: "from-[#0b3444] via-[#04141f] to-[#02070b]",
  },
  midnight: {
    accent: "#a78bfa",
    background: "#070817",
    board: "#10132a",
    ink: "#fbfaff",
    muted: "#aaa9c1",
    panel: "#181b37",
    preview: "from-[#252954] via-[#0b0c20] to-[#04050b]",
  },
  paper: {
    accent: "#0e7490",
    background: "#dce8ee",
    board: "#edf3f5",
    ink: "#101820",
    muted: "#4b5d68",
    panel: "#d4e1e7",
    preview: "from-[#c9dde7] via-[#eef4f6] to-[#d7e4e9]",
  },
} satisfies Record<ShowcaseTheme, Record<string, string>>;

const identityColor = {
  W: "#d8c797",
  U: "#168bd2",
  B: "#44304f",
  R: "#d74732",
  G: "#258c57",
  C: "#64748b",
} as const;

function deckIdentityGradient(colors: DeckCard["colors"]) {
  const gradientColors: DeckCard["colors"] = colors.length ? colors : ["C"];
  const unique = Array.from(new Set(gradientColors));
  const stops = unique.map((color, index) => {
    const position = unique.length === 1 ? 0 : Math.round((index / (unique.length - 1)) * 72);
    return `${identityColor[color]} ${position}%`;
  });
  return `linear-gradient(135deg, ${stops.join(", ")}, #020609 100%)`;
}

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

function buildGroups(cards: DeckCard[]) {
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

function groupWeight(group: ShowcaseGroup) {
  return group.cards.reduce((sum, card) => sum + 1 + Math.min(card.quantity - 1, 3) * 0.16, 0);
}

function distributeGroups(groups: ShowcaseGroup[], count: number) {
  const columns = Array.from({ length: count }, () => ({
    weight: 0,
    groups: [] as ShowcaseGroup[],
  }));
  [...groups]
    .sort((a, b) => groupWeight(b) - groupWeight(a))
    .forEach((group) => {
      const target = columns.reduce((best, column) =>
        column.weight < best.weight ? column : best,
      );
      target.groups.push(group);
      target.weight += groupWeight(group) + 1.1;
    });
  return columns;
}

function cardSource(card: DeckCard) {
  return (
    card.image ||
    `/api/deck-vault/card-image?name=${encodeURIComponent(card.name)}`
  );
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
  const isCommander = format === "EDH" || format === "Pauper EDH";
  const [theme, setTheme] = useState<ShowcaseTheme>("color");
  const [display, setDisplay] = useState<ShowcaseDisplay>(isCommander ? "text" : "cards");
  const [size, setSize] = useState<ShowcaseSize>("portrait");
  const [showValue, setShowValue] = useState(false);
  const [exporting, setExporting] = useState(false);
  const commander =
    cards.find((card) => card.board === "commander" || card.category === "Commander") ??
    cards[0];
  const groups = useMemo(() => buildGroups(cards), [cards]);
  const columnCount = size === "story" ? 4 : size === "square" ? 6 : 5;
  const columns = useMemo(
    () => distributeGroups(groups, columnCount),
    [groups, columnCount],
  );
  const cardCount = cards.reduce((total, card) => total + card.quantity, 0);
  const tokens = themes[theme];
  const identityColors = commander?.colors?.length
    ? commander.colors
    : Array.from(new Set(cards.flatMap((card) => card.colors)));
  const identityGradient = deckIdentityGradient(identityColors);

  async function loadImage(src: string) {
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
      const [width, height] = {
        portrait: [1600, 2000],
        square: [1800, 1800],
        story: [1440, 2560],
      }[size];
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;

      const edge = 54;
      const headerHeight = size === "story" ? 300 : 245;
      const footerHeight = 62;
      const gap = 16;
      const boardTop = headerHeight;
      const boardHeight = height - headerHeight - footerHeight;
      const gradient = context.createLinearGradient(0, 0, width, height);
      if (theme === "color") {
        const colors = identityColors.length ? identityColors : (["C"] as DeckCard["colors"]);
        colors.forEach((color, index) =>
          gradient.addColorStop(index / Math.max(1, colors.length), identityColor[color]),
        );
        gradient.addColorStop(1, "#010406");
      } else {
        gradient.addColorStop(0, tokens.panel);
        gradient.addColorStop(0.32, tokens.background);
        gradient.addColorStop(1, theme === "paper" ? "#cbdbe2" : "#010406");
      }
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      const commanderSrc = commander ? cardSource(commander) : "";
      const commanderWidth = size === "story" ? 160 : 126;
      const commanderHeight = commanderWidth * 1.395;
      if (commanderSrc) {
        try {
          const image = await loadImage(commanderSrc);
          drawRoundedImage(context, image, edge, 28, commanderWidth, commanderHeight, 14);
        } catch {
          context.fillStyle = tokens.panel;
          roundedRect(context, edge, 28, commanderWidth, commanderHeight, 14);
          context.fill();
        }
      }

      const titleX = edge + commanderWidth + 30;
      context.fillStyle = tokens.accent;
      context.font = "900 18px Arial";
      context.fillText("TRADING DOCKS  /  DECK CRAFT", titleX, 55);
      context.fillStyle = tokens.ink;
      context.font = `900 ${size === "story" ? 54 : 58}px Arial`;
      wrapCanvasText(context, deckName || "Untitled Deck", titleX, 112, width - titleX - 280, 58, 2);
      context.fillStyle = tokens.muted;
      context.font = "700 20px Arial";
      context.fillText(
        `${String(format).toUpperCase()}  •  ${commanderName || commander?.name || "Commander"}  •  ${cardCount} CARDS${
          showValue ? `  •  $${marketValue.toFixed(2)}` : ""
        }`,
        titleX,
        headerHeight - 42,
      );

      const histogramX = width - 245;
      const histogramBase = headerHeight - 48;
      const manaBins = [0, 1, 2, 3, 4, 5, 6].map(
        (value) =>
          cards.filter((card) => Math.min(6, Math.round(card.manaValue || 0)) === value)
            .reduce((sum, card) => sum + card.quantity, 0),
      );
      const maxBin = Math.max(...manaBins, 1);
      manaBins.forEach((amount, index) => {
        const barHeight = (amount / maxBin) * 70;
        context.fillStyle = tokens.accent;
        context.fillRect(histogramX + index * 28, histogramBase - barHeight, 20, barHeight);
        context.fillStyle = tokens.muted;
        context.font = "700 12px Arial";
        context.textAlign = "center";
        context.fillText(String(index === 6 ? "6+" : index), histogramX + index * 28 + 10, histogramBase + 18);
      });
      context.textAlign = "left";

      const innerWidth = width - edge * 2;
      const columnWidth = (innerWidth - gap * (columnCount - 1)) / columnCount;
      context.fillStyle = theme === "paper" ? "rgba(255,255,255,.48)" : "rgba(0,0,0,.24)";
      roundedRect(context, edge - 18, boardTop - 10, innerWidth + 36, boardHeight - 4, 24);
      context.fill();

      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        const column = columns[columnIndex];
        const x = edge + columnIndex * (columnWidth + gap);
        const totalCards = Math.max(
          1,
          column.groups.reduce((sum, group) => sum + group.cards.length, 0),
        );
        const fullCardHeight = columnWidth * 1.395;
        const headingsHeight = column.groups.length * 39;
        const groupGaps = Math.max(0, column.groups.length - 1) * 11;
        const visibleStrip = Math.max(
          16,
          Math.min(40, (boardHeight - 42 - headingsHeight - groupGaps - fullCardHeight) / Math.max(1, totalCards - 1)),
        );
        let y = boardTop + 12;

        for (const group of column.groups) {
          context.fillStyle = tokens.panel;
          roundedRect(context, x, y, columnWidth, 32, 7);
          context.fill();
          context.fillStyle = tokens.ink;
          context.font = "900 14px Arial";
          context.fillText(group.name.toUpperCase(), x + 10, y + 21);
          context.fillStyle = tokens.accent;
          context.textAlign = "right";
          context.fillText(String(group.count), x + columnWidth - 10, y + 21);
          context.textAlign = "left";
          y += 39;

          for (let index = 0; index < group.cards.length; index += 1) {
            const card = group.cards[index];
            if (display === "text") {
              context.fillStyle = theme === "paper" ? "rgba(255,255,255,.72)" : "rgba(2,9,14,.78)";
              roundedRect(context, x, y, columnWidth, 30, 5);
              context.fill();
              context.fillStyle = tokens.accent;
              context.font = "900 13px Arial";
              context.fillText(String(card.quantity), x + 9, y + 20);
              context.fillStyle = tokens.ink;
              context.font = "700 12px Arial";
              context.fillText(card.name.slice(0, 27), x + 31, y + 20);
              y += 34;
              continue;
            }
            const isLast = index === group.cards.length - 1;
            const remainingRoom = boardTop + boardHeight - 26 - y;
            const drawHeight = isLast ? Math.min(fullCardHeight, remainingRoom) : fullCardHeight;
            try {
              const image = await loadImage(cardSource(card));
              context.save();
              roundedRect(context, x, y, columnWidth, drawHeight, 9);
              context.clip();
              context.drawImage(image, x, y, columnWidth, fullCardHeight);
              context.restore();
            } catch {
              context.fillStyle = tokens.panel;
              roundedRect(context, x, y, columnWidth, drawHeight, 9);
              context.fill();
            }
            context.strokeStyle = theme === "paper" ? "rgba(15,23,42,.45)" : "rgba(255,255,255,.30)";
            context.lineWidth = 2;
            roundedRect(context, x, y, columnWidth, drawHeight, 9);
            context.stroke();

            if (card.quantity > 1) {
              context.fillStyle = "rgba(3,10,15,.88)";
              roundedRect(context, x + 7, y + 6, 47, 26, 7);
              context.fill();
              context.fillStyle = "#ffffff";
              context.font = "900 14px Arial";
              context.fillText(`×${card.quantity}`, x + 17, y + 24);
            }
            y += isLast ? drawHeight : visibleStrip;
          }
          y += 11;
        }
      }

      context.fillStyle = tokens.panel;
      context.fillRect(0, height - footerHeight, width, footerHeight);
      context.fillStyle = tokens.ink;
      context.font = "900 16px Arial";
      context.fillText("CRAFTED ON TRADING DOCKS", edge, height - 25);
      context.fillStyle = tokens.accent;
      context.textAlign = "right";
      context.fillText("TRADINGDOCKS.COM", width - edge, height - 25);
      context.textAlign = "left";

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1),
      );
      if (!blob) return;
      const fileName = `${(deckName || "trading-docks-deck")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-deck-craft.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${deckName} — Trading Docks`,
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
      <div className="mx-auto flex min-h-full max-w-[1600px] items-center justify-center">
        <section className="w-full overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[#06131f] shadow-[0_30px_120px_rgba(0,0,0,.7)]">
          <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-7 sm:py-5">
            <div>
              <div className="flex items-center gap-2 text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]">Deck Craft Studio</p>
              </div>
              <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
                Turn your deck into a shareable poster
              </h2>
            </div>
            <button type="button" aria-label="Close showcase" onClick={onClose} className="rounded-xl border border-white/10 p-2.5 text-slate-400 transition hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="border-b border-white/[0.07] p-5 lg:border-b-0 lg:border-r">
              <ShowcaseControl title="Share format">
                {([
                  ["portrait", "Facebook / Feed"],
                  ["square", "Square"],
                  ["story", "Story"],
                ] as const).map(([value, label]) => (
                  <Choice key={value} active={size === value} onClick={() => setSize(value)} label={label} />
                ))}
              </ShowcaseControl>
              {isCommander ? (
                <ShowcaseControl title="Deck display">
                  <Choice active={display === "text"} onClick={() => setDisplay("text")} label="Condensed text" />
                  <Choice active={display === "cards"} onClick={() => setDisplay("cards")} label="Visual cards" />
                </ShowcaseControl>
              ) : null}
              <ShowcaseControl title="Poster style">
                {([
                  ["color", "Deck Colors"],
                  ["harbor", "Harbor"],
                  ["midnight", "Midnight"],
                  ["paper", "Gallery"],
                ] as const).map(([value, label]) => (
                  <Choice key={value} active={theme === value} onClick={() => setTheme(value)} label={label} />
                ))}
              </ShowcaseControl>
              <ShowcaseControl title="Include">
                <ShowcaseToggle label="Deck value" checked={showValue} onChange={setShowValue} />
              </ShowcaseControl>
              <div className="mt-6 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4">
                <p className="text-[11px] font-semibold text-cyan-100">Card-first deck poster</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  Full cards are stacked like a tournament deck board, with every category packed into the available space.
                </p>
              </div>
              <button type="button" onClick={() => void exportShowcase()} disabled={exporting} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 text-[12px] font-black text-[#00121c] shadow-[0_10px_35px_rgba(34,211,238,.16)] transition hover:brightness-105 disabled:opacity-60">
                {typeof navigator !== "undefined" && "share" in navigator ? <Share2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {exporting ? "Rendering HD poster…" : "Share or Download HD"}
              </button>
            </aside>

            <main className="flex min-h-[680px] items-center justify-center overflow-auto bg-[#02090e] p-4 sm:p-7">
              <div
                className={`relative w-full overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-br ${tokens.preview} shadow-[0_24px_80px_rgba(0,0,0,.58)] ${
                  size === "square" ? "max-w-[820px] aspect-square" : size === "story" ? "max-w-[450px] aspect-[9/16]" : "max-w-[760px] aspect-[4/5]"
                }`}
                style={theme === "color" ? { backgroundImage: identityGradient } : undefined}
              >
                <div className="relative flex h-full flex-col p-[3.2%]">
                  <div className="grid grid-cols-[14%_1fr_auto] items-center gap-[3%]">
                    <img
                      loading="eager"
                      decoding="async"
                      src={commander ? cardSource(commander) : ""}
                      alt=""
                      className="w-full rounded-[7%] border object-cover shadow-xl"
                      style={{ borderColor: tokens.accent }}
                    />
                    <div className="min-w-0">
                      <p className="text-[clamp(5px,.7vw,9px)] font-black uppercase tracking-[.16em]" style={{ color: tokens.accent }}>
                        Trading Docks / Deck Craft
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-[clamp(18px,3vw,38px)] font-black leading-none" style={{ color: tokens.ink }}>
                        {deckName || "Untitled Deck"}
                      </h3>
                      <p className="mt-2 truncate text-[clamp(6px,.9vw,11px)] font-bold uppercase tracking-[.06em]" style={{ color: tokens.muted }}>
                        {format} · {commanderName || commander?.name} · {cardCount} cards {showValue ? `· $${marketValue.toFixed(2)}` : ""}
                      </p>
                    </div>
                    <MiniCurve cards={cards} accent={tokens.accent} muted={tokens.muted} />
                  </div>

                  <div
                    className="mt-[2.5%] grid min-h-0 flex-1 items-start gap-[1.2%] rounded-[2%] p-[1.4%]"
                    style={{
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                      background: theme === "paper" ? "rgba(255,255,255,.42)" : "rgba(0,0,0,.25)",
                    }}
                  >
                    {columns.map((column, index) => (
                      <div key={index} className="flex min-h-0 flex-col gap-[1.2cqw]">
                        {column.groups.map((group) =>
                          display === "text" ? (
                            <TextPosterGroup key={group.name} group={group} tokens={tokens} />
                          ) : (
                            <PosterGroup key={group.name} group={group} tokens={tokens} />
                          )
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-[1.5%] flex items-center justify-between">
                    <p className="text-[clamp(5px,.7vw,9px)] font-black uppercase tracking-[.13em]" style={{ color: tokens.ink }}>
                      Crafted on Trading Docks
                    </p>
                    <p className="max-w-[55%] truncate text-right text-[clamp(5px,.7vw,9px)] font-bold" style={{ color: tokens.accent }}>
                      tradingdocks.com
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

function PosterGroup({
  group,
  tokens,
}: {
  group: ShowcaseGroup;
  tokens: (typeof themes)[ShowcaseTheme];
}) {
  const overlap = Math.max(8, Math.min(24, 112 / Math.max(group.cards.length, 1)));
  return (
    <section className="min-w-0">
      <header className="mb-[3%] flex items-center justify-between rounded-[4px] px-[5%] py-[3%]" style={{ background: tokens.panel }}>
        <p className="truncate text-[clamp(4px,.55vw,8px)] font-black uppercase tracking-[.08em]" style={{ color: tokens.ink }}>{group.name}</p>
        <span className="text-[clamp(4px,.55vw,8px)] font-black" style={{ color: tokens.accent }}>{group.count}</span>
      </header>
      <div>
        {group.cards.map((card, index) => (
          <div
            key={card.id}
            className="relative aspect-[.716] overflow-hidden rounded-[4%] border shadow-[0_5px_12px_rgba(0,0,0,.45)]"
            style={{
              marginTop: index ? `-${100 - overlap}%` : undefined,
              borderColor: "rgba(255,255,255,.34)",
              zIndex: index + 1,
            }}
          >
            <img loading="lazy" decoding="async" src={cardSource(card)} alt={card.name} className="h-full w-full object-cover" />
            {card.quantity > 1 ? (
              <span className="absolute left-[4%] top-[3%] rounded bg-black/85 px-[6%] py-[2%] text-[clamp(5px,.65vw,9px)] font-black text-white">
                ×{card.quantity}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function TextPosterGroup({
  group,
  tokens,
}: {
  group: ShowcaseGroup;
  tokens: (typeof themes)[ShowcaseTheme];
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[5px] border border-white/10 bg-black/35">
      <header className="flex items-center justify-between px-[5%] py-[3%]" style={{ background: tokens.panel }}>
        <p className="truncate text-[clamp(5px,.62vw,9px)] font-black uppercase tracking-[.08em]" style={{ color: tokens.ink }}>{group.name}</p>
        <span className="text-[clamp(5px,.62vw,9px)] font-black" style={{ color: tokens.accent }}>{group.count}</span>
      </header>
      <div className="px-[4%] py-[2.5%]">
        {group.cards.map((card) => (
          <div key={card.id} className="grid grid-cols-[1.1em_minmax(0,1fr)] items-baseline gap-[3%] border-b border-white/[0.055] py-[1.2%] last:border-b-0">
            <span className="text-[clamp(5px,.58vw,8px)] font-black" style={{ color: tokens.accent }}>{card.quantity}</span>
            <span className="truncate text-[clamp(5px,.58vw,8px)] font-semibold" style={{ color: tokens.ink }}>{card.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniCurve({ cards, accent, muted }: { cards: DeckCard[]; accent: string; muted: string }) {
  const bins = [0, 1, 2, 3, 4, 5, 6].map((value) =>
    cards.filter((card) => Math.min(6, Math.round(card.manaValue || 0)) === value)
      .reduce((sum, card) => sum + card.quantity, 0),
  );
  const max = Math.max(...bins, 1);
  return (
    <div className="hidden h-[55px] w-[120px] items-end gap-[3px] sm:flex">
      {bins.map((amount, index) => (
        <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5">
          <span className="w-full rounded-t-sm" style={{ height: `${Math.max(3, (amount / max) * 42)}px`, background: accent }} />
          <span className="text-[6px] font-bold" style={{ color: muted }}>{index === 6 ? "6+" : index}</span>
        </div>
      ))}
    </div>
  );
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border px-3 py-2 text-[11px] font-semibold transition ${active ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/[0.07] text-slate-500 hover:text-slate-300"}`}>
      {label}
    </button>
  );
}

function ShowcaseControl({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ShowcaseToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2.5 text-[11px] text-slate-300">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-cyan-300" />
    </label>
  );
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawRoundedImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, radius: number) {
  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, x, y, width, height);
  context.restore();
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
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
