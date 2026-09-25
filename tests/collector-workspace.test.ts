import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCollectionCards,
  buildCollectionLocationPathLabel,
  buildCollectionPageInfo,
  buildInventoryHealth,
  buildInventorySearchFilterExpression,
  collectionRequestKey,
  countActiveCollectionFilters,
  cursorForCollectionCard,
  decodeCollectionCursor,
  displayPrinting,
  displayStorageLocation,
  displayVariant,
  filterLooseCollectionCards,
  filterCollectionCards,
  isPhysicalTradeBinderCard,
  normalizeCardFinish,
  mergeCollectionPages,
  priceLabel,
  resolveCollectionViewState,
  resolveCardImageUrl,
  shouldRenderCollectionItems,
  shouldAcceptCollectionResponse,
  sortCollectionCards,
  summarizeCollectionCards,
  collectorCacheKeyForUser,
} from '../mobile/services/collector-workspace.ts';
import {
  buildStorageLocationManagerState,
  cardsInLocationTree,
} from '../mobile/services/storage-location-manager.ts';

const cards = buildCollectionCards({
  locations: [
    {
      id: 'binder-1',
      name: 'Commander Binder',
      location_type: 'binder',
      data: { name: 'Commander Binder', type: 'binder' },
    },
  ],
  items: [
    {
      id: 'rhystic-wot-foil',
      card_name: 'Rhystic Study',
      set_code: 'wot',
      collector_number: '25',
      quantity: 2,
      inventory_value: 84,
      updated_at: '2026-08-03T12:00:00Z',
      data: { inventoryValueSemantics: "total_row_v1",
        name: 'Rhystic Study',
        set: 'wot',
        setName: 'Wilds of Eldraine',
        collectorNumber: '25',
        finish: 'Foil',
        condition: 'Near Mint',
        locationId: 'binder-1',
        binderPage: 4,
        binderSlot: 'B2',
        imageUrl: 'https://cards.example/rhystic.jpg',
      },
    },
    {
      id: 'sol-ring',
      card_name: 'Sol Ring',
      set_code: 'ltc',
      collector_number: '301',
      quantity: 501,
      inventory_value: null,
      updated_at: '2026-08-01T12:00:00Z',
      data: {
        name: 'Sol Ring',
        set: 'ltc',
        collectorNumber: '301',
        finish: 'Normal',
        condition: 'Lightly Played',
      },
    },
  ],
  tradeStatuses: [
    { inventory_item_id: 'rhystic-wot-foil', status: 'available' },
  ],
  wishlist: [
    { card_name: 'Sol Ring', set_code: 'ltc', target_finish: 'normal' },
  ],
});

test('Collector Workspace search filters by card and set text', () => {
  assert.equal(filterCollectionCards(cards, { query: 'rhystic' }).length, 1);
  assert.equal(filterCollectionCards(cards, { query: 'ltc 301' }).length, 1);
});

test('Collector Workspace server search includes matching storage locations', () => {
  const expression = buildInventorySearchFilterExpression('Binder', ['binder-1', 'box-2']);

  assert.match(expression, /card_name\.ilike\.%Binder%/);
  assert.match(expression, /set_code\.ilike\.%Binder%/);
  assert.match(expression, /collector_number\.ilike\.%Binder%/);
  assert.match(expression, /location_id\.in\.\("binder-1","box-2"\)/);
});

test('Collector Workspace search expression covers canonical inventory fields', () => {
  const expression = buildInventorySearchFilterExpression('#89');

  assert.match(expression, /card_name\.ilike\.%89%/);
  assert.match(expression, /sku\.ilike\.%89%/);
  assert.match(expression, /set_code\.ilike\.%89%/);
  assert.match(expression, /data->>setName\.ilike\.%89%/);
  assert.match(expression, /collector_number\.ilike\.%89%/);
  assert.match(expression, /data->>condition\.ilike\.%89%/);
});

