/**
 * Tests for the DatabaseCleanupManager cleanup logic in DatabaseProvider.tsx.
 *
 * Strategy: DatabaseCleanupManager is a React hook component that cannot be
 * imported directly in a Node test environment.  Instead we replicate its
 * internal ref state machine and the two key effects (method-wrapping and
 * AppState handler) as plain TypeScript functions, then drive them directly.
 *
 * Each describe block targets one of the four bugs that were fixed:
 *
 *   Bug 1 — execAsync was not tracked by activeQueryCount
 *   Bug 2 — FTS5 reset query (MATCH '') was syntactically invalid and a no-op
 *   Bug 3 — background cleanup raced with native closeDatabase when FTS5 used
 *   Bug 4 — isFTS5Query cleared via setTimeout, racing with cleanup checks
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers — mirrors the ref() pattern used by React's useRef
// ---------------------------------------------------------------------------

type Ref<T> = { current: T };
function ref<T>(initial: T): Ref<T> {
    return { current: initial };
}

// ---------------------------------------------------------------------------
// Mock interfaces — minimal surface needed by the component
// ---------------------------------------------------------------------------

interface MockDb {
    getAllAsync: (...args: any[]) => Promise<any[]>;
    getFirstAsync: (...args: any[]) => Promise<any>;
    execAsync: (...args: any[]) => Promise<void>;
}

interface MockUserDb {
    execAsync: (...args: any[]) => Promise<void>;
}

function makeMockDb(): MockDb & { _execCalls: string[] } {
    const _execCalls: string[] = [];
    return {
        _execCalls,
        getAllAsync: vi.fn(() => Promise.resolve([])),
        getFirstAsync: vi.fn(() => Promise.resolve(null)),
        execAsync: vi.fn(async (sql: string) => {
            _execCalls.push(sql);
        }),
    };
}

function makeMockUserDb(): MockUserDb & { _execCalls: string[] } {
    const _execCalls: string[] = [];
    return {
        _execCalls,
        execAsync: vi.fn(async (sql: string) => {
            _execCalls.push(sql);
        }),
    };
}

// ---------------------------------------------------------------------------
// Simulation — replicates the wrapping useEffect from DatabaseCleanupManager
// ---------------------------------------------------------------------------

interface WrappingState {
    activeQueryCount: Ref<number>;
    lastQueryTime: Ref<number>;
    isFTS5Query: Ref<boolean>;
}

/**
 * Applies the method-wrapping logic from DatabaseCleanupManager's first
 * useEffect.  Returns the shared ref state so tests can read/assert it.
 */
function applyWrapping(db: MockDb): WrappingState {
    const activeQueryCount = ref(0);
    const lastQueryTime = ref<number>(0);
    const isFTS5Query = ref(false);

    const originalGetAllAsync = db.getAllAsync.bind(db);
    const originalGetFirstAsync = db.getFirstAsync.bind(db);
    const originalExecAsync = db.execAsync.bind(db);

    const trackQuery = (sql: string) => {
        activeQueryCount.current++;
        lastQueryTime.current = Date.now();
        const upper = sql.toUpperCase();
        if (upper.includes("FTS_PARAGRAPHS") || upper.includes("MATCH")) {
            isFTS5Query.current = true;
        }
    };

    const untrackQuery = () => {
        activeQueryCount.current = Math.max(0, activeQueryCount.current - 1);
    };

    db.getAllAsync = async (...args: any[]) => {
        trackQuery(args[0]?.toString() || "");
        try {
            return await originalGetAllAsync(...args);
        } finally {
            untrackQuery();
        }
    };

    db.getFirstAsync = async (...args: any[]) => {
        trackQuery(args[0]?.toString() || "");
        try {
            return await originalGetFirstAsync(...args);
        } finally {
            untrackQuery();
        }
    };

    db.execAsync = async (...args: any[]) => {
        trackQuery(args[0]?.toString() || "");
        try {
            return await originalExecAsync(...args);
        } finally {
            untrackQuery();
        }
    };

    return { activeQueryCount, lastQueryTime, isFTS5Query };
}

// ---------------------------------------------------------------------------
// Simulation — replicates the AppState useEffect from DatabaseCleanupManager
// ---------------------------------------------------------------------------

