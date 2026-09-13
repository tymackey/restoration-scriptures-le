/**
 * Tests for the waitForPlayer / registerPlayService race-condition fix.
 *
 * Root cause of RESTORATION-SCRIPTURES-9:
 *   registerPlayService() in App.tsx is fire-and-forget (async, not awaited).
 *   The Reader screen gains focus via a restored currentReference before
 *   setupPlayer() completes, then calls TrackPlayer methods, producing
 *   "The player is not initialized. Call setupPlayer first."
 *
 * Fix:
 *   registerPlayService() captures its async work in a module-level
 *   _setupPromise. waitForPlayer() awaits that promise so any caller can
 *   block until the player is truly ready.
 *
 * Strategy:
 *   _setupPromise is module-level state; each test calls vi.resetModules()
 *   and dynamically imports a fresh copy of TrackPlayer so state is isolated.
 *   vi.doMock() (not vi.mock()) is used inside beforeEach so it runs after
 *   the reset rather than being hoisted.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a promise and its resolve/reject handles. */
function deferred<T = void>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Module-level mock & import helpers
// ---------------------------------------------------------------------------

let mockSetupPlayer: ReturnType<typeof vi.fn>;
let mockUpdateOptions: ReturnType<typeof vi.fn>;
let mockPlay: ReturnType<typeof vi.fn>;
let mockAppState: {
    currentState: string;
    addEventListener: ReturnType<typeof vi.fn>;
};
let mockPlatform: { OS: string };
/** Handlers registered via AppState.addEventListener("change", ...). */
let appStateHandlers: ((state: string) => void)[];
/** Drives an AppState transition through every registered handler. */
let emitAppState: (state: string) => void;
let mockSetQueue: ReturnType<typeof vi.fn>;
let mockGetQueue: ReturnType<typeof vi.fn>;

type TrackPlayerModule = typeof import("../TrackPlayer");
let TrackPlayerUtil: TrackPlayerModule;

beforeEach(async () => {
    // Reset module registry so each test gets a fresh _setupPromise = null.
    vi.resetModules();

    mockSetupPlayer = vi.fn(() => Promise.resolve());
    mockUpdateOptions = vi.fn(() => Promise.resolve());
    mockPlay = vi.fn(() => Promise.resolve());

    // Default to a foregrounded Android app; individual tests override.
    appStateHandlers = [];
    mockPlatform = { OS: "android" };
    mockAppState = {
        currentState: "active",
        addEventListener: vi.fn((event: string, handler) => {
            if (event === "change") {
                appStateHandlers.push(handler);
            }
            return {
                remove: vi.fn(() => {
                    const i = appStateHandlers.indexOf(handler);
                    if (i >= 0) appStateHandlers.splice(i, 1);
                }),
            };
        }),
    };
    emitAppState = (state: string) => {
        mockAppState.currentState = state;
        [...appStateHandlers].forEach((h) => h(state));
    };

    vi.doMock("react-native", () => ({
        AppState: mockAppState,
        Platform: mockPlatform,
    }));
    mockSetQueue = vi.fn(() => Promise.resolve());
    mockGetQueue = vi.fn(() => Promise.resolve([]));

    // vi.doMock (not vi.mock) runs in place, after resetModules.
    vi.doMock("@weights-ai/react-native-track-player", () => ({
        default: {
            setupPlayer: mockSetupPlayer,
            updateOptions: mockUpdateOptions,
            stop: vi.fn(() => Promise.resolve()),
            setQueue: mockSetQueue,
            play: mockPlay,
            pause: vi.fn(() => Promise.resolve()),
            skipToNext: vi.fn(() => Promise.resolve()),
            skipToPrevious: vi.fn(() => Promise.resolve()),
            getActiveTrackIndex: vi.fn(() => Promise.resolve(0)),
            skip: vi.fn(() => Promise.resolve()),
            setRate: vi.fn(() => Promise.resolve()),
            getActiveTrack: vi.fn(() => Promise.resolve(null)),
            getProgress: vi.fn(() => Promise.resolve({ position: 0 })),
            seekBy: vi.fn(() => Promise.resolve()),
            reset: vi.fn(() => Promise.resolve()),
            getPlaybackState: vi.fn(() => Promise.resolve({ state: "paused" })),
            getQueue: mockGetQueue,
            addEventListener: vi.fn(() => ({ remove: vi.fn() })),
            updateMetadataForTrack: vi.fn(() => Promise.resolve()),
        },
        Capability: {
            Play: "play",
            Pause: "pause",
            SkipToNext: "skipToNext",
            SkipToPrevious: "skipToPrevious",
            Stop: "stop",
            JumpForward: "jumpForward",
            JumpBackward: "jumpBackward",
        },
        AppKilledPlaybackBehavior: {
            StopPlaybackAndRemoveNotification: "stop",
            ContinuePlayback: "continue",
        },
        useTrackPlayerEvents: vi.fn(),
    }));

    TrackPlayerUtil = await import("../TrackPlayer");
});

