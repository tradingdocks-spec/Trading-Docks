import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('active seller and deal desk routes do not render fake business metrics', () => {
  const sell = readFileSync(join(root, 'app', '(tabs)', 'sell.tsx'), 'utf8');
  const dealDesk = readFileSync(join(root, 'app', '(tabs)', 'deal-desk.tsx'), 'utf8');

  for (const source of [sell, dealDesk]) {
    assert.equal(source.includes('$1,842.60'), false);
    assert.equal(source.includes('18</Text>'), false);
    assert.equal(source.includes('31.8%'), false);
    assert.equal(source.includes('$1,422'), false);
    assert.equal(source.includes('$2,184'), false);
    assert.equal(source.includes('Phoenix Card Expo'), false);
  }
});

test('mobile product design docs define audit bible component accessibility and motion standards', () => {
  for (const file of [
    'MOBILE_PRODUCT_DESIGN_AUDIT.md',
    'TRADING_DOCKS_DESIGN_BIBLE.md',
    'MOBILE_VISUAL_MIGRATION_PLAN.md',
    'MOBILE_COMPONENT_CONTRACTS.md',
    'MOBILE_ACCESSIBILITY_STANDARD.md',
    'MOBILE_MOTION_STANDARD.md',
    'MOBILE_VISUAL_MIGRATION_WAVE_1.md',
    'MOBILE_VISUAL_MIGRATION_WAVE_2.md',
    'MOBILE_VISUAL_MIGRATION_WAVE_3.md',
    'MOBILE_FINAL_CONSISTENCY_AUDIT.md',
    'MOBILE_RELEASE_QA.md',
  ]) {
    const content = readFileSync(join(root, '..', 'docs', file), 'utf8');
    assert.match(content, /Status:/);
  }
});

test('Wave 3 admin settings recovery and showcase keep release-safe hierarchy', () => {
  const adminLayout = readFileSync(join(root, 'app', 'admin', '_layout.tsx'), 'utf8');
  const adminComponents = readFileSync(join(root, 'components', 'admin.tsx'), 'utf8');
  const settings = readFileSync(join(root, 'app', 'settings.tsx'), 'utf8');
  const scannerRecovery = readFileSync(join(root, 'app', 'scanner-recovery.tsx'), 'utf8');
  const designShowcase = readFileSync(join(root, 'app', 'dev', 'design-system.tsx'), 'utf8');

  assert.match(adminLayout, /resolveProtectedRouteAccess/);
  assert.match(adminLayout, /Command Center access required/);
  assert.match(adminComponents, /TDNavigationHeader/);
  assert.match(adminComponents, /TDListRow/);
  assert.match(settings, /Security and preferences|Preferences and security/);
  assert.match(settings, /MOBILE_PUBLIC_ENV_KEYS\.scannerDiagnostics/);
  assert.match(scannerRecovery, /Action required/);
  assert.equal(scannerRecovery.includes('idempotencyKey'), false);
  assert.match(designShowcase, /MOBILE_PUBLIC_ENV_KEYS\.designSystemShowcase/);
  assert.match(designShowcase, /TDScannerGuide/);
  assert.match(designShowcase, /Disabled action/);
});

test('Wave 3 docs record final audit scanner recovery matrix and release QA gates', () => {
  const wave3 = readFileSync(join(root, '..', 'docs', 'MOBILE_VISUAL_MIGRATION_WAVE_3.md'), 'utf8');
  const audit = readFileSync(join(root, '..', 'docs', 'MOBILE_FINAL_CONSISTENCY_AUDIT.md'), 'utf8');
  const qa = readFileSync(join(root, '..', 'docs', 'MOBILE_RELEASE_QA.md'), 'utf8');

  assert.match(wave3, /Scanner Recovery Matrix/);
  assert.match(audit, /Deferred With Reason/);
  assert.match(qa, /Apple OCR autolinking/);
  assert.match(qa, /VoiceOver/);
  assert.match(qa, /TalkBack/);
});

test('Wave 2 routes consume mobile design OS primitives for remaining customer surfaces', () => {
  const tradeBinder = readFileSync(join(root, 'app', 'trade-binder.tsx'), 'utf8');
  const wishlist = readFileSync(join(root, 'app', 'wishlist.tsx'), 'utf8');
  const scannerSession = readFileSync(join(root, 'app', 'scanner-session.tsx'), 'utf8');
  const dealDesk = readFileSync(join(root, 'app', '(tabs)', 'deal-desk.tsx'), 'utf8');
  const sell = readFileSync(join(root, 'app', '(tabs)', 'sell.tsx'), 'utf8');
  const profile = readFileSync(join(root, 'app', '(tabs)', 'profile.tsx'), 'utf8');
  const auth = readFileSync(join(root, 'app', 'auth.tsx'), 'utf8');
  const welcome = readFileSync(join(root, 'app', 'welcome.tsx'), 'utf8');
  const onboarding = readFileSync(join(root, 'app', 'onboarding.tsx'), 'utf8');
  const plans = readFileSync(join(root, 'app', 'plans.tsx'), 'utf8');

  assert.match(tradeBinder, /TDSegmentedControl[\s\S]*Exchange view/);
  assert.match(wishlist, /Exact target|Flexible target/);
  assert.match(scannerSession, /Save and mark reviewed/);
  assert.doesNotMatch(scannerSession, /Finalize reviewed cards/);
  assert.match(dealDesk, /Review counts and margin reporting require real priced session lines/);
  assert.match(sell, /Seller metrics unavailable/);
  assert.match(profile, /Security and preferences/);
  assert.match(auth, /Passwords are never stored on this device/);
  assert.match(welcome, /Your TCG collection, wherever you trade/);
  assert.match(onboarding, /You can review paid plans later/);
  assert.match(plans, /Mobile purchase flow pending release approval/);
  assert.doesNotMatch(welcome, /Preview mobile|SAMPLE DATA|DEMO/);
  assert.doesNotMatch(auth, /Continue in preview mode|Supabase is not configured|environment variables/);
  assert.doesNotMatch(plans, /RevenueCat|Provider purchase pending configuration/);
});

