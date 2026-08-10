/* global __dirname */

const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { patchPodfile, WORKAROUND_BEGIN } = require('../plugins/with-vision-camera-release-workaround');

const appRoot = path.resolve(__dirname, '..');
const APP_JSON = path.join(appRoot, 'app.json');

function readPackage(packageName) {
  const packagePath = path.join(appRoot, 'node_modules', packageName, 'package.json');
  if (!existsSync(packagePath)) {
    throw new Error(`${packageName} is not installed at ${packagePath}`);
  }
  return JSON.parse(readFileSync(packagePath, 'utf8'));
}

function assertInstalledVersion(packageName, expectedVersion) {
  const actualVersion = readPackage(packageName).version;
  if (actualVersion !== expectedVersion) {
    throw new Error(`${packageName} expected ${expectedVersion}, found ${actualVersion}`);
  }
  return actualVersion;
}

function assertHeaderExists(packageName, relativeHeaderPath) {
  const headerPath = path.join(appRoot, 'node_modules', packageName, relativeHeaderPath);
  if (!existsSync(headerPath)) {
    throw new Error(`${packageName} is missing native header ${relativeHeaderPath}`);
  }
}

function assertHeaderMissing(packageName, relativeHeaderPath) {
  const headerPath = path.join(appRoot, 'node_modules', packageName, relativeHeaderPath);
  if (existsSync(headerPath)) {
    throw new Error(`${packageName} unexpectedly includes ${relativeHeaderPath}`);
  }
}

function verifyNativeVisionStack() {
  const appConfig = JSON.parse(readFileSync(APP_JSON, 'utf8')).expo;
  if (!appConfig.plugins?.includes('./plugins/with-vision-camera-release-workaround')) {
    throw new Error('VisionCamera Release Swift compiler workaround plugin is not registered in app.json.');
  }

  const versions = {
    expo: assertInstalledVersion('expo', '54.0.36'),
    reactNative: assertInstalledVersion('react-native', '0.81.5'),
    reactNativeMetroConfig: assertInstalledVersion('@react-native/metro-config', '0.81.5'),
    visionCamera: assertInstalledVersion('react-native-vision-camera', '5.0.11'),
    visionCameraWorklets: assertInstalledVersion('react-native-vision-camera-worklets', '5.0.11'),
    worklets: assertInstalledVersion('react-native-worklets', '0.8.3'),
    nitroModules: assertInstalledVersion('react-native-nitro-modules', '0.35.9'),
    nitroImage: assertInstalledVersion('react-native-nitro-image', '0.15.0'),
    reanimated: assertInstalledVersion('react-native-reanimated', '4.1.7'),
  };

  assertHeaderExists('react-native-worklets', path.join('Common', 'cpp', 'worklets', 'RunLoop', 'AsyncQueue.h'));
  assertHeaderMissing('react-native-worklets', path.join('Common', 'cpp', 'worklets', 'Public', 'AsyncQueue.h'));

  const visionWorkletsPackage = readPackage('react-native-vision-camera-worklets');
  const expectedWorklets = visionWorkletsPackage.devDependencies?.['react-native-worklets'];
  const expectedNitro = visionWorkletsPackage.devDependencies?.['react-native-nitro-modules'];
  if (expectedWorklets !== '0.8.1') {
    throw new Error(`Unexpected VisionCameraWorklets worklets authoring version ${expectedWorklets}`);
  }
  if (expectedNitro !== '0.35.9') {
    throw new Error(`Unexpected VisionCameraWorklets Nitro authoring version ${expectedNitro}`);
  }

  const patchedPodfile = patchPodfile(samplePodfile());
  if (!patchedPodfile.includes(WORKAROUND_BEGIN)) {
    throw new Error('VisionCamera Release Swift compiler workaround was not inserted into the Podfile sample.');
  }
  if (!patchedPodfile.includes("target.name == 'VisionCamera'")) {
    throw new Error('VisionCamera Release Swift compiler workaround must be scoped to the VisionCamera pod.');
  }
  if (!patchedPodfile.includes("build_config.name == 'Release'")) {
    throw new Error('VisionCamera Release Swift compiler workaround must be scoped to Release configuration.');
  }
  if (!patchedPodfile.includes("SWIFT_OPTIMIZATION_LEVEL'] = '-Onone'")) {
    throw new Error('VisionCamera Release Swift compiler workaround must disable Swift optimization for VisionCamera Release.');
  }
  if (!patchedPodfile.includes("SWIFT_COMPILATION_MODE'] = 'singlefile'")) {
    throw new Error('VisionCamera Release Swift compiler workaround must use singlefile Swift compilation for VisionCamera Release.');
  }

  try {
    readPackage('react-native-worklets-core');
    throw new Error('react-native-worklets-core is installed but is not part of the Expo SDK 54 VisionCamera V5 stack');
  } catch (error) {
    if (!String(error.message).includes('is not installed')) {
      throw error;
    }
  }

  return versions;
}

function samplePodfile() {
  return `target 'TradingDocks' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false
    )
  end
end
`;
}

if (require.main === module) {
  const versions = verifyNativeVisionStack();
  console.log(JSON.stringify({ nativeVisionStack: versions }, null, 2));
}

module.exports = { verifyNativeVisionStack };