afterEach(() => {
    vi.clearAllMocks();
});

// ===========================================================================
// waitForPlayer — before registerPlayService is called
// ===========================================================================

describe("waitForPlayer — before registerPlayService is called", () => {
    it("registers lazily rather than no-opping when no setup has been initiated", async () => {
        // Previously this returned instantly with _setupPromise === null, so
        // the caller went on to hit an uninitialized native player. It must
        // now start setup and resolve only once the player is ready.
        await expect(TrackPlayerUtil.waitForPlayer()).resolves.toBeUndefined();
        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
    });

    it("can be called multiple times without setting up more than once", async () => {
        await TrackPlayerUtil.waitForPlayer();
        await TrackPlayerUtil.waitForPlayer();
        await expect(TrackPlayerUtil.waitForPlayer()).resolves.toBeUndefined();
        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
    });

    it("concurrent first calls share one setup", async () => {
        const setup = deferred();
        mockSetupPlayer.mockReturnValueOnce(setup.promise);

        const waits = [
            TrackPlayerUtil.waitForPlayer(),
            TrackPlayerUtil.waitForPlayer(),
            TrackPlayerUtil.waitForPlayer(),
        ];

        setup.resolve();
        await Promise.all(waits);

        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
    });
});

// ===========================================================================
// waitForPlayer — while registerPlayService is in progress
// ===========================================================================

describe("waitForPlayer — during registerPlayService (the race window)", () => {
    it("blocks until setupPlayer() resolves", async () => {
        const setup = deferred();
        mockSetupPlayer.mockReturnValueOnce(setup.promise);

        // Start registration but don't finish it yet.
        const regPromise = TrackPlayerUtil.registerPlayService();

        // waitForPlayer should be pending.
        let resolved = false;
        const waitPromise = TrackPlayerUtil.waitForPlayer().then(() => {
            resolved = true;
        });

        // Flush microtasks — still pending because setupPlayer hasn't resolved.
        await Promise.resolve();
        await Promise.resolve();
        expect(resolved).toBe(false);

        // Complete setup.
        setup.resolve();
        await regPromise;
        await waitPromise;

        expect(resolved).toBe(true);
    });

    it("blocks until updateOptions() resolves (setup is both steps)", async () => {
        // setupPlayer resolves immediately; updateOptions is slow.
        const optionsDeferred = deferred();
        mockUpdateOptions.mockReturnValueOnce(optionsDeferred.promise);

        const regPromise = TrackPlayerUtil.registerPlayService();

        let resolved = false;
        const waitPromise = TrackPlayerUtil.waitForPlayer().then(() => {
            resolved = true;
        });

        await Promise.resolve();
        await Promise.resolve();
        expect(resolved).toBe(false); // still waiting on updateOptions

        optionsDeferred.resolve();
        await regPromise;
        await waitPromise;

        expect(resolved).toBe(true);
    });

    it("multiple concurrent waitForPlayer() calls all resolve on setup completion", async () => {
        const setup = deferred();
        mockSetupPlayer.mockReturnValueOnce(setup.promise);

        const regPromise = TrackPlayerUtil.registerPlayService();

        const resolved: boolean[] = [false, false, false];
        const waits = [0, 1, 2].map((i) =>
            TrackPlayerUtil.waitForPlayer().then(() => {
                resolved[i] = true;
            }),
        );

        await Promise.resolve();
        expect(resolved).toEqual([false, false, false]);

        setup.resolve();
        await regPromise;
        await Promise.all(waits);

        expect(resolved).toEqual([true, true, true]);
    });
});

// ===========================================================================
// waitForPlayer — after registerPlayService completes
// ===========================================================================

