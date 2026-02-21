/**
 * Must run before any imports that load @cursor-selfhost/db
 */
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

process.env.DATABASE_PATH = ":memory:";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.RUN_E2E_WITH_REAL_CURSOR) {
  // E2E: load .env so CURSOR_CLI_PATH, CURSOR_API_KEY match app runtime
  config({ path: path.resolve(__dirname, ".env") });
} else {
  // Use mock Cursor CLI (no real agent required)
  process.env.CURSOR_CLI_PATH = path.resolve(__dirname, "scripts/mock-cursor-agent.js");
}
