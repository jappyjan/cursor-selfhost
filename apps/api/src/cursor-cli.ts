/**
 * Cursor CLI integration — spawns "cursor agent --print --output-format stream-json"
 * for stdin/stdout communication. Supports --workspace and --resume for sessions.
 */

import { spawn, type ChildProcess } from "child_process";

const CURSOR_CLI = process.env.CURSOR_CLI_PATH ?? "cursor";
/** If CURSOR_CLI_PATH points to the agent binary (e.g. "agent"), omit the "agent" subcommand */
const IS_AGENT_BINARY = process.env.CURSOR_CLI_PATH?.endsWith("agent") ?? false;

export interface CursorSpawnOptions {
  workspace: string;
  resumeSessionId?: string | null;
  model?: string;
}

export interface CursorLine {
  type: string;
  result?: string;
  session_id?: string;
  message?: { content?: Array<{ type?: string; text?: string }> };
  error?: string;
}

/**
 * Spawn Cursor CLI agent process. Writes message to stdin, reads NDJSON from stdout.
 */
export function spawnCursorAgent(
  message: string,
  options: CursorSpawnOptions
): ChildProcess {
  const args = [
    ...(IS_AGENT_BINARY ? [] : ["agent"]),
    "--print",
    "--output-format",
    "stream-json",
    "--workspace",
    options.workspace,
    "--trust",
  ];
  if (options.resumeSessionId) {
    args.push("--resume", options.resumeSessionId);
  }
  if (options.model) {
    args.push("--model", options.model);
  }

  const proc = spawn(CURSOR_CLI, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
    cwd: options.workspace,
  });

  proc.stdin?.write(message, "utf-8");
  proc.stdin?.end();

  return proc;
}

/**
 * Create a new isolated chat session for the workspace.
 * Returns the session ID to use with --resume. Each chat gets its own session.
 */
export async function createCursorSession(workspacePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      ...(IS_AGENT_BINARY ? [] : ["agent"]),
      "create-chat",
      "--workspace",
      workspacePath,
    ];
    const proc = spawn(CURSOR_CLI, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
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
      if (code === 0) {
        const sessionId = stdout.trim();
        resolve(sessionId || "");
      } else {
        reject(new Error(stderr.trim() || `agent create-chat exited with code ${code}`));
      }
    });
    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Check if Cursor CLI is installed and authenticated.
 * Returns ok if CURSOR_API_KEY is set, or if "cursor agent status" exits 0.
 */
export async function checkCursorAuth(): Promise<{ ok: boolean; error?: string }> {
  if (process.env.CURSOR_API_KEY?.trim()) {
    return { ok: true };
  }
  const statusArgs = IS_AGENT_BINARY ? ["status"] : ["agent", "status"];
  return new Promise((resolve) => {
    const proc = spawn(CURSOR_CLI, statusArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stderr = "";
    let stdout = "";
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
      } else {
        const msg = stderr.trim() || stdout.trim() || `cursor agent status exited with code ${code}`;
        resolve({
          ok: false,
          error: msg,
        });
      }
    });
    proc.on("error", (err) => {
      const msg =
        (err as NodeJS.ErrnoException).code === "ENOENT"
          ? `Cursor CLI not found. Set CURSOR_CLI_PATH to the binary (e.g. "agent" or /path/to/agent) or ensure it is in PATH.`
          : err.message;
      resolve({ ok: false, error: msg });
    });
  });
}

/**
 * Parse a single NDJSON line from Cursor CLI output.
 */
export function parseCursorLine(line: string): CursorLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as CursorLine;
  } catch {
    return null;
  }
}

/**
 * Types of Cursor CLI output we should stream to the user as assistant content.
 * Excludes: user (echo), system, tool_call, tool_result, etc. — those would mix
 * prompts and tool output into the chat.
 */
const ASSISTANT_CONTENT_TYPES = new Set(["assistant", "result"]);

/**
 * Returns true if this line contains assistant response content we should stream.
 * User echoes, tool calls, system messages etc. must NOT be included.
 */
export function isAssistantContent(line: CursorLine): boolean {
  if (line.type && ASSISTANT_CONTENT_TYPES.has(line.type)) return true;
  // Legacy: some outputs may not have type; result field indicates final answer
  if (line.result) return true;
  return false;
}

/**
 * Extract plain text from a Cursor output line for streaming/accumulation.
 * Only call this for lines where isAssistantContent(line) is true.
 */
export function extractTextFromLine(line: CursorLine): string {
  if (line.result) return line.result;
  if (line.message?.content) {
    return line.message.content
      .map((c) => (typeof c === "string" ? c : c.text ?? ""))
      .join("");
  }
  return "";
}
