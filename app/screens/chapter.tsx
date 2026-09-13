import { useState, useCallback } from "react";
import { FlatList, View } from "react-native";
import { useDatabase } from "../data/useDatabase";
import ScriptureListItem from "../components/ScriptureListItem";
import { useSettingsStore } from "../data/useSettingsStore";
import {
    ParamListBase,
    RouteProp,
    useFocusEffect,
} from "@react-navigation/native";
import { colors } from "../constants/colors";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { cardStyles } from "../styles/cardStyles";
import { Chapter } from "../data/types";
import ScripturePreviewItem from "../components/ScripturePreviewItem";
import { useSafeAreaFrame } from "react-native-safe-area-context";
import { commonStyles } from "../styles/commonStyles";
import { formatChapterListLabel } from "../util/chapterLabels";

function ChapterScreen({
    route,
    navigation,
}: {
    route: RouteProp<ParamListBase, string>;
    navigation: DrawerNavigationProp<ParamListBase, string>;
}) {
    const { id, volume_id } = route.params as { id: string; volume_id: string };
    const { getChapters } = useDatabase();
    const [chapters, setChapters] = useState<any[]>([]);
    const layout = useSettingsStore((state) => state.layout);
    const isLandscape = useSettingsStore((state) => state.isLandscape);

    useFocusEffect(
        useCallback(() => {
            const requestChapters = async (id: string, volume_id: string) => {
                try {
                    const chaptersResult = await getChapters(id, volume_id);
                    setChapters(chaptersResult);
                } catch (e) {
                    console.error(e);
                }
            };

            requestChapters(id, volume_id);

            return () => {
                setChapters([]);
            };
        }, [id, volume_id, getChapters]),
    );

    const navigate = async (item: Chapter) => {
        navigation.navigate("Reader", {
            book_id: item.book_id,
            chapter_id: item.chapter_id,
            book_chapter: item.book_chapter,
            name: item.name,
            volume_id: item.volume_id,
        });
    };

    const renderListItem = ({ item }: { item: any }) => {
        return (
            <ScriptureListItem
                item={item}
                title={formatChapterListLabel(item)}
                action={(itemData: any) => navigate(itemData)}
            />
        );
    };

    const renderPreviewItem = ({ item }: { item: any }) => {
        const spacing = 10; // gap from cardStyles
        // const cardWidth = (width - (spacing * (3 + 1))) / 3;
        return (
            <ScripturePreviewItem
                item={item}
                title={formatChapterListLabel(item)}
                action={(itemData: any) => navigate(itemData)}
                landscape={isLandscape}
                cardWidth={(width - 16 - 8 * (previewColumns - 1)) / previewColumns}
            />
        );
    };

    const { width } = useSafeAreaFrame();
    const columnsCount = width / 200;
    const previewColumns = isLandscape ? 3 : 2;

    return (
        <View
            style={[commonStyles.fill, { backgroundColor: colors.background }]}
        >
            <FlatList
                key={`${layout}-${previewColumns}`}
                data={chapters}
                renderItem={(item) => {
                    if (layout === "list") {
                        return renderListItem({ ...item });
                    }

                    return renderPreviewItem({ ...item });
                }}
                numColumns={layout === "list" ? 1 : isLandscape ? 3 : 2}
                extraData={[layout]}
                keyExtractor={(item) => item.name}
                contentContainerStyle={
                    layout === "list"
                        ? commonStyles.noHorizontalPadding
                        : cardStyles.cardContentContainer
                }
                columnWrapperStyle={
                    layout !== "list" && previewColumns > 1
                        ? cardStyles.row
                        : undefined
                }
            />
        </View>
    );
}

export default ChapterScreen;
