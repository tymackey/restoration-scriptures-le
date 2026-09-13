import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    FlatList,
    Alert,
} from "react-native";
import { useState, useRef, useEffect, useCallback } from "react";
import { Snackbar, IconButton } from "react-native-paper";
import { useDatabase } from "../data/useDatabase";
import { Chapter } from "../data/types";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import {
    addToSearchHistory,
    getSearchHistory,
    clearSearchHistory,
    initializeSearchHistory,
} from "../util/SearchHistoryStorage";
import { useFocusEffect } from "@react-navigation/native";
import { colors } from "../constants/colors";

function KeywordSearchScreen({
    navigation,
    route,
}: {
    navigation: any;
    route: any;
}) {
    const { getCanonicalBook, getChapterByReference } = useDatabase();
    const inputRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState(
        route?.params?.initialQuery ?? "",
    );
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const re =
        /^(?<edition>\(KJV|LDS\)*\s+)*(?<book>[\w\s\.\&\-]*)\s+(?<chapter>\d+)(?:\s*:\s*(?<paragraph>(?:\d+(?:\s*-\s*\d+)?)(?:\s*,\s*(?:\d+(?:\s*-\s*\d+)?))*))?$/;

    // Load saved search history on component mount
    useEffect(() => {
        const loadSearchHistory = async () => {
            // Initialize with defaults if no history exists
            await initializeSearchHistory();

            // Load the history (will include defaults if newly initialized)
            const history = await getSearchHistory();
            setRecentSearches(history);
        };

        loadSearchHistory();
    }, []);

    // Refresh search history when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            const refreshSearchHistory = async () => {
                const history = await getSearchHistory();
                setRecentSearches(history);
            };

            refreshSearchHistory();
        }, []),
    );

    const hasReference = async (searchTerm: string) => {
        const found = searchTerm.match(re);
        let edition, book, chapter, paragraph;
        if (found?.groups) {
            edition = found.groups.edition;
            book = found.groups.book;
            chapter = found.groups.chapter;
            paragraph = found.groups.paragraph;

            book = await getCanonicalBook(book.toLowerCase());

            return { edition, book, chapter, paragraph };
        }

        return false;
    };

    const navigateToReference = async (item: Chapter) => {
        navigation.navigate("Reader", {
            book_chapter: item.book_chapter,
            book_id: item.book_id,
            chapter_id: item.chapter_id,
            name: item.name,
            volume_id: item.volume_id,
            position: item.position,
        });
    };

    const handleSearch = async () => {
        if (!searchTerm.trim()) return;

        try {
            // Add to persistent search history
            await addToSearchHistory(searchTerm);

            // Update local state with new history
            const updatedHistory = await getSearchHistory();
            setRecentSearches(updatedHistory);

            try {
                const reference = await hasReference(searchTerm);
                if (reference) {
                    let chapterData = await getChapterByReference(
                        reference.book,
                        reference.chapter,
                    );
                    chapterData.position = reference.paragraph;
                    navigateToReference(chapterData);
                } else {
                    navigation.navigate("SearchResults", { searchTerm });
                }
            } catch (error) {
                console.error("Error handling search", error);
            }

            setSearchTerm("");
        } catch (error) {
            console.error("Search failed:", error);
        }
    };

    const clearAlert = () =>
        Alert.alert(
            "Clear Recent Searches",
            "Permanently delete all recent searches?",
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Remove",
                    onPress: async () => {
                        await clearSearchHistory();
                        const history = await getSearchHistory();
                        setRecentSearches(history);
                    },
                    style: "destructive",
                },
            ],
        );

    const renderSearchItem = ({ item }: { item: string }) => (
        <Pressable
            style={styles.recentSearchItem}
            onPress={() => {
                setSearchTerm(item);
                if (inputRef.current) {
                    (inputRef.current as TextInput).focus();
                }
            }}
        >
            <Text style={styles.recentSearchText}>{item}</Text>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <View style={styles.searchWrapper}>
                <View style={styles.searchRow}>
                    <Pressable
                        android_ripple={{ color: colors.lightGray }}
                        style={styles.searchContainer}
                    >
                        <FontAwesome
                            name="search"
                            size={24}
                            color="#5f6368"
                            style={styles.searchIcon}
                        />
                        <TextInput
                            ref={inputRef}
                            style={styles.searchInput}
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                            placeholder="Search..."
                            returnKeyType="search"
                            onSubmitEditing={handleSearch}
                            placeholderTextColor={colors.white}
                            selectionColor="#1a73e8"
                        />
                        {searchTerm.length > 0 && (
                            <IconButton
                                icon="close"
                                size={20}
                                iconColor={colors.white}
                                onPress={() => setSearchTerm("")}
                                style={styles.searchClearButton}
                            />
                        )}
                    </Pressable>
                    <TouchableOpacity onPress={() => setSnackbarVisible(true)}>
                        <MaterialCommunityIcons
                            name="help-circle-outline"
                            size={24}
                            color={colors.white}
                            style={styles.helpIcon}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={clearAlert}
                    accessible={true}
                    accessibilityLabel="Clear Recent Searches"
                    accessibilityRole="button"
                >
                    <Text
                        style={styles.clearButtonText}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                    >
                        Clear Recent Searches
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.recentSearchContainer}>
                <Text style={styles.recentSearchLabel}>Recent Searches:</Text>
                <FlatList
                    data={recentSearches}
                    renderItem={renderSearchItem}
                    keyExtractor={(item, index) => index.toString()}
                />
            </View>

            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={4000}
                style={styles.snackbar}
            >
                <Text style={styles.snackbarText}>
                    By reference: Ether 1:12{"\n"}
                    By keyword: Zebedee{"\n"}
                    Exact phrase: "I will go and do"{"\n"}
                    {/*
                        Excluding a word: laman -lemuel{'\n'}
                        By LDS reference: LDS Hel. 13{'\n'}
                        or: LDS 3 Ne 16:10-13,15{'\n'}
                        By trad. Bible ref.: KJV Matt. 24{'\n'}
                        or: KJV Rev. 12:1-6,12 */}
                </Text>
            </Snackbar>
        </View>
    );
}

