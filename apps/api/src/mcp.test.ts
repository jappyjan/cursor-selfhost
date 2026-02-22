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
        config: null,
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
        config: null,
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
        config: null,
        enabled: true,
      },
      {
        id: "2",
        name: "disabled",
        command: "npx",
        args: "[]",
        env: null,
        config: null,
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
        config: null,
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
        config: null,
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
        config: null,
        enabled: true,
      },
    ];
    await writeProjectMcpConfig(tmpDir, servers);
    const content = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers["bad-args"].command).toBe("npx");
  });

  it("writes url config for HTTP/Streamable transport", async () => {
    const servers: McpServerConfig[] = [
      {
        id: "1",
        name: "remote-mcp",
        command: "url",
        args: "[]",
        env: null,
        config: JSON.stringify({ url: "https://example.com/mcp" }),
        enabled: true,
      },
    ];
    await writeProjectMcpConfig(tmpDir, servers);
    const content = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers["remote-mcp"]).toEqual({ url: "https://example.com/mcp" });
  });

  it("writes url config with headers", async () => {
    const servers: McpServerConfig[] = [
      {
        id: "1",
        name: "auth-mcp",
        command: "url",
        args: "[]",
        env: null,
        config: JSON.stringify({
          url: "https://api.example.com/mcp",
          headers: { Authorization: "Bearer token123" },
        }),
        enabled: true,
      },
    ];
    await writeProjectMcpConfig(tmpDir, servers);
    const content = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers["auth-mcp"]).toEqual({
      url: "https://api.example.com/mcp",
      headers: { Authorization: "Bearer token123" },
    });
  });

  it("writes desktop config for Cursor Desktop", async () => {
    const servers: McpServerConfig[] = [
      {
        id: "1",
        name: "desktop-app",
        command: "/usr/bin/cursor-desktop",
        args: "[]",
        env: null,
        config: JSON.stringify({ desktop: { command: "/usr/bin/cursor-desktop" } }),
        enabled: true,
      },
    ];
    await writeProjectMcpConfig(tmpDir, servers);
    const content = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers["desktop-app"]).toEqual({
      desktop: { command: "/usr/bin/cursor-desktop" },
    });
  });

  it("writes stdio config from config JSON when present", async () => {
    const servers: McpServerConfig[] = [
      {
        id: "1",
        name: "from-config",
        command: "npx",
        args: "[]",
        env: null,
        config: JSON.stringify({
          command: "node",
          args: ["server.js", "--port", "3000"],
          env: { NODE_ENV: "production" },
        }),
        enabled: true,
      },
    ];
    await writeProjectMcpConfig(tmpDir, servers);
    const content = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers["from-config"]).toEqual({
      command: "node",
      args: ["server.js", "--port", "3000"],
      env: { NODE_ENV: "production" },
    });
  });
});
