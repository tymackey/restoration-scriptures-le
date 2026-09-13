import React, { useState, useRef, useEffect } from "react";
import {
    ParamListBase,
    RouteProp,
    useNavigation,
} from "@react-navigation/native";
import { useDatabase } from "../data/useDatabase";
import { useSettingsStore } from "../data/useSettingsStore";
import { useMenuStore } from "../data/useMenuStore";
import { useScreensStore } from "../data/useScreensStore";
import { Chapter } from "../data/types";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Dimensions,
} from "react-native";
import { Menu } from "react-native-paper";
import {
    Entypo as EntypoIcon,
    MaterialCommunityIcons as MaterialCommunityIcon,
} from "@expo/vector-icons";
import { useShallow } from "zustand/react/shallow";
import TrackPlayer from "@weights-ai/react-native-track-player";
import { colors } from "../constants/colors";

export default function HeaderMenu({
    route,
    options,
}: {
    route: RouteProp<ParamListBase, "Reader" | "Chapter">;
    options: any;
}) {
    const navigation = useNavigation<DrawerNavigationProp<any>>();
    const { getChapterByName, getFirstChapterByVolume } = useDatabase();

    const [visible, setVisible] = useState(false);
    const [layout, setLayout] = useSettingsStore(
        useShallow((state) => [state.layout, state.setLayout]),
    );
    const [displayLEVerses, toggleLEVerses] = useSettingsStore(
        useShallow((state) => [state.displayLEVerses, state.toggleLEVerses]),
    );
    const [isAutoPlaying, toggleAutoPlay] = useSettingsStore(
        useShallow((state) => [state.isAutoPlaying, state.toggleAutoPlay]),
    );
    const currentReference = useSettingsStore(
        useShallow((state) => state.currentReference),
    );
    const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });
    const [menuWidth, setMenuWidth] = useState(240);
    const { showMenu, hideMenu } = useMenuStore();
    const screensCount = useScreensStore((state) => state.screens.length);
    const closeAllScreens = useScreensStore((state) => state.closeAllScreens);
    const menuButtonRef = useRef<any>(null);

    // The reader renders the active screen from useScreensStore, and in-reader
    // navigation (cross-reference links, next/previous chapter) updates that
    // store WITHOUT touching route.params. So the menu must read the current
    // chapter from the active screen — otherwise route.params stays stale and
    // the "Switch to …" item (and the KJV/LDS label) reflect the wrong volume.
    const activeChapter = useScreensStore(
        useShallow((state) => {
            const active = state.screens.find(
                (s) => s.id === state.activeScreenId,
            );
            if (!active) return null;
            return {
                volume_id: active.volume_id,
                book_id: active.book_id,
                book_chapter: active.book_chapter,
                chapter_id: active.chapter_id,
                name: active.name,
            };
        }),
    );
    // Prefer the live active-screen chapter; fall back to route.params for the
    // brief window before a screen exists (e.g. launch restore).
    const currentChapter = (activeChapter ??
        (route.params as Chapter | undefined)) as Chapter | undefined;

    // Measure the menu button and open a dropdown anchored to it.
    const openMenuAnchored = (items: React.ReactNode) => {
        const width = calculateMenuWidth();
        setMenuWidth(width);

        if (menuButtonRef.current) {
            menuButtonRef.current.measure((x, y, w, height, pageX, pageY) => {
                const calculatedWidth = calculateMenuWidth();
                // Anchor the right side of the menu to the icon.
                const anchorPosition = {
                    x: pageX - calculatedWidth + 28,
                    y: pageY + height,
                };
                setMenuAnchor(anchorPosition);
                showMenu(anchorPosition, calculatedWidth, items);
            });
        } else {
            // Fallback to the stored anchor position
            showMenu(menuAnchor, width, items);
        }
    };

    const handleShowMenu = () => openMenuAnchored(renderMenuItems());

    const handleShowScreensMenu = () =>
        openMenuAnchored(renderScreensMenuItems());

    const renderScreensMenuItems = () => (
        <View>
            <Menu.Item
                title="Close All Screens"
                titleStyle={styles.menuItemTitle}
                onPress={() => {
                    hideMenu();
                    closeAllScreens();
                    navigation.navigate("Home");
                }}
            />
        </View>
    );

    const renderMenuItems = () => {
        return (
            <View>
                {(currentChapter?.volume_id === "cc" ||
                    currentChapter?.volume_id === "bofm") && (
                    <Menu.Item
                        title={
                            "Switch to " +
                            (currentChapter?.volume_id === "cc"
                                ? "Book of Mormon"
                                : "Covenant of Christ")
                        }
                        titleStyle={styles.menuItemTitle}
                        onPress={() => {
                            const params = currentChapter as Chapter;
                            switchVolume(
                                params.book_chapter + "",
                                params.book_id,
                                Number(params.chapter_id),
                                params.name,
                                params.volume_id,
                            );
                            hideMenu();
                        }}
                    />
                )}

                <Menu.Item
                    title={
                        (displayLEVerses ? "Hide " : "Show ") +
                        (["oc", "nt"].includes(currentChapter?.volume_id ?? "")
                            ? "KJV"
                            : "LDS") +
                        " chapters & verses"
                    }
                    titleStyle={styles.menuItemTitle}
                    onPress={() => {
                        hideMenu();
                        toggleLEVerses(!displayLEVerses);
                    }}
                />

                <Menu.Item
                    title={(isAutoPlaying ? "Disable" : "Enable") + " Autoplay"}
                    titleStyle={styles.menuItemTitle}
                    onPress={() => {
                        hideMenu();
                        toggleAutoPlay(!isAutoPlaying);
                    }}
                />
            </View>
        );
    };

    const toggleLayout = () => {
        setTimeout(() => {
            let layoutValue = layout === "list" ? "grid" : "list";
            setLayout(layoutValue);
        }, 0);
    };

    const switchVolume = async (
        book_chapter: string,
        book_id: string,
        chapter_id: number,
        name: string,
        volume_id: string,
    ) => {
        let chapterResult: Chapter[] | Chapter;

        await TrackPlayer.stop();
        await TrackPlayer.reset();

        // Extract current paragraph position from currentReference
        // Format: "book_id chapter:position"
        let currentPosition = 0;
        if (currentReference) {
            const match = currentReference.match(/:(\d+)$/);
            if (match) {
                currentPosition = parseInt(match[1], 10);
            }
        }

        if (volume_id === "cc") {
            chapterResult = await getChapterByName(name, "bofm");
        } else {
            chapterResult = await getChapterByName(name, "cc");
        }

        if (chapterResult[0]) {
            navigation.navigate("Reader", {
                book_chapter: chapterResult[0].book_chapter,
                book_id: chapterResult[0].book_id,
                chapter_id: chapterResult[0].chapter_id,
                name: chapterResult[0].name,
                volume_id: chapterResult[0].volume_id,
                position: currentPosition,
            });
        } else {
            // For chapters that don't match between volumes,
            // navigate to the first chapter of the volume instead
            if (volume_id === "cc") {
                chapterResult = (await getFirstChapterByVolume(
                    "bofm",
                )) as Chapter;
            } else {
                chapterResult = (await getFirstChapterByVolume(
                    "cc",
                )) as Chapter;
            }
            navigation.navigate("Reader", {
                book_chapter: chapterResult.book_chapter,
                book_id: chapterResult.book_id,
                chapter_id: chapterResult.chapter_id,
                name: chapterResult.name,
                volume_id: chapterResult.volume_id,
                position: currentPosition,
            });
        }
    };

    // Calculate menu width based on content
    const calculateMenuWidth = () => {
        const screenWidth = Dimensions.get("window").width;
        const baseWidth = 240;
        const maxWidth = screenWidth * 0.8;

        // Estimate width based on longest menu item
        const longestText = "Switch to Book of Mormon"; // Longest menu item
        const estimatedWidth = longestText.length * 12; // Rough estimate: 12px per character

        return Math.min(Math.max(estimatedWidth, baseWidth), maxWidth);
    };

    const routeName = route.name as string;

    return (
        <View style={styles.container}>
            {routeName !== "Screens" && (
                <View style={styles.optionsContainer}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => navigation.navigate("Screens")}
                    >
                        <MaterialCommunityIcon
                            name="content-duplicate"
                            size={22}
                            color={colors.white}
                        />
                        {screensCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {screensCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {(route.name === "Chapter" || options.showLayoutToggle) && (
                <View style={styles.optionsContainer}>
                    {layout === "list" ? (
                        <EntypoIcon.Button
                            name="grid"
                            style={styles.icon}
                            iconStyle={styles.iconButtonIcon}
                            size={24}
                            onPress={() => toggleLayout()}
                        />
                    ) : (
                        <EntypoIcon.Button
                            name="list"
                            style={styles.icon}
                            iconStyle={styles.iconButtonIcon}
                            size={24}
                            onPress={() => toggleLayout()}
                        />
                    )}
                </View>
            )}

            {route.name === "Reader" && (
                <View style={styles.optionsContainer}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={handleShowMenu}
                        ref={menuButtonRef}
                    >
                        <MaterialCommunityIcon
                            name="dots-vertical"
                            size={24}
                            color={colors.white}
                        />
                    </TouchableOpacity>
                </View>
            )}

            {routeName === "Screens" && screensCount > 0 && (
                <View style={styles.optionsContainer}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={handleShowScreensMenu}
                        ref={menuButtonRef}
                    >
                        <MaterialCommunityIcon
                            name="dots-vertical"
                            size={24}
                            color={colors.white}
                        />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "flex-end",
        paddingRight: 8,
    },
    optionsContainer: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignContent: "center",
        gap: 8,
        height: "100%",
        paddingTop: 6,
    },
    menuButton: {
        padding: 8,
        backgroundColor: colors.surfaceDark,
        borderRadius: 4,
    },
    badge: {
        position: "absolute",
        top: -2,
        right: -2,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        paddingHorizontal: 3,
        backgroundColor: colors.converterButtonBlue,
        justifyContent: "center",
        alignItems: "center",
    },
    badgeText: {
        color: colors.white,
        fontSize: 10,
        fontWeight: "bold",
    },
    icon: {
        flex: 1,
        backgroundColor: colors.surfaceDark,
        color: colors.white,
    },
    // Icon.Button defaults to iconStyle marginRight: 10 (spacing for a text
    // label it doesn't have here); zero it so it matches the menuButton icons
    // and the container's right padding stays uniform across button types.
    iconButtonIcon: {
        marginRight: 0,
    },
    menuItemTitle: {
        color: colors.black,
        flexWrap: "wrap",
        flexShrink: 1,
    },
});
