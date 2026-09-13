import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { UserDatabaseProvider, useUserDatabase } from "./UserDatabaseContext";
import { USER_DATABASE_SCHEMA } from "./UserDatabaseSchema";

// Database cleanup component that handles proper resource management
function DatabaseCleanupManager() {
    const db = useSQLiteContext();
    const userDb = useUserDatabase();
    const isCleaningUp = useRef(false);
    const activeQueryCount = useRef(0);
    const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastQueryTime = useRef<number>(0);
    const isFTS5Query = useRef(false);
    const isWrapped = useRef(false);

    // Track active queries to prevent cleanup conflicts
    useEffect(() => {
        // Prevent multiple wrapping which causes double-finalization crashes
        if (isWrapped.current) {
            return;
        }
        isWrapped.current = true;

        const originalGetAllAsync = db.getAllAsync;
        const originalGetFirstAsync = db.getFirstAsync;
        const originalExecAsync = db.execAsync;

        const trackQuery = (sql: string) => {
            activeQueryCount.current++;
            lastQueryTime.current = Date.now();
            const upper = sql.toUpperCase();
            if (upper.includes("FTS_PARAGRAPHS") || upper.includes("MATCH")) {
                isFTS5Query.current = true;
            }
        };

        const untrackQuery = () => {
            activeQueryCount.current = Math.max(
                0,
                activeQueryCount.current - 1,
            );
        };

        db.getAllAsync = async (...args: any[]) => {
            trackQuery(args[0]?.toString() || "");
            try {
                return await originalGetAllAsync.apply(db, args);
            } finally {
                untrackQuery();
            }
        };

        db.getFirstAsync = async (...args: any[]) => {
            trackQuery(args[0]?.toString() || "");
            try {
                return await originalGetFirstAsync.apply(db, args);
            } finally {
                untrackQuery();
            }
        };

        db.execAsync = async (...args: any[]) => {
            trackQuery(args[0]?.toString() || "");
            try {
                return await originalExecAsync.apply(db, args);
            } finally {
                untrackQuery();
            }
        };
    }, [db]);

    useEffect(() => {
        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            if (nextAppState === "background" || nextAppState === "inactive") {
                if (isCleaningUp.current) return;
                isCleaningUp.current = true;

                try {
                    // If FTS5 queries have been used this session, skip all background
                    // cleanup. Running execAsync or WAL checkpoint while FTS5 vtabs are
                    // connected races with the native closeDatabase call on iOS and causes
                    // KERN_INVALID_ADDRESS crashes (exsqlite3_finalize on freed memory).
                    // The isFTS5Query flag is reset when the app returns to foreground.
                    if (isFTS5Query.current) {
                        console.log(
                            "FTS5 queries detected, skipping background cleanup to prevent native crash",
                        );
                        return;
                    }

                    if (cleanupTimeoutRef.current) {
                        clearTimeout(cleanupTimeoutRef.current);
                    }

                    // Wait for all active queries to complete (max 5 seconds)
                    let waitIterations = 0;
                    while (
                        activeQueryCount.current > 0 &&
                        waitIterations < 50
                    ) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, 100),
                        );
                        waitIterations++;
                    }

                    if (activeQueryCount.current > 0) {
                        console.log(
                            "Active queries still running, aborting cleanup to prevent crashes",
                        );
                        return;
                    }

                    // Brief buffer after last query before touching the DB
                    const timeSinceLastQuery =
                        Date.now() - lastQueryTime.current;
                    const bufferTime = Math.max(300, 1000 - timeSinceLastQuery);
                    await new Promise((resolve) =>
                        setTimeout(resolve, bufferTime),
                    );

                    // Final guard in case queries started during the buffer wait
                    if (activeQueryCount.current > 0 || isFTS5Query.current) {
                        return;
                    }

                    try {
                        await db.execAsync("PRAGMA wal_checkpoint(PASSIVE)");
                    } catch (walError) {
                        console.warn("WAL checkpoint failed:", walError);
                    }

                    console.log(
                        "Scripture database cleanup completed successfully",
                    );

                    try {
                        await userDb.execAsync(
                            "PRAGMA wal_checkpoint(PASSIVE)",
                        );
                        console.log(
                            "User database cleanup completed successfully",
                        );
                    } catch (userDbError) {
                        console.warn(
                            "User database cleanup failed:",
                            userDbError,
                        );
                    }
                } catch (error) {
                    console.error("Error during database cleanup:", error);
                } finally {
                    isCleaningUp.current = false;
                }
            } else if (nextAppState === "active") {
                console.log("App returning to foreground");
                isCleaningUp.current = false;
                // Safe to reset now — the DB is in foreground and no close is imminent
                isFTS5Query.current = false;

                if (cleanupTimeoutRef.current) {
                    clearTimeout(cleanupTimeoutRef.current);
                    cleanupTimeoutRef.current = null;
                }
            }
        };

        const subscription = AppState.addEventListener(
            "change",
            handleAppStateChange,
        );

        return () => {
            subscription?.remove();
            if (cleanupTimeoutRef.current) {
                clearTimeout(cleanupTimeoutRef.current);
            }
        };
    }, [db]);

    return null; // This component doesn't render anything
}

// User database initializer component that runs the schema on first launch
function UserDatabaseInitializer() {
    const userDb = useUserDatabase();

    useEffect(() => {
        (async () => {
            try {
                await userDb.execAsync(USER_DATABASE_SCHEMA);

                // v1 → v2: add mark_type column if missing
                const markTypeCol = await userDb.getFirstAsync<{ cnt: number }>(
                    "SELECT COUNT(*) as cnt FROM pragma_table_info('highlights') WHERE name='mark_type'",
                );
                if (!markTypeCol || markTypeCol.cnt === 0) {
                    await userDb.execAsync(
                        "ALTER TABLE highlights ADD COLUMN mark_type TEXT NOT NULL DEFAULT 'highlight'",
                    );
                    console.log(
                        "User database migrated to v2: added mark_type column",
                    );
                }

                // v2 → v3: add end_paragraph_position column if missing
                const endParaCol = await userDb.getFirstAsync<{ cnt: number }>(
                    "SELECT COUNT(*) as cnt FROM pragma_table_info('highlights') WHERE name='end_paragraph_position'",
                );
                if (!endParaCol || endParaCol.cnt === 0) {
                    await userDb.execAsync(
                        "ALTER TABLE highlights ADD COLUMN end_paragraph_position INTEGER",
                    );
                    console.log(
                        "User database migrated to v3: added end_paragraph_position column",
                    );
                }

                console.log("User database initialized successfully");
            } catch (error) {
                console.error("Error initializing user database:", error);
            }
        })();
    }, [userDb]);

    return null;
}

export default function DatabaseProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SQLiteProvider
            databaseName="scriptures_v2.1.db"
            assetSource={{
                assetId: require("../../assets/scriptures_v2.1.db"),
            }}
            onError={(error) => {
                console.error("Database open error:", error);
            }}
        >
            <UserDatabaseProvider>
                <DatabaseCleanupManager />
                <UserDatabaseInitializer />
                {children}
            </UserDatabaseProvider>
        </SQLiteProvider>
    );
}
