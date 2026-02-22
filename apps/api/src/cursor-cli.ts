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

/** Content item: text, or function/tool_use (OpenAI/Anthropic style). */
type ContentItem =
  | { type?: string; text?: string }
  | { type: "function"; name?: string; arguments?: string }
  | { type: "tool_use"; name?: string; input?: unknown };

/** Cursor CLI tool_call.tool_call keys → internal tool names. */
const CURSOR_CLI_TOOL_KEYS: Record<string, string> = {
  shellToolCall: "run_terminal_cmd",
  readToolCall: "read_file",
  editToolCall: "edit",
  searchReplaceToolCall: "search_replace",
  writeToolCall: "write",
  listDirToolCall: "list_dir",
  grepToolCall: "grep",
  globFileSearchToolCall: "glob_file_search",
  deleteFileToolCall: "delete_file",
  applyPatchToolCall: "apply_patch",
  webSearchToolCall: "web_search",
  fetchUrlToolCall: "fetch_url",
};

/** Short display labels for UI (no "Tool: " prefix). */
const TOOL_DISPLAY_LABELS: Record<string, string> = {
  run_terminal_cmd: "Terminal",
  read_file: "Read file",
  edit: "Edit",
  search_replace: "Edit",
  write: "Write",
  list_dir: "List directory",
  grep: "Grep",
  glob_file_search: "Glob search",
  delete_file: "Delete file",
  apply_patch: "Patch",
  web_search: "Web search",
  fetch_url: "Fetch URL",
};

/** Derive display name from unknown tool key (e.g. "fooBarToolCall" → "foo_bar"). */
function toolKeyToDisplayName(key: string): string {
  const known = CURSOR_CLI_TOOL_KEYS[key];
  if (known) return known;
  if (key.endsWith("ToolCall")) {
    const base = key.slice(0, -8);
    return base.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "") || key;
  }
  return key;
}

export interface CursorLine {
  type: string;
  subtype?: string;
  result?: string;
  session_id?: string;
  message?: { content?: ContentItem[] };
  /** Cursor CLI: tool_call.tool_call = { shellToolCall: {...}, readToolCall: {...}, ... } */
  tool_call?: Record<string, { args?: Record<string, unknown> }>;
  tool_name?: string;
  name?: string;
  error?: string;
}

/**
 * Build stdin payload for Cursor CLI. Plain text only.
 * When imagePaths are present, appends a note to the prompt telling the agent where to find uploaded images.
 */
export function buildAgentStdin(content: string, imagePaths?: string[]): string {
  const text = content.trim();
  if (!imagePaths || imagePaths.length === 0) {
    return text;
  }
  const pathNote = `\n\n[Attached images are available at: ${imagePaths.join(", ")}. You can read them with the read_file tool.]`;
  return text ? text + pathNote : pathNote.trim();
}

/**
 * Spawn Cursor CLI agent process. Writes message to stdin, reads NDJSON from stdout.
 * message: plain text string, or use buildAgentStdin(content, imagePaths) when images are uploaded.
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
    "--force", // auto-allow tool calls (replaces deprecated --auto)
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
 * Types of Cursor CLI output we should stream as assistant text.
 * Only "assistant" — incremental chunks. "result" contains the final full answer
 * which typically duplicates assistant content; streaming both causes duplication.
 */
const STREAMABLE_ASSISTANT_TYPES = new Set(["assistant"]);

/**
 * Returns true if this line contains assistant response content we should stream.
 * Excludes: user echo, system, tool_call, tool_result.
 * Excludes "result" type to avoid duplication (result usually repeats assistant content).
 */
export function isAssistantContent(line: CursorLine): boolean {
  if (line.type && STREAMABLE_ASSISTANT_TYPES.has(line.type)) return true;
  return false;
}

/**
 * Activity types we emit for UI (tool_call, thinking, etc.) — non-boxed, small indicators.
 */
export const ACTIVITY_TYPES = new Set(["tool_call", "tool_result", "thinking"]);

/**
 * Returns true if this line is an activity we should emit for the UI.
 * For tool_call: only emit "started" (real CLI sends started + completed; we want one block per call).
 */
export function isActivityContent(line: CursorLine): boolean {
  if (!line.type || !ACTIVITY_TYPES.has(line.type)) return false;
  if (line.type === "tool_call" && line.subtype === "completed") return false;
  return true;
}

