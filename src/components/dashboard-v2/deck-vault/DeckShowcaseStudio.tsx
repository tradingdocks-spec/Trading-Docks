"use client";

import { useState, type ReactNode } from "react";
import { Download, X } from "lucide-react";

import type { DeckCard, DeckFormat } from "@/lib/deck-vault/types";

type ShowcaseTheme = "harbor" | "midnight" | "color";
type ShowcaseSize = "portrait" | "square" | "story";

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
  const [showValue, setShowValue] = useState(true);
  const [showLink, setShowLink] = useState(true);
  const [exporting, setExporting] = useState(false);
  const commander =
    cards.find((card) => card.board === "commander" || card.category === "Commander") ??
    cards[0];
  const featured = cards
    .filter((card) => card.id !== commander?.id && card.board !== "sideboard")
    .sort((a, b) => b.price - a.price)
    .slice(0, 8);
  const cardCount = cards.reduce((total, card) => total + card.quantity, 0);
  const publicUrl =
    typeof window === "undefined" ? "tradingdocks.com/decks" : window.location.href;

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

      const palettes = {
        harbor: ["#031019", "#082c3b", "#19d3e6"],
        midnight: ["#050713", "#151b35", "#8b5cf6"],
        color: ["#07130e", "#123a2b", "#34d399"],
      };
      const [dark, mid, accent] = palettes[theme];
      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, mid);
      gradient.addColorStop(0.42, dark);
      gradient.addColorStop(1, "#010509");
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.globalAlpha = 0.12;
      context.strokeStyle = accent;
      context.lineWidth = 2;
      for (let x = -canvas.height; x < canvas.width; x += 86) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + canvas.height, canvas.height);
        context.stroke();
      }
      context.globalAlpha = 1;

      context.fillStyle = accent;
      context.fillRect(66, 64, 8, 148);
      context.font = "700 25px Arial";
      context.fillText("TRADING DOCKS  /  DECK VAULT", 98, 92);
      context.fillStyle = "#ffffff";
      context.font = "800 58px Arial";
      wrapCanvasText(context, deckName || "Untitled Deck", 98, 157, 840, 66, 2);
      context.fillStyle = "#94a3b8";
      context.font = "500 23px Arial";
      context.fillText(`${format}  •  ${cardCount} CARDS${showValue ? `  •  $${marketValue.toFixed(2)}` : ""}`, 98, 250);

      const commanderSource = commander
        ? `/api/deck-vault/card-image?name=${encodeURIComponent(commander.name)}`
        : "";
      if (commanderSource) {
        try {
          const image = await loadCanvasImage(commanderSource);
          drawRoundedImage(context, image, 70, 305, 342, 478, 24);
          context.strokeStyle = accent;
          context.lineWidth = 5;
          roundedRect(context, 70, 305, 342, 478, 24);
          context.stroke();
        } catch {
          context.fillStyle = mid;
          roundedRect(context, 70, 305, 342, 478, 24);
          context.fill();
        }
      }

      context.fillStyle = accent;
      context.font = "700 18px Arial";
      context.fillText("COMMANDER", 70, 825);
      context.fillStyle = "#ffffff";
      context.font = "700 30px Arial";
      wrapCanvasText(context, commanderName || commander?.name || "Commander", 70, 865, 350, 34, 2);

      const cardWidth = 132;
      const cardHeight = 184;
      const gap = 22;
      for (let index = 0; index < featured.length; index += 1) {
        const column = index % 4;
        const row = Math.floor(index / 4);
        const x = 466 + column * (cardWidth + gap);
        const y = 322 + row * (cardHeight + 80);
        const card = featured[index];
        try {
          const image = await loadCanvasImage(
            `/api/deck-vault/card-image?name=${encodeURIComponent(card.name)}`,
          );
          drawRoundedImage(context, image, x, y, cardWidth, cardHeight, 12);
        } catch {
          context.fillStyle = "#102331";
          roundedRect(context, x, y, cardWidth, cardHeight, 12);
          context.fill();
        }
        context.fillStyle = "#ffffff";
        context.font = "600 15px Arial";
        wrapCanvasText(context, card.name, x, y + cardHeight + 22, cardWidth, 18, 2);
      }

      const footerY = canvas.height - 124;
      context.fillStyle = "rgba(255,255,255,.08)";
      context.fillRect(66, footerY - 30, canvas.width - 132, 1);
      context.fillStyle = "#ffffff";
      context.font = "800 25px Arial";
      context.fillText("BUILT IN THE TRADING DOCKS DECK VAULT", 66, footerY + 20);
      context.fillStyle = accent;
      context.font = "600 19px Arial";
      context.fillText(
        showLink ? publicUrl.replace(/^https?:\/\//, "").slice(0, 82) : "TRADINGDOCKS.COM",
        66,
        footerY + 57,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1),
      );
      if (!blob) return;
      const fileName = `${(deckName || "trading-docks-deck")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-showcase.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${deckName} — Trading Docks Deck Vault`,
          text: `Check out my ${format} deck built in Trading Docks.`,
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

  const previewGradient = {
    harbor: "from-[#0b3444] via-[#04141f] to-[#02070b]",
    midnight: "from-[#1a2040] via-[#080a18] to-[#03040a]",
    color: "from-[#174633] via-[#071b12] to-[#020905]",
  }[theme];

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#01070c]/92 p-4 backdrop-blur-xl">
      <div className="mx-auto flex min-h-full max-w-[1480px] items-center justify-center">
        <section className="w-full overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[#06131f] shadow-[0_30px_120px_rgba(0,0,0,.65)]">
          <header className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                Trading Docks Showcase Studio
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">Turn your deck into a shareable poster</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-white/10 p-2.5 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="border-b border-white/[0.07] p-5 lg:border-b-0 lg:border-r">
              <ShowcaseControl title="Social size">
                {([
                  ["portrait", "Instagram 4:5"],
                  ["square", "Square 1:1"],
                  ["story", "Story 9:16"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setSize(value)} className={`rounded-xl border px-3 py-2 text-[11px] font-semibold ${size === value ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/[0.07] text-slate-500"}`}>
                    {label}
                  </button>
                ))}
              </ShowcaseControl>
              <ShowcaseControl title="Visual theme">
                {([
                  ["harbor", "Harbor Cyan"],
                  ["midnight", "Midnight Foil"],
                  ["color", "Color Identity"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setTheme(value)} className={`rounded-xl border px-3 py-2 text-[11px] font-semibold ${theme === value ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/[0.07] text-slate-500"}`}>
                    {label}
                  </button>
                ))}
              </ShowcaseControl>
              <ShowcaseControl title="Include">
                <ShowcaseToggle label="Deck value" checked={showValue} onChange={setShowValue} />
                <ShowcaseToggle label="Public deck link" checked={showLink} onChange={setShowLink} />
              </ShowcaseControl>
              <div className="mt-7 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4">
                <p className="text-[11px] font-semibold text-cyan-100">Built-in discovery</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  Every export carries the Trading Docks Deck Vault signature and a path back to the live deck.
                </p>
              </div>
              <button type="button" onClick={() => void exportShowcase()} disabled={exporting} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 text-[12px] font-black text-[#00121c] disabled:opacity-60">
                <Download className="h-4 w-4" />
                {exporting ? "Building your graphic…" : "Download or Share PNG"}
              </button>
            </aside>
            <main className="flex min-h-[620px] items-center justify-center overflow-hidden bg-[#02090e] p-6">
              <div className={`relative w-full max-w-[620px] overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br ${previewGradient} p-7 shadow-[0_24px_80px_rgba(0,0,0,.55)] ${size === "square" ? "aspect-square" : size === "story" ? "aspect-[9/16] max-w-[400px]" : "aspect-[4/5]"}`}>
                <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "repeating-linear-gradient(135deg,transparent 0,transparent 32px,#67e8f9 33px,#67e8f9 34px)" }} />
                <div className="relative flex h-full flex-col">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300">Trading Docks / Deck Vault</p>
                  <h3 className="mt-2 text-[clamp(22px,4vw,38px)] font-black leading-[1.02] text-white">{deckName}</h3>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {format} · {cardCount} cards {showValue ? `· $${marketValue.toFixed(2)}` : ""}
                  </p>
                  <div className="mt-5 grid min-h-0 flex-1 grid-cols-[34%_1fr] gap-5">
                    <div>
                      <img loading="lazy" decoding="async" src={commander?.image || `/api/deck-vault/card-image?name=${encodeURIComponent(commander?.name || commanderName)}`} alt="" className="w-full rounded-xl border-2 border-cyan-300/60 shadow-[0_12px_40px_rgba(0,0,0,.5)]" />
                      <p className="mt-3 text-[8px] font-black uppercase tracking-[0.16em] text-cyan-300">Commander</p>
                      <p className="mt-1 text-[11px] font-bold leading-tight text-white">{commanderName || commander?.name}</p>
                    </div>
                    <div className="grid grid-cols-4 content-start gap-2">
                      {featured.map((card) => (
                        <div key={card.id} className="min-w-0">
                          <img loading="lazy" decoding="async" src={card.image || `/api/deck-vault/card-image?name=${encodeURIComponent(card.name)}`} alt="" className="w-full rounded-md border border-white/10 shadow-lg" />
                          <p className="mt-1 truncate text-[6px] font-semibold text-slate-300">{card.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <p className="text-[8px] font-black uppercase tracking-[0.13em] text-white">Built in the Trading Docks Deck Vault</p>
                    <p className="mt-1 truncate text-[7px] font-semibold text-cyan-300">{showLink ? publicUrl.replace(/^https?:\/\//, "") : "tradingdocks.com"}</p>
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

function ShowcaseControl({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
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
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
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
