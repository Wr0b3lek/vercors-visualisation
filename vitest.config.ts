import { defineConfig } from "vitest/config";

// The engine (engine.ts) is pure TypeScript with no React or DOM
// dependencies, so the node environment is enough. Tests live next to the
// source as *.test.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
