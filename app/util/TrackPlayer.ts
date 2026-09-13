import TrackPlayer, {
    Capability,
    AppKilledPlaybackBehavior,
    useTrackPlayerEvents,
} from "@weights-ai/react-native-track-player";
import { AppState, Platform } from "react-native";

// Resolves when setupPlayer() + updateOptions() have both completed.
// Any code that calls TrackPlayer methods should await waitForPlayer() first.
let _setupPromise: Promise<void> | null = null;

/**
 * Awaits player setup, starting it if nothing has yet.
 * Safe to call multiple times — resolves immediately once setup is done.
 *
 * Previously this was a no-op when _setupPromise was null, which let callers
 * that ran before App's registration effect reach an uninitialized native
 * player ("The player is not initialized. Call setupPlayer first.").
 * Registering lazily instead closes that window.
 */
export async function waitForPlayer(): Promise<void> {
    if (!_setupPromise) {
        await registerPlayService();
        return;
    }
    await _setupPromise;
}

/**
 * Resolves once the app is foregrounded.
 *
 * Android refuses setupPlayer() unless the activity is resumed — "On Android
 * the app must be in the foreground when setting up the player." That happens
 * on cold/OTA launches where JS runs before onResume, and the rejection used
 * to cascade into "The player is not initialized" on the next call.
 *
 * Waiting (rather than throwing) also keeps _setupPromise pending instead of
 * cleared, so a backgrounded app does not retry setup on every guarded call.
 *
 * iOS is exempt: background audio is enabled there and setup is legal while
 * backgrounded, so gating would deadlock a legitimate background resume.
 */
function waitForForeground(): Promise<void> {
    if (Platform.OS !== "android" || AppState.currentState === "active") {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                subscription.remove();
                resolve();
            }
        });
    });
}

async function registerPlayService(): Promise<void> {
    // Idempotent: a second App mount (Fabric double-invoked effect, OTA
    // reload, remount) must reuse the in-flight or completed setup. Calling
    // setupPlayer() twice throws "The player has already been initialized".
    if (_setupPromise) {
        return _setupPromise;
    }

    const promise = (async () => {
        await waitForForeground();
        await TrackPlayer.setupPlayer();
        await TrackPlayer.updateOptions({
            android: {
                appKilledPlaybackBehavior:
                    AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
            },
            capabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
                Capability.Stop,
                Capability.JumpForward,
                Capability.JumpBackward,
            ],
        });
    })();

    _setupPromise = promise;

    // A failed setup must not poison every later waitForPlayer() call.
    // Dropping the handle lets the next caller retry instead of awaiting a
    // permanently rejected promise. Only clear it if a newer registration
    // has not already replaced it.
    promise.catch(() => {
        if (_setupPromise === promise) {
            _setupPromise = null;
        }
    });

    return promise;
}

async function updateNotificationVisibility(isVisible) {
    await waitForPlayer();
    if (isVisible) {
        await TrackPlayer.updateOptions({
            android: {
                // Show notification when modal is visible
                appKilledPlaybackBehavior:
                    AppKilledPlaybackBehavior.ContinuePlayback,
            },
            // Ensure headphone capabilities are maintained when notification is visible
            capabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
                Capability.Stop,
                Capability.JumpForward,
                Capability.JumpBackward,
            ],
        });
    } else {
        await TrackPlayer.updateOptions({
            android: {
                // Hide notification when modal is not visible
                appKilledPlaybackBehavior:
                    AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
            },
        });
        // Also stop playback when hiding modal
        await TrackPlayer.stop();
    }
}

function getTrackUrl(
    volume: string,
    book: string,
    chapter: string,
    voice: string,
    trackId: string,
) {
    // https://scriptures.info/audio/44k/female1/bofm/1nephi/bofm.1nephi.1.p019.mp3
    const trackUrl = `https://scriptures.info/audio/44k/${voice}/${volume}/${book}/${volume}.${book}.${chapter}.${trackId}.mp3`;
    return trackUrl;
}

/**
 * Fetches the tracklist JSON for a chapter from scriptures.info
 * @returns Array of track IDs like ["np001", "p001", "p002", ...]
 */
