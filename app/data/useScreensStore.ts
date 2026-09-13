import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// A single chapter reference held by a reader screen. Mirrors the params shape
// that ReaderScreen has always consumed (see app/screens/reader.tsx).
export type ChapterRef = {
    volume_id: string;
    book_id: string;
    book_chapter: number;
    chapter_id: string;
    name: string;
    position: number;
    searchTerm?: string | null;
};

// Loose input accepted by the store actions: navigation params carry
// book_chapter / position as either strings or numbers.
export type ChapterInput = {
    volume_id: string;
    book_id: string;
    book_chapter: number | string;
    chapter_id: string;
    name: string;
    position?: number | string;
    searchTerm?: string | null;
};

// One open reading "screen" (browser-tab-like). `history` is the per-screen
// back stack of previously-viewed chapters within this screen.
export type ReaderScreen = ChapterRef & {
    id: string;
    history: ChapterRef[];
};

interface ScreensState {
    screens: ReaderScreen[];
    activeScreenId: string | null;
    // Set by the "+" flow so the next chapter opened becomes a NEW screen
    // rather than replacing the active one.
    pendingNewScreen: boolean;

    openScreen: (chapter: ChapterInput) => string;
    openInActiveScreen: (chapter: ChapterInput) => string;
    navigateWithinActive: (chapter: ChapterInput) => void;
    goBackWithinActive: () => boolean;
    setActivePosition: (position: number) => void;
    setActiveScreen: (id: string) => void;
    closeScreen: (id: string) => void;
    closeAllScreens: () => void;
    setPendingNewScreen: (pending: boolean) => void;
}

let idCounter = 0;
const makeId = () =>
    `scr_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

// Cap on the per-screen back stack. History is persisted to AsyncStorage on
// every navigation, so an uncapped stack would grow without bound over a long
// session. 50 chapters of back-navigation is far more than anyone steps
// through, and older entries are dropped oldest-first.
const MAX_HISTORY = 50;

// Extract/normalize just the ChapterRef fields from a navigation params object.
const toChapterRef = (chapter: ChapterInput): ChapterRef => ({
    volume_id: chapter.volume_id,
    book_id: chapter.book_id,
    book_chapter: Number(chapter.book_chapter),
    chapter_id: chapter.chapter_id,
    name: chapter.name,
    position: Number(chapter.position) || 0,
    searchTerm: chapter.searchTerm ?? null,
});

export const useScreensStore = create<ScreensState>()(
    persist(
        (set, get) => ({
            screens: [],
            activeScreenId: null,
            pendingNewScreen: false,

            openScreen: (chapter) => {
                const id = makeId();
                const screen: ReaderScreen = {
                    ...toChapterRef(chapter),
                    id,
                    history: [],
                };
                set((state) => ({
                    screens: [...state.screens, screen],
                    activeScreenId: id,
                    pendingNewScreen: false,
                }));
                return id;
            },

            openInActiveScreen: (chapter) => {
                const { activeScreenId, screens } = get();
                const active = screens.find((s) => s.id === activeScreenId);
                if (!active) {
                    // No active screen — behave like openScreen.
                    return get().openScreen(chapter);
                }
                const ref = toChapterRef(chapter);
                set((state) => ({
                    screens: state.screens.map((s) =>
                        s.id === active.id ? { ...s, ...ref } : s,
                    ),
                }));
                return active.id;
            },

            navigateWithinActive: (chapter) => {
                const { activeScreenId, screens } = get();
                const active = screens.find((s) => s.id === activeScreenId);
                if (!active) {
                    get().openScreen(chapter);
                    return;
                }
                const ref = toChapterRef(chapter);
                // Push the current chapter onto this screen's history so Back
                // can step back through visited chapters.
                const prev: ChapterRef = {
                    volume_id: active.volume_id,
                    book_id: active.book_id,
                    book_chapter: active.book_chapter,
                    chapter_id: active.chapter_id,
                    name: active.name,
                    position: active.position,
                    searchTerm: active.searchTerm ?? null,
                };
                set((state) => ({
                    screens: state.screens.map((s) =>
                        s.id === active.id
                            ? {
                                  ...s,
                                  ...ref,
                                  history: [...s.history, prev].slice(
                                      -MAX_HISTORY,
                                  ),
                              }
                            : s,
                    ),
                }));
            },

            goBackWithinActive: () => {
                const { activeScreenId, screens } = get();
                const active = screens.find((s) => s.id === activeScreenId);
                if (!active || active.history.length === 0) return false;
                const history = active.history.slice();
                const prev = history.pop() as ChapterRef;
                set((state) => ({
                    screens: state.screens.map((s) =>
                        s.id === active.id ? { ...s, ...prev, history } : s,
                    ),
                }));
                return true;
            },

            setActivePosition: (position) => {
                const { activeScreenId } = get();
                if (!activeScreenId) return;
                set((state) => ({
                    screens: state.screens.map((s) =>
                        s.id === activeScreenId ? { ...s, position } : s,
                    ),
                }));
            },

            setActiveScreen: (id) => set(() => ({ activeScreenId: id })),

            closeScreen: (id) =>
                set((state) => {
                    const index = state.screens.findIndex((s) => s.id === id);
                    const screens = state.screens.filter((s) => s.id !== id);
                    let activeScreenId = state.activeScreenId;
                    if (state.activeScreenId === id) {
                        if (screens.length === 0) {
                            activeScreenId = null;
                        } else {
                            // Activate the neighbour that took its place.
                            const nextIndex = Math.min(
                                index,
                                screens.length - 1,
                            );
                            activeScreenId = screens[nextIndex].id;
                        }
                    }
                    return { screens, activeScreenId };
                }),

            closeAllScreens: () =>
                set(() => ({ screens: [], activeScreenId: null })),

            setPendingNewScreen: (pending) =>
                set(() => ({ pendingNewScreen: pending })),
        }),
        {
            name: "REScreensStorage",
            storage: createJSONStorage(() => AsyncStorage),
            // pendingNewScreen is transient UI intent — don't persist it.
            partialize: (state) => ({
                screens: state.screens,
                activeScreenId: state.activeScreenId,
            }),
        },
    ),
);
