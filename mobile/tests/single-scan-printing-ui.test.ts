import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(process.cwd(), 'app/scan/single.tsx'), 'utf8');

test('Single Scan result sheet exposes finish correction and other printings without changing Add flow', () => {
  assert.match(source, /function SingleResultSheet/);
  assert.match(source, /PrintingSelectorSheet/);
  assert.match(source, /finishLabel\(finish\)/);
  assert.match(source, /View other printings/);
  assert.match(source, /label="Add card"/);
  assert.match(source, /selectScryfallScannerPrice/);
});
