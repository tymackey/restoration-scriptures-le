/**
 * Custom Expo config plugin to increase splash screen logo padding.
 *
 * Expo hardcodes imageWidth=200 for splash drawables (on a 288dp canvas), giving
 * 69.4% content. The diamond logo has corners at 98.8% of the Android circle mask
 * radius — too close, causing visible clipping on Android 12+ system splash screens.
 *
 * This plugin re-runs splash image generation with imageWidth=173 (~60% content),
 * putting corners at 84.8% of the circle radius.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const {
    setSplashImageDrawablesAsync,
} = require("@expo/prebuild-config/build/plugins/unversioned/expo-splash-screen/withAndroidSplashImages");
const {
    getAndroidSplashConfig,
} = require("@expo/prebuild-config/build/plugins/unversioned/expo-splash-screen/getAndroidSplashConfig");

// 60% of the 288dp canvas = 172.8 → 173px at mdpi
const IMAGE_WIDTH = 173;

module.exports = function withSplashPadding(config) {
    return withDangerousMod(config, [
        "android",
        async (config) => {
            const splash = getAndroidSplashConfig(config, null);
            if (splash) {
                await setSplashImageDrawablesAsync(
                    config,
                    splash,
                    config.modRequest.projectRoot,
                    IMAGE_WIDTH,
                );
            }
            return config;
        },
    ]);
};
