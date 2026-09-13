import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Portal, Modal } from "react-native-paper";
import Constants from "expo-constants";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSettingsStore } from "../data/useSettingsStore";
import { navigationRef } from "../nav/ReaderNav";
import { colors } from "../constants/colors";

// Brief summary shown once after the app updates to a new version. Update the
// heading and bullets for each release that ships user-facing changes. Users
// who want the full walkthrough can tap "See full guide" to open the Guide.
const WHATS_NEW = {
    title: "What's New",
    bullets: [
        "Open multiple chapters at once with the new Screens view, and switch between them like browser tabs.",
        "Faster chapter loading and smoother navigation throughout the app.",
    ],
};

function WhatsNewModal() {
    const isHydrated = useSettingsStore((state) => state.isHydrated);
    const isFirstLaunch = useSettingsStore((state) => state.isFirstLaunch);
    const lastSeenVersion = useSettingsStore((state) => state.lastSeenVersion);
    const setLastSeenVersion = useSettingsStore(
        (state) => state.setLastSeenVersion,
    );

    const [visible, setVisible] = useState(false);
    // Guard so the version check only decides once per app session.
    const decided = useRef(false);

    useEffect(() => {
        if (!isHydrated || decided.current) {
            return;
        }
        decided.current = true;

        // Fresh installs see the full Guide instead (handled in Nav); the
        // first-launch path also records the current version, so this is just
        // a safety guard against showing both at once.
        if (isFirstLaunch) {
            return;
        }

        const currentVersion = Constants.expoConfig?.version ?? null;
        if (currentVersion && lastSeenVersion !== currentVersion) {
            // Record it up front so the summary shows only once, even if the
            // app is closed before the user dismisses it.
            setLastSeenVersion(currentVersion);
            setVisible(true);
        }
    }, [isHydrated, isFirstLaunch, lastSeenVersion, setLastSeenVersion]);

    const dismiss = () => setVisible(false);

    const openGuide = () => {
        setVisible(false);
        if (navigationRef.isReady()) {
            // navigationRef has no static param map, so navigate is untyped here.
            (navigationRef.navigate as (name: string, params?: object) => void)(
                "StackNav",
                { screen: "Guide" },
            );
        }
    };

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={dismiss}
                contentContainerStyle={styles.container}
            >
                <View style={styles.header}>
                    <MaterialCommunityIcons
                        name="star-four-points"
                        size={24}
                        color={colors.warning}
                    />
                    <Text style={styles.title}>{WHATS_NEW.title}</Text>
                </View>
                <ScrollView style={styles.body}>
                    {WHATS_NEW.bullets.map((bullet, index) => (
                        <View key={index} style={styles.bulletRow}>
                            <Text style={styles.bulletDot}>{"•"}</Text>
                            <Text style={styles.bulletText}>{bullet}</Text>
                        </View>
                    ))}
                </ScrollView>
                <View style={styles.actions}>
                    <Pressable
                        style={styles.linkButton}
                        onPress={openGuide}
                        hitSlop={8}
                    >
                        <Text style={styles.linkButtonText}>
                            See full guide
                        </Text>
                    </Pressable>
                    <Pressable
                        style={styles.primaryButton}
                        onPress={dismiss}
                        hitSlop={8}
                    >
                        <Text style={styles.primaryButtonText}>Got it</Text>
                    </Pressable>
                </View>
            </Modal>
        </Portal>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surfaceDark,
        marginHorizontal: 24,
        borderRadius: 12,
        paddingTop: 20,
        paddingBottom: 12,
        paddingHorizontal: 20,
        maxHeight: "80%",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: "600",
        marginLeft: 8,
    },
    body: {
        flexGrow: 0,
    },
    bulletRow: {
        flexDirection: "row",
        marginBottom: 12,
    },
    bulletDot: {
        color: colors.text,
        fontSize: 16,
        lineHeight: 22,
        marginRight: 8,
    },
    bulletText: {
        flex: 1,
        color: colors.lightGray,
        fontSize: 16,
        lineHeight: 22,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8,
    },
    linkButton: {
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    linkButtonText: {
        color: colors.linkBlue,
        fontSize: 16,
    },
    primaryButton: {
        backgroundColor: colors.converterButtonBlue,
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    primaryButtonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: "600",
    },
});

export default WhatsNewModal;
