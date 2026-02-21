import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    setupFiles: ["./test-setup.ts"],
    env: {
      DATABASE_PATH: ":memory:",
    },
  },
});
