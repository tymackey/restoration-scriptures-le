import { useState, useCallback, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Dimensions, EmitterSubscription } from "react-native";
import WebView from "react-native-webview";
import * as TrackPlayer from "../util/TrackPlayer";
import { Event } from "@weights-ai/react-native-track-player";
import { ACTIONS, ReaderAction } from "../util/readerReducer";

interface ReaderAudioParams {
    params: {
        volume_id: string;
        book_id: string;
        book_chapter: number | string;
        name: string;
    };
    isNavigating: boolean;
    navigation: any;
    webviewRef: React.RefObject<WebView>;
    dispatch: React.Dispatch<ReaderAction>;
    isAudioModalOpen: boolean;
    toggleAudioModal: (v: boolean) => void;
    voice: string;
    rate: number;
    isAutoPlaying: boolean;
    toggleBottomMenu: (v: boolean) => void;
    onQueueEnded: () => void;
}

interface ReaderAudioResult {
    audioUnavailableSnackbar: boolean;
    setAudioUnavailableSnackbar: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useReaderAudio({
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
    onQueueEnded,
}: ReaderAudioParams): ReaderAudioResult {
    const [audioUnavailableSnackbar, setAudioUnavailableSnackbar] =
        useState(false);

    // Open/close audio modal and queue chapter tracks
    useFocusEffect(
        useCallback(() => {
            async function handleAudioModalVisibility(
                isOpen: boolean,
                currentVoice: string,
            ) {
                if (isNavigating) return;

                await TrackPlayer.waitForPlayer();
                await TrackPlayer.clearQueue([]);

                if (isOpen) {
                    dispatch({ type: ACTIONS.TOGGLE_FAB, payload: false });
                    await TrackPlayer.updateNotificationVisibility(true);

                    const activeTrackIndex =
                        await TrackPlayer.getActiveTrackIndex();
                    const progress = await TrackPlayer.getProgress();

                    const chapterInfo = {
                        volume: params.volume_id,
                        book: params.book_id,
                        chapter: params.book_chapter + "",
                        name: params.name,
                    };
                    const queued = await TrackPlayer.queueChapter(
                        chapterInfo,
                        currentVoice,
                        activeTrackIndex,
                        progress.position,
                    );
                    if (!queued) {
                        toggleAudioModal(false);
                        dispatch({ type: ACTIONS.TOGGLE_FAB, payload: true });
                        setAudioUnavailableSnackbar(true);
                        return;
                    }
                    if (isAutoPlaying) {
                        TrackPlayer.play();
                    }
                } else {
                    dispatch({ type: ACTIONS.TOGGLE_FAB, payload: true });
                    await TrackPlayer.updateNotificationVisibility(false);
                }
            }

            handleAudioModalVisibility(isAudioModalOpen, voice);
        }, [
            params.volume_id,
            params.book_id,
            params.book_chapter,
            params.name,
            isAudioModalOpen,
            voice,
            isNavigating,
            isAutoPlaying,
        ]),
    );

    // Subscribe to track player events (queue ended → next chapter, track changed → auto-scroll)
    useEffect(() => {
        let queueEndedSubscription: EmitterSubscription;
        let activeTrackChangedSubscription: EmitterSubscription;

        const focusSubscription = navigation.addListener("focus", () => {
            queueEndedSubscription = TrackPlayer.addEventListener(
                Event.PlaybackQueueEnded,
                () => {
                    activeTrackChangedSubscription?.remove();
                    onQueueEnded();
                },
            );

            activeTrackChangedSubscription = TrackPlayer.addEventListener(
                Event.PlaybackActiveTrackChanged,
                (event: any) => {
                    if (isAutoPlaying && !isNavigating) {
                        const position = event.track?.title.split(":")[1];
                        webviewRef.current?.injectJavaScript(`
                        (function() {
                            try {
                                const element = document.getElementById('${Number(position) > 0 ? position : 1}');
                                if (element) {
                                    element.scrollIntoView({
                                        block: 'start',
                                        behavior: 'smooth'
                                    });
                                } else {
                                    console.log('Element with id ${Number(position) > 0 ? position : 1} not found for auto-scroll');
                                }
                            } catch(e) {
                                console.error('Error in auto-scroll:', e);
                            }
                            true;
                        })();
                    `);
                    }
                },
            );
        });

        const blurSubscription = navigation.addListener("blur", () => {
            queueEndedSubscription?.remove?.();
            activeTrackChangedSubscription?.remove?.();
        });

        return () => {
            if (focusSubscription && focusSubscription.remove) {
                focusSubscription.remove();
            }
            if (blurSubscription && blurSubscription.remove) {
                blurSubscription.remove();
            }
        };
    }, [navigation]);

    // Toggle audio modal when auto-play state changes
    useFocusEffect(
        useCallback(() => {
            if (isNavigating) return;
            if (!isAutoPlaying) {
                toggleAudioModal(false);
            } else {
                toggleAudioModal(true);
            }
        }, [isAutoPlaying, isNavigating]),
    );

    // Set playback rate when it changes
    useFocusEffect(
        useCallback(() => {
            TrackPlayer.setRate(parseFloat(rate.toString()));
        }, [rate]),
    );

    // Reset orientation and close modals on focus
    useFocusEffect(
        useCallback(() => {
            const updateOrientation = () => {
                Dimensions.get("window");
                toggleBottomMenu(false);
            };

            updateOrientation();
            const subscription = Dimensions.addEventListener(
                "change",
                updateOrientation,
            );

            toggleBottomMenu(false);
            toggleAudioModal(false);

            return () => subscription?.remove();
        }, []),
    );

    // Stop playback and clear queue when screen loses focus
    useFocusEffect(
        useCallback(() => {
            return () => {
                const cleanup = async () => {
                    try {
                        await TrackPlayer.stop();
                        await TrackPlayer.clearQueue([]);
                        await TrackPlayer.updateNotificationVisibility(false);
                    } catch (error) {
                        console.log("TrackPlayer cleanup error:", error);
                    }
                };
                cleanup();
            };
        }, []),
    );

    // Additional blur cleanup to stop playback when navigating away
    useFocusEffect(
        useCallback(() => {
            return () => {
                const cleanup = async () => {
                    try {
                        await TrackPlayer.stop();
                        await TrackPlayer.clearQueue([]);
                        await TrackPlayer.updateNotificationVisibility(false);
                    } catch (error) {
                        console.log("TrackPlayer blur cleanup error:", error);
                    }
                };
                cleanup();
            };
        }, []),
    );

    return { audioUnavailableSnackbar, setAudioUnavailableSnackbar };
}
