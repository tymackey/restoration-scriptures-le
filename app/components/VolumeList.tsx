import ScriptureCardItem from "./ScriptureCardItem";
import ScriptureListItem from "./ScriptureListItem";
import {
    useWindowDimensions,
    View,
    StyleSheet,
    Text,
    FlatList,
} from "react-native";
import { useSettingsStore } from "../data/useSettingsStore";
import { useNavigation } from "@react-navigation/native";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { colors } from "../constants/colors";
import { useDatabase } from "../data/useDatabase";
import { cardStyles } from "../styles/cardStyles";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect, useState, useMemo } from "react";
import { CardLayoutConfig, useCardLayout } from "../util/cardLayoutUtils";
import { useShallow } from "zustand/react/shallow";

export default function VolumeList({ items }: { items: any[] }) {
    const navigation = useNavigation<DrawerNavigationProp<any>>();
    const layout = useSettingsStore((state) => state.layout);
    const { getChapters, getChapterByName } = useDatabase();
    const isLandscape = useSettingsStore(
        useShallow((state) => state.isLandscape),
    );

    // Memoize the config to prevent infinite re-renders
    const cardLayoutConfig = useMemo<CardLayoutConfig>(
        () => ({
            isLandscape: isLandscape,
        }),
        [isLandscape],
    );

    // Use shared card layout utility
    const { numColumns: calculatedNumColumns, cardWidth } =
        useCardLayout(cardLayoutConfig);
    const numColumns = layout === "list" ? 1 : calculatedNumColumns;

    const requestChapter = async (id: string, volume_id: string) => {
        try {
            let chapterResult = await getChapters(id, volume_id);
            if (!chapterResult.length) {
                chapterResult = await getChapterByName(id, volume_id);
            }
            return chapterResult;
        } catch (e) {
            console.error(e);
            return [];
        }
    };

    const navigate = async (item: any): Promise<void> => {
        if (item.num_chapters === 1) {
            const chapterResult = await requestChapter(item.id, item.volume_id);
            navigation.navigate("Reader", {
                book_chapter: chapterResult[0].book_chapter,
                book_id: chapterResult[0].book_id,
                chapter_id: chapterResult[0].chapter_id,
                name: chapterResult[0].name,
                volume_id: chapterResult[0].volume_id,
            });
        } else {
            navigation.navigate("Chapter", {
                id: item.id,
                volume_id: item.volume_id,
                name: item.name,
            });
        }
    };

    const renderListItem = ({ item }: { item: any }) => {
        return (
            <ScriptureListItem
                item={item}
                action={(itemData: any) => navigate(itemData)}
            />
        );
    };

    const renderCardItem = ({ item, index }: { item: any; index: number }) => {
        return (
            <ScriptureCardItem
                item={item}
                action={(itemData: any) => navigate(itemData)}
                cardWidth={cardWidth}
                landscape={isLandscape}
            />
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                key={`${layout}-${numColumns}`}
                data={items}
                renderItem={(item: any) => {
                    if (layout === "list") {
                        return renderListItem(item);
                    }

                    return renderCardItem(item);
                }}
                numColumns={numColumns}
                extraData={layout}
                keyExtractor={(item) => `${item.id}-${item.name}`}
                contentContainerStyle={
                    layout === "list"
                        ? styles.contentContainer
                        : cardStyles.cardContentContainer
                }
                columnWrapperStyle={
                    layout !== "list" && numColumns > 1
                        ? cardStyles.row
                        : undefined
                }
                onRefresh={() => undefined}
                refreshing={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    contentContainer: {
        paddingHorizontal: 0,
        paddingVertical: 8,
    },
});
