import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCollectionCards } from '../mobile/services/collector-workspace.ts';
import {
  applyTradeStatusOptimistically,
  applyWishlistPriorityOptimistically,
  buildTradeBinderWishlistState,
  filterTradeBinderItems,
  filterWishlistItems,
  matchWishlistToBinderItem,
  sortTradeBinderItems,
  sortWishlistItems,
  tradeWishlistQueueKey,
} from '../mobile/services/trade-binder-wishlist.ts';

const userId = 'user-1';
const cards = buildCollectionCards({
  locations: [{ id: 'binder-1', name: 'Trade Binder', location_type: 'binder', data: { name: 'Trade Binder', type: 'binder' } }],
  items: [
    {
      id: 'rhystic-wot-foil',
      card_name: 'Rhystic Study',
      set_code: 'wot',
      collector_number: '25',
      quantity: 2,
      updated_at: '2026-08-05T12:00:00Z',
      location_id: 'binder-1',
      data: { finish: 'foil', condition: 'near_mint', locationId: 'binder-1' },
    },
    {
      id: 'sol-ring-normal',
      card_name: 'Sol Ring',
      set_code: 'ltc',
      collector_number: '301',
      quantity: 1,
      updated_at: '2026-08-04T12:00:00Z',
      data: { finish: 'normal', condition: 'lightly_played' },
    },
  ],
  tradeStatuses: [
    { inventory_item_id: 'rhystic-wot-foil', status: 'available' },
    { inventory_item_id: 'sol-ring-normal', status: 'reserved' },
  ],
});

const state = buildTradeBinderWishlistState({
  userId,
  cards,
  tradeRows: [
    { inventory_item_id: 'rhystic-wot-foil', status: 'available', notes: 'Bring to card show' },
    { inventory_item_id: 'sol-ring-normal', status: 'reserved' },
  ],
  wishlistRows: [
    { id: 'wish-1', card_name: 'Rhystic Study', set_code: 'WOT', target_condition: 'near_mint', target_finish: 'foil', priority: 'grail', notes: 'Exact copy' },
    { id: 'wish-2', card_name: 'Sol Ring', priority: 'medium' },
    { id: 'wish-3', card_name: 'Rhystic Study', set_code: 'WOT', target_condition: 'damaged', target_finish: 'foil', priority: 'high' },
    { id: 'wish-4', card_name: 'Rhystic Study', set_code: 'WOT', target_condition: 'near_mint', target_finish: 'normal', priority: 'high' },
  ],
});

test('binder search and filters include status, notes, condition, finish, and storage', () => {
  assert.equal(filterTradeBinderItems(state.tradeItems, { query: 'card show' }).length, 1);
  assert.equal(filterTradeBinderItems(state.tradeItems, { status: 'available' }).length, 1);
  assert.equal(filterTradeBinderItems(state.tradeItems, { condition: 'near_mint' }).length, 1);
  assert.equal(filterTradeBinderItems(state.tradeItems, { finish: 'foil' }).length, 1);
  assert.equal(filterTradeBinderItems(state.tradeItems, { storageLocationId: 'binder-1' }).length, 1);
});

test('binder status update is optimistic and rollback-safe', () => {
  const result = applyTradeStatusOptimistically(state.tradeItems, 'rhystic-wot-foil', 'pending');
  assert.equal(result.items.find((item) => item.id === 'rhystic-wot-foil')?.status, 'pending');
  assert.equal(result.previous.find((item) => item.id === 'rhystic-wot-foil')?.status, 'available');
});

test('wishlist add/remove is represented by row presence and empty states', () => {
  assert.equal(state.wishlistItems.length, 4);
  assert.equal(buildTradeBinderWishlistState({ userId, cards, tradeRows: [], wishlistRows: [] }).wishlistSummary.totalWishlistItems, 0);
});

test('wishlist priority sorting and optimistic update work', () => {
  assert.equal(sortWishlistItems(state.wishlistItems, 'priority')[0]?.priority, 'grail');
  const result = applyWishlistPriorityOptimistically(state.wishlistItems, 'wish-2', 'high');
  assert.equal(result.items.find((item) => item.id === 'wish-2')?.priority, 'high');
  assert.equal(result.previous.find((item) => item.id === 'wish-2')?.priority, 'medium');
});

test('strict exact-printing match requires specified set, condition, and finish', () => {
  const exact = state.matches.find((match) => match.wishlistItem.id === 'wish-1');
  assert.equal(exact?.matchType, 'exact');
  assert.equal(exact?.quantityAvailable, 2);
});

