/**
 * DB package tests — run with: pnpm test
 */
process.env.DATABASE_PATH = ":memory:";

import { describe, expect, it, beforeAll } from "vitest";
import { db, runMigrations, ensureAppConfigDefaults } from "./src/client";
import * as schema from "./src/schema";

beforeAll(() => {
  runMigrations();
});

describe("DB client", () => {
  it("runs migrations", async () => {
    const result = await db.select().from(schema.appConfig);
    expect(Array.isArray(result)).toBe(true);
  });

  it("ensureAppConfigDefaults seeds app_config", async () => {
    await ensureAppConfigDefaults();
    const rows = await db.select().from(schema.appConfig);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const keys = rows.map((r) => r.key);
    expect(keys).toContain("send_shortcut");
  });
});
