/**
 * User database context and provider for accessing the writable user data database.
 * This database stores user-generated content like highlights and is separate from
 * the read-only scripture database.
 */

import React, {
    createContext,
    useContext,
    useState,
    useMemo,
    ReactNode,
} from "react";
import * as SQLite from "expo-sqlite";

interface UserDatabaseContextType {
    db: SQLite.SQLiteDatabase | null;
}

const UserDatabaseContext = createContext<UserDatabaseContextType>({
    db: null,
});

/**
 * Hook to access the user database.
 * Must be used within a UserDatabaseProvider.
 *
 * @throws Error if used outside of UserDatabaseProvider
 * @returns SQLite.SQLiteDatabase instance for user data operations
 */
export function useUserDatabase(): SQLite.SQLiteDatabase {
    const context = useContext(UserDatabaseContext);
    if (!context.db) {
        throw new Error(
            "useUserDatabase must be used within UserDatabaseProvider",
        );
    }
    return context.db;
}

/**
 * Provider component that opens and provides access to the user database.
 * Uses openDatabaseSync which creates the database in the app's documents directory,
 * ensuring it persists across app updates (unlike the bundled scripture database).
 */
export function UserDatabaseProvider({ children }: { children: ReactNode }) {
    const [db] = useState<SQLite.SQLiteDatabase>(() =>
        SQLite.openDatabaseSync("user_data.db"),
    );

    const contextValue = useMemo(() => ({ db }), [db]);

    return (
        <UserDatabaseContext.Provider value={contextValue}>
            {children}
        </UserDatabaseContext.Provider>
    );
}
