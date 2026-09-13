import React, { ReactNode, useEffect, useState, useRef } from "react";
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Platform,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import Constants from "expo-constants";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { NavigationContainer } from "@react-navigation/native";
import { DrawerNavigationOptions } from "@react-navigation/drawer";
import HomeScreen from "../screens/home";
import CovenantofChristScreen from "../screens/cc";
import OldCovenantsScreen from "../screens/oc";
import NewCovenantsScreen from "../screens/nc";
import ModernCovenantsScreen from "../screens/mc";
import GlossaryScreen from "../screens/glossary";
import ChapterScreen from "../screens/chapter";
import ReaderScreen from "../screens/reader";
import ScreensScreen from "../screens/screens";
import ConverterScreen from "../screens/converter";
import AnnotationsScreen from "../screens/annotations";
import HistoryScreen from "../screens/history";
import OnboardingScreen from "../screens/onboarding";
import LicenseScreen from "../screens/license";
import BackupScreen from "../screens/backup";
import KeywordSearchScreen from "../screens/search";
import SearchResultsScreen from "../screens/searchResults";
import { navigationRef } from "./ReaderNav";
import {
    createStackNavigator,
    StackNavigationOptions,
    CardStyleInterpolators,
} from "@react-navigation/stack";
import { Divider } from "react-native-paper";
import TitleNavigation from "../components/TitleNavigation";
import { colors } from "../constants/colors";
import { useSettingsStore } from "../data/useSettingsStore";
import { useScreensStore } from "../data/useScreensStore";
import { useDatabase } from "../data/useDatabase";
import { useScriptureDeepLink } from "../hooks/useScriptureDeepLink";
import { commonStyles } from "../styles/commonStyles";
import { AppMetrics } from "expo-observe";

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

// The default JS-stack slide is long and animates on the JS thread, so
// switching between the Screens overview and the reader competes with chapter
// loading and feels sluggish ("slides left, then waits"). A short cross-fade
// reads as an instant tab-swap and removes the sideways slide entirely.
const fastTabTransition: StackNavigationOptions = {
    cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
    transitionSpec: {
        open: { animation: "timing", config: { duration: 150 } },
        close: { animation: "timing", config: { duration: 150 } },
    },
};

// Define custom navigation options type that extends DrawerNavigationOptions
type CustomDrawerNavigationOptions = DrawerNavigationOptions & {
    hideOptions?: boolean;
};

type CustomStackNavigationOptions = StackNavigationOptions & {
    header: () => ReactNode;
    drawerItemStyle?: { display: string };
    showLayoutToggle?: boolean;
};

type ChapterProps = {
    name: string;
    id: string;
    volume_id: string;
};