describe("waitForPlayer — after registerPlayService completes", () => {
    it("resolves immediately once setup is done", async () => {
        await TrackPlayerUtil.registerPlayService();

        // Should resolve without any async delay.
        let resolved = false;
        await TrackPlayerUtil.waitForPlayer().then(() => {
            resolved = true;
        });
        expect(resolved).toBe(true);
    });

    it("resolves immediately on subsequent calls after setup", async () => {
        await TrackPlayerUtil.registerPlayService();

        await TrackPlayerUtil.waitForPlayer();
        await TrackPlayerUtil.waitForPlayer();
        await expect(TrackPlayerUtil.waitForPlayer()).resolves.toBeUndefined();
    });

    it("setupPlayer() is called exactly once during registerPlayService", async () => {
        await TrackPlayerUtil.registerPlayService();
        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
    });

    it("updateOptions() is called exactly once during registerPlayService", async () => {
        await TrackPlayerUtil.registerPlayService();
        expect(mockUpdateOptions).toHaveBeenCalledTimes(1);
    });
});

// ===========================================================================
// registerPlayService — _setupPromise is set before first await
// ===========================================================================

describe("registerPlayService — _setupPromise is assigned before the first await", () => {
    it("waitForPlayer is non-null immediately after registerPlayService() is called (synchronously)", async () => {
        // If _setupPromise were set after `await setupPlayer()`, the race window
        // would still exist. This test verifies it is set synchronously.

        const setup = deferred();
        mockSetupPlayer.mockReturnValueOnce(setup.promise);

        // Start registration — do NOT await it.
        const regPromise = TrackPlayerUtil.registerPlayService();

        // On the very next microtask, _setupPromise must already be set.
        // We verify this by checking that waitForPlayer() returns a thenable
        // (i.e., it is waiting on something rather than resolving instantly
        //  from null).
        let resolvedBeforeSetup = false;
        const waitPromise = TrackPlayerUtil.waitForPlayer().then(() => {
            resolvedBeforeSetup = true;
        });

        // After one microtask flush, setup is still pending.
        await Promise.resolve();
        expect(resolvedBeforeSetup).toBe(false);

        // Cleanup.
        setup.resolve();
        await regPromise;
        await waitPromise;
    });
});

// ===========================================================================
// Regression guard — the old code had no _setupPromise at all
// ===========================================================================

describe("regression — TrackPlayer calls without waitForPlayer would throw", () => {
    it("without waitForPlayer a call during setup would race (demonstrated)", async () => {
        const setup = deferred();
        mockSetupPlayer.mockReturnValueOnce(setup.promise);

        // Simulate what used to happen: registerPlayService starts but the
        // reader calls a player method immediately without waiting.
        //
        // In the old code, setQueue (clearQueue) would be called on an
        // uninitialized player.  Here we just verify that waitForPlayer()
        // properly serializes the call after setup completes.

        const callLog: string[] = [];
        const regPromise = TrackPlayerUtil.registerPlayService();

        // Simulate reader calling waitForPlayer then clearQueue.
        const readerTask = (async () => {
            await TrackPlayerUtil.waitForPlayer();
            callLog.push("clearQueue");
        })();

        // Simulate setup completing.
        setup.resolve();
        await regPromise;
        await readerTask;

        // clearQueue must only be called after setup is done.
        expect(callLog).toEqual(["clearQueue"]);
        expect(mockSetupPlayer).toHaveBeenCalled();
        expect(mockUpdateOptions).toHaveBeenCalled();
    });
});

// ===========================================================================
// registerPlayService — idempotence (RESTORATION-SCRIPTURES-26)
// ===========================================================================

describe("registerPlayService — idempotence", () => {
    it("a second call does not call setupPlayer() again", async () => {
        // The App effect can run twice (Fabric double-invoke, OTA reload,
        // remount). The second setupPlayer() would throw
        // "The player has already been initialized via setupPlayer."
        await TrackPlayerUtil.registerPlayService();
        await TrackPlayerUtil.registerPlayService();

        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
        expect(mockUpdateOptions).toHaveBeenCalledTimes(1);
    });

    it("a second call while the first is still in flight reuses it", async () => {
        const setup = deferred();
        mockSetupPlayer.mockReturnValueOnce(setup.promise);

        const first = TrackPlayerUtil.registerPlayService();
        const second = TrackPlayerUtil.registerPlayService();

        setup.resolve();
        await Promise.all([first, second]);

        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
    });

    it("many repeated registrations still set up exactly once", async () => {
        await Promise.all(
            Array.from({ length: 5 }, () =>
                TrackPlayerUtil.registerPlayService(),
            ),
        );
        await TrackPlayerUtil.registerPlayService();

        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
    });

    it("does not reject on a duplicate registration", async () => {
        await TrackPlayerUtil.registerPlayService();
        await expect(
            TrackPlayerUtil.registerPlayService(),
        ).resolves.toBeUndefined();
    });
});

