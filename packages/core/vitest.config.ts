import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    testTimeout: 20000,
    include: ["test/**/*.test.ts"],
  },
});
