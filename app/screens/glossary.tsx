import { useNavigation } from "@react-navigation/native";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { useDatabase } from "../data/useDatabase";
import { useState, useEffect, useMemo } from "react";
import { Chapter } from "../data/types";
import { View, ActivityIndicator, StyleSheet, FlatList } from "react-native";
import { useSettingsStore } from "../data/useSettingsStore";
import ScriptureCardItem from "../components/ScriptureCardItem";
import ScriptureListItem from "../components/ScriptureListItem";
import GlossaryButtons from "../components/GlossaryButtons";
import { colors } from "../constants/colors";
import { cardStyles } from "../styles/cardStyles";
import { useCardLayout, CardLayoutConfig } from "../util/cardLayoutUtils";
import { useShallow } from "zustand/react/shallow";
import { commonStyles } from "../styles/commonStyles";

export default function GlossaryScreen() {
    const { getChapters } = useDatabase();
    const [glossaryTerms, setGlossaryTerms] = useState<Chapter[]>([]);
    const [loading, setLoading] = useState(true);
    const [glossaryListRef, setGlossaryListRef] =
        useState<FlatList<Chapter> | null>(null);
    const layout = useSettingsStore((state) => state.layout);
    const navigation = useNavigation<DrawerNavigationProp<any>>();
    const isLandscape = useSettingsStore(
        useShallow((state) => state.isLandscape),
    );

    useEffect(() => {
        const fetchTerms = async () => {
            try {
                const terms = await getChapters("glossary", "gl");
                const [glossaryIntro] = await getChapters(
                    "glintroduction",
                    "gl",
                );
                if (glossaryIntro) {
                    terms.unshift(glossaryIntro);
                }
                setGlossaryTerms(terms);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchTerms();
    }, [getChapters]);

    const cardLayoutConfig = useMemo<CardLayoutConfig>(
        () => ({
            isLandscape: isLandscape,
        }),
        [isLandscape],
    );

    const { numColumns: calculatedNumColumns, cardWidth } =
        useCardLayout(cardLayoutConfig);
    const numColumns = layout === "list" ? 1 : calculatedNumColumns;

    const scrollToLetter = (letter: string) => {
        if (!glossaryListRef) return;

        const itemIndex = glossaryTerms.findIndex(
            (term) =>
                term.name.toUpperCase().startsWith(letter) &&
                term.name !== "Introduction",
        );

        if (itemIndex !== -1) {
            let scrollOffset: number;

            if (layout === "list") {
                const itemHeight = 48;
                scrollOffset = itemHeight * itemIndex;
            } else {
                const rowIndex = Math.floor(itemIndex / numColumns);
                const cardHeight = cardWidth / 1.2;
                const rowHeight = cardHeight + 8;
                scrollOffset = rowHeight * rowIndex;
            }

            scrollOffset = Math.max(0, scrollOffset);

            glossaryListRef.scrollToOffset({
                offset: scrollOffset,
                animated: true,
            });
        }
    };

    const navigate = async (item: Chapter) => {
        navigation.navigate("Reader", {
            book_chapter: item.book_chapter,
            book_id: item.book_id,
            chapter_id: item.chapter_id,
            name: item.name,
            volume_id: "gl",
        });
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="blue" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <GlossaryButtons
                glossaryTerms={glossaryTerms}
                scrollToLetter={(letter) => scrollToLetter(letter)}
            />
            <FlatList
                key={`${layout}-${numColumns}`}
                ref={setGlossaryListRef}
                data={glossaryTerms}
                renderItem={(glossaryData) => {
                    if (layout === "list") {
                        return (
                            <ScriptureListItem
                                item={glossaryData.item}
                                action={navigate}
                            />
                        );
                    }
                    return (
                        <ScriptureCardItem
                            item={glossaryData.item}
                            action={navigate}
                            cardWidth={cardWidth}
                            landscape={isLandscape}
                        />
                    );
                }}
                numColumns={numColumns}
                extraData={layout}
                keyExtractor={(item) => String(item.chapter_id)}
                contentContainerStyle={
                    layout === "list"
                        ? commonStyles.noHorizontalPadding
                        : cardStyles.cardContentContainer
                }
                columnWrapperStyle={
                    layout !== "list" && numColumns > 1
                        ? cardStyles.row
                        : undefined
                }
                getItemLayout={(data, index) => {
                    if (layout === "list") {
                        const itemHeight = 48;
                        return {
                            length: itemHeight,
                            offset: itemHeight * index,
                            index,
                        };
                    } else {
                        const cardHeight = cardWidth / 1.2;
                        const rowHeight = cardHeight + 8;
                        return {
                            length: rowHeight,
                            offset: rowHeight * index,
                            index,
                        };
                    }
                }}
                onScrollToIndexFailed={(info) => {
                    console.warn("Scroll to index failed:", info);
                    if (glossaryListRef) {
                        let maxIndex: number;
                        if (layout === "list") {
                            maxIndex = glossaryTerms.length - 1;
                        } else {
                            maxIndex =
                                Math.ceil(glossaryTerms.length / numColumns) -
                                1;
                        }
                        const targetIndex = Math.min(info.index, maxIndex);

                        let scrollOffset: number;
                        if (layout === "list") {
                            const itemHeight = 48;
                            scrollOffset = itemHeight * targetIndex;
                        } else {
                            const cardHeight = cardWidth / 1.2;
                            const rowHeight = cardHeight + 8;
                            scrollOffset = rowHeight * targetIndex;
                        }

                        scrollOffset = Math.max(0, scrollOffset);

                        setTimeout(() => {
                            glossaryListRef.scrollToOffset({
                                offset: scrollOffset,
                                animated: true,
                            });
                        }, 100);
                    }
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
});
