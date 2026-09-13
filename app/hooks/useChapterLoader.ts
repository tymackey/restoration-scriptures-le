import { useState, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import WebView from "react-native-webview";
import { HtmlProcessor } from "../util/HtmlProcessor";
import { addToHistory } from "../util/HistoryStorage";
import { ScrollTracker } from "../util/ScrollTracker";
import { buildScrollScript } from "../util/readerScripts";
import { Highlight } from "../data/UserDatabaseSchema";
import { ACTIONS, ReaderAction } from "../util/readerReducer";

interface ChapterLoaderParams {
    params: {
        chapter_id: string;
        volume_id: string;
        book_id: string;
        book_chapter: number | string;
        position: number;
        name: string;
    };
    dispatch: React.Dispatch<ReaderAction>;
    setChapterHighlights: React.Dispatch<React.SetStateAction<Highlight[]>>;
    setCurrentParagraphPosition: React.Dispatch<React.SetStateAction<number>>;
    displayLEVerses: boolean;
    searchTerm: string | null;
    setCurrentReference: (
        bookId: string,
        chapter: any,
        position: number,
    ) => void;
    webviewRef: React.RefObject<WebView>;
    getChapterText: (id: string) => Promise<string>;
    getChapterHighlights: (
        volumeId: string,
        bookId: string,
        chapter: string,
    ) => Promise<Highlight[]>;
    getReferenceBookNames: () => Promise<string[]>;
}

interface ChapterLoaderResult {
    isNavigating: boolean;
    setIsNavigating: React.Dispatch<React.SetStateAction<boolean>>;
}

// Small LRU cache of fully-processed chapter HTML, keyed by
// `${chapter_id}|${displayLEVerses}|${searchTerm}`. Switching back to a
// previously-opened screen (the common tab-switch case) then skips the SQLite
// read, cheerio processing, and image preloading entirely. Scroll position and
// user highlights are applied separately at load time, so they are intentionally
// NOT part of the key.
const PROCESSED_HTML_CACHE_LIMIT = 12;
const processedHtmlCache = new Map<string, string>();

// The set of book names used to auto-link scripture references is constant for
// the life of the app, so fetch it once and reuse it across every chapter.
let referenceBookNamesCache: string[] | null = null;

function getCachedHtml(key: string): string | undefined {
    const cached = processedHtmlCache.get(key);
    if (cached !== undefined) {
        // Refresh recency: re-insert so this key becomes most-recently-used.
        processedHtmlCache.delete(key);
        processedHtmlCache.set(key, cached);
    }
    return cached;
}

function setCachedHtml(key: string, html: string): void {
    if (processedHtmlCache.has(key)) processedHtmlCache.delete(key);
    processedHtmlCache.set(key, html);
    while (processedHtmlCache.size > PROCESSED_HTML_CACHE_LIMIT) {
        const oldest = processedHtmlCache.keys().next().value;
        if (oldest === undefined) break;
        processedHtmlCache.delete(oldest);
    }
}

export function useChapterLoader({
    params,
    dispatch,
    setChapterHighlights,
    setCurrentParagraphPosition,
    displayLEVerses,
    searchTerm,
    setCurrentReference,
    webviewRef,
    getChapterText,
    getChapterHighlights,
    getReferenceBookNames,
}: ChapterLoaderParams): ChapterLoaderResult {
    const [isNavigating, setIsNavigating] = useState(false);
    // Identifies the chapter currently rendered in the WebView, so returning to
    // an already-loaded screen doesn't trigger a full reload.
    const lastLoadedKey = useRef<string | null>(null);
    const lastPosition = useRef<number>(0);

    // Load chapter text and highlights
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;

            async function requestChapterText(id: string, position: number) {
                const key = `${id}|${displayLEVerses}|${searchTerm ?? ""}`;

                // No-op guard: this chapter is already rendered. `useFocusEffect`
                // re-runs on every focus (e.g. returning from the Screens
                // overview), so without this guard we'd fully reload even when
                // nothing changed. Returning to the same chapter only needs a
                // re-scroll when the target position differs (e.g. two screens on
                // the same chapter) — never a DB read + reprocess + WebView reload.
                if (lastLoadedKey.current === key) {
                    const pos = position || 0;
                    if (pos !== lastPosition.current) {
                        lastPosition.current = pos;
                        dispatch({ type: ACTIONS.SET_POSITION, payload: pos });
                        webviewRef.current?.injectJavaScript(
                            buildScrollScript(pos),
                        );
                    }
                    return;
                }

                try {
                    setIsNavigating(true);
                    dispatch({ type: ACTIONS.SET_LOADING, payload: true });
                    dispatch({
                        type: ACTIONS.SET_WEBVIEW_LOADING,
                        payload: true,
                    });

                    // Fetch highlights in parallel with text fetch + processing
                    // instead of serially after it.
                    const highlightsPromise = getChapterHighlights(
                        params.volume_id,
                        params.book_id,
                        params.book_chapter + "",
                    );

                    // Reuse previously-processed HTML when we've rendered this
                    // chapter before (the common screen-switching case).
                    let text = getCachedHtml(key);
                    if (text === undefined) {
                        if (referenceBookNamesCache === null) {
                            try {
                                referenceBookNamesCache =
                                    await getReferenceBookNames();
                            } catch (e) {
                                console.error(
                                    "Failed to load reference book names:",
                                    e,
                                );
                                referenceBookNamesCache = [];
                            }
                        }
                        const raw = await getChapterText(id);
                        text = await HtmlProcessor.processHtml(
                            raw,
                            displayLEVerses,
                            params.volume_id,
                            searchTerm ?? undefined,
                            referenceBookNamesCache,
                        );
                        setCachedHtml(key, text);
                    }

                    const highlights = await highlightsPromise;
                    if (cancelled) return;

                    setChapterHighlights(highlights);
                    console.log(
                        `Loaded ${highlights.length} highlights for chapter`,
                    );

                    dispatch({ type: ACTIONS.SET_HTML, payload: text });

                    const pos = position || 0;
                    dispatch({ type: ACTIONS.SET_POSITION, payload: pos });

                    console.log(
                        "Chapter loaded - updating reference:",
                        params.book_id,
                        params.book_chapter,
                        pos,
                    );
                    setCurrentReference(
                        params.book_id,
                        params.book_chapter as number,
                        pos,
                    );
                    setCurrentParagraphPosition(pos);

                    lastLoadedKey.current = key;
                    lastPosition.current = pos;

                    setTimeout(() => {
                        addToHistory(
                            params.volume_id,
                            params.book_id,
                            params.book_chapter + "",
                            "0",
                            params.name,
                            params.chapter_id,
                        );
                    }, 0);
                } catch (e) {
                    console.error(e);
                } finally {
                    if (!cancelled) setIsNavigating(false);
                }
            }
            requestChapterText(params.chapter_id, params.position);

            return () => {
                cancelled = true;
            };
        }, [
            getChapterText,
            getReferenceBookNames,
            params.chapter_id,
            params.volume_id,
            getChapterHighlights,
            params.book_id,
            params.book_chapter,
            params.position,
            displayLEVerses,
            searchTerm,
            setCurrentReference,
        ]),
    );

    // Reset navigation flag when chapter changes
    useFocusEffect(
        useCallback(() => {
            return () => {
                setIsNavigating(false);
            };
        }, [params.chapter_id]),
    );

    // Clean up scroll tracking when chapter changes
    useFocusEffect(
        useCallback(() => {
            return () => {
                if (webviewRef.current) {
                    webviewRef.current.injectJavaScript(
                        ScrollTracker.generateCleanupScript(),
                    );
                }
            };
        }, [params.chapter_id]),
    );

    return { isNavigating, setIsNavigating };
}
