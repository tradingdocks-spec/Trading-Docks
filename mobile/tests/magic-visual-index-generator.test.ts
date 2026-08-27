import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const fixturePgm = Buffer.from(`P5
8 8
255
${String.fromCharCode(...Array.from({ length: 64 }, (_, index) => index * 4 % 256))}`, 'binary');

function resolvePythonCommand() {
  for (const candidate of ['python', 'python3', 'py']) {
    const args = candidate === 'py' ? ['-3', '--version'] : ['--version'];
    const result = spawnSync(candidate, args, { encoding: 'utf8' });
    if (!result.error && result.status === 0) {
      return candidate;
    }
  }
  return null;
}

const pythonCommand = resolvePythonCommand();

if (!pythonCommand) {
  test.skip('catalog generator emits compact descriptor metadata without bundling fixture images', () => {});
} else {
  test('catalog generator emits compact descriptor metadata without bundling fixture images', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'td-visual-index-'));
  const imagePath = path.join(temp, 'fixture.pgm');
  const sourcePath = path.join(temp, 'cards.json');
  const outPath = path.join(temp, 'magic-visual-index.ts');
  writeFileSync(imagePath, fixturePgm);
  writeFileSync(sourcePath, JSON.stringify([{
    id: '00000000-0000-4000-8000-000000000001',
    oracle_id: '00000000-0000-4000-8000-000000000002',
    name: 'Fixture Card',
    set: 'tst',
    collector_number: '1',
    games: ['paper'],
    digital: false,
    image_uris: { small: imagePath },
  }]));

  const result = spawnSync(pythonCommand, [
    'scripts/generate-magic-visual-index.py',
    '--source',
    sourcePath,
    '--out',
    outPath,
    '--cache-dir',
    path.join(temp, 'cache'),
    '--min-records',
    '1',
    '--allow-missing-regression',
  ], { cwd: process.cwd(), encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const generated = readFileSync(outPath, 'utf8');
  assert.match(generated, /descriptorVersion/);
  assert.match(generated, /normalizationVersion/);
  assert.match(generated, /Fixture Card/);
  assert.doesNotMatch(generated, /fixture\.pgm/);
  });
}