test('Collector Workspace search matches every query term across canonical fields', () => {
  assert.equal(filterCollectionCards(cards, { query: 'rhystic 25' }).length, 1);
  assert.equal(filterCollectionCards(cards, { query: 'RHYSTIC   25' }).length, 1);
  assert.equal(filterCollectionCards(cards, { query: 'rhystic-25' }).length, 1);
  assert.equal(filterCollectionCards(cards, { query: 'nope 25' }).length, 0);
});

test('Collector Workspace sorting supports quantity and set printing order', () => {
  assert.equal(sortCollectionCards(cards, 'quantity_desc')[0]?.cardName, 'Sol Ring');
  assert.equal(sortCollectionCards(cards, 'set_asc')[0]?.printing.setCode, 'ltc');
});

test('exact-printing display includes set and collector number', () => {
  assert.equal(displayPrinting(cards[0].printing), 'WOT #25');
});

test('storage-location display includes binder pocket details', () => {
  assert.equal(displayStorageLocation(cards[0]), 'Commander Binder › Page 4 › Slot B2');
});

test('storage-location display resolves full parent path before pocket details', () => {
  const [card] = buildCollectionCards({
    locations: [
      { id: 'office', name: 'Office', location_type: 'custom', data: { name: 'Office', type: 'area' } },
      { id: 'shelf-b', name: 'Shelf B', location_type: 'custom', data: { name: 'Shelf B', type: 'shelf', parentId: 'office' } },
      { id: 'box-14', name: 'Box 14', location_type: 'box', data: { name: 'Box 14', type: 'box', parentId: 'shelf-b' } },
    ],
    items: [
      {
        id: 'stored-path-card',
        card_name: 'Lightning Bolt',
        quantity: 1,
        location_id: 'box-14',
        data: { name: 'Lightning Bolt', locationId: 'box-14', binderSlot: 'B3' },
      },
    ],
  });

  assert.equal(buildCollectionLocationPathLabel('box-14', [
    { id: 'office', name: 'Office', location_type: 'custom', data: { name: 'Office', type: 'area' } },
    { id: 'shelf-b', name: 'Shelf B', location_type: 'custom', data: { name: 'Shelf B', type: 'shelf', parentId: 'office' } },
    { id: 'box-14', name: 'Box 14', location_type: 'box', data: { name: 'Box 14', type: 'box', parentId: 'shelf-b' } },
  ]), 'Office › Shelf B › Box 14');
  assert.equal(displayStorageLocation(card), 'Office › Shelf B › Box 14 › Slot B3');
  assert.equal(filterCollectionCards([card], { query: 'shelf b' }).length, 1);
});

test('nonfoil is normalized as normal, not foil', () => {
  assert.equal(normalizeCardFinish('Nonfoil'), 'normal');
  assert.equal(normalizeCardFinish('Foil'), 'foil');
});

test('loose collection view excludes physical trade binder locations only', () => {
  const collection = buildCollectionCards({
    locations: [
      { id: 'trade-binder', name: 'Trade Binder', location_type: 'binder', data: { name: 'Trade Binder', type: 'binder' } },
      { id: 'binder-2', name: 'Commander Binder', location_type: 'binder', data: { name: 'Commander Binder', type: 'binder' } },
    ],
    items: [
      { id: 'trade-copy', card_name: 'Goblin Guide', quantity: 1, location_id: 'trade-binder', data: { name: 'Goblin Guide', locationId: 'trade-binder' } },
      { id: 'vault-copy', card_name: 'Sol Ring', quantity: 1, location_id: 'binder-2', data: { name: 'Sol Ring', locationId: 'binder-2' } },
    ],
  });

  assert.equal(isPhysicalTradeBinderCard(collection[0]), true);
  assert.deepEqual(filterLooseCollectionCards(collection).map((card) => card.id), ['vault-copy']);
});

