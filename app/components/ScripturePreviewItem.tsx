import { Card, Text } from "react-native-paper";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import RenderHtml from "../util/RenderHtml";
import { cardStyles } from "../styles/cardStyles";
import { colors } from "../constants/colors";
import { Chapter } from "../data/types";
import { useSafeAreaFrame } from "react-native-safe-area-context";
import { commonStyles } from "../styles/commonStyles";

export default function ScripturePreviewItem({
    item,
    action,
    landscape,
}: {
    item: Chapter;
    action: Function;
    landscape: boolean;
}) {
    const { width } = useSafeAreaFrame();

    return (
        <Card
            style={[
                previewStyles.CardContainer,
                landscape ? previewStyles.width33 : previewStyles.width50,
                width > 1024
                    ? previewStyles.aspectWide
                    : previewStyles.aspectNarrow,
            ]}
            contentStyle={commonStyles.noPaddingMargin}
        >
            <Pressable
                onPress={() => action(item)}
                style={previewStyles.CardPressable}
            >
                <Card.Title
                    style={previewStyles.CardHeader}
                    titleStyle={previewStyles.CardTitle}
                    title={item.name}
                ></Card.Title>
                <View style={previewStyles.CardContent}>
                    <RenderHtml html={item.preview} />
                </View>
            </Pressable>
        </Card>
    );
}

const previewStyles = StyleSheet.create({
    width33: { width: "33%" },
    width50: { width: "50%" },
    aspectWide: { aspectRatio: 1.8 },
    aspectNarrow: { aspectRatio: 1.2 },
    CardContainer: {
        backgroundColor: colors.background,
        color: colors.text,
        aspectRatio: 1.4,
        borderStyle: "solid",
        borderColor: colors.lightBorder,
        borderWidth: 2,
        borderRadius: 2,
        marginHorizontal: 0,
        padding: 4,
    },
    CardPressable: {
        flex: 1,
        width: "100%",
        minWidth: "100%",
        height: "100%",
        minHeight: "100%",
        overflow: "hidden",
    },
    CardHeader: {
        flex: 1,
        backgroundColor: colors.cardBackground,
        width: "100%",
        height: 12,
        marginVertical: -16,
    },
    CardTitle: {
        textAlign: "center",
        color: colors.darkText,
        fontWeight: "700",
        margin: 0,
        paddingTop: 12,
        marginBottom: 0,
    },
    CardContent: {
        flex: 1,
        width: "100%",
        minWidth: "100%",
        height: "100%",
        minHeight: "100%",
        marginTop: 16,
        overflow: "hidden",
    },
});