function StackNav({ navigation }: { navigation: any }) {
    const { getChapterByReference } = useDatabase();
    const [loading, setLoading] = useState(true);

    // Universal Links / App Links that open the reader at a specific reference.
    useScriptureDeepLink();

    const getHeader = ({ options, route }: { options: any; route: any }) => {
        return <TitleNavigation route={route} options={options} />;
    };

    // Decide what to show on launch. Waits for BOTH persisted stores (screens
    // and settings) to finish rehydrating from AsyncStorage before deciding,
    // then navigates the nested stack to its initial screen. This runs while
    // `loading` is still true, so the navigate sets the stack's initial route
    // before it mounts (the same mechanism used to restore the reader).
    useEffect(() => {
        let didRestore = false;

        const restore = async () => {
            if (didRestore) return;
            didRestore = true;
            try {
                // First launch: show the full Guide once, before any reader
                // restore. Record the current version so the shorter "What's
                // New" modal doesn't also fire on top of the Guide.
                if (useSettingsStore.getState().isFirstLaunch) {
                    useSettingsStore
                        .getState()
                        .setLastSeenVersion(
                            Constants.expoConfig?.version ?? null,
                        );
                    useSettingsStore.getState().setIsFirstLaunch(false);
                    navigation.navigate("StackNav", { screen: "Guide" });
                    return;
                }

                const screensState = useScreensStore.getState();
                const hasActive =
                    !!screensState.activeScreenId &&
                    screensState.screens.some(
                        (s) => s.id === screensState.activeScreenId,
                    );

                if (hasActive) {
                    navigation.navigate("StackNav", { screen: "Reader" });
                    return;
                }

                // Migration: seed one screen from the legacy currentReference
                // when the screens store is empty.
                const currentReference =
                    useSettingsStore.getState().currentReference;
                if (screensState.screens.length === 0 && currentReference) {
                    const item = await getChapterByReference(
                        currentReference.split(" ")[0],
                        currentReference.split(" ")[1].split(":")[0],
                    );
                    if (item) {
                        useScreensStore.getState().openScreen({
                            volume_id: item.volume_id,
                            book_id: item.book_id,
                            book_chapter: item.book_chapter,
                            chapter_id: item.chapter_id,
                            name: item.name,
                            position:
                                Number(
                                    currentReference
                                        .split(" ")[1]
                                        .split(":")[1],
                                ) || 0,
                        });
                        navigation.navigate("StackNav", { screen: "Reader" });
                    }
                }
            } catch (error) {
                console.error("Error restoring screens:", error);
            } finally {
                setLoading(false);
            }
        };

        // Only decide once both stores have hydrated: restore() reads
        // isFirstLaunch (settings) and the open screens (screens store).
        const bothHydrated = () =>
            useScreensStore.persist.hasHydrated() &&
            useSettingsStore.persist.hasHydrated();

        const maybeRestore = () => {
            if (bothHydrated()) restore();
        };

        const unsubs: (() => void)[] = [];
        if (!useScreensStore.persist.hasHydrated()) {
            unsubs.push(
                useScreensStore.persist.onFinishHydration(maybeRestore),
            );
        }
        if (!useSettingsStore.persist.hasHydrated()) {
            unsubs.push(
                useSettingsStore.persist.onFinishHydration(maybeRestore),
            );
        }
        maybeRestore();

        return () => unsubs.forEach((u) => u());
    }, []);

    // Report TTI once the stores have hydrated and the initial route has
    // been decided — the point at which the app is genuinely interactive.
    useEffect(() => {
        if (!loading) {
            AppMetrics.markInteractive();
        }
    }, [loading]);

    return (
        <View
            style={[commonStyles.fill, { backgroundColor: colors.background }]}
        >
            {loading ? (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <Stack.Navigator
                    id={undefined}
                    initialRouteName="Home"
                    screenOptions={{
                        header: getHeader,
                        headerStyle: {
                            height: 100,
                            backgroundColor: colors.background,
                        },
                        headerTintColor: colors.white,
                        headerTitleAlign: "left",
                        gestureEnabled: false,
                        cardStyle: {
                            backgroundColor: colors.background,
                        },
                    }}
                >
                    <Stack.Screen
                        name="Home"
                        component={HomeScreen}
                        options={
                            {
                                title: "Home",
                                headerTitle: "Home",
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="CovenantofChrist"
                        component={CovenantofChristScreen}
                        options={
                            {
                                title: "Covenant of Christ",
                                headerTitle: "Covenant of Christ",
                                showLayoutToggle: true,
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="OldCovenants"
                        component={OldCovenantsScreen}
                        options={
                            {
                                title: "Old Covenants",
                                headerTitle: "Old Covenants",
                                showLayoutToggle: true,
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="NewCovenants"
                        component={NewCovenantsScreen}
                        initialParams={{ tabIndex: 0 }}
                        options={
                            {
                                title: "New Covenants",
                                headerTitle: "New Covenants",
                                showLayoutToggle: true,
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="ModernCovenants"
                        component={ModernCovenantsScreen}
                        initialParams={{ tabIndex: 0 }}
                        options={
                            {
                                title: "Modern Covenants",
                                headerTitle: "Modern Covenants",
                                showLayoutToggle: true,
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="Glossary"
                        component={GlossaryScreen}
                        options={
                            {
                                title: "A Glossary of Gospel Terms",
                                headerTitle: "A Glossary of Gospel Terms",
                                showLayoutToggle: true,
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="Chapter"
                        component={ChapterScreen}
                        options={
                            {
                                drawerItemStyle: { display: "none" },
                                showLayoutToggle: true,
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="Reader"
                        component={ReaderScreen}
                        options={
                            {
                                drawerItemStyle: { display: "none" },
                                ...fastTabTransition,
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="Screens"
                        component={ScreensScreen}
                        options={
                            {
                                title: "Screens",
                                headerTitle: "Screens",
                                drawerItemStyle: { display: "none" },
                                ...fastTabTransition,
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="Search"
                        component={KeywordSearchScreen}
                        options={
                            {
                                title: "Search",
                                headerTitle: "Search",
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="SearchResults"
                        component={SearchResultsScreen}
                        options={
                            {
                                title: "Search Results",
                                headerTitle: "Search Results",
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="Converter"
                        component={ConverterScreen}
                        options={
                            {
                                title: "Converter",
                                headerTitle: "Converter",
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="Annotations"
                        component={AnnotationsScreen}
                        options={
                            {
                                title: "Annotations",
                                headerTitle: "Annotations",
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="History"
                        component={HistoryScreen}
                        options={
                            {
                                title: "History",
                                headerTitle: "History",
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="License"
                        component={LicenseScreen}
                        options={
                            {
                                title: "License",
                                headerTitle: "License",
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="Guide"
                        component={OnboardingScreen}
                        options={
                            {
                                title: "Guide",
                                headerTitle: "Guide",
                            } as CustomStackNavigationOptions
                        }
                    />
                    <Stack.Screen
                        name="Backup"
                        component={BackupScreen}
                        options={
                            {
                                title: "Backup & Restore",
                                headerTitle: "Backup & Restore",
                            } as CustomStackNavigationOptions
                        }
                    />
                </Stack.Navigator>
            )}
        </View>
    );
}

const CustomDrawerContent = ({
    navigation,
    state,
}: {
    navigation: any;
    state: any;
}) => {
    const [activeRoute, setActiveRoute] = useState("Home");
    const lastKnownRoute = useRef("Home");
    // Ensure Home is highlighted on initial load
    useEffect(() => {
        // If no state is available yet, default to Home
        if (!state || !state.routes || state.routes.length === 0) {
            setActiveRoute("Home");
        }
    }, []);

    // Improved active route calculation to handle nested navigation state
    const getActiveRoute = (state: any): string => {
        // Handle cases where state is not yet initialized
        if (!state || !state.routes || state.routes.length === 0) {
            return "Home";
        }

        // If index is out of bounds, default to Home
        if (state.index < 0 || state.index >= state.routes.length) {
            return "Home";
        }

        const currentRoute = state.routes[state.index];
        if (!currentRoute || !currentRoute.name) {
            return "Home";
        }

        // If we're in the drawer and the current route is StackNav, check its nested state
        if (currentRoute.name === "StackNav" && currentRoute.state) {
            return getActiveRoute(currentRoute.state);
        }

        // If the current route has nested state, recursively get the active route
        if (currentRoute.state) {
            const nestedRoute = getActiveRoute(currentRoute.state);

            // Handle special cases for tabbed screens
            if (currentRoute.name === "NewCovenants") {
                // Check if we're in a specific tab of NewCovenants
                if (nestedRoute === "New Testament") {
                    return "NewTestament";
                } else if (nestedRoute === "Book of Mormon") {
                    return "BookofMormon";
                }
            } else if (currentRoute.name === "ModernCovenants") {
                // Check if we're in a specific tab of ModernCovenants
                if (nestedRoute === "Teachings & Commandments") {
                    return "TeachingsCommandments";
                } else if (nestedRoute === "Covenant of Christ") {
                    return "Covenant of Christ";
                }
            }

            return nestedRoute;
        }

        return currentRoute.name || "Home";
    };

    // Update active route whenever state or navigation changes
    useEffect(() => {
        const updateActiveRoute = () => {
            const newActiveRoute = getActiveRoute(state);

            // Ensure Home is the default if no valid route is found
            const finalActiveRoute =
                newActiveRoute || lastKnownRoute.current || "Home";

            // Store the last known route for persistence
            if (finalActiveRoute && finalActiveRoute !== "Home") {
                lastKnownRoute.current = finalActiveRoute;
            }

            setActiveRoute(finalActiveRoute);
        };

        // Call immediately to set initial state
        updateActiveRoute();

        // Listen for navigation state changes if available
        let unsubscribe: (() => void) | undefined;
        try {
            unsubscribe = navigation.addListener?.("state", updateActiveRoute);
        } catch (error) {
            console.warn("Navigation listener not available:", error);
        }

        return unsubscribe;
    }, [state, navigation]);

    return (
        <ScrollView
            style={styles.drawerContent}
            nestedScrollEnabled={true}
            contentContainerStyle={styles.drawerScrollContent}
        >
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "Home" && styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", { screen: "Home" })
                }
            >
                <Text style={styles.drawerItemText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "OldCovenants" && styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", {
                        screen: "OldCovenants",
                    })
                }
            >
                <Text style={styles.drawerItemText}>Old Covenants</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "NewCovenants" && styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", {
                        screen: "NewCovenants",
                    })
                }
            >
                <Text style={styles.drawerItemText}>New Covenants</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "NewTestament" && styles.drawerItemActive,
                ]}
                onPress={() => {
                    navigation.navigate("StackNav", {
                        screen: "NewCovenants",
                        params: { screen: "New Testament" },
                    });
                }}
            >
                <Text style={styles.drawerItemText}>
                    &nbsp;&nbsp;&nbsp;&nbsp;New Testament
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "BookofMormon" && styles.drawerItemActive,
                ]}
                onPress={() => {
                    navigation.navigate("StackNav", {
                        screen: "NewCovenants",
                        params: { screen: "Book of Mormon" },
                    });
                }}
            >
                <Text style={styles.drawerItemText}>
                    &nbsp;&nbsp;&nbsp;&nbsp;Book of Mormon
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "Glossary" && styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", {
                        screen: "Glossary",
                    })
                }
            >
                <Text style={[styles.drawerItemText, commonStyles.italic]}>
                    &nbsp;&nbsp;&nbsp;&nbsp;A Glossary of Gospel Terms
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "ModernCovenants" &&
                        styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", {
                        screen: "ModernCovenants",
                    })
                }
            >
                <Text style={styles.drawerItemText}>Modern Covenants</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "TeachingsCommandments" &&
                        styles.drawerItemActive,
                ]}
                onPress={() => {
                    navigation.navigate("StackNav", {
                        screen: "ModernCovenants",
                        params: { screen: "Teachings & Commandments" },
                    });
                }}
            >
                <Text style={styles.drawerItemText}>
                    &nbsp;&nbsp;&nbsp;&nbsp;Teachings & Commandments
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "Covenant of Christ" &&
                        styles.drawerItemActive,
                ]}
                onPress={() => {
                    navigation.navigate("StackNav", {
                        screen: "ModernCovenants",
                        params: { screen: "Covenant of Christ" },
                    });
                }}
            >
                <Text style={styles.drawerItemText}>
                    &nbsp;&nbsp;&nbsp;&nbsp;Covenant of Christ
                </Text>
            </TouchableOpacity>
            <Divider style={styles.divider} />
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "Search" && styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", {
                        screen: "Search",
                    })
                }
            >
                <Text style={styles.drawerItemText}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "Converter" && styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", {
                        screen: "Converter",
                    })
                }
            >
                <Text style={styles.drawerItemText}>Converter</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "Annotations" && styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", {
                        screen: "Annotations",
                    })
                }
            >
                <Text style={styles.drawerItemText}>Annotations</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "History" && styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", {
                        screen: "History",
                    })
                }
            >
                <Text style={styles.drawerItemText}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "Backup" && styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", {
                        screen: "Backup",
                    })
                }
            >
                <Text style={styles.drawerItemText}>Backup/Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "License" && styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", {
                        screen: "License",
                    })
                }
            >
                <Text style={styles.drawerItemText}>License</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.drawerItem,
                    activeRoute === "Guide" && styles.drawerItemActive,
                ]}
                onPress={() =>
                    navigation.navigate("StackNav", {
                        screen: "Guide",
                    })
                }
            >
                <Text style={styles.drawerItemText}>Guide</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

