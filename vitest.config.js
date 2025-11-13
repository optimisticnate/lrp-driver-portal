/* Proprietary and confidential. See LICENSE. */
import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./src", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setupTests.js"],
    css: true,
    exclude: ["**/node_modules/**", "**/dist/**", "src/components/__tests__/TimeClock.test.jsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage"
    }
  }
});
