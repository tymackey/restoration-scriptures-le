import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
} from "react-native";
import { FAB } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useShallow } from "zustand/react/shallow";
import { useScreensStore, ReaderScreen } from "../data/useScreensStore";
import { useDatabase } from "../data/useDatabase";
import { stripScriptureMarkers } from "../util/scriptureMarkers";
import { colors } from "../constants/colors";

const CLOSE_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

const VOLUME_LABELS: { [key: string]: string } = {
    cc: "Covenant of Christ",
    oc: "Old Covenants",
    nt: "New Covenants (New Testament)",
    bofm: "New Covenants (Book of Mormon)",
    tc: "Teachings & Commandments",
    gl: "A Glossary of Gospel Terms",
};

// Best-effort plain-text preview of a chapter starting at the last-read
// paragraph. Chapter HTML tags paragraphs with `id="<position>"`, so we slice
// from one paragraph before the stored position (a line of lead-in context).
export function extractSnippet(html: string, position: number): string {
    if (!html) return "";
    let startIdx = 0;
    if (position && position > 0) {
        const lead = position > 1 ? position - 1 : position;
        const idx = html.search(new RegExp(`id=["']${lead}["']`));
        if (idx >= 0) {
            // Back up to the start of the enclosing tag so the opening tag is
            // stripped rather than leaking its `id="N">` remnant into the text.
            const tagStart = html.lastIndexOf("<", idx);
            startIdx = tagStart >= 0 ? tagStart : idx;
        }
    }
    const withoutTags = html
        .slice(startIdx)
        // Block-level tag boundaries become spaces so adjacent paragraphs/verses
        // don't run together...
        .replace(
            /<\/?(?:p|li|div|br|section|tr|ul|ol|h[1-6]|blockquote)\b[^>]*>/gi,
            " ",
        )
        // ...while inline tags (span, sup, b, i, a, …) are removed with NO space,
        // so drop-cap / small-caps letters wrapped in their own span stay joined
        // to the rest of the word (e.g. "<span>J</span>oseph" → "Joseph", not
        // "J oseph").
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&[a-z0-9#]+;/gi, " ");
    // Strip inline text-metadata markers (chapter/verse labels, pronoun markers)
    // using the shared scripture-marker vocabulary — the same source of truth
    // HtmlProcessor uses when styling them for the reader.
    return stripScriptureMarkers(withoutTags)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 240);
}

// Cache of computed snippets keyed by chapter + last-read position. FlatList
// virtualization unmounts/remounts cards as the grid scrolls, and each remount
// would otherwise re-read the full chapter HTML from SQLite just to slice a
// short preview. Keying on position keeps previews in sync when a screen's
// reading position advances.
const snippetCache = new Map<string, string>();
const snippetKey = (chapterId: string, position: number) =>
    `${chapterId}:${position}`;

function ScreenCard({
    screen,
    isActive,
    onOpen,
    onClose,
}: {
    screen: ReaderScreen;
    isActive: boolean;
    onOpen: () => void;
    onClose: () => void;
}) {
    const { getChapterText } = useDatabase();
    const [snippet, setSnippet] = useState(
        () =>
            snippetCache.get(snippetKey(screen.chapter_id, screen.position)) ??
            "",
    );

    useEffect(() => {
        const key = snippetKey(screen.chapter_id, screen.position);
        const cached = snippetCache.get(key);
        if (cached !== undefined) {
            setSnippet(cached);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const html = await getChapterText(screen.chapter_id);
                const text = extractSnippet(html, screen.position);
                snippetCache.set(key, text);
                if (!cancelled) setSnippet(text);
            } catch (e) {
                console.log("Screen preview load error:", e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [getChapterText, screen.chapter_id, screen.position]);

    return (
        <TouchableOpacity
            style={[styles.card, isActive && styles.cardActive]}
            onPress={onOpen}
            activeOpacity={0.8}
        >
            <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                        {screen.name}
                    </Text>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                        {VOLUME_LABELS[screen.volume_id] ?? screen.volume_id}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={onClose}
                    hitSlop={CLOSE_HIT_SLOP}
                    style={styles.closeButton}
                >
                    <MaterialCommunityIcons
                        name="close"
                        size={20}
                        color={colors.offWhite}
                    />
                </TouchableOpacity>
            </View>
            <Text style={styles.cardSnippet} numberOfLines={7}>
                {snippet}
            </Text>
        </TouchableOpacity>
    );
}

function ScreensScreen({ navigation }: { navigation: any }) {
    const screens = useScreensStore(useShallow((s) => s.screens));
    const activeScreenId = useScreensStore((s) => s.activeScreenId);
    const setActiveScreen = useScreensStore((s) => s.setActiveScreen);
    const closeScreen = useScreensStore((s) => s.closeScreen);
    const setPendingNewScreen = useScreensStore((s) => s.setPendingNewScreen);

    const openScreen = (id: string) => {
        setActiveScreen(id);
        navigation.navigate("Reader");
    };

    const addScreen = () => {
        setPendingNewScreen(true);
        navigation.navigate("Home");
    };

    return (
        <View style={styles.container}>
            {screens.length === 0 ? (
                <View style={styles.emptyWrap}>
                    <MaterialCommunityIcons
                        name="book-open-page-variant-outline"
                        size={48}
                        color={colors.mutedText}
                    />
                    <Text style={styles.emptyText}>No open screens</Text>
                    <Text style={styles.emptyHint}>
                        Tap + to open a chapter.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={screens}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <ScreenCard
                            screen={item}
                            isActive={item.id === activeScreenId}
                            onOpen={() => openScreen(item.id)}
                            onClose={() => closeScreen(item.id)}
                        />
                    )}
                />
            )}
            <FAB icon="plus" style={styles.fab} onPress={addScreen} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    listContent: {
        padding: 10,
    },
    row: {
        justifyContent: "space-between",
    },
    card: {
        width: "48.5%",
        minHeight: 190,
        backgroundColor: colors.surfaceDark,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: colors.borderDark,
        padding: 10,
        marginBottom: 12,
    },
    cardActive: {
        borderColor: colors.converterButtonBlue,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 6,
    },
    cardTitleWrap: {
        flex: 1,
        marginRight: 6,
    },
    cardTitle: {
        color: colors.offWhite,
        fontSize: 15,
        fontWeight: "bold",
    },
    cardSubtitle: {
        color: colors.mutedText,
        fontSize: 12,
        marginTop: 2,
    },
    closeButton: {
        padding: 2,
    },
    cardSnippet: {
        color: colors.lightGray,
        fontSize: 12,
        lineHeight: 18,
    },
    fab: {
        position: "absolute",
        right: 20,
        bottom: 24,
        backgroundColor: colors.converterButtonBlue,
    },
    emptyWrap: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyText: {
        color: colors.offWhite,
        fontSize: 18,
        marginTop: 12,
    },
    emptyHint: {
        color: colors.mutedText,
        fontSize: 14,
        marginTop: 4,
    },
});

export default ScreensScreen;
