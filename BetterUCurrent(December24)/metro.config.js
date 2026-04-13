const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Block the original ws package
config.resolver.blockList = [
  /node_modules\/ws\/.*/,
];

// Resolve ws to React Native's WebSocket implementation
// Also fix es-abstract subpath resolution (e.g. es-abstract/2023/PromiseResolve) for promise.allsettled
const path = require('path');
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'ws') {
    return {
      filePath: require.resolve('react-native/Libraries/WebSocket/WebSocket'),
      type: 'sourceFile',
    };
  }
  // Fix: Metro sometimes fails to resolve es-abstract/2023/* subpaths
  if (moduleName.startsWith('es-abstract/')) {
    const subpath = moduleName.replace('es-abstract/', '');
    const resolved = path.join(__dirname, 'node_modules', 'es-abstract', subpath + '.js');
    try {
      if (require('fs').existsSync(resolved)) {
        return { filePath: resolved, type: 'sourceFile' };
      }
    } catch (_) {}
  }
  return originalResolveRequest ? originalResolveRequest(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config; 