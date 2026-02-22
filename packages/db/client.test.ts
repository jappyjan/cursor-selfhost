/**
 * DB package tests — run with: pnpm test
 * Uses in-memory SQLite via test-setup.ts
 */
import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
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

  it("messages table has image_paths column (required for sending messages)", async () => {
    const rows = await db.select().from(schema.messages).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("project_mcp_servers table exists (required for MCP config)", async () => {
    const rows = await db.select().from(schema.projectMcpServers);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("project_mcp_servers has config column (for stdio/url/desktop)", async () => {
    const id = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date();
    await db.insert(schema.projects).values({
      id: id(),
      slug: "mcp-config-test",
      name: "MCP Config Test",
      path: "/tmp/mcp-test",
      sourceType: "local",
      createdAt: now,
      updatedAt: now,
    });
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.slug, "mcp-config-test"));
    const serverId = id();
    await db.insert(schema.projectMcpServers).values({
      id: serverId,
      projectId: project.id,
      name: "url-server",
      command: "url",
      args: "[]",
      config: JSON.stringify({ url: "https://example.com/mcp" }),
      enabled: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
    const [inserted] = await db.select().from(schema.projectMcpServers).where(eq(schema.projectMcpServers.id, serverId));
    expect(inserted).toHaveProperty("config");
    expect(inserted.config).toContain("https://example.com/mcp");
  });
});
