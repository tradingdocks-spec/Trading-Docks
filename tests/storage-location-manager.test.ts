import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCollectionCards } from '../mobile/services/collector-workspace.ts';
import {
  buildLocationPath,
  buildStorageLocationManagerState,
  cardsInLocation,
  childLocationOptions,
  createLocationPayload,
  favoriteLocationSummaries,
  formatLocationBreadcrumb,
  locationAssignmentQueueKey,
  locationFallbackLabel,
  rawItemsForLocation,
  recentLocationSummaries,
  searchLocationSummaries,
  validateArchiveLocation,
  validateLocationAssignment,
  validateLocationOwnership,
  validateLocationParent,
} from '../mobile/services/storage-location-manager.ts';

const userId = 'user-1';
const otherUserId = 'user-2';
const rawLocations = [
  { id: 'office', name: 'Office', location_type: 'area', data: { type: 'area', favorite: true, recentUsedAt: '2026-08-05T10:00:00Z' } },
  { id: 'shelf-b', name: 'Shelf B', location_type: 'shelf', data: { type: 'shelf', parentId: 'office', recentUsedAt: '2026-08-05T12:00:00Z' } },
  { id: 'box-14', name: 'Box 14', location_type: 'container', data: { type: 'container', parentId: 'shelf-b' } },
  { id: 'archive', name: 'Old Binder', location_type: 'binder', data: { type: 'binder', archivedAt: '2026-08-01T00:00:00Z' } },
];
const cards = buildCollectionCards({
  locations: rawLocations,
  items: [
    { id: 'card-1', card_name: 'Rhystic Study', location_id: 'box-14', quantity: 2, data: { locationId: 'box-14' } },
    { id: 'card-2', card_name: 'Sol Ring', location_id: null, quantity: 1, data: {} },
  ],
});
const state = buildStorageLocationManagerState({ userId, rawLocations, cards });

test('creates location payload with canonical type and ownership fields', () => {
  assert.deepEqual(createLocationPayload({ id: 'slot-9', userId, name: ' Slot 9 ', type: 'slot', parentId: 'box-14' }), {
    id: 'slot-9',
    user_id: userId,
    name: 'Slot 9',
    location_type: 'slot',
    data: {
      name: 'Slot 9',
      type: 'slot',
      parentId: 'box-14',
      favorite: false,
      archivedAt: null,
      recentUsedAt: null,
    },
  });
});

test('builds full location path from parent hierarchy', () => {
  assert.equal(buildLocationPath('box-14', state.locations).label, 'Office > Shelf B > Box 14');
  assert.equal(formatLocationBreadcrumb(buildLocationPath('box-14', state.locations)), 'Office › Shelf B › Box 14');
  assert.deepEqual(childLocationOptions('shelf-b', state.locations).map((location) => location.id), ['box-14']);
  assert.ok(childLocationOptions(null, state.locations).some((location) => location.id === 'office'));
});

test('search finds locations by path and type', () => {
  assert.equal(searchLocationSummaries(state.summaries, 'shelf b').length, 2);
  assert.equal(searchLocationSummaries(state.summaries, 'container')[0]?.id, 'box-14');
});

test('cards-in-location and unassigned cards are classified', () => {
  assert.equal(cardsInLocation(cards, 'box-14').length, 1);
  assert.equal(state.unassignedCards[0]?.id, 'card-2');
  assert.equal(rawItemsForLocation([{ id: 'card-2', location_id: null }], null).length, 1);
});

test('archive with assigned cards requires explicit behavior', () => {
  const box = state.summaries.find((location) => location.id === 'box-14');
  assert.equal(validateArchiveLocation(box!).ok, false);
  assert.equal(validateArchiveLocation(box!, 'explicit_archive_with_assignments').ok, true);
});

test('cross-user location mutation is rejected', () => {
  const location = state.locations[0];
  assert.deepEqual(validateLocationOwnership({ requestedUserId: otherUserId, authenticatedUserId: userId, location }).ok, false);
});

test('recent and favorite locations are ordered and filtered', () => {
  assert.equal(recentLocationSummaries(state.summaries)[0]?.id, 'shelf-b');
  assert.equal(favoriteLocationSummaries(state.summaries)[0]?.id, 'office');
});

test('assignment validates owned destination and clear assignment', () => {
  assert.equal(validateLocationAssignment({
    assignment: { userId, inventoryItemId: 'card-1', fromLocationId: 'box-14', toLocationId: 'office' },
    authenticatedUserId: userId,
    locations: state.locations,
  }).ok, true);
  assert.equal(validateLocationAssignment({
    assignment: { userId, inventoryItemId: 'card-1', fromLocationId: 'box-14', toLocationId: null },
    authenticatedUserId: userId,
    locations: state.locations,
  }).ok, true);
});

test('archived destination and missing location fallback are explicit', () => {
  assert.equal(validateLocationAssignment({
    assignment: { userId, inventoryItemId: 'card-1', fromLocationId: 'box-14', toLocationId: 'archive' },
    authenticatedUserId: userId,
    locations: state.locations,
  }).ok, false);
  assert.equal(locationFallbackLabel('missing-location'), 'Storage location unavailable');
});

test('invalid parent relationships are rejected', () => {
  assert.equal(validateLocationParent({ id: 'office', parentId: 'office' }, state.locations).ok, false);
  assert.equal(validateLocationParent({ id: 'new', parentId: 'missing' }, state.locations).ok, false);
  assert.equal(validateLocationParent({ id: 'new', parentId: 'office' }, state.locations).ok, true);
});

test('offline assignment dedupe key is user and card scoped', () => {
  assert.equal(
    locationAssignmentQueueKey({ userId, inventoryItemId: 'card-1', fromLocationId: null, toLocationId: 'office' }),
    locationAssignmentQueueKey({ userId, inventoryItemId: 'card-1', fromLocationId: 'box-14', toLocationId: null }),
  );
  assert.notEqual(
    locationAssignmentQueueKey({ userId, inventoryItemId: 'card-1', fromLocationId: null, toLocationId: 'office' }),
    locationAssignmentQueueKey({ userId: otherUserId, inventoryItemId: 'card-1', fromLocationId: null, toLocationId: 'office' }),
  );
});