async function fetchChapterTracklist(
    volume: string,
    book: string,
    chapter: string,
    voice: string,
): Promise<string[]> {
    const url = `https://scriptures.info/audio/44k/${voice}/${volume}/${book}/${volume}.${book}.${chapter}.json`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to fetch tracklist: ${response.status}`);
            return [];
        }
        const tracklist = await response.json();
        return tracklist;
    } catch (error) {
        console.error("Error fetching chapter tracklist:", error);
        return [];
    }
}

const getArtworkUri = (volume: string) => {
    switch (volume) {
        case "cc":
            return require("../../assets/images/audio/cover-cc.jpg");
            break;
        case "oc":
            return require("../../assets/images/audio/cover-oc.jpg");
            break;
        case "nt":
            return require("../../assets/images/audio/cover-nc.jpg");
            break;
        case "bofm":
            return require("../../assets/images/audio/cover-nc.jpg");
            break;
        case "tc":
            return require("../../assets/images/audio/cover-tc.jpg");
            break;
        default:
            return require("../../assets/images/audio/cover-cc.jpg");
            break;
    }
};

interface ChapterInfo {
    volume: string;
    book: string;
    chapter: string;
    name: string;
}

/**
 * Queues a chapter for playback by fetching the tracklist from scriptures.info
 * @param chapterInfo - Basic chapter information
 * @param voice - The voice to use (e.g., "male1", "female1")
 * @param activeTrackIndex - Optional index to skip to
 * @param position - Optional position to seek to
 */
async function queueChapter(
    chapterInfo: ChapterInfo,
    voice: string,
    activeTrackIndex?: number | null,
    position?: number,
): Promise<boolean> {
    await waitForPlayer();
    const { volume, book, chapter, name } = chapterInfo;

    // Fetch the tracklist JSON from scriptures.info
    const tracklist = await fetchChapterTracklist(volume, book, chapter, voice);

    if (tracklist.length === 0) {
        console.warn("No tracks found for chapter:", volume, book, chapter);
        return false;
    }

    let displayName = name;
    if (!displayName.match(/\s\d+$/) && book !== "glossary") {
        displayName += " 1";
    }

    // Build tracks from the tracklist
    let tracks = [];
    for (let i = 0; i < tracklist.length; i++) {
        const trackId = tracklist[i];
        const isParatext = trackId.startsWith("np");

        // Extract paragraph number from trackId (e.g., "p001" -> 1, "np002" -> 2)
        const paragraphNum = parseInt(trackId.replace(/^n?p/, ""), 10);

        const track = {
            url: getTrackUrl(volume, book, chapter, voice, trackId),
            artist: "Restoration Scriptures Foundation",
            title: displayName + (!isParatext ? `:${paragraphNum}` : ""),
            volume: volume,
        };
        tracks.push(track);
    }

    // Set the queue
    await TrackPlayer.setQueue(tracks);

    // Update metadata for each track
    for (let i = 0; i < tracks.length; i++) {
        try {
            await TrackPlayer.updateMetadataForTrack(i, {
                artist: "Restoration Scriptures Foundation",
                title: tracks[i].title,
            });
        } catch (error) {
            console.error(`Error updating metadata for track ${i}:`, error);
        }
    }

    if (
        activeTrackIndex !== null &&
        activeTrackIndex !== undefined &&
        activeTrackIndex >= 0 &&
        activeTrackIndex < tracks.length
    ) {
        await TrackPlayer.skip(activeTrackIndex);

        if (position) {
            await TrackPlayer.seekTo(Math.max(Math.floor(position - 1), 0));
        }
    } else {
        console.log(
            "No active track index specified, first track should be active",
        );
    }
    return true;
}

async function resetQueue() {
    await waitForPlayer();
    const queue = await TrackPlayer.getQueue();
    TrackPlayer.setQueue(queue);
}

/**
 * Updates metadata for a specific track with artwork
 * @param {number} trackIndex - The index of the track to update
 * @param {string} volume - The volume to get artwork for
 * @param {string} title - The track title
 */
async function updateTrackMetadata(trackIndex, volume, title) {
    console.log("updateTrackMetadata: ", trackIndex, volume, title);

    // Validate trackIndex before using it
    if (trackIndex === null || trackIndex === undefined || trackIndex < 0) {
        console.warn(
            "Invalid track index provided to updateTrackMetadata:",
            trackIndex,
        );
        return;
    }

    try {
        await waitForPlayer();
        // Get current queue to validate index bounds
        const queue = await TrackPlayer.getQueue();
        if (trackIndex >= queue.length) {
            console.warn(
                `Track index ${trackIndex} is out of bounds for queue length ${queue.length}`,
            );
            return;
        }

        await TrackPlayer.updateMetadataForTrack(trackIndex, {
            artwork: getArtworkUri(volume),
        });
    } catch (error) {
        console.error("Error updating track metadata:", error);
        // Continue without artwork if there's an error
    }
}

/**
 * Wraps a raw TrackPlayer method so it can never run against an uninitialized
 * native player. Every wrapped call awaits waitForPlayer() first.
 *
 * These were previously bare re-exports, so the ~38 call sites outside
 * useReaderAudio's modal effect reached the native module with no guard at
 * all. Wrapping here covers them without touching the call sites.
 *
 * Deliberately not applied to addEventListener/useTrackPlayerEvents: those
 * return a subscription synchronously and callers remove() it on cleanup.
 */
function guard<A extends unknown[], R>(
    method: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
    return async (...args: A): Promise<R> => {
        await waitForPlayer();
        return Reflect.apply(method, TrackPlayer, args);
    };
}

const play = guard(TrackPlayer.play);
const pause = guard(TrackPlayer.pause);
const stop = guard(TrackPlayer.stop);
const skipToNext = guard(TrackPlayer.skipToNext);
const skipToPrevious = guard(TrackPlayer.skipToPrevious);
const clearQueue = guard(TrackPlayer.setQueue);
const getActiveTrackIndex = guard(TrackPlayer.getActiveTrackIndex);
const skip = guard(TrackPlayer.skip);
const setRate = guard(TrackPlayer.setRate);
const getActiveTrack = guard(TrackPlayer.getActiveTrack);
const getProgress = guard(TrackPlayer.getProgress);
const seekBy = guard(TrackPlayer.seekBy);
const reset = guard(TrackPlayer.reset);
const getPlaybackState = guard(TrackPlayer.getPlaybackState);
const getQueue = guard(TrackPlayer.getQueue);
const addEventListener = TrackPlayer.addEventListener;
const updateMetadataForTrack = guard(TrackPlayer.updateMetadataForTrack);

export {
    registerPlayService,
    updateNotificationVisibility,
    queueChapter,
    getTrackUrl,
    play,
    pause,
    stop,
    skipToNext,
    skipToPrevious,
    clearQueue,
    resetQueue,
    getActiveTrackIndex,
    skip,
    setRate,
    getActiveTrack,
    getProgress,
    reset,
    getPlaybackState,
    getQueue,
    useTrackPlayerEvents,
    addEventListener,
    seekBy,
    updateMetadataForTrack,
    updateTrackMetadata,
};
