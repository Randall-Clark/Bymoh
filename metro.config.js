const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole pnpm workspace so Metro can resolve cross-package imports
config.watchFolders = [workspaceRoot];

// Let Metro find packages in both the project and workspace virtual store
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Do NOT disable hierarchical lookup — pnpm needs it to resolve transitive deps
config.resolver.disableHierarchicalLookup = false;

// Prevent Metro from crashing on external/workspace watcher hook timeouts
config.resolver.blockList = [
  /node_modules\/react-native-css-interop\/\.cache\/.*/,
];

module.exports = withNativeWind(config, { input: './global.css' });