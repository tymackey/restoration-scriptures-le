import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            // Redirect react-native to a mock at the Vite level so Flow-typed
            // source is never loaded (even by pre-compiled node_modules like RNTL).
            "react-native": path.resolve(
                __dirname,
                "test-mocks/react-native.ts",
            ),
        },
    },
    test: {
        environment: "node",
        include: ["app/**/__tests__/**/*.test.{ts,tsx}"],
        globals: true,
        setupFiles: ["./vitest.setup.ts"],
    },
});
