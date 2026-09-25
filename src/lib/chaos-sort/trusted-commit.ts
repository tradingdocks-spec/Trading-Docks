import { ScryfallCatalogProvider } from '../card-intelligence/scryfall-provider.ts';
import { TcgTrackingCatalogProvider } from '../card-intelligence/tcgtracking-provider.ts';
import { physicalFinish, physicalLanguage, knownAttribute } from '../card-intelligence/resolution.ts';
import type { CardCatalogProvider } from '../card-intelligence/types.ts';

type Row = Record<string, unknown>;
export type CommitSnapshot = { album: Row; captures: Array<Row & { item: Row | null }> };
function fail(reason: string): never { throw new Error(`CHAOS_TRUSTED_REVIEW_REQUIRED: ${reason}`); }
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const conditionCodes: Record<string, string> = { nm: 'NM', 'near mint': 'NM', near_mint: 'NM', lp: 'LP', 'lightly played': 'LP', lightly_played: 'LP', mp: 'MP', 'moderately played': 'MP', moderately_played: 'MP', hp: 'HP', 'heavily played': 'HP', heavily_played: 'HP', dmg: 'DMG', damaged: 'DMG' };

/** Mirrors the private SQL claim; never accepts a claim supplied by a browser. */
export function chaosCommitClaim(snapshot: CommitSnapshot) {
  const keys = ['id', 'user_id', 'workspace_id', 'destination_id', 'destination_label', 'intake_mode', 'settings', 'settings_revision'];
  return { album: Object.fromEntries(keys.map(key => [key, snapshot.album[key]])),
    captures: snapshot.captures.filter(c => c.status !== 'REMOVED').map(c => ({ capture_id: c.capture_id, revision: c.revision, sha256: c.sha256, status: c.status, item: c.item })) };
}

/** Existing provider adapters supply identity. This module validates claims; it
 * does not persist a second catalog or interpret a review flag as evidence. */
export async function validateChaosCommitItem(item: Row, provider?: CardCatalogProvider): Promise<Row> {
  if (!['confirmed', 'edited'].includes(text(item.humanState)) || item.processingState !== 'ready'
    || !['high_confidence', 'review'].includes(text(item.recognitionState)) || item.quantity !== 1) fail('Resolve the physical card review.');
  const conditionKey = text(item.condition).toLowerCase();
  const condition = Object.hasOwn(conditionCodes, conditionKey) ? conditionCodes[conditionKey] : null;
  if (!condition) fail('An explicit supported physical condition is required.');
  const game = text(item.gameId).toLowerCase();
  if (!['magic', 'pokemon'].includes(game)) fail('Game is unresolved.');
  const printingId = text(item.printingId) || text(item.scryfallId);
  if (!printingId) fail('Exact printing is required.');
  const catalog = provider ?? (game === 'magic' ? new ScryfallCatalogProvider() : new TcgTrackingCatalogProvider());
  const printing = await catalog.printing(printingId);
  if (!printing || printing.identityAuthority !== 'provider_confirmed' || printing.printingId !== printingId || printing.game !== game) fail('Exact printing is not provider-confirmed.');
  // Every supplied identifier must agree, even when another one matched.
  if (text(item.scryfallId) && text(item.scryfallId) !== printing.printingId) fail('Printing identifiers conflict.');
  if (text(item.canonicalCardId) && text(item.canonicalCardId) !== printing.canonicalCardId) fail('Canonical identity conflicts.');
  if (!printing.setCode || !printing.collectorNumber || text(item.setCode).toLowerCase() !== printing.setCode.toLowerCase()
    || text(item.collectorNumber).toLowerCase() !== printing.collectorNumber.toLowerCase()
    || text(item.cardName).toLowerCase() !== printing.name.toLowerCase()) fail('Printing/name/set/collector metadata conflicts.');
  if (text(item.setName) && text(item.setName).toLowerCase() !== printing.setName?.toLowerCase()) fail('Set identity conflicts.');
  if (item.providerIds && (typeof item.providerIds !== 'object' || Array.isArray(item.providerIds))) fail('Invalid provider identities.');
  for (const [key, value] of Object.entries((item.providerIds ?? {}) as Row)) {
    if (value !== null && value !== undefined && (!Object.hasOwn(printing.providerIds, key) || String(value) !== String(printing.providerIds[key]))) fail('Provider identity conflicts.');
  }
  if (text(item.variant) || item.variantAmbiguous === true) fail('Variant evidence is not supported by this provider contract.');
  const finishes = [...new Set(printing.finishes.map(physicalFinish).filter((v): v is string => v !== null))];
  const claimedFinish = physicalFinish(item.finish);
  // Unknown is not a conflicting physical observation; derive only a singleton.
  const finish = claimedFinish ?? (!knownAttribute(item.finish) && finishes.length === 1 ? finishes[0] : null);
  if (!finish || !finishes.includes(finish)) fail('Finish is ambiguous or incompatible with the printing.');
  const language = physicalLanguage(item.language), catalogLanguage = physicalLanguage(printing.language);
  if (!language || !catalogLanguage || language !== catalogLanguage) fail('Language needs a verified provider mapping.');
  return { ...item, cardName: printing.name, gameId: printing.game, setCode: printing.setCode,
    collectorNumber: printing.collectorNumber, condition, finish, language,
    trustedValidation: { version: 1, canonicalCardId: printing.canonicalCardId, printingId: printing.printingId,
      providerIds: printing.providerIds, provenance: printing.provenance, identity: 'CATALOG_VERIFIED',
      finish: 'CATALOG_VERIFIED', language: 'CATALOG_VERIFIED', condition: 'USER_OBSERVED' } };
}

export async function validateChaosCommitSnapshot(snapshot: CommitSnapshot, provider?: CardCatalogProvider) {
  if (snapshot.album.state !== 'ACTIVE') fail('Batch is not open.');
  const captures = snapshot.captures.filter(c => c.status !== 'REMOVED');
  if (!captures.length || captures.length > 100) fail('Batch capacity is invalid.');
  const result: Row[] = [];
  for (const capture of captures) {
    if (capture.status !== 'RECEIVED' || !capture.item || capture.item.captureId !== capture.capture_id
      || capture.item.id !== capture.capture_id || capture.item.batchId !== snapshot.album.id) fail('Capture is not ready.');
    result.push(await validateChaosCommitItem(capture.item, provider));
  }
  return result;
}
