import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@/engine": r("./src/engine"),
      "@/viz": r("./src/viz"),
      "@/store": r("./src/store"),
      "@": r("./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      // Test scaffolding, snapshots, and the pure-viz shell carry no logic worth
      // a coverage floor; the engine is where the number matters.
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/*.d.ts",
        "src/engine/testing/**",
        "src/engine/__golden__/**",
      ],
    },
  },
});
