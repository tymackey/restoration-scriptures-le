import { useCallback } from "react";
import { List } from "react-native-paper";
import { StyleSheet } from "react-native";
import { colors } from "../constants/colors";

export default function ScriptureListItem({
    item,
    action,
}: {
    item: { name: string };
    action: Function;
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
            containerStyle={styles.ListItemContainer}
            style={styles.ListItem}
            titleStyle={styles.ListItemContent}
            onPress={handlePress}
            title={item.name}
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
    ListItem: {
        backgroundColor: colors.background,
    },
    ListItemContent: {
        color: colors.text,
    },
});
