import { vi } from "vitest";
import {
    createBackup,
    parseBackupFile,
    restoreSettings,
    restoreScreens,
    restoreHighlights,
    type BackupFile,
    type BackupSettings,
} from "../BackupManager";
import type { Highlight } from "../../data/UserDatabaseSchema";
import { useScreensStore, type ReaderScreen } from "../../data/useScreensStore";

// Import the mocked module so we can configure return values in tests
import { useSettingsStore } from "../../data/useSettingsStore";

// ---------------------------------------------------------------------------
// Module mock — must be declared before any imports that use the mock
// ---------------------------------------------------------------------------

vi.mock("../../data/useSettingsStore", () => ({
    useSettingsStore: {
        getState: vi.fn(),
        setState: vi.fn(),
    },
}));

// ---------------------------------------------------------------------------
// Test-data factories
// ---------------------------------------------------------------------------

function makeHighlight(overrides: Partial<Highlight> = {}): Highlight {
    return {
        id: "uuid-1",
        volume_id: "cc",
        book_id: "ccforeword",
        book_chapter: "1",
        paragraph_position: 3,
        end_paragraph_position: null,
        start_offset: 10,
        end_offset: 26,
        selected_text: "In the beginning",
        color: "#FFFF00",
        mark_type: "highlight",
        created_at: "2026-01-01T00:00:00.000Z",
        modified_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeSettings(overrides: Partial<BackupSettings> = {}): BackupSettings {
    return {
        fontSize: 18,
        fontFamily: "Assistant-Regular",
        alignment: "justify",
        isDarkColorScheme: false,
        backgroundColor: "#ffffff",
        foregroundColor: "#15141A",
        markerColor: "#ba3919",
        voice: "male1",
        rate: 1.0,
        layout: "list",
        displayLEVerses: true,
        isAutoPlaying: false,
        currentReference: "genesis 1:0",
        ...overrides,
    };
}

function makeBackupFile(overrides: Partial<BackupFile> = {}): BackupFile {
    return {
        version: 1,
        app: "RestorationScriptures",
        exported_at: new Date().toISOString(),
        settings: makeSettings(),
        highlights: [],
        bookmarks: [],
        ...overrides,
    };
}

function makeScreen(overrides: Partial<ReaderScreen> = {}): ReaderScreen {
    return {
        id: "scr_1",
        volume_id: "oc",
        book_id: "gen",
        book_chapter: 1,
        chapter_id: "gen:001",
        name: "Genesis 1",
        position: 0,
        searchTerm: null,
        history: [],
        ...overrides,
    };
}

/** Creates a minimal mock SQLiteDatabase with a configurable `changes` value. */
function createMockDb(changesPerInsert = 1) {
    return {
        runAsync: vi.fn().mockResolvedValue({ changes: changesPerInsert }),
    };
}

/** Store-action mocks reused across restoreSettings tests. */
const mockActions = {
    setFontFamily: vi.fn(),
    changeColorScheme: vi.fn(),
    alignLeft: vi.fn(),
    alignJustify: vi.fn(),
    setLayout: vi.fn(),
    toggleLEVerses: vi.fn(),
    setVoice: vi.fn(),
    setRate: vi.fn(),
    toggleAutoPlay: vi.fn(),
};

// ---------------------------------------------------------------------------
// createBackup
// ---------------------------------------------------------------------------

describe("createBackup", () => {
    it("returns a string that is valid JSON", async () => {
        const json = await createBackup(makeSettings(), async () => []);
        expect(() => JSON.parse(json)).not.toThrow();
    });

    it("sets version to 1 and app to 'RestorationScriptures'", async () => {
        const json = await createBackup(makeSettings(), async () => []);
        const parsed = JSON.parse(json);
        expect(parsed.version).toBe(1);
        expect(parsed.app).toBe("RestorationScriptures");
    });

    it("exported_at is an ISO timestamp close to now", async () => {
        const before = Date.now();
        const json = await createBackup(makeSettings(), async () => []);
        const after = Date.now();
        const parsed = JSON.parse(json);
        const exportedAt = new Date(parsed.exported_at).getTime();
        expect(exportedAt).toBeGreaterThanOrEqual(before);
        expect(exportedAt).toBeLessThanOrEqual(after);
    });

    it("embeds all settings fields into the output", async () => {
        const settings = makeSettings({
            fontSize: 24,
            fontFamily: "EBGaramond-Regular",
            voice: "female2",
            rate: 1.5,
            layout: "card",
            isDarkColorScheme: true,
        });
        const json = await createBackup(settings, async () => []);
        const parsed = JSON.parse(json);
        expect(parsed.settings.fontSize).toBe(24);
        expect(parsed.settings.fontFamily).toBe("EBGaramond-Regular");
        expect(parsed.settings.voice).toBe("female2");
        expect(parsed.settings.rate).toBe(1.5);
        expect(parsed.settings.layout).toBe("card");
        expect(parsed.settings.isDarkColorScheme).toBe(true);
    });

    it("includes highlights returned by getAllHighlights", async () => {
        const highlights = [
            makeHighlight({ id: "a", selected_text: "first" }),
            makeHighlight({ id: "b", selected_text: "second" }),
        ];
        const json = await createBackup(makeSettings(), async () => highlights);
        const parsed = JSON.parse(json);
        expect(parsed.highlights).toHaveLength(2);
        expect(parsed.highlights[0].id).toBe("a");
        expect(parsed.highlights[1].selected_text).toBe("second");
    });

    it("includes an empty bookmarks array", async () => {
        const json = await createBackup(makeSettings(), async () => []);
        const parsed = JSON.parse(json);
        expect(parsed.bookmarks).toEqual([]);
    });

    it("produces an empty highlights array when there are no highlights", async () => {
        const json = await createBackup(makeSettings(), async () => []);
        const parsed = JSON.parse(json);
        expect(parsed.highlights).toEqual([]);
    });

    it("embeds open screens when provided", async () => {
        const screens = {
            screens: [
                makeScreen({ id: "a" }),
                makeScreen({ id: "b", chapter_id: "gen:002" }),
            ],
            activeScreenId: "b",
        };
        const json = await createBackup(
            makeSettings(),
            async () => [],
            screens,
        );
        const parsed = JSON.parse(json);
        expect(parsed.screens.screens).toHaveLength(2);
        expect(parsed.screens.activeScreenId).toBe("b");
        expect(parsed.screens.screens[0].id).toBe("a");
    });

    it("omits the screens field entirely when not provided", async () => {
        const json = await createBackup(makeSettings(), async () => []);
        const parsed = JSON.parse(json);
        expect("screens" in parsed).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// parseBackupFile
// ---------------------------------------------------------------------------

describe("parseBackupFile", () => {
    it("parses a valid backup file and returns a BackupFile object", () => {
        const result = parseBackupFile(JSON.stringify(makeBackupFile()));
        expect(result.version).toBe(1);
        expect(result.app).toBe("RestorationScriptures");
        expect(result.highlights).toEqual([]);
        expect(typeof result.settings).toBe("object");
    });

    it("preserves highlights in the parsed result", () => {
        const backup = makeBackupFile({
            highlights: [makeHighlight({ id: "x" })],
        });
        const result = parseBackupFile(JSON.stringify(backup));
        expect(result.highlights).toHaveLength(1);
        expect(result.highlights[0].id).toBe("x");
    });

    it("throws 'Invalid file: not valid JSON' for malformed input", () => {
        expect(() => parseBackupFile("not json {{")).toThrow(
            "Invalid file: not valid JSON",
        );
    });

    it("throws 'Invalid file: not valid JSON' for empty string", () => {
        expect(() => parseBackupFile("")).toThrow(
            "Invalid file: not valid JSON",
        );
    });

    it("throws for wrong app name", () => {
        const bad = { ...makeBackupFile(), app: "SomeOtherApp" };
        expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(
            "Not a Restoration Scriptures backup file",
        );
    });

    it("throws when version field is missing", () => {
        const bad = makeBackupFile() as any;
        delete bad.version;
        expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(
            "Missing version field",
        );
    });

    it("throws when version is a string instead of a number", () => {
        const bad = { ...makeBackupFile(), version: "1" };
        expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(
            "Missing version field",
        );
    });

    it("throws when version is newer than supported", () => {
        const bad = { ...makeBackupFile(), version: 2 };
        expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(
            "This backup requires a newer version of the app",
        );
    });

    it("throws when highlights is not an array", () => {
        const bad = { ...makeBackupFile(), highlights: null };
        expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(
            "Highlights data is missing or corrupt",
        );
    });

    it("throws when highlights field is missing entirely", () => {
        const bad = makeBackupFile() as any;
        delete bad.highlights;
        expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(
            "Highlights data is missing or corrupt",
        );
    });

    it("throws when highlights is an object (not array)", () => {
        const bad = { ...makeBackupFile(), highlights: { 0: makeHighlight() } };
        expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(
            "Highlights data is missing or corrupt",
        );
    });

    it("throws when settings is null", () => {
        const bad = { ...makeBackupFile(), settings: null };
        expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(
            "Settings data is missing",
        );
    });

    it("throws when settings field is missing entirely", () => {
        const bad = makeBackupFile() as any;
        delete bad.settings;
        expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(
            "Settings data is missing",
        );
    });

    // ── screens (optional) ────────────────────────────────────────────────

    it("leaves screens undefined when the field is absent (older backup)", () => {
        const result = parseBackupFile(JSON.stringify(makeBackupFile()));
        expect(result.screens).toBeUndefined();
    });

    it("preserves a valid screens block", () => {
        const backup = makeBackupFile({
            screens: {
                screens: [makeScreen({ id: "a" })],
                activeScreenId: "a",
            },
        });
        const result = parseBackupFile(JSON.stringify(backup));
        expect(result.screens?.screens).toHaveLength(1);
        expect(result.screens?.activeScreenId).toBe("a");
    });

    it("drops malformed screen entries but keeps well-formed ones", () => {
        const backup = {
            ...makeBackupFile(),
            screens: {
                screens: [
                    makeScreen({ id: "a" }),
                    { id: 5 }, // malformed — non-string id, no chapter_id
                    { chapter_id: "gen:003" }, // malformed — no id
                ],
                activeScreenId: "a",
            },
        };
        const result = parseBackupFile(JSON.stringify(backup));
        expect(result.screens?.screens).toHaveLength(1);
        expect(result.screens?.screens[0].id).toBe("a");
    });

    it("defaults a missing history array to empty", () => {
        const backup = {
            ...makeBackupFile(),
            screens: {
                screens: [{ id: "a", chapter_id: "gen:001" }],
                activeScreenId: "a",
            },
        };
        const result = parseBackupFile(JSON.stringify(backup));
        expect(result.screens?.screens[0].history).toEqual([]);
    });

    it("repairs a dangling activeScreenId to the first screen", () => {
        const backup = makeBackupFile({
            screens: {
                screens: [makeScreen({ id: "a" })],
                activeScreenId: "does-not-exist",
            },
        });
        const result = parseBackupFile(JSON.stringify(backup));
        expect(result.screens?.activeScreenId).toBe("a");
    });

    it("drops the screens block when it contains no valid screens", () => {
        const backup = {
            ...makeBackupFile(),
            screens: { screens: [{ nope: true }], activeScreenId: null },
        };
        const result = parseBackupFile(JSON.stringify(backup));
        expect(result.screens).toBeUndefined();
    });

    it("drops the screens block when screens is not an array", () => {
        const backup = {
            ...makeBackupFile(),
            screens: { screens: "oops", activeScreenId: null },
        };
        const result = parseBackupFile(JSON.stringify(backup));
        expect(result.screens).toBeUndefined();
    });

    // Regression: chapter_id is typed as string but is a numeric SQLite id at
    // runtime. A string-only guard silently dropped every real screen.
    it("keeps screens whose chapter_id is a number (real SQLite shape)", () => {
        const backup = {
            ...makeBackupFile(),
            screens: {
                screens: [
                    {
                        id: "scr_1",
                        volume_id: "cc",
                        book_id: "enos",
                        book_chapter: 1,
                        chapter_id: 1368,
                        name: "Enos 1",
                        position: 2,
                        searchTerm: null,
                        history: [],
                    },
                    {
                        id: "scr_2",
                        volume_id: "gl",
                        book_id: "glossary",
                        book_chapter: null,
                        chapter_id: 923,
                        name: "Perfection",
                        position: 2,
                        searchTerm: null,
                        history: [],
                    },
                ],
                activeScreenId: "scr_2",
            },
        };
        const result = parseBackupFile(JSON.stringify(backup));
        expect(result.screens?.screens).toHaveLength(2);
        expect(result.screens?.screens[0].chapter_id).toBe(1368);
        expect(result.screens?.activeScreenId).toBe("scr_2");
    });
});

// ---------------------------------------------------------------------------
// Full round trip (create → parse → restore) with real numeric chapter ids
// ---------------------------------------------------------------------------

describe("backup round trip with numeric chapter ids", () => {
    beforeEach(() => {
        useScreensStore.setState({
            screens: [],
            activeScreenId: null,
            pendingNewScreen: false,
        });
    });

    it("exports and restores screens that use numeric chapter_ids", async () => {
        const screens: any = {
            screens: [
                {
                    id: "scr_a",
                    volume_id: "cc",
                    book_id: "enos",
                    book_chapter: 1,
                    chapter_id: 1368,
                    name: "Enos 1",
                    position: 2,
                    searchTerm: null,
                    history: [],
                },
            ],
            activeScreenId: "scr_a",
        };
        const json = await createBackup(
            makeSettings(),
            async () => [],
            screens,
        );
        const backup = parseBackupFile(json);
        const count = restoreScreens(backup);

        expect(count).toBe(1);
        expect(useScreensStore.getState().screens).toHaveLength(1);
        expect(useScreensStore.getState().screens[0].chapter_id).toBe(1368);
        expect(useScreensStore.getState().activeScreenId).toBe("scr_a");
    });
});

// ---------------------------------------------------------------------------
// restoreScreens
// ---------------------------------------------------------------------------

describe("restoreScreens", () => {
    beforeEach(() => {
        useScreensStore.setState({
            screens: [],
            activeScreenId: null,
            pendingNewScreen: false,
        });
    });

    it("writes the backed-up screens and active id into the store", () => {
        const backup = makeBackupFile({
            screens: {
                screens: [
                    makeScreen({ id: "a" }),
                    makeScreen({ id: "b", chapter_id: "gen:002" }),
                ],
                activeScreenId: "b",
            },
        });
        const count = restoreScreens(backup);
        expect(count).toBe(2);
        expect(useScreensStore.getState().screens).toHaveLength(2);
        expect(useScreensStore.getState().activeScreenId).toBe("b");
    });

    it("replaces any currently-open screens", () => {
        useScreensStore.setState({
            screens: [makeScreen({ id: "old" })],
            activeScreenId: "old",
        });
        const backup = makeBackupFile({
            screens: {
                screens: [makeScreen({ id: "new" })],
                activeScreenId: "new",
            },
        });
        restoreScreens(backup);
        const state = useScreensStore.getState();
        expect(state.screens).toHaveLength(1);
        expect(state.screens[0].id).toBe("new");
        expect(state.activeScreenId).toBe("new");
    });

    it("is a no-op and returns 0 when the backup has no screens block", () => {
        useScreensStore.setState({
            screens: [makeScreen({ id: "keep" })],
            activeScreenId: "keep",
        });
        const count = restoreScreens(makeBackupFile());
        expect(count).toBe(0);
        expect(useScreensStore.getState().screens).toHaveLength(1);
        expect(useScreensStore.getState().activeScreenId).toBe("keep");
    });

    it("clears the pendingNewScreen flag on restore", () => {
        useScreensStore.setState({ pendingNewScreen: true });
        restoreScreens(
            makeBackupFile({
                screens: {
                    screens: [makeScreen({ id: "a" })],
                    activeScreenId: "a",
                },
            }),
        );
        expect(useScreensStore.getState().pendingNewScreen).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// restoreSettings
// ---------------------------------------------------------------------------

describe("restoreSettings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useSettingsStore.getState).mockReturnValue(
            mockActions as unknown as ReturnType<
                typeof useSettingsStore.getState
            >,
        );
    });

    it("calls setFontFamily with the backed-up fontFamily", () => {
        restoreSettings(
            makeBackupFile({
                settings: makeSettings({ fontFamily: "EBGaramond-Regular" }),
            }),
        );
        expect(mockActions.setFontFamily).toHaveBeenCalledWith(
            "EBGaramond-Regular",
        );
    });

    it("calls setFontFamily before overriding fontSize (order check)", () => {
        const callOrder: string[] = [];
        mockActions.setFontFamily.mockImplementation(() =>
            callOrder.push("setFontFamily"),
        );
        vi.mocked(useSettingsStore.setState).mockImplementation(
            (patch: any) => {
                if ("fontSize" in patch) callOrder.push("setState:fontSize");
            },
        );

        restoreSettings(
            makeBackupFile({ settings: makeSettings({ fontSize: 22 }) }),
        );

        expect(callOrder.indexOf("setFontFamily")).toBeLessThan(
            callOrder.indexOf("setState:fontSize"),
        );
    });

    it("overrides fontSize via setState after setFontFamily", () => {
        restoreSettings(
            makeBackupFile({ settings: makeSettings({ fontSize: 22 }) }),
        );
        const calls = vi.mocked(useSettingsStore.setState).mock
            .calls as any[][];
        const fontSizeCall = calls.find((c: any[]) => "fontSize" in c[0]);
        expect(fontSizeCall).toBeDefined();
        expect(fontSizeCall[0].fontSize).toBe(22);
    });

    it("calls changeColorScheme with the three color values", () => {
        const settings = makeSettings({
            backgroundColor: "#1a1a1a",
            foregroundColor: "#f0f0f0",
            markerColor: "#ff6600",
        });
        restoreSettings(makeBackupFile({ settings }));
        expect(mockActions.changeColorScheme).toHaveBeenCalledWith(
            "#1a1a1a",
            "#f0f0f0",
            "#ff6600",
        );
    });

    it("sets isDarkColorScheme via setState", () => {
        restoreSettings(
            makeBackupFile({
                settings: makeSettings({ isDarkColorScheme: true }),
            }),
        );
        const calls = vi.mocked(useSettingsStore.setState).mock
            .calls as any[][];
        const darkCall = calls.find((c: any[]) => "isDarkColorScheme" in c[0]);
        expect(darkCall).toBeDefined();
        expect(darkCall[0].isDarkColorScheme).toBe(true);
    });

    it("calls alignLeft when alignment is 'left'", () => {
        restoreSettings(
            makeBackupFile({ settings: makeSettings({ alignment: "left" }) }),
        );
        expect(mockActions.alignLeft).toHaveBeenCalled();
        expect(mockActions.alignJustify).not.toHaveBeenCalled();
    });

    it("calls alignJustify when alignment is 'justify'", () => {
        restoreSettings(
            makeBackupFile({
                settings: makeSettings({ alignment: "justify" }),
            }),
        );
        expect(mockActions.alignJustify).toHaveBeenCalled();
        expect(mockActions.alignLeft).not.toHaveBeenCalled();
    });

    it("calls alignJustify for any alignment value other than 'left'", () => {
        restoreSettings(
            makeBackupFile({ settings: makeSettings({ alignment: "center" }) }),
        );
        expect(mockActions.alignJustify).toHaveBeenCalled();
    });

    it("calls setLayout with the backed-up layout value", () => {
        restoreSettings(
            makeBackupFile({ settings: makeSettings({ layout: "card" }) }),
        );
        expect(mockActions.setLayout).toHaveBeenCalledWith("card");
    });

    it("calls toggleLEVerses with false when displayLEVerses is false", () => {
        restoreSettings(
            makeBackupFile({
                settings: makeSettings({ displayLEVerses: false }),
            }),
        );
        expect(mockActions.toggleLEVerses).toHaveBeenCalledWith(false);
    });

    it("calls toggleLEVerses with true when displayLEVerses is true", () => {
        restoreSettings(
            makeBackupFile({
                settings: makeSettings({ displayLEVerses: true }),
            }),
        );
        expect(mockActions.toggleLEVerses).toHaveBeenCalledWith(true);
    });

    it("calls setVoice with the backed-up voice", () => {
        restoreSettings(
            makeBackupFile({ settings: makeSettings({ voice: "female2" }) }),
        );
        expect(mockActions.setVoice).toHaveBeenCalledWith("female2");
    });

    it("calls setRate with the backed-up rate", () => {
        restoreSettings(
            makeBackupFile({ settings: makeSettings({ rate: 0.75 }) }),
        );
        expect(mockActions.setRate).toHaveBeenCalledWith(0.75);
    });

    it("calls toggleAutoPlay with true when isAutoPlaying is true", () => {
        restoreSettings(
            makeBackupFile({ settings: makeSettings({ isAutoPlaying: true }) }),
        );
        expect(mockActions.toggleAutoPlay).toHaveBeenCalledWith(true);
    });

    it("sets currentReference via setState when present", () => {
        restoreSettings(
            makeBackupFile({
                settings: makeSettings({ currentReference: "genesis 1:5" }),
            }),
        );
        const calls = vi.mocked(useSettingsStore.setState).mock
            .calls as any[][];
        const refCall = calls.find((c: any[]) => "currentReference" in c[0]);
        expect(refCall).toBeDefined();
        expect(refCall[0].currentReference).toBe("genesis 1:5");
    });

    it("does not set currentReference via setState when currentReference is falsy", () => {
        restoreSettings(
            makeBackupFile({
                settings: makeSettings({ currentReference: null as any }),
            }),
        );
        const calls = vi.mocked(useSettingsStore.setState).mock
            .calls as any[][];
        const refCall = calls.find((c: any[]) => "currentReference" in c[0]);
        expect(refCall).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// restoreHighlights — merge mode
// ---------------------------------------------------------------------------

describe("restoreHighlights (merge)", () => {
    it("does not issue a DELETE before inserting", async () => {
        const mockDb = createMockDb();
        await restoreHighlights(
            makeBackupFile({ highlights: [makeHighlight()] }),
            mockDb as any,
            "merge",
        );
        const deleteCalls = vi
            .mocked(mockDb.runAsync)
            .mock.calls.filter((c: any[]) => String(c[0]).includes("DELETE"));
        expect(deleteCalls).toHaveLength(0);
    });

    it("calls runAsync once per highlight with INSERT OR IGNORE", async () => {
        const mockDb = createMockDb();
        const backup = makeBackupFile({
            highlights: [
                makeHighlight({ id: "a" }),
                makeHighlight({ id: "b" }),
            ],
        });
        await restoreHighlights(backup, mockDb as any, "merge");
        const insertCalls = vi
            .mocked(mockDb.runAsync)
            .mock.calls.filter((c: any[]) =>
                String(c[0]).includes("INSERT OR IGNORE"),
            );
        expect(insertCalls).toHaveLength(2);
    });

    it("passes all thirteen highlight fields as ordered parameters", async () => {
        const mockDb = createMockDb();
        const h = makeHighlight({
            id: "uuid-abc",
            volume_id: "oc",
            book_id: "genesis",
            book_chapter: "3",
            paragraph_position: 5,
            end_paragraph_position: null,
            start_offset: 0,
            end_offset: 12,
            selected_text: "In the beginning",
            color: "#ffccaa",
            created_at: "2026-01-01T00:00:00.000Z",
            modified_at: "2026-02-01T00:00:00.000Z",
        });
        await restoreHighlights(
            makeBackupFile({ highlights: [h] }),
            mockDb as any,
            "merge",
        );
        const [, params] = vi.mocked(mockDb.runAsync).mock.calls[0];
        expect(params).toEqual([
            "uuid-abc",
            "oc",
            "genesis",
            "3",
            5,
            null,
            0,
            12,
            "In the beginning",
            "#ffccaa",
            "highlight",
            "2026-01-01T00:00:00.000Z",
            "2026-02-01T00:00:00.000Z",
        ]);
    });

    it("counts rows with changes > 0 as imported", async () => {
        const mockDb = createMockDb(1);
        const backup = makeBackupFile({
            highlights: [
                makeHighlight({ id: "a" }),
                makeHighlight({ id: "b" }),
            ],
        });
        const result = await restoreHighlights(backup, mockDb as any, "merge");
        expect(result.highlightsImported).toBe(2);
        expect(result.highlightsDuplicate).toBe(0);
    });

    it("counts rows with changes === 0 as duplicates", async () => {
        const mockDb = createMockDb(0);
        const backup = makeBackupFile({
            highlights: [
                makeHighlight({ id: "a" }),
                makeHighlight({ id: "b" }),
            ],
        });
        const result = await restoreHighlights(backup, mockDb as any, "merge");
        expect(result.highlightsImported).toBe(0);
        expect(result.highlightsDuplicate).toBe(2);
    });

    it("returns zero counts when backup has no highlights", async () => {
        const mockDb = createMockDb();
        const result = await restoreHighlights(
            makeBackupFile({ highlights: [] }),
            mockDb as any,
            "merge",
        );
        expect(result.highlightsImported).toBe(0);
        expect(result.highlightsDuplicate).toBe(0);
        expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it("correctly mixes imported and duplicate counts", async () => {
        const mockDb: any = {
            runAsync: vi
                .fn()
                .mockResolvedValueOnce({ changes: 1 }) // a — new
                .mockResolvedValueOnce({ changes: 0 }) // b — duplicate
                .mockResolvedValueOnce({ changes: 1 }), // c — new
        };
        const backup = makeBackupFile({
            highlights: [
                makeHighlight({ id: "a" }),
                makeHighlight({ id: "b" }),
                makeHighlight({ id: "c" }),
            ],
        });
        const result = await restoreHighlights(backup, mockDb, "merge");
        expect(result.highlightsImported).toBe(2);
        expect(result.highlightsDuplicate).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// restoreHighlights — replace mode
// ---------------------------------------------------------------------------

describe("restoreHighlights (replace)", () => {
    it("issues 'DELETE FROM highlights' as the very first call", async () => {
        const mockDb = createMockDb();
        await restoreHighlights(
            makeBackupFile({ highlights: [makeHighlight()] }),
            mockDb as any,
            "replace",
        );
        expect(vi.mocked(mockDb.runAsync).mock.calls[0][0]).toBe(
            "DELETE FROM highlights",
        );
    });

    it("executes DELETE before any INSERT", async () => {
        const callOrder: string[] = [];
        const mockDb: any = {
            runAsync: vi.fn().mockImplementation((sql: string) => {
                callOrder.push(sql.trim().split(/\s+/)[0]);
                return Promise.resolve({ changes: 1 });
            }),
        };
        await restoreHighlights(
            makeBackupFile({ highlights: [makeHighlight()] }),
            mockDb,
            "replace",
        );
        expect(callOrder[0]).toBe("DELETE");
        expect(callOrder[1]).toBe("INSERT");
    });

    it("inserts all highlights after deleting (total calls = 1 DELETE + N inserts)", async () => {
        const mockDb = createMockDb();
        const backup = makeBackupFile({
            highlights: [
                makeHighlight({ id: "a" }),
                makeHighlight({ id: "b" }),
            ],
        });
        const result = await restoreHighlights(
            backup,
            mockDb as any,
            "replace",
        );
        expect(mockDb.runAsync).toHaveBeenCalledTimes(3); // 1 DELETE + 2 INSERT
        expect(result.highlightsImported).toBe(2);
    });

    it("issues DELETE even when backup has zero highlights", async () => {
        const mockDb = createMockDb();
        await restoreHighlights(
            makeBackupFile({ highlights: [] }),
            mockDb as any,
            "replace",
        );
        expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
        expect(mockDb.runAsync).toHaveBeenCalledWith("DELETE FROM highlights");
    });

    it("returns zero counts when backup has no highlights (only DELETE ran)", async () => {
        const mockDb = createMockDb();
        const result = await restoreHighlights(
            makeBackupFile({ highlights: [] }),
            mockDb as any,
            "replace",
        );
        expect(result.highlightsImported).toBe(0);
        expect(result.highlightsDuplicate).toBe(0);
    });
});