test('storage browser includes child locations when a parent is selected', () => {
  const state = buildStorageLocationManagerState({
    userId: 'user-1',
    rawLocations: [
      { id: 'binder', name: 'Binder 1', location_type: 'binder', data: { name: 'Binder 1', type: 'binder' } },
      { id: 'page-2', name: 'Page 2', location_type: 'custom', data: { name: 'Page 2', type: 'section', parentId: 'binder' } },
      { id: 'slot-b3', name: 'Slot B3', location_type: 'custom', data: { name: 'Slot B3', type: 'slot', parentId: 'page-2' } },
    ],
    cards: buildCollectionCards({
      locations: [
        { id: 'binder', name: 'Binder 1', location_type: 'binder', data: { name: 'Binder 1', type: 'binder' } },
        { id: 'page-2', name: 'Page 2', location_type: 'custom', data: { name: 'Page 2', type: 'section', parentId: 'binder' } },
        { id: 'slot-b3', name: 'Slot B3', location_type: 'custom', data: { name: 'Slot B3', type: 'slot', parentId: 'page-2' } },
      ],
      items: [
        { id: 'stored-copy', card_name: 'Counterspell', quantity: 2, location_id: 'slot-b3', data: { name: 'Counterspell', locationId: 'slot-b3' } },
      ],
    }),
  });

  assert.equal(cardsInLocationTree(state.cards, 'binder', state.locations).length, 1);
});

test('trade-binder indicator is resolved from trade status rows', () => {
  assert.equal(cards[0].tradeBinderStatus, 'available');
  assert.equal(summarizeCollectionCards(cards, 'collector').tradeBinderCount, 1);
});

test('collection summary reports stored and unassigned card quantities', () => {
  const summary = summarizeCollectionCards(cards, 'collector');

  assert.equal(summary.storedCards, 1);
  assert.equal(summary.unassignedCards, 1);
  assert.equal(summary.storedQuantity, 2);
  assert.equal(summary.unassignedQuantity, 501);
});

test('Inventory command center counts composable filters without treating defaults as active', () => {
  assert.equal(countActiveCollectionFilters({ gameId: 'all', productType: 'all', condition: 'all' }), 0);
  assert.equal(countActiveCollectionFilters({
    query: 'sol',
    gameId: 'magic',
    productType: 'card',
    condition: 'near_mint',
    finish: 'foil',
    storageLocationId: 'binder-1',
  }), 6);
});

test('Inventory Health surfaces actionable loaded-record issues', () => {
  const health = buildInventoryHealth(cards);

  assert.equal(health.locatedQuantity, 2);
  assert.equal(health.unassignedQuantity, 501);
  assert.ok(health.score < 100);
  assert.equal(health.issues.some((issue) => issue.id === 'unassigned' && issue.count === 501), true);
  assert.equal(health.issues.some((issue) => issue.id === 'missing_price' && issue.count === 1), true);
});

test('wishlist indicator is resolved from wishlist rows', () => {
  assert.equal(cards[1].wishlistStatus, 'wanted');
  assert.equal(summarizeCollectionCards(cards, 'collector').wishlistCount, 1);
});

test('wishlist-only targets are excluded from owned collection count and value', () => {
  const wishlistOnlyCards = buildCollectionCards({
    items: [],
    wishlist: [{ card_name: 'Black Lotus', set_code: 'lea', target_finish: 'normal' }],
  });
  const summary = summarizeCollectionCards(wishlistOnlyCards, 'collector');

  assert.equal(summary.totalOwnedCards, 0);
  assert.equal(summary.uniquePrintings, 0);
  assert.equal(summary.knownMarketValue, null);
  assert.equal(summary.wishlistCount, 0);
});

test('Free card-limit behavior reports remaining and exceeded states', () => {
  const summary = summarizeCollectionCards(cards, 'free');
  assert.equal(summary.freeCardLimit, 500);
  assert.equal(summary.freeCardLimitRemaining, 0);
  assert.equal(summary.freeCardLimitExceeded, true);
});

test('empty state and no-results state are distinct', () => {
  assert.equal(resolveCollectionViewState({ loading: false, totalCount: 0, visibleCount: 0 }), 'empty');
  assert.equal(resolveCollectionViewState({ loading: false, totalCount: 2, visibleCount: 0 }), 'no_results');
});

test('loading-more and retry states are explicit', () => {
  assert.equal(resolveCollectionViewState({ loading: false, loadingMore: true, totalCount: 2, visibleCount: 2 }), 'loading_more');
  assert.equal(resolveCollectionViewState({ loading: false, error: 'network failed', totalCount: 2, visibleCount: 2 }), 'error');
});

