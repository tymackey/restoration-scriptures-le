import { FlatList, StyleSheet, useWindowDimensions } from "react-native";
import { useSettingsStore } from "../data/useSettingsStore";
import ScriptureListItem from "./ScriptureListItem";
import ScriptureCardItem from "./ScriptureCardItem";
import { Chapter, SectionGroup } from "../data/types";
import { cardStyles } from "../styles/cardStyles";
import { TabActions, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useCardLayout } from "../util/cardLayoutUtils";

// Define the actual data structure returned by getTcBooks
type TcBookItem = {
    book_id: string;
    volume_id: string;
    name: string;
    num_chapters: number;
    book_order?: number;
    book_chapter?: number;
    chapter_id: string;
    preview?: string;
};

export default function SectionGroupList({
    sections,
    onGroupPress,
    landscape,
    navigate,
}: {
    sections: TcBookItem[];
    onGroupPress: (group: SectionGroup) => void;
    landscape: boolean;
    navigate: (item: Chapter) => void;
}) {
    const navigation = useNavigation<StackNavigationProp<any>>();
    const layout = useSettingsStore((state) => state.layout);
    const { numColumns, cardWidth } = useCardLayout({ isLandscape: landscape });

    // Filter sections and group them
    const sectionItems = sections.filter((section) =>
        section.name.includes("Section"),
    );
    const maxSection = sectionItems.reduce((max, section) => {
        const n = parseInt(section.name.split(" ")[1]);
        return isNaN(n) ? max : Math.max(max, n);
    }, 0);

    const groupedSections = sectionItems.reduce(
        (acc: SectionGroup[], section) => {
            const sectionNum = parseInt(section.name.split(" ")[1]);
            if (!isNaN(sectionNum)) {
                const groupIndex = Math.floor((sectionNum - 1) / 10);
                if (!acc[groupIndex]) {
                    acc[groupIndex] = {
                        start: groupIndex * 10 + 1,
                        end: Math.min((groupIndex + 1) * 10, maxSection),
                        sections: [],
                    };
                }
                // Convert TcBookItem to Chapter for grouping
                const chapterItem: Chapter = {
                    volume_id: section.volume_id,
                    book_id: section.book_id,
                    chapter_id: section.chapter_id,
                    name: section.name,
                    book_chapter: section.book_chapter || 0,
                    position: 0, // Default value
                    preview: section.preview,
                };
                acc[groupIndex].sections.push(chapterItem);
            }
            return acc;
        },
        [],
    );

    // Convert to array and sort by start number
    const sortedGroups = Object.values(groupedSections).sort(
        (a, b) => a.start - b.start,
    );

    // Filter forematter and appendix items and convert to Chapter type
    const forematterItems = sections
        .filter((section) =>
            [
                "Foreword",
                "Introduction",
                "Canonization",
                "Epigraph",
                "Preface",
            ].includes(section.name),
        )
        .map(
            (section): Chapter => ({
                volume_id: section.volume_id,
                book_id: section.book_id,
                chapter_id: section.chapter_id,
                name: section.name,
                book_chapter: section.book_chapter || 0,
                position: 0,
                preview: section.preview,
            }),
        );

    // Canonical reading order for the appendix. The getTcBooks query orders
    // appendix rows by their text book_chapter, which sorts alphabetically and
    // does not match the chapter_id / tcOrder navigation order. Sort explicitly
    // here so the list matches next/previous chapter navigation.
    const appendixOrder = [
        "Section Endnotes",
        "Excluded Revelations",
        "A Prophet's Prerogative",
        "A Glossary of Terms",
        "Correlation Tables",
        "Timeline Of The Fathers",
        "Maps",
    ];

    const appendixItems = sections
        .filter((section) => appendixOrder.includes(section.name))
        .sort(
            (a, b) =>
                appendixOrder.indexOf(a.name) - appendixOrder.indexOf(b.name),
        )
        .map(
            (section): Chapter => ({
                volume_id: section.volume_id,
                book_id: section.book_id,
                chapter_id: section.chapter_id,
                name: section.name,
                book_chapter: section.book_chapter || 0,
                position: 0,
                preview: section.preview,
            }),
        );

    // Combine all items in the desired order
    const allItems = [...forematterItems, ...sortedGroups, ...appendixItems];

    const goTo = (index: number) => {
        if (index === 1) {
            navigation.dispatch(TabActions.jumpTo("Glossary"));
        } else {
            navigation.dispatch(TabActions.jumpTo("Sections"));
        }
    };

    return (
        <FlatList
            key={`${layout}-${numColumns}`}
            data={allItems}
            renderItem={({ item }) => {
                // If it's a group item
                if ("sections" in item) {
                    const groupItem = {
                        id: `section-${item.start}-${item.end}`,
                        name: `Section ${item.start} - ${item.end}`,
                        book_id: "section-group",
                        sections: item.sections,
                    };

                    if (layout === "list") {
                        return (
                            <ScriptureListItem
                                item={groupItem}
                                action={() => onGroupPress(item)}
                            />
                        );
                    }

                    return (
                        <ScriptureCardItem
                            item={groupItem}
                            action={() => onGroupPress(item)}
                            cardWidth={cardWidth}
                        />
                    );
                }

                // If it's a forematter or appendix item
                const action =
                    item.name === "A Glossary of Terms"
                        ? () => goTo(1)
                        : navigate;

                if (layout === "list") {
                    return <ScriptureListItem item={item} action={action} />;
                }

                return (
                    <ScriptureCardItem
                        item={item}
                        action={action}
                        cardWidth={cardWidth}
                    />
                );
            }}
            numColumns={layout === "list" ? 1 : numColumns}
            extraData={layout}
            keyExtractor={(item) =>
                "sections" in item
                    ? `section-${item.start}-${item.end}`
                    : item.chapter_id
            }
            contentContainerStyle={
                layout === "list"
                    ? styles.contentContainer
                    : cardStyles.cardContentContainer
            }
            columnWrapperStyle={
                layout !== "list" && numColumns > 1 ? cardStyles.row : undefined
            }
            onRefresh={() => undefined}
            refreshing={false}
        />
    );
}

const styles = StyleSheet.create({
    contentContainer: {
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
});