interface CleanupState extends WrappingState {
    isCleaningUp: Ref<boolean>;
    cleanupTimeoutRef: Ref<ReturnType<typeof setTimeout> | null>;
}

type AppStateStatus = "active" | "background" | "inactive";

/**
 * Replicates handleAppStateChange from DatabaseCleanupManager's second
 * useEffect.  Uses the same shared refs produced by applyWrapping().
 */
function makeHandleAppStateChange(
    db: MockDb,
    userDb: MockUserDb,
    state: CleanupState,
) {
    return async (nextAppState: AppStateStatus) => {
        const {
            isCleaningUp,
            activeQueryCount,
            lastQueryTime,
            isFTS5Query,
            cleanupTimeoutRef,
        } = state;

        if (nextAppState === "background" || nextAppState === "inactive") {
            if (isCleaningUp.current) return;
            isCleaningUp.current = true;

            try {
                // Fix 3 — skip ALL cleanup when FTS5 queries have been used
                if (isFTS5Query.current) {
                    return;
                }

                if (cleanupTimeoutRef.current) {
                    clearTimeout(cleanupTimeoutRef.current);
                }

                // Wait for active queries (max 5 s)
                let waitIterations = 0;
                while (activeQueryCount.current > 0 && waitIterations < 50) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    waitIterations++;
                }

                if (activeQueryCount.current > 0) {
                    return;
                }

                // Brief buffer after last query
                const timeSinceLastQuery = Date.now() - lastQueryTime.current;
                const bufferTime = Math.max(300, 1000 - timeSinceLastQuery);
                await new Promise((resolve) => setTimeout(resolve, bufferTime));

                // Final guard
                if (activeQueryCount.current > 0 || isFTS5Query.current) {
                    return;
                }

                await db.execAsync("PRAGMA wal_checkpoint(PASSIVE)");
                await userDb.execAsync("PRAGMA wal_checkpoint(PASSIVE)");
            } catch (_err) {
                // swallow — matches component behaviour
            } finally {
                isCleaningUp.current = false;
            }
        } else if (nextAppState === "active") {
            isCleaningUp.current = false;
            // Fix 4 — reset only on foreground, never via setTimeout
            isFTS5Query.current = false;

            if (cleanupTimeoutRef.current) {
                clearTimeout(cleanupTimeoutRef.current);
                cleanupTimeoutRef.current = null;
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let db: ReturnType<typeof makeMockDb>;
let userDb: ReturnType<typeof makeMockUserDb>;
let wrappingState: WrappingState;
let cleanupState: CleanupState;
let handleAppStateChange: (state: AppStateStatus) => Promise<void>;

beforeEach(() => {
    vi.useFakeTimers();
    db = makeMockDb();
    userDb = makeMockUserDb();
    wrappingState = applyWrapping(db);
    cleanupState = {
        ...wrappingState,
        isCleaningUp: ref(false),
        cleanupTimeoutRef: ref(null),
    };
    handleAppStateChange = makeHandleAppStateChange(db, userDb, cleanupState);
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

// ===========================================================================
// Bug 1 — execAsync was not tracked
// ===========================================================================

describe("Bug 1 fix — execAsync is tracked alongside getAllAsync/getFirstAsync", () => {
    it("increments activeQueryCount while execAsync is in flight", async () => {
        // Use a deferred promise so we can observe the count before it resolves.
        let resolveExec!: () => void;
        const deferred = new Promise<void>((res) => {
            resolveExec = res;
        });
        const db2 = makeMockDb();
        (db2 as any).execAsync = vi.fn(() => deferred);
        const state = applyWrapping(db2);

        const queryPromise = db2.execAsync("PRAGMA wal_checkpoint(PASSIVE)");
        expect(state.activeQueryCount.current).toBe(1); // in flight

        resolveExec();
        await queryPromise;
        expect(state.activeQueryCount.current).toBe(0); // settled
    });

    it("decrements activeQueryCount after execAsync resolves", async () => {
        await db.execAsync("PRAGMA wal_checkpoint(PASSIVE)");
        expect(wrappingState.activeQueryCount.current).toBe(0);
    });

    it("increments activeQueryCount while getAllAsync is in flight", async () => {
        let resolveAll!: (v: any[]) => void;
        const deferred = new Promise<any[]>((res) => {
            resolveAll = res;
        });
        const db2 = makeMockDb();
        (db2 as any).getAllAsync = vi.fn(() => deferred);
        const state = applyWrapping(db2);

        const queryPromise = db2.getAllAsync("SELECT * FROM chapters");
        expect(state.activeQueryCount.current).toBe(1);

        resolveAll([]);
        await queryPromise;
        expect(state.activeQueryCount.current).toBe(0);
    });

    it("increments activeQueryCount while getFirstAsync is in flight", async () => {
        let resolveFirst!: (v: any) => void;
        const deferred = new Promise<any>((res) => {
            resolveFirst = res;
        });
        const db2 = makeMockDb();
        (db2 as any).getFirstAsync = vi.fn(() => deferred);
        const state = applyWrapping(db2);

        const queryPromise = db2.getFirstAsync(
            "SELECT * FROM chapters LIMIT 1",
        );
        expect(state.activeQueryCount.current).toBe(1);

        resolveFirst(null);
        await queryPromise;
        expect(state.activeQueryCount.current).toBe(0);
    });

    it("count stays accurate across concurrent queries", async () => {
        const db2 = makeMockDb();
        const state = applyWrapping(db2);

        // Start three queries simultaneously without awaiting yet
        const p1 = db2.getAllAsync("SELECT 1");
        const p2 = db2.getFirstAsync("SELECT 2");
        const p3 = db2.execAsync("PRAGMA journal_mode");

        // All three should be in flight — but since our mocks resolve immediately,
        // they resolve on the microtask queue before we can read 3.
        // Flush them and verify they all completed cleanly (count = 0).
        await Promise.all([p1, p2, p3]);
        expect(state.activeQueryCount.current).toBe(0);
    });

    it("count never goes below zero if untrackQuery is called extra times", async () => {
        // The Math.max(0, ...) guard in untrackQuery must hold.
        // Simulate by calling the internal untrackQuery via a rejected query.
        const db3 = makeMockDb();
        (db3 as any).getAllAsync = vi.fn(() =>
            Promise.reject(new Error("db error")),
        );
        const state = applyWrapping(db3);

        await db3.getAllAsync("SELECT 1").catch(() => {
            /* expected */
        });

        // count should be 0, not -1
        expect(state.activeQueryCount.current).toBe(0);
    });
});

// ===========================================================================
// FTS5 detection via trackQuery
// ===========================================================================

describe("FTS5 detection — isFTS5Query flag", () => {
    it("sets isFTS5Query when getAllAsync SQL contains FTS_PARAGRAPHS", async () => {
        await db.getAllAsync(
            "SELECT * FROM fts_paragraphs WHERE fts_paragraphs MATCH ?",
        );
        expect(wrappingState.isFTS5Query.current).toBe(true);
    });

    it("sets isFTS5Query when getAllAsync SQL contains MATCH keyword", async () => {
        await db.getAllAsync(
            "SELECT snippet(fts_paragraphs,5,'','','...',64) as text FROM fts_paragraphs WHERE fts_paragraphs MATCH ?",
        );
        expect(wrappingState.isFTS5Query.current).toBe(true);
    });

    it("sets isFTS5Query when execAsync SQL contains FTS_PARAGRAPHS", async () => {
        // Before the fix, execAsync was not wrapped, so this flag was never set
        // from the PRAGMA initialization path or any execAsync call.
        await db.execAsync(
            "INSERT INTO fts_paragraphs(fts_paragraphs) VALUES('optimize')",
        );
        expect(wrappingState.isFTS5Query.current).toBe(true);
    });

    it("does NOT set isFTS5Query for plain SELECT queries", async () => {
        await db.getAllAsync("SELECT * FROM chapters WHERE chapter_id = ?");
        expect(wrappingState.isFTS5Query.current).toBe(false);
    });

    it("does NOT set isFTS5Query for PRAGMA execAsync calls", async () => {
        await db.execAsync("PRAGMA wal_checkpoint(PASSIVE)");
        expect(wrappingState.isFTS5Query.current).toBe(false);
    });

    it("flag is case-insensitive — lowercase fts_paragraphs still detected", async () => {
        await db.getAllAsync(
            "select * from fts_paragraphs where fts_paragraphs match ?",
        );
        expect(wrappingState.isFTS5Query.current).toBe(true);
    });
});

// ===========================================================================
// Bug 2 — Broken FTS5 reset query is no longer called on background
// ===========================================================================

describe("Bug 2 fix — invalid FTS5 reset query (MATCH '') is never called", () => {
    it("does not call execAsync with an empty MATCH string on background", async () => {
        cleanupState.isFTS5Query.current = false;
        cleanupState.activeQueryCount.current = 0;
        cleanupState.lastQueryTime.current = 0; // triggers max buffer of 1000ms

        const backgroundPromise = handleAppStateChange("background");
        await vi.runAllTimersAsync();
        await backgroundPromise;

        const allCalls: string[] = db._execCalls;
        const badQuery = allCalls.find((sql) => sql.includes("MATCH ''"));
        expect(badQuery).toBeUndefined();
    });

    it("does not call any FTS5-related query during background cleanup", async () => {
        cleanupState.isFTS5Query.current = false;
        cleanupState.activeQueryCount.current = 0;
        cleanupState.lastQueryTime.current = 0;

        const backgroundPromise = handleAppStateChange("background");
        await vi.runAllTimersAsync();
        await backgroundPromise;

        const ftsCalls = db._execCalls.filter(
            (sql) =>
                sql.toUpperCase().includes("FTS_PARAGRAPHS") ||
                sql.toUpperCase().includes("MATCH"),
        );
        expect(ftsCalls).toHaveLength(0);
    });
});

// ===========================================================================
// Bug 3 — Background cleanup skipped when FTS5 queries have been used
// ===========================================================================

describe("Bug 3 fix — background cleanup skipped when isFTS5Query is true", () => {
    it("does not call db.execAsync when isFTS5Query is true on background", async () => {
        cleanupState.isFTS5Query.current = true;
        cleanupState.activeQueryCount.current = 0;

        const backgroundPromise = handleAppStateChange("background");
        await vi.runAllTimersAsync();
        await backgroundPromise;

        // The WAL checkpoint and userDb checkpoint must NOT be called
        expect(db._execCalls).toHaveLength(0);
        expect(userDb._execCalls).toHaveLength(0);
    });

    it("does not call userDb.execAsync when isFTS5Query is true on background", async () => {
        cleanupState.isFTS5Query.current = true;

        const backgroundPromise = handleAppStateChange("background");
        await vi.runAllTimersAsync();
        await backgroundPromise;

        expect(userDb._execCalls).toHaveLength(0);
    });

    it("executes WAL checkpoint when isFTS5Query is false and no active queries", async () => {
        cleanupState.isFTS5Query.current = false;
        cleanupState.activeQueryCount.current = 0;
        cleanupState.lastQueryTime.current = 0; // ensures max buffer

        const backgroundPromise = handleAppStateChange("background");
        await vi.runAllTimersAsync();
        await backgroundPromise;

        expect(db._execCalls).toContain("PRAGMA wal_checkpoint(PASSIVE)");
        expect(userDb._execCalls).toContain("PRAGMA wal_checkpoint(PASSIVE)");
    });

    it("does not call PRAGMA optimize during background cleanup", async () => {
        // PRAGMA optimize was removed — it's not safe near FTS5 close
        cleanupState.isFTS5Query.current = false;
        cleanupState.activeQueryCount.current = 0;
        cleanupState.lastQueryTime.current = 0;

        const backgroundPromise = handleAppStateChange("background");
        await vi.runAllTimersAsync();
        await backgroundPromise;

        const optimizeCalls = db._execCalls.filter((sql) =>
            sql.includes("optimize"),
        );
        expect(optimizeCalls).toHaveLength(0);
    });

    it("skips cleanup if an FTS5 query runs between no-FTS initial check and the buffer wait", async () => {
        // isFTS5Query starts false, but becomes true during the buffer wait.
        // The final guard (activeQueryCount > 0 || isFTS5Query) must catch this.
        cleanupState.isFTS5Query.current = false;
        cleanupState.activeQueryCount.current = 0;
        cleanupState.lastQueryTime.current = 0;

        const backgroundPromise = handleAppStateChange("background");

        // Let the query-wait loop pass (no active queries, exits immediately),
        // but before the buffer timer fires, set isFTS5Query.
        await vi.advanceTimersByTimeAsync(50); // past the activeQueryCount loop
        cleanupState.isFTS5Query.current = true; // race condition simulated
        await vi.runAllTimersAsync();
        await backgroundPromise;

        expect(db._execCalls).toHaveLength(0);
    });

    it("aborts cleanup and does not WAL-checkpoint when active queries never drain", async () => {
        cleanupState.isFTS5Query.current = false;
        cleanupState.activeQueryCount.current = 1; // query never finishes

        const backgroundPromise = handleAppStateChange("background");
        await vi.runAllTimersAsync(); // advance past all 50 × 100ms iterations
        await backgroundPromise;

        expect(db._execCalls).toHaveLength(0);
    });

    it("does not start a second cleanup while the first is in progress", async () => {
        cleanupState.isFTS5Query.current = false;
        cleanupState.activeQueryCount.current = 0;
        cleanupState.lastQueryTime.current = 0;

        // Fire two background events before the first completes
        const p1 = handleAppStateChange("background");
        const p2 = handleAppStateChange("background"); // should be a no-op

        await vi.runAllTimersAsync();
        await Promise.all([p1, p2]);

        // WAL checkpoint should only appear once
        const walCalls = db._execCalls.filter((sql) =>
            sql.includes("wal_checkpoint"),
        );
        expect(walCalls).toHaveLength(1);
    });
});

// ===========================================================================
// Bug 4 — isFTS5Query resets only on foreground return, not via setTimeout
// ===========================================================================

describe("Bug 4 fix — isFTS5Query resets on foreground, not via setTimeout", () => {
    it("resets isFTS5Query to false when app returns to active", async () => {
        cleanupState.isFTS5Query.current = true;

        await handleAppStateChange("active");

        expect(cleanupState.isFTS5Query.current).toBe(false);
    });

    it("resets isCleaningUp to false when app returns to active", async () => {
        cleanupState.isCleaningUp.current = true;

        await handleAppStateChange("active");

        expect(cleanupState.isCleaningUp.current).toBe(false);
    });

    it("isFTS5Query is still true after background when FTS5 was used — only resets on foreground", async () => {
        // Simulate: user searched (sets isFTS5Query), then backgrounds
        cleanupState.isFTS5Query.current = true;

        const backgroundPromise = handleAppStateChange("background");
        await vi.runAllTimersAsync();
        await backgroundPromise;

        // Still true — it was not cleared by the background handler
        expect(cleanupState.isFTS5Query.current).toBe(true);

        // Foreground clears it
        await handleAppStateChange("active");
        expect(cleanupState.isFTS5Query.current).toBe(false);
    });

    it("cleanup runs on the NEXT background after foreground resets the flag", async () => {
        // Cycle: FTS5 search → background (skipped) → foreground → background (runs)
        cleanupState.isFTS5Query.current = true;
        cleanupState.activeQueryCount.current = 0;
        cleanupState.lastQueryTime.current = 0;

        // First background — should be skipped
        const bg1 = handleAppStateChange("background");
        await vi.runAllTimersAsync();
        await bg1;
        expect(db._execCalls).toHaveLength(0);

        // Foreground resets state
        await handleAppStateChange("active");
        expect(cleanupState.isFTS5Query.current).toBe(false);

        // Second background — should now run
        const bg2 = handleAppStateChange("background");
        await vi.runAllTimersAsync();
        await bg2;
        expect(db._execCalls).toContain("PRAGMA wal_checkpoint(PASSIVE)");
    });

    it("isFTS5Query is not cleared by any setTimeout during query tracking", async () => {
        // The old code had: setTimeout(() => { isFTS5Query.current = false; }, 200)
        // The new code has no such timer. Verify flag persists after queries complete.
        await db.getAllAsync(
            "SELECT * FROM fts_paragraphs WHERE fts_paragraphs MATCH ?",
        );
        expect(wrappingState.isFTS5Query.current).toBe(true);

        // Advance time well past the old 200ms timer that no longer exists
        await vi.advanceTimersByTimeAsync(500);
        expect(wrappingState.isFTS5Query.current).toBe(true);
    });
});