test('missing price is shown as unavailable, not zero', () => {
  assert.equal(cards[1].marketPrice.amount, null);
  assert.equal(priceLabel(cards[1]), 'Price unavailable');
  assert.equal(summarizeCollectionCards(cards, 'collector').missingPriceCount, 1);
});

test('default zero inventory value is treated as missing price', () => {
  const [card] = buildCollectionCards({
    items: [
      {
        id: 'zero-default',
        card_name: 'Forest',
        quantity: 1,
        inventory_value: 0,
        data: { name: 'Forest', set: 'fdn', collectorNumber: '281' },
      },
    ],
  });

  assert.equal(card.marketPrice.amount, null);
  assert.equal(priceLabel(card), 'Price unavailable');
});

test('wishlist matching does not infer specific finish from unknown owned finish', () => {
  const [card] = buildCollectionCards({
    items: [
      {
        id: 'unknown-finish',
        card_name: 'Lightning Bolt',
        set_code: 'clu',
        collector_number: '141',
        quantity: 1,
        data: { name: 'Lightning Bolt', set: 'clu', collectorNumber: '141' },
      },
    ],
    wishlist: [
      { card_name: 'Lightning Bolt', set_code: 'clu', target_finish: 'foil' },
    ],
  });

  assert.equal(card.printing.finish, 'unknown');
  assert.equal(card.wishlistStatus, 'not_wishlisted');
});

test('filter combinations require every selected status to match', () => {
  const filtered = filterCollectionCards(cards, {
    query: 'sol',
    wishlistStatus: 'wanted',
    tradeBinderStatus: 'available',
  });

  assert.equal(filtered.length, 0);
});

test('mobile stale collection cache keys are scoped by auth user id', () => {
  assert.notEqual(collectorCacheKeyForUser('user-a'), collectorCacheKeyForUser('user-b'));
  assert.equal(
    collectorCacheKeyForUser('user-a'),
    'trading-docks-collector-workspace-cache-v1:user-a',
  );
});

test('Collector Workspace first page and next page cursors are deterministic', () => {
  const pageInfo = buildCollectionPageInfo({
    cards: [cards[0]],
    request: { sort: 'recently_updated', limit: 1 },
  });

  assert.equal(pageInfo.hasMore, true);
  assert.equal(pageInfo.pageSize, 1);
  assert.equal(decodeCollectionCursor(pageInfo.nextCursor)?.id, 'rhystic-wot-foil');
  assert.equal(decodeCollectionCursor(pageInfo.nextCursor)?.sort, 'recently_updated');
});

test('Collector Workspace end-of-results page has no next cursor', () => {
  const pageInfo = buildCollectionPageInfo({
    cards,
    request: { sort: 'recently_updated', limit: 100 },
  });

  assert.equal(pageInfo.hasMore, false);
  assert.equal(pageInfo.nextCursor, null);
  assert.equal(resolveCollectionViewState({ loading: false, totalCount: cards.length, visibleCount: cards.length, hasMore: false }), 'end');
  assert.equal(shouldRenderCollectionItems('end', cards.length), true);
});

test('Collection inventory rows remain visible when pagination reaches the end', () => {
  assert.equal(shouldRenderCollectionItems('ready', 2), true);
  assert.equal(shouldRenderCollectionItems('loading_more', 2), true);
  assert.equal(shouldRenderCollectionItems('end', 2), true);
  assert.equal(shouldRenderCollectionItems('no_results', 0), false);
  assert.equal(shouldRenderCollectionItems('empty', 0), false);
});

test('Collector Workspace page merge prevents duplicate cards', () => {
  const merged = mergeCollectionPages([cards[0]], [cards[0], cards[1]]);

  assert.deepEqual(merged.map((card) => card.id), ['rhystic-wot-foil', 'sol-ring']);
});

