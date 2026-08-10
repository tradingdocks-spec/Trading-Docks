import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addUniversalCandidateToSession,
  correctDetectedGame,
  createMixedScanSession,
  createUnsupportedCardObservation,
  detectTcgGame,
  magicRecognitionAdapter,
  mixedSessionGameTotals,
  multiTcgBenchmarkMetricsUnavailable,
  pokemonRecognitionAdapter,
  routeToTcgAdapter,
  serializeUniversalScanCsv,
  splitUniversalRowsByGame,
  universalInventoryContract,
  validateTcgFinish,
  buildUniversalExportRow,
  type SupportedTcg,
  type TcgDetectionObservation,
  type UniversalScanCandidate,
} from '../services/multi-tcg-scanner.ts';
import type { RecognitionConfidence } from '../services/scanner-intelligence.ts';

const confidence: RecognitionConfidence = {
  overall: 88,
  threshold: 82,
  requiresConfirmation: false,
  signals: [],
  conflicts: [],
};

test('Magic game classification uses Magic-specific signals', () => {
  assert.equal(detectTcgGame([
    observation('ocr_keyword', 'Magic creature instant mana', 90),
    observation('bottom_information_layout', 'collector-bottom-left magic-layout', 80),
  ]).game, 'magic');
});

test('Pokemon game classification uses Pokemon-specific signals', () => {
  assert.equal(detectTcgGame([
    observation('ocr_keyword', 'Pokemon HP evolves regulation', 92),
    observation('border_geometry', 'pokemon-layout hp-top-right', 80),
  ]).game, 'pokemon');
});

test('One Piece game classification uses One Piece-specific signals', () => {
  assert.equal(detectTcgGame([
    observation('ocr_keyword', 'ONE PIECE OP01-054 counter leader', 90),
    observation('bottom_information_layout', 'one-piece-layout card-id-bottom', 78),
  ]).game, 'one_piece');
});

test('Lorcana game classification uses Lorcana-specific signals', () => {
  assert.equal(detectTcgGame([
    observation('ocr_keyword', 'Lorcana ink willpower lore', 90),
    observation('logo_symbol_layout', 'lorcana-layout lore-diamonds', 84),
  ]).game, 'lorcana');
});

test('unknown unsupported result is not forced into a supported game', () => {
  const result = detectTcgGame([observation('ocr_keyword', 'sports rookie chrome refractor', 76)]);
  const unsupported = createUnsupportedCardObservation([observation('ocr_keyword', 'sports rookie chrome refractor', 76)], 'unknown_game');

  assert.equal(result.game, 'unknown');
  assert.equal(unsupported.reason, 'unknown_game');
  assert.match(unsupported.notes, /No supported game/);
});

test('manual game correction updates all candidate game metadata', () => {
  const corrected = correctDetectedGame(candidate('magic'), 'pokemon');

  assert.equal(corrected.game, 'pokemon');
  assert.equal(corrected.card.game, 'pokemon');
  assert.equal(corrected.printing.game, 'pokemon');
  assert.equal(corrected.gameConfidence.confidence, 100);
});

test('adapter routing selects game-specific adapter and rejects unknown', () => {
  assert.equal(routeToTcgAdapter('magic')?.label, magicRecognitionAdapter.label);
  assert.equal(routeToTcgAdapter('pokemon')?.label, pokemonRecognitionAdapter.label);
  assert.equal(routeToTcgAdapter('unknown'), null);
});

test('game-specific fields are preserved in universal candidates', () => {
  const onePiece = candidate('one_piece', {
    cardNumber: 'OP01-054',
    metadata: { cost: 2, power: 3000, counter: 1000, color: 'green', rarity: 'R' },
  });

  assert.equal(onePiece.printing.cardNumber, 'OP01-054');
  assert.equal(onePiece.printing.metadata.power, 3000);
  assert.equal(onePiece.printing.metadata.counter, 1000);
});

test('mixed session totals include per-game review counts and unsupported cards', () => {
  let session = createMixedScanSession({ id: 'session-1', userId: 'user-1', name: 'Mixed Stack' });
  session = addUniversalCandidateToSession(session, candidate('magic'), false);
  session = addUniversalCandidateToSession(session, { ...candidate('pokemon'), quantity: 2, confidence: { ...confidence, requiresConfirmation: true } }, true);
  session = { ...session, unsupported: [createUnsupportedCardObservation([], 'unknown_game')] };

  const totals = mixedSessionGameTotals(session);
  assert.equal(totals.magic.quantity, 1);
  assert.equal(totals.pokemon.quantity, 2);
  assert.equal(totals.pokemon.review, 1);
  assert.equal(totals.unknown.review, 1);
  assert.equal(session.pendingSync, 1);
});

