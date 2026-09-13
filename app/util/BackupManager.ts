import { SQLiteDatabase } from "expo-sqlite";
import { Highlight } from "../data/UserDatabaseSchema";
import { useSettingsStore } from "../data/useSettingsStore";
import { useScreensStore, ReaderScreen } from "../data/useScreensStore";

export interface BackupSettings {
    fontSize: number;
    fontFamily: string;
    alignment: string;
    isDarkColorScheme: boolean;
    backgroundColor: string;
    foregroundColor: string;
    markerColor: string;
    voice: string;
    rate: number;
    layout: string;
    displayLEVerses: boolean;
    isAutoPlaying: boolean;
    currentReference: string;
}

/** The open reader screens (browser-tab-like) captured in a backup. */
export interface BackupScreens {
    screens: ReaderScreen[];
    activeScreenId: string | null;
}

export interface BackupFile {
    version: number;
    app: string;
    exported_at: string;
    settings: BackupSettings;
    highlights: Highlight[];
    bookmarks: unknown[];
    // Optional so older (screens-unaware) backups still restore cleanly, and so
    // older app builds can still read backups that include this field.
    screens?: BackupScreens;
}

export type RestoreResult = {
    highlightsImported: number;
    highlightsDuplicate: number;
    underlinesImported: number;
    underlinesDuplicate: number;
};

/**
 * Creates a JSON backup string from current settings and highlights.
 */
export async function createBackup(
    settings: BackupSettings,
    getAllHighlights: () => Promise<Highlight[]>,
    screens?: BackupScreens,
): Promise<string> {
    const highlights = await getAllHighlights();
    const backupFile: BackupFile = {
        version: 1,
        app: "RestorationScriptures",
        exported_at: new Date().toISOString(),
        settings,
        highlights,
        bookmarks: [],
        ...(screens ? { screens } : {}),
    };
    return JSON.stringify(backupFile, null, 2);
}

/**
 * Parses and validates a backup JSON string.
 * Throws descriptive errors for invalid or incompatible files.
 */
export function parseBackupFile(json: string): BackupFile {
    let parsed: any;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error("Invalid file: not valid JSON");
    }

    if (parsed.app !== "RestorationScriptures") {
        throw new Error("Not a Restoration Scriptures backup file");
    }

    if (typeof parsed.version !== "number") {
        throw new Error("Missing version field");
    }

    if (parsed.version > 1) {
        throw new Error("This backup requires a newer version of the app");
    }

    if (!Array.isArray(parsed.highlights)) {
        throw new Error("Highlights data is missing or corrupt");
    }

    if (typeof parsed.settings !== "object" || parsed.settings === null) {
        throw new Error("Settings data is missing");
    }

    // Screens are optional and non-critical: sanitize rather than reject, so a
    // corrupt/partial screens block never blocks a highlights+settings restore.
    parsed.screens = sanitizeScreens(parsed.screens);
    if (parsed.screens === undefined) delete parsed.screens;

    return parsed as BackupFile;
}

/**
 * Normalizes a raw `screens` block from a parsed backup into a valid
 * BackupScreens, or `undefined` when it is absent or unusable. Drops malformed
 * screen entries and repairs a dangling `activeScreenId`.
 */
function sanitizeScreens(raw: any): BackupScreens | undefined {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.screens)) {
        return undefined;
    }

    const screens: ReaderScreen[] = raw.screens
        .filter(
            (s: any) =>
                s &&
                typeof s === "object" &&
                typeof s.id === "string" &&
                // chapter_id is typed as string but is a numeric SQLite id at
                // runtime — accept either, only requiring that it be present.
                s.chapter_id != null,
        )
        .map((s: any) => ({
            ...s,
            history: Array.isArray(s.history) ? s.history : [],
        }));

    if (screens.length === 0) return undefined;

    const activeScreenId =
        typeof raw.activeScreenId === "string" &&
        screens.some((s) => s.id === raw.activeScreenId)
            ? raw.activeScreenId
            : screens[0].id;

    return { screens, activeScreenId };
}

/**
 * Restores settings from a backup file directly into the settings store.
 * Safe to call outside React component context.
 */
export function restoreSettings(backup: BackupFile): void {
    const store = useSettingsStore.getState();

    // setFontFamily may adjust fontSize for OpenDyslexic, so call it first,
    // then override fontSize explicitly afterward.
    store.setFontFamily(backup.settings.fontFamily);
    useSettingsStore.setState({ fontSize: backup.settings.fontSize });

    store.changeColorScheme(
        backup.settings.backgroundColor,
        backup.settings.foregroundColor,
        backup.settings.markerColor,
    );
    // No setter exists for isDarkColorScheme — set directly
    useSettingsStore.setState({
        isDarkColorScheme: backup.settings.isDarkColorScheme,
    });

    if (backup.settings.alignment === "left") {
        store.alignLeft();
    } else {
        store.alignJustify();
    }

    store.setLayout(backup.settings.layout);
    store.toggleLEVerses(backup.settings.displayLEVerses);
    store.setVoice(backup.settings.voice);
    store.setRate(backup.settings.rate);
    store.toggleAutoPlay(backup.settings.isAutoPlaying);

    if (backup.settings.currentReference) {
        useSettingsStore.setState({
            currentReference: backup.settings.currentReference,
        });
    }
}

/**
 * Restores the open reader screens from a backup file into the screens store,
 * replacing whatever screens are currently open. Does nothing when the backup
 * predates the screens feature (no `screens` block). Safe to call outside React
 * component context.
 *
 * @returns the number of screens restored.
 */
export function restoreScreens(backup: BackupFile): number {
    if (!backup.screens) return 0;
    useScreensStore.setState({
        screens: backup.screens.screens,
        activeScreenId: backup.screens.activeScreenId,
        pendingNewScreen: false,
    });
    return backup.screens.screens.length;
}

/**
 * Restores highlights from a backup file into the user database.
 * Uses INSERT OR IGNORE by primary key UUID to prevent re-importing duplicates.
 *
 * @param mode 'merge' keeps existing highlights and adds new ones;
 *             'replace' deletes all existing highlights first.
 */
export async function restoreHighlights(
    backup: BackupFile,
    userDb: SQLiteDatabase,
    mode: "merge" | "replace",
): Promise<RestoreResult> {
    if (mode === "replace") {
        await userDb.runAsync("DELETE FROM highlights");
    }

    let highlightsImported = 0;
    let highlightsDuplicate = 0;
    let underlinesImported = 0;
    let underlinesDuplicate = 0;

    for (const h of backup.highlights) {
        const markType = h.mark_type ?? "highlight";
        const result = await userDb.runAsync(
            `INSERT OR IGNORE INTO highlights
             (id, volume_id, book_id, book_chapter, paragraph_position, end_paragraph_position,
              start_offset, end_offset, selected_text, color, mark_type, created_at, modified_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                h.id,
                h.volume_id,
                h.book_id,
                h.book_chapter,
                h.paragraph_position,
                h.end_paragraph_position ?? null,
                h.start_offset,
                h.end_offset,
                h.selected_text,
                h.color,
                markType,
                h.created_at,
                h.modified_at,
            ],
        );

        if (markType === "underline") {
            if (result.changes > 0) underlinesImported++;
            else underlinesDuplicate++;
        } else {
            if (result.changes > 0) highlightsImported++;
            else highlightsDuplicate++;
        }
    }

    return {
        highlightsImported,
        highlightsDuplicate,
        underlinesImported,
        underlinesDuplicate,
    };
}