test('Wave 2 welcome and setup screens avoid fake metrics and unsupported claims', () => {
  const welcome = readFileSync(join(root, 'app', 'welcome.tsx'), 'utf8');
  const plans = readFileSync(join(root, 'app', 'plans.tsx'), 'utf8');
  const experience = readFileSync(join(root, 'app', 'experience.tsx'), 'utf8');
  const modal = readFileSync(join(root, 'app', 'modal.tsx'), 'utf8');

  assert.equal(welcome.includes('$24,860.40'), false);
  assert.equal(welcome.includes('+$684.20'), false);
  assert.equal(welcome.includes('LIVE'), false);
  assert.equal(experience.includes('+$216.34'), false);
  assert.equal(experience.includes('COLLECTION LIVE'), false);
  assert.equal(modal.includes('This is a modal'), false);
  assert.match(plans, /Store employee capacity remains configurable/);
});

test('release candidate docs and customer-facing routes avoid development leakage', () => {
  for (const file of [
    'MOBILE_RELEASE_CANDIDATE_AUDIT.md',
    'MOBILE_BILLING_RELEASE_ARCHITECTURE.md',
    'MOBILE_PRIVACY_RELEASE_AUDIT.md',
    'MOBILE_STORE_RELEASE_CHECKLIST.md',
  ]) {
    const content = readFileSync(join(root, '..', 'docs', file), 'utf8');
    assert.match(content, /Status:/);
    assert.match(content, /BLOCKER|HIGH|MEDIUM|POLISH/);
  }

  const audit = readFileSync(join(root, '..', 'docs', 'MOBILE_RELEASE_CANDIDATE_AUDIT.md'), 'utf8');
  const billing = readFileSync(join(root, '..', 'docs', 'MOBILE_BILLING_RELEASE_ARCHITECTURE.md'), 'utf8');
  const privacy = readFileSync(join(root, '..', 'docs', 'MOBILE_PRIVACY_RELEASE_AUDIT.md'), 'utf8');
  const checklist = readFileSync(join(root, '..', 'docs', 'MOBILE_STORE_RELEASE_CHECKLIST.md'), 'utf8');

  assert.match(audit, /Physical-device QA remains required/);
  assert.match(audit, /BLOCKER/);
  assert.match(billing, /DIGITAL FEATURE\/SUBSCRIPTION/);
  assert.match(billing, /StoreKit/);
  assert.match(privacy, /No source card images are retained by default/);
  assert.match(checklist, /TestFlight/);
});

test('Wave 1 routes consume mobile design OS primitives for high-traffic surfaces', () => {
  const shell = readFileSync(join(root, 'app', '(tabs)', '_layout.tsx'), 'utf8');
  const home = readFileSync(join(root, 'app', '(tabs)', 'index.tsx'), 'utf8');
  const scanModes = readFileSync(join(root, 'app', '(tabs)', 'scan.tsx'), 'utf8');
  const automaticScanner = readFileSync(join(root, 'components', 'scanner', 'automatic-scanner-screen.tsx'), 'utf8');
  const collection = readFileSync(join(root, 'app', '(tabs)', 'collection.tsx'), 'utf8');
  const cardDetail = readFileSync(join(root, 'app', 'collection', '[cardId].tsx'), 'utf8');
  const storage = readFileSync(join(root, 'app', 'storage-locations.tsx'), 'utf8');

  assert.match(shell, /getMobileBottomNavVisualModel/);
  assert.match(home, /HomeHero/);
  assert.match(home, /QuickActions/);
  assert.match(home, /RecentAddsCarousel/);
  assert.equal(home.includes('TDListRow'), false);
  assert.match(scanModes, /Automatic Scan/);
  assert.match(automaticScanner, /batchScannerReviewChipModel/);
  assert.match(automaticScanner, /TDSessionStrip/);
  assert.match(collection, /TDInput[\s\S]*Search collection/);
  assert.match(collection, /TDSegmentedControl/);
  assert.match(cardDetail, /TDNavigationHeader/);
  assert.match(cardDetail, /Advanced details/);
  assert.match(storage, /TDListRow/);
  assert.match(storage, /TDSegmentedControl/);
});
