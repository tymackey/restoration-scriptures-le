import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, Text } from "react-native";
import { IconButton, Menu, Snackbar } from "react-native-paper";
import * as TrackPlayer from "../util/TrackPlayer";
import {
    Event,
    PlaybackQueueEndedEvent,
    PlaybackState,
    State,
    useTrackPlayerEvents,
} from "@weights-ai/react-native-track-player";
import { useSettingsStore } from "../data/useSettingsStore";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { PaperProvider } from "react-native-paper";
import { addEventListener } from "@react-native-community/netinfo";
import { useFocusEffect } from "@react-navigation/native";
import { colors } from "../constants/colors";

const AudioControlModal = () => {
    const voices = [
        {
            id: "male1",
            label: "Tony (adult)",
        },
        {
            id: "female1",
            label: "Jane (adult)",
        },
        {
            id: "male2",
            label: "Davis (adult)",
        },
        {
            id: "female2",
            label: "Ana (child)",
        },
    ];
    const rates = [
        {
            id: 0.5,
            label: "0.5x",
        },
        {
            id: 0.75,
            label: "0.75x",
        },
        {
            id: 1,
            label: "1x",
        },
        {
            id: 1.25,
            label: "1.25x",
        },
        {
            id: 1.5,
            label: "1.5x",
        },
        {
            id: 1.75,
            label: "1.75x",
        },
        {
            id: 2,
            label: "2x",
        },
    ];

    const [voiceMenuVisible, setVoiceMenuVisible] = useState(false);
    const [rateMenuVisible, setRateMenuVisible] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [isConnected, setIsConnected] = useState(true);

    const isAutoPlaying = useSettingsStore((state) => state.isAutoPlaying);
    const voice = useSettingsStore((state) => state.voice);
    const setVoice = useSettingsStore((state) => state.setVoice);
    const rate = useSettingsStore((state) => state.rate);
    const setRate = useSettingsStore((state) => state.setRate);
    const isAudioModalOpen = useSettingsStore(
        (state) => state.isAudioModalOpen,
    );
    const toggleAudioModal = useSettingsStore(
        (state) => state.toggleAudioModal,
    );

    const togglePlayPause = async () => {
        if (!isConnected) {
            setSnackbarVisible(true);
            return;
        }

        try {
            if (isPlaying) {
                await TrackPlayer.pause();
            } else {
                // Check if we have an active track before trying to play
                const activeTrack = await TrackPlayer.getActiveTrack();
                if (!activeTrack) {
                    console.warn("No active track, cannot play");
                    return;
                }
                await TrackPlayer.play();

                // Force update track title after starting playback
                setTimeout(async () => {
                    try {
                        const newActiveTrack =
                            await TrackPlayer.getActiveTrack();
                        if (newActiveTrack?.title) {
                            setTrackTitle(newActiveTrack.title);
                        }
                    } catch (error) {
                        console.error(
                            "Error getting active track after play:",
                            error,
                        );
                    }
                }, 100);
            }
            // setIsPlaying(!isPlaying);
        } catch (error) {
            console.error("Error toggling play/pause:", error);
            // Don't update UI state if the operation failed
        }
    };

    const stopAudio = () => {
        TrackPlayer.stop().catch(() => {
            /* player may not be ready yet */
        });
        TrackPlayer.resetQueue().catch(() => {
            /* player may not be ready yet */
        });
        setIsPlaying(false);
    };

    const changeVoice = (voice) => {
        setVoice(voice);
        setVoiceMenuVisible(false);
    };

    const changeRate = (rate) => {
        setRate(parseFloat(rate));
        setRateMenuVisible(false);
    };

    const [trackTitle, setTrackTitle] = useState("");

    // Use focus effect to close modal when screen loses focus
    useFocusEffect(
        useCallback(() => {
            const trackChangedListener = TrackPlayer.addEventListener(
                Event.PlaybackActiveTrackChanged,
                async (event) => {
                    if (event.track?.title) {
                        setTrackTitle(event.track.title);
                        if (
                            event.index !== null &&
                            event.index !== undefined &&
                            event.index >= 0
                        ) {
                            TrackPlayer.updateTrackMetadata(
                                event.index,
                                event.track.volume,
                                event.track.title,
                            );
                        }
                    } else {
                        // Fallback: try to get the active track title directly
                        try {
                            const activeTrack =
                                await TrackPlayer.getActiveTrack();
                            const activeTrackIndex =
                                await TrackPlayer.getActiveTrackIndex();
                            if (activeTrack?.title) {
                                setTrackTitle(activeTrack.title);
                                if (
                                    activeTrackIndex !== null &&
                                    activeTrackIndex !== undefined &&
                                    activeTrackIndex >= 0
                                ) {
                                    TrackPlayer.updateTrackMetadata(
                                        activeTrackIndex,
                                        activeTrack.volume,
                                        activeTrack.title,
                                    );
                                }
                            }
                        } catch (error) {
                            console.error(
                                "Error fetching active track title:",
                                error,
                            );
                        }
                    }
                },
            );

            // const queueEndedListener = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, (event: PlaybackQueueEndedEvent) => {
            //     stopAudio();
            // });

            const playbackStateListener = TrackPlayer.addEventListener(
                Event.PlaybackState,
                (event: PlaybackState) => {
                    if (event.state === State.Playing) {
                        setIsPlaying(true);
                    }
                    if (event.state === State.Paused) {
                        setIsPlaying(false);
                    }
                },
            );

            const remotePlayListener = TrackPlayer.addEventListener(
                Event.RemotePlay,
                () => {
                    TrackPlayer.play();
                    setIsPlaying(true);
                },
            );

            const remotePauseListener = TrackPlayer.addEventListener(
                Event.RemotePause,
                () => {
                    TrackPlayer.pause();
                    setIsPlaying(false);
                },
            );

            const remoteNextListener = TrackPlayer.addEventListener(
                Event.RemoteNext,
                () => {
                    TrackPlayer.skipToNext();
                },
            );

            const remotePreviousListener = TrackPlayer.addEventListener(
                Event.RemotePrevious,
                () => {
                    TrackPlayer.skipToPrevious();
                },
            );

            const remoteJumpForwardListener = TrackPlayer.addEventListener(
                Event.RemoteJumpForward,
                () => {
                    TrackPlayer.seekBy(10);
                },
            );

            const remoteJumpBackwardListener = TrackPlayer.addEventListener(
                Event.RemoteJumpBackward,
                () => {
                    TrackPlayer.seekBy(-10);
                },
            );

            // This runs when the screen gains focus
            return () => {
                // This runs when the screen loses focus - close the modal
                trackChangedListener.remove();
                // queueEndedListener.remove();
                playbackStateListener.remove();
                remotePlayListener.remove();
                remotePauseListener.remove();
                remoteNextListener.remove();
                remotePreviousListener.remove();
                remoteJumpForwardListener.remove();
                remoteJumpBackwardListener.remove();
            };
        }, []),
    );

    useEffect(() => {
        const initializeModalState = async () => {
            if (isAudioModalOpen) {
                try {
                    // Small delay to ensure queue is set up
                    await new Promise((resolve) => setTimeout(resolve, 100));

                    // Check playback state
                    const state = await TrackPlayer.getPlaybackState();
                    setIsPlaying(state.state === "playing");

                    // Check queue state
                    const queue = await TrackPlayer.getQueue();

                    // Get current track title if available
                    const activeTrack = await TrackPlayer.getActiveTrack();
                    if (activeTrack?.title) {
                        setTrackTitle(activeTrack.title);
                    } else {
                        // Retry once more after a short delay
                        setTimeout(async () => {
                            try {
                                const retryTrack =
                                    await TrackPlayer.getActiveTrack();
                                if (retryTrack?.title) {
                                    setTrackTitle(retryTrack.title);
                                }
                            } catch (error) {
                                console.error(
                                    "Error in track title retry:",
                                    error,
                                );
                            }
                        }, 200);
                    }
                } catch (error) {
                    console.error("Error initializing modal state:", error);
                }
            }
        };

        initializeModalState();
    }, [isAudioModalOpen]);

    useEffect(() => {
        if (isAutoPlaying) {
            setIsPlaying(true);
        } else {
            setIsPlaying(false);
        }
    }, [isAutoPlaying]);

    useEffect(() => {
        if (!isAudioModalOpen) {
            stopAudio();
            TrackPlayer.updateNotificationVisibility(false).catch(() => {
                /* player may not be ready yet */
            });
            setTrackTitle(""); // Clear track title when modal closes
        }

        const unsubscribe = addEventListener((state) => {
            setIsConnected(state.isConnected);
        });

        return () => {
            unsubscribe();
        };
    }, [isAudioModalOpen]);

    if (!isAudioModalOpen) {
        return null;
    }

    return (
        <View style={[styles.container, styles.containerBottom]}>
            <View style={styles.titleContainer}>
                <Text
                    style={styles.title}
                    numberOfLines={1}
                    ellipsizeMode="head"
                >
                    {trackTitle}
                </Text>
                <Text style={styles.closeIcon}>
                    <MaterialCommunityIcons.Button
                        name="close"
                        size={32}
                        color={colors.white}
                        backgroundColor={"transparent"}
                        underlayColor={"transparent"}
                        onPress={() => toggleAudioModal(false)}
                    />
                </Text>
            </View>
            <PaperProvider>
                <View style={styles.audioControls}>
                    <IconButton
                        icon="skip-previous"
                        iconColor={colors.white}
                        size={40}
                        style={styles.audioControlButton}
                        onPress={() => TrackPlayer.skipToPrevious()}
                    />
                    <IconButton
                        icon={({ size, color }) => (
                            <MaterialCommunityIcons
                                name={isPlaying ? "pause" : "play"}
                                size={size}
                                style={styles.audioControlButton}
                                color={color}
                            />
                        )}
                        iconColor={colors.white}
                        size={44}
                        onPress={togglePlayPause}
                    />
                    <IconButton
                        icon="stop"
                        iconColor={colors.white}
                        size={40}
                        style={styles.audioControlButton}
                        onPress={stopAudio}
                    />
                    <IconButton
                        icon="skip-next"
                        iconColor={colors.white}
                        size={40}
                        style={styles.audioControlButton}
                        onPress={() => TrackPlayer.skipToNext()}
                    />
                    <View style={styles.voiceContainer}>
                        <Menu
                            visible={voiceMenuVisible}
                            onDismiss={() => setVoiceMenuVisible(false)}
                            anchor={
                                <IconButton
                                    icon={({ size, color }) => (
                                        <MaterialCommunityIcons
                                            name={"account-voice"}
                                            size={size}
                                            color={color}
                                        />
                                    )}
                                    iconColor={colors.white}
                                    style={styles.menuButton}
                                    size={32}
                                    onPress={() => {
                                        setVoiceMenuVisible(!voiceMenuVisible);
                                    }}
                                />
                            }
                            anchorPosition="top"
                            style={[styles.menu, styles.menuOffsetVoice]}
                        >
                            {voices.map((voice) => (
                                <Menu.Item
                                    key={voice.id}
                                    onPress={() => changeVoice(voice.id)}
                                    title={voice.label}
                                />
                            ))}
                        </Menu>
                        <Text style={styles.voiceText}>
                            {voices
                                .find((v) => v.id === voice)
                                ?.label?.split(" ")[0] || "Voice"}
                        </Text>
                    </View>
                    <View style={styles.rateContainer}>
                        <Menu
                            visible={rateMenuVisible}
                            onDismiss={() => setRateMenuVisible(false)}
                            anchor={
                                <IconButton
                                    icon="speedometer"
                                    iconColor={colors.white}
                                    style={styles.menuButton}
                                    size={32}
                                    onPress={() => setRateMenuVisible(true)}
                                />
                            }
                            anchorPosition="top"
                            style={[styles.menu, styles.menuOffsetRate]}
                        >
                            {rates.map((rate) => (
                                <Menu.Item
                                    key={rate.id}
                                    onPress={() => changeRate(rate.id)}
                                    title={rate.label}
                                />
                            ))}
                        </Menu>
                        <Text style={styles.rateText}>
                            {rates.find((v) => v.id === rate)?.label || "1x"}
                        </Text>
                    </View>
                </View>
            </PaperProvider>
            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={3000}
                style={styles.snackbar}
            >
                <Text>
                    No network connection. Please check your internet connection
                    and try again.
                </Text>
            </Snackbar>
        </View>
    );
};

