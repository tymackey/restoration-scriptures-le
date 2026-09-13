/**
 * UUID generation utility using expo-crypto.
 * Provides cryptographically secure random UUIDs for database records.
 */

import * as Crypto from "expo-crypto";

export class UuidGenerator {
    /**
     * Generates a random UUID v4.
     * @returns A string containing a UUID in the format "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
     */
    static generate(): string {
        return Crypto.randomUUID();
    }
}
