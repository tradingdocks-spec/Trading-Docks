import type { AccountType } from '@/providers/account';
import type { WorkSession } from '@/features/sessions/session-provider';
import { displayCondition, displayFinish, displayPrinting, priceLabel, type CollectionCard, type CollectionSummary } from './collector-workspace.ts';

export type HomeActionKey = 'scan' | 'collection' | 'add' | 'review';

export type HomeAction = {
  key: HomeActionKey;
  label: string;
  helper: string;
  route: '/(tabs)/scan' | '/(tabs)/collection' | '/(tabs)/deal-desk' | '/scanner-session';
  icon: string;
};

export type HomeHero = {
  eyebrow: string;
  title: string;
  value: string;
  supporting: string;
  state: 'ready' | 'empty' | 'unavailable' | 'stale';
};

export type HomeRecentCard = {
  id: string;
  title: string;
  subtitle: string;
  metadata: string;
  quantityLabel: string;
  price: string;
  imageUrl: string | null;
};

export type HomeInsight = {
  title: string;
  message: string;
  tone: 'info' | 'warning' | 'success';
};

export type HomeComposition = {
  workspaceLabel: string;
  portfolioTitle: string;
  portfolioMessage: string;
  portfolioState: 'ready' | 'empty' | 'unavailable' | 'stale';
  hero: HomeHero;
  briefingTitle: string;
  briefingMessage: string;
  activityTitle: string;
  activityMessage: string;
  actions: HomeAction[];
  recentAdds: HomeRecentCard[];
  insight: HomeInsight;
  activeSessionVisible: boolean;
  activeSessionRoute: '/(tabs)/scan' | '/(tabs)/deal-desk';
};

export function buildMobileHomeComposition({
  accountType,
  summary,
  collectionUnavailable,
  stale,
  activeSession,
  recentCards = [],
}: {
  accountType: AccountType;
  summary: CollectionSummary | null;
  collectionUnavailable?: boolean;
  stale?: boolean;
  activeSession: WorkSession | null;
  recentCards?: CollectionCard[];
}): HomeComposition {
  const business = accountType === 'seller' || accountType === 'store';
  const hasCollection = Boolean(summary && summary.totalOwnedCards > 0);
  const portfolioState = stale
    ? 'stale'
    : collectionUnavailable
      ? 'unavailable'
      : hasCollection
        ? 'ready'
        : 'empty';

  return {
    workspaceLabel: workspaceLabel(accountType),
    portfolioTitle: portfolioTitle(accountType),
    portfolioMessage: portfolioMessage(portfolioState, summary),
    portfolioState,
    hero: homeHero(accountType, portfolioState, summary),
    briefingTitle: briefingTitle(accountType),
    briefingMessage: briefingMessage(accountType, portfolioState, summary),
    activityTitle: 'Recent activity',
    activityMessage: hasCollection
      ? 'Recent movement is not available yet. Saved collection changes will appear here after the activity feed is wired.'
      : 'No saved collection activity is available yet.',
    actions: actionsForAccount(accountType),
    recentAdds: buildRecentAdds(recentCards),
    insight: homeInsight(accountType, portfolioState, summary, activeSession),
    activeSessionVisible: Boolean(activeSession),
    activeSessionRoute: business ? '/(tabs)/deal-desk' : '/(tabs)/scan',
  };
}

function workspaceLabel(accountType: AccountType) {
  if (accountType === 'store') return 'Store workspace';
  if (accountType === 'seller') return 'Seller workspace';
  if (accountType === 'collector') return 'Collector workspace';
  return 'Free workspace';
}

function portfolioTitle(accountType: AccountType) {
  if (accountType === 'seller') return 'Buying-ready collection';
  if (accountType === 'store') return 'Shared collection pulse';
  if (accountType === 'collector') return 'Portfolio pulse';
  return 'Collection start';
}

function portfolioMessage(
  state: HomeComposition['portfolioState'],
  summary: CollectionSummary | null,
) {
  if (state === 'unavailable') return 'Collection storage is unavailable. Sign in or check connection to load saved cards.';
  if (state === 'stale') return 'Showing cached collection data from this device.';
  if (state === 'empty') return 'Add saved cards to unlock collection value, storage, and trade insights.';
  if (!summary) return 'Collection summary unavailable.';
  const value = summary.knownMarketValue === null
    ? 'Value unavailable'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(summary.knownMarketValue);
  return `${value} - ${summary.totalOwnedCards.toLocaleString()} loaded cards - ${summary.storageLocationCount} storage locations`;
}

function briefingTitle(accountType: AccountType) {
  if (accountType === 'store') return 'Harbor briefing';
  if (accountType === 'seller') return 'Deal briefing';
  return 'Today';
}

