import type { CandidateSignal, CanonicalPrinting, CardRecognitionSignals, RankedPrintingCandidate } from "./types.ts";

const WEIGHTS = {
  providerId: 0.3,
  collectorNumber: 0.2,
  set: 0.18,
  name: 0.14,
  visual: 0.1,
  language: 0.035,
  finish: 0.025,
  rarity: 0.01,
} as const;

export function rankPrintingCandidates(
  signals: CardRecognitionSignals,
  candidates: readonly CanonicalPrinting[],
  limit = 5,
): RankedPrintingCandidate[] {
  return dedupe(candidates)
    .map((candidate) => rankCandidate(signals, candidate))
    .sort((left, right) => right.score - left.score || left.printingId.localeCompare(right.printingId))
    .slice(0, Math.max(1, Math.min(limit, 10)));
}

export function rankCandidate(signals: CardRecognitionSignals, candidate: CanonicalPrinting): RankedPrintingCandidate {
  const diagnostics: Record<string, CandidateSignal> = {
    providerId: providerIdSignal(signals, candidate),
    collectorNumber: exactSignal(signals.collectorNumber, candidate.collectorNumber, WEIGHTS.collectorNumber),
    set: combinedExactSignal(signals.setCode, signals.setName, candidate.setCode, candidate.setName, WEIGHTS.set),
    name: nameSignal(signals.cardName, signals.ocrText, signals.ocrConfidence, candidate.name),
    visual: visualSignal(signals, candidate),
    language: exactSignal(signals.language, candidate.language, WEIGHTS.language),
    finish: finishSignal(signals, candidate),
    rarity: exactSignal(signals.rarity, candidate.rarity, WEIGHTS.rarity),
  };
  const observed = Object.values(diagnostics).filter((signal) => signal.score !== null);
  const weight = observed.reduce((total, signal) => total + signal.weight, 0);
  const raw = weight ? observed.reduce((total, signal) => total + (signal.score ?? 0) * signal.weight, 0) / weight : 0;
  const contradictions = Object.entries(diagnostics).filter(([, signal]) => signal.status === "conflict");
  const exactIdentity = (candidate.identityAuthority === "provider_confirmed" && diagnostics.providerId.status === "exact")
    || (diagnostics.collectorNumber.status === "exact" && diagnostics.set.status === "exact");
  const corroborated = observed.filter((signal) => signal.status === "exact" || signal.status === "match").length >= 2;
  const penalty = contradictions.reduce((total, [, signal]) => total + signal.weight * 0.7, 0);
  const score = clamp(raw - penalty);
  const confidenceTier = score >= 0.9 && exactIdentity && corroborated && contradictions.length === 0
    ? "high"
    : score >= 0.72 && contradictions.length === 0 ? "medium" : "low";
  const conflictingSignals = contradictions.map(([key]) => key);
  const matchedSignals = Object.entries(diagnostics)
    .filter(([, signal]) => signal.status === "exact" || signal.status === "match")
    .map(([key]) => key);
  const finishRequiresConfirmation = !signals.finish && signals.foil == null && candidate.finishes.length !== 1;
  const requiresConfirmation = confidenceTier !== "high" || conflictingSignals.length > 0 || finishRequiresConfirmation;
  return {
    ...candidate,
    score: round(score),
    confidenceTier,
    matchedSignals,
    conflictingSignals,
    reason: explanation(matchedSignals, conflictingSignals, exactIdentity),
    requiresConfirmation,
    diagnostics,
  };
}

function providerIdSignal(signals: CardRecognitionSignals, candidate: CanonicalPrinting): CandidateSignal {
  const entries = Object.entries(signals.providerIds ?? {}).filter((entry): entry is [string, string | number] => entry[1] !== null && entry[1] !== undefined && `${entry[1]}` !== "");
  if (!entries.length) return missing(WEIGHTS.providerId);
  const authoritativeEntries = entries.filter(([key]) => candidate.providerIds[key] !== undefined);
  if (!authoritativeEntries.length || candidate.identityAuthority !== "provider_confirmed") return { status: "partial", score: 0.25, weight: WEIGHTS.providerId, observed: entries.map(([key, value]) => `${key}:${value}`).join(", "), expected: "provider-confirmed identifier" };
  const match = authoritativeEntries.some(([key, value]) => `${candidate.providerIds[key]}` === `${value}`);
  return match
    ? { status: "exact", score: 1, weight: WEIGHTS.providerId, observed: entries.map(([key, value]) => `${key}:${value}`).join(", "), expected: candidate.printingId }
    : { status: "conflict", score: 0, weight: WEIGHTS.providerId, observed: entries.map(([key, value]) => `${key}:${value}`).join(", "), expected: candidate.printingId };
}

function nameSignal(name: string | null | undefined, ocr: string | null | undefined, ocrConfidence: number | null | undefined, expected: string): CandidateSignal {
  const observed = normalize(name || ocr);
  if (!observed) return missing(WEIGHTS.name);
  const target = normalize(expected);
  const similarity = observed === target ? 1 : tokenSimilarity(observed, target);
  const reliability = name ? 1 : clamp(normalizeConfidence(ocrConfidence));
  const score = similarity * reliability;
  return {
    status: similarity === 1 ? "exact" : similarity >= 0.72 ? "match" : similarity >= 0.45 ? "partial" : "conflict",
    score,
    weight: WEIGHTS.name,
    observed: name || ocr,
    expected,
  };
}

function visualSignal(signals: CardRecognitionSignals, candidate: CanonicalPrinting): CandidateSignal {
  const visualCandidates = signals.visualCandidates?.slice(0, 5) ?? [];
  const ranked = visualCandidates.length ? visualCandidates : signals.visualPrintingId && signals.visualSimilarity != null ? [{ printingId: signals.visualPrintingId, similarity: signals.visualSimilarity }] : [];
  if (!ranked.length) return missing(WEIGHTS.visual);
  const matchIndex = ranked.findIndex((entry) => entry.printingId === candidate.printingId);
  const top = clamp(normalizeConfidence(ranked[0]?.similarity));
  const second = clamp(normalizeConfidence(ranked[1]?.similarity));
  const similarity = matchIndex >= 0 ? clamp(normalizeConfidence(ranked[matchIndex].similarity)) : 0;
  const separation = Math.max(0, top - second);
  const printingMatches = matchIndex >= 0;
  const adjusted = printingMatches ? similarity * (0.8 + Math.min(separation, 0.2)) : 0;
  return {
    status: !printingMatches && top >= 0.75 ? "conflict" : adjusted >= 0.88 && separation >= 0.04 ? "match" : adjusted >= 0.65 ? "partial" : "conflict",
    score: adjusted,
    weight: WEIGHTS.visual,
    observed: ranked.map((entry) => `${entry.printingId}:${round(normalizeConfidence(entry.similarity))}`).join(", "),
    expected: candidate.printingId,
  };
}

function finishSignal(signals: CardRecognitionSignals, candidate: CanonicalPrinting): CandidateSignal {
  const observed = normalize(signals.finish ?? (signals.foil === true ? "foil" : signals.foil === false ? "nonfoil" : null));
  if (!observed) return missing(WEIGHTS.finish);
  const finishes = candidate.finishes.map(normalizeFinish);
  const wanted = normalizeFinish(observed);
  const matches = finishes.includes(wanted);
  return { status: matches ? "match" : "conflict", score: matches ? 1 : 0, weight: WEIGHTS.finish, observed, expected: finishes.join(", ") };
}

function combinedExactSignal(first: unknown, second: unknown, expectedFirst: unknown, expectedSecond: unknown, weight: number): CandidateSignal {
  const observed = normalize(first) || normalize(second);
  if (!observed) return missing(weight);
  const expected = normalize(first) ? normalize(expectedFirst) : normalize(expectedSecond);
  return observed === expected
    ? { status: "exact", score: 1, weight, observed, expected }
    : { status: "conflict", score: 0, weight, observed, expected };
}

function exactSignal(observedValue: unknown, expectedValue: unknown, weight: number): CandidateSignal {
  const observed = normalize(observedValue);
  if (!observed) return missing(weight);
  const expected = normalize(expectedValue);
  return observed === expected
    ? { status: "exact", score: 1, weight, observed, expected }
    : { status: "conflict", score: 0, weight, observed, expected };
}

function missing(weight: number): CandidateSignal { return { status: "missing", score: null, weight }; }
function normalize(value: unknown) { return `${value ?? ""}`.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function normalizeFinish(value: string) { const normalized = normalize(value); return normalized === "normal" || normalized === "non foil" ? "nonfoil" : normalized; }
function normalizeConfidence(value: number | null | undefined) { return (value ?? 0) > 1 ? (value ?? 0) / 100 : value ?? 0; }
function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
function round(value: number) { return Math.round(value * 1000) / 1000; }
function tokenSimilarity(left: string, right: string) { const a = new Set(left.split(" ")); const b = new Set(right.split(" ")); const overlap = [...a].filter((value) => b.has(value)).length; return overlap / Math.max(a.size, b.size, 1); }
function dedupe(candidates: readonly CanonicalPrinting[]) { return [...new Map(candidates.map((candidate) => [candidate.printingId, candidate])).values()]; }
function explanation(matches: string[], conflicts: string[], exactIdentity: boolean) {
  if (conflicts.length) return `Matched ${matches.join(", ") || "limited signals"}; conflicts: ${conflicts.join(", ")}.`;
  if (exactIdentity) return `Exact printing identity corroborated by ${matches.join(", ")}.`;
  return `Ranked from ${matches.join(", ") || "limited fuzzy evidence"}; exact printing confirmation is required.`;
}
