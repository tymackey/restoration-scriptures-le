import { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, Text, Pressable } from "react-native";
import { Chapter } from "../data/types";
import { colors } from "../constants/colors";
import { useSettingsStore } from "../data/useSettingsStore";
import { formatChapterListLabel } from "../util/chapterLabels";
import { buildTcSectionIndex } from "../util/tcSectionIndex";
import ScriptureListItem from "./ScriptureListItem";
import ScripturePreviewItem from "./ScripturePreviewItem";

type TcBookItem = {
    book_id: string;
    volume_id: string;
    name: string;
    book_chapter?: number;
    chapter_id: string;
    preview?: string;
};

export default function IndexedSectionList({ sections, navigate }: {
    sections: TcBookItem[];
    navigate: (item: Chapter) => void;
}) {
    const layout = useSettingsStore(state => state.layout);
    const landscape = useSettingsStore(state => state.isLandscape);
    const { items, shortcuts } = useMemo(() => buildTcSectionIndex(sections), [sections]);
    const scroll = useRef<ScrollView>(null);
    const offsets = useRef<Record<number, number>>({});
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [active, setActive] = useState("↑");
    const columns = landscape ? 3 : 2;
    const cardWidth = Math.max(1, (size.width - 44 - 16 - (columns - 1) * 8) / columns);
    const isList = layout === "list";

    return (
        <View style={styles.container} onLayout={({ nativeEvent: { layout } }) =>
            setSize({ width: layout.width, height: layout.height })}>
            {/* Render this bounded collection so every variable-height row has a
                measured offset, even before a distant index is first tapped. */}
            <ScrollView ref={scroll} style={styles.scroller} scrollEventThrottle={100}
                onScroll={({ nativeEvent }) => {
                    const y = nativeEvent.contentOffset.y + 4;
                    const current = [...shortcuts].reverse().find(shortcut =>
                        offsets.current[shortcut.index] !== undefined && offsets.current[shortcut.index] <= y);
                    if (current) setActive(current.label);
                }}>
                <View style={[styles.content, !isList && styles.cards]}>
                    {items.map((item, index) => {
                        const chapter: Chapter = { ...item, book_chapter: item.book_chapter ?? 0, position: 0 };
                        return (
                            <View key={`${item.book_id}:${item.chapter_id}`}
                                style={isList ? styles.listRow : { width: cardWidth }}
                                onLayout={({ nativeEvent }) => { offsets.current[index] = nativeEvent.layout.y; }}>
                                {isList ? (
                                    <ScriptureListItem item={chapter} title={formatChapterListLabel(chapter)} action={navigate} />
                                ) : (
                                    <ScripturePreviewItem item={chapter} title={formatChapterListLabel(chapter)}
                                        action={navigate} landscape={landscape} cardWidth={cardWidth} />
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
            <View style={[styles.index, { height: Math.max(0, Math.min(size.height - 16, shortcuts.length * 27)) }]}>
                {shortcuts.map(shortcut => (
                    <Pressable key={shortcut.label} accessibilityRole="button"
                        accessibilityLabel={shortcut.accessibilityLabel}
                        accessibilityState={{ selected: active === shortcut.label }}
                        style={({ pressed }) => [styles.indexButton, pressed && styles.pressed]}
                        onPress={() => {
                            const y = offsets.current[shortcut.index];
                            if (y !== undefined) {
                                scroll.current?.scrollTo({ y, animated: false });
                                setActive(shortcut.label);
                            }
                        }}>
                        <Text maxFontSizeMultiplier={1.2} style={[styles.indexText,
                            active === shortcut.label && styles.active]}>{shortcut.label}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.background },
    scroller: { flex: 1, alignSelf: "stretch" },
    content: { paddingVertical: 8 },
    cards: { paddingHorizontal: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
    listRow: { width: "100%" },
    index: { width: 44, marginVertical: 8, justifyContent: "center" },
    indexButton: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 6 },
    pressed: { backgroundColor: colors.surfaceDark },
    indexText: { color: colors.linkBlue, fontSize: 11, fontWeight: "600" },
    active: { color: colors.white, fontWeight: "800" },
});
