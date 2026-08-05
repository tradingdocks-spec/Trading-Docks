import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tdButtonAccessibility,
  tdButtonIsDisabled,
  tdInputAccessibility,
  tdInputState,
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
