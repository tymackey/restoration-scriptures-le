import { useScreensStore } from "../useScreensStore";

// Convenience accessors
const store = () => useScreensStore.getState();
const active = () => {
    const s = store();
    return s.screens.find((x) => x.id === s.activeScreenId);
};

const chapter = (overrides: Record<string, any> = {}) => ({
    volume_id: "oc",
    book_id: "gen",
    book_chapter: 1,
    chapter_id: "gen:001",
    name: "Genesis 1",
    position: 0,
    ...overrides,
});

beforeEach(() => {
    useScreensStore.setState({
        screens: [],
        activeScreenId: null,
        pendingNewScreen: false,
    });
});

// ── openScreen ────────────────────────────────────────────────────────────────

describe("openScreen", () => {
    it("creates a new screen, activates it, and returns its id", () => {
        const id = store().openScreen(chapter());
        expect(store().screens).toHaveLength(1);
        expect(store().activeScreenId).toBe(id);
        expect(active()?.chapter_id).toBe("gen:001");
        expect(active()?.history).toEqual([]);
    });

    it("appends additional screens rather than replacing", () => {
        store().openScreen(chapter());
        store().openScreen(
            chapter({ chapter_id: "gen:002", name: "Genesis 2" }),
        );
        expect(store().screens).toHaveLength(2);
        expect(active()?.chapter_id).toBe("gen:002");
    });

    it("clears the pendingNewScreen flag", () => {
        store().setPendingNewScreen(true);
        store().openScreen(chapter());
        expect(store().pendingNewScreen).toBe(false);
    });

    it("coerces string book_chapter/position to numbers and defaults searchTerm", () => {
        store().openScreen(
            chapter({
                book_chapter: "5",
                position: "12",
                searchTerm: undefined,
            }),
        );
        expect(active()?.book_chapter).toBe(5);
        expect(active()?.position).toBe(12);
        expect(active()?.searchTerm).toBeNull();
    });

    it("generates unique ids for each screen", () => {
        const a = store().openScreen(chapter());
        const b = store().openScreen(chapter({ chapter_id: "gen:002" }));
        expect(a).not.toBe(b);
    });
});

// ── openInActiveScreen ──────────────────────────────────────────────────────────

describe("openInActiveScreen", () => {
    it("replaces the active screen's chapter without creating a new screen", () => {
        store().openScreen(chapter());
        store().openInActiveScreen(
            chapter({
                chapter_id: "gen:003",
                name: "Genesis 3",
                book_chapter: 3,
            }),
        );
        expect(store().screens).toHaveLength(1);
        expect(active()?.chapter_id).toBe("gen:003");
        expect(active()?.book_chapter).toBe(3);
    });

    it("preserves the active screen's history", () => {
        store().openScreen(chapter());
        store().navigateWithinActive(chapter({ chapter_id: "gen:002" }));
        const historyLen = active()?.history.length;
        store().openInActiveScreen(chapter({ chapter_id: "gen:003" }));
        expect(active()?.history).toHaveLength(historyLen as number);
    });

    it("creates a new screen when there is no active screen", () => {
        store().openInActiveScreen(chapter());
        expect(store().screens).toHaveLength(1);
        expect(active()?.chapter_id).toBe("gen:001");
    });
});

// ── navigateWithinActive ────────────────────────────────────────────────────────

describe("navigateWithinActive", () => {
    it("moves the active screen to the new chapter and pushes the old one to history", () => {
        store().openScreen(chapter());
        store().navigateWithinActive(
            chapter({ chapter_id: "gen:002", name: "Genesis 2" }),
        );
        expect(active()?.chapter_id).toBe("gen:002");
        expect(active()?.history).toHaveLength(1);
        expect(active()?.history[0].chapter_id).toBe("gen:001");
    });

    it("accumulates history across multiple navigations", () => {
        store().openScreen(chapter());
        store().navigateWithinActive(chapter({ chapter_id: "gen:002" }));
        store().navigateWithinActive(chapter({ chapter_id: "gen:003" }));
        expect(active()?.history.map((h) => h.chapter_id)).toEqual([
            "gen:001",
            "gen:002",
        ]);
    });

    it("does not affect other (inactive) screens", () => {
        const first = store().openScreen(chapter());
        store().openScreen(chapter({ chapter_id: "gen:100", name: "Other" }));
        store().navigateWithinActive(chapter({ chapter_id: "gen:101" }));
        const firstScreen = store().screens.find((s) => s.id === first);
        expect(firstScreen?.chapter_id).toBe("gen:001");
        expect(firstScreen?.history).toHaveLength(0);
    });

    it("creates a screen when none is active", () => {
        store().navigateWithinActive(chapter());
        expect(store().screens).toHaveLength(1);
    });
});

