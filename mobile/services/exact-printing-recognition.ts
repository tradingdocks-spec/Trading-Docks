import type { CardFinish } from './collector-workspace.ts';
import type { ScannerCardCandidate } from './scanner-foundation.ts';
import type { RecognitionConfidence, RecognitionSignalScore } from './scanner-intelligence.ts';

export type BottomLeftPrintingEvidence = {
  rawText: string | null;
  parsedCollectorNumber: string | null;
  parsedSetCode: string | null;
  parsedLanguage: string | null;
  listIndicatorObserved: boolean;
};

export type ListPrintingConsistency = 'consistent' | 'conflict' | 'not_observed' | 'candidate_not_list';

export type ExactPrintingRefinement = {
  evidence: BottomLeftPrintingEvidence;
  listConsistency: ListPrintingConsistency;
  confidence: RecognitionConfidence;
  selectedPrintingConfidence: number;
  diagnostics: {
    rawBottomLeftOcr: string | null;
    parsedCollectorNumber: string | null;
    parsedSetCode: string | null;
    listPrintingSignal: boolean;
    candidateMetadata: Pick<ScannerCardCandidate, 'id' | 'setCode' | 'collectorNumber' | 'specialPrintingLabels' | 'scryfallMetadata'>;
    consistencyResult: ListPrintingConsistency;
  };
};

const SET_CODE_ALIASES: Record<string, string> = {
  LIST: 'PLST',
  THELIST: 'PLST',
};

export function parseBottomLeftPrintingText(raw: string | null | undefined): BottomLeftPrintingEvidence {
  const clean = normalizeEvidenceText(raw);
  if (!clean) {
    return {
      rawText: raw?.trim() || null,
      parsedCollectorNumber: null,
      parsedSetCode: null,
      parsedLanguage: null,
      listIndicatorObserved: false,
    };
  }
  const compact = clean.replace(/\s+/g, '');
  const collectorNumber = clean.match(/\b\d{1,4}[A-Z]?\b/)?.[0] ?? null;
  const language = clean.match(/\b(EN|JP|JA|DE|FR|ES|IT|PT|KO|RU|ZH)\b/)?.[0]?.toLowerCase() ?? null;
  const setCode = clean
    .split(/\s+/)
    .map((part) => SET_CODE_ALIASES[part] ?? part)
    .find((part) => /^[A-Z0-9]{2,5}$/.test(part) && part !== language?.toUpperCase() && part !== collectorNumber) ?? null;
  return {
    rawText: raw?.trim() || null,
    parsedCollectorNumber: collectorNumber,
    parsedSetCode: setCode,
    parsedLanguage: language,
    listIndicatorObserved: /\bTHE\s+LIST\b/.test(clean) || /\bPLST\b/.test(clean) || compact.includes('THELIST'),
  };
}

export function isScryfallListPrinting(candidate: Pick<ScannerCardCandidate, 'setCode' | 'setName' | 'specialPrintingLabels' | 'scryfallMetadata'>) {
  return candidate.setCode?.toUpperCase() === 'PLST'
    || candidate.setName?.toLowerCase() === 'the list'
    || (candidate.specialPrintingLabels ?? []).some((label) => label.toLowerCase() === 'the list')
    || (candidate.scryfallMetadata?.promoTypes ?? []).some((type) => type.toLowerCase().replace(/[_-]/g, ' ') === 'the list');
}

export function evaluateListPrintingConsistency(candidate: ScannerCardCandidate, evidence: BottomLeftPrintingEvidence): ListPrintingConsistency {
  if (!evidence.listIndicatorObserved) return isScryfallListPrinting(candidate) ? 'candidate_not_list' : 'not_observed';
  return isScryfallListPrinting(candidate) ? 'consistent' : 'conflict';
}

