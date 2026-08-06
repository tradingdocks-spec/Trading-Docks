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
  ]) {
    const content = readFileSync(join(root, '..', 'docs', file), 'utf8');
    assert.match(content, /Status:/);
  }
});