// ===========================================================================
// registerPlayService — failure does not poison later calls
// ===========================================================================

describe("registerPlayService — recovery after a failed setup", () => {
    it("propagates the setup failure to the caller", async () => {
        mockSetupPlayer.mockRejectedValueOnce(new Error("setup boom"));

        await expect(TrackPlayerUtil.registerPlayService()).rejects.toThrow(
            "setup boom",
        );
    });

    it("clears the handle so a later call retries instead of re-rejecting", async () => {
        // The old code left _setupPromise holding a rejected promise forever,
        // so every subsequent waitForPlayer() rejected for the life of the
        // process — this is what turned one -26 into many -9s.
        mockSetupPlayer.mockRejectedValueOnce(new Error("setup boom"));

        await expect(TrackPlayerUtil.registerPlayService()).rejects.toThrow(
            "setup boom",
        );

        // Next attempt succeeds with the default mock.
        await expect(
            TrackPlayerUtil.registerPlayService(),
        ).resolves.toBeUndefined();
        expect(mockSetupPlayer).toHaveBeenCalledTimes(2);
    });

    it("waitForPlayer() recovers after a failed setup", async () => {
        mockSetupPlayer.mockRejectedValueOnce(new Error("setup boom"));

        await expect(TrackPlayerUtil.waitForPlayer()).rejects.toThrow(
            "setup boom",
        );

        await expect(TrackPlayerUtil.waitForPlayer()).resolves.toBeUndefined();
        expect(mockSetupPlayer).toHaveBeenCalledTimes(2);
    });

    it("a failure in updateOptions() also clears the handle", async () => {
        mockUpdateOptions.mockRejectedValueOnce(new Error("options boom"));

        await expect(TrackPlayerUtil.registerPlayService()).rejects.toThrow(
            "options boom",
        );
        await expect(
            TrackPlayerUtil.registerPlayService(),
        ).resolves.toBeUndefined();
    });

    it("does not clear a newer registration's handle", async () => {
        // A late rejection from a superseded attempt must not null out a
        // registration that has since succeeded.
        const failing = deferred();
        mockSetupPlayer.mockReturnValueOnce(failing.promise);

        const first = TrackPlayerUtil.registerPlayService();
        first.catch(() => {});

        failing.reject(new Error("slow boom"));
        await expect(first).rejects.toThrow("slow boom");

        // Now a fresh, successful registration.
        await TrackPlayerUtil.registerPlayService();
        expect(mockSetupPlayer).toHaveBeenCalledTimes(2);

        // The successful handle must still be in place.
        await TrackPlayerUtil.waitForPlayer();
        expect(mockSetupPlayer).toHaveBeenCalledTimes(2);
    });
});

// ===========================================================================
// Guarded exports — every player method awaits setup
// ===========================================================================

describe("guarded exports — player methods await setup", () => {
    it("play() sets the player up when nothing has registered yet", async () => {
        await TrackPlayerUtil.play();

        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
        expect(mockPlay).toHaveBeenCalledTimes(1);
    });

    it("play() does not reach the native method until setup completes", async () => {
        const setup = deferred();
        mockSetupPlayer.mockReturnValueOnce(setup.promise);

        const playPromise = TrackPlayerUtil.play();

        await Promise.resolve();
        await Promise.resolve();
        expect(mockPlay).not.toHaveBeenCalled();

        setup.resolve();
        await playPromise;

        expect(mockPlay).toHaveBeenCalledTimes(1);
    });

    it("clearQueue() is guarded (the call that produced -9 in the reader)", async () => {
        const setup = deferred();
        mockSetupPlayer.mockReturnValueOnce(setup.promise);

        const clearPromise = TrackPlayerUtil.clearQueue([]);

        await Promise.resolve();
        await Promise.resolve();
        expect(mockSetQueue).not.toHaveBeenCalled();

        setup.resolve();
        await clearPromise;

        expect(mockSetQueue).toHaveBeenCalledWith([]);
    });

    it("forwards arguments and return values through the guard", async () => {
        mockGetQueue.mockResolvedValueOnce([{ url: "a" }, { url: "b" }]);

        await expect(TrackPlayerUtil.getQueue()).resolves.toEqual([
            { url: "a" },
            { url: "b" },
        ]);
    });

    it("guarded calls after setup do not re-register", async () => {
        await TrackPlayerUtil.registerPlayService();

        await TrackPlayerUtil.play();
        await TrackPlayerUtil.pause();
        await TrackPlayerUtil.stop();

        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
    });

    it("addEventListener stays synchronous (returns a subscription)", async () => {
        // Callers store the result and call .remove() during cleanup, so this
        // one must NOT be wrapped in an async guard.
        const sub = TrackPlayerUtil.addEventListener(
            "playback-state" as never,
            () => {},
        );

        expect(sub).toBeDefined();
        expect(typeof sub.remove).toBe("function");
    });
});

