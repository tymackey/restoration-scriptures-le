import { useCallback } from "react";
import { List } from "react-native-paper";
import { StyleSheet } from "react-native";
import { colors } from "../constants/colors";

export default function ScriptureListItem({
    item,
    action,
    title,
}: {
    item: { name: string };
    action: Function;
    title?: string;
}) {
    const handlePress = useCallback(() => {
        try {
            action(item);
        } catch (error) {
            console.error("Error in handlePress: ", error);
        }
    }, [action, item]);

    return (
        <List.Item
            containerStyle={[styles.ListItemContainer, title && title !== item.name ? styles.expanded : undefined]}
            style={styles.ListItem}
            titleStyle={styles.ListItemContent}
            onPress={handlePress}
            title={title ?? item.name}
            titleNumberOfLines={title && title !== item.name ? 0 : 1}
            right={(props) => (
                <List.Icon
                    {...props}
                    icon="chevron-right"
                    color={colors.text}
                />
            )}
        />
    );
}

const styles = StyleSheet.create({
    ListItemContainer: {
        backgroundColor: colors.background,
        height: 32,
        marginVertical: 0,
    },
    expanded: {
        height: "auto",
        minHeight: 32,
    },
    ListItem: {
        backgroundColor: colors.background,
    },
    ListItemContent: {
        color: colors.text,
    },
});