test('flexible match allows unspecified set condition and finish', () => {
  const flexible = state.matches.find((match) => match.wishlistItem.id === 'wish-2');
  assert.equal(flexible?.matchType, 'flexible');
});

test('condition and finish mismatches are rejected', () => {
  const binder = state.tradeItems.find((item) => item.id === 'rhystic-wot-foil')!;
  assert.deepEqual(matchWishlistToBinderItem(state.wishlistItems.find((item) => item.id === 'wish-3')!, binder), { ok: false, reason: 'condition' });
  assert.deepEqual(matchWishlistToBinderItem(state.wishlistItems.find((item) => item.id === 'wish-4')!, binder), { ok: false, reason: 'finish' });
});

test('wishlist matching distinguishes same-name cards across games and variants', () => {
  const mixedCards = buildCollectionCards({
    items: [
      {
        id: 'magic-pikachu',
        card_name: 'Pikachu',
        set_code: 'SLD',
        collector_number: '1',
        quantity: 1,
        data: { finish: 'normal', condition: 'near_mint', language: 'English' },
      },
      {
        id: 'pokemon-pikachu',
        game_id: 'pokemon',
        product_type: 'card',
        card_name: 'Pikachu',
        set_code: 'sv08',
        collector_number: '057/191',
        quantity: 1,
        variant: 'Holofoil',
        language: 'English',
        data: { condition: 'near_mint' },
      },
    ],
    tradeStatuses: [
      { inventory_item_id: 'magic-pikachu', status: 'available' },
      { inventory_item_id: 'pokemon-pikachu', status: 'available' },
    ],
  });
  const mixedState = buildTradeBinderWishlistState({
    userId,
    cards: mixedCards,
    tradeRows: [
      { inventory_item_id: 'magic-pikachu', status: 'available' },
      { inventory_item_id: 'pokemon-pikachu', status: 'available' },
    ],
    wishlistRows: [
      {
        id: 'wish-pokemon',
        game_id: 'pokemon',
        product_type: 'card',
        card_name: 'Pikachu',
        set_code: 'SV08',
        target_condition: 'near_mint',
        target_variant: 'Holofoil',
        target_language: 'English',
      },
    ],
  });

  assert.deepEqual(mixedState.matches.map((match) => match.binderItem.id), ['pokemon-pikachu']);
});

test('quantity handling excludes zero-quantity matches', () => {
  const zeroState = buildTradeBinderWishlistState({
    userId,
    cards: [{ ...cards[0], quantityOwned: 0 }],
    tradeRows: [{ inventory_item_id: 'rhystic-wot-foil', status: 'available' }],
    wishlistRows: [{ id: 'wish-1', card_name: 'Rhystic Study' }],
  });
  assert.equal(zeroState.matches.length, 0);
});

test('storage display is searchable on binder items', () => {
  assert.equal(filterTradeBinderItems(state.tradeItems, { query: 'Trade Binder' }).length, 1);
});

test('wishlist filters support matched, unmatched, and no-results states', () => {
  assert.equal(filterWishlistItems(state.wishlistItems, state.matches, { matchState: 'matched' }).length, 2);
  assert.equal(filterWishlistItems(state.wishlistItems, state.matches, { matchState: 'unmatched' }).length, 2);
  assert.equal(filterWishlistItems(state.wishlistItems, state.matches, { query: 'does not exist' }).length, 0);
});

test('binder sorting and summaries are deterministic', () => {
  assert.equal(sortTradeBinderItems(state.tradeItems, 'quantity')[0]?.id, 'rhystic-wot-foil');
  assert.equal(state.tradeSummary.totalQuantityAvailable, 3);
  assert.equal(state.wishlistSummary.exactMatchCount, 1);
});

test('offline replay keys remain user isolated and deduplicated per target', () => {
  assert.equal(
    tradeWishlistQueueKey({ userId, targetId: 'rhystic-wot-foil', type: 'trade_status' }),
    tradeWishlistQueueKey({ userId, targetId: 'rhystic-wot-foil', type: 'trade_status' }),
  );
  assert.notEqual(
    tradeWishlistQueueKey({ userId, targetId: 'rhystic-wot-foil', type: 'trade_status' }),
    tradeWishlistQueueKey({ userId: 'user-2', targetId: 'rhystic-wot-foil', type: 'trade_status' }),
  );
});