function DrawerNav() {
    const DividerComponent = () => null;

    return (
        <View
            style={[commonStyles.fill, { backgroundColor: colors.background }]}
        >
            <NavigationContainer ref={navigationRef}>
                <Drawer.Navigator
                    id={undefined}
                    initialRouteName="StackNav"
                    drawerContent={(props) => (
                        <CustomDrawerContent {...props} />
                    )}
                    backBehavior="history"
                    screenOptions={{
                        // header: getHeaderTitle,
                        drawerStyle: {
                            backgroundColor: colors.surfaceDark,
                        },
                        drawerActiveBackgroundColor: colors.converterButtonBlue,
                        drawerActiveTintColor: colors.white,
                        drawerInactiveTintColor: colors.cardBackground,
                        drawerLabelStyle: {
                            fontSize: 16,
                        },
                        headerShown: false,
                        swipeEdgeWidth: 50,
                    }}
                >
                    <Drawer.Screen name="StackNav" component={StackNav} />
                </Drawer.Navigator>
            </NavigationContainer>
        </View>
    );
}

const styles = StyleSheet.create({
    drawerScrollContent: { paddingBottom: 60 },
    drawerContent: {
        flex: 1,
        paddingTop: 50,
        paddingHorizontal: 20,
    },
    drawerItem: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        margin: 4,
        color: colors.white,
    },
    drawerItemActive: {
        backgroundColor: colors.converterButtonBlue,
        borderRadius: 4,
    },
    drawerItemText: {
        color: colors.white,
        fontSize: 16,
    },
    divider: {
        marginVertical: 10,
        marginHorizontal: 10,
    },
    loadingOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.overlay,
        zIndex: 1,
    },
});

export default DrawerNav;
