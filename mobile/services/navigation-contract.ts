import type { MobileAccountType } from './auth-routing.ts';

export type MobileTabRouteName =
  | 'index'
  | 'collection'
  | 'scan'
  | 'deal-desk'
  | 'sell'
  | 'profile';

export type MobileTabDefinition = {
  route: MobileTabRouteName;
  label: string;
  icon: string;
  prominent?: boolean;
};

export type ProtectedRouteResolution =
  | { state: 'loading'; route: null }
  | { state: 'redirect'; route: '/auth' | '/(tabs)' }
  | { state: 'allowed'; route: null };

const COLLECTOR_TABS: MobileTabDefinition[] = [
  { route: 'index', label: 'Home', icon: 'home' },
  { route: 'collection', label: 'Collection', icon: 'albums' },
  { route: 'scan', label: 'Scan', icon: 'scan', prominent: true },
  { route: 'sell', label: 'Signals', icon: 'pulse' },
  { route: 'profile', label: 'Profile', icon: 'person' },
];

export const MOBILE_TABS_BY_ACCOUNT: Record<MobileAccountType, MobileTabDefinition[]> = {
  free: COLLECTOR_TABS,
  collector: COLLECTOR_TABS,
  seller: [
    { route: 'index', label: 'Home', icon: 'home' },
    { route: 'collection', label: 'Buying', icon: 'albums' },
    { route: 'deal-desk', label: 'Deal Desk', icon: 'calculator', prominent: true },
    { route: 'sell', label: 'Signals', icon: 'pulse' },
    { route: 'profile', label: 'Profile', icon: 'person' },
  ],
  store: [
    { route: 'index', label: 'Home', icon: 'home' },
    { route: 'collection', label: 'Business', icon: 'albums' },
    { route: 'deal-desk', label: 'Deal Desk', icon: 'calculator', prominent: true },
    { route: 'sell', label: 'Activity', icon: 'pulse' },
    { route: 'profile', label: 'Profile', icon: 'person' },
  ],
};

export function normalizeMobileAccountType(value: unknown): MobileAccountType {
  return value === 'collector' || value === 'seller' || value === 'store'
    ? value
    : 'free';
}

export function getMobileTabs(accountType: unknown) {
  return MOBILE_TABS_BY_ACCOUNT[normalizeMobileAccountType(accountType)];
}

export function getMobileTabDefinition(
  accountType: unknown,
  route: MobileTabRouteName,
) {
  return getMobileTabs(accountType).find((tab) => tab.route === route) ?? null;
}

export function getMobileTabOptions(accountType: unknown, route: MobileTabRouteName) {
  const definition = getMobileTabDefinition(accountType, route);
  return {
    title: definition?.label ?? route,
    href: definition ? undefined : null,
    accessibilityLabel: definition ? `${definition.label} tab` : `${route} tab unavailable`,
    prominent: Boolean(definition?.prominent),
    icon: definition?.icon ?? 'ellipse',
  };
}

export function isMobileTabSelected(pathname: string, route: MobileTabRouteName) {
  const tabPath = route === 'index' ? '/(tabs)' : `/(tabs)/${route}`;
  return pathname === tabPath || pathname.startsWith(`${tabPath}/`);
}

export function resolveProtectedRouteAccess({
  authLoading,
  sessionExists,
  accountReady = true,
  adminLoading = false,
  isAdmin = false,
  requiresAdmin = false,
}: {
  authLoading: boolean;
  sessionExists: boolean;
  accountReady?: boolean;
  adminLoading?: boolean;
  isAdmin?: boolean;
  requiresAdmin?: boolean;
}): ProtectedRouteResolution {
  if (authLoading || !accountReady || (requiresAdmin && adminLoading)) {
    return { state: 'loading', route: null };
  }

  if (!sessionExists) return { state: 'redirect', route: '/auth' };
  if (requiresAdmin && !isAdmin) return { state: 'redirect', route: '/(tabs)' };
  return { state: 'allowed', route: null };
}
