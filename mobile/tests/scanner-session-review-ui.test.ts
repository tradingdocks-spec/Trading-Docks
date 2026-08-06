import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(process.cwd(), 'app/scanner-session.tsx'), 'utf8');

function section(name: string) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = source.indexOf('\nfunction ', start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test('session review route exposes focused presentation components', () => {
  [
    'SessionReviewHeader',
    'SessionSummary',
    'SessionStatusTabs',
    'SessionFilterSheet',
    'ActiveFilterSummary',
    'SessionCardRow',
    'CardReviewSheet',
    'SessionFinalizeBar',
    'SessionEmptyState',
  ].forEach((name) => assert.match(source, new RegExp(`function ${name}\\b`)));
});

test('default main screen omits advanced game and confidence chip walls', () => {
  const beforeFilterSheet = source.slice(0, source.indexOf('function SessionFilterSheet'));
  assert.equal(beforeFilterSheet.includes('FilterChips label="Game"'), false);
  assert.equal(beforeFilterSheet.includes('FilterChips label="Confidence"'), false);
  assert.match(beforeFilterSheet, /SessionStatusTabs/);
});

test('filter sheet owns game confidence missing-price and sort controls', () => {
  const filterSheet = section('SessionFilterSheet');
  assert.match(filterSheet, /FilterChips label="Game"/);
  assert.match(filterSheet, /FilterChips label="Confidence"/);
  assert.match(filterSheet, /FilterChips label="Sort order"/);
  assert.match(filterSheet, /Missing price only/);
  assert.match(filterSheet, /Clear filters/);
});

test('collapsed card row has no inline editing fields or destructive buttons', () => {
  const row = section('SessionCardRow');
  assert.equal(row.includes('<TDInput'), false);
  assert.equal(row.includes('Remove card'), false);
  assert.equal(row.includes('Review"'), false);
  assert.match(row, /onPress/);
  assert.match(row, /formatSessionReviewMoney\(line\.marketPrice\)/);
  assert.match(row, /formatSessionReviewMoney\(line\.cashOffer\)/);
});

test('card review sheet owns editable fields and preserves review actions', () => {
  const sheet = section('CardReviewSheet');
  assert.match(sheet, /label="Quantity"/);
  assert.match(sheet, /label="Market price"/);
  assert.match(sheet, /label="Cash percentage"/);
  assert.match(sheet, /Mark reviewed/);
  assert.match(sheet, /Choose another printing/);
  assert.match(sheet, /Remove card/);
  assert.match(sheet, /parseOptionalMoney/);
  assert.match(sheet, /parseOptionalPercentage/);
});

test('sticky finalize bar includes safe-area padding and does not own export', () => {
  const bar = section('SessionFinalizeBar');
  assert.match(bar, /paddingBottom: Math\.max\(bottomInset/);
  assert.match(bar, /Undo last scan/);
  assert.match(bar, /Finalize/);
  assert.equal(bar.includes('Export'), false);
});

test('empty states distinguish no cards no filter results and all reviewed', () => {
  const empty = section('SessionEmptyState');
  assert.match(empty, /No scans yet/);
  assert.match(empty, /No cards match these filters/);
  assert.match(empty, /Everything is ready/);
});
