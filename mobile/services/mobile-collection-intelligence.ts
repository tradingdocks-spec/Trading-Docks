import { displayFinish, displayStorageLocation, priceLabel, type CollectionCard } from './collector-workspace.ts';

export type MobileCollectionIntelligenceSignal = {
  id: string;
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
};

export type MobileCollectionIntelligence = {
  missingPriceCount: number;
  duplicateCount: number;
  storageGapCount: number;
  signals: MobileCollectionIntelligenceSignal[];
};

export function buildMobileCollectionIntelligence(cards: CollectionCard[]): MobileCollectionIntelligence {
  const missingPriceCount = cards.filter((card) => card.marketPrice.amount === null).length;
  const duplicateCount = cards.filter((card) => card.quantityOwned > 1).length;
  const storageGapCount = cards.filter((card) => !card.storageLocation).length;
  const tradeMarked = cards.filter((card) => card.tradeBinderStatus !== 'not_for_trade' && card.tradeBinderStatus !== 'unknown').length;
  const wishlistOverlap = cards.filter((card) => card.wishlistStatus === 'wanted').length;
  const foils = cards.filter((card) => displayFinish(card.printing.finish).toLowerCase().includes('foil')).length;
  const valuable = [...cards]
    .filter((card) => card.marketPrice.amount !== null)
    .sort((a, b) => (b.marketPrice.amount ?? 0) - (a.marketPrice.amount ?? 0))[0];

  const signals: MobileCollectionIntelligenceSignal[] = [];
  if (valuable) {
    signals.push({
      id: 'valuable',
      title: 'Highest-value loaded card',
      detail: `${valuable.cardName} - ${priceLabel(valuable)} - ${displayStorageLocation(valuable)}`,
      tone: 'success',
    });
  }
  if (missingPriceCount) {
    signals.push({
      id: 'missing-prices',
      title: 'Missing prices',
      detail: `${missingPriceCount} card${missingPriceCount === 1 ? '' : 's'} need pricing before value is complete.`,
      tone: 'warning',
    });
  }
  if (duplicateCount) {
    signals.push({
      id: 'duplicates',
      title: 'Duplicates',
      detail: `${duplicateCount} loaded printing${duplicateCount === 1 ? '' : 's'} have quantity above one.`,
      tone: 'info',
    });
  }
  if (storageGapCount) {
    signals.push({
      id: 'storage-gaps',
      title: 'Storage gaps',
      detail: `${storageGapCount} card${storageGapCount === 1 ? '' : 's'} need a precise location.`,
      tone: 'warning',
    });
  }
  if (tradeMarked) {
    signals.push({
      id: 'trade',
      title: 'Trade Binder',
      detail: `${tradeMarked} card${tradeMarked === 1 ? '' : 's'} are marked for trade.`,
      tone: 'success',
    });
  }
  if (wishlistOverlap) {
    signals.push({
      id: 'wishlist',
      title: 'Wishlist overlap',
      detail: `${wishlistOverlap} owned card${wishlistOverlap === 1 ? '' : 's'} also appear on your wishlist.`,
      tone: 'info',
    });
  }
  if (foils) {
    signals.push({
      id: 'foils',
      title: 'Special finishes',
      detail: `${foils} loaded card${foils === 1 ? '' : 's'} use foil or etched finishes.`,
      tone: 'info',
    });
  }

  return {
    missingPriceCount,
    duplicateCount,
    storageGapCount,
    signals: signals.slice(0, 4),
  };
}
