import test from 'node:test';
import assert from 'node:assert/strict';
import { chaosPrintingDetails, chaosResultStatus, chaosSortLabel, chaosCandidateMarketPrice } from '../src/lib/chaos-sort/results-presentation.ts';
import { recoveredScanItem } from '../src/lib/chaos-sort/scan-album-client.ts';
const base = { ...recoveredScanItem('batch', 'capture'), processingState: 'ready' as const, humanState: 'confirmed' as const, recognitionState: 'review' as const, cardName: 'Card', setCode: 'TLA', collectorNumber: '238', scryfallId: 'printing', finish: 'unknown', language: 'en', marketPrice: 0.23, recognitionCandidates: [{ id: 'printing', name: 'Card', setName: 'Avatar: The Last Airbender', setCode: 'TLA', collectorNumber: '238', prices: [{ label: 'Nonfoil reference', value: 0.23, available: true, currency: 'USD', source: 'Scryfall' }] }] };
test('presentation follows confirmed commit eligibility, not machine confidence alone', () => {
  assert.equal(chaosResultStatus(base), 'Ready to add');
  assert.equal(chaosResultStatus({ ...base, humanState: 'pending', recognitionState: 'high_confidence' }), 'Review needed');
  assert.equal(chaosResultStatus({ ...base, processingState: 'failed' }), 'Failed');
  assert.equal(chaosResultStatus({ ...base, recognitionState: 'unknown' }), 'Unknown');
});
test('saved exact candidate supplies set name and price provenance without inventing finish', () => {
  const before = JSON.stringify(base), details = chaosPrintingDetails(base);
  assert.equal(details.printing, 'Avatar: The Last Airbender · TLA · #238');
  assert.equal(details.finish, 'Finish not determined');
  assert.equal(details.language, 'English');
  assert.equal(details.priceLabel, 'Nonfoil reference');
  assert.equal(details.price, 0.23);
  assert.equal(JSON.stringify(base), before);
});
test('manual printing edits cannot retain a previous candidate set name or price provenance', () => {
  const details = chaosPrintingDetails({ ...base, setCode: 'OTHER' });
  assert.equal(details.printing, 'OTHER · #238');
  assert.equal(details.priceSource, null);
  assert.equal(details.priceLabel, 'Price reference');
});
test('missing metadata is explicit and missing prices are not fabricated', () => {
  const details = chaosPrintingDetails({ ...base, language: 'unknown', marketPrice: null });
  assert.equal(details.language, 'Language not determined');
  assert.equal(details.price, null);
  assert.equal(chaosPrintingDetails({ ...base, marketPrice: 0 }).price, 0);
  assert.equal(chaosSortLabel('Bulk C/U'), 'Bulk commons & uncommons');
});

test('manual search market references retain provenance and missing prices clear stale amounts', () => {
  const candidate = { ...base.recognitionCandidates[0], prices: [{ market: 0.5, currency: 'USD', source: 'scryfall:nonfoil' }] };
  assert.equal(chaosCandidateMarketPrice(candidate), 0.5);
  assert.equal(chaosPrintingDetails({ ...base, marketPrice: 0.5, recognitionCandidates: [candidate] }).priceLabel, 'Nonfoil reference');
  assert.equal(chaosCandidateMarketPrice({ ...candidate, prices: [] }), null);
});
