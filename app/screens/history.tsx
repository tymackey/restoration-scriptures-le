import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    FlatList,
} from "react-native";
import { getHistory, clearHistory } from "../util/HistoryStorage";
import { useFocusEffect } from "@react-navigation/native";
import { useDatabase } from "../data/useDatabase";
import { HistoryItem, Volume } from "../data/types";
import { List } from "react-native-paper";
import { colors } from "../constants/colors";
import { commonStyles } from "../styles/commonStyles";

function HistoryScreen({ route, navigation }: { route: any; navigation: any }) {
    const { getVolumes } = useDatabase();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [volumes, setVolumes] = useState<Volume[]>([]);

    useEffect(() => {
        const loadVolumes = async () => {
            const volumes = await getVolumes();
            setVolumes(volumes);
        };

        loadVolumes();
    }, []);

    useFocusEffect(
        useCallback(() => {
            let focusUnsubscribe = () => {};
            const retrieveHistory = async () => {
                const historyItems = await getHistory();
                if (historyItems) {
                    setHistory(historyItems);
                }

                // Subscribe for the focus Listener
                focusUnsubscribe = navigation.addListener("focus", () => {
                    retrieveHistory();
                });
            };

            retrieveHistory();

            return () => focusUnsubscribe();
        }, []),
    );

    const formatDateTime = (jsonDate: string) => {
        const dateObj = new Date(jsonDate);
        return [
            dateObj.toLocaleDateString([], {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "2-digit",
            }),
            dateObj.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
            }),
        ];
    };

    const clearAlert = () =>
        Alert.alert("Clear History", "Permanently delete all history?", [
            {
                text: "Cancel",
                style: "cancel",
            },
            {
                text: "Remove",
                onPress: async () => {
                    await clearHistory();
                    setHistory([]);
                },
                style: "destructive",
            },
        ]);

    const historyRenderItem = ({
        item,
        index,
    }: {
        item: HistoryItem;
        index: number;
    }) => {
        const [date, time] = formatDateTime(item.datetime);
        const volume = volumes.find((v) => v.volume_id === item.volume);
        const volumeName =
            volume && (volume.volume_id === "cc" || volume.volume_id === "bofm")
                ? volume.name
                : "";
        return (
            <>
                <List.Item
                    containerStyle={styles.listItem}
                    style={styles.listItemContent}
                    titleStyle={[styles.text, styles.title, commonStyles.fill]}
                    title={`${item.name} ${volumeName ? `(${volumeName})` : ""}`}
                    titleNumberOfLines={3}
                    right={() => (
                        <View style={commonStyles.alignEnd}>
                            <Text style={styles.dateText}>{date}</Text>
                            <Text style={styles.dateText}>{time}</Text>
                        </View>
                    )}
                    onPress={() => navigate(item)}
                />
                {index < history.length - 1 && (
                    <View style={styles.listItemDivider} />
                )}
            </>
        );
    };

    const navigate = async (item: HistoryItem) => {
        const params = {
            book_chapter: item.chapter,
            book_id: item.book,
            chapter_id: item.chapter_id,
            name: item.name,
            volume_id: item.volume,
            position: item.paragraph,
        };
        navigation.navigate("Reader", params);
    };

    return (
        <View style={styles.historyContainer}>
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={clearAlert}
                >
                    <Text style={styles.clearButtonText}>Clear History</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.listContainer}>
                {history.length > 0 && volumes.length > 0 ? (
                    <FlatList
                        data={history}
                        renderItem={historyRenderItem}
                        keyExtractor={(item) => item.datetime}
                    />
                ) : (
                    <Text style={styles.text}>No Results</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    historyContainer: {
        flex: 1,
        padding: 2,
        backgroundColor: colors.background,
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
        width: "100%",
        height: "100%",
        paddingTop: 18,
        paddingHorizontal: 12,
        backgroundColor: colors.transparent,
        borderTopWidth: 1,
        borderTopColor: colors.white,
    },
    listItem: {
        backgroundColor: colors.transparent,
    },
    listItemDivider: {
        borderBottomColor: colors.cardBackground,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    listItemContent: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
    },
    title: {
        color: colors.converterLinkBlue,
        marginRight: 4,
    },
    dateText: {
        fontSize: 16,
        color: colors.white,
        flexWrap: "nowrap",
        flexShrink: 0,
    },
    text: {
        fontSize: 16,
        color: colors.white,
        flexWrap: "nowrap",
        flex: 1,
    },
});

export default HistoryScreen;
