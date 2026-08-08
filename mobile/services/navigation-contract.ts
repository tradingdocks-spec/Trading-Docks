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
  inactiveIcon: string;
  prominent?: boolean;
};

export type ProtectedRouteResolution =
  | { state: 'loading'; route: null }
  | { state: 'redirect'; route: '/auth' | '/(tabs)' }
  | { state: 'allowed'; route: null };

const COLLECTOR_TABS: MobileTabDefinition[] = [
  { route: 'index', label: 'Home', icon: 'home', inactiveIcon: 'home-outline' },
  { route: 'collection', label: 'Collection', icon: 'layers', inactiveIcon: 'layers-outline' },
  { route: 'scan', label: 'Scan', icon: 'scan', inactiveIcon: 'scan-outline', prominent: true },
  { route: 'sell', label: 'Intelligence', icon: 'pulse', inactiveIcon: 'pulse-outline' },
  { route: 'profile', label: 'Account', icon: 'person', inactiveIcon: 'person-outline' },
];

export const MOBILE_TABS_BY_ACCOUNT: Record<MobileAccountType, MobileTabDefinition[]> = {
  free: COLLECTOR_TABS,
  collector: COLLECTOR_TABS,
  seller: COLLECTOR_TABS,
  store: COLLECTOR_TABS,
};

export const MOBILE_PRIMARY_TAB_COUNT = 5;
export const MOBILE_NAV_MIN_TOUCH_TARGET = 48;
export const MOBILE_NAV_SAFE_AREA_BASE_HEIGHT = 64;
export const MOBILE_NAV_ICON_SIZE = 22;
export const MOBILE_NAV_CENTER_WIDTH = 46;
export const MOBILE_NAV_CENTER_HEIGHT = 38;

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
    inactiveIcon: definition?.inactiveIcon ?? 'ellipse-outline',
  };
}

export function getMobileVisibleTabRoutes(accountType: unknown) {
  return getMobileTabs(accountType).map((tab) => tab.route);
}

export function hasExactlyFivePrimaryTabs(accountType: unknown) {
  return getMobileTabs(accountType).length === MOBILE_PRIMARY_TAB_COUNT;
}

export function getMobileTabCellBasis(accountType: unknown) {
  return `${100 / getMobileTabs(accountType).length}%`;
}

export function getMobileBottomBarHeight(safeAreaBottom: number) {
  return MOBILE_NAV_SAFE_AREA_BASE_HEIGHT + Math.max(0, safeAreaBottom);
}

export function getMobileScrollBottomInset(safeAreaBottom: number) {
  return getMobileBottomBarHeight(safeAreaBottom) + 28;
}

export function getMobileBottomNavVisualModel(safeAreaBottom: number) {
  const height = getMobileBottomBarHeight(safeAreaBottom);
  return {
    height,
    paddingBottom: Math.max(safeAreaBottom, 6),
    paddingTop: 8,
    iconSize: MOBILE_NAV_ICON_SIZE,
    labelMaxLines: 1,
    cellBasis: '20%',
    minTouchTarget: MOBILE_NAV_MIN_TOUCH_TARGET,
    centerAction: {
      width: MOBILE_NAV_CENTER_WIDTH,
      height: MOBILE_NAV_CENTER_HEIGHT,
      oversized: false,
      staysInsideBar: true,
    },
  };
}

export function shouldHideMobileTabBarForRoute(route: MobileTabRouteName) {
  return false;
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