/** Parsed tool call: name + key=value args. */
export interface ParsedToolCall {
  toolName: string;
  args: Record<string, string>;
}

/**
 * Parse tool call text like "[Tool: read_file path=/tmp/foo]" into tool name and args.
 * Handles key=value and key="quoted value" patterns.
 */
export function parseToolCall(text: string): ParsedToolCall | null {
  const m = text.match(/\[Tool:\s*(\S+)(?:\s+(.+))?\]/);
  if (!m) return null;
  const toolName = m[1];
  const args: Record<string, string> = {};
  const rest = m[2]?.trim();
  if (rest) {
    // Match key=value or key="value" (value may contain spaces)
    const argRe = /(\w+)=(?:"([^"]*)"|([^\s]+))/g;
    let match: RegExpExecArray | null;
    while ((match = argRe.exec(rest)) !== null) {
      args[match[1]] = match[2] ?? match[3] ?? "";
    }
  }
  return { toolName, args };
}

/**
 * Build a short detail string for a tool call (e.g. "path: src/foo.ts").
 * Truncates long values for display. Shows path, command, pattern for any tool.
 */
function formatToolDetails(toolName: string, args: Record<string, string>): string | undefined {
  const maxLen = 80;
  const parts: string[] = [];

  if (args.path) parts.push(`path: ${args.path}`);
  if (args.file_path) parts.push(`path: ${args.file_path}`);
  if (args.command) parts.push(`cmd: ${args.command}`);
  if (args.pattern) parts.push(`pattern: ${args.pattern}`);
  if (args.old_string)
    parts.push(`old: ${args.old_string.slice(0, 30)}${args.old_string.length > 30 ? "…" : ""}`);
  if (args.diff) parts.push(`diff: ${args.diff.slice(0, 40)}${args.diff.length > 40 ? "…" : ""}`);

  if (parts.length === 0) return undefined;
  const s = parts.join(" · ");
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

/**
 * Extract from Cursor CLI format: tool_call = { shellToolCall: { args }, readToolCall: { args }, ... }
 * Verified against: cursor agent --print --output-format stream-json
 */
function extractCursorCliToolCall(line: CursorLine): ParsedToolCall | null {
  const tc = line.tool_call;
  if (!tc || typeof tc !== "object") return null;
  for (const [key, val] of Object.entries(tc)) {
    if (val && typeof val === "object" && "args" in val) {
      const displayName = toolKeyToDisplayName(key);
      const argsObj = (val as { args?: Record<string, unknown> }).args;
      const args = argsObj && typeof argsObj === "object" ? flattenArgs(argsObj) : {};
      return { toolName: displayName, args };
    }
  }
  return null;
}

function flattenArgs(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = v;
    else if (typeof v === "number") out[k] = String(v);
  }
  return out;
}

/** Normalize camelCase to snake_case for known edit tool args (Cursor CLI may use either). */
function normalizeEditArgs(args: Record<string, string>): Record<string, string> {
  const aliases: [string, string][] = [
    ["oldString", "old_string"],
    ["newString", "new_string"],
    ["filePath", "file_path"],
  ];
  const out = { ...args };
  for (const [from, to] of aliases) {
    if (out[from] !== undefined && out[to] === undefined) {
      out[to] = out[from];
    }
  }
  return out;
}

/**
 * Extract tool name and args from structured content (OpenAI function / Anthropic tool_use).
 */
function extractStructuredToolCall(line: CursorLine): ParsedToolCall | null {
  const top = line as { tool_name?: string; name?: string; arguments?: string; input?: unknown };
  if (top.tool_name) {
    const args = parseJsonArgs(top.arguments);
    return { toolName: top.tool_name, args: args ?? {} };
  }
  if (top.name && (line.type === "tool_call" || line.type === "tool_result")) {
    const args = parseJsonArgs(top.arguments);
    return { toolName: top.name, args: args ?? {} };
  }
  const content = line.message?.content;
  if (!Array.isArray(content)) return null;
  for (const item of content) {
    const i = item as ContentItem & { type?: string; name?: string; arguments?: string; input?: unknown };
    if (i.type === "function" && i.name) {
      const args = parseJsonArgs(i.arguments);
      return { toolName: i.name, args: args ?? {} };
    }
    if (i.type === "tool_use" && i.name) {
      const args = parseJsonArgs(i.input);
      return { toolName: i.name, args: args ?? {} };
    }
  }
  return null;
}