// ===========================================================================
// Foreground gate (RESTORATION-SCRIPTURES-2J)
// ===========================================================================

describe("registerPlayService — Android foreground gate", () => {
    it("sets up immediately when Android is already foregrounded", async () => {
        mockAppState.currentState = "active";

        await TrackPlayerUtil.registerPlayService();

        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
        expect(mockAppState.addEventListener).not.toHaveBeenCalled();
    });

    it("does not call setupPlayer() while Android is backgrounded", async () => {
        // "On Android the app must be in the foreground when setting up the
        // player." Calling anyway is what produced -2J, which then cascaded
        // into -9 in the same trace.
        mockAppState.currentState = "background";

        const regPromise = TrackPlayerUtil.registerPlayService();

        await Promise.resolve();
        await Promise.resolve();

        expect(mockSetupPlayer).not.toHaveBeenCalled();
        expect(mockAppState.addEventListener).toHaveBeenCalledWith(
            "change",
            expect.any(Function),
        );

        // Cleanup: foreground so the pending registration can finish.
        emitAppState("active");
        await regPromise;
    });

    it("sets up once the app becomes active", async () => {
        mockAppState.currentState = "background";

        const regPromise = TrackPlayerUtil.registerPlayService();
        await Promise.resolve();
        expect(mockSetupPlayer).not.toHaveBeenCalled();

        emitAppState("active");
        await regPromise;

        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
        expect(mockUpdateOptions).toHaveBeenCalledTimes(1);
    });

    it("ignores non-active transitions while waiting", async () => {
        mockAppState.currentState = "background";

        const regPromise = TrackPlayerUtil.registerPlayService();
        await Promise.resolve();

        emitAppState("inactive");
        await Promise.resolve();
        expect(mockSetupPlayer).not.toHaveBeenCalled();

        emitAppState("background");
        await Promise.resolve();
        expect(mockSetupPlayer).not.toHaveBeenCalled();

        emitAppState("active");
        await regPromise;
        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
    });

    it("removes its AppState listener after foregrounding", async () => {
        mockAppState.currentState = "background";

        const regPromise = TrackPlayerUtil.registerPlayService();
        await Promise.resolve();
        expect(appStateHandlers).toHaveLength(1);

        emitAppState("active");
        await regPromise;

        expect(appStateHandlers).toHaveLength(0);
    });

    it("does not gate on iOS, where background setup is legal", async () => {
        // iOS has background audio enabled; gating there would deadlock a
        // legitimate background resume.
        mockPlatform.OS = "ios";
        mockAppState.currentState = "background";

        await TrackPlayerUtil.registerPlayService();

        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
        expect(mockAppState.addEventListener).not.toHaveBeenCalled();
    });

    it("a backgrounded app does not retry setup on every guarded call", async () => {
        // Without the gate, each guarded call would attempt setup, fail with
        // -2J, clear the handle, and let the next call try again — trading
        // -9 volume for -2J volume. The pending promise prevents that.
        mockAppState.currentState = "background";

        const calls = [
            TrackPlayerUtil.play(),
            TrackPlayerUtil.pause(),
            TrackPlayerUtil.stop(),
        ];

        await Promise.resolve();
        await Promise.resolve();

        expect(mockSetupPlayer).not.toHaveBeenCalled();
        expect(mockPlay).not.toHaveBeenCalled();

        emitAppState("active");
        await Promise.all(calls);

        // One shared setup for all three queued calls.
        expect(mockSetupPlayer).toHaveBeenCalledTimes(1);
        expect(mockPlay).toHaveBeenCalledTimes(1);
    });

    it("queued guarded calls run after foregrounding, in order", async () => {
        mockAppState.currentState = "background";

        const order: string[] = [];
        mockSetupPlayer.mockImplementationOnce(() => {
            order.push("setup");
            return Promise.resolve();
        });
        mockPlay.mockImplementationOnce(() => {
            order.push("play");
            return Promise.resolve();
        });

        const playPromise = TrackPlayerUtil.play();
        await Promise.resolve();

        emitAppState("active");
        await playPromise;

        expect(order).toEqual(["setup", "play"]);
    });
});
