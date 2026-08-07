import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(process.cwd(), 'app/scan/single.tsx'), 'utf8');

test('Single Scan result sheet exposes finish correction and other printings without changing Add flow', () => {
  assert.match(source, /function SingleResultSheet/);
  assert.match(source, /PrintingSelectorSheet/);
  assert.match(source, /finishLabel\(finish\)/);
  assert.match(source, /Other printings/);
  assert.match(source, /label="Add card"/);
  assert.match(source, /selectScryfallScannerPrice/);
});

test('Single Scan result sheet keeps one dominant CTA and compact result hierarchy', () => {
  const resultSheet = source.slice(source.indexOf('function SingleResultSheet'), source.indexOf('function SingleSettingsSheet'));

  assert.match(resultSheet, /numberOfLines=\{2\}/);
  assert.match(resultSheet, /candidate\.setCode \?\? 'Set unavailable'\} #\{candidate\.collectorNumber/);
  assert.match(resultSheet, /Market/);
  assert.match(resultSheet, /Offer/);
  assert.match(resultSheet, /supportedVisibleFinishes\(candidate\)/);
  assert.match(resultSheet, /<TDButton label="Add card" onPress=\{onAdd\} size="lg"/);
  assert.match(resultSheet, /ResultTextAction label="Other printings"/);
  assert.match(resultSheet, /ResultTextAction label="Retake" tone="muted"/);
  assert.doesNotMatch(resultSheet, /label="View other printings" variant="secondary"/);
  assert.doesNotMatch(resultSheet, /label="Retake" variant="secondary"/);
});
