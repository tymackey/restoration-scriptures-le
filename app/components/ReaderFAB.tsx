import React from "react";
import { Portal, FAB } from "react-native-paper";
import { StyleSheet } from "react-native";
import { colors } from "../constants/colors";

interface ReaderFABProps {
    visible: boolean;
    open: boolean;
    onStateChange: (state: { open: boolean }) => void;
    audioAvailable: boolean;
    onAudioPress: () => void;
    onSettingsPress: () => void;
}

export function ReaderFAB({
    visible,
    open,
    onStateChange,
    onAudioPress,
    onSettingsPress,
}: ReaderFABProps) {
    return (
        <Portal>
            <FAB.Group
                visible={visible}
                open={open}
                icon={open ? "chevron-down" : "chevron-up"}
                fabStyle={styles.fab}
                actions={[
                    {
                        icon: "speaker",
                        size: "medium",
                        onPress: onAudioPress,
                    },
                    {
                        icon: "cog",
                        size: "medium",
                        onPress: onSettingsPress,
                    },
                ]}
                onStateChange={onStateChange}
            />
        </Portal>
    );
}

const styles = StyleSheet.create({
    fab: {
        backgroundColor: colors.linkBlue,
    },
});
