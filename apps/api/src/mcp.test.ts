/**
 * Unit tests for MCP config writing.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, unlink, mkdir } from "fs/promises";
import { writeProjectMcpConfig, type McpServerConfig } from "./mcp";

describe("mcp", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "mcp-test-"));
  });

  it("writes mcp.json with enabled servers", async () => {
    const servers: McpServerConfig[] = [
      {
        id: "1",
        name: "filesystem",
        command: "npx",
        args: JSON.stringify(["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]),
        env: null,
        enabled: true,
      },
    ];
    await writeProjectMcpConfig(tmpDir, servers);
    const content = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers.filesystem).toEqual({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    });
  });

  it("includes env vars when present", async () => {
    const servers: McpServerConfig[] = [
      {
        id: "1",
        name: "github",
        command: "npx",
        args: JSON.stringify(["-y", "@modelcontextprotocol/server-github"]),
        env: JSON.stringify({ GITHUB_TOKEN: "secret" }),
        enabled: true,
      },
    ];
    await writeProjectMcpConfig(tmpDir, servers);
    const content = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.github.env).toEqual({ GITHUB_TOKEN: "secret" });
  });

  it("excludes disabled servers", async () => {
    const servers: McpServerConfig[] = [
      {
        id: "1",
        name: "enabled",
        command: "npx",
        args: "[]",
        env: null,
        enabled: true,
      },
      {
        id: "2",
        name: "disabled",
        command: "npx",
        args: "[]",
        env: null,
        enabled: false,
      },
    ];
    await writeProjectMcpConfig(tmpDir, servers);
    const content = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.enabled).toBeDefined();
    expect(parsed.mcpServers.disabled).toBeUndefined();
  });

  it("removes mcp.json when no enabled servers", async () => {
    const servers: McpServerConfig[] = [
      {
        id: "1",
        name: "only-disabled",
        command: "npx",
        args: "[]",
        env: null,
        enabled: false,
      },
    ];
    await mkdir(join(tmpDir, ".cursor"), { recursive: true });
    await writeProjectMcpConfig(tmpDir, servers);
    try {
      await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
      expect.fail("File should not exist");
    } catch (e) {
      expect((e as NodeJS.ErrnoException).code).toBe("ENOENT");
    }
  });

  it("handles empty args", async () => {
    const servers: McpServerConfig[] = [
      {
        id: "1",
        name: "minimal",
        command: "node",
        args: "[]",
        env: null,
        enabled: true,
      },
    ];
    await writeProjectMcpConfig(tmpDir, servers);
    const content = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.minimal.command).toBe("node");
    expect(parsed.mcpServers.minimal.args).toBeUndefined();
  });

  it("handles invalid args JSON gracefully", async () => {
    const servers: McpServerConfig[] = [
      {
        id: "1",
        name: "bad-args",
        command: "npx",
        args: "not-json",
        env: null,
        enabled: true,
      },
    ];
    await writeProjectMcpConfig(tmpDir, servers);
    const content = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers["bad-args"].command).toBe("npx");
  });
});
