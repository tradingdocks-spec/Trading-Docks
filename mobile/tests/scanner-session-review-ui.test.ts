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

test('scanner session route exposes compact batch-session components', () => {
  [
    'SessionReviewHeader',
    'SessionSummary',
    'SessionStatusTabs',
    'SessionBatchActions',
    'SessionCardRow',
    'SessionFinalizeBar',
    'SessionEmptyState',
    'DestinationPickerSheet',
    'CardReviewSheet',
  ].forEach((name) => assert.match(source, new RegExp(`function ${name}\\b`)));
  assert.match(source, /Session/);
  assert.match(source, /Store .*ready cards/);
  assert.match(source, /bulkUpdateSessionLines/);
});

test('batch session header and actions stay compact', () => {
  const header = section('SessionReviewHeader');
  const actions = section('SessionBatchActions');
  assert.match(header, /Session/);
  assert.match(header, /Select all/);
  assert.match(actions, /Collection/);
  assert.match(actions, /Trade Binder/);
  assert.match(actions, /Deck/);
  assert.match(actions, /Storage/);
});

test('session row renders compact destination and selection affordances', () => {
  const row = section('SessionCardRow');
  assert.match(row, /checkbox|square-outline/);
  assert.match(row, /cardBadges/);
  assert.match(row, /destinationSyncStatusLabel/);
  assert.equal(row.includes('Finalize reviewed cards'), false);
});

test('destination picker and finalize bar use the batch workflow language', () => {
  const picker = section('DestinationPickerSheet');
  const bar = section('SessionFinalizeBar');
  const summary = section('SessionDestinationSummary');
  assert.match(picker, /Choose deck|Choose storage/);
  assert.match(picker, /Deck Vault|storage locations/);
  assert.match(bar, /ready cards/);
  assert.match(bar, /ready cards/);
  assert.match(summary, /Collection/);
  assert.match(summary, /Trade Binder/);
  assert.match(summary, /Decks/);
  assert.match(summary, /Storage/);
  assert.match(summary, /Needs review/);
});

test('card review sheet preserves printing correction and transient remove behavior', () => {
  const sheet = section('CardReviewSheet');
  assert.match(sheet, /Quantity/);
  assert.match(sheet, /Market price/);
  assert.match(sheet, /Cash percentage/);
  assert.match(sheet, /View other printings/);
  assert.match(sheet, /Remove card/);
  assert.match(sheet, /Tap again to remove/);
  assert.equal(sheet.includes('FilterChips'), false);
  assert.equal(sheet.includes('Finalize reviewed cards'), false);
});
