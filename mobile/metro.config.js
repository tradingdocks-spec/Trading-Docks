const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Allow the mobile app to import shared Trading Docks code
// from the parent repository, such as /src/lib/platform.
config.watchFolders = [workspaceRoot];

// Prefer mobile dependencies first, while still allowing shared
// dependencies from the repository root when needed.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
