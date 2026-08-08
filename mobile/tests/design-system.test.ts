import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tdButtonAccessibility,
  tdButtonIsDisabled,
  tdInputAccessibility,
  tdInputState,
  tdSelectableAccessibility,
  TD_MOBILE_COMPONENT_CONTRACTS,
  TD_MOBILE_COMFORTABLE_TOUCH_TARGET,
  TD_MOBILE_ICON_SIZES,
  TD_MOBILE_MIN_TOUCH_TARGET,
  TD_MOBILE_SPACING_SCALE,
  TD_MOBILE_SURFACE_LEVELS,
} from '../design/component-model.ts';
import { tdTokens } from '../design/shared-tokens.ts';

test('semantic color tokens are available for platform components', () => {
  assert.equal(tdTokens.color.background.primary, '#06111f');
  assert.equal(tdTokens.color.action.primary, '#2688ff');
  assert.equal(tdTokens.color.state.success, '#31d99a');
  assert.equal(tdTokens.color.state.warning, '#ffc76a');
  assert.equal(tdTokens.color.state.danger, '#ff6f87');
  assert.equal(tdTokens.color.state.information, '#22d3ee');
  assert.equal(tdTokens.color.state.accent, '#8b5cf6');
});

test('token exports include spacing, type, radius, and elevation foundations', () => {
  assert.equal(tdTokens.space.xs, 8);
  assert.equal(tdTokens.space.md, 16);
  assert.equal(tdTokens.radius.md, 16);
  assert.equal(tdTokens.typography.size.body, 14);
  assert.ok(tdTokens.elevation.raised);
});

test('shared typography exposes zero tracking for dynamic display text', () => {
  assert.equal(tdTokens.typography.letterSpacing.none, 0);
});

test('button disabled behavior includes disabled and loading states', () => {
  assert.equal(tdButtonIsDisabled(false, false), false);
  assert.equal(tdButtonIsDisabled(true, false), true);
  assert.equal(tdButtonIsDisabled(false, true), true);
});

test('button loading behavior is exposed through accessibility state', () => {
  const props = tdButtonAccessibility('Save changes', false, true);

  assert.equal(props.accessibilityRole, 'button');
  assert.equal(props.accessibilityLabel, 'Save changes');
  assert.deepEqual(props.accessibilityState, { disabled: true, busy: true });
});

test('input error state sets invalid accessibility metadata', () => {
  assert.equal(tdInputState('Required', false), 'error');

  const props = tdInputAccessibility('Email address', 'Required', false);

  assert.equal(props.accessibilityLabel, 'Email address');
  assert.equal(props.accessibilityHint, 'Required');
  assert.equal(props.accessibilityInvalid, true);
  assert.deepEqual(props.accessibilityState, { disabled: false });
});

test('selectable controls expose selected and disabled accessibility states', () => {
  const props = tdSelectableAccessibility('Sort by recent', true, false);

  assert.equal(props.accessibilityRole, 'button');
  assert.equal(props.accessibilityLabel, 'Sort by recent');
  assert.deepEqual(props.accessibilityState, { selected: true, disabled: false });
  assert.ok(TD_MOBILE_MIN_TOUCH_TARGET >= 44);
  assert.ok(TD_MOBILE_COMFORTABLE_TOUCH_TARGET >= 48);
});

test('mobile design OS exposes the canonical primitive contract set', () => {
  for (const primitive of [
    'TDButton',
    'TDCard',
    'TDInput',
    'TDText',
    'TDSectionHeader',
    'TDListRow',
    'TDIconButton',
    'TDBadge',
    'TDSheet',
    'TDSegmentedControl',
    'TDMetric',
    'TDResultTray',
    'TDEmptyState',
    'TDErrorState',
    'TDLoadingState',
    'TDSkeleton',
    'TDToast',
    'TDStatusIndicator',
    'TDNavigationHeader',
    'TDScannerGuide',
    'TDSessionStrip',
    'DockSurface',
    'DockGroup',
    'DockTray',
    'DockRail',
    'DockSegment',
    'DockAction',
    'DockMetric',
    'DockCardWell',
    'DockSection',
    'DockHeader',
    'CollectibleCard',
    'CollectibleThumbnail',
    'CollectibleStack',
    'CollectibleWell',
    'CollectibleHero',
    'LocationBreadcrumb',
  ]) {
    assert.equal(TD_MOBILE_COMPONENT_CONTRACTS.includes(primitive as never), true);
  }
});

test('mobile design OS limits surface spacing and icon scales', () => {
  assert.deepEqual(TD_MOBILE_SURFACE_LEVELS, ['canvas', 'dock', 'tray', 'object']);
  assert.deepEqual(TD_MOBILE_SPACING_SCALE, [4, 8, 12, 16, 20, 24, 32, 40, 48]);
  assert.deepEqual(TD_MOBILE_ICON_SIZES, [16, 20, 24, 28]);
});

test('dimensional Dock tokens expose Trading Docks surface depth', () => {
  assert.equal(tdTokens.depth.surface.canvas, '#06111f');
  assert.equal(tdTokens.depth.surface.dock, '#091827');
  assert.equal(tdTokens.depth.surface.raised, '#112941');
  assert.equal(tdTokens.depth.surface.inset, '#071321');
  assert.equal(tdTokens.depth.edge.active, '#66d9ff');
  assert.equal(tdTokens.radius.dock, 22);
  assert.equal(tdTokens.radius.tray, 16);
  assert.equal(tdTokens.motion.duration.slow, 420);
});
