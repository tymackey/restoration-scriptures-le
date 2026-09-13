/**
 * annotations.test.tsx
 *
 * Component tests for AnnotationsScreen.
 * Uses react-test-renderer (same pattern as reader.interaction.test.tsx) to
 * avoid the RNTL/Vitest circular dependency issue.
 *
 * Strategy:
 *   - useDatabase and @expo/vector-icons are mocked.
 *   - useFocusEffect (mocked in vitest.setup.ts) executes the callback via
 *     React.useEffect, so loadAnnotations is called on every mount.
 *   - FlatList is mocked as the string 'FlatList'; items are rendered by
 *     calling renderItem directly from the FlatList's captured props.
 *   - Alert.alert is already mocked in vitest.setup.ts as vi.fn().
 */

import React from "react";
import { create, act } from "react-test-renderer";
import { Alert } from "react-native";
import type { AnnotationItem } from "../../data/UserDatabaseSchema";

// ── Component under test ──────────────────────────────────────────────────────

import AnnotationsScreen from "../annotations";

// ── App-specific mocks ────────────────────────────────────────────────────────

const mockGetAnnotationsByType = vi.fn(
    (_type: string): Promise<AnnotationItem[]> => Promise.resolve([]),
);
const mockDeleteHighlight = vi.fn(() => Promise.resolve());
const mockDeleteAllAnnotationsByType = vi.fn(() => Promise.resolve());

vi.mock("../../data/useDatabase", () => ({
    useDatabase: () => ({
        getAnnotationsByType: mockGetAnnotationsByType,
        deleteHighlight: mockDeleteHighlight,
        deleteAllAnnotationsByType: mockDeleteAllAnnotationsByType,
    }),
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

const mockNavigation = { navigate: vi.fn() };

function makeAnnotationItem(
    overrides: Partial<AnnotationItem> = {},
): AnnotationItem {
    return {
        id: "test-uuid-1",
        volume_id: "oc",
        book_id: "genesis",
        book_chapter: "1",
        paragraph_position: 3,
        start_offset: 10,
        end_offset: 26,
        selected_text: "In the beginning",
        color: "#FFFF00",
        mark_type: "highlight",
        created_at: "2024-01-01T00:00:00",
        modified_at: "2024-01-01T00:00:00",
        end_paragraph_position: null,
        book_name: "Genesis",
        chapter_id: 4,
        chapter_name: "Genesis 1",
        volume_name: "Old Covenants",
        ...overrides,
    };
}

async function renderAnnotations(
    highlights: AnnotationItem[] = [],
    underlines: AnnotationItem[] = [],
) {
    mockGetAnnotationsByType.mockImplementation((type: string) =>
        Promise.resolve(type === "highlight" ? highlights : underlines),
    );
    let renderer: any;
    await act(async () => {
        renderer = create(
            React.createElement(AnnotationsScreen, {
                navigation: mockNavigation,
            }),
        );
    });
    await act(async () => {}); // flush async state updates from loadAnnotations
    return renderer;
}

/** Find all nodes of a given host-component string type in the rendered tree. */
function findAll(renderer: any, type: string): any[] {
    return renderer.root.findAll((node: any) => node.type === type);
}

/** Find the first Text node whose children prop equals the given string. */
function findTextWithContent(renderer: any, content: string): any {
    return renderer.root.findAll(
        (node: any) => node.type === "Text" && node.props.children === content,
    )[0];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AnnotationsScreen", () => {
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
        mockGetAnnotationsByType.mockResolvedValue([]);
    });

    // ── Initial load ─────────────────────────────────────────────────────────

    describe("initial load", () => {
        it("renders without crashing", async () => {
            const renderer = await renderAnnotations();
            expect(renderer).toBeDefined();
        });

        it('calls getAnnotationsByType for "highlight" on mount', async () => {
            await renderAnnotations();
            expect(mockGetAnnotationsByType).toHaveBeenCalledWith("highlight");
        });

        it('calls getAnnotationsByType for "underline" on mount', async () => {
            await renderAnnotations();
            expect(mockGetAnnotationsByType).toHaveBeenCalledWith("underline");
        });

        it("calls getAnnotationsByType exactly twice on mount", async () => {
            await renderAnnotations();
            expect(mockGetAnnotationsByType).toHaveBeenCalledTimes(2);
        });
    });

    // ── Empty state ───────────────────────────────────────────────────────────

    describe("empty state", () => {
        it('shows "No Highlights" when there are no highlights', async () => {
            const renderer = await renderAnnotations([], []);
            expect(
                findTextWithContent(renderer, "No Highlights"),
            ).toBeDefined();
        });

        it("does not render a FlatList when highlights list is empty", async () => {
            const renderer = await renderAnnotations([], []);
            const flatLists = findAll(renderer, "FlatList");
            expect(flatLists).toHaveLength(0);
        });

        it('shows "No Underlines" when the underline tab is active and there are no underlines', async () => {
            const renderer = await renderAnnotations([], []);
            // Switch to the underline tab
            const tabs = findAll(renderer, "TouchableOpacity");
            await act(async () => {
                tabs[1].props.onPress();
            });
            expect(
                findTextWithContent(renderer, "No Underlines"),
            ).toBeDefined();
        });
    });

    // ── Tab bar ───────────────────────────────────────────────────────────────

    describe("tab bar", () => {
        it("renders both Highlights and Underlines tab labels", async () => {
            const renderer = await renderAnnotations();
            expect(findTextWithContent(renderer, "Highlights")).toBeDefined();
            expect(findTextWithContent(renderer, "Underlines")).toBeDefined();
        });

        it('defaults to the Highlights tab (shows "No Highlights" empty state)', async () => {
            const renderer = await renderAnnotations([], []);
            expect(
                findTextWithContent(renderer, "No Highlights"),
            ).toBeDefined();
        });

        it("switching to underline tab changes the active list to underlines", async () => {
            const highlight = makeAnnotationItem({
                id: "h1",
                mark_type: "highlight",
            });
            const underline = makeAnnotationItem({
                id: "u1",
                mark_type: "underline",
                selected_text: "underlined text",
            });

            const renderer = await renderAnnotations([highlight], [underline]);

            // Initial: FlatList rendered with highlights
            const flatListsBefore = findAll(renderer, "FlatList");
            expect(flatListsBefore[0].props.data).toEqual([highlight]);

            // Switch to underline tab
            const tabs = findAll(renderer, "TouchableOpacity");
            await act(async () => {
                tabs[1].props.onPress();
            });

            const flatListsAfter = findAll(renderer, "FlatList");
            expect(flatListsAfter[0].props.data).toEqual([underline]);
        });

        it("switching back to highlight tab restores the highlights list", async () => {
            const highlight = makeAnnotationItem({
                id: "h1",
                mark_type: "highlight",
            });
            const renderer = await renderAnnotations([highlight], []);

            const tabs = findAll(renderer, "TouchableOpacity");
            // Switch to underline
            await act(async () => {
                tabs[1].props.onPress();
            });
            // Switch back to highlight
            await act(async () => {
                tabs[0].props.onPress();
            });

            const flatLists = findAll(renderer, "FlatList");
            expect(flatLists[0].props.data).toEqual([highlight]);
        });
    });

    // ── FlatList data ─────────────────────────────────────────────────────────

    describe("FlatList data", () => {
        it("renders a FlatList when there are highlights", async () => {
            const item = makeAnnotationItem();
            const renderer = await renderAnnotations([item], []);
            const flatLists = findAll(renderer, "FlatList");
            expect(flatLists).toHaveLength(1);
        });

        it("FlatList receives the highlights as data", async () => {
            const item1 = makeAnnotationItem({
                id: "h1",
                paragraph_position: 1,
            });
            const item2 = makeAnnotationItem({
                id: "h2",
                paragraph_position: 2,
            });
            const renderer = await renderAnnotations([item1, item2], []);
            const flatList = findAll(renderer, "FlatList")[0];
            expect(flatList.props.data).toEqual([item1, item2]);
        });

        it("FlatList keyExtractor returns the item id", async () => {
            const item = makeAnnotationItem({ id: "unique-id-123" });
            const renderer = await renderAnnotations([item], []);
            const flatList = findAll(renderer, "FlatList")[0];
            expect(flatList.props.keyExtractor(item)).toBe("unique-id-123");
        });
    });

    // ── Clear all button ──────────────────────────────────────────────────────

    describe("Clear All button", () => {
        it("renders the Clear All button with correct label for highlights tab", async () => {
            const renderer = await renderAnnotations();
            expect(
                findTextWithContent(renderer, "Clear All Highlights"),
            ).toBeDefined();
        });

        it("renders the Clear All button with correct label for underlines tab", async () => {
            const renderer = await renderAnnotations();
            const tabs = findAll(renderer, "TouchableOpacity");
            await act(async () => {
                tabs[1].props.onPress();
            });
            expect(
                findTextWithContent(renderer, "Clear All Underlines"),
            ).toBeDefined();
        });

        it("shows an Alert when Clear All is pressed", async () => {
            const renderer = await renderAnnotations();
            // The Clear All button is the TouchableOpacity containing "Clear All Highlights" Text.
            // In the tree it comes after the two tab buttons; find it by text content.
            const clearText = findTextWithContent(
                renderer,
                "Clear All Highlights",
            );
            // Its parent TouchableOpacity holds the onPress
            const clearBtn = renderer.root.findAll(
                (node: any) =>
                    node.type === "TouchableOpacity" &&
                    node.children?.some?.(
                        (c: any) =>
                            c?.props?.children === "Clear All Highlights",
                    ),
            )[0];
            await act(async () => {
                clearBtn.props.onPress();
            });
            expect(Alert.alert).toHaveBeenCalled();
            void clearText;
        });

        it('Alert title says "Clear All Highlights" when on the highlights tab', async () => {
            const renderer = await renderAnnotations();
            const clearBtn = renderer.root.findAll(
                (node: any) =>
                    node.type === "TouchableOpacity" &&
                    node.children?.some?.(
                        (c: any) =>
                            c?.props?.children === "Clear All Highlights",
                    ),
            )[0];
            await act(async () => {
                clearBtn.props.onPress();
            });
            expect((Alert.alert as any).mock.calls[0][0]).toBe(
                "Clear All Highlights",
            );
        });

        it('calls deleteAllAnnotationsByType("highlight") when Clear All confirm is pressed', async () => {
            const renderer = await renderAnnotations(
                [makeAnnotationItem()],
                [],
            );
            const clearBtn = renderer.root.findAll(
                (node: any) =>
                    node.type === "TouchableOpacity" &&
                    node.children?.some?.(
                        (c: any) =>
                            c?.props?.children === "Clear All Highlights",
                    ),
            )[0];
            await act(async () => {
                clearBtn.props.onPress();
            });

            // Find the destructive button in the Alert call and invoke it
            const buttons = (Alert.alert as any).mock.calls[0][2];
            const confirmBtn = buttons.find(
                (b: any) => b.style === "destructive",
            );
            await act(async () => {
                confirmBtn.onPress();
            });

            expect(mockDeleteAllAnnotationsByType).toHaveBeenCalledWith(
                "highlight",
            );
        });

        it('calls deleteAllAnnotationsByType("underline") when on underlines tab and confirm is pressed', async () => {
            const renderer = await renderAnnotations(
                [],
                [makeAnnotationItem({ mark_type: "underline" })],
            );
            const tabs = findAll(renderer, "TouchableOpacity");
            await act(async () => {
                tabs[1].props.onPress();
            });

            const clearBtn = renderer.root.findAll(
                (node: any) =>
                    node.type === "TouchableOpacity" &&
                    node.children?.some?.(
                        (c: any) =>
                            c?.props?.children === "Clear All Underlines",
                    ),
            )[0];
            await act(async () => {
                clearBtn.props.onPress();
            });

            const buttons = (Alert.alert as any).mock.calls[0][2];
            const confirmBtn = buttons.find(
                (b: any) => b.style === "destructive",
            );
            await act(async () => {
                confirmBtn.onPress();
            });

            expect(mockDeleteAllAnnotationsByType).toHaveBeenCalledWith(
                "underline",
            );
        });

        it("does not call deleteAllAnnotationsByType when Cancel is pressed", async () => {
            const renderer = await renderAnnotations();
            const clearBtn = renderer.root.findAll(
                (node: any) =>
                    node.type === "TouchableOpacity" &&
                    node.children?.some?.(
                        (c: any) =>
                            c?.props?.children === "Clear All Highlights",
                    ),
            )[0];
            await act(async () => {
                clearBtn.props.onPress();
            });

            expect(mockDeleteAllAnnotationsByType).not.toHaveBeenCalled();
        });
    });

    // ── renderItem — reference format ─────────────────────────────────────────

    describe("renderItem — reference format", () => {
        it("renders the reference text in the expected format", async () => {
            const item = makeAnnotationItem({
                volume_name: "Old Covenants",
                book_name: "Genesis",
                book_chapter: "1",
                paragraph_position: 3,
            });
            const renderer = await renderAnnotations([item], []);
            const flatList = findAll(renderer, "FlatList")[0];

            let itemRenderer: any;
            act(() => {
                itemRenderer = create(
                    flatList.props.renderItem({ item, index: 0 }),
                );
            });

            const texts = findAll(itemRenderer, "Text");
            const refText = texts.find(
                (t: any) => t.props.children === "(Old Covenants) Genesis 1:3",
            );
            expect(refText).toBeDefined();
        });

        it("renders the selected_text in the item", async () => {
            const item = makeAnnotationItem({
                selected_text: "In the beginning God created",
            });
            const renderer = await renderAnnotations([item], []);
            const flatList = findAll(renderer, "FlatList")[0];

            let itemRenderer: any;
            act(() => {
                itemRenderer = create(
                    flatList.props.renderItem({ item, index: 0 }),
                );
            });

            const texts = findAll(itemRenderer, "Text");
            const selectedText = texts.find(
                (t: any) => t.props.children === "In the beginning God created",
            );
            expect(selectedText).toBeDefined();
        });
    });

    // ── renderItem — delete button ────────────────────────────────────────────

    describe("renderItem — delete button", () => {
        it("shows an Alert when the delete button is pressed", async () => {
            const item = makeAnnotationItem();
            const renderer = await renderAnnotations([item], []);
            const flatList = findAll(renderer, "FlatList")[0];

            let itemRenderer: any;
            act(() => {
                itemRenderer = create(
                    flatList.props.renderItem({ item, index: 0 }),
                );
            });

            // Delete button is the second TouchableOpacity in the item
            const touchables = findAll(itemRenderer, "TouchableOpacity");
            const deleteBtn = touchables[touchables.length - 1];
            await act(async () => {
                deleteBtn.props.onPress();
            });

            expect(Alert.alert).toHaveBeenCalled();
        });

        it('Alert title says "Remove Annotation"', async () => {
            const item = makeAnnotationItem();
            const renderer = await renderAnnotations([item], []);
            const flatList = findAll(renderer, "FlatList")[0];

            let itemRenderer: any;
            act(() => {
                itemRenderer = create(
                    flatList.props.renderItem({ item, index: 0 }),
                );
            });

            const touchables = findAll(itemRenderer, "TouchableOpacity");
            await act(async () => {
                touchables[touchables.length - 1].props.onPress();
            });

            expect((Alert.alert as any).mock.calls[0][0]).toBe(
                "Remove Annotation",
            );
        });

        it("calls deleteHighlight with the item id when confirm is pressed", async () => {
            const item = makeAnnotationItem({ id: "del-uuid" });
            const renderer = await renderAnnotations([item], []);
            const flatList = findAll(renderer, "FlatList")[0];

            let itemRenderer: any;
            act(() => {
                itemRenderer = create(
                    flatList.props.renderItem({ item, index: 0 }),
                );
            });

            const touchables = findAll(itemRenderer, "TouchableOpacity");
            await act(async () => {
                touchables[touchables.length - 1].props.onPress();
            });

            const buttons = (Alert.alert as any).mock.calls[0][2];
            const confirmBtn = buttons.find(
                (b: any) => b.style === "destructive",
            );
            await act(async () => {
                confirmBtn.onPress();
            });

            expect(mockDeleteHighlight).toHaveBeenCalledWith("del-uuid");
        });

        it("does not call deleteHighlight when Cancel is pressed", async () => {
            const item = makeAnnotationItem({ id: "del-uuid" });
            const renderer = await renderAnnotations([item], []);
            const flatList = findAll(renderer, "FlatList")[0];

            let itemRenderer: any;
            act(() => {
                itemRenderer = create(
                    flatList.props.renderItem({ item, index: 0 }),
                );
            });

            const touchables = findAll(itemRenderer, "TouchableOpacity");
            await act(async () => {
                touchables[touchables.length - 1].props.onPress();
            });

            // Don't press confirm — just verify deleteHighlight not called
            expect(mockDeleteHighlight).not.toHaveBeenCalled();
        });
    });

    // ── renderItem — navigation ───────────────────────────────────────────────

    describe("renderItem — navigation", () => {
        it('calls navigation.navigate("Reader", ...) when annotation item is pressed', async () => {
            const item = makeAnnotationItem({
                id: "nav-uuid",
                book_chapter: "3",
                book_id: "genesis",
                chapter_id: 6,
                chapter_name: "Genesis 3",
                volume_id: "oc",
                paragraph_position: 5,
            });
            const renderer = await renderAnnotations([item], []);
            const flatList = findAll(renderer, "FlatList")[0];

            let itemRenderer: any;
            act(() => {
                itemRenderer = create(
                    flatList.props.renderItem({ item, index: 0 }),
                );
            });

            // The reference container is the first TouchableOpacity in the item
            const touchables = findAll(itemRenderer, "TouchableOpacity");
            await act(async () => {
                touchables[0].props.onPress();
            });

            expect(mockNavigation.navigate).toHaveBeenCalledWith("Reader", {
                book_chapter: "3",
                book_id: "genesis",
                chapter_id: 6,
                name: "Genesis 3",
                volume_id: "oc",
                position: 5,
            });
        });

        it("passes the correct position (paragraph_position) to Reader navigation", async () => {
            const item = makeAnnotationItem({ paragraph_position: 12 });
            const renderer = await renderAnnotations([item], []);
            const flatList = findAll(renderer, "FlatList")[0];

            let itemRenderer: any;
            act(() => {
                itemRenderer = create(
                    flatList.props.renderItem({ item, index: 0 }),
                );
            });

            const touchables = findAll(itemRenderer, "TouchableOpacity");
            await act(async () => {
                touchables[0].props.onPress();
            });

            expect(mockNavigation.navigate).toHaveBeenCalledWith(
                "Reader",
                expect.objectContaining({ position: 12 }),
            );
        });
    });
});
