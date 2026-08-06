import { workspaceRouteForAccountType, type MobileAccountType } from './auth-routing.ts';

export type DealDeskMode = 'buy' | 'trade' | 'sealed' | 'show';
export type DealDeskSession = { name: string; status: 'active' | 'paused' };

export type DealDeskRenderState = {
  status: 'loading' | 'empty' | 'populated' | 'error';
  activeSessionName: string | null;
  activeSessionStatus: 'paused' | 'active' | null;
  offerLabel: string;
  offerValue: number | null;
  budgetRemaining: number;
  missingPrice: boolean;
};

export function calculateDealDeskOffer(input: { market: string; rate: string; budget: string }) {
  const market = parsePositiveNumber(input.market);
  const rate = parsePositiveNumber(input.rate) ?? 0;
  const budget = parsePositiveNumber(input.budget) ?? 0;
  const offer = market === null ? null : (market * rate) / 100;
  return {
    market,
    rate,
    budget,
    offer,
    remaining: Math.max(0, budget - (offer ?? 0)),
    missingPrice: market === null,
  };
}

export function createDealDeskRenderState(input: {
  ready: boolean;
  activeSession: DealDeskSession | null;
  mode: DealDeskMode;
  market: string;
  rate: string;
  budget: string;
  error?: string | null;
}): DealDeskRenderState {
  if (input.error) {
    return {
      status: 'error',
      activeSessionName: input.activeSession?.name ?? null,
      activeSessionStatus: input.activeSession?.status ?? null,
      offerLabel: 'Unavailable',
      offerValue: null,
      budgetRemaining: 0,
      missingPrice: true,
    };
  }
  if (!input.ready) {
    return {
      status: 'loading',
      activeSessionName: null,
      activeSessionStatus: null,
      offerLabel: 'Loading',
      offerValue: null,
      budgetRemaining: 0,
      missingPrice: false,
    };
  }
  const offer = calculateDealDeskOffer(input);
  return {
    status: input.activeSession ? 'populated' : 'empty',
    activeSessionName: input.activeSession?.name ?? null,
    activeSessionStatus: input.activeSession?.status ?? null,
    offerLabel: offer.offer === null ? 'Pricing unavailable' : currency(offer.offer),
    offerValue: offer.offer,
    budgetRemaining: offer.remaining,
    missingPrice: offer.missingPrice,
  };
}

export function routeStoreAccountToDealDesk() {
  return workspaceRouteForAccountType('store' satisfies MobileAccountType);
}

export function sessionNameForMode(mode: DealDeskMode) {
  if (mode === 'show') return 'Card show session';
  if (mode === 'trade') return 'New trade';
  if (mode === 'sealed') return 'Sealed evaluation';
  return 'New buying session';
}

export function sessionTypeForMode(mode: DealDeskMode) {
  if (mode === 'show') return 'card-show';
  if (mode === 'trade') return 'trade';
  return 'buying';
}

export function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
