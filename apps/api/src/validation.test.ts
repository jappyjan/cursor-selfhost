/**
 * Unit tests for validation schemas.
 */
import { describe, expect, it } from "vitest";
import {
  mcpServerSchema,
  mcpStdioConfigSchema,
  mcpUrlConfigSchema,
  mcpDesktopConfigSchema,
} from "./validation";

describe("validation", () => {
  describe("mcpServerSchema", () => {
    it("accepts legacy stdio (command + args)", () => {
      const result = mcpServerSchema.safeParse({
        name: "filesystem",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts legacy stdio with env", () => {
      const result = mcpServerSchema.safeParse({
        name: "github",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: { GITHUB_TOKEN: "secret" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts config with stdio", () => {
      const result = mcpServerSchema.safeParse({
        name: "fs",
        config: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts config with url", () => {
      const result = mcpServerSchema.safeParse({
        name: "remote",
        config: { url: "https://example.com/mcp" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts config with url and headers", () => {
      const result = mcpServerSchema.safeParse({
        name: "remote",
        config: {
          url: "https://example.com/mcp",
          headers: { Authorization: "Bearer x" },
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts config with desktop", () => {
      const result = mcpServerSchema.safeParse({
        name: "desktop",
        config: { desktop: { command: "/usr/bin/cursor" } },
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = mcpServerSchema.safeParse({
        name: "",
        command: "npx",
        args: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing command when no config", () => {
      const result = mcpServerSchema.safeParse({
        name: "test",
        args: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid url", () => {
      const result = mcpServerSchema.safeParse({
        name: "remote",
        config: { url: "not-a-url" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects url without http(s)", () => {
      const result = mcpServerSchema.safeParse({
        name: "remote",
        config: { url: "ftp://example.com/mcp" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("mcpStdioConfigSchema", () => {
    it("accepts minimal stdio config", () => {
      const result = mcpStdioConfigSchema.safeParse({
        command: "node",
      });
      expect(result.success).toBe(true);
    });

    it("accepts stdio with args and env", () => {
      const result = mcpStdioConfigSchema.safeParse({
        command: "npx",
        args: ["-y", "server"],
        env: { KEY: "val" },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("mcpUrlConfigSchema", () => {
    it("accepts https url", () => {
      const result = mcpUrlConfigSchema.safeParse({
        url: "https://example.com/mcp",
      });
      expect(result.success).toBe(true);
    });

    it("accepts http url", () => {
      const result = mcpUrlConfigSchema.safeParse({
        url: "http://localhost:3000/mcp",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("mcpDesktopConfigSchema", () => {
    it("accepts desktop config", () => {
      const result = mcpDesktopConfigSchema.safeParse({
        desktop: { command: "/usr/bin/cursor" },
      });
      expect(result.success).toBe(true);
    });
  });
});
