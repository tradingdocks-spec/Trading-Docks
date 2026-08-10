import type { CardCondition } from './collector-workspace.ts';
import { MagicRecognitionAdapter } from './magic-recognition-provider.ts';
import type {
  RecognitionConfidence,
  RecognitionSignalScore,
  ScannerBenchmarkMetrics,
  ScannerFrame,
  ScanDestination,
} from './scanner-intelligence.ts';

export type SupportedTcg = 'magic' | 'pokemon' | 'one_piece' | 'lorcana' | 'unknown';

export type TcgDetectionObservation = {
  signal:
    | 'card_back'
    | 'border_geometry'
    | 'title_position'
    | 'logo_symbol_layout'
    | 'bottom_information_layout'
    | 'ocr_keyword'
    | 'artwork_embedding'
    | 'aspect_ratio';
  value: string;
  confidence: number;
  evidence: string;
};

export type TcgDetectionCandidate = {
  game: SupportedTcg;
  confidence: number;
  signals: RecognitionSignalScore[];
  conflicts: string[];
};

export type TcgFinish =
  | 'normal'
  | 'foil'
  | 'etched'
  | 'reverse_holo'
  | 'holo'
  | 'parallel'
  | 'super_parallel'
  | 'enchanted'
  | 'cold_foil'
  | 'special'
  | 'indeterminate'
  | 'unknown';

export type TcgLanguage = 'en' | 'ja' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'ko' | 'zh' | 'unknown';
export type TcgCardNumber = string;

export type TcgCardIdentity = {
  game: SupportedTcg;
  name: string;
  subtitle?: string | null;
  provider: string | null;
  externalId: string | null;
};