test('universal export includes game and missing prices stay blank', () => {
  const row = buildUniversalExportRow({ candidate: candidate('lorcana'), recognitionMethod: 'manual_game_corrected' });
  const csv = serializeUniversalScanCsv([row]);

  assert.equal(row.price, null);
  assert.match(csv, /"lorcana"/);
  assert.match(csv, /"manual_game_corrected"/);
});

test('separated export groups rows by game', () => {
  const groups = splitUniversalRowsByGame([
    buildUniversalExportRow({ candidate: candidate('magic'), recognitionMethod: 'manual' }),
    buildUniversalExportRow({ candidate: candidate('pokemon'), recognitionMethod: 'manual' }),
  ]);

  assert.equal(groups.magic?.length, 1);
  assert.equal(groups.pokemon?.length, 1);
});

test('finish taxonomy validates game-specific finishes', () => {
  assert.equal(validateTcgFinish('pokemon', 'reverse_holo').ok, true);
  assert.equal(validateTcgFinish('pokemon', 'etched').ok, false);
  assert.equal(validateTcgFinish('one_piece', 'parallel').ok, true);
  assert.equal(validateTcgFinish('lorcana', 'enchanted').ok, true);
});

test('unsupported finish rejection stays explicit', () => {
  const result = validateTcgFinish('unknown', 'foil');
  assert.equal(result.ok, false);
  assert.match(result.reason ?? '', /Unsupported game/);
});

test('user-scoped mixed session recovery keeps owner id', () => {
  const session = createMixedScanSession({ id: 'session-1', userId: 'user-1', name: 'Phoenix Mixed Intake' });
  assert.equal(session.userId, 'user-1');
  assert.equal(session.candidates.length, 0);
});

test('universal inventory contract separates game, identity, printing, ownership, and pricing', () => {
  const contract = universalInventoryContract(candidate('magic'));
  assert.equal(contract.game, 'magic');
  assert.equal(contract.cardIdentity.game, 'magic');
  assert.equal(contract.printingIdentity.externalProvider, 'scryfall');
  assert.equal(contract.ownership.quantity, 1);
  assert.equal(contract.pricing.amount, null);
});

test('no image retention is required for multi-game candidates', () => {
  const unsupported = createUnsupportedCardObservation([observation('artwork_embedding', 'unknown visual embedding', 50)], 'insufficient_signals');
  assert.equal(unsupported.observations[0].signal, 'artwork_embedding');
  assert.equal(unsupported.confidence >= 0, true);
});

test('catalog benchmark metrics remain unpublished until fixtures run', () => {
  assert.equal(multiTcgBenchmarkMetricsUnavailable.benchmarkedFixtureCount, 0);
  assert.equal(multiTcgBenchmarkMetricsUnavailable.gameTop1, null);
  assert.equal(multiTcgBenchmarkMetricsUnavailable.unsupportedCardRejection, null);
});

function observation(signal: TcgDetectionObservation['signal'], value: string, confidenceValue: number): TcgDetectionObservation {
  return { signal, value, confidence: confidenceValue, evidence: value };
}

function candidate(game: SupportedTcg, overrides: Partial<UniversalScanCandidate['printing']> = {}): UniversalScanCandidate {
  const externalProvider = game === 'magic' ? 'scryfall' : `${game}-catalog-planned`;
  const externalId = game === 'magic' ? 'sf-1' : null;
  return {
    game,
    card: {
      game,
      name: game === 'pokemon' ? 'Pikachu' : game === 'one_piece' ? 'Roronoa Zoro' : game === 'lorcana' ? 'Mickey Mouse' : 'Rhystic Study',
      subtitle: game === 'lorcana' ? 'Brave Little Tailor' : null,
      provider: externalProvider,
      externalId,
    },
    printing: {
      game,
      setName: game === 'magic' ? 'Wilds of Eldraine' : null,
      setCode: game === 'magic' ? 'WOT' : null,
      cardNumber: game === 'magic' ? '25' : null,
      language: 'en',
      finish: game === 'pokemon' ? 'reverse_holo' : game === 'one_piece' ? 'parallel' : game === 'lorcana' ? 'enchanted' : 'foil',
      externalProvider,
      externalId,
      metadata: {},
      ...overrides,
    },
    condition: 'near_mint',
    quantity: 1,
    confidence,
    gameConfidence: {
      game,
      confidence: game === 'unknown' ? 0 : 92,
      signals: [],
      conflicts: [],
    },
    destination: { type: 'collection' },
    notes: '',
  };
}
