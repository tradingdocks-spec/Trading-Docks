import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { playScannerSuccessTone, shouldPlayScannerSuccessTone } from '../services/scanner-audio-feedback.ts';

const root = process.cwd().replace(/\\/g, '/').endsWith('/mobile') ? process.cwd() : join(process.cwd(), 'mobile');

test('scanner success audio only plays for accepted scans and stays silent for duplicates and review states', async () => {
  let seekToCalls = 0;
  let playCalls = 0;
  const player = {
    async seekTo() {
      seekToCalls += 1;
    },
    play() {
      playCalls += 1;
    },
  };

  assert.equal(shouldPlayScannerSuccessTone({
    outcome: 'success',
    audioConfirmation: true,
    audioEventKey: 'line-1',
    lastPlayedAudioEventKey: null,
  }), true);
  assert.equal(shouldPlayScannerSuccessTone({
    outcome: 'success',
    audioConfirmation: true,
    audioEventKey: 'line-1',
    lastPlayedAudioEventKey: 'line-1',
  }), false);
  assert.equal(shouldPlayScannerSuccessTone({
    outcome: 'success',
    audioConfirmation: true,
    audioEventKey: 'line-2',
    lastPlayedAudioEventKey: 'line-1',
  }), true);
  assert.equal(shouldPlayScannerSuccessTone({
    outcome: 'success',
    audioConfirmation: false,
    audioEventKey: 'line-2',
    lastPlayedAudioEventKey: 'line-1',
  }), false);
  assert.equal(shouldPlayScannerSuccessTone({
    outcome: 'duplicate',
    audioConfirmation: true,
    audioEventKey: null,
    lastPlayedAudioEventKey: null,
  }), false);
  assert.equal(shouldPlayScannerSuccessTone({
    outcome: 'review',
    audioConfirmation: true,
    audioEventKey: null,
    lastPlayedAudioEventKey: null,
  }), false);

  await playScannerSuccessTone(player);
  assert.equal(seekToCalls, 1);
  assert.equal(playCalls, 1);
});

test('scanner success audio asset is bundled and preloaded by the production scanner', () => {
  const assetPath = join(root, 'assets', 'audio', 'scanner-success-ding.wav');
  const screen = readFileSync(join(root, 'components', 'scanner', 'prebuilt-scanner-bakeoff-screen.native.tsx'), 'utf8');

  assert.equal(existsSync(assetPath), true);
  assert.match(screen, /useAudioPlayer/);
  assert.match(screen, /scanner-success-ding\.wav/);
  assert.match(screen, /keepAudioSessionActive: true/);
  assert.match(screen, /audioEventKey/);
  assert.doesNotMatch(screen, /AudioContext/);
});