const styles = StyleSheet.create({
    recentSearchContainer: { flex: 1, paddingHorizontal: 16 },
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    searchWrapper: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: colors.background,
    },
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    searchContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.background,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        elevation: 3,
        shadowColor: colors.black,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        minWidth: 0, // Ensures the container can shrink
    },
    searchIcon: {
        marginRight: 12,
        color: colors.white,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: colors.white,
        paddingVertical: 4,
        marginRight: 8,
        height: 44,
    },
    searchClearButton: {
        margin: 0,
    },
    helpIcon: {
        color: colors.white,
        padding: 4,
    },
    recentSearchItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    recentSearchLabel: {
        color: colors.white,
        fontSize: 22,
    },
    recentSearchText: {
        marginLeft: 10,
        fontSize: 18,
        color: colors.white,
    },
    snackbar: {
        position: "absolute",
        alignSelf: "center",
        margin: 16,
        bottom: 16,
        backgroundColor: colors.inputBackground,
        elevation: 5,
        width: 270,
        height: 90,
    },
    snackbarText: {
        color: colors.white,
    },
    buttonContainer: {
        paddingVertical: 18,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },
    clearButton: {
        backgroundColor: colors.converterButtonBlue,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 4,
        minWidth: 180,
        maxWidth: "95%",
        alignItems: "center",
        justifyContent: "center",
    },
    clearButtonText: {
        color: colors.white,
        fontSize: 20,
        fontWeight: "500",
        textAlign: "center",
        flexWrap: "wrap",
        includeFontPadding: false,
    },
});

export default KeywordSearchScreen;