const styles = StyleSheet.create({
    containerBottom: { bottom: 20 },
    menuOffsetVoice: { top: -200 },
    menuOffsetRate: { top: -300 },
    container: {
        position: "absolute",
        left: 10,
        right: 10,
        backgroundColor: colors.overlayDark,
    },
    titleContainer: {
        flexDirection: "row",
        justifyContent: "center",
        alignContent: "center",
        marginTop: 12,
        marginBottom: 0,
    },
    title: {
        color: colors.white,
        fontSize: 24,
        paddingTop: 2,
        paddingLeft: 10,
        paddingRight: 10,
        width: "85%",
        textAlign: "center",
    },
    closeIcon: {
        position: "absolute",
        right: 0,
        top: -8,
        backgroundColor: colors.transparent,
    },
    audioControls: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        alignContent: "center",
        marginVertical: 0,
        marginHorizontal: 5,

        paddingTop: 10,
        paddingLeft: 2,
        paddingRight: 2,
        paddingBottom: 14,
        borderRadius: 5,
    },
    audioControlButton: {
        flexShrink: 1,
    },
    voiceContainer: {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        marginTop: -18,
        marginLeft: 1,
        marginRight: 1,
        paddingTop: 0,
        minWidth: 50,
        maxWidth: 55,
    },
    rateContainer: {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        marginTop: -18,
        marginLeft: 1,
        marginRight: 1,
        paddingTop: 0,
        minWidth: 50,
        maxWidth: 55,
    },
    menuButton: {
        marginBottom: 0,
    },
    menu: {
        position: "absolute",
    },
    voiceText: {
        marginLeft: -8,
        color: colors.white,
        fontSize: 14,
        textAlign: "center",
    },
    rateText: {
        marginLeft: 0,
        color: colors.white,
        fontSize: 14,
        textAlign: "center",
    },
    snackbar: {
        position: "absolute",
        bottom: 0,
        backgroundColor: colors.background,
    },
});

export default AudioControlModal;
