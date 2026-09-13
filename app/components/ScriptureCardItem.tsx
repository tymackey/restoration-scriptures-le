import { Card, Text } from "react-native-paper";
import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "../constants/colors";
import { commonStyles } from "../styles/commonStyles";

export default function ScriptureCardItem({
    item,
    action,
    cardWidth,
    landscape,
    title,
}: {
    item: { name: string };
    action: Function;
    cardWidth?: number;
    landscape?: boolean;
    title?: string;
}) {
    return (
        <Card
            style={[
                styles.CardContainer,
                commonStyles.noGrow,
                { width: cardWidth },
            ]}
        >
            <Pressable
                onPress={() => action(item)}
                style={styles.CardPressable}
            >
                <View style={styles.Card}>
                    <Text style={styles.CardText} numberOfLines={4}>
                        {title ?? item.name}
                    </Text>
                </View>
            </Pressable>
        </Card>
    );
}

const styles = StyleSheet.create({
    CardContainer: {
        padding: 0,
        borderStyle: "solid",
        borderColor: colors.lightBorder,
        borderWidth: 2,
        borderRadius: 0,
        aspectRatio: 1.2,
        backgroundColor: colors.background,
        color: colors.text,
    },
    CardPressable: {
        flex: 1,
        width: "100%",
        minWidth: "100%",
        height: "100%",
        minHeight: "100%",
    },
    Card: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 0,
        margin: 0,
        width: "100%",
        minWidth: "100%",
        height: "100%",
        minHeight: "100%",
        overflow: "hidden",
    },
    CardText: {
        textAlign: "center",
        color: colors.text,
        paddingHorizontal: 4,
        fontSize: 14,
        flexWrap: "wrap",
        width: "100%",
        textAlignVertical: "center",
        overflow: "hidden",
    },
});
