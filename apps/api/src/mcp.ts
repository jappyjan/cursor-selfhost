/**
 * MCP (Model Context Protocol) config for Cursor agent.
 * Writes project MCP servers to .cursor/mcp.json so Cursor CLI picks them up when spawning with --workspace.
 */

import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string;
  env: string | null;
  enabled: boolean;
}

/**
 * Build mcpServers object for Cursor's mcp.json format.
 * Cursor expects: { mcpServers: { [name]: { command, args?, env? } } }
 */
function buildMcpJson(servers: McpServerConfig[]): string {
  const mcpServers: Record<string, { command: string; args?: string[]; env?: Record<string, string> }> = {};
  for (const s of servers) {
    if (!s.enabled) continue;
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
    mcpServers[s.name] = { command: s.command, ...(args.length > 0 && { args }), ...(env && { env }) };
  }
  return JSON.stringify({ mcpServers }, null, 2);
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
