import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  getMobileBottomBarHeight,
  getMobileBottomNavVisualModel,
  getMobileScrollBottomInset,
  getMobileTabCellBasis,
  getMobileTabOptions,
  getMobileTabs,
  getMobileVisibleTabRoutes,
  hasExactlyFivePrimaryTabs,
  isMobileTabSelected,
  MOBILE_NAV_MIN_TOUCH_TARGET,
  MOBILE_NAV_SAFE_AREA_BASE_HEIGHT,
  MOBILE_PRIMARY_TAB_COUNT,
  shouldHideMobileTabBarForRoute,
  resolveProtectedRouteAccess,
} from '../services/navigation-contract.ts';

const accountTypes = ['free', 'collector', 'seller', 'store'] as const;
const root = process.cwd();

test('every mobile account composition has exactly five visible primary tabs', () => {
  for (const accountType of accountTypes) {
    assert.equal(hasExactlyFivePrimaryTabs(accountType), true);
    assert.equal(getMobileTabs(accountType).length, MOBILE_PRIMARY_TAB_COUNT);
  }
});

test('no Explore placeholder tab remains in the primary navigation contract', () => {
  for (const accountType of accountTypes) {
    const tabs = getMobileTabs(accountType);
    assert.equal(
      tabs.some((tab) => String(tab.route) === 'explore' || tab.label === 'Explore'),
      false,
    );
  }
});

test('tab cells use equal-width five-tab geometry', () => {
  for (const accountType of accountTypes) {
    assert.equal(getMobileTabCellBasis(accountType), '20%');
  }
});

test('active route state remains stable for primary and nested tab routes', () => {
  assert.equal(isMobileTabSelected('/(tabs)', 'index'), true);
  assert.equal(isMobileTabSelected('/(tabs)/collection', 'collection'), true);
  assert.equal(isMobileTabSelected('/(tabs)/collection/card-1', 'collection'), true);
  assert.equal(isMobileTabSelected('/(tabs)/profile', 'sell'), false);
});

test('center action remains Scan for every account type and Deal Desk is contextual', () => {
  const collectorScan = getMobileTabOptions('collector', 'scan');
  const sellerScan = getMobileTabOptions('seller', 'scan');
  const storeScan = getMobileTabOptions('store', 'scan');

  assert.equal(collectorScan.href, undefined);
  assert.equal(collectorScan.prominent, true);
  assert.equal(sellerScan.prominent, true);
  assert.equal(storeScan.prominent, true);
  for (const accountType of accountTypes) {
    assert.equal(getMobileVisibleTabRoutes(accountType).includes('deal-desk' as never), false);
  }
});

test('Mobile V1 primary tab labels are Home Collection Scan Intelligence Account', () => {
  for (const accountType of accountTypes) {
    assert.deepEqual(getMobileTabs(accountType).map((tab) => tab.label), [
      'Home',
      'Collection',
      'Scan',
      'Intelligence',
      'Account',
    ]);
  }
});

test('admin access remains additive and outside primary mobile tabs', () => {
  for (const accountType of accountTypes) {
    const routes = getMobileVisibleTabRoutes(accountType) as string[];
    assert.equal(routes.includes('profile'), true);
    assert.equal(routes.includes('admin'), false);
  }

  assert.deepEqual(
    resolveProtectedRouteAccess({
      authLoading: false,
      sessionExists: true,
      adminLoading: false,
      isAdmin: true,
      requiresAdmin: true,
    }),
    { state: 'allowed', route: null },
  );
});

test('bottom bar safe-area contract keeps accessible touch targets and content inset', () => {
  const noInsetHeight = getMobileBottomBarHeight(0);
  const phoneInsetHeight = getMobileBottomBarHeight(21);

  assert.equal(noInsetHeight, MOBILE_NAV_SAFE_AREA_BASE_HEIGHT);
  assert.equal(phoneInsetHeight, MOBILE_NAV_SAFE_AREA_BASE_HEIGHT + 21);
  assert.ok(MOBILE_NAV_MIN_TOUCH_TARGET >= 48);
  assert.ok(getMobileScrollBottomInset(21) > phoneInsetHeight);
});

test('bottom navigation visual model keeps center action balanced inside the bar', () => {
  const model = getMobileBottomNavVisualModel(21);

  assert.equal(model.cellBasis, '20%');
  assert.equal(model.iconSize, 22);
  assert.equal(model.labelMaxLines, 1);
  assert.equal(model.centerAction.oversized, false);
  assert.equal(model.centerAction.staysInsideBar, true);
  assert.ok(model.centerAction.height < model.height);
});

test('mobile tab bar remains visible on Scan Modes', () => {
  assert.equal(shouldHideMobileTabBarForRoute('scan'), false);
  assert.equal(shouldHideMobileTabBarForRoute('index'), false);
  assert.equal(shouldHideMobileTabBarForRoute('collection'), false);
  assert.equal(shouldHideMobileTabBarForRoute('sell'), false);
  assert.equal(shouldHideMobileTabBarForRoute('profile'), false);
});

test('mobile tab layout structurally registers exactly five production tabs', () => {
  const layout = readFileSync(join(root, 'app', '(tabs)', '_layout.tsx'), 'utf8');
  const registeredScreens = [...layout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(registeredScreens, ['index', 'collection', 'scan', 'sell', 'profile']);
  assert.equal(registeredScreens.length, MOBILE_PRIMARY_TAB_COUNT);
  assert.doesNotMatch(layout, /name="deal-desk"/);
  assert.doesNotMatch(layout, /getMobileVisibleTabRoutes\(accountType\)/);
  assert.doesNotMatch(layout, /tabRoutes\.map/);
});

test('Expo Router tabs group contains no Deal Desk route file', () => {
  const tabFiles = readdirSync(join(root, 'app', '(tabs)')).filter((file) => file.endsWith('.tsx'));

  assert.equal(tabFiles.includes('deal-desk.tsx'), false);
  assert.deepEqual(
    tabFiles.sort(),
    ['_layout.tsx', 'collection.tsx', 'index.tsx', 'profile.tsx', 'scan.tsx', 'sell.tsx'].sort(),
  );
});
