import React, { useRef, useMemo } from "react";
import {
    StyleSheet,
    TouchableOpacity,
    View,
    Text,
    Pressable,
    Platform,
} from "react-native";

import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSettingsStore } from "../data/useSettingsStore";
import { colors } from "../constants/colors";

const isIos = Platform.OS === "ios";
const isIPad =
    isIos && (Platform as typeof Platform & { isPad: boolean }).isPad;
const dyslexicFontSize = isIPad ? 22 : isIos ? 20 : 24;
const dyslexicLineHeight = isIPad ? 30 : isIos ? 28 : 22;
const dyslexicMarginTop = isIPad ? 14 : isIos ? 12 : 4;

export default function DisplayOptions({ maxWidth }: { maxWidth?: number }) {
    const fontSize = useSettingsStore((state) => state.fontSize);
    const alignment = useSettingsStore((state) => state.alignment);
    const increaseFontSize = useSettingsStore(
        (state) => state.increaseFontSize,
    );
    const decreaseFontSize = useSettingsStore(
        (state) => state.decreaseFontSize,
    );
    const alignLeft = useSettingsStore((state) => state.alignLeft);
    const alignJustify = useSettingsStore((state) => state.alignJustify);
    const setFontFamily = useSettingsStore((state) => state.setFontFamily);
    const changeColorScheme = useSettingsStore(
        (state) => state.changeColorScheme,
    );
    const resetOptions = useSettingsStore((state) => state.resetOptions);
    const toggleBottomMenu = useSettingsStore(
        (state) => state.toggleBottomMenu,
    );
    const FontFamilyButtons = () => (
        <View style={styles.fontOptions}>
            <TouchableOpacity
                style={styles.fontFamilyButton}
                onPress={() => setFontFamily("EBGaramond-Regular")}
            >
                <Text
                    style={[styles.label, styles.garamondLabel]}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.1}
                    numberOfLines={1}
                >
                    Aa
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.fontFamilyButton}
                onPress={() => setFontFamily("Assistant-Regular")}
            >
                <Text
                    style={[styles.label, styles.assistantLabel]}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.1}
                    numberOfLines={1}
                >
                    Aa
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.fontFamilyButton}
                onPress={() => setFontFamily("OpenDyslexic-Regular")}
            >
                <Text
                    style={[
                        styles.label,
                        styles.dyslexicFont,
                        {
                            fontSize: dyslexicFontSize,
                            lineHeight: dyslexicLineHeight,
                            marginTop: dyslexicMarginTop,
                        },
                    ]}
                >
                    Aa
                </Text>
            </TouchableOpacity>
        </View>
    );

    const minFontSize = 16;
    const maxFontSize = 40;
    const decreaseButtonDisabled = fontSize <= minFontSize;
    const increaseButtonDisabled = fontSize >= maxFontSize;
    const alignLeftButtonDisabled = alignment === "left";
    const alignJustifyButtonDisabled = alignment === "justify";

    const FontSizeButtons = () => (
        <View style={styles.fontOptions}>
            <TouchableOpacity
                style={[
                    styles.fontSizeButton,
                    decreaseButtonDisabled && styles.disabledButton,
                ]}
                disabled={decreaseButtonDisabled}
                onPress={() => decreaseFontSize()}
            >
                <Text style={[styles.whiteLabel, styles.fontSizeSmall]}>A</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.fontSizeButton,
                    increaseButtonDisabled && styles.disabledButton,
                ]}
                disabled={increaseButtonDisabled}
                onPress={() => increaseFontSize()}
            >
                <Text style={[styles.whiteLabel, styles.fontSizeLarge]}>A</Text>
            </TouchableOpacity>
        </View>
    );

    const AlignmentButtons = () => {
        return (
            <View style={styles.alignmentContainer}>
                <MaterialCommunityIcons.Button
                    name={"format-align-left"}
                    color={colors.white}
                    backgroundColor={colors.transparent}
                    size={24}
                    style={styles.alignmentButton}
                    onPress={() => alignLeft()}
                />
                <MaterialCommunityIcons.Button
                    name={"format-align-justify"}
                    color={colors.white}
                    backgroundColor={colors.transparent}
                    size={24}
                    style={styles.alignmentButton}
                    onPress={() => alignJustify()}
                />
            </View>
        );
    };

    // Light Schemes
    const paperBackgroundColor = "#FDFBF7"; // Warm white, very slightly off-white
    const paperForegroundColor = "#2C3338"; // Soft black
    const paperMarkerColor = "#D64045"; // Soft red

    const creamBackgroundColor = "#F7F2E9"; // Gentle cream
    const creamForegroundColor = "#2F343B"; // Deep gray-blue
    const creamMarkerColor = "#C7494E"; // Muted red

    const coolBackgroundColor = "#EDF2F7"; // Cool light gray
    const coolForegroundColor = "#1A202C"; // Cool dark gray
    const coolMarkerColor = "#CF4B52"; // Cool red

    // Dark Schemes
    const midnightBackgroundColor = "#1A1B26"; // Deep blue-black
    const midnightForegroundColor = "#D8DEE9"; // Cool white
    const midnightMarkerColor = "#FF6B70"; // Bright coral red

    const monochromeBackgroundColor = "#222222"; // Neutral dark
    const monochromeForegroundColor = "#E0E0E0"; // Light gray
    const monochromeMarkerColor = "#FF5A5F"; // Warm red

    const warmDarkBackgroundColor = "#282524"; // Warm dark brown
    const warmDarkForegroundColor = "#E8E4E3"; // Warm light gray
    const warmDarkMarkerColor = "#E85D5F"; // Warm red

    // // Light
    // const lightBackgroundColor = '#ffffff';
    // const lightForegroundColor = '#15141A';
    // const lightMarkerColor = '#ba3919';

    // // Nord
    // const nordBackgroundColor = '#e5e9f0';
    // const nordForegroundColor = '#2e3440';
    // const nordMarkerColor = '#ba3919';

    // // Sepia
    // const sepiaBackgroundColor = '#f4ecd8';
    // const sepiaForegroundColor = '#5b4636';
    // const sepiaMarkerColor = '#ba3919';

    // // Dark
    // const darkBackgroundColor = '#333333';
    // const darkForegroundColor = '#eeeeee';
    // const darkMarkerColor = '#DD5343';

    // // Groove
    // const grooveBackgroundColor = '#282828';
    // const grooveForegroundColor = '#cec4ac';
    // const grooveMarkerColor = '#DD5343';

    // // Dark Solarized
    // const solarizedBackgroundColor = '#002b36';
    // const solarizedForegroundColor = '#839496';
    // const solarizedMarkerColor = '#DD5343';

    const ColorSchemeButton = ({
        backgroundColor,
        foregroundColor,
        markerColor,
    }: {
        backgroundColor: string;
        foregroundColor: string;
        markerColor: string;
    }) => {
        return (
            <TouchableOpacity
                style={[styles.colorSchemeButton, { backgroundColor }]}
                onPress={() =>
                    changeColorScheme(
                        backgroundColor,
                        foregroundColor,
                        markerColor,
                    )
                }
            >
                <MaterialCommunityIcons
                    name="text"
                    size={24}
                    style={styles.previewIcon}
                    color={foregroundColor}
                />
            </TouchableOpacity>
        );
    };

    const ResetButton = () => (
        <Pressable style={styles.resetButton} onPress={() => resetOptions()}>
            <Text style={[styles.label, styles.text]}>Reset</Text>
        </Pressable>
    );

    const widthStyle = maxWidth ? { maxWidth } : null;
    return (
        <>
            <View style={[styles.header, styles.contentCentered, widthStyle]}>
                <Text style={styles.text}>Display Options</Text>
                <Text style={styles.closeIcon}>
                    <MaterialCommunityIcons.Button
                        name="close"
                        size={32}
                        color={colors.white}
                        backgroundColor={colors.transparent}
                        onPress={() => toggleBottomMenu(false)}
                    />
                </Text>
            </View>
            <BottomSheetScrollView
                showsVerticalScrollIndicator={true}
                style={[styles.scrollView, styles.contentCentered, widthStyle]}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.fontOptionsContainer}>
                    <FontFamilyButtons />
                    <FontSizeButtons />
                    <AlignmentButtons />
                </View>
                <View style={styles.colorSchemeContainer}>
                    <ColorSchemeButton
                        backgroundColor={paperBackgroundColor}
                        foregroundColor={paperForegroundColor}
                        markerColor={paperMarkerColor}
                    />
                    <ColorSchemeButton
                        backgroundColor={creamBackgroundColor}
                        foregroundColor={creamForegroundColor}
                        markerColor={creamMarkerColor}
                    />
                    <ColorSchemeButton
                        backgroundColor={coolBackgroundColor}
                        foregroundColor={coolForegroundColor}
                        markerColor={coolMarkerColor}
                    />
                    <ColorSchemeButton
                        backgroundColor={midnightBackgroundColor}
                        foregroundColor={midnightForegroundColor}
                        markerColor={midnightMarkerColor}
                    />
                    <ColorSchemeButton
                        backgroundColor={monochromeBackgroundColor}
                        foregroundColor={monochromeForegroundColor}
                        markerColor={monochromeMarkerColor}
                    />
                    <ColorSchemeButton
                        backgroundColor={warmDarkBackgroundColor}
                        foregroundColor={warmDarkForegroundColor}
                        markerColor={warmDarkMarkerColor}
                    />
                </View>
                <View style={styles.resetButtonContainer}>
                    <ResetButton />
                </View>
            </BottomSheetScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    dyslexicFont: { fontFamily: "OpenDyslexic-Regular" },
    garamondLabel: { fontFamily: "EBGaramond-Regular", fontSize: 30 },
    assistantLabel: { fontFamily: "Assistant" },
    fontSizeSmall: { fontSize: 14 },
    fontSizeLarge: { fontSize: 24 },
    previewIcon: { height: "100%", paddingLeft: 0 },
    scrollContent: { paddingBottom: 40, alignItems: "center" },
    scrollView: { flex: 1, alignSelf: "stretch" },
    contentCentered: { alignSelf: "center" },
    header: {
        flex: 0,
        display: "flex",
        width: "100%",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        height: 50,
    },
    closeIcon: {
        position: "absolute",
        right: 0,
        top: 0,
    },
    fontOptionsContainer: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: 480,
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "flex-start",
        marginBottom: 4,
        paddingHorizontal: 8,
    },
    alignmentContainer: {
        flex: 0,
        width: "100%",
        flexDirection: "row",
        alignContent: "center",
        justifyContent: "center",
        marginVertical: 8,
        gap: 24,
    },
    text: {
        color: colors.text,
        paddingBottom: 4,
        fontSize: 20,
    },
    label: {
        fontSize: 28,
        color: colors.text,
        textAlign: "center",
        textAlignVertical: "center",
        lineHeight: 32,
    },
    whiteLabel: {
        color: colors.white,
        fontSize: 28,
    },
    fontOptions: {
        flex: 0,
        width: "100%",
        flexDirection: "row",
        alignContent: "center",
        justifyContent: "center",
        alignItems: "center",
        marginVertical: 8,
        gap: 24,
    },
    disabledButton: {
        opacity: 0.4,
        borderStyle: "solid",
    },
    fontFamilyButton: {
        alignItems: "center",
        justifyContent: "center",
        width: isIPad ? 80 : 60,
        height: isIPad ? 80 : 60,
        marginRight: 8,
        padding: 0,
        backgroundColor: colors.background,
        borderRadius: 50,
        color: colors.text,
    },
    fontSizeButton: {
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.white,
        textAlignVertical: "center",
        justifyContent: "center",
        width: 100,
        height: isIPad ? 50 : 40,
        gap: 12,
        borderRadius: 4,
    },
    alignmentButton: {
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.white,
        textAlignVertical: "center",
        justifyContent: "center",
        paddingInlineStart: 20,
        width: 100,
        height: 40,
        borderRadius: 4,
    },
    colorSchemeContainer: {
        flex: 0,
        width: "100%",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-around",
        columnGap: 8,
        margin: 0,
        padding: 0,
        marginBottom: 4,
    },
    colorSchemeButton: {
        flex: 0,
        width: "25%",
        justifyContent: "center",
        alignContent: "center",
        borderWidth: 2,
        borderColor: colors.white,
        alignItems: "center",
        height: 40,
        paddingTop: 4,
        margin: 8,
        borderRadius: 4,
    },
    resetButtonContainer: {
        alignSelf: "center",
        marginVertical: 8,
    },
    resetButton: {
        borderWidth: 1,
        borderColor: colors.text,
        width: 120,
        height: isIPad ? 60 : 40,
        borderRadius: 6,
        justifyContent: "center",
        alignItems: "center",
    },
});
