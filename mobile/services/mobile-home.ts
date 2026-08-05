import type { AccountType } from '@/providers/account';
import type { WorkSession } from '@/features/sessions/session-provider';
import type { CollectionSummary } from '@/services/collector-workspace';

export type HomeActionKey = 'scan' | 'collection' | 'trade' | 'search';

export type HomeAction = {
  key: HomeActionKey;
  label: string;
  helper: string;
  route: '/(tabs)/scan' | '/(tabs)/collection' | '/(tabs)/deal-desk' | '/(tabs)/sell';
  icon: string;
};

export type HomeComposition = {
  workspaceLabel: string;
  portfolioTitle: string;
  portfolioMessage: string;
  portfolioState: 'ready' | 'empty' | 'unavailable' | 'stale';
  briefingTitle: string;
  briefingMessage: string;
  activityTitle: string;
  activityMessage: string;
  actions: HomeAction[];
  activeSessionVisible: boolean;
  activeSessionRoute: '/(tabs)/scan' | '/(tabs)/deal-desk';
};

export function buildMobileHomeComposition({
  accountType,
  summary,
  collectionUnavailable,
  stale,
  activeSession,
}: {
  accountType: AccountType;
  summary: CollectionSummary | null;
  collectionUnavailable?: boolean;
  stale?: boolean;
  activeSession: WorkSession | null;
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
    briefingTitle: briefingTitle(accountType),
    briefingMessage: briefingMessage(accountType, portfolioState, summary),
    activityTitle: 'Recent activity',
    activityMessage: hasCollection
      ? 'Recent movement is not available yet. Saved collection changes will appear here after the activity feed is wired.'
      : 'No saved collection activity is available yet.',
    actions: actionsForAccount(accountType),
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
  const tradeAction: HomeAction = accountType === 'seller' || accountType === 'store'
    ? {
        key: 'trade',
        label: 'Deal Desk',
        helper: 'Resume buying flow',
        route: '/(tabs)/deal-desk',
        icon: 'calculator-outline',
      }
    : {
        key: 'trade',
        label: 'Trade',
        helper: 'Review trade status',
        route: '/(tabs)/sell',
        icon: 'swap-horizontal-outline',
      };

  return [
    { key: 'scan', label: 'Scan', helper: 'Add cards', route: '/(tabs)/scan', icon: 'scan-outline' },
    { key: 'collection', label: 'Collection', helper: 'Browse cards', route: '/(tabs)/collection', icon: 'albums-outline' },
    tradeAction,
    { key: 'search', label: 'Search', helper: 'Find printings', route: '/(tabs)/collection', icon: 'search-outline' },
  ];
}
