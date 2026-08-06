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
    'SessionCardRow',
    'CardReviewSheet',
    'SessionFinalizeBar',
    'SessionEmptyState',
  ].forEach((name) => assert.match(source, new RegExp(`function ${name}\\b`)));
  assert.match(source, /Review List/);
  assert.match(source, /cardCount === 1/);
});

test('default main screen omits advanced game and confidence chip walls', () => {
  const beforeFilterSheet = source.slice(0, source.indexOf('function SessionFilterSheet'));
  assert.equal(beforeFilterSheet.includes('FilterChips label="Game"'), false);
  assert.equal(beforeFilterSheet.includes('FilterChips label="Confidence"'), false);
  assert.match(beforeFilterSheet, /SessionStatusTabs/);
  assert.match(beforeFilterSheet, /SessionSummary cardCount/);
  assert.equal(beforeFilterSheet.includes('Finalize reviewed cards'), false);
  assert.equal(beforeFilterSheet.includes('Missing prices are excluded'), false);
});

test('default review list removes the large filter wall', () => {
  assert.equal(source.includes('function SessionFilterSheet'), false);
  assert.equal(source.includes('FilterChips label="Game"'), false);
  assert.equal(source.includes('FilterChips label="Confidence"'), false);
  assert.equal(source.includes('Missing price only'), false);
});

test('collapsed card row has no inline editing fields or destructive buttons', () => {
  const row = section('SessionCardRow');
  assert.equal(row.includes('<TDInput'), false);
  assert.equal(row.includes('Remove card'), false);
  assert.equal(row.includes('Review"'), false);
  assert.match(row, /onPress/);
  assert.match(row, /formatReviewLineMoney\(line\.marketPrice, line\.priceSource\)/);
  assert.match(row, /formatSessionReviewMoney\(line\.cashOffer\)/);
  assert.match(source, /Pricing\.\.\./);
});

test('card review sheet owns editable fields and preserves review actions', () => {
  const sheet = section('CardReviewSheet');
  assert.match(sheet, /label="Quantity"/);
  assert.match(sheet, /label="Condition"/);
  assert.match(sheet, /label="Finish"/);
  assert.match(sheet, /label="Market price"/);
  assert.match(sheet, /label="Cash percentage"/);
  assert.match(sheet, /Save & mark reviewed/);
  assert.match(sheet, /Choose another printing/);
  assert.match(sheet, /Remove card/);
  assert.match(sheet, /More options/);
  assert.match(sheet, /parseOptionalMoney/);
  assert.match(sheet, /parseOptionalPercentage/);
  assert.equal(sheet.includes('Missing signals'), false);
  assert.equal(sheet.includes('Why review?'), false);
  assert.equal(sheet.includes('sessionConfidenceLabel'), false);
});

test('main review route exposes one finalize action', () => {
  const finalizeLabels = source.match(/label="Finalize"/g) ?? [];
  assert.equal(finalizeLabels.length, 1);
  assert.equal(source.includes('Finalize session'), false);
});

test('sticky finalize bar includes safe-area padding and does not own export', () => {
  const bar = section('SessionFinalizeBar');
  assert.match(bar, /paddingBottom: Math\.max\(bottomInset/);
  assert.match(bar, /Finalize/);
  assert.equal(bar.includes('Undo last scan'), false);
  assert.equal(bar.includes('Export'), false);
});

test('empty states distinguish no cards no filter results and all reviewed', () => {
  const empty = section('SessionEmptyState');
  assert.match(empty, /No scans yet/);
  assert.match(empty, /No cards match these filters/);
  assert.match(empty, /Everything is ready/);
});
