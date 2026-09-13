import React, { useRef, useCallback, useState, useEffect } from "react";
import {
    Dimensions,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    Platform,
} from "react-native";
import { Image } from "expo-image";
import Onboarding, { Page } from "react-native-onboarding-swiper";
import { useSettingsStore } from "../data/useSettingsStore";
import { useFocusEffect } from "@react-navigation/native";
import { useShallow } from "zustand/react/shallow";
import * as ScreenOrientation from "expo-screen-orientation";
import { colors } from "../constants/colors";
import { commonStyles } from "../styles/commonStyles";

function OnboardingScreen({ navigation }: { navigation: any }) {
    const onboardingRef = useRef(null);
    const setIsFirstLaunch = useSettingsStore(
        (state) => state.setIsFirstLaunch,
    );
    const { width, height } = useWindowDimensions();

    // Lock orientation to portrait when component mounts
    useEffect(() => {
        const lockOrientation = async () => {
            try {
                await ScreenOrientation.lockAsync(
                    ScreenOrientation.OrientationLock.PORTRAIT_UP,
                );
            } catch (error) {
                console.log("Error locking orientation:", error);
            }
        };

        lockOrientation();

        // Unlock orientation when component unmounts
        return () => {
            const unlockOrientation = async () => {
                try {
                    await ScreenOrientation.unlockAsync();
                } catch (error) {
                    console.log("Error unlocking orientation:", error);
                }
            };
            unlockOrientation();
        };
    }, []);

    // Calculate responsive dimensions
    const isTablet = width >= 768 || height >= 1024;
    const isSmallScreen = height < 700;

    // Dynamic sizing based on screen characteristics
    const imageContainerHeight = isTablet ? height * 0.75 : height * 0.62;
    const titleFontSize = isSmallScreen ? 18 : 24;
    const subtitleFontSize = isTablet ? 24 : isSmallScreen ? 16 : 18;
    const subtitleHeight = isTablet ? 120 : 140;
    const subtitleLineHeight = subtitleFontSize * 1.2;
    const subtitleMaxLines = Math.max(
        1,
        Math.floor(subtitleHeight / subtitleLineHeight),
    );

    const renderSubtitle = (text: string) => (
        <Text
            allowFontScaling={false}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            numberOfLines={subtitleMaxLines}
            style={[
                styles.onboardingSubtitle,
                {
                    color: colors.white,
                    height: subtitleHeight,
                    fontSize: subtitleFontSize,
                    lineHeight: subtitleLineHeight,
                },
            ]}
        >
            {text}
        </Text>
    );

    const logoSource = require("../../assets/onboarding/ic_launcher-web.png");
    const intro1Source = isTablet
        ? require("../../assets/onboarding/tablet/intro1.png")
        : require("../../assets/onboarding/phone/intro1.png");
    const intro2Source = isTablet
        ? require("../../assets/onboarding/tablet/intro2.png")
        : require("../../assets/onboarding/phone/intro2.png");
    const intro2aSource = isTablet
        ? require("../../assets/onboarding/tablet/intro2a.png")
        : require("../../assets/onboarding/phone/intro2a.png");
    const intro2bSource = isTablet
        ? require("../../assets/onboarding/tablet/intro2b.png")
        : require("../../assets/onboarding/phone/intro2b.png");
    const intro2cSource = isTablet
        ? require("../../assets/onboarding/tablet/intro2c.png")
        : require("../../assets/onboarding/phone/intro2c.png");
    const intro3Source = isTablet
        ? require("../../assets/onboarding/tablet/intro3.png")
        : require("../../assets/onboarding/phone/intro3.png");
    const intro4Source = isTablet
        ? require("../../assets/onboarding/tablet/intro4.png")
        : require("../../assets/onboarding/phone/intro4.png");
    const intro5Source = isTablet
        ? require("../../assets/onboarding/tablet/intro5.png")
        : require("../../assets/onboarding/phone/intro5.png");
    const intro6Source = isTablet
        ? require("../../assets/onboarding/tablet/intro6.png")
        : require("../../assets/onboarding/phone/intro6.png");
    const intro7Source = isTablet
        ? require("../../assets/onboarding/tablet/intro7.png")
        : require("../../assets/onboarding/phone/intro7.png");
    const intro8Source = isTablet
        ? require("../../assets/onboarding/tablet/intro8.png")
        : require("../../assets/onboarding/phone/intro8.png");
    const intro9Source = isTablet
        ? require("../../assets/onboarding/tablet/intro9.png")
        : require("../../assets/onboarding/phone/intro9.png");
    const intro10Source = isTablet
        ? require("../../assets/onboarding/tablet/intro10.png")
        : require("../../assets/onboarding/phone/intro10.png");
    const intro11Source = isTablet
        ? require("../../assets/onboarding/tablet/intro11.png")
        : require("../../assets/onboarding/phone/intro11.png");
    const intro12Source = isTablet
        ? require("../../assets/onboarding/tablet/intro12.png")
        : require("../../assets/onboarding/phone/intro12.png");
    const intro13Source = isTablet
        ? require("../../assets/onboarding/tablet/intro13.png")
        : require("../../assets/onboarding/phone/intro13.png");
    const intro14Source = isTablet
        ? require("../../assets/onboarding/tablet/intro14.png")
        : require("../../assets/onboarding/phone/intro14.png");
    const intro15Source = isTablet
        ? require("../../assets/onboarding/tablet/intro15.png")
        : require("../../assets/onboarding/phone/intro15.png");
    const intro16Source = isTablet
        ? require("../../assets/onboarding/tablet/intro16.png")
        : require("../../assets/onboarding/phone/intro16.png");
    const intro17Source = isTablet
        ? require("../../assets/onboarding/tablet/intro17.png")
        : require("../../assets/onboarding/phone/intro17.png");
    const intro18Source = isTablet
        ? require("../../assets/onboarding/tablet/intro18.png")
        : require("../../assets/onboarding/phone/intro18.png");
    const screensIntro1Source = isTablet
        ? require("../../assets/onboarding/tablet/screens_intro1.png")
        : require("../../assets/onboarding/phone/screens_intro1.png");
    const screensIntro2Source = isTablet
        ? require("../../assets/onboarding/tablet/screens_intro2.png")
        : require("../../assets/onboarding/phone/screens_intro2.png");

    const handleDone = () => {
        setIsFirstLaunch(false);
        navigation.navigate("Home");
        onboardingRef.current?.goToPage(0);
    };

    useFocusEffect(
        useCallback(() => {
            // Reset the onboarding screen when the user navigates away from it
            return () => {
                onboardingRef.current?.goToPage(0);
            };
        }, []),
    );

    let pages: Page[] = [
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={logoSource}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Restoration Scriptures",
            subtitle: renderSubtitle(
                "Welcome to the new & improved Restoration Scriptures app. This is a little intro to show you around.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={screensIntro1Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Multiple Screens",
            subtitle: renderSubtitle(
                "You can now quickly switch between multiple saved locations. Just tap the Screens icon in the Header.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={screensIntro2Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Manage Your Screens",
            subtitle: renderSubtitle(
                "The Screens page lets you switch between saved screens, add new ones, or remove ones you no longer need.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro18Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Pinch to Resize",
            subtitle: renderSubtitle(
                "Pinch in or out on the scripture text to quickly increase or decrease the font size.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro2Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Highlight",
            subtitle: renderSubtitle(
                "Now you can select a passage and highlight it with 7 different colors.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro3Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Underline",
            subtitle: renderSubtitle("Or underline it, if you prefer."),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro4Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Manage Annotations",
            subtitle: renderSubtitle(
                "View & manage all annotations in one place",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro5Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Backup & Restore",
            subtitle: renderSubtitle(
                "Backup & Restore all annotations and display settings",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro6Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Navigation",
            subtitle: renderSubtitle(
                "Swipe from the left to navigate around the app.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro7Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "List View",
            subtitle: renderSubtitle(
                "You can choose books and chapters in list view...",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro8Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Grid View",
            subtitle: renderSubtitle("or in grid view."),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro9Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Previous/Next Chapter",
            subtitle: renderSubtitle(
                "Click on the left or right side of the screen to go to the previous or next chapter.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro10Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Floating Button",
            subtitle: renderSubtitle(
                "The floating blue button provides reading display options and scripture audio.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro11Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Distraction-Free Reading",
            subtitle: renderSubtitle(
                "Double tap to enjoy a distraction-free reading experience. Double-tap again to restore the floating blue button.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro12Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Reading Display Options",
            subtitle: renderSubtitle(
                "Change the font (Serif, Sans Serif, or Open Dyslexic), adjust the font size, and choose from 6 color schemes.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro13Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Scripture Audio",
            subtitle: renderSubtitle(
                "Listen to the Scriptures with options for 4 different voices and variable speeds.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro14Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Autoplay",
            subtitle: renderSubtitle(
                "Enable autoplay to listen and follow along.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro15Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Keyword Search",
            subtitle: renderSubtitle(
                "Search for keywords or navigate directly to a reference.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro16Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Reference Converter",
            subtitle: renderSubtitle(
                "Convert KJV or LDS references to Restoration Edition format or vice-versa.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro17Source}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "History",
            subtitle: renderSubtitle(
                "View a history of what you've been reading lately.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={logoSource}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "",
            titleStyles: {
                display: "none",
            },
            subtitle: renderSubtitle(
                'Enjoy the app! Send feedback to rescriptures@tuta.io.\n\nTo view this intro again, go to "Guide" in the left drawer.',
            ),
        },
    ];

    const iosPages: Page[] = [
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro2aSource}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Selection Options",
            subtitle: renderSubtitle(
                "Select a passage to annotate, copy, search, or lookup.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro2bSource}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Annotate",
            subtitle: renderSubtitle(
                "For annotation, highlight or underline the selection with 7 different colors.",
            ),
        },
        {
            backgroundColor: colors.background,
            image: (
                <Image
                    source={intro2cSource}
                    contentFit="contain"
                    style={[
                        styles.image,
                        { maxHeight: imageContainerHeight * 0.8 },
                    ]}
                />
            ),
            title: "Modify/Remove Annotations",
            subtitle: renderSubtitle(
                "Select an existing annotation to modify or remove it.",
            ),
        },
    ];

    if (Platform.OS === "ios") {
        pages.splice(4, 1, iosPages[0], iosPages[1], iosPages[2]);
    }

    return (
        <View
            style={[commonStyles.fill, { backgroundColor: colors.borderDark }]}
        >
            <Onboarding
                ref={onboardingRef}
                containerStyles={styles.container}
                imageContainerStyles={{
                    ...styles.onboardingImageContainer,
                    height: imageContainerHeight,
                    maxHeight: imageContainerHeight,
                }}
                titleStyles={{
                    ...styles.onboardingTitle,
                    color: colors.white,
                    fontSize: titleFontSize,
                    lineHeight: titleFontSize * 1.2,
                }}
                bottomBarHeight={60}
                bottomBarColor={colors.borderDark}
                showNext={true}
                showSkip={true}
                showDone={true}
                onDone={handleDone}
                onSkip={handleDone}
                allowFontScalingText={false}
                pages={pages}
            />
        </View>
    );
}

export default OnboardingScreen;

const styles = StyleSheet.create({
    onboardingImageContainer: {
        justifyContent: "center",
        alignItems: "center",
        marginVertical: 0,
        paddingBottom: 32,
    },
    onboardingTitle: {
        fontWeight: "bold",
        textAlign: "center",
        paddingHorizontal: 10,
        marginBottom: 5,
        marginTop: 0,
        height: 44,
    },
    onboardingSubtitle: {
        textAlign: "center",
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    container: {
        flex: 1,
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "center",
        marginVertical: 0,
        paddingVertical: 0,
        backgroundColor: colors.borderDark,
    },
    image: {
        width: "100%",
        height: "100%",
    },
});
