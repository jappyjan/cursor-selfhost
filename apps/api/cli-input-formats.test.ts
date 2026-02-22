/**
 * Tests what input formats the Cursor CLI agent accepts.
 * Run with real CLI: RUN_CLI_FORMAT_TESTS=1 pnpm test cli-input-formats
 * Or: pnpm test:cli (runs the script directly)
 *
 * Findings (verified 2025-02):
 * - Plain text: ✓
 * - JSON with OpenAI content blocks (text + image_url): ✓ (model processes images)
 * - JSON with text-only content: ✓
 * - Text referencing image file path in workspace: ✓
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const runWithRealCli = process.env.RUN_CLI_FORMAT_TESTS === "1";
const runTest = runWithRealCli ? it : it.skip;

describe("CLI input formats", () => {
  runTest(
    "accepts plain text, JSON with image_url, JSON text, and file path refs",
    { timeout: 130_000 },
    async () => {
      const scriptPath = join(__dirname, "scripts", "test-cli-input-formats.js");
      const result = spawnSync(
        "node",
        [scriptPath],
        {
          cwd: __dirname,
          env: {
            ...process.env,
            CURSOR_CLI_PATH: process.env.CURSOR_CLI_PATH || "agent",
          },
          encoding: "utf-8",
          timeout: 120_000,
        }
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/\d+\/\d+ tests passed/);
      expect(result.stdout).toContain("Vision: striped image (no hints)");
    }
  );
});