test('Collector Workspace cursor resets when search, filters, or sort changes', () => {
  const base = collectionRequestKey({ filter: { query: 'sol' }, sort: 'recently_updated' });
  const searched = collectionRequestKey({ filter: { query: 'rhystic' }, sort: 'recently_updated' });
  const filtered = collectionRequestKey({ filter: { query: 'sol', tradeBinderStatus: 'tradeable' }, sort: 'recently_updated' });
  const sorted = collectionRequestKey({ filter: { query: 'sol' }, sort: 'name_asc' });

  assert.notEqual(base, searched);
  assert.notEqual(base, filtered);
  assert.notEqual(base, sorted);
});

test('Collector Workspace stale responses are rejected by request key', () => {
  const active = collectionRequestKey({ filter: { query: 'new' }, sort: 'name_asc' });
  const stale = collectionRequestKey({ filter: { query: 'old' }, sort: 'name_asc' });

  assert.equal(shouldAcceptCollectionResponse(active, active), true);
  assert.equal(shouldAcceptCollectionResponse(active, stale), false);
});

test('Collector Workspace cursor encodes exact-printing sort position without changing fields', () => {
  const cursor = cursorForCollectionCard(cards[0], 'set_asc');
  const decoded = decodeCollectionCursor(cursor);

  assert.equal(decoded?.id, 'rhystic-wot-foil');
  assert.equal(displayPrinting(cards[0].printing), 'WOT #25');
  assert.equal(cards[0].condition, 'near_mint');
  assert.equal(cards[0].printing.finish, 'foil');
});

test('card image fallback uses canonical Scryfall printing identifiers only', () => {
  assert.equal(
    resolveCardImageUrl({
      explicitImageUrl: 'https://cards.example/runed-stalactite.jpg',
      scryfallId: 'ignored',
    }),
    'https://cards.example/runed-stalactite.jpg',
  );
  assert.equal(
    resolveCardImageUrl({ scryfallId: 'abc-123' }),
    'https://api.scryfall.com/cards/abc-123?format=image&version=normal',
  );
  assert.equal(
    resolveCardImageUrl({ setCode: 'lcc', collectorNumber: '310' }),
    'https://api.scryfall.com/cards/lcc/310?format=image&version=normal',
  );
  assert.equal(resolveCardImageUrl({ setCode: 'lcc' }), null);
});

test('legacy Magic rows remain Magic without explicit game columns', () => {
  assert.equal(cards[0].gameId, 'magic');
  assert.equal(cards[0].gameLabel, 'Magic: The Gathering');
  assert.equal(cards[0].productType, 'card');
  assert.equal(displayVariant(cards[0]), 'Foil');
});

test('Collection supports Pokemon singles through the existing inventory adapter', () => {
  const mixed = buildCollectionCards({
    items: [
      {
        id: 'magic-bolt',
        card_name: 'Shared Name',
        set_code: 'sld',
        collector_number: '123',
        quantity: 1,
        data: { condition: 'Near Mint', finish: 'Normal', language: 'English' },
      },
      {
        id: 'pokemon-shared-name',
        card_name: 'Shared Name',
        game_id: 'pokemon',
        product_type: 'card',
        provider_category_id: '3',
        provider_product_id: '696680',
        provider_sku_id: 'pokemon-sku-1',
        tcgplayer_product_id: 696680,
        tcgplayer_sku_id: 123456789,
        variant: 'Holofoil',
        language: 'English',
        quantity: 2,
        inventory_value: 6,
        data: { inventoryValueSemantics: "total_row_v1",
          setName: 'ME: 30th Celebration',
          set: '30C',
          collectorNumber: '036/128',
          condition: 'Near Mint',
          imageUrl: 'https://images.example.test/pokemon/pikachu.jpg',
        },
      },
    ],
  });

  const pokemon = mixed.find((card) => card.id === 'pokemon-shared-name');
  assert.equal(pokemon?.gameId, 'pokemon');
  assert.equal(pokemon?.gameLabel, 'Pokemon');
  assert.equal(pokemon?.productType, 'card');
  assert.equal(pokemon?.printing.setCode, '30C');
  assert.equal(pokemon?.printing.collectorNumber, '036/128');
  assert.equal(pokemon?.printing.variant, 'Holofoil');
  assert.equal(pokemon?.printing.language, 'English');
  assert.equal(pokemon?.printing.finish, 'foil');
  assert.equal(pokemon?.marketPrice.amount, 3);
  assert.equal(filterCollectionCards(mixed, { gameId: 'pokemon' }).length, 1);
  assert.equal(filterCollectionCards(mixed, { gameId: 'magic' }).length, 1);
  assert.equal(filterCollectionCards(mixed, { variant: 'Holofoil' })[0]?.id, 'pokemon-shared-name');
});

