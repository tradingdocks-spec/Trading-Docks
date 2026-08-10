import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  patchPodfile,
  WORKAROUND_BEGIN,
  WORKAROUND_END,
} = require('../plugins/with-vision-camera-release-workaround.js') as {
  patchPodfile: (contents: string) => string;
  WORKAROUND_BEGIN: string;
  WORKAROUND_END: string;
};

test('VisionCamera Release workaround is registered in Expo config', () => {
  const app = JSON.parse(readFileSync(join(process.cwd(), 'app.json'), 'utf8')).expo as {
    plugins: unknown[];
  };

  assert.ok(app.plugins.includes('./plugins/with-vision-camera-release-workaround'));
});

test('VisionCamera Release workaround patches only the VisionCamera Release pod settings', () => {
  const podfile = `target 'TradingDocks' do
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false
    )
  end
end
`;

  const patched = patchPodfile(podfile);

  assert.match(patched, new RegExp(WORKAROUND_BEGIN));
  assert.match(patched, new RegExp(WORKAROUND_END));
  assert.match(patched, /target\.name == 'VisionCamera'/);
  assert.match(patched, /build_config\.name == 'Release'/);
  assert.match(patched, /SWIFT_OPTIMIZATION_LEVEL'\] = '-Onone'/);
  assert.match(patched, /SWIFT_COMPILATION_MODE'\] = 'singlefile'/);
  assert.doesNotMatch(patched, /target\.name != 'VisionCamera'/);
});

test('VisionCamera Release workaround is idempotent', () => {
  const podfile = `target 'TradingDocks' do
  post_install do |installer|
  end
end
`;

  const once = patchPodfile(podfile);
  const twice = patchPodfile(once);

  assert.equal(twice, once);
  assert.equal((twice.match(new RegExp(WORKAROUND_BEGIN, 'g')) ?? []).length, 1);
});
