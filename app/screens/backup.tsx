import { colors } from "../constants/colors";
import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { useDatabase } from "../data/useDatabase";
import { useUserDatabase } from "../data/UserDatabaseContext";
import { useSettingsStore } from "../data/useSettingsStore";
import { useScreensStore } from "../data/useScreensStore";
import {
    createBackup,
    parseBackupFile,
    restoreSettings,
    restoreScreens,
    restoreHighlights,
    BackupSettings,
} from "../util/BackupManager";

function BackupScreen() {
    const { getAllHighlights } = useDatabase();
    const userDb = useUserDatabase();

    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusIsError, setStatusIsError] = useState(false);

    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => setStatusMessage(null), 6000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    const showStatus = (message: string, isError: boolean) => {
        setStatusIsError(isError);
        setStatusMessage(message);
    };

    const handleExport = async () => {
        setIsExporting(true);
        setStatusMessage(null);

        try {
            const state = useSettingsStore.getState();
            const settings: BackupSettings = {
                fontSize: state.fontSize,
                fontFamily: state.fontFamily,
                alignment: state.alignment,
                isDarkColorScheme: state.isDarkColorScheme,
                backgroundColor: state.backgroundColor,
                foregroundColor: state.foregroundColor,
                markerColor: state.markerColor,
                voice: state.voice,
                rate: state.rate,
                layout: state.layout,
                displayLEVerses: state.displayLEVerses,
                isAutoPlaying: state.isAutoPlaying,
                currentReference: state.currentReference,
            };

            const screensState = useScreensStore.getState();
            const json = await createBackup(settings, getAllHighlights, {
                screens: screensState.screens,
                activeScreenId: screensState.activeScreenId,
            });
            const filename = `rescriptures-backup-${new Date().toISOString().slice(0, 10)}.json`;
            const path = (FileSystem.documentDirectory ?? "") + filename;

            await FileSystem.writeAsStringAsync(path, json, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            await Sharing.shareAsync(path, {
                mimeType: "application/octet-stream",
                dialogTitle: "Save Backup File",
            });

            showStatus(
                "Backup created. Share or save it to a safe location.",
                false,
            );
        } catch (error) {
            console.error("Export error:", error);
            showStatus("Export failed. Please try again.", true);
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async () => {
        setStatusMessage(null);

        let result;
        try {
            result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
                multiple: false,
            });
        } catch (error) {
            console.error("Document picker error:", error);
            showStatus("Could not open file picker.", true);
            return;
        }

        if (result.canceled) {
            return;
        }

        setIsImporting(true);

        try {
            const json = await FileSystem.readAsStringAsync(
                result.assets[0].uri,
                {
                    encoding: FileSystem.EncodingType.UTF8,
                },
            );

            let backup;
            try {
                backup = parseBackupFile(json);
            } catch (parseError: any) {
                showStatus(parseError.message ?? "Invalid backup file.", true);
                setIsImporting(false);
                return;
            }

            Alert.alert(
                "Restore from Backup",
                "How would you like to import highlights?\n\nMerge — Keeps your existing highlights and adds new ones. Duplicates are skipped.\n\nReplace — Deletes all existing highlights, then loads from backup.",
                [
                    {
                        text: "Cancel",
                        style: "cancel",
                        onPress: () => setIsImporting(false),
                    },
                    {
                        text: "Merge",
                        onPress: async () => {
                            try {
                                const r = await restoreHighlights(
                                    backup,
                                    userDb,
                                    "merge",
                                );
                                restoreSettings(backup);
                                const screensRestored = restoreScreens(backup);
                                showStatus(
                                    `Restore complete. ${r.highlightsImported} highlights and ${r.underlinesImported} underlines imported` +
                                        (r.highlightsDuplicate +
                                            r.underlinesDuplicate >
                                        0
                                            ? `, ${r.highlightsDuplicate + r.underlinesDuplicate} duplicates skipped`
                                            : "") +
                                        `. Settings updated.` +
                                        (screensRestored > 0
                                            ? ` ${screensRestored} open screens restored.`
                                            : ""),
                                    false,
                                );
                            } catch (err) {
                                console.error("Restore error:", err);
                                showStatus(
                                    "Restore failed. The backup file may be corrupt.",
                                    true,
                                );
                            } finally {
                                setIsImporting(false);
                            }
                        },
                    },
                    {
                        text: "Replace",
                        style: "destructive",
                        onPress: async () => {
                            try {
                                const r = await restoreHighlights(
                                    backup,
                                    userDb,
                                    "replace",
                                );
                                restoreSettings(backup);
                                const screensRestored = restoreScreens(backup);
                                showStatus(
                                    `Restore complete. ${r.highlightsImported} highlights and ${r.underlinesImported} underlines imported. Settings updated.` +
                                        (screensRestored > 0
                                            ? ` ${screensRestored} open screens restored.`
                                            : ""),
                                    false,
                                );
                            } catch (err) {
                                console.error("Restore error:", err);
                                showStatus(
                                    "Restore failed. The backup file may be corrupt.",
                                    true,
                                );
                            } finally {
                                setIsImporting(false);
                            }
                        },
                    },
                ],
            );
        } catch (error) {
            console.error("Import error:", error);
            showStatus("Failed to read the file. Please try again.", true);
            setIsImporting(false);
        }
    };

    const isBusy = isExporting || isImporting;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
        >
            <Text style={styles.sectionTitle}>BACKUP YOUR DATA</Text>
            <TouchableOpacity
                style={[styles.button, isBusy && styles.buttonDisabled]}
                onPress={handleExport}
                disabled={isBusy}
            >
                {isExporting ? (
                    <ActivityIndicator color={colors.white} size="small" />
                ) : (
                    <Text style={styles.buttonText}>Save Backup File</Text>
                )}
            </TouchableOpacity>
            <Text style={styles.helperText}>
                Creates a backup file containing your highlights, display
                settings, and open screens.
            </Text>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>RESTORE FROM BACKUP</Text>
            <TouchableOpacity
                style={[styles.button, isBusy && styles.buttonDisabled]}
                onPress={handleImport}
                disabled={isBusy}
            >
                {isImporting ? (
                    <ActivityIndicator color={colors.white} size="small" />
                ) : (
                    <Text style={styles.buttonText}>Load Backup File</Text>
                )}
            </TouchableOpacity>
            <Text style={styles.helperText}>
                Select a backup file to restore.
            </Text>
            <Text style={styles.warningText}>
                ⚠ Restoring settings will overwrite current display
                preferences.
            </Text>

            {statusMessage !== null && (
                <View
                    style={[
                        styles.statusBox,
                        statusIsError
                            ? styles.statusBoxError
                            : styles.statusBoxSuccess,
                    ]}
                >
                    <Text style={styles.statusText}>{statusMessage}</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    contentContainer: {
        padding: 20,
    },
    sectionTitle: {
        color: colors.white,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 12,
        marginTop: 8,
    },
    button: {
        backgroundColor: colors.converterButtonBlue,
        borderRadius: 4,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: "center",
        marginBottom: 10,
    },
    buttonDisabled: {
        backgroundColor: colors.buttonNeutral,
    },
    buttonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: "500",
    },
    helperText: {
        color: colors.cardBackground,
        fontSize: 14,
        marginBottom: 8,
    },
    warningText: {
        color: colors.warning,
        fontSize: 14,
        marginTop: 4,
    },
    divider: {
        borderBottomColor: colors.borderSubtle,
        borderBottomWidth: StyleSheet.hairlineWidth,
        marginVertical: 24,
    },
    statusBox: {
        borderRadius: 8,
        padding: 14,
        marginTop: 24,
    },
    statusBoxSuccess: {
        backgroundColor: colors.successDark,
    },
    statusBoxError: {
        backgroundColor: colors.dangerDark,
    },
    statusText: {
        color: colors.white,
        fontSize: 14,
    },
});

export default BackupScreen;
