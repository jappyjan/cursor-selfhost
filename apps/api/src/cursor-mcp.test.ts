/**
 * Unit tests for Cursor MCP CLI integration.
 * With test-setup.ts, CURSOR_CLI_PATH points to mock-cursor-agent.js, so canUseMcpCli is false.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  canUseMcpCli,
  enableMcpServer,
  disableMcpServer,
  listMcpServers,
  loginMcpServer,
} from "./cursor-mcp";

describe("cursor-mcp", () => {
  const origPath = process.env.CURSOR_CLI_PATH;

  beforeEach(() => {
    process.env.CURSOR_CLI_PATH = origPath;
  });

  describe("canUseMcpCli", () => {
    it("returns false when CURSOR_CLI_PATH points to mock", () => {
      process.env.CURSOR_CLI_PATH = "/path/to/mock-cursor-agent.js";
      expect(canUseMcpCli()).toBe(false);
    });
  });

  describe("enableMcpServer", () => {
    it("returns ok when CLI unavailable (no spawn)", async () => {
      process.env.CURSOR_CLI_PATH = "/path/mock-cursor-agent.js";
      const result = await enableMcpServer("/tmp/proj", "filesystem");
      expect(result.ok).toBe(true);
    });
  });

  describe("disableMcpServer", () => {
    it("returns ok when CLI unavailable", async () => {
      process.env.CURSOR_CLI_PATH = "/path/mock-cursor-agent.js";
      const result = await disableMcpServer("/tmp/proj", "filesystem");
      expect(result.ok).toBe(true);
    });
  });

  describe("listMcpServers", () => {
    it("returns empty when CLI unavailable", async () => {
      process.env.CURSOR_CLI_PATH = "/path/mock-cursor-agent.js";
      const list = await listMcpServers("/tmp/proj");
      expect(list).toEqual([]);
    });
  });

  describe("loginMcpServer", () => {
    it("returns error when CLI unavailable", async () => {
      process.env.CURSOR_CLI_PATH = "/path/mock-cursor-agent.js";
      const result = await loginMcpServer("/tmp/proj", "filesystem");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("not available");
    });
  });
});