export function refineExactPrintingConfidence(input: {
  candidate: ScannerCardCandidate;
  confidence: RecognitionConfidence;
  evidence: BottomLeftPrintingEvidence;
}): ExactPrintingRefinement {
  const setMatch = scoreOptionalExact(input.evidence.parsedSetCode, input.candidate.setCode);
  const collectorMatch = scoreOptionalExact(input.evidence.parsedCollectorNumber, input.candidate.collectorNumber);
  const listConsistency = evaluateListPrintingConsistency(input.candidate, input.evidence);
  const listScore = listConsistency === 'consistent' ? 96 : listConsistency === 'conflict' ? 8 : null;
  const signals: RecognitionSignalScore[] = [
    ...input.confidence.signals,
    signal('set_code', 'Bottom-left set code', setMatch, 0.08, input.evidence.parsedSetCode ?? 'Missing bottom-left set code'),
    signal('collector_number', 'Bottom-left collector number', collectorMatch, 0.1, input.evidence.parsedCollectorNumber ?? 'Missing bottom-left collector number'),
    signal('list_printing', 'The List consistency', listScore, 0.08, listConsistency),
  ];
  const conflicts = [
    ...input.confidence.conflicts,
    ...signals.slice(input.confidence.signals.length).map((entry) => entry.conflict).filter((value): value is string => Boolean(value)),
  ];
  const scored = signals.filter((entry) => entry.score !== null);
  const weightTotal = scored.reduce((sum, entry) => sum + entry.weight, 0);
  const overall = weightTotal
    ? Math.round(scored.reduce((sum, entry) => sum + (entry.score ?? 0) * entry.weight, 0) / weightTotal)
    : input.confidence.overall;
  const confidence: RecognitionConfidence = {
    ...input.confidence,
    overall,
    requiresConfirmation: input.confidence.requiresConfirmation || conflicts.length > 0 || insufficientExactPrintingEvidence(input.evidence),
    signals,
    conflicts,
  };
  return {
    evidence: input.evidence,
    listConsistency,
    confidence,
    selectedPrintingConfidence: overall,
    diagnostics: {
      rawBottomLeftOcr: input.evidence.rawText,
      parsedCollectorNumber: input.evidence.parsedCollectorNumber,
      parsedSetCode: input.evidence.parsedSetCode,
      listPrintingSignal: input.evidence.listIndicatorObserved,
      candidateMetadata: {
        id: input.candidate.id,
        setCode: input.candidate.setCode,
        collectorNumber: input.candidate.collectorNumber,
        specialPrintingLabels: input.candidate.specialPrintingLabels,
        scryfallMetadata: input.candidate.scryfallMetadata,
      },
      consistencyResult: listConsistency,
    },
  };
}

export function supportedVisibleFinishes(candidate: ScannerCardCandidate): CardFinish[] {
  return candidate.finishes.filter((finish): finish is CardFinish => finish === 'normal' || finish === 'foil' || finish === 'etched');
}

export function defaultFinishForPrinting(candidate: ScannerCardCandidate, preferred?: CardFinish | string | null): { finish: CardFinish; fallbackMessage: string | null; evidence: 'EXPLICIT' | 'DERIVED_FROM_AUTHORITATIVE_CATALOG' | 'UNRESOLVED' } {
  const supported = supportedVisibleFinishes(candidate);
  if (preferred === 'normal' || preferred === 'foil' || preferred === 'etched') {
    if (supported.includes(preferred)) return { finish: preferred, fallbackMessage: null, evidence: 'EXPLICIT' };
    return { finish: 'unknown', fallbackMessage: 'The observed finish conflicts with this printing. Review required.', evidence: 'UNRESOLVED' };
  }
  if (candidate.identityAuthority === 'provider_confirmed' && supported.length === 1) {
    return { finish: supported[0], fallbackMessage: null, evidence: 'DERIVED_FROM_AUTHORITATIVE_CATALOG' };
  }
  return { finish: 'unknown', fallbackMessage: 'Choose the observed finish before saving.', evidence: 'UNRESOLVED' };
}

export function finishLabel(finish: string) {
  if (finish === 'normal') return 'Nonfoil';
  if (finish === 'foil') return 'Foil';
  if (finish === 'etched') return 'Etched';
  return 'Finish';
}

function normalizeEvidenceText(raw: string | null | undefined) {
  return raw
    ?.replace(/[\u00b7\u2022]/g, ' ')
    .replace(/\bO(?=\d)/gi, '0')
    .replace(/\bS(?=\d)/gi, '5')
    .replace(/[^A-Z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase() ?? '';
}

function insufficientExactPrintingEvidence(evidence: BottomLeftPrintingEvidence) {
  return !evidence.parsedSetCode || !evidence.parsedCollectorNumber;
}

function scoreOptionalExact(observed: string | null | undefined, expected: string | null | undefined) {
  if (!observed || !expected) return null;
  return observed.toLowerCase() === expected.toLowerCase() ? 98 : 8;
}

function signal(key: RecognitionSignalScore['key'], label: string, rawScore: number | null, weight: number, evidence: string): RecognitionSignalScore {
  const score = rawScore === null ? null : Math.max(0, Math.min(100, Math.round(rawScore)));
  return {
    key,
    label,
    score,
    weight,
    evidence,
    conflict: score !== null && score < 35 ? `${label} conflicts with the selected printing.` : undefined,
  };
}
