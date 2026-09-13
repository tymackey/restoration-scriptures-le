/**
 * reader.interaction.test.tsx
 *
 * Tests user interaction behaviors in ReaderScreen.
 * Uses react-test-renderer (not RNTL) to avoid the react-native/RNTL circular
 * dependency issue with Vitest's module system.
 *
 * Strategy:
 *   - All native modules are mocked in vitest.setup.ts.
 *   - App-specific hooks/utilities are mocked here.
 *   - The WebView mock (vitest.setup.ts) stores its props in globalThis.__rntl.webViewProps.
 *   - After rendering, tests call webViewProps.onMessage({...}) directly.
 */

import React from "react";
import { create, act } from "react-test-renderer";
import { Alert } from "react-native";

// ── Component under test ──────────────────────────────────────────────────────

import ReaderScreen from "../reader";
import { useScreensStore } from "../../data/useScreensStore";

// Helper: the currently-active screen descriptor in the screens store.
function activeScreen() {
    const state = useScreensStore.getState();
    return state.screens.find((s) => s.id === state.activeScreenId);
}

// ── App-specific mocks ────────────────────────────────────────────────────────

const mockGetChapterText = vi.fn(() =>
    Promise.resolve("<html><body></body></html>"),
);
const mockGetNextChapter = vi.fn(() => Promise.resolve(null));
const mockGetPreviousChapter = vi.fn(() => Promise.resolve(null));
const mockGetChapterByReference = vi.fn(() => Promise.resolve(null));
const mockGetCanonicalBook = vi.fn(() => Promise.resolve("gen"));
const mockGetReferenceBookNames = vi.fn(() => Promise.resolve([]));
const mockAddHighlight = vi.fn(
    (): Promise<string | number> => Promise.resolve(42),
);
const mockGetChapterHighlights = vi.fn(() => Promise.resolve([]));
const mockDeleteHighlight = vi.fn(() => Promise.resolve());
const mockUpdateHighlightColor = vi.fn(() => Promise.resolve());
const mockUpdateHighlightMarkType = vi.fn(() => Promise.resolve());

vi.mock("../../data/useDatabase", () => ({
    useDatabase: () => ({
        getChapterText: mockGetChapterText,
        getNextChapter: mockGetNextChapter,
        getPreviousChapter: mockGetPreviousChapter,
        getChapterByReference: mockGetChapterByReference,
        getCanonicalBook: mockGetCanonicalBook,
        getReferenceBookNames: mockGetReferenceBookNames,
        addHighlight: mockAddHighlight,
        getChapterHighlights: mockGetChapterHighlights,
        deleteHighlight: mockDeleteHighlight,
        updateHighlightColor: mockUpdateHighlightColor,
        updateHighlightMarkType: mockUpdateHighlightMarkType,
    }),
}));

const mockSetCurrentReference = vi.fn();
const mockToggleBottomMenu = vi.fn();
const mockToggleAudioModal = vi.fn();
const mockToggleAutoPlay = vi.fn();
const mockSetFontSize = vi.fn();

const mockSettings = {
    backgroundColor: "#ffffff",
    foregroundColor: "#000000",
    markerColor: "#ff9900",
    fontSize: 18,
    alignment: "left",
    fontFamily: "EBGaramond",
    isBottomMenuOpen: false,
    toggleBottomMenu: mockToggleBottomMenu,
    displayLEVerses: true,
    isAutoPlaying: false,
    toggleAutoPlay: mockToggleAutoPlay,
    isAudioModalOpen: false,
    toggleAudioModal: mockToggleAudioModal,
    voice: "male",
    rate: 1.0,
    currentReference: "gen:001:0",
    setCurrentReference: mockSetCurrentReference,
    setFontSize: mockSetFontSize,
};

vi.mock("../../data/useSettingsStore", () => ({
    useSettingsStore: (selector: any) => {
        if (typeof selector === "function") return selector(mockSettings);
        return mockSettings;
    },
}));

