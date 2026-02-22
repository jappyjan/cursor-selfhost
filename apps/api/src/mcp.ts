/**
 * MCP (Model Context Protocol) config for Cursor agent.
 * Writes project MCP servers to .cursor/mcp.json so Cursor CLI picks them up when spawning with --workspace.
 * Supports stdio (command), HTTP/Streamable (url), and desktop transports.
 */

import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

/** Stdio config: { command, args?, env? } */
export type McpStdioConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

/** HTTP/Streamable config: { url, headers? } */
export type McpUrlConfig = {
  url: string;
  headers?: Record<string, string>;
};

/** Desktop config: { desktop: { command } } */
export type McpDesktopConfig = {
  desktop: { command: string };
};

export type McpServerConfigEntry = McpStdioConfig | McpUrlConfig | McpDesktopConfig;

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string;
  env: string | null;
  /** Full config as JSON. When set, used for mcp.json; else derived from command/args/env. */
  config: string | null;
  enabled: boolean;
}

/**
 * Build mcpServers object for Cursor's mcp.json format.
 * Supports: stdio { command, args?, env? }, url { url, headers? }, desktop { desktop: { command } }
 */
function buildMcpJson(servers: McpServerConfig[]): string {
  const mcpServers: Record<string, McpServerConfigEntry> = {};
  for (const s of servers) {
    if (!s.enabled) continue;
    if (s.config) {
      try {
        const parsed = JSON.parse(s.config) as McpServerConfigEntry;
        if ("url" in parsed && typeof parsed.url === "string") {
          mcpServers[s.name] = parsed as McpUrlConfig;
        } else if ("desktop" in parsed && parsed.desktop && typeof parsed.desktop.command === "string") {
          mcpServers[s.name] = parsed as McpDesktopConfig;
        } else if ("command" in parsed && typeof parsed.command === "string") {
          mcpServers[s.name] = parsed as McpStdioConfig;
        } else {
          mcpServers[s.name] = parsed;
        }
      } catch {
        /* fallback to legacy */
        mcpServers[s.name] = legacyToStdioConfig(s);
      }
    } else {
      mcpServers[s.name] = legacyToStdioConfig(s);
    }
  }
  return JSON.stringify({ mcpServers }, null, 2);
}

function legacyToStdioConfig(s: McpServerConfig): McpStdioConfig {
  let args: string[] = [];
  try {
    args = JSON.parse(s.args) as string[];
  } catch {
    /* ignore */
  }
  let env: Record<string, string> | undefined;
  if (s.env) {
    try {
      env = JSON.parse(s.env) as Record<string, string>;
      if (Object.keys(env).length === 0) env = undefined;
    } catch {
      /* ignore */
    }
  }
  return { command: s.command, ...(args.length > 0 && { args }), ...(env && { env }) };
}

/**
 * Write MCP config to projectPath/.cursor/mcp.json.
 * If servers is empty, removes the file so Cursor uses no MCP servers.
 */
export async function writeProjectMcpConfig(
  projectPath: string,
  servers: McpServerConfig[]
): Promise<void> {
  const cursorDir = path.join(projectPath, ".cursor");
  const mcpPath = path.join(cursorDir, "mcp.json");

  const enabled = servers.filter((s) => s.enabled);
  if (enabled.length === 0) {
    try {
      await unlink(mcpPath);
    } catch {
      /* file may not exist */
    }
    return;
  }

  await mkdir(cursorDir, { recursive: true });
  const content = buildMcpJson(servers);
  await writeFile(mcpPath, content, "utf-8");
}
