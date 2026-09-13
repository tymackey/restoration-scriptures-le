import { useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useSettingsStore } from "../data/useSettingsStore";
import { useScreensStore } from "../data/useScreensStore";
import { useShallow } from "zustand/react/shallow";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/build/Entypo";
import HeaderMenu from "./HeaderMenu";
import { colors } from "../constants/colors";

const TitleNavigation = ({ route, options }: { route: any; options: any }) => {
    const navigation = useNavigation();

    const [layout, setLayout] = useSettingsStore(
        useShallow((state) => [state.layout, state.setLayout]),
    );
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // On the Reader, chapter navigation updates the screens store (not
    // route.params, which stays frozen at the first-opened chapter), so the
    // title must track the active screen's name to update between chapters.
    const activeScreenName = useScreensStore(
        (s) => s.screens.find((x) => x.id === s.activeScreenId)?.name,
    );
    const title =
        route.name === "Reader"
            ? (activeScreenName ??
              route?.params?.name ??
              options.headerTitle ??
              " ")
            : (route?.params?.name ?? options.headerTitle ?? " ");

    const openDrawer = () => {
        setIsDrawerOpen(!isDrawerOpen);
        navigation.dispatch(DrawerActions.openDrawer());
    };

    return (
        <View style={styles.container}>
            <View style={styles.containerLeft}>
                {Platform.OS === "ios" && route.name !== "Home" ? (
                    <AntDesign
                        name="left"
                        size={28}
                        color={colors.white}
                        style={styles.backIcon}
                        onPress={() => {
                            if (
                                route.name === "Reader" &&
                                useScreensStore.getState().goBackWithinActive()
                            ) {
                                return;
                            }
                            if (navigation.canGoBack()) {
                                navigation.goBack();
                            } else {
                                (navigation as any).navigate("Home");
                            }
                        }}
                    />
                ) : (
                    <Entypo
                        name="menu"
                        size={28}
                        color={colors.white}
                        style={styles.backIcon}
                        onPress={() => openDrawer()}
                    />
                )}
                <Text
                    style={styles.title}
                    numberOfLines={1}
                    ellipsizeMode="head"
                >
                    {title}
                </Text>
            </View>
            <HeaderMenu route={route} options={options} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surfaceDark,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-around",
    },
    containerLeft: {
        flex: 6,
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center",
        height: 50,
        paddingLeft: 8,
        paddingTop: 4,
    },
    backIcon: {
        paddingRight: 12,
    },
    title: {
        flex: 1,
        fontSize: 18,
        justifyContent: "center",
        alignItems: "flex-start",
        fontWeight: "bold",
        textAlign: "left",
        color: colors.offWhite,
    },
});

export default TitleNavigation;
