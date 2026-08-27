import { MOBILE_CANONICAL_SITE_URL } from './mobile-release-config.ts';
import {
  normalizeScannerCandidate,
  type ScannerCardCandidate,
  type ScannerConfirmation,
} from './scanner-foundation.ts';

export type CanonicalScannerInventoryIdentity = {
  game: 'magic' | 'pokemon';
  canonicalCardId: string;
  printingId: string;
  finish: string | null;
  providerIds: Record<string, string | number>;
  name: string;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  language: string | null;
  provenance: string[];
  identityAuthority: 'provider_confirmed';
};

export class ScannerInventoryAuthorityError extends Error {
  readonly scannerCode = 'invalid_printing';
  readonly offline: boolean;
  constructor(message: string, offline = false) {
    super(message);
    this.name = 'ScannerInventoryAuthorityError';
    this.offline = offline;
  }
}

export async function validateScannerInventoryIdentity(input: {
  confirmation: ScannerConfirmation;
  accessToken: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}): Promise<ScannerConfirmation> {
  const providerIds = scannerCandidateProviderIds(input.confirmation.candidate);
  let response: Response;
  try {
    response = await (input.fetcher ?? fetch)(`${MOBILE_CANONICAL_SITE_URL}/api/card-intelligence/inventory-validation`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        printingId: input.confirmation.candidate.id,
        game: input.confirmation.candidate.gameId,
        finish: input.confirmation.finish,
        providerIds,
      }),
      signal: input.signal,
    });
  } catch {
    throw new ScannerInventoryAuthorityError('Card identity validation is offline. The scan was kept for safe replay.', true);
  }

  const payload = await response.json().catch(() => ({})) as {
    valid?: boolean;
    identity?: CanonicalScannerInventoryIdentity;
    error?: string;
  };
  if (!response.ok || payload.valid !== true || !isCanonicalIdentity(payload.identity)) {
    const reason = response.status >= 500
      ? 'Card Intelligence is temporarily unavailable. This scan needs confirmation before it can be added.'
      : payload.error ?? 'This exact printing could not be validated. Review the scan before adding it.';
    throw new ScannerInventoryAuthorityError(reason);
  }

  const candidate = authoritativeCandidate(input.confirmation.candidate, payload.identity);
  if (!candidate) throw new ScannerInventoryAuthorityError('The validated printing response was incomplete. Review the scan before adding it.');
  return {
    ...input.confirmation,
    candidate,
    finish: payload.identity.finish === 'nonfoil' ? 'normal' : input.confirmation.finish,
    language: payload.identity.language ?? input.confirmation.language,
  };
}

export function scannerCandidateProviderIds(candidate: ScannerCardCandidate) {
  const ids: Record<string, string | number> = { ...(candidate.providerIds ?? {}) };
  const sources = new Set(candidate.providerSources ?? []);
  if (candidate.providerSource && candidate.providerSource !== 'multiple' && candidate.providerSource !== 'visual_index') sources.add(candidate.providerSource);
  if (candidate.tcgplayerProductId) ids.tcgplayer = candidate.tcgplayerProductId;
  if (candidate.providerProductId && sources.has('tcgtracking')) ids.tcgtracking = candidate.providerProductId;
  if (sources.has('scryfall') && !ids.scryfall) ids.scryfall = candidate.id;
  return ids;
}

function authoritativeCandidate(candidate: ScannerCardCandidate, identity: CanonicalScannerInventoryIdentity) {
  const sources = [...new Set(identity.provenance)];
  const tcgplayerId = positiveNumber(identity.providerIds.tcgplayer);
  const tcgtrackingId = identity.providerIds.tcgtracking === undefined ? null : String(identity.providerIds.tcgtracking);
  return normalizeScannerCandidate({
    ...candidate,
    id: identity.printingId,
    gameId: identity.game,
    oracleId: identity.canonicalCardId,
    name: identity.name,
    setCode: identity.setCode,
    setName: identity.setName,
    collectorNumber: identity.collectorNumber,
    language: identity.language,
    providerIds: identity.providerIds,
    providerSources: sources,
    providerSource: sources.length > 1 ? 'multiple' : sources[0] ?? null,
    providerProductId: tcgtrackingId,
    tcgplayerProductId: tcgplayerId,
    identityAuthority: identity.identityAuthority,
  });
}

function isCanonicalIdentity(value: unknown): value is CanonicalScannerInventoryIdentity {
  if (!value || typeof value !== 'object') return false;
  const identity = value as Partial<CanonicalScannerInventoryIdentity>;
  return (identity.game === 'magic' || identity.game === 'pokemon')
    && identity.identityAuthority === 'provider_confirmed'
    && typeof identity.printingId === 'string' && Boolean(identity.printingId)
    && typeof identity.canonicalCardId === 'string' && Boolean(identity.canonicalCardId)
    && typeof identity.name === 'string' && Boolean(identity.name)
    && Boolean(identity.providerIds) && typeof identity.providerIds === 'object'
    && Array.isArray(identity.provenance);
}

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
