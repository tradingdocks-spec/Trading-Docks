import type { CardRecognitionSignals } from "./types.ts";

export function parseRecognitionRequest(value: unknown): { ok: true; signals: CardRecognitionSignals; limit: number } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "Provide recognition signals." };
  const source = value as Record<string, unknown>;
  if (source.image) return { ok: false, error: "Raw images are not accepted by this signal endpoint. Use the authenticated scanner provider path for image recognition." };
  const signalsSource = source.signals && typeof source.signals === "object" ? source.signals as Record<string, unknown> : source;
  const game = text(signalsSource.game)?.toLowerCase();
  if (game && !["magic", "pokemon", "unknown"].includes(game)) return { ok: false, error: "Unsupported card game." };
  const signals: CardRecognitionSignals = {
    game: game as CardRecognitionSignals["game"], cardName: text(signalsSource.cardName), collectorNumber: text(signalsSource.collectorNumber),
    setCode: text(signalsSource.setCode), setName: text(signalsSource.setName), language: text(signalsSource.language), rarity: text(signalsSource.rarity),
    finish: text(signalsSource.finish), ocrText: text(signalsSource.ocrText), ocrConfidence: confidence(signalsSource.ocrConfidence),
    visualSimilarity: confidence(signalsSource.visualSimilarity), visualPrintingId: text(signalsSource.visualPrintingId), imageHash: text(signalsSource.imageHash),
    visualCandidates: visualCandidates(signalsSource.visualCandidates),
    foil: typeof signalsSource.foil === "boolean" ? signalsSource.foil : null,
    orientation: ["portrait", "landscape", "unknown"].includes(`${signalsSource.orientation}`) ? signalsSource.orientation as CardRecognitionSignals["orientation"] : undefined,
    dimensions: dimensions(signalsSource.dimensions), providerIds: providerIds(signalsSource.providerIds),
  };
  if (!signals.cardName && !signals.ocrText && !signals.collectorNumber && !signals.visualPrintingId && !Object.keys(signals.providerIds ?? {}).length) return { ok: false, error: "Provide at least one identity signal." };
  return { ok: true, signals, limit: Math.max(1, Math.min(integer(source.limit) ?? 5, 10)) };
}

function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim().slice(0, 1500) : null; }
function confidence(value: unknown) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(number, number > 1 ? 100 : 1)) : null; }
function integer(value: unknown) { const number = Number(value); return Number.isSafeInteger(number) ? number : null; }
function dimensions(value: unknown) { if (!value || typeof value !== "object") return null; const source = value as Record<string, unknown>; const width = integer(source.width); const height = integer(source.height); return width && height && width <= 20_000 && height <= 20_000 ? { width, height } : null; }
function providerIds(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) return {}; return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 12).flatMap(([key, entry]) => typeof entry === "string" || typeof entry === "number" ? [[key.slice(0, 40), typeof entry === "string" ? entry.slice(0, 160) : entry]] : [])); }
function visualCandidates(value: unknown) { if (!Array.isArray(value)) return []; return value.slice(0, 5).flatMap((entry) => { if (!entry || typeof entry !== "object") return []; const source = entry as Record<string, unknown>; const printingId = text(source.printingId); const similarity = confidence(source.similarity); return printingId && similarity != null ? [{ printingId: printingId.slice(0, 160), similarity }] : []; }); }
