import type { ChaosSortItem } from "./domain.ts";
import { liveScanStatus } from "./live-intake.ts";

/** Labels only: keep commit eligibility and the recognition state machine authoritative. */
export function chaosResultStatus(item: ChaosSortItem) {
  const status = liveScanStatus(item);
  return status === "CONFIRMED" ? "Ready to add" : status === "NEEDS REVIEW" ? "Review needed" : status === "FAILED" ? "Failed" : status === "UNKNOWN" ? "Unknown" : "Processing";
}

function known(value: string | null | undefined) {
  return value?.trim() && !["unknown", "undetermined", "n/a"].includes(value.trim().toLowerCase()) ? value.trim() : null;
}

type PrintingCandidate = NonNullable<ChaosSortItem["recognitionCandidates"]>[number];

// Recognition returns value/available; manual exact-printing search returns market.
// Adapt their existing USD references for display, without fetching or estimating prices.
function candidatePrices(candidate?: PrintingCandidate) {
  return (candidate?.prices ?? []).flatMap(price => {
    const value = price.value ?? price.market;
    if (price.available === false || price.currency !== "USD" || typeof value !== "number" || !Number.isFinite(value) || value < 0) return [];
    const finish = price.source?.startsWith("scryfall:") ? price.source.slice(9) : null;
    const label = price.label ?? (finish === "nonfoil" ? "Nonfoil reference" : finish === "foil" ? "Foil reference" : finish === "etched" ? "Etched reference" : "Market");
    return [{ value, label, source: finish ? "Scryfall" : price.source }];
  });
}

export function chaosCandidateMarketPrice(candidate: PrintingCandidate) {
  return candidatePrices(candidate)[0]?.value ?? null;
}

export function chaosPrintingDetails(item: ChaosSortItem) {
  // Do not attach metadata from a stale candidate after manual printing edits.
  const candidate = item.recognitionCandidates?.find(c => c.id === item.scryfallId && c.name === item.cardName && c.setCode.toLowerCase() === item.setCode?.toLowerCase() && c.collectorNumber === item.collectorNumber);
  const setCode = known(item.setCode)?.toUpperCase();
  const printing = [known(candidate?.setName), setCode, known(item.collectorNumber) ? `#${item.collectorNumber}` : null].filter(Boolean).join(" · ") || "Printing not determined";
  const finishCode = known(item.finish)?.toLowerCase();
  const finish = finishCode ? ({ nonfoil: "Nonfoil", foil: "Foil", etched: "Etched foil" }[finishCode] ?? finishCode.replaceAll("_", " ")) : "Finish not determined";
  const languageCode = known(item.language);
  let language = "Language not determined";
  if (languageCode) {
    try { language = new Intl.DisplayNames(["en"], { type: "language" }).of(languageCode) ?? languageCode; }
    catch { language = languageCode; }
  }
  const price = typeof item.marketPrice === "number" && Number.isFinite(item.marketPrice) && item.marketPrice >= 0 ? item.marketPrice : null;
  const reference = candidatePrices(candidate).find(p => p.value === price);
  // A nonfoil reference is not proof that the physical card is nonfoil.
  const priceLabel = reference?.label ?? (finishCode ? "Market" : "Price reference");
  return { printing, finish, language, price, priceLabel, priceSource: reference?.source ?? null };
}

export function chaosSortLabel(label: string) {
  return label === "Bulk C/U" || label === "bulk_cu" ? "Bulk commons & uncommons" : label;
}
