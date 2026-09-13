const {
    wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");

const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const defaultConfig = getSentryExpoConfig(__dirname);

// Metro 0.83+ removed unstable_workerThreads from watcher config
if (defaultConfig.watcher) {
    delete defaultConfig.watcher.unstable_workerThreads;
}

defaultConfig.resolver.sourceExts.push("cjs");

module.exports = wrapWithReanimatedMetroConfig(defaultConfig);