// ── goBackWithinActive ──────────────────────────────────────────────────────────

describe("goBackWithinActive", () => {
    it("pops the last history entry back into the current chapter and returns true", () => {
        store().openScreen(chapter());
        store().navigateWithinActive(chapter({ chapter_id: "gen:002" }));
        const result = store().goBackWithinActive();
        expect(result).toBe(true);
        expect(active()?.chapter_id).toBe("gen:001");
        expect(active()?.history).toHaveLength(0);
    });

    it("restores the previous chapter's position", () => {
        store().openScreen(chapter({ position: 7 }));
        store().navigateWithinActive(chapter({ chapter_id: "gen:002" }));
        store().goBackWithinActive();
        expect(active()?.position).toBe(7);
    });

    it("returns false when there is no history to pop", () => {
        store().openScreen(chapter());
        expect(store().goBackWithinActive()).toBe(false);
        expect(active()?.chapter_id).toBe("gen:001");
    });

    it("returns false when there is no active screen", () => {
        expect(store().goBackWithinActive()).toBe(false);
    });
});

// ── setActivePosition ───────────────────────────────────────────────────────────

describe("setActivePosition", () => {
    it("updates only the active screen's position", () => {
        store().openScreen(chapter());
        store().setActivePosition(42);
        expect(active()?.position).toBe(42);
    });

    it("does nothing when there is no active screen", () => {
        expect(() => store().setActivePosition(5)).not.toThrow();
        expect(store().screens).toHaveLength(0);
    });

    it("does not alter chapter identity or history", () => {
        store().openScreen(chapter());
        store().navigateWithinActive(chapter({ chapter_id: "gen:002" }));
        store().setActivePosition(99);
        expect(active()?.chapter_id).toBe("gen:002");
        expect(active()?.history).toHaveLength(1);
    });
});

// ── setActiveScreen ─────────────────────────────────────────────────────────────

describe("setActiveScreen", () => {
    it("switches the active screen", () => {
        const a = store().openScreen(chapter());
        store().openScreen(chapter({ chapter_id: "gen:002" }));
        store().setActiveScreen(a);
        expect(store().activeScreenId).toBe(a);
        expect(active()?.chapter_id).toBe("gen:001");
    });
});

// ── closeScreen ─────────────────────────────────────────────────────────────────

describe("closeScreen", () => {
    it("removes the screen", () => {
        const a = store().openScreen(chapter());
        store().closeScreen(a);
        expect(store().screens).toHaveLength(0);
        expect(store().activeScreenId).toBeNull();
    });

    it("activates a neighbour when the active screen is closed", () => {
        const a = store().openScreen(chapter({ chapter_id: "gen:001" }));
        const b = store().openScreen(chapter({ chapter_id: "gen:002" }));
        store().setActiveScreen(a);
        store().closeScreen(a);
        expect(store().activeScreenId).toBe(b);
    });

    it("keeps the current active screen when closing a different one", () => {
        const a = store().openScreen(chapter({ chapter_id: "gen:001" }));
        const b = store().openScreen(chapter({ chapter_id: "gen:002" }));
        // b is active
        store().closeScreen(a);
        expect(store().activeScreenId).toBe(b);
        expect(store().screens).toHaveLength(1);
    });
});

// ── closeAllScreens ─────────────────────────────────────────────────────────────

describe("closeAllScreens", () => {
    it("removes every screen and clears the active id", () => {
        store().openScreen(chapter());
        store().openScreen(chapter({ chapter_id: "gen:002" }));
        store().closeAllScreens();
        expect(store().screens).toHaveLength(0);
        expect(store().activeScreenId).toBeNull();
    });
});

// ── setPendingNewScreen ─────────────────────────────────────────────────────────

describe("setPendingNewScreen", () => {
    it("toggles the pendingNewScreen flag", () => {
        store().setPendingNewScreen(true);
        expect(store().pendingNewScreen).toBe(true);
        store().setPendingNewScreen(false);
        expect(store().pendingNewScreen).toBe(false);
    });
});
