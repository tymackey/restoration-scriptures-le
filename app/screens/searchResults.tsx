import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ScrollView,
    TouchableOpacity,
    FlatList,
} from "react-native";
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
    Modal,
    Portal,
    SegmentedButtons,
    IconButton,
    List,
    Icon,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
// import { useSettingsStore } from '../data/useSettingsStore';
import { useDatabase } from "../data/useDatabase";
import { Volume, Book } from "../data/types";
import { colors } from "../constants/colors";
import { commonStyles } from "../styles/commonStyles";

function SearchResultsScreen({
    route,
    navigation,
}: {
    route: any;
    navigation: any;
}) {
    const { searchKeywords, getVolumes, getBooks } = useDatabase();
    const searchTerm = route.params.searchTerm;

    const [allSearchResults, setAllSearchResults] = useState<any[]>([]);
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    const [filterVolume, setFilterVolume] = useState<string | undefined>(
        undefined,
    );
    const [filterBook, setFilterBook] = useState<string | undefined>(undefined);
    const [orderValue, setOrderValue] = useState(true);

    // Pagination state
    const resultsPerPage = 25;
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Calculate pagination info
    const totalPages = Math.ceil(allSearchResults.length / resultsPerPage);

    // Get paginated results
    const paginatedResults = useMemo(() => {
        const startIndex = (currentPage - 1) * resultsPerPage;
        return allSearchResults.slice(startIndex, startIndex + resultsPerPage);
    }, [allSearchResults, currentPage, resultsPerPage]);

    // FlatList ref
    const listRef = useRef<FlatList<any>>(null);

    // Navigation functions
    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const goToPreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const goToFirstPage = () => {
        setCurrentPage(1);
    };

    const goToLastPage = () => {
        setCurrentPage(totalPages);
    };

    // Scroll to top of list
    const scrollToTop = () => {
        // Add a small delay to ensure state updates first
        setTimeout(() => {
            if (listRef.current) {
                listRef.current.scrollToOffset({ offset: 0, animated: false });
            }
        }, 100);
    };

    const [volumes, setVolumes] = useState<Volume[]>([]);
    const [volumeBooks, setVolumeBooks] = useState<Book[]>([]);

    const showModal = () => setFilterModalVisible(true);
    const hideModal = () => setFilterModalVisible(false);
    const updateFilterVolume = (volumeId: string | undefined) => {
        setFilterBook(undefined);
        setFilterVolume(volumeId);
        goToFirstPage(); // Reset to first page when filter changes
    };
    const updateFilterBook = (bookId: string | undefined) => {
        if (bookId !== undefined) {
            setFilterModalVisible(false);
        }
        setFilterBook(bookId);
        goToFirstPage(); // Reset to first page when filter changes
    };

    const containerStyle = {
        marginHorizontal: 20,
        padding: 20,
        backgroundColor: colors.inputBackground,
        color: colors.white,
        elevation: 5,
        // maxHeight: '80%'
    };

    useEffect(() => {
        const getVolumesData = async () => {
            const volumes = await getVolumes();
            setVolumes(volumes);
        };

        getVolumesData().catch(console.error);
    }, []);

    useEffect(() => {
        const getVolumeBookData = async () => {
            if (filterVolume) {
                const books = await getBooks(filterVolume);
                setVolumeBooks(books);
            }
        };

        getVolumeBookData().catch(console.error);

        // const unsubscribe = navigation.addListener('state', (event: any) => {
        //     const history = event.data.state.history;
        //     if (history[history.length -1].key?.startsWith("Search-")) {
        //         setFilterBook(undefined);
        //         setFilterVolume(undefined);
        //         goToFirstPage(); // Reset page when returning to search
        //     }
        // });

        // return () => unsubscribe();
    }, [filterVolume, navigation]);

    useEffect(() => {
        const getSearchResults = async (
            searchTerm: string,
            orderValue: boolean,
            filterVolume: string | undefined,
            filterBook: string | undefined,
        ) => {
            try {
                setIsLoading(true);

                // Check if this is an exact phrase search (wrapped in quotes)
                const exactPhraseMatch = searchTerm.match(
                    /^[""\u201C\u201D](.+)[""\u201C\u201D]$/,
                );

                let normalizedSearchTerm: string;
                if (exactPhraseMatch) {
                    // For exact phrase search, preserve the phrase and wrap with quotes for FTS5
                    const phrase = exactPhraseMatch[1]
                        .replace(/['\u2018\u2019]/g, "") // Remove apostrophes
                        .replace(/[^\w\s]/g, " ") // Replace other punctuation with spaces
                        .replace(/\s+/g, " ") // Normalize whitespace
                        .trim();
                    normalizedSearchTerm = `"${phrase}"`;
                } else {
                    normalizedSearchTerm = searchTerm
                        .replace(/['\u2018\u2019]/g, "") // Remove apostrophes
                        .replace(/[^\w\s]/g, " ") // Replace other punctuation with spaces
                        .replace(/\s+/g, " ") // Normalize whitespace
                        .trim();
                }

                let searchResults = await searchKeywords(
                    normalizedSearchTerm,
                    orderValue,
                    filterVolume,
                    filterBook,
                );

                // For exact phrase searches, post-filter using word boundary regex on full paragraph text.
                // FTS5's Porter tokenizer stems words, so "content" matches "contention" at the FTS level.
                // We verify against the full paragraph text to eliminate those false positives.
                if (exactPhraseMatch) {
                    const phrase = exactPhraseMatch[1]
                        .replace(/['\u2018\u2019]/g, "")
                        .replace(/[^\w\s]/g, " ")
                        .replace(/\s+/g, " ")
                        .trim();
                    const phraseRegex = new RegExp(
                        `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                        "i",
                    );
                    searchResults = searchResults.filter((result) =>
                        phraseRegex.test(result.fullText),
                    );
                }

                // Deduplicate appendix and glossary results — show one result per chapter
                const seenChapters = new Set<string>();
                searchResults = searchResults.filter((result) => {
                    if (
                        result.book_id === "tcappendix" ||
                        result.book_id === "glossary"
                    ) {
                        if (seenChapters.has(result.chapter_id)) return false;
                        seenChapters.add(result.chapter_id);
                    }
                    return true;
                });

                setAllSearchResults(searchResults);
                setCurrentPage(1);
                setIsLoading(false);
            } catch (e) {
                console.error(e);
                setIsLoading(false);
            }
        };

        getSearchResults(searchTerm, orderValue, filterVolume, filterBook);
    }, [searchTerm, orderValue, filterVolume, filterBook, searchKeywords]);

    // Handle scrolling when page changes
    useEffect(() => {
        scrollToTop();
    }, [currentPage]);

    const FilterModal = ({ results }: { results: any[] }) => {
        const counts = results.reduce((acc: any, cur: any) => {
            const keys = Object.keys(acc);
            if (keys.find((el) => el === cur.volume)) {
                acc[cur.volume] += 1;
            } else {
                acc[cur.volume] = 1;
            }

            if (keys.find((el) => el === cur.book)) {
                acc[cur.book] += 1;
            } else {
                acc[cur.book] = 1;
            }

            return acc;
        }, {});

        const DismissFilterVolume = () => {
            const vol = volumes.find(
                (v) => v.volume_id === filterVolume,
            ) as Volume;
            return (
                <>
                    <Pressable onPress={() => setFilterModalVisible(false)}>
                        <MaterialCommunityIcons
                            name="close"
                            style={[styles.icon, styles.closeIcon]}
                            size={24}
                        />
                    </Pressable>
                    <Pressable
                        key={vol?.name}
                        style={styles.filterModal}
                        onPress={() => {
                            updateFilterVolume(undefined);
                        }}
                    >
                        <MaterialCommunityIcons
                            name="close"
                            style={styles.icon}
                            size={24}
                        />
                        <Text style={styles.filterLabel}>
                            {vol?.reference_name ?? vol?.name}{" "}
                            {counts?.[vol?.name]
                                ? `(${counts[vol?.name]})`
                                : ""}
                        </Text>
                    </Pressable>
                    <ScrollView style={styles.filterScroll}>
                        {filterBook ? (
                            <DismissFilterBook></DismissFilterBook>
                        ) : (
                            <>
                                {volumeBooks.map((b) => {
                                    if (counts?.[b.name]) {
                                        return (
                                            <Pressable
                                                key={b.name}
                                                style={styles.filterModal}
                                                onPress={() => {
                                                    updateFilterBook(b.id);
                                                }}
                                            >
                                                {b.id === filterBook && (
                                                    <MaterialCommunityIcons
                                                        name="close"
                                                        style={styles.icon}
                                                        size={24}
                                                        onPress={() => {
                                                            updateFilterBook(
                                                                undefined,
                                                            );
                                                        }}
                                                    />
                                                )}
                                                <Text
                                                    style={[
                                                        styles.filterLabel,
                                                        styles.filterBookLabel,
                                                    ]}
                                                >
                                                    {b.name}{" "}
                                                    {counts?.[b.name]
                                                        ? `(${counts[b.name]})`
                                                        : ""}
                                                </Text>
                                            </Pressable>
                                        );
                                    }
                                })}
                            </>
                        )}
                    </ScrollView>
                </>
            );
        };

        const DismissFilterBook = () => {
            const b = volumeBooks.find((b) => b.id === filterBook) as Book;
            return (
                <Pressable
                    key={b.name}
                    style={styles.filterModal}
                    onPress={() => {
                        updateFilterBook(undefined);
                    }}
                >
                    {b.id === filterBook && (
                        <MaterialCommunityIcons
                            name="close"
                            style={styles.icon}
                            size={24}
                            onPress={() => {
                                updateFilterBook(undefined);
                            }}
                        />
                    )}
                    <Text style={[styles.filterLabel, styles.filterBookLabel]}>
                        {b.name} {counts?.[b.name] ? `(${counts[b.name]})` : ""}
                    </Text>
                </Pressable>
            );
        };

        return (
            <Portal>
                <Modal
                    visible={filterModalVisible}
                    onDismiss={hideModal}
                    contentContainerStyle={containerStyle}
                >
                    <View style={commonStyles.displayFlex}>
                        {filterVolume ? (
                            <DismissFilterVolume></DismissFilterVolume>
                        ) : (
                            <>
                                {volumes.map((v) => {
                                    if (counts?.[v.name]) {
                                        return (
                                            <Pressable
                                                key={v.name}
                                                style={styles.filterModal}
                                                onPress={() => {
                                                    updateFilterVolume(
                                                        v.volume_id,
                                                    );
                                                }}
                                            >
                                                {v.volume_id ===
                                                    filterVolume && (
                                                    <MaterialCommunityIcons
                                                        name="close"
                                                        style={styles.icon}
                                                        size={24}
                                                        onPress={() => {
                                                            updateFilterVolume(
                                                                undefined,
                                                            );
                                                        }}
                                                    />
                                                )}
                                                <Text
                                                    style={
                                                        styles.filterVolumeText
                                                    }
                                                >
                                                    {v.reference_name ?? v.name}{" "}
                                                    {counts?.[v.name]
                                                        ? `(${counts[v.name]})`
                                                        : ""}
                                                </Text>
                                            </Pressable>
                                        );
                                    } else {
                                        return (
                                            <Text
                                                key={v.name}
                                                style={styles.filterEmptyText}
                                            >
                                                {v.reference_name ?? v.name}
                                            </Text>
                                        );
                                    }
                                })}
                            </>
                        )}
                        <View style={styles.modalButtonContainer}>
                            <Pressable
                                style={[styles.modalButton, styles.doneButton]}
                                onPress={() => {
                                    setFilterModalVisible(false);
                                }}
                            >
                                <Text style={styles.buttonText}>Done</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            </Portal>
        );
    };

    const navigateToReference = async (item: any) => {
        navigation.navigate("Reader", {
            book_chapter: item.chapter,
            book_id: item.book,
            chapter_id: item.chapter_id,
            name: item.name,
            volume_id: item.volume_id,
            position:
                item.paratext ||
                item.book_id === "tcappendix" ||
                item.book_id === "glossary"
                    ? 0
                    : item.position,
            searchTerm: route.params.searchTerm,
        });
    };

    const searchResultItem = (item: any) => {
        const styles = StyleSheet.create({
            ResultContainer: {
                paddingHorizontal: 0,
                paddingVertical: 4,
                backgroundColor: colors.background,
            },
            ResultLink: {
                color: colors.converterLinkBlue,
                fontSize: 22,
            },
            ResultText: {
                color: colors.white,
                fontSize: 18,
            },
            boldText: {
                backgroundColor: colors.highlight,
            },
        });

        const boldSearchTerm = (text: string, searchTerm: string) => {
            // Check if the search term contains double quotes (exact phrase search)
            const hasQuotes = /["\u201C\u201D"]/.test(searchTerm);
            const strippedSearchTerm = searchTerm.replace(
                /["\u201C\u201D"]/g,
                "",
            );
            const allWords = strippedSearchTerm
                .trim()
                .split(/\s+/)
                .filter((w) => w.length > 0);

            type Range = { start: number; end: number };
            const ranges: Range[] = [];

            const addMatches = (pattern: RegExp) => {
                let m: RegExpExecArray | null;
                while ((m = pattern.exec(text)) !== null) {
                    ranges.push({ start: m.index, end: m.index + m[0].length });
                }
            };

            if (hasQuotes) {
                // Exact phrase search — match the whole quoted phrase
                const escaped = strippedSearchTerm.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&",
                );
                addMatches(new RegExp(`\\b${escaped}\\b`, "gi"));
            } else {
                // If multiple words, try the full phrase first so single-letter words
                // within it (e.g. "a" in "offender for a word") get highlighted as part
                // of the whole match rather than being skipped individually.
                if (allWords.length > 1) {
                    const escapedPhrase = allWords
                        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                        .join("\\s+");
                    addMatches(new RegExp(`\\b${escapedPhrase}\\b`, "gi"));
                }
                // Individual word matches — skip single-letter words
                for (const word of allWords.filter((w) => w.length > 1)) {
                    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    addMatches(new RegExp(escaped, "gi"));
                }
            }

            if (ranges.length === 0) {
                return <Text style={styles.ResultText}>{text}</Text>;
            }

            // Sort by start position, prefer longer matches on ties; remove overlaps
            ranges.sort(
                (a, b) =>
                    a.start - b.start || b.end - b.start - (a.end - a.start),
            );
            const parts: React.ReactNode[] = [];
            let cursor = 0;
            for (const range of ranges) {
                if (range.start < cursor) continue;
                if (range.start > cursor)
                    parts.push(text.slice(cursor, range.start));
                parts.push(
                    <Text key={range.start} style={styles.boldText}>
                        {text.slice(range.start, range.end)}
                    </Text>,
                );
                cursor = range.end;
            }
            if (cursor < text.length) parts.push(text.slice(cursor));

            return <Text style={styles.ResultText}>{parts}</Text>;
        };

        return (
            <List.Item
                containerStyle={styles.ResultContainer}
                style={styles.ResultContainer}
                title={() => {
                    return (
                        <Pressable onPress={() => navigateToReference(item)}>
                            <Text style={styles.ResultLink}>
                                {item.chapter === "0"
                                    ? `(${item.volume}) ${item.name}`
                                    : item.book_id === "tcappendix" ||
                                        item.book_id === "glossary"
                                      ? `(${item.volume}) ${item.book}: ${item.name}`
                                      : `(${item.volume}) ${item.book} ${item.chapter}${!item.paratext ? `:${item.position}` : ""}`}
                            </Text>
                        </Pressable>
                    );
                }}
                titleStyle={styles.ResultLink}
                onPress={() => navigateToReference(item)}
                description={() => (
                    <View>
                        {boldSearchTerm(
                            item.text
                                .replace(/LEChapter\d* /, "")
                                .replace(/Verse((End|\d*)\s*)/g, "")
                                .replace(/(2PSI|2PSF|2PP|2PG) ?/g, ""),
                            route.params.searchTerm,
                        )}
                    </View>
                )}
            />
        );
    };

    const OrderToggleButton = () => (
        <View style={styles.toggleButtonView}>
            <SegmentedButtons
                value={orderValue ? "true" : "false"}
                onValueChange={(value) => setOrderValue(value === "true")}
                buttons={[
                    {
                        value: "true",
                        label: "Relevance",
                        checkedColor: colors.white,
                        uncheckedColor: colors.white,
                        style: {
                            backgroundColor: orderValue
                                ? "#4A90E2"
                                : "transparent",
                            flex: 1,
                            minWidth: 0,
                            padding: 0,
                            margin: 0,
                        },
                        labelStyle: {
                            flexShrink: 1,
                            includeFontPadding: false,
                            textAlignVertical: "center",
                        },
                    },
                    {
                        value: "false",
                        label: "Text Order",
                        checkedColor: colors.white,
                        uncheckedColor: colors.white,
                        style: {
                            backgroundColor: !orderValue
                                ? "#4A90E2"
                                : "transparent",
                            flex: 1,
                            minWidth: 0,
                        },
                        labelStyle: {
                            includeFontPadding: false,
                            textAlignVertical: "center",
                        },
                    },
                ]}
                density="regular"
            />
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.controls}>
                <FilterModal results={allSearchResults} />
                <TouchableOpacity
                    aria-label="Filter results"
                    style={styles.filterButton}
                    onPress={showModal}
                >
                    <Text style={styles.filterButtonText}>
                        Filter&nbsp;Results
                    </Text>
                </TouchableOpacity>
                <OrderToggleButton />
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator
                        size="large"
                        color={colors.converterLinkBlue}
                    />
                </View>
            ) : (
                <>
                    <FlatList
                        ref={listRef}
                        data={paginatedResults}
                        renderItem={(result) => searchResultItem(result.item)}
                        numColumns={1}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>
                                    No results found
                                </Text>
                            </View>
                        }
                    />

                    {allSearchResults.length > resultsPerPage && (
                        <View style={styles.paginationContainer}>
                            <IconButton
                                icon="page-first"
                                size={24}
                                iconColor={colors.white}
                                disabled={currentPage === 1}
                                onPress={goToFirstPage}
                            />
                            <IconButton
                                icon="chevron-left"
                                size={24}
                                iconColor={colors.white}
                                disabled={currentPage === 1}
                                onPress={goToPreviousPage}
                            />
                            <Text style={styles.paginationText}>
                                {currentPage} of {totalPages}
                            </Text>
                            <IconButton
                                icon="chevron-right"
                                size={24}
                                iconColor={colors.white}
                                disabled={currentPage === totalPages}
                                onPress={goToNextPage}
                            />
                            <IconButton
                                icon="page-last"
                                size={24}
                                iconColor={colors.white}
                                disabled={currentPage === totalPages}
                                onPress={goToLastPage}
                            />
                        </View>
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    filterScroll: { marginLeft: 48, maxHeight: "70%" },
    filterVolumeText: { color: colors.converterLinkBlue, fontSize: 22 },
    filterEmptyText: { marginVertical: 20, color: colors.white, fontSize: 22 },
    container: {
        flex: 1,
        height: "100%",
        backgroundColor: colors.background,
    },
    controls: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: colors.background,
        paddingHorizontal: 10,
        flexWrap: "wrap",
        gap: 12,
    },
    filterButton: {
        backgroundColor: colors.converterButtonBlue,
        padding: 10,
        borderRadius: 4,
        alignItems: "center",
        flexShrink: 1,
        minWidth: 0,
    },
    filterButtonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: "500",
        flexShrink: 1,
        textAlign: "center",
        includeFontPadding: false,
        textAlignVertical: "center",
    },
    toggleButtonView: {
        display: "flex",
        flex: 1,
        minWidth: 200,
        marginVertical: 8,
    },
    filterModal: {
        marginVertical: 20,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
    },
    filterLabel: {
        color: colors.converterLinkBlue,
        fontSize: 22,
        fontWeight: "bold",
    },
    filterBookLabel: {
        fontSize: 18,
    },
    icon: {
        backgroundColor: colors.transparent,
        color: colors.danger,
        paddingTop: 2,
        paddingRight: 8,
        width: 32,
        fontSize: 24,
    },
    closeIcon: {
        color: colors.white,
        alignSelf: "flex-end",
        marginTop: -12,
        marginRight: -12,
        marginBottom: 12,
    },
    paginationContainer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.borderDark,
        paddingHorizontal: 0,
    },
    paginationText: {
        color: colors.white,
        fontSize: 16,
        marginHorizontal: 10,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    emptyText: {
        color: colors.white,
        fontSize: 18,
    },
    modalButtonContainer: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 20,
    },
    modalButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 5,
        marginLeft: 10,
    },
    doneButton: {
        backgroundColor: colors.converterLinkBlue,
    },
    buttonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: "bold",
        flexShrink: 1,
        includeFontPadding: false,
        textAlignVertical: "center",
    },
});

export default SearchResultsScreen;