export type TcgPrintingIdentity = {
  game: SupportedTcg;
  setName: string | null;
  setCode: string | null;
  cardNumber: TcgCardNumber | null;
  language: TcgLanguage;
  finish: TcgFinish;
  externalProvider: string | null;
  externalId: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export type UniversalScanCandidate = {
  game: SupportedTcg;
  card: TcgCardIdentity;
  printing: TcgPrintingIdentity;
  condition: CardCondition;
  quantity: number;
  confidence: RecognitionConfidence;
  gameConfidence: TcgDetectionCandidate;
  destination: ScanDestination;
  notes: string;
};

export type UnsupportedCardObservation = {
  reason: 'unknown_game' | 'unsupported_game' | 'missing_catalog' | 'insufficient_signals';
  observations: TcgDetectionObservation[];
  confidence: number;
  notes: string;
};

export type MixedScanSession = {
  id: string;
  userId: string;
  name: string;
  startedAt: string;
  candidates: UniversalScanCandidate[];
  unsupported: UnsupportedCardObservation[];
  pendingSync: number;
  failedItems: number;
  exportMode: 'combined' | 'separated_by_game';
};

export type UniversalScanExportRow = {
  game: SupportedTcg;
  cardName: string;
  subtitle: string | null;
  set: string | null;
  cardNumber: string | null;
  externalProvider: string | null;
  externalId: string | null;
  language: TcgLanguage;
  finish: TcgFinish;
  condition: CardCondition;
  quantity: number;
  price: number | null;
  priceSource: string | null;
  priceTimestamp: string | null;
  storageLocation: string | null;
  destinationBinder: string | null;
  confidence: number;
  gameConfidence: number;
  recognitionMethod: string;
  notes: string;
};

export type TcgCatalogQuery = {
  game: SupportedTcg;
  name?: string;
  setCode?: string | null;
  cardNumber?: string | null;
  language?: TcgLanguage;
};

export type TcgCatalogProvider = {
  id: string;
  game: Exclude<SupportedTcg, 'unknown'>;
  licenseStatus: 'requires_review' | 'approved' | 'unavailable';
  catalogVersion: string | null;
  refreshedAt: string | null;
  lookup(query: TcgCatalogQuery): Promise<UniversalScanCandidate[]>;
};

export type TcgRecognitionAdapter = {
  game: Exclude<SupportedTcg, 'unknown'>;
  label: string;
  catalogProviderId: string;
  finishTaxonomy: TcgFinish[];
  regionMap: string[];
  signalWeights: Partial<Record<TcgDetectionObservation['signal'], number>>;
  supports(candidate: UniversalScanCandidate): boolean;
  recognize(input: {
    frame: ScannerFrame;
    observations: TcgDetectionObservation[];
    catalogCandidates: UniversalScanCandidate[];
  }): Promise<UniversalScanCandidate[]>;
};

export type MultiTcgBenchmarkCategory =
  | 'game_detection'
  | 'card_name'
  | 'exact_printing'
  | 'finish'
  | 'language'
  | 'unsupported_card'
  | 'mixed_stack';

export type MultiTcgBenchmarkFixture = {
  id: string;
  game: SupportedTcg;
  category: MultiTcgBenchmarkCategory;
  expectedName?: string;
  expectedExternalId?: string;
  expectedFinish?: TcgFinish;
  frameUris: string[];
  notes?: string;
};

export type MultiTcgBenchmarkMetrics = ScannerBenchmarkMetrics & {
  gameTop1: number | null;
  gameTop2: number | null;
  unsupportedCardRejection: number | null;
};

export const SUPPORTED_TCGS: SupportedTcg[] = ['magic', 'pokemon', 'one_piece', 'lorcana', 'unknown'];

export const magicRecognitionAdapter = MagicRecognitionAdapter;

export const pokemonRecognitionAdapter = createStubAdapter({
  game: 'pokemon',
  label: 'Pokemon Recognition Adapter',
  catalogProviderId: 'pokemon-catalog-planned',
  finishTaxonomy: ['normal', 'holo', 'reverse_holo', 'special', 'indeterminate'],
  regionMap: ['name', 'hp', 'stage_type', 'regulation_mark', 'illustrator', 'collector_info'],
  signalWeights: { card_back: 0.2, title_position: 0.18, logo_symbol_layout: 0.16, bottom_information_layout: 0.16, ocr_keyword: 0.16, artwork_embedding: 0.14 },
});

export const onePieceRecognitionAdapter = createStubAdapter({
  game: 'one_piece',
  label: 'One Piece Recognition Adapter',
  catalogProviderId: 'one-piece-catalog-planned',
  finishTaxonomy: ['normal', 'parallel', 'super_parallel', 'special', 'indeterminate'],
  regionMap: ['name', 'card_id', 'cost', 'power', 'counter', 'rarity', 'block_icon'],
  signalWeights: { ocr_keyword: 0.22, bottom_information_layout: 0.18, logo_symbol_layout: 0.18, border_geometry: 0.16, artwork_embedding: 0.14, aspect_ratio: 0.12 },
});

export const lorcanaRecognitionAdapter = createStubAdapter({
  game: 'lorcana',
  label: 'Lorcana Recognition Adapter',
  catalogProviderId: 'lorcana-catalog-planned',
  finishTaxonomy: ['normal', 'foil', 'enchanted', 'special', 'indeterminate'],
  regionMap: ['name', 'subtitle', 'ink_color', 'cost', 'strength', 'willpower', 'lore', 'collector_info'],
  signalWeights: { ocr_keyword: 0.2, title_position: 0.18, logo_symbol_layout: 0.18, border_geometry: 0.16, artwork_embedding: 0.16, bottom_information_layout: 0.12 },
});

export const tcgRecognitionAdapters = [
  magicRecognitionAdapter,
  pokemonRecognitionAdapter,
  onePieceRecognitionAdapter,
  lorcanaRecognitionAdapter,
] satisfies TcgRecognitionAdapter[];

export const multiTcgBenchmarkMetricsUnavailable: MultiTcgBenchmarkMetrics = {
  correctNameTop1: null,
  correctPrintingTop1: null,
  correctPrintingTop3: null,
  foilClassificationAccuracy: null,
  falseFoilRate: null,
  averageScanLatencyMs: null,
  manualCorrectionRate: null,
  failureRate: null,
  benchmarkedFixtureCount: 0,
  gameTop1: null,
  gameTop2: null,
  unsupportedCardRejection: null,
};

export function detectTcgGame(observations: TcgDetectionObservation[]): TcgDetectionCandidate {
  const candidates = rankTcgDetectionCandidates(observations);
  return candidates[0] ?? buildDetectionCandidate('unknown', 0, observations, ['No supported game reached the detection threshold.']);
}

export function rankTcgDetectionCandidates(observations: TcgDetectionObservation[]): TcgDetectionCandidate[] {
  const games: Exclude<SupportedTcg, 'unknown'>[] = ['magic', 'pokemon', 'one_piece', 'lorcana'];
  const candidates = games.map((game) => detectionScoreForGame(game, observations));
  const unknown = buildDetectionCandidate('unknown', Math.max(0, 60 - Math.max(...candidates.map((candidate) => candidate.confidence))), observations, []);
  return [...candidates, unknown].sort((a, b) => b.confidence - a.confidence || a.game.localeCompare(b.game));
}

export function correctDetectedGame(candidate: UniversalScanCandidate, nextGame: SupportedTcg): UniversalScanCandidate {
  return {
    ...candidate,
    game: nextGame,
    card: { ...candidate.card, game: nextGame },
    printing: { ...candidate.printing, game: nextGame },
    gameConfidence: {
      ...candidate.gameConfidence,
      game: nextGame,
      confidence: 100,
      signals: [
        ...candidate.gameConfidence.signals,
        { key: 'layout', label: 'Manual game correction', score: 100, weight: 1, evidence: `User selected ${nextGame}.` },
      ],
      conflicts: [],
    },
  };
}

export function routeToTcgAdapter(game: SupportedTcg, adapters = tcgRecognitionAdapters): TcgRecognitionAdapter | null {
  return adapters.find((adapter) => adapter.game === game) ?? null;
}

export function validateTcgFinish(game: SupportedTcg, finish: TcgFinish) {
  if (finish === 'unknown') return { ok: false as const, reason: 'Unknown finish requires manual correction.' };
  const adapter = routeToTcgAdapter(game);
  if (!adapter) return { ok: finish === 'indeterminate' as const, reason: finish === 'indeterminate' ? null : 'Unsupported game cannot accept a game-specific finish.' };
  return adapter.finishTaxonomy.includes(finish)
    ? { ok: true as const, reason: null }
    : { ok: false as const, reason: `${finish} is not in the ${adapter.label} finish taxonomy.` };
}

export function createMixedScanSession(input: { id: string; userId: string; name: string; startedAt?: string; exportMode?: MixedScanSession['exportMode'] }): MixedScanSession {
  return {
    id: input.id,
    userId: input.userId,
    name: input.name.trim() || 'Mixed TCG Intake',
    startedAt: input.startedAt ?? new Date().toISOString(),
    candidates: [],
    unsupported: [],
    pendingSync: 0,
    failedItems: 0,
    exportMode: input.exportMode ?? 'combined',
  };
}

export function addUniversalCandidateToSession(session: MixedScanSession, candidate: UniversalScanCandidate, queued: boolean): MixedScanSession {
  if (candidate.card.game !== candidate.game || candidate.printing.game !== candidate.game) throw new Error('Candidate game metadata is inconsistent.');
  return {
    ...session,
    candidates: [...session.candidates, candidate],
    pendingSync: queued ? session.pendingSync + 1 : session.pendingSync,
  };
}

export function addUnsupportedObservationToSession(session: MixedScanSession, observation: UnsupportedCardObservation): MixedScanSession {
  return { ...session, unsupported: [...session.unsupported, observation] };
}

export function mixedSessionGameTotals(session: MixedScanSession) {
  const totals: Record<SupportedTcg, { cards: number; quantity: number; review: number }> = {
    magic: { cards: 0, quantity: 0, review: 0 },
    pokemon: { cards: 0, quantity: 0, review: 0 },
    one_piece: { cards: 0, quantity: 0, review: 0 },
    lorcana: { cards: 0, quantity: 0, review: 0 },
    unknown: { cards: session.unsupported.length, quantity: 0, review: session.unsupported.length },
  };
  for (const candidate of session.candidates) {
    totals[candidate.game].cards += 1;
    totals[candidate.game].quantity += candidate.quantity;
    if (candidate.gameConfidence.game === 'unknown' || candidate.confidence.requiresConfirmation) totals[candidate.game].review += 1;
  }
  return totals;
}

export function buildUniversalExportRow(input: {
  candidate: UniversalScanCandidate;
  price?: number | null;
  priceSource?: string | null;
  priceTimestamp?: string | null;
  storageLocation?: string | null;
  destinationBinder?: string | null;
  recognitionMethod: string;
}): UniversalScanExportRow {
  return {
    game: input.candidate.game,
    cardName: input.candidate.card.name,
    subtitle: input.candidate.card.subtitle ?? null,
    set: input.candidate.printing.setName ?? input.candidate.printing.setCode,
    cardNumber: input.candidate.printing.cardNumber,
    externalProvider: input.candidate.printing.externalProvider ?? input.candidate.card.provider,
    externalId: input.candidate.printing.externalId ?? input.candidate.card.externalId,
    language: input.candidate.printing.language,
    finish: input.candidate.printing.finish,
    condition: input.candidate.condition,
    quantity: input.candidate.quantity,
    price: input.price ?? null,
    priceSource: input.priceSource ?? null,
    priceTimestamp: input.priceTimestamp ?? null,
    storageLocation: input.storageLocation ?? null,
    destinationBinder: input.destinationBinder ?? null,
    confidence: input.candidate.confidence.overall,
    gameConfidence: input.candidate.gameConfidence.confidence,
    recognitionMethod: input.recognitionMethod,
    notes: input.candidate.notes,
  };
}

export function serializeUniversalScanCsv(rows: UniversalScanExportRow[]) {
  const headers = [
    'game',
    'card name',
    'subtitle',
    'set',
    'card number',
    'external provider',
    'external id',
    'language',
    'finish',
    'condition',
    'quantity',
    'price',
    'price source',
    'price timestamp',
    'storage location',
    'destination binder',
    'confidence',
    'game confidence',
    'recognition method',
    'notes',
  ];
  return [headers, ...rows.map((row) => [
    row.game,
    row.cardName,
    row.subtitle,
    row.set,
    row.cardNumber,
    row.externalProvider,
    row.externalId,
    row.language,
    row.finish,
    row.condition,
    row.quantity,
    row.price,
    row.priceSource,
    row.priceTimestamp,
    row.storageLocation,
    row.destinationBinder,
    row.confidence,
    row.gameConfidence,
    row.recognitionMethod,
    row.notes,
  ])].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function splitUniversalRowsByGame(rows: UniversalScanExportRow[]) {
  const groups: Partial<Record<SupportedTcg, UniversalScanExportRow[]>> = {};
  for (const row of rows) groups[row.game] = [...(groups[row.game] ?? []), row];
  return groups;
}

export function createUnsupportedCardObservation(observations: TcgDetectionObservation[], reason: UnsupportedCardObservation['reason']): UnsupportedCardObservation {
  const top = detectTcgGame(observations);
  return {
    reason,
    observations,
    confidence: top.confidence,
    notes: top.game === 'unknown' ? 'No supported game was detected.' : `Detected ${top.game}, but catalog support is unavailable or insufficient.`,
  };
}

export function universalInventoryContract(candidate: UniversalScanCandidate) {
  return {
    game: candidate.game,
    cardIdentity: candidate.card,
    printingIdentity: candidate.printing,
    ownership: { quantity: candidate.quantity, condition: candidate.condition },
    finish: candidate.printing.finish,
    language: candidate.printing.language,
    storage: candidate.destination.type === 'collection' ? null : candidate.destination,
    pricing: { amount: null, source: null, timestamp: null },
  };
}

function createStubAdapter(input: Omit<TcgRecognitionAdapter, 'supports' | 'recognize'>): TcgRecognitionAdapter {
  return {
    ...input,
    supports(candidate) {
      return candidate.game === input.game;
    },
    async recognize({ catalogCandidates }) {
      return catalogCandidates.filter((candidate) => candidate.game === input.game);
    },
  };
}

function detectionScoreForGame(game: Exclude<SupportedTcg, 'unknown'>, observations: TcgDetectionObservation[]): TcgDetectionCandidate {
  const keywordScore = observations.reduce((score, observation) => score + keywordMatchScore(game, observation), 0);
  const geometryScore = observations.reduce((score, observation) => score + geometryMatchScore(game, observation), 0);
  const raw = Math.min(100, keywordScore + geometryScore);
  const conflicts = observations
    .filter((observation) => keywordMatchScore(game, observation) < 0)
    .map((observation) => `${observation.signal} conflicts with ${game}.`);
  return buildDetectionCandidate(game, Math.max(0, raw), observations, conflicts);
}

function buildDetectionCandidate(game: SupportedTcg, confidence: number, observations: TcgDetectionObservation[], conflicts: string[]): TcgDetectionCandidate {
  return {
    game,
    confidence: Math.round(Math.max(0, Math.min(100, confidence))),
    signals: observations.map((observation) => ({
      key: 'layout',
      label: observation.signal.replaceAll('_', ' '),
      score: Math.round(observation.confidence),
      weight: 1,
      evidence: observation.evidence || observation.value,
    })),
    conflicts,
  };
}

function keywordMatchScore(game: Exclude<SupportedTcg, 'unknown'>, observation: TcgDetectionObservation) {
  const value = observation.value.toLowerCase();
  const confidence = Math.max(0, Math.min(100, observation.confidence));
  const keywords: Record<Exclude<SupportedTcg, 'unknown'>, string[]> = {
    magic: ['magic', 'mana', 'planeswalker', 'creature', 'instant', 'sorcery'],
    pokemon: ['pokemon', 'hp', 'evolves', 'trainer', 'regulation'],
    one_piece: ['one piece', 'op01', 'op02', 'counter', 'don!!', 'leader'],
    lorcana: ['lorcana', 'ink', 'willpower', 'lore', 'dreamborn', 'storyborn'],
  };
  if (keywords[game].some((keyword) => value.includes(keyword))) return confidence * 0.42;
  if (Object.entries(keywords).some(([otherGame, words]) => otherGame !== game && words.some((keyword) => value.includes(keyword)))) return -confidence * 0.2;
  return 0;
}

function geometryMatchScore(game: Exclude<SupportedTcg, 'unknown'>, observation: TcgDetectionObservation) {
  const value = observation.value.toLowerCase();
  const confidence = Math.max(0, Math.min(100, observation.confidence));
  const hints: Record<Exclude<SupportedTcg, 'unknown'>, string[]> = {
    magic: ['magic-layout', 'mana-top-right', 'collector-bottom-left'],
    pokemon: ['pokemon-layout', 'hp-top-right', 'yellow-border', 'regulation-mark'],
    one_piece: ['one-piece-layout', 'card-id-bottom', 'counter-box'],
    lorcana: ['lorcana-layout', 'inkwell', 'lore-diamonds'],
  };
  return hints[game].some((hint) => value.includes(hint)) ? confidence * 0.32 : 0;
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  return `"${String(value).replaceAll('"', '""')}"`;
}
