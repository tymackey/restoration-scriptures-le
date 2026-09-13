import {
    View,
    StyleSheet,
    Pressable,
    Button,
    useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import images from "../../assets/images";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { colors } from "../constants/colors";
import { useCallback, useEffect } from "react";
import { useSettingsStore } from "../data/useSettingsStore";
import * as ScreenOrientation from "expo-screen-orientation";
import Sentry from "@sentry/react-native";
import { useFocusEffect, CommonActions } from "@react-navigation/native";

export default function HomeScreen({
    navigation,
}: {
    navigation: DrawerNavigationProp<any>;
}) {
    const orientation = useSettingsStore((state) => state.orientation);
    const setOrientation = useSettingsStore((state) => state.setOrientation);
    const { width, height } = useWindowDimensions();

    useEffect(() => {
        const getCurrentOrientation = async () => {
            try {
                const currentOrientation =
                    await ScreenOrientation.getOrientationAsync();
                const isLandscape =
                    currentOrientation ===
                        ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                    currentOrientation ===
                        ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
                const newOrientation = isLandscape ? "LANDSCAPE" : "PORTRAIT";
                setOrientation(newOrientation);
            } catch (error) {
                console.log("Error getting current orientation:", error);
            }
        };

        ScreenOrientation.unlockAsync()
            .then(() => {
                getCurrentOrientation();
            })
            .catch((error) => {
                console.log("Error unlocking screen orientation:", error);
            });

        const subscription = ScreenOrientation.addOrientationChangeListener(
            ({ orientationInfo }) => {
                const landscape =
                    orientationInfo.orientation ===
                        ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                    orientationInfo.orientation ===
                        ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
                setOrientation(landscape ? "LANDSCAPE" : "PORTRAIT");
            },
        );

        return () =>
            ScreenOrientation.removeOrientationChangeListener(subscription);
    }, [setOrientation]);

    const imageFiles = ["oc", "nc", "glossary", "mc"];

    const handleImagePress = (file: string) => {
        if (file === "glossary") {
            navigation.navigate("StackNav", { screen: "Glossary" });
        } else {
            const imageNav: Record<string, string> = {
                oc: "OldCovenants",
                nc: "NewCovenants",
                mc: "ModernCovenants",
            };
            navigation.navigate(imageNav[file]);
        }
    };

    // useFocusEffect(
    //     // Reset nested navigation on return to Home
    //     useCallback(() => {
    //         navigation.dispatch(
    //             CommonActions.reset({
    //                 index: 0,
    //                 routes: [{ name: "Home" }],
    //             }),
    //         );
    //     }, [navigation]),
    // );

    const isLandscape = width > height;

    return (
        <View style={styles.mainView}>
            {imageFiles.map((file, index) => (
                <View
                    key={index}
                    style={[
                        styles.imageContainer,
                        isLandscape
                            ? styles.imageContainerLandscape
                            : styles.imageContainerPortrait,
                    ]}
                >
                    <Pressable
                        style={styles.link}
                        onPress={() => handleImagePress(file)}
                    >
                        <Image
                            source={images[file]}
                            style={styles.image}
                            contentFit="contain"
                            accessible={true}
                        />
                    </Pressable>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    mainView: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "space-evenly",
        flexWrap: "wrap",
        alignItems: "center",
        padding: 10,
        backgroundColor: colors.background,
    },
    link: {
        fontSize: 24,
        fontWeight: "500",
        color: colors.primary,
        padding: 8,
    },
    imageContainer: {
        margin: "2.5%",
    },
    imageContainerPortrait: {
        width: "45%",
        height: "45%",
    },
    imageContainerLandscape: {
        width: "20%",
        height: "80%",
    },
    image: {
        width: "100%",
        height: "100%",
    },
});