test('Collection handles Pokemon sealed products without card-condition controls becoming identity', () => {
  const sealed = buildCollectionCards({
    items: [
      {
        id: 'pokemon-sealed-blister',
        card_name: '30th Celebration 2-Pack Blister',
        game_id: 'pokemon',
        product_type: 'sealed',
        provider_category_id: '3',
        provider_product_id: '704148',
        tcgplayer_product_id: 704148,
        quantity: 3,
        inventory_value: 36,
        data: { inventoryValueSemantics: "total_row_v1",
          gameLabel: 'Pokemon',
          setName: 'ME: 30th Celebration',
          productType: 'sealed',
          sealedType: 'Blister',
          imageUrl: 'https://images.example.test/pokemon/blister.jpg',
        },
      },
    ],
  });

  assert.equal(sealed[0].gameId, 'pokemon');
  assert.equal(sealed[0].productType, 'sealed');
  assert.equal(sealed[0].cardName, '30th Celebration 2-Pack Blister');
  assert.equal(sealed[0].printing.finish, 'unknown');
  assert.equal(sealed[0].marketPrice.amount, 12);
  assert.equal(filterCollectionCards(sealed, { productType: 'sealed' }).length, 1);
  assert.equal(filterCollectionCards(sealed, { productType: 'card' }).length, 0);
});

test('Collection summary groups games and singles versus sealed products', () => {
  const mixed = buildCollectionCards({
    items: [
      { id: 'magic-card', card_name: 'Sol Ring', quantity: 1, inventory_value: 2, data: { inventoryValueSemantics: "total_row_v1", set: 'ltc', collectorNumber: '301' } },
      {
        id: 'pokemon-card',
        card_name: 'Victini',
        game_id: 'pokemon',
        product_type: 'card',
        quantity: 2,
        inventory_value: 4,
        data: { inventoryValueSemantics: "total_row_v1", set: '30C', collectorNumber: '013/128', variant: 'Holofoil' },
      },
      {
        id: 'pokemon-sealed',
        card_name: 'Battle Deck Umbreon',
        game_id: 'pokemon',
        product_type: 'sealed',
        quantity: 1,
        inventory_value: 18,
        data: { inventoryValueSemantics: "total_row_v1", sealedType: 'Battle Deck' },
      },
    ],
  });
  const summary = summarizeCollectionCards(mixed, 'collector');

  assert.deepEqual(
    summary.games.map((entry) => [entry.gameId, entry.quantity, entry.uniquePrintings, entry.knownMarketValue]),
    [
      ['magic', 1, 1, 2],
      ['pokemon', 3, 2, 22],
    ],
  );
  assert.deepEqual(
    summary.productTypes.map((entry) => [entry.productType, entry.quantity, entry.uniquePrintings, entry.knownMarketValue]),
    [
      ['card', 3, 2, 6],
      ['sealed', 1, 1, 18],
    ],
  );
});

test('persisted Pokemon collection records render without provider calls', () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (() => {
    fetchCalls += 1;
    throw new Error('Provider calls are not allowed during persisted render.');
  }) as typeof fetch;
  try {
    const [card] = buildCollectionCards({
      items: [
        {
          id: 'pokemon-offline',
          card_name: 'Greninja ex',
          game_id: 'pokemon',
          product_type: 'card',
          quantity: 1,
          data: { imageUrl: 'https://images.example.test/greninja.jpg', variant: 'Normal' },
        },
      ],
    });

    assert.equal(card.gameId, 'pokemon');
    assert.equal(card.printing.imageUrl, 'https://images.example.test/greninja.jpg');
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