function briefingMessage(
  accountType: AccountType,
  portfolioState: HomeComposition['portfolioState'],
  summary: CollectionSummary | null,
) {
  if (portfolioState === 'unavailable') return 'Signals are unavailable until collection data loads.';
  if (portfolioState === 'empty') return 'Start with Scan or Collection. Trading Docks will stay quiet until there is real data to summarize.';
  if (!summary) return 'No collection summary is available.';
  if (accountType === 'store') return `${summary.totalOwnedCards.toLocaleString()} loaded cards. Shared operations signals are not wired yet.`;
  if (accountType === 'seller') return `${summary.totalOwnedCards.toLocaleString()} loaded cards. Deal Desk signals are available from the Deal Desk tab.`;
  return `${summary.totalOwnedCards.toLocaleString()} loaded cards. Market movement is not available yet.`;
}

function actionsForAccount(accountType: AccountType): HomeAction[] {
  const reviewAction: HomeAction = accountType === 'seller' || accountType === 'store'
    ? {
        key: 'review',
        label: 'Deal Desk',
        helper: 'Resume buying flow',
        route: '/(tabs)/deal-desk',
        icon: 'calculator-outline',
      }
    : {
        key: 'review',
        label: 'Review',
        helper: 'Check scan list',
        route: '/scanner-session',
        icon: 'list-outline',
      };

  return [
    { key: 'scan', label: 'Scan', helper: 'Add cards', route: '/(tabs)/scan', icon: 'scan-outline' },
    { key: 'collection', label: 'Collection', helper: 'Browse cards', route: '/(tabs)/collection', icon: 'albums-outline' },
    { key: 'add', label: 'Add Card', helper: 'Manual entry', route: '/(tabs)/collection', icon: 'add-circle-outline' },
    reviewAction,
  ];
}

function homeHero(
  accountType: AccountType,
  state: HomeComposition['portfolioState'],
  summary: CollectionSummary | null,
): HomeHero {
  if (state === 'unavailable') {
    return {
      eyebrow: workspaceLabel(accountType),
      title: 'Collection unavailable',
      value: 'Offline',
      supporting: 'Saved cards could not be loaded.',
      state,
    };
  }
  if (state === 'stale') {
    return {
      eyebrow: workspaceLabel(accountType),
      title: 'Cached collection',
      value: summary ? `${summary.totalOwnedCards.toLocaleString()} cards` : 'Cached',
      supporting: 'Showing data saved on this device.',
      state,
    };
  }
  if (!summary || summary.totalOwnedCards === 0) {
    return {
      eyebrow: workspaceLabel(accountType),
      title: 'Start your collection',
      value: 'Scan first',
      supporting: 'Add real cards before Trading Docks summarizes value or activity.',
      state: 'empty',
    };
  }
  return {
    eyebrow: accountType === 'store' ? 'Business snapshot' : accountType === 'seller' ? 'Inventory snapshot' : 'Collection snapshot',
    title: accountType === 'store' ? 'Shared inventory' : accountType === 'seller' ? 'Buying-ready inventory' : 'Collection value',
    value: summary.knownMarketValue === null ? 'Value unavailable' : formatUsd(summary.knownMarketValue),
    supporting: `${summary.totalOwnedCards.toLocaleString()} cards - ${summary.uniquePrintings.toLocaleString()} printings - ${summary.storageLocationCount} locations`,
    state,
  };
}

export function buildRecentAdds(cards: CollectionCard[], limit = 8): HomeRecentCard[] {
  return [...cards]
    .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
    .slice(0, Math.max(0, limit))
    .map((card) => ({
      id: card.id,
      title: card.cardName,
      subtitle: displayPrinting(card.printing),
      metadata: `${displayCondition(card.condition)} - ${displayFinish(card.printing.finish)}`,
      quantityLabel: `x${card.quantityOwned}`,
      price: priceLabel(card),
      imageUrl: card.printing.imageUrl ?? null,
    }));
}

function homeInsight(
  accountType: AccountType,
  state: HomeComposition['portfolioState'],
  summary: CollectionSummary | null,
  activeSession: WorkSession | null,
): HomeInsight {
  if (state === 'unavailable') return { title: 'Sync needed', message: 'Reconnect to refresh saved cards.', tone: 'warning' };
  if (state === 'empty') return { title: 'Next step', message: 'Scan a card or add one manually to begin.', tone: 'info' };
  if (activeSession) return { title: 'Active work', message: `Resume ${activeSession.name} with ${activeSession.itemCount} items.`, tone: 'success' };
  if (summary?.missingPriceCount) return { title: 'Review list', message: `${summary.missingPriceCount} cards have unavailable prices.`, tone: 'warning' };
  if (accountType === 'store') return { title: 'Store workspace', message: 'Collection tools stay shared; operations metrics appear only when real data exists.', tone: 'info' };
  return { title: 'Ready', message: 'Your saved collection is loaded.', tone: 'success' };
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function timestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
