/**
 * Cursor CLI MCP integration — uses "agent mcp enable/disable/list/login"
 * when CURSOR_CLI_PATH points to the agent binary. Falls back to file-based
 * mcp.json management when CLI is unavailable or is the mock.
 */

import { spawn } from "child_process";

const CURSOR_CLI = process.env.CURSOR_CLI_PATH ?? "cursor";
const IS_AGENT_BINARY = process.env.CURSOR_CLI_PATH?.endsWith("agent") ?? false;
const IS_MOCK_CLI = process.env.CURSOR_CLI_PATH?.includes("mock-cursor-agent") ?? false;

function buildMcpArgs(subcommand: string, identifier?: string): string[] {
  const base = IS_AGENT_BINARY ? [] : ["agent"];
  return [...base, "mcp", subcommand, ...(identifier ? [identifier] : [])];
}

/**
 * Run agent mcp <subcommand> with cwd=workspace.
 * Returns { stdout, stderr, code }.
 */
function runMcpCommand(
  subcommand: string,
  workspace: string,
  identifier?: string,
  envOverrides?: Record<string, string>
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const args = buildMcpArgs(subcommand, identifier);
    const proc = spawn(CURSOR_CLI, args, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: workspace,
      env: { ...process.env, ...envOverrides },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? -1 });
    });
    proc.on("error", (err) => {
      resolve({
        stdout,
        stderr: stderr || err.message,
        code: -1,
      });
    });
  });
}

/** Check if we should use CLI (agent binary, not mock) */
export function canUseMcpCli(): boolean {
  return !IS_MOCK_CLI && (IS_AGENT_BINARY || !!process.env.CURSOR_CLI_PATH);
}

/**
 * Enable an MCP server via CLI. Call after mcp.json is written.
 * No-op if CLI unavailable (file-based config is sufficient for agent spawn).
 */
export async function enableMcpServer(workspace: string, identifier: string): Promise<{ ok: boolean; error?: string }> {
  if (!canUseMcpCli()) return { ok: true };
  const { stdout, stderr, code } = await runMcpCommand("enable", workspace, identifier);
  if (code === 0) return { ok: true };
  const msg = stderr.trim() || stdout.trim() || `agent mcp enable exited with code ${code}`;
  return { ok: false, error: msg };
}

/**
 * Disable an MCP server via CLI.
 */
export async function disableMcpServer(workspace: string, identifier: string): Promise<{ ok: boolean; error?: string }> {
  if (!canUseMcpCli()) return { ok: true };
  const { stdout, stderr, code } = await runMcpCommand("disable", workspace, identifier);
  if (code === 0) return { ok: true };
  const msg = stderr.trim() || stdout.trim() || `agent mcp disable exited with code ${code}`;
  return { ok: false, error: msg };
}

export interface McpListEntry {
  identifier: string;
  status: "enabled" | "disabled" | "needs_approval" | "error" | "ready";
  message?: string;
}

/**
 * List MCP servers and their status. Parses "identifier: status" lines from agent mcp list.
 */
export async function listMcpServers(workspace: string): Promise<McpListEntry[]> {
  if (!canUseMcpCli()) return [];
  const { stdout, stderr, code } = await runMcpCommand("list", workspace);
  const text = stdout + stderr;
  const entries: McpListEntry[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([^:]+):\s*(.+)$/);
    if (match) {
      const identifier = match[1].trim();
      const statusStr = match[2].trim().toLowerCase();
      let status: McpListEntry["status"] = "error";
      if (statusStr.includes("disabled")) status = "disabled";
      else if (statusStr.includes("not loaded") || statusStr.includes("needs approval")) status = "needs_approval";
      else if (statusStr.includes("error") || statusStr.includes("connection failed")) status = "error";
      else if (statusStr.includes("ready") || statusStr.includes("loaded")) status = "ready";
      else status = "enabled";
      entries.push({ identifier, status, message: statusStr });
    }
  }
  return entries;
}

export interface McpLoginResult {
  ok: boolean;
  authUrl?: string;
  error?: string;
}

/** Extract URL from text (for OAuth flow when NO_OPEN_BROWSER is set) */
function extractAuthUrl(text: string): string | undefined {
  const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/);
  return urlMatch?.[0];
}

/**
 * Run agent mcp login. With NO_OPEN_BROWSER=1, the CLI may print an auth URL
 * for OAuth flows. Returns that URL so the UI can present it to the user.
 * If callbackUrl is provided (user pasted OAuth redirect URL), pass it via env
 * in case the CLI supports it.
 */
export async function loginMcpServer(
  workspace: string,
  identifier: string,
  callbackUrl?: string
): Promise<McpLoginResult> {
  if (!canUseMcpCli()) return { ok: false, error: "MCP CLI not available" };
  const envOverrides: Record<string, string> = { NO_OPEN_BROWSER: "1" };
  if (callbackUrl) {
    envOverrides.MCP_OAUTH_CALLBACK_URL = callbackUrl;
    envOverrides.CURSOR_MCP_OAUTH_CALLBACK = callbackUrl;
  }
  const { stdout, stderr, code } = await runMcpCommand("login", workspace, identifier, envOverrides);
  const text = stdout + stderr;
  const authUrl = extractAuthUrl(text);
  if (code === 0) return { ok: true, ...(authUrl && { authUrl }) };
  return {
    ok: false,
    error: stderr.trim() || stdout.trim() || `agent mcp login exited with code ${code}`,
    ...(authUrl && { authUrl }),
  };
}