function parseJsonArgs(val: unknown): Record<string, string> | null {
  if (val == null) return null;
  if (typeof val === "object" && !Array.isArray(val) && val !== null) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === "string") out[k] = v;
      else if (v != null) out[k] = String(v);
    }
    return out;
  }
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string") out[k] = v;
          else if (v != null) out[k] = String(v);
        }
        return out;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

const EDIT_TOOLS = new Set(["search_replace", "edit", "write", "apply_patch"]);
const SHELL_TOOLS = new Set(["run_terminal_cmd"]);
const TOOLS_WITH_ARGS = new Set([...EDIT_TOOLS, ...SHELL_TOOLS]);

/** Extract output from tool_result (Cursor CLI may put it in result, output, or message.content). */
function extractToolResultOutput(line: CursorLine): string | undefined {
  if (line.type !== "tool_result") return undefined;
  const top = line as { result?: string; output?: string; stdout?: string; stderr?: string };
  if (top.result) return top.result;
  if (top.output) return top.output;
  if (top.stdout !== undefined) {
    const stderr = top.stderr ? `\n${top.stderr}` : "";
    return top.stdout + stderr;
  }
  return extractTextFromLine(line) || undefined;
}

/**
 * Extract activity info: label (always includes tool name), optional details, args for edit/shell tools, and output for tool_result.
 * Supports: Cursor CLI tool_call.*, tool_result.*, [Tool: name args...] text, OpenAI function/tool_use.
 */
export function extractActivityInfo(line: CursorLine): {
  label: string;
  details?: string;
  toolName?: string;
  args?: Record<string, string>;
  output?: string;
} {
  if (line.type === "thinking") return { label: "Thinking…" };
  const output = extractToolResultOutput(line);
  // 1. Cursor CLI format: tool_call = { shellToolCall: { args }, readToolCall: { args }, ... }
  const cliParsed = extractCursorCliToolCall(line);
  if (cliParsed) {
    const label = TOOL_DISPLAY_LABELS[cliParsed.toolName] ?? cliParsed.toolName;
    const details = formatToolDetails(cliParsed.toolName, cliParsed.args);
    const out: { label: string; details?: string; toolName?: string; args?: Record<string, string>; output?: string } = { label, details };
    if (TOOLS_WITH_ARGS.has(cliParsed.toolName)) {
      out.toolName = cliParsed.toolName;
      out.args = normalizeEditArgs(cliParsed.args);
    }
    if (output) out.output = output;
    return out;
  }
  // 2. OpenAI/Anthropic structured (function/tool_use)
  const structured = extractStructuredToolCall(line);
  if (structured) {
    const label = TOOL_DISPLAY_LABELS[structured.toolName] ?? structured.toolName;
    const details = formatToolDetails(structured.toolName, structured.args);
    const out: { label: string; details?: string; toolName?: string; args?: Record<string, string>; output?: string } = { label, details };
    if (TOOLS_WITH_ARGS.has(structured.toolName)) {
      out.toolName = structured.toolName;
      out.args = normalizeEditArgs(structured.args);
    }
    if (output) out.output = output;
    return out;
  }
  // 3. [Tool: name args...] text format (mock)
  const text = extractTextFromLine(line);
  if (text) {
    const parsed = parseToolCall(text);
    if (parsed) {
      const label = TOOL_DISPLAY_LABELS[parsed.toolName] ?? parsed.toolName;
      const details = formatToolDetails(parsed.toolName, parsed.args);
      const out: { label: string; details?: string; toolName?: string; args?: Record<string, string>; output?: string } = { label, details };
      if (TOOLS_WITH_ARGS.has(parsed.toolName)) {
        out.toolName = parsed.toolName;
        out.args = normalizeEditArgs(parsed.args);
      }
      if (output) out.output = output;
      return out;
    }
    return { label: text.slice(0, 60) + (text.length > 60 ? "…" : ""), ...(output && { output }) };
  }
  return { label: line.type ?? "Activity", ...(output && { output }) };
}

/**
 * Extract a short label for activity display (e.g. "Tool: read_file").
 * @deprecated Prefer extractActivityInfo for label + details.
 */
export function extractActivityLabel(line: CursorLine): string {
  return extractActivityInfo(line).label;
}

/**
 * Extract plain text from a Cursor output line.
 * Used for assistant streaming and for activity labels.
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
