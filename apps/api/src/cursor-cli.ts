/**
 * Cursor CLI integration — spawns "cursor agent --print --output-format stream-json"
 * for stdin/stdout communication. Supports --workspace and --resume for sessions.
 */

import { spawn, type ChildProcess } from "child_process";

const CURSOR_CLI = process.env.CURSOR_CLI_PATH ?? "cursor";

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
    "agent",
    "--print",
    "--output-format",
    "stream-json",
    "--workspace",
    options.workspace,
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
  });

  proc.stdin?.write(message, "utf-8");
  proc.stdin?.end();

  return proc;
}

/**
 * Check if Cursor CLI is installed and authenticated.
 * Runs "cursor agent status" and returns true if successful.
 */
export async function checkCursorAuth(): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(CURSOR_CLI, ["agent", "status"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
      } else {
        resolve({
          ok: false,
          error: stderr.trim() || `cursor agent status exited with code ${code}`,
        });
      }
    });
    proc.on("error", (err) => {
      resolve({ ok: false, error: err.message });
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
 * Extract plain text from a Cursor output line for streaming/accumulation.
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
