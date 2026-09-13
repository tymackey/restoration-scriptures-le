import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useNavigation } from "@react-navigation/native";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { useState, useEffect, useMemo } from "react";
import VolumeList from "../components/VolumeList";
import SectionGroupList from "../components/SectionGroupList";
import { useDatabase } from "../data/useDatabase";
import { Book, Chapter, SectionGroup } from "../data/types";
import {
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    FlatList,
} from "react-native";
import { colors } from "../constants/colors";
import { useSettingsStore } from "../data/useSettingsStore";
import { useTCStore } from "../data/useTCStore";
import { useShallow } from "zustand/react/shallow";
import { useCardLayout, CardLayoutConfig } from "../util/cardLayoutUtils";
import ScriptureListItem from "../components/ScriptureListItem";
import ScripturePreviewItem from "../components/ScripturePreviewItem";
import { cardStyles } from "../styles/cardStyles";
import { commonStyles } from "../styles/commonStyles";

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

type TabParamList = {
    "Teachings & Commandments": { books: TcBookItem[] };
    "Covenant of Christ": { books: Book[] };
};

const Tab = createMaterialTopTabNavigator<TabParamList>();

export default function NewCovenantsScreen() {
    const { getTcBooks, getBooks } = useDatabase();
    const [tcBooks, setTcBooks] = useState<TcBookItem[]>([]);
    const [ccBooks, setCcBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBooks = async () => {
            try {
                setLoading(true);
                const [tcData, ccData] = await Promise.all([
                    getTcBooks(),
                    getBooks("cc"),
                ]);
                const idx = tcData.findIndex(
                    (book) => book.name === "A Glossary of Terms",
                );
                if (idx !== -1) tcData.splice(idx, 1);
                setTcBooks(tcData);
                setCcBooks(ccData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchBooks();
    }, [getTcBooks, getBooks]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="blue" />
            </View>
        );
    }

    return (
        <Tab.Navigator
            id={undefined}
            initialRouteName="Teachings & Commandments"
            screenOptions={{
                tabBarStyle: {
                    backgroundColor: colors.background,
                },
                tabBarLabelStyle: {
                    color: colors.text,
                },
            }}
        >
            <Tab.Screen
                name="Teachings & Commandments"
                component={TeachingsCommandmentsScreen}
                initialParams={{ books: tcBooks }}
            />
            <Tab.Screen
                name="Covenant of Christ"
                component={CovenantofChristScreen}
                initialParams={{ books: ccBooks }}
            />
        </Tab.Navigator>
    );
}

function TeachingsCommandmentsScreen({
    route,
}: {
    route: { params: { books: TcBookItem[] } };
}) {
    const { books } = route.params;
    const { selectedGroup, setSelectedGroup } = useTCStore();
    const layout = useSettingsStore((state) => state.layout);
    const navigation = useNavigation<DrawerNavigationProp<any>>();
    const isLandscape = useSettingsStore(
        useShallow((state) => state.isLandscape),
    );

    const nested_chapters = {
        1: { chapter_id: "jshistory", title: "Joseph Smith History" },
        110: { chapter_id: "lecture", title: "Lectures on Faith" },
        145: { chapter_id: "abraham", title: "The Book of Abraham" },
        171: { chapter_id: "toj", title: "The Testimony of St. John" },
    };

    const cardLayoutConfig = useMemo<CardLayoutConfig>(
        () => ({
            isLandscape: isLandscape,
        }),
        [isLandscape],
    );

    const { numColumns: calculatedNumColumns } =
        useCardLayout(cardLayoutConfig);
    const numColumns = layout === "list" ? 1 : calculatedNumColumns;

    const handleGroupPress = (group: SectionGroup) => {
        setSelectedGroup(group);
    };

    const handleBack = () => {
        setSelectedGroup(null);
    };

    const navigate = async (item: Chapter) => {
        const requestChapter = async (
            book_id: string,
            book_chapter: number | undefined,
        ) => {
            try {
                if (book_id === "section") {
                    const nested =
                        nested_chapters[
                            book_chapter as keyof typeof nested_chapters
                        ];
                    if (nested) {
                        navigation.navigate("Chapter", {
                            id: nested.chapter_id,
                            volume_id: "tc",
                            name: nested.title,
                        });
                        return;
                    }
                }
                navigation.navigate("Reader", {
                    book_chapter: item.book_chapter,
                    book_id: item.book_id,
                    chapter_id: item.chapter_id,
                    name: item.name,
                    volume_id: "tc",
                });
            } catch (e) {
                console.error(e);
            }
        };
        requestChapter(item.book_id, item.book_chapter);
    };

    if (selectedGroup) {
        return (
            <View style={styles.tabContent}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                >
                    <Text style={styles.backButtonText}>
                        ← Back to Sections
                    </Text>
                </TouchableOpacity>
                <FlatList
                    key={`${layout}-${numColumns}`}
                    data={selectedGroup.sections}
                    renderItem={(section) => {
                        if (layout === "list") {
                            return (
                                <ScriptureListItem
                                    item={section.item}
                                    action={navigate}
                                />
                            );
                        }
                        return (
                            <ScripturePreviewItem
                                item={section.item}
                                action={navigate}
                                landscape={isLandscape}
                            />
                        );
                    }}
                    numColumns={numColumns}
                    extraData={layout}
                    keyExtractor={(item) => item.name}
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
                />
            </View>
        );
    }

    return (
        <View style={styles.tabContent}>
            <SectionGroupList
                sections={books}
                onGroupPress={handleGroupPress}
                landscape={isLandscape}
                navigate={navigate}
            />
        </View>
    );
}

function CovenantofChristScreen({
    route,
}: {
    route: { params: { books: Book[] } };
}) {
    const { books } = route.params;
    return <VolumeList items={books} />;
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    tabContent: {
        flex: 1,
        backgroundColor: colors.background,
    },
    backButton: {
        padding: 10,
        backgroundColor: colors.converterSuggestionBg,
        marginBottom: 10,
    },
    backButtonText: {
        color: colors.text,
        fontSize: 16,
    },
});
