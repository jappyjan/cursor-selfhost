import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    sequence: { concurrent: false },
    setupFiles: ["./test-setup.ts"],
  },
});
