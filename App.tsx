import {
    SafeAreaProvider,
    SafeAreaView,
    initialWindowMetrics,
    useSafeAreaFrame,
} from "react-native-safe-area-context";
import DatabaseProvider from "./app/data/DatabaseProvider";
import { useEffect, StrictMode, useState, useMemo } from "react";
import Nav from "./app/nav/Nav";
import { colors } from "./app/constants/colors";
import * as TrackPlayer from "./app/util/TrackPlayer";
import { Portal, Menu, PaperProvider } from "react-native-paper";
import { useMenuStore } from "./app/data/useMenuStore";
import WhatsNewModal from "./app/components/WhatsNewModal";
import { useSettingsStore } from "./app/data/useSettingsStore";
import * as ScreenOrientation from "expo-screen-orientation";
import { useShallow } from "zustand/react/shallow";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";
import { AppMetricsRoot } from "expo-observe";
import { AppState, AppStateStatus, StyleSheet } from "react-native";
import { AutocompleteDropdownContextProvider } from "react-native-autocomplete-dropdown";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

Sentry.init({
    enabled: false, // Local test copy: no reports to the original developer.
    dsn: "https://df7484bebd748a562768832ba9c3ba6f@o4509890604236800.ingest.us.sentry.io/4509890606137344",

    // Do not attach PII (IP address, cookies, user, etc.) to events.
    // Keeps crash/error reporting working while matching the privacy policy.
    // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
    sendDefaultPii: false,

    // Disable data scrubbing only in development environments
    beforeSend(event) {
        // In development, send events without masking for debugging
        // In production, let Sentry's default data scrubbing handle sensitive data
        if (__DEV__) {
            return event;
        }
        // Return undefined to use Sentry's default data scrubbing in production
        return event;
    },

    beforeBreadcrumb(breadcrumb) {
        // In development, send breadcrumbs without masking for debugging
        // In production, let Sentry's default data scrubbing handle sensitive data
        if (__DEV__) {
            return breadcrumb;
        }
        // Return undefined to use Sentry's default data scrubbing in production
        return breadcrumb;
    },

    // Session Replay disabled — replays are not used.
    integrations: [Sentry.feedbackIntegration()],

    // uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: __DEV__,
});

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    menuContent: {
        backgroundColor: colors.menuBackground,
        elevation: 8,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
});

function GlobalMenu() {
    const { isVisible, anchor, width, menuItems, hideMenu } = useMenuStore();

    return (
        <Portal>
            <Menu
                visible={isVisible}
                onDismiss={hideMenu}
                anchor={anchor}
                contentStyle={[styles.menuContent, { width }]}
            >
                {menuItems}
            </Menu>
        </Portal>
    );
}

export default AppMetricsRoot.wrap(
    Sentry.wrap(function App() {
        const setIsLandscape = useSettingsStore(
            useShallow((state) => state.setIsLandscape),
        );

        useEffect(() => {
            // Initialize audio player only once
            let unmounted = false;
            (async () => {
                try {
                    if (unmounted) return;
                    await TrackPlayer.registerPlayService();
                } catch (error) {
                    console.log(error);
                }
            })();

            // Listen for orientation changes
            const orientationSubscription =
                ScreenOrientation.addOrientationChangeListener((event) => {
                    const landscape =
                        event.orientationInfo.orientation ===
                            ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                        event.orientationInfo.orientation ===
                            ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
                    setIsLandscape(landscape);
                });

            // Cleanup subscriptions on unmount
            return () => {
                unmounted = true;
                orientationSubscription.remove();
            };
        }, []);

        return (
            <GestureHandlerRootView style={styles.safeArea}>
                <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                    <StatusBar style="light" />
                    <DatabaseProvider>
                        <PaperProvider>
                            <BottomSheetModalProvider>
                                <AutocompleteDropdownContextProvider>
                                    <SafeAreaView style={styles.safeArea}>
                                        <Nav />
                                        <GlobalMenu />
                                        <WhatsNewModal />
                                    </SafeAreaView>
                                </AutocompleteDropdownContextProvider>
                            </BottomSheetModalProvider>
                        </PaperProvider>
                    </DatabaseProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        );
    }),
);
