const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');

const WORKAROUND_BEGIN = '# BEGIN trading-docks VisionCamera Release Swift compiler workaround';
const WORKAROUND_END = '# END trading-docks VisionCamera Release Swift compiler workaround';

function withVisionCameraReleaseWorkaround(config) {
  return withDangerousMod(config, ['ios', async (modConfig) => {
    const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
    if (!existsSync(podfilePath)) return modConfig;

    const current = readFileSync(podfilePath, 'utf8');
    const patched = patchPodfile(current);
    if (patched !== current) writeFileSync(podfilePath, patched);
    return modConfig;
  }]);
}

function patchPodfile(contents) {
  if (contents.includes(WORKAROUND_BEGIN)) return contents;

  const postInstallIndex = contents.indexOf('post_install do |installer|');
  if (postInstallIndex === -1) {
    throw new Error('Unable to install VisionCamera Release workaround: Podfile post_install hook was not found.');
  }

  const insertIndex = findReactNativePostInstallEnd(contents, postInstallIndex)
    ?? findLineEnd(contents, postInstallIndex);

  return `${contents.slice(0, insertIndex)}${visionCameraReleaseWorkaroundBlock()}${contents.slice(insertIndex)}`;
}

function findReactNativePostInstallEnd(contents, postInstallIndex) {
  const callIndex = contents.indexOf('react_native_post_install(', postInstallIndex);
  if (callIndex === -1) return null;

  const openParenIndex = contents.indexOf('(', callIndex);
  if (openParenIndex === -1) return null;

  let depth = 0;
  for (let index = openParenIndex; index < contents.length; index += 1) {
    const char = contents[index];
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) return findLineEnd(contents, index);
    }
  }

  return null;
}

function findLineEnd(contents, index) {
  const newlineIndex = contents.indexOf('\n', index);
  return newlineIndex === -1 ? contents.length : newlineIndex + 1;
}

function visionCameraReleaseWorkaroundBlock() {
  return `
    ${WORKAROUND_BEGIN}
    # Xcode 26 / Swift 6.2 can ICE while compiling VisionCamera V5 Nitro Swift in Release.
    # Scope the workaround to the VisionCamera pod only; remove after upstream/toolchain fix.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'VisionCamera'

      target.build_configurations.each do |build_config|
        next unless build_config.name == 'Release'

        build_config.build_settings['SWIFT_OPTIMIZATION_LEVEL'] = '-Onone'
        build_config.build_settings['SWIFT_COMPILATION_MODE'] = 'singlefile'
      end
    end
    ${WORKAROUND_END}
`;
}

module.exports = withVisionCameraReleaseWorkaround;
module.exports.patchPodfile = patchPodfile;
module.exports.WORKAROUND_BEGIN = WORKAROUND_BEGIN;
module.exports.WORKAROUND_END = WORKAROUND_END;
