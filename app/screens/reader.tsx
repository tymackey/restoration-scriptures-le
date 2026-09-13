import "react-native-gesture-handler";
import * as IntentLauncher from "expo-intent-launcher";
import React, {
    useCallback,
    useEffect,
    useState,
    useRef,
    useMemo,
    useReducer,
} from "react";
import {
    useWindowDimensions,
    Linking,
    Platform,
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    BackHandler,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import WebView from "react-native-webview";
import { useDatabase } from "../data/useDatabase";
import AudioControlModal from "../components/AudioControlModal";
import DisplayOptions from "../components/DisplayOptions";
import { ImageZoomModal } from "../components/ImageZoomModal";
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { PaperProvider, Snackbar } from "react-native-paper";
import * as TrackPlayer from "../util/TrackPlayer";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { WebViewSource } from "react-native-webview/lib/WebViewTypes";
import { SelectionHandler } from "../util/SelectionHandler";

import {
    readerReducer,
    makeInitialReaderState,
    ACTIONS,
} from "../util/readerReducer";
import {
    buildApplyStyles,
    buildScrollScript,
    buildLinkInjectedJavaScript,
    contentLoaded,
} from "../util/readerScripts";
import { useScreensStore } from "../data/useScreensStore";
import { getFontsBaseUrl } from "../util/FontLoader";
import { useReaderSettings } from "../hooks/useReaderSettings";
import { useWebViewStyleInjection } from "../hooks/useWebViewStyleInjection";
import { useHighlightManager } from "../hooks/useHighlightManager";
import { useChapterLoader } from "../hooks/useChapterLoader";
import { useReaderAudio } from "../hooks/useReaderAudio";
import { ReaderFAB } from "../components/ReaderFAB";
import { colors } from "../constants/colors";
import { commonStyles } from "../styles/commonStyles";

const HZ_MARGIN = 10;

// Fallback params for the brief window where the reader is still mounted but has
// no active screen AND no route params — e.g. right after "Close All Screens"
// clears the active screen while a pending navigation away is in flight, or when
// the reader was entered via launch-restore (which passes no route params). All
// fields are null/undefined so property access stays safe until unmount.
const EMPTY_PARAMS = {
    volume_id: undefined,
    book_id: undefined,
    book_chapter: undefined,
    chapter_id: undefined,
    name: undefined,
    searchTerm: null,
    position: 0,
} as any;

function ReaderScreen({ route, navigation }: { route: any; navigation: any }) {
    const webviewRef = useRef<WebView>(null);

    // ── Screen (tab) resolution ───────────────────────────────────────────────
    // The reader renders the currently-active screen from useScreensStore. We
    // subscribe to identity fields as individual primitives (NOT the live
    // `position`) so that scroll updates don't re-render the reader or
    // retrigger a full chapter reload via useChapterLoader.
    const activeScreenId = useScreensStore((s) => s.activeScreenId);
    const activeVolumeId = useScreensStore(
        (s) => s.screens.find((x) => x.id === s.activeScreenId)?.volume_id,
    );
    const activeBookId = useScreensStore(
        (s) => s.screens.find((x) => x.id === s.activeScreenId)?.book_id,
    );
    const activeBookChapter = useScreensStore(
        (s) => s.screens.find((x) => x.id === s.activeScreenId)?.book_chapter,
    );
    const activeChapterId = useScreensStore(
        (s) => s.screens.find((x) => x.id === s.activeScreenId)?.chapter_id,
    );
    const activeName = useScreensStore(
        (s) => s.screens.find((x) => x.id === s.activeScreenId)?.name,
    );
    const activeSearchTerm = useScreensStore(
        (s) =>
            s.screens.find((x) => x.id === s.activeScreenId)?.searchTerm ??
            null,
    );
    const hasActiveScreen = activeScreenId != null && activeChapterId != null;

    const navigateWithinActive = useScreensStore((s) => s.navigateWithinActive);
    const setActivePosition = useScreensStore((s) => s.setActivePosition);

    // The scroll position to restore, captured only when the chapter/screen
    // changes — never on live scroll updates.
    const [loadPosition, setLoadPosition] = useState<number>(
        Number(route.params?.position) || 0,
    );
    useEffect(() => {
        if (!hasActiveScreen) return;
        const scr = useScreensStore
            .getState()
            .screens.find((x) => x.id === activeScreenId);
        setLoadPosition(scr?.position ?? 0);
    }, [activeScreenId, activeChapterId, hasActiveScreen]);

    // Reconcile incoming route.params (external entries: book list, search,
    // history, switch-volume, launch restore) into the screens store.
    const routeChapterId = route.params?.chapter_id;
    useEffect(() => {
        if (!routeChapterId) return;
        const store = useScreensStore.getState();
        if (store.pendingNewScreen) {
            store.openScreen(route.params);
        } else {
            const active = store.screens.find(
                (s) => s.id === store.activeScreenId,
            );
            if (!active || active.chapter_id !== routeChapterId) {
                store.openInActiveScreen(route.params);
            }
        }
    }, [routeChapterId]);

    const params = useMemo(() => {
        if (hasActiveScreen) {
            return {
                volume_id: activeVolumeId,
                book_id: activeBookId,
                book_chapter: activeBookChapter,
                chapter_id: activeChapterId,
                name: activeName,
                searchTerm: activeSearchTerm,
                position: loadPosition,
            };
        }
        return route.params ?? EMPTY_PARAMS;
    }, [
        hasActiveScreen,
        activeVolumeId,
        activeBookId,
        activeBookChapter,
        activeChapterId,
        activeName,
        activeSearchTerm,
        loadPosition,
        route.params,
    ]);

    // Device Back steps back through chapters visited within the active screen;
    // when its history is empty, fall through to the default stack pop.
    useFocusEffect(
        useCallback(() => {
            const onBack = () =>
                useScreensStore.getState().goBackWithinActive();
            const sub = BackHandler.addEventListener(
                "hardwareBackPress",
                onBack,
            );
            return () => sub.remove();
        }, []),
    );

    const {
        getChapterText,
        getNextChapter,
        getPreviousChapter,
        getChapterByReference,
        getCanonicalBook,
        getREReferences,
        getReferenceBookNames,
        addHighlight,
        getChapterHighlights,
        deleteHighlight,
        updateHighlightColor,
        updateHighlightMarkType,
    } = useDatabase();

    const {
        backgroundColor,
        foregroundColor,
        markerColor,
        fontSize,
        alignment,
        fontFamily,
        isBottomMenuOpen,
        toggleBottomMenu,
        displayLEVerses,
        isAutoPlaying,
        isAudioModalOpen,
        toggleAudioModal,
        voice,
        rate,
        setCurrentReference,
        setFontSize,
    } = useReaderSettings();

    const [state, dispatch] = useReducer(
        readerReducer,
        makeInitialReaderState(params.searchTerm),
    );
    const [currentParagraphPosition, setCurrentParagraphPosition] = useState(0);
    const isFocused = useIsFocused();

    // Highlight management (state + message handlers)
    const {
        chapterHighlights,
        setChapterHighlights,
        onHighlightMessage,
        syncHighlightsWithDb,
    } = useHighlightManager({
        params,
        webviewRef,
        addHighlight,
        getChapterHighlights,
        deleteHighlight,
        updateHighlightColor,
        updateHighlightMarkType,
    });

    // Re-sync highlights with the DB whenever the reader regains focus, so that
    // annotations deleted elsewhere (e.g. the Annotations screen) don't linger
    // in the still-mounted WebView. Skip the initial focus — useChapterLoader
    // already loads fresh highlights on mount/chapter change.
    const hasFocusedOnce = useRef(false);
    useFocusEffect(
        useCallback(() => {
            if (!hasFocusedOnce.current) {
                hasFocusedOnce.current = true;
                return;
            }
            void syncHighlightsWithDb();
        }, [syncHighlightsWithDb]),
    );

    // Chapter loading and navigation guards
    const { isNavigating, setIsNavigating } = useChapterLoader({
        params,
        dispatch,
        setChapterHighlights,
        setCurrentParagraphPosition,
        displayLEVerses,
        searchTerm: state.searchTerm,
        setCurrentReference,
        webviewRef,
        getChapterText,
        getChapterHighlights,
        getReferenceBookNames,
    });

    // Chapter navigation
    const previousChapter = async () => {
        setIsNavigating(true);
        try {
            await TrackPlayer.stop();
            await TrackPlayer.clearQueue([]);
            await TrackPlayer.updateNotificationVisibility(false);
        } catch (error) {
            console.log("TrackPlayer cleanup error in previousChapter:", error);
        }

        let previous;
        try {
            previous = await getPreviousChapter(
                params.chapter_id,
                params.book_id,
                params.book_chapter,
            );
        } catch (error) {}

        if (previous) {
            dispatch({ type: ACTIONS.SET_LOADING, payload: true });
            navigateWithinActive(previous);
        } else {
            setIsNavigating(false);
        }
    };

    const nextChapter = async () => {
        setIsNavigating(true);
        try {
            await TrackPlayer.stop();
            await TrackPlayer.clearQueue([]);
            await TrackPlayer.updateNotificationVisibility(false);
        } catch (error) {
            console.log("TrackPlayer cleanup error in nextChapter:", error);
        }

        let next;
        try {
            next = await getNextChapter(
                params.chapter_id,
                params.book_id,
                params.book_chapter,
            );
        } catch (error) {}

        if (next) {
            dispatch({ type: ACTIONS.SET_LOADING, payload: true });
            navigateWithinActive(next);
        } else {
            setIsNavigating(false);
        }
    };

    // Audio playback management
    const { audioUnavailableSnackbar, setAudioUnavailableSnackbar } =
        useReaderAudio({
            params,
            isNavigating,
            navigation,
            webviewRef,
            dispatch,
            isAudioModalOpen,
            toggleAudioModal,
            voice,
            rate,
            isAutoPlaying,
            toggleBottomMenu,
            onQueueEnded: nextChapter,
        });

    // Style injection into WebView on settings change
    useWebViewStyleInjection({
        webviewRef,
        backgroundColor,
        foregroundColor,
        markerColor,
        fontSize,
        alignment,
        fontFamily,
    });

    // Bottom sheet open/close driven by settings store
    const bottomSheetRef = useRef(null);
    const { width: _bsWidth, height: _bsHeight } = useWindowDimensions();
    const snapPoints = useMemo(
        () => [_bsWidth > _bsHeight ? "92%" : 440],
        [_bsWidth, _bsHeight],
    );

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                opacity={0.2}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                enableTouchThrough={false}
                pressBehavior={"close"}
                onPress={() => toggleBottomMenu(false)}
            />
        ),
        [toggleBottomMenu],
    );

    useFocusEffect(
        useCallback(() => {
            if (!bottomSheetRef.current) return;
            if (isBottomMenuOpen) {
                (bottomSheetRef.current as BottomSheet).expand();
            } else {
                (bottomSheetRef.current as BottomSheet).close();
            }
        }, [isBottomMenuOpen]),
    );

    useFocusEffect(
        useCallback(() => {
            dispatch({ type: ACTIONS.TOGGLE_FAB, payload: !isBottomMenuOpen });
        }, [isBottomMenuOpen]),
    );

    // Force-remove loading overlay if WebView takes too long
    useFocusEffect(
        useCallback(() => {
            if (state.webViewLoading) {
                const timeoutId = setTimeout(() => {
                    console.log(
                        "WebView loading timeout - forcing removal of loading screen",
                    );
                    dispatch({
                        type: ACTIONS.SET_WEBVIEW_LOADING,
                        payload: false,
                    });
                    webviewRef.current?.injectJavaScript(contentLoaded);
                }, 1000);
                return () => clearTimeout(timeoutId);
            }
        }, [state.webViewLoading]),
    );

    // ── Gesture & text selection ──────────────────────────────────────────────

    const toggleTextSelection = (enabled: boolean) => {
        webviewRef.current?.injectJavaScript(`
            (function() {
                try {
                    if (document.body) {
                        document.body.style.userSelect = '${enabled ? "text" : "none"}';
                    }
                } catch(e) {
                    console.error('Error toggling text selection:', e);
                }
                true;
            })();
        `);
    };

    const doubleTap = Gesture.Tap()
        .maxDuration(250)
        .numberOfTaps(2)
        .runOnJS(true)
        .onStart(() => {
            if (!isBottomMenuOpen) {
                runOnJS(toggleTextSelection)(false);
                runOnJS(dispatch)({
                    type: ACTIONS.TOGGLE_FAB,
                    payload: !state.fabVisible,
                });
            }
        })
        .onFinalize(() => {
            setTimeout(() => {
                runOnJS(toggleTextSelection)(true);
            }, 300);
        });

    const pinchStartFontSize = useSharedValue(fontSize);
    const pinchLastFontSize = useSharedValue(fontSize);

    // Set from the "imageZoom" WebView message posted when a ".zoomable"
    // scripture image is tapped — see ImageZoomModal and ImageUtils.ts.
    const [zoomImageName, setZoomImageName] = useState<string | null>(null);

    // Live font-size feedback during a pinch: inject straight into the WebView
    // instead of writing to the store on every gesture frame. Going through the
    // store would trigger an AsyncStorage persist + effect-driven re-injection
    // per frame, whose async backlog keeps draining after the gesture ends.
    const applyLiveFontSize = useCallback(
        (size: number) => {
            webviewRef.current?.injectJavaScript(`
                (function() {
                    if (document.body) document.body.style.fontSize = '${size}px';
                    true;
                })();
            `);
        },
        [webviewRef],
    );

    const pinchGesture = Gesture.Pinch()
        .onBegin(() => {
            pinchStartFontSize.value = fontSize;
            pinchLastFontSize.value = fontSize;
        })
        .onUpdate((e) => {
            const next = Math.min(
                Math.max(Math.round(pinchStartFontSize.value * e.scale), 16),
                40,
            );
            // Skip redundant frames — the px value only changes at discrete
            // scale thresholds, so most frames map to the same size.
            if (next === pinchLastFontSize.value) return;
            pinchLastFontSize.value = next;
            runOnJS(applyLiveFontSize)(next);
        })
        .onEnd(() => {
            // Commit the final size to the store exactly once.
            runOnJS(setFontSize)(pinchLastFontSize.value);
        });

    // ── Link navigation ───────────────────────────────────────────────────────

    const handleLinkPress = async (href: string) => {
        if (isNavigating) return;

        // In-text scripture references linked by HtmlProcessor. The href carries
        // the raw reference (book name, chapter, paragraph, edition); resolve the
        // book to a book_id + volume here, at click time.
        if (href.startsWith("reref://")) {
            const [encBook, chapter, paragraph, edition] = href
                .slice("reref://".length)
                .split("/");
            const bookName = decodeURIComponent(encBook || "");

            let book_id: string;
            try {
                book_id = await getCanonicalBook(bookName);
            } catch {
                console.warn("Unknown reference book:", bookName);
                return;
            }

            const chapterData = await getChapterByReference(
                book_id,
                chapter || "1",
                edition,
            );
            if (chapterData) {
                navigateWithinActive({
                    volume_id: chapterData.volume_id,
                    book_id,
                    book_chapter: chapter,
                    position: paragraph,
                    chapter_id: chapterData.chapter_id,
                    name: chapterData.name,
                });
                return;
            }

            // No such Restoration Edition chapter. The text is then almost
            // always citing KJV/LDS chapter:verse numbers — sometimes even
            // labelled "RE", as the Covenant of Christ background does with
            // "(see Jer. 39:1–2 RE)", where RE Jeremiah has only 19 chapters.
            // Convert through the reference mapping rather than dropping the
            // tap on the floor.
            const mapped = await getREReferences(
                book_id,
                Number(chapter),
                Number(paragraph),
                Number(paragraph),
            );
            if (mapped.length === 0) {
                console.error(
                    "Reference chapter not found:",
                    bookName,
                    chapter,
                );
                return;
            }

            const target = mapped[0];
            navigateWithinActive({
                volume_id: target.volume_id,
                book_id: target.book_id,
                book_chapter: target.chapter,
                position: target.start_paragraph,
                chapter_id: target.chapter_id,
                name: target.name,
            });
            return;
        }

        const parts = href.split("/");
        const volume = parts[2];
        const book = parts[3];
        const [chapter, tmp] = parts[4].split(".");
        const position = tmp ? tmp.split("-")[0] : null;
        const chapterData = await getChapterByReference(
            parts[3],
            chapter || "1",
        );

        if (!chapterData) {
            console.error("Chapter not found:", parts[3], chapter);
            return;
        }

        const chapterNav = {
            volume_id: volume,
            book_id: book,
            book_chapter: chapter,
            position: position,
            chapter_id: chapterData.chapter_id,
            name: chapterData.name,
        };
        navigateWithinActive(chapterNav);
    };

    // ── WebView scripts ───────────────────────────────────────────────────────

    const injectedJavaScriptBeforeContentLoaded = useCallback(() => {
        const applyStyles = buildApplyStyles({
            backgroundColor,
            foregroundColor,
            fontSize,
            fontFamily,
            alignment,
            markerColor,
        });
        return `${applyStyles} ${buildLinkInjectedJavaScript(Platform.OS === "ios")} true`;
    }, [
        backgroundColor,
        foregroundColor,
        fontSize,
        fontFamily,
        alignment,
        markerColor,
    ]);

    // ── FAB state ─────────────────────────────────────────────────────────────

    const [isOpen, setOpen] = useState({ open: false });
    const onStateChange = ({ open }: { open: boolean }) => setOpen({ open });
    const { open } = isOpen;

    // FAB.Group's expanded action buttons are driven by `open`, independent of
    // the `visible` prop passed to ReaderFAB below — leaving `open` true while
    // this screen is backgrounded left the actions (e.g. the cog) rendered on
    // top of whatever screen the user navigated to, since react-native-paper's
    // Portal draws outside the navigation stack. Force-collapse on blur.
    useFocusEffect(
        useCallback(() => {
            return () => setOpen({ open: false });
        }, []),
    );
    const { width } = useWindowDimensions();
    const modalWidth = Math.min(width, 800);

    const audioAvailable =
        params.volume_id !== "gl" &&
        !(
            params.volume_id === "tc" &&
            params.book_id === "section" &&
            parseInt(params.book_chapter, 10) >= 178 &&
            parseInt(params.book_chapter, 10) <= 185
        );

    // ── WebView source memo ───────────────────────────────────────────────────

    const webViewSource = useMemo((): WebViewSource | undefined => {
        if (!state.html || !params.volume_id) return undefined;
        // On iOS, WKWebView only loads the document's file:// font references
        // when a file:// baseUrl grants read access to their directory. Android
        // loads them directly, so it needs no baseUrl.
        return {
            html: state.html,
            ...(Platform.OS === "ios" ? { baseUrl: getFontsBaseUrl() } : {}),
        } as WebViewSource;
    }, [state.html, params.volume_id]);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <PaperProvider>
            <View
                style={[
                    styles.container,
                    commonStyles.noPaddingMargin,
                    { backgroundColor: colors.background },
                ]}
            >
                <GestureDetector
                    gesture={Gesture.Simultaneous(
                        Gesture.Native(),
                        doubleTap,
                        pinchGesture,
                    )}
                >
                    <WebView
                        originWhitelist={["*"]}
                        source={webViewSource}
                        scalesPageToFit={false}
                        style={commonStyles.fill}
                        ref={webviewRef}
                        containerStyle={{ backgroundColor: backgroundColor }}
                        allowFileAccess={true}
                        allowsLinkPreview={true}
                        allowUniversalAccessFromFileURLs={true}
                        allowFileAccessFromFileURLs={true}
                        setDisplayZoomControls={true}
                        automaticallyAdjustContentInsets={false}
                        contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
                        decelerationRate={0.998}
                        bounces={true}
                        scrollEnabled={true}
                        showsVerticalScrollIndicator={true}
                        injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded()}
                        menuItems={
                            Platform.OS === "ios"
                                ? [
                                      { label: "Annotate", key: "annotate" },
                                      { label: "Copy", key: "copy" },
                                      { label: "Search", key: "search" },
                                      { label: "Lookup", key: "lookup" },
                                  ]
                                : []
                        }
                        suppressMenuItems={
                            Platform.OS === "ios" ? ["translate", "share"] : []
                        }
                        onCustomMenuSelection={(webViewEvent) => {
                            const { key, selectedText } =
                                webViewEvent.nativeEvent;
                            if (key === "annotate") {
                                webviewRef.current?.injectJavaScript(`
                                    if (window.__lastRangeData && window.__showHighlightModal) {
                                        window.__showHighlightModal(window.__lastRangeData);
                                    }
                                    true;
                                `);
                            } else if (key === "copy") {
                                webviewRef.current?.injectJavaScript(`
                                    (function() {
                                        var text = ${JSON.stringify(selectedText || "")};
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                            navigator.clipboard.writeText(text).catch(function(){});
                                        } else {
                                            var ta = document.createElement('textarea');
                                            ta.value = text;
                                            ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
                                            document.body.appendChild(ta);
                                            ta.select();
                                            document.execCommand('copy');
                                            document.body.removeChild(ta);
                                        }
                                    })();
                                    true;
                                `);
                            } else if (key === "search") {
                                let searchText = selectedText || "";
                                if (searchText.length > 150) {
                                    searchText = searchText
                                        .slice(0, 150)
                                        .replace(/\s+\S*$/, "");
                                }
                                if (searchText) {
                                    navigation.navigate("Search", {
                                        initialQuery: searchText,
                                    });
                                }
                            } else if (key === "lookup") {
                                const lookupText = (selectedText || "").slice(
                                    0,
                                    150,
                                );
                                if (lookupText) {
                                    const query =
                                        encodeURIComponent(lookupText);
                                    Linking.openURL(
                                        `https://www.google.com/search?q=define+${query}`,
                                    );
                                }
                            }
                        }}
                        onMessage={(event) => {
                            try {
                                const data = JSON.parse(event.nativeEvent.data);
                                if (data.type === "link") {
                                    handleLinkPress(data.href);
                                } else if (
                                    data.type === "updateMarkType" ||
                                    data.type === "colorSelect" ||
                                    data.type === "deleteOrphanHighlight" ||
                                    data.type === "deleteHighlight"
                                ) {
                                    onHighlightMessage(data);
                                } else if (data.type === "scroll") {
                                    if (
                                        data.position &&
                                        data.position !==
                                            currentParagraphPosition
                                    ) {
                                        console.log(
                                            "Scroll detected - updating reference:",
                                            params.book_id,
                                            params.book_chapter,
                                            data.position,
                                        );
                                        setCurrentParagraphPosition(
                                            data.position,
                                        );
                                        setActivePosition(data.position);
                                        setCurrentReference(
                                            params.book_id,
                                            params.book_chapter,
                                            data.position,
                                        );
                                    }
                                } else if (data.type === "searchText") {
                                    if (data.text) {
                                        navigation.navigate("Search", {
                                            initialQuery: data.text,
                                        });
                                    }
                                } else if (data.type === "defineText") {
                                    if (data.text) {
                                        if (Platform.OS === "android") {
                                            IntentLauncher.startActivityAsync(
                                                "android.intent.action.WEB_SEARCH",
                                                { extra: { query: data.text } },
                                            );
                                        } else {
                                            const query = encodeURIComponent(
                                                data.text,
                                            );
                                            Linking.openURL(
                                                `https://www.google.com/search?q=define+${query}`,
                                            );
                                        }
                                    }
                                } else if (data.type === "navigation") {
                                    if (data.direction === "previous") {
                                        previousChapter();
                                    } else if (data.direction === "next") {
                                        nextChapter();
                                    }
                                } else if (data.type === "imageZoom") {
                                    if (data.imageName) {
                                        setZoomImageName(data.imageName);
                                    }
                                }
                            } catch (error) {
                                console.error(
                                    "Error parsing WebView message:",
                                    error,
                                );
                            }
                        }}
                        onLoad={() => {
                            webviewRef.current?.injectJavaScript(
                                injectedJavaScriptBeforeContentLoaded(),
                            );
                        }}
                        onError={(syntheticEvent) => {
                            console.error(
                                "WebView error:",
                                syntheticEvent.nativeEvent,
                            );
                            dispatch({
                                type: ACTIONS.SET_WEBVIEW_LOADING,
                                payload: false,
                            });
                        }}
                        onLoadEnd={() => {
                            // Run on the next frame rather than a fixed 100 ms
                            // delay: onLoadEnd already means the document
                            // finished loading, and one frame is enough for
                            // layout so getElementById + scrollIntoView resolve.
                            const applyPostLoad = () => {
                                try {
                                    webviewRef.current?.injectJavaScript(
                                        buildScrollScript(state.position),
                                    );
                                    if (chapterHighlights.length > 0) {
                                        webviewRef.current?.injectJavaScript(
                                            SelectionHandler.generateApplyHighlightsScript(
                                                chapterHighlights,
                                            ),
                                        );
                                    }
                                } catch (error) {
                                    console.error(
                                        "Error injecting scroll script:",
                                        error,
                                    );
                                }
                                dispatch({
                                    type: ACTIONS.SET_WEBVIEW_LOADING,
                                    payload: false,
                                });
                                webviewRef.current?.injectJavaScript(
                                    contentLoaded,
                                );
                            };
                            requestAnimationFrame(applyPostLoad);
                        }}
                    />
                </GestureDetector>
                {state.webViewLoading && (
                    <View
                        style={[
                            styles.loadingOverlay,
                            { backgroundColor: backgroundColor },
                        ]}
                    >
                        <ActivityIndicator
                            size="large"
                            color={foregroundColor}
                        />
                    </View>
                )}
                <AudioControlModal />
                <ImageZoomModal
                    visible={zoomImageName !== null}
                    imageName={zoomImageName}
                    onClose={() => setZoomImageName(null)}
                />
                <BottomSheet
                    index={isBottomMenuOpen ? 0 : -1}
                    ref={bottomSheetRef}
                    backgroundStyle={styles.bottomSheetModalBackground}
                    snapPoints={snapPoints}
                    backdropComponent={renderBackdrop}
                    handleStyle={commonStyles.displayNone}
                    enableDynamicSizing={false}
                    enablePanDownToClose={true}
                    onClose={() => toggleBottomMenu(false)}
                >
                    <DisplayOptions maxWidth={modalWidth} />
                </BottomSheet>
                <ReaderFAB
                    visible={
                        isFocused && state.fabVisible && !state.webViewLoading
                    }
                    open={open}
                    onStateChange={onStateChange}
                    audioAvailable={audioAvailable}
                    onAudioPress={() => {
                        setOpen({ open: false });
                        setTimeout(() => {
                            toggleAudioModal(!isAudioModalOpen);
                        }, 300);
                    }}
                    onSettingsPress={() => {
                        console.log(
                            "toggleBottomMenu(" + !isBottomMenuOpen + ");",
                        );
                        toggleBottomMenu(!isBottomMenuOpen);
                    }}
                />
            </View>
            <Snackbar
                visible={audioUnavailableSnackbar}
                onDismiss={() => setAudioUnavailableSnackbar(false)}
                duration={3000}
            >
                <Text>{`Audio is not available for this ${params.volume_id === "gl" ? "entry" : "chapter"}.`}</Text>
            </Snackbar>
        </PaperProvider>
    );
}

const styles = StyleSheet.create({
    loadingOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
    },
    container: {
        flex: 1,
        flexGrow: 1,
        position: "relative",
        alignContent: "center",
    },
    bottomSheetModalBackground: {
        backgroundColor: colors.black,
    },
});

export default ReaderScreen;
