import { useState, useCallback } from "react";
import WebView from "react-native-webview";
import { Highlight } from "../data/UserDatabaseSchema";
import { SelectionHandler } from "../util/SelectionHandler";

interface HighlightManagerParams {
    params: {
        volume_id: string;
        book_id: string;
        book_chapter: number | string;
    };
    webviewRef: React.RefObject<WebView>;
    addHighlight: (
        volumeId: string,
        bookId: string,
        chapter: string,
        paragraphPosition: number,
        startOffset: number,
        endOffset: number,
        selectedText: string,
        color: string,
        markType: string,
        endParagraphPosition: number | null,
    ) => Promise<any>;
    getChapterHighlights: (
        volumeId: string,
        bookId: string,
        chapter: string,
    ) => Promise<Highlight[]>;
    deleteHighlight: (id: string) => Promise<void>;
    updateHighlightColor: (
        id: string,
        color: string,
        markType: string,
    ) => Promise<void>;
    updateHighlightMarkType: (id: string, markType: string) => Promise<void>;
}

interface HighlightManagerResult {
    chapterHighlights: Highlight[];
    setChapterHighlights: React.Dispatch<React.SetStateAction<Highlight[]>>;
    onHighlightMessage: (data: any) => void;
    syncHighlightsWithDb: () => Promise<void>;
}

export function useHighlightManager({
    params,
    webviewRef,
    addHighlight,
    getChapterHighlights,
    deleteHighlight,
    updateHighlightColor,
    updateHighlightMarkType,
}: HighlightManagerParams): HighlightManagerResult {
    const [chapterHighlights, setChapterHighlights] = useState<Highlight[]>([]);

    const reloadAndApplyHighlights = useCallback(async () => {
        const highlights = await getChapterHighlights(
            params.volume_id,
            params.book_id,
            params.book_chapter + "",
        );
        setChapterHighlights(highlights);
        return highlights;
    }, [
        getChapterHighlights,
        params.volume_id,
        params.book_id,
        params.book_chapter,
    ]);

    // Reconcile the WebView with the DB without re-applying the highlights that
    // remain — used when highlights may have been deleted while the reader was
    // out of focus (e.g. on the Annotations screen). Only prunes stale spans, so
    // the surviving highlights don't flicker.
    const syncHighlightsWithDb = useCallback(async () => {
        const highlights = await reloadAndApplyHighlights();
        webviewRef.current?.injectJavaScript(
            SelectionHandler.generatePruneHighlightsScript(
                highlights.map((h) => h.id),
            ),
        );
    }, [reloadAndApplyHighlights, webviewRef]);

    const reloadAndReapply = useCallback(async () => {
        const highlights = await reloadAndApplyHighlights();
        webviewRef.current?.injectJavaScript(
            SelectionHandler.generateRemoveHighlightsScript(),
        );
        setTimeout(() => {
            webviewRef.current?.injectJavaScript(
                SelectionHandler.generateApplyHighlightsScript(highlights),
            );
        }, 50);
    }, [reloadAndApplyHighlights, webviewRef]);

    const onHighlightMessage = useCallback(
        (data: any) => {
            if (data.type === "updateMarkType") {
                void (async () => {
                    try {
                        await updateHighlightMarkType(
                            data.highlightId,
                            data.markType,
                        );
                    } catch (err) {
                        console.error("Error updating mark type:", err);
                    }
                })();
            } else if (data.type === "colorSelect") {
                void (async () => {
                    try {
                        if (data.isEditing && data.highlightId) {
                            await updateHighlightColor(
                                data.highlightId,
                                data.color,
                                data.markType,
                            );
                        } else if (data.rangeData) {
                            const r = data.rangeData;
                            await addHighlight(
                                params.volume_id,
                                params.book_id,
                                params.book_chapter + "",
                                r.paragraphPosition,
                                r.paragraphStartOffset,
                                r.spansParagraphs
                                    ? r.endParagraphOffset
                                    : r.paragraphEndOffset,
                                r.selectedText,
                                data.color,
                                data.markType ?? "highlight",
                                r.spansParagraphs
                                    ? r.endParagraphPosition
                                    : null,
                            );
                        }
                        await reloadAndReapply();
                    } catch (err) {
                        console.error("Error saving highlight:", err);
                    }
                })();
            } else if (data.type === "deleteOrphanHighlight") {
                void (async () => {
                    try {
                        await deleteHighlight(data.highlightId);
                        await reloadAndApplyHighlights();
                    } catch (err) {
                        console.error("Error deleting orphan highlight:", err);
                    }
                })();
            } else if (data.type === "deleteHighlight") {
                void (async () => {
                    try {
                        await deleteHighlight(data.highlightId);
                        await reloadAndReapply();
                    } catch (err) {
                        console.error("Error deleting highlight:", err);
                    }
                })();
            }
        },
        [
            params.volume_id,
            params.book_id,
            params.book_chapter,
            addHighlight,
            deleteHighlight,
            updateHighlightColor,
            updateHighlightMarkType,
            reloadAndApplyHighlights,
            reloadAndReapply,
        ],
    );

    return {
        chapterHighlights,
        setChapterHighlights,
        onHighlightMessage,
        syncHighlightsWithDb,
    };
}
