import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    FlatList,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useDatabase } from "../data/useDatabase";
import { AnnotationItem } from "../data/UserDatabaseSchema";
import { colors } from "../constants/colors";

type TabType = "highlight" | "underline";

function AnnotationsScreen({ navigation }: { navigation: any }) {
    const {
        getAnnotationsByType,
        deleteHighlight,
        deleteAllAnnotationsByType,
    } = useDatabase();
    const [activeTab, setActiveTab] = useState<TabType>("highlight");
    const [highlights, setHighlights] = useState<AnnotationItem[]>([]);
    const [underlines, setUnderlines] = useState<AnnotationItem[]>([]);

    const loadAnnotations = useCallback(async () => {
        const [h, u] = await Promise.all([
            getAnnotationsByType("highlight"),
            getAnnotationsByType("underline"),
        ]);
        setHighlights(h);
        setUnderlines(u);
    }, [getAnnotationsByType]);

    useFocusEffect(
        useCallback(() => {
            loadAnnotations();
        }, [loadAnnotations]),
    );

    const items = activeTab === "highlight" ? highlights : underlines;
    const label = activeTab === "highlight" ? "Highlights" : "Underlines";

    const formatReference = (item: AnnotationItem) => {
        const useChapterName =
            item.book_id.toLowerCase().includes("glossary") ||
            item.book_id === "tcappendix";
        const chapterLabel = useChapterName
            ? item.chapter_name
            : item.book_chapter;
        const endPara = item.end_paragraph_position;
        const paraRange =
            endPara !== null && endPara !== item.paragraph_position
                ? `${item.paragraph_position}-${endPara}`
                : `${item.paragraph_position}`;
        return `(${item.volume_name}) ${item.book_name} ${chapterLabel}:${paraRange}`;
    };

    const navigateToAnnotation = (item: AnnotationItem) => {
        navigation.navigate("Reader", {
            book_chapter: item.book_chapter,
            book_id: item.book_id,
            chapter_id: item.chapter_id,
            name: item.chapter_name,
            volume_id: item.volume_id,
            position: item.paragraph_position,
        });
    };

    const handleDelete = (item: AnnotationItem) => {
        Alert.alert("Remove Annotation", `Remove this ${activeTab}?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove",
                style: "destructive",
                onPress: async () => {
                    await deleteHighlight(item.id);
                    if (activeTab === "highlight") {
                        setHighlights((prev) =>
                            prev.filter((h) => h.id !== item.id),
                        );
                    } else {
                        setUnderlines((prev) =>
                            prev.filter((u) => u.id !== item.id),
                        );
                    }
                },
            },
        ]);
    };

    const handleClearAll = () => {
        Alert.alert(
            `Clear All ${label}`,
            `Permanently delete all ${label.toLowerCase()}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        await deleteAllAnnotationsByType(activeTab);
                        if (activeTab === "highlight") {
                            setHighlights([]);
                        } else {
                            setUnderlines([]);
                        }
                    },
                },
            ],
        );
    };

    const renderItem = ({
        item,
        index,
    }: {
        item: AnnotationItem;
        index: number;
    }) => (
        <>
            <View style={styles.listItem}>
                <TouchableOpacity
                    style={styles.referenceContainer}
                    onPress={() => navigateToAnnotation(item)}
                >
                    <Text style={styles.referenceText}>
                        {formatReference(item)}
                    </Text>
                    <Text style={styles.selectedText} numberOfLines={2}>
                        {item.selected_text}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item)}
                >
                    <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={28}
                        color="#E57373"
                    />
                </TouchableOpacity>
            </View>
            {index < items.length - 1 && <View style={styles.divider} />}
        </>
    );

    return (
        <View style={styles.container}>
            <View style={styles.tabBar}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === "highlight" && styles.tabActive,
                    ]}
                    onPress={() => setActiveTab("highlight")}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === "highlight" && styles.tabTextActive,
                        ]}
                    >
                        {"Highlights"}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === "underline" && styles.tabActive,
                    ]}
                    onPress={() => setActiveTab("underline")}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === "underline" && styles.tabTextActive,
                        ]}
                    >
                        {"Underlines"}
                    </Text>
                </TouchableOpacity>
            </View>
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClearAll}
                >
                    <Text
                        style={styles.clearButtonText}
                    >{`Clear All ${label}`}</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.listContainer}>
                {items.length > 0 ? (
                    <FlatList
                        data={items}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                    />
                ) : (
                    <Text style={styles.emptyText}>{`No ${label}`}</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    tabBar: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: "center",
    },
    tabActive: {
        borderBottomWidth: 3,
        borderBottomColor: colors.converterButtonBlue,
    },
    tabText: {
        fontSize: 16,
        color: colors.mutedText,
        fontWeight: "500",
    },
    tabTextActive: {
        color: colors.white,
    },
    buttonContainer: {
        paddingVertical: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    clearButton: {
        backgroundColor: colors.converterButtonBlue,
        padding: 12,
        borderRadius: 4,
        width: "75%",
        alignItems: "center",
    },
    clearButtonText: {
        color: colors.white,
        fontSize: 20,
        fontWeight: "500",
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: 12,
        borderTopWidth: 1,
        borderTopColor: colors.white,
    },
    listItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
    },
    referenceContainer: {
        flex: 1,
        paddingRight: 8,
    },
    referenceText: {
        fontSize: 16,
        color: colors.converterLinkBlue,
        fontWeight: "500",
    },
    selectedText: {
        fontSize: 14,
        color: colors.cardBackground,
        marginTop: 2,
    },
    deleteButton: {
        padding: 6,
    },
    divider: {
        borderBottomColor: colors.cardBackground,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    emptyText: {
        fontSize: 16,
        color: colors.white,
        marginTop: 24,
        textAlign: "center",
    },
});

export default AnnotationsScreen;