vi.mock("../../util/TrackPlayer", () => ({
    waitForPlayer: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    clearQueue: vi.fn(() => Promise.resolve()),
    updateNotificationVisibility: vi.fn(() => Promise.resolve()),
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(() => Promise.resolve()),
    queueChapter: vi.fn(() => Promise.resolve()),
    setRate: vi.fn(() => Promise.resolve()),
    getActiveTrackIndex: vi.fn(() => Promise.resolve(0)),
    getProgress: vi.fn(() =>
        Promise.resolve({ position: 0, duration: 0, buffered: 0 }),
    ),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock("../../util/HtmlProcessor", () => ({
    HtmlProcessor: {
        processHtml: vi.fn(() =>
            Promise.resolve("<html><body><chapter></chapter></body></html>"),
        ),
    },
}));

vi.mock("../../util/ImageUtils", () => ({
    preloadImagesFromHTML: vi.fn(() => Promise.resolve({})),
    getImageSource: vi.fn(() => null),
}));

vi.mock("../../util/FontLoader", () => ({
    getFontsBaseUrl: () => "",
    getFontFaceCss: vi.fn(() => Promise.resolve("")),
}));

vi.mock("../../util/HistoryStorage", () => ({
    addToHistory: vi.fn(),
}));

vi.mock("../../util/SelectionHandler", () => ({
    SelectionHandler: {
        generateSelectionScript: vi.fn(() => "selection-script"),
        generateModalScript: vi.fn(() => "modal-script"),
        generateApplyHighlightsScript: vi.fn(() => "apply-highlights-script"),
        generateRemoveHighlightsScript: vi.fn(() => "remove-highlights-script"),
    },
}));

vi.mock("../../util/ScrollTracker", () => ({
    ScrollTracker: {
        generateScrollTrackingScript: vi.fn(() => "scroll-tracking-script"),
        generateCleanupScript: vi.fn(() => "cleanup-script"),
    },
}));

vi.mock("../../components/AudioControlModal", () => ({
    default: () => null,
}));

vi.mock("../../components/ImageZoomModal", () => ({
    ImageZoomModal: () => null,
    default: () => null,
}));

vi.mock("../../components/DisplayOptions", () => ({
    default: () => null,
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

const mockRoute = {
    params: {
        chapter_id: "gen:001",
        book_id: "gen",
        book_chapter: 1,
        volume_id: "oc",
        name: "Genesis 1",
        position: 0,
        searchTerm: null,
    },
};

const mockNavigation = {
    push: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
    setOptions: vi.fn(),
    addListener: vi.fn(() => ({ remove: vi.fn() })),
};

function getWebViewProps(): Record<string, any> {
    const props = (globalThis as any).__rntl?.webViewProps;
    if (!props) throw new Error("WebView was not rendered — check mocks");
    return props;
}

async function renderReader() {
    await act(async () => {
        create(
            React.createElement(ReaderScreen, {
                route: mockRoute,
                navigation: mockNavigation,
            }),
        );
    });
}

async function simulateMessage(data: Record<string, any>) {
    const { onMessage } = getWebViewProps();
    await act(async () => {
        onMessage({ nativeEvent: { data: JSON.stringify(data) } });
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ReaderScreen — onMessage interactions", () => {
    beforeAll(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        (globalThis as any).__rntl.webViewProps = null;
        mockGetChapterText.mockResolvedValue("<html><body></body></html>");
        mockGetChapterHighlights.mockResolvedValue([]);
        mockGetNextChapter.mockResolvedValue(null);
        mockGetPreviousChapter.mockResolvedValue(null);
        mockSettings.fontSize = 18;
        // Start each test with a clean screens store so the reader reconciles
        // mockRoute into a single fresh screen with empty history.
        useScreensStore.setState({
            screens: [],
            activeScreenId: null,
            pendingNewScreen: false,
        });
    });

    // ── Render sanity ───────────────────────────────────────────────────────

    describe("rendering", () => {
        it("renders without crashing", async () => {
            await renderReader();
            expect(getWebViewProps()).not.toBeNull();
        });

        it("WebView onMessage is a function", async () => {
            await renderReader();
            expect(typeof getWebViewProps().onMessage).toBe("function");
        });

        // Regression: "Close All Screens" clears the active screen while the
        // reader is still mounted. When the reader was entered via launch-restore
        // it has no route.params, so params fell back to `undefined` and reading
        // `params.searchTerm` threw, blanking the whole tree.
        it("does not crash with no active screen and no route params", async () => {
            await act(async () => {
                create(
                    React.createElement(ReaderScreen, {
                        route: { params: undefined },
                        navigation: mockNavigation,
                    }),
                );
            });
            // No active screen was created and nothing threw during render.
            expect(useScreensStore.getState().activeScreenId).toBeNull();
        });

        it("does not crash when the active screen is closed while mounted", async () => {
            await renderReader();
            await act(async () => {});
            expect(useScreensStore.getState().screens).toHaveLength(1);

            // Simulate "Close All Screens" clearing state under the mounted reader.
            await act(async () => {
                useScreensStore.getState().closeAllScreens();
            });

            expect(useScreensStore.getState().screens).toHaveLength(0);
            expect(useScreensStore.getState().activeScreenId).toBeNull();
        });
    });

    // ── Screen reconciliation ─────────────────────────────────────────────────

    describe("screen reconciliation", () => {
        it("creates a single active screen from route.params on first entry", async () => {
            await renderReader();
            await act(async () => {});

            expect(useScreensStore.getState().screens).toHaveLength(1);
            const active = activeScreen();
            expect(active?.chapter_id).toBe("gen:001");
            expect(active?.volume_id).toBe("oc");
            expect(active?.name).toBe("Genesis 1");
        });

        it("opens a NEW screen when pendingNewScreen is set", async () => {
            // An existing screen on a different chapter is already open.
            useScreensStore.getState().openScreen({
                volume_id: "bofm",
                book_id: "alma",
                book_chapter: 5,
                chapter_id: "alma:005",
                name: "Alma 5",
                position: 0,
            });
            useScreensStore.getState().setPendingNewScreen(true);

            await renderReader();
            await act(async () => {});

            // Route chapter (gen:001) became a second, active screen.
            expect(useScreensStore.getState().screens).toHaveLength(2);
            expect(activeScreen()?.chapter_id).toBe("gen:001");
            expect(useScreensStore.getState().pendingNewScreen).toBe(false);
        });

        it("reuses the active screen when pendingNewScreen is not set", async () => {
            useScreensStore.getState().openScreen({
                volume_id: "bofm",
                book_id: "alma",
                book_chapter: 5,
                chapter_id: "alma:005",
                name: "Alma 5",
                position: 0,
            });

            await renderReader();
            await act(async () => {});

            // The single existing screen was navigated to gen:001 in place.
            expect(useScreensStore.getState().screens).toHaveLength(1);
            expect(activeScreen()?.chapter_id).toBe("gen:001");
        });
    });

    // ── colorSelect — saving a new highlight ────────────────────────────────

    describe("colorSelect — new highlight", () => {
        const rangeData = {
            paragraphPosition: 3,
            paragraphStartOffset: 2,
            paragraphEndOffset: 11,
            selectedText: "the earth",
        };

        it('calls addHighlight with correct args and mark_type "highlight"', async () => {
            mockAddHighlight.mockResolvedValue("new-id");
            await renderReader();
            await simulateMessage({
                type: "colorSelect",
                color: "hsl(50,100%,26%)",
                markType: "highlight",
                isEditing: false,
                rangeData,
            });
            await act(async () => {});

            expect(mockAddHighlight).toHaveBeenCalledWith(
                "oc",
                "gen",
                "1",
                3,
                2,
                11,
                "the earth",
                "hsl(50,100%,26%)",
                "highlight",
                null,
            );
        });

        it('calls addHighlight with mark_type "underline" when underline mode is active', async () => {
            mockAddHighlight.mockResolvedValue("new-id");
            await renderReader();
            await simulateMessage({
                type: "colorSelect",
                color: "hsl(217,85%,34%)",
                markType: "underline",
                isEditing: false,
                rangeData,
            });
            await act(async () => {});

            expect(mockAddHighlight).toHaveBeenCalledWith(
                "oc",
                "gen",
                "1",
                3,
                2,
                11,
                "the earth",
                "hsl(217,85%,34%)",
                "underline",
                null,
            );
        });

        it('defaults mark_type to "highlight" when markType is absent', async () => {
            mockAddHighlight.mockResolvedValue("new-id");
            await renderReader();
            await simulateMessage({
                type: "colorSelect",
                color: "hsl(96,57%,20%)",
                isEditing: false,
                rangeData,
            });
            await act(async () => {});

            expect(mockAddHighlight).toHaveBeenCalledWith(
                "oc",
                "gen",
                "1",
                3,
                2,
                11,
                "the earth",
                "hsl(96,57%,20%)",
                "highlight",
                null,
            );
        });

        it("calls getChapterHighlights after saving", async () => {
            mockAddHighlight.mockResolvedValue("new-id");
            mockGetChapterHighlights.mockResolvedValue([]);
            await renderReader();
            await simulateMessage({
                type: "colorSelect",
                color: "hsl(50,100%,26%)",
                markType: "highlight",
                isEditing: false,
                rangeData,
            });
            await act(async () => {});

            expect(mockGetChapterHighlights).toHaveBeenCalledWith(
                "oc",
                "gen",
                "1",
            );
        });

        it("does not call addHighlight when rangeData is absent", async () => {
            await renderReader();
            await simulateMessage({
                type: "colorSelect",
                color: "hsl(50,100%,26%)",
                markType: "highlight",
                isEditing: false,
            });
            await act(async () => {});

            expect(mockAddHighlight).not.toHaveBeenCalled();
        });
    });

    // ── navigation ──────────────────────────────────────────────────────────

    describe("navigation direction", () => {
        it('direction "next" with available chapter updates the active screen', async () => {
            const nextChapter = {
                chapter_id: "gen:002",
                book_id: "gen",
                book_chapter: 2,
                volume_id: "oc",
                name: "Genesis 2",
                position: 0,
            };
            mockGetNextChapter.mockResolvedValue(nextChapter);

            await renderReader();
            await simulateMessage({ type: "navigation", direction: "next" });
            await act(async () => {});

            expect(mockGetNextChapter).toHaveBeenCalledWith(
                "gen:001",
                "gen",
                1,
            );
            // Within-reader navigation stays on the same screen (no route push)
            // and updates the active screen's chapter in place.
            expect(mockNavigation.push).not.toHaveBeenCalled();
            const active = activeScreen();
            expect(active?.chapter_id).toBe("gen:002");
            expect(active?.name).toBe("Genesis 2");
            // Previous chapter is retained for the Back button.
            expect(active?.history.at(-1)?.chapter_id).toBe("gen:001");
        });

        // Regression: within-reader navigation updates the store, not
        // route.params. next/prev must compute the neighbour from the CURRENT
        // chapter (the store-derived params), not the stale route.params that is
        // frozen at the first-opened chapter.
        it("computes the next chapter from the current chapter after navigating within the screen", async () => {
            mockGetNextChapter
                .mockResolvedValueOnce({
                    chapter_id: "gen:002",
                    book_id: "gen",
                    book_chapter: 2,
                    volume_id: "oc",
                    name: "Genesis 2",
                    position: 0,
                })
                .mockResolvedValueOnce({
                    chapter_id: "gen:003",
                    book_id: "gen",
                    book_chapter: 3,
                    volume_id: "oc",
                    name: "Genesis 3",
                    position: 0,
                });

            await renderReader();

            // First advance: gen:001 -> gen:002.
            await simulateMessage({ type: "navigation", direction: "next" });
            await act(async () => {});
            expect(activeScreen()?.chapter_id).toBe("gen:002");

            // Second advance must be computed from gen:002 (current), not the
            // stale route.params which is still gen:001.
            await simulateMessage({ type: "navigation", direction: "next" });
            await act(async () => {});

            expect(mockGetNextChapter).toHaveBeenLastCalledWith(
                "gen:002",
                "gen",
                2,
            );
            expect(activeScreen()?.chapter_id).toBe("gen:003");
        });

        it('direction "next" with no next chapter leaves the active screen unchanged', async () => {
            mockGetNextChapter.mockResolvedValue(null);

            await renderReader();
            await simulateMessage({ type: "navigation", direction: "next" });
            await act(async () => {});

            expect(mockNavigation.push).not.toHaveBeenCalled();
            expect(activeScreen()?.chapter_id).toBe("gen:001");
            expect(activeScreen()?.history).toHaveLength(0);
        });

        it('direction "previous" with available chapter updates the active screen', async () => {
            const prevChapter = {
                chapter_id: "gen:000",
                book_id: "gen",
                book_chapter: 0,
                volume_id: "oc",
                name: "Genesis Intro",
                position: 0,
            };
            mockGetPreviousChapter.mockResolvedValue(prevChapter);

            await renderReader();
            await simulateMessage({
                type: "navigation",
                direction: "previous",
            });
            await act(async () => {});

            expect(mockGetPreviousChapter).toHaveBeenCalledWith(
                "gen:001",
                "gen",
                1,
            );
            expect(mockNavigation.push).not.toHaveBeenCalled();
            const active = activeScreen();
            expect(active?.chapter_id).toBe("gen:000");
            expect(active?.name).toBe("Genesis Intro");
            expect(active?.history.at(-1)?.chapter_id).toBe("gen:001");
        });

        it('direction "previous" with no previous chapter leaves the active screen unchanged', async () => {
            mockGetPreviousChapter.mockResolvedValue(null);

            await renderReader();
            await simulateMessage({
                type: "navigation",
                direction: "previous",
            });
            await act(async () => {});

            expect(mockNavigation.push).not.toHaveBeenCalled();
            expect(activeScreen()?.chapter_id).toBe("gen:001");
            expect(activeScreen()?.history).toHaveLength(0);
        });

        it("unknown direction does not trigger navigation", async () => {
            await renderReader();
            await simulateMessage({
                type: "navigation",
                direction: "sideways",
            });
            await act(async () => {});

            expect(mockNavigation.push).not.toHaveBeenCalled();
        });
    });

    // ── scroll ──────────────────────────────────────────────────────────────

    describe("scroll position tracking", () => {
        it("calls setCurrentReference when position changes", async () => {
            await renderReader();
            mockSetCurrentReference.mockClear();

            await simulateMessage({ type: "scroll", position: 5 });

            expect(mockSetCurrentReference).toHaveBeenCalledWith("gen", 1, 5);
        });

        it("does not call setCurrentReference when position is same as current", async () => {
            await renderReader();

            await simulateMessage({ type: "scroll", position: 5 });
            mockSetCurrentReference.mockClear();

            // Same position again — should be a no-op
            await simulateMessage({ type: "scroll", position: 5 });

            expect(mockSetCurrentReference).not.toHaveBeenCalled();
        });

        it("does not call setCurrentReference when scroll has no position", async () => {
            await renderReader();
            mockSetCurrentReference.mockClear();

            await simulateMessage({ type: "scroll" });

            expect(mockSetCurrentReference).not.toHaveBeenCalled();
        });
    });

    // ── colorSelect — editing an existing highlight ─────────────────────────

    describe("colorSelect — editing existing highlight", () => {
        it("calls updateHighlightColor with id, color, and mark_type", async () => {
            mockUpdateHighlightColor.mockResolvedValue(undefined);
            await renderReader();
            await simulateMessage({
                type: "colorSelect",
                color: "hsl(267,75%,31%)",
                markType: "underline",
                isEditing: true,
                highlightId: "existing-uuid",
            });
            await act(async () => {});

            expect(mockUpdateHighlightColor).toHaveBeenCalledWith(
                "existing-uuid",
                "hsl(267,75%,31%)",
                "underline",
            );
        });

        it("calls updateHighlightColor when switching back to highlight mode", async () => {
            mockUpdateHighlightColor.mockResolvedValue(undefined);
            await renderReader();
            await simulateMessage({
                type: "colorSelect",
                color: "hsl(0,100%,27%)",
                markType: "highlight",
                isEditing: true,
                highlightId: "existing-uuid",
            });
            await act(async () => {});

            expect(mockUpdateHighlightColor).toHaveBeenCalledWith(
                "existing-uuid",
                "hsl(0,100%,27%)",
                "highlight",
            );
        });

        it("calls getChapterHighlights after updating", async () => {
            mockUpdateHighlightColor.mockResolvedValue(undefined);
            mockGetChapterHighlights.mockResolvedValue([]);
            await renderReader();
            await simulateMessage({
                type: "colorSelect",
                color: "hsl(50,100%,26%)",
                markType: "highlight",
                isEditing: true,
                highlightId: "existing-uuid",
            });
            await act(async () => {});

            expect(mockGetChapterHighlights).toHaveBeenCalledWith(
                "oc",
                "gen",
                "1",
            );
        });

        it("does not call addHighlight when isEditing is true", async () => {
            mockUpdateHighlightColor.mockResolvedValue(undefined);
            await renderReader();
            await simulateMessage({
                type: "colorSelect",
                color: "hsl(50,100%,26%)",
                markType: "highlight",
                isEditing: true,
                highlightId: "existing-uuid",
            });
            await act(async () => {});

            expect(mockAddHighlight).not.toHaveBeenCalled();
        });
    });

    // ── updateMarkType — live underline/highlight toggle ────────────────────

    describe("updateMarkType", () => {
        it("calls updateHighlightMarkType with the highlight id and new mark type", async () => {
            mockUpdateHighlightMarkType.mockResolvedValue(undefined);
            await renderReader();
            await simulateMessage({
                type: "updateMarkType",
                highlightId: "existing-uuid",
                markType: "underline",
            });
            await act(async () => {});

            expect(mockUpdateHighlightMarkType).toHaveBeenCalledWith(
                "existing-uuid",
                "underline",
            );
        });

        it("calls updateHighlightMarkType when toggling back to highlight", async () => {
            mockUpdateHighlightMarkType.mockResolvedValue(undefined);
            await renderReader();
            await simulateMessage({
                type: "updateMarkType",
                highlightId: "existing-uuid",
                markType: "highlight",
            });
            await act(async () => {});

            expect(mockUpdateHighlightMarkType).toHaveBeenCalledWith(
                "existing-uuid",
                "highlight",
            );
        });

        it("does not crash when updateHighlightMarkType throws", async () => {
            mockUpdateHighlightMarkType.mockRejectedValue(
                new Error("DB error"),
            );
            await renderReader();

            await expect(
                simulateMessage({
                    type: "updateMarkType",
                    highlightId: "bad-id",
                    markType: "underline",
                }),
            ).resolves.not.toThrow();
        });
    });

    // ── deleteHighlight (modal Remove button) ───────────────────────────────

    describe("deleteHighlight — modal Remove button", () => {
        it("calls deleteHighlight with the given id", async () => {
            mockDeleteHighlight.mockResolvedValue(undefined);
            await renderReader();
            await simulateMessage({
                type: "deleteHighlight",
                highlightId: "remove-uuid",
            });
            await act(async () => {});

            expect(mockDeleteHighlight).toHaveBeenCalledWith("remove-uuid");
        });

        it("reloads chapter highlights after deletion", async () => {
            mockDeleteHighlight.mockResolvedValue(undefined);
            mockGetChapterHighlights.mockResolvedValue([]);
            await renderReader();
            await simulateMessage({
                type: "deleteHighlight",
                highlightId: "remove-uuid",
            });
            await act(async () => {});

            expect(mockGetChapterHighlights).toHaveBeenCalledWith(
                "oc",
                "gen",
                "1",
            );
        });

        it("does not crash when deleteHighlight throws", async () => {
            mockDeleteHighlight.mockRejectedValue(new Error("DB error"));
            await renderReader();

            await expect(
                simulateMessage({
                    type: "deleteHighlight",
                    highlightId: "bad-id",
                }),
            ).resolves.not.toThrow();
        });
    });

    // ── searchText (modal Search button) ────────────────────────────────────

    describe("searchText — modal Search button", () => {
        it("navigates to Search screen with the selected text as initialQuery", async () => {
            await renderReader();
            await simulateMessage({
                type: "searchText",
                text: "faith and works",
            });
            await act(async () => {});

            expect(mockNavigation.navigate).toHaveBeenCalledWith("Search", {
                initialQuery: "faith and works",
            });
        });

        it("does not navigate when text is absent", async () => {
            await renderReader();
            await simulateMessage({ type: "searchText" });
            await act(async () => {});

            expect(mockNavigation.navigate).not.toHaveBeenCalled();
        });

        it("does not navigate when text is an empty string", async () => {
            await renderReader();
            await simulateMessage({ type: "searchText", text: "" });
            await act(async () => {});

            expect(mockNavigation.navigate).not.toHaveBeenCalled();
        });
    });

    // ── modalClosed (Copy button) ────────────────────────────────────────────

    describe("modalClosed — Copy button", () => {
        it("does not call any DB function (copy is handled entirely in-WebView)", async () => {
            await renderReader();
            await simulateMessage({ type: "modalClosed" });
            await act(async () => {});

            expect(mockAddHighlight).not.toHaveBeenCalled();
            expect(mockDeleteHighlight).not.toHaveBeenCalled();
            expect(mockUpdateHighlightColor).not.toHaveBeenCalled();
            expect(mockUpdateHighlightMarkType).not.toHaveBeenCalled();
        });

        it("does not navigate to any screen", async () => {
            await renderReader();
            await simulateMessage({ type: "modalClosed" });
            await act(async () => {});

            expect(mockNavigation.navigate).not.toHaveBeenCalled();
            expect(mockNavigation.push).not.toHaveBeenCalled();
        });
    });

    // ── link ────────────────────────────────────────────────────────────────

    describe("link navigation", () => {
        it("navigates the active screen to the chapter from a link href", async () => {
            const chapterData = { chapter_id: "gen:009", name: "Genesis 9" };
            mockGetChapterByReference.mockResolvedValue(chapterData);

            await renderReader();
            await simulateMessage({ type: "link", href: "/link/oc/gen/9" });
            await act(async () => {});

            expect(mockGetChapterByReference).toHaveBeenCalledWith("gen", "9");
            // Link taps navigate within the active screen (no route push).
            expect(mockNavigation.push).not.toHaveBeenCalled();
            const active = activeScreen();
            expect(active?.chapter_id).toBe("gen:009");
            expect(active?.name).toBe("Genesis 9");
            expect(active?.volume_id).toBe("oc");
            expect(active?.book_id).toBe("gen");
            expect(active?.book_chapter).toBe(9);
            // Previous chapter retained for Back.
            expect(active?.history.at(-1)?.chapter_id).toBe("gen:001");
        });

        it("does not navigate when chapter is not found", async () => {
            mockGetChapterByReference.mockResolvedValue(null);

            await renderReader();
            await simulateMessage({
                type: "link",
                href: "/link/oc/missing/99",
            });
            await act(async () => {});

            expect(mockNavigation.push).not.toHaveBeenCalled();
            // Active screen is unchanged.
            expect(activeScreen()?.chapter_id).toBe("gen:001");
            expect(activeScreen()?.history).toHaveLength(0);
        });

        it("passes position from href anchor to the active screen", async () => {
            const chapterData = { chapter_id: "gen:009", name: "Genesis 9" };
            mockGetChapterByReference.mockResolvedValue(chapterData);

            await renderReader();
            await simulateMessage({ type: "link", href: "/link/oc/gen/9.5" });
            await act(async () => {});

            // The href anchor "5" becomes the restored paragraph position.
            expect(activeScreen()?.position).toBe(5);
        });
    });

    // ── error handling ───────────────────────────────────────────────────────

    describe("error handling", () => {
        it("does not throw when onMessage receives invalid JSON", async () => {
            await renderReader();
            const { onMessage } = getWebViewProps();

            expect(() => {
                act(() => {
                    onMessage({ nativeEvent: { data: "not-json" } });
                });
            }).not.toThrow();
        });

        it("does not throw when onMessage receives empty data", async () => {
            await renderReader();
            const { onMessage } = getWebViewProps();

            expect(() => {
                act(() => {
                    onMessage({ nativeEvent: { data: "" } });
                });
            }).not.toThrow();
        });

        it("does not throw when onMessage receives unknown type", async () => {
            await renderReader();

            await expect(
                simulateMessage({ type: "unknownType", payload: "whatever" }),
            ).resolves.not.toThrow();
        });
    });

    // ── RESTORATION-SCRIPTURES-9: waitForPlayer guards audio calls ──────────
    //
    // Bug: handleAudioModalVisibility called TrackPlayer.clearQueue (and other
    // methods) immediately on focus, before registerPlayService() had finished
    // initialising the native player, producing "The player is not initialized."
    //
    // Fix: await TrackPlayer.waitForPlayer() as the first line of
    // handleAudioModalVisibility so every subsequent call is gated on setup.

    describe("waitForPlayer guard — RESTORATION-SCRIPTURES-9", () => {
        it("calls waitForPlayer when the reader screen gains focus", async () => {
            const TrackPlayer = await import("../../util/TrackPlayer");
            await renderReader();
            expect(TrackPlayer.waitForPlayer).toHaveBeenCalled();
        });

        it("calls waitForPlayer before clearQueue on each focus", async () => {
            const TrackPlayer = await import("../../util/TrackPlayer");

            const callOrder: string[] = [];
            vi.mocked(TrackPlayer.waitForPlayer).mockImplementation(
                async () => {
                    callOrder.push("waitForPlayer");
                },
            );
            vi.mocked(TrackPlayer.clearQueue).mockImplementation(async () => {
                callOrder.push("clearQueue");
                return undefined as any;
            });

            await renderReader();

            expect(callOrder.indexOf("waitForPlayer")).toBeLessThan(
                callOrder.indexOf("clearQueue"),
            );
        });

        it("clearQueue is called after waitForPlayer resolves, not before", async () => {
            const TrackPlayer = await import("../../util/TrackPlayer");

            let setupFinished = false;
            vi.mocked(TrackPlayer.waitForPlayer).mockImplementation(
                async () => {
                    // Simulate setup taking time
                    await Promise.resolve();
                    setupFinished = true;
                },
            );
            vi.mocked(TrackPlayer.clearQueue).mockImplementation(async () => {
                // At this point setup must already be done
                expect(setupFinished).toBe(true);
                return undefined as any;
            });

            await renderReader();

            expect(TrackPlayer.clearQueue).toHaveBeenCalled();
        });

        it("waitForPlayer is called even when isAudioModalOpen is false", async () => {
            // The race happens on every focus, not just when the modal is open.
            // clearQueue is called unconditionally before the isAudioModalOpen check.
            const TrackPlayer = await import("../../util/TrackPlayer");

            // Default mockSettings has isAudioModalOpen: false
            await renderReader();

            expect(TrackPlayer.waitForPlayer).toHaveBeenCalled();
            expect(TrackPlayer.clearQueue).toHaveBeenCalled();
        });
    });
});
