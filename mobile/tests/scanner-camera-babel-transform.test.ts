import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const babel = require('@babel/core') as {
  transformFileSync: (filename: string, options: Record<string, unknown>) => { code?: string } | null;
};

test('scanner camera transforms with the active Worklets Babel config', () => {
  const scannerCameraPath = join(process.cwd(), 'components', 'scanner-camera.tsx');
  const configFile = join(process.cwd(), 'babel.config.js');

  assert.doesNotThrow(() => {
    const result = babel.transformFileSync(scannerCameraPath, {
      configFile,
      babelrc: false,
      cwd: process.cwd(),
      filename: scannerCameraPath,
    });

    assert.ok(result?.code);
  }, /Duplicate declaration "onFrame"/);
});
