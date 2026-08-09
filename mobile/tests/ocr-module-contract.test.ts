import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const moduleRoot = join(process.cwd(), 'modules', 'trading-docks-vision-ocr');

test('OCR Expo module Apple config matches Swift and JS runtime names', () => {
  const config = JSON.parse(readFileSync(join(moduleRoot, 'expo-module.config.json'), 'utf8')) as {
    platforms: string[];
    apple: { modules: string[]; podspecPath: string };
  };
  const swift = readFileSync(join(moduleRoot, 'ios', 'TradingDocksVisionOcrModule.swift'), 'utf8');
  const js = readFileSync(join(moduleRoot, 'src', 'TradingDocksVisionOcrModule.ts'), 'utf8');
  assert.ok(config.platforms.includes('apple'));
  assert.equal(config.apple.modules[0], 'TradingDocksVisionOcrModule');
  assert.equal(config.apple.podspecPath, 'ios/TradingDocksVisionOcr.podspec');
  assert.match(swift, /public class TradingDocksVisionOcrModule: Module/);
  assert.match(swift, /Name\("TradingDocksVisionOcr"\)/);
  assert.match(swift, /AsyncFunction\("recognizeFrameTitle"\)/);
  assert.match(swift, /AsyncFunction\("detectCardRectangle"\)/);
  assert.match(swift, /VNDetectRectanglesRequest/);
  assert.match(swift, /AsyncFunction\("generateFeaturePrint"\)/);
  assert.match(swift, /VNGenerateImageFeaturePrintRequest/);
  assert.match(js, /requireNativeModule\('TradingDocksVisionOcr'\)/);
  assert.match(js, /recognizeFrameTitle/);
  assert.match(js, /detectCardRectangle/);
  assert.match(js, /generateFeaturePrint/);
});

test('OCR module has an Apple podspec so resolve emits a pod', () => {
  const podspec = readFileSync(join(moduleRoot, 'ios', 'TradingDocksVisionOcr.podspec'), 'utf8');
  assert.match(podspec, /s\.name\s+= 'TradingDocksVisionOcr'/);
  assert.match(podspec, /s\.dependency 'ExpoModulesCore'/);
  assert.match(podspec, /s\.source_files = "\*\*\/\*\.\{h,m,swift\}"/);
});
