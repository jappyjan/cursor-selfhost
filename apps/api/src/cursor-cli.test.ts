/**
 * Unit tests for Cursor CLI integration.
 * Mocks child_process.spawn to verify correct invocation without requiring the agent binary.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSpawn = vi.fn();

vi.mock("child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

import {
  parseCursorLine,
  extractTextFromLine,
  isAssistantContent,
  isActivityContent,
  extractActivityLabel,
  extractActivityInfo,
  parseToolCall,
  createCursorSession,
  spawnCursorAgent,
  buildAgentStdin,
} from "./cursor-cli";

describe("parseCursorLine", () => {
  it("returns null for empty or invalid JSON", () => {
    expect(parseCursorLine("")).toBeNull();
    expect(parseCursorLine("   ")).toBeNull();
    expect(parseCursorLine("not json")).toBeNull();
  });

  it("parses valid NDJSON and extracts session_id", () => {
    const line = '{"type":"system","session_id":"abc-123","subtype":"init"}';
    const parsed = parseCursorLine(line);
    expect(parsed).not.toBeNull();
    expect(parsed!.session_id).toBe("abc-123");
    expect(parsed!.type).toBe("system");
  });

  it("parses assistant message with content", () => {
    const line = '{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"}]}}';
    const parsed = parseCursorLine(line);
    expect(parsed).not.toBeNull();
    expect(parsed!.message?.content).toHaveLength(1);
  });
});

describe("isAssistantContent", () => {
  it("returns true for assistant type", () => {
    expect(isAssistantContent({ type: "assistant", message: { content: [{ text: "Hi" }] } })).toBe(true);
  });
  it("returns false for result type (avoids duplication — result repeats assistant content)", () => {
    expect(isAssistantContent({ type: "result", result: "Done" })).toBe(false);
  });
  it("returns false for user type (must not stream user echo)", () => {
    expect(isAssistantContent({ type: "user", message: { content: [{ text: "Hello" }] } })).toBe(false);
  });
  it("returns false for tool_call type (must not stream tool output)", () => {
    expect(isAssistantContent({ type: "tool_call", message: { content: [{ text: "[Tool: x]" }] } })).toBe(false);
  });
  it("returns false for system type", () => {
    expect(isAssistantContent({ type: "system", session_id: "x" })).toBe(false);
  });
});

describe("isActivityContent", () => {
  it("returns true for tool_call, tool_result, thinking", () => {
    expect(isActivityContent({ type: "tool_call" })).toBe(true);
    expect(isActivityContent({ type: "tool_call", subtype: "started" })).toBe(true);
    expect(isActivityContent({ type: "tool_call", subtype: "completed" })).toBe(false);
    expect(isActivityContent({ type: "tool_result" })).toBe(true);
    expect(isActivityContent({ type: "thinking" })).toBe(true);
  });
  it("returns false for assistant, user, result, system", () => {
    expect(isActivityContent({ type: "assistant" })).toBe(false);
    expect(isActivityContent({ type: "user" })).toBe(false);
    expect(isActivityContent({ type: "result" })).toBe(false);
    expect(isActivityContent({ type: "system" })).toBe(false);
  });
});

describe("parseToolCall", () => {
  it("returns null for non-tool text", () => {
    expect(parseToolCall("hello")).toBeNull();
    expect(parseToolCall("")).toBeNull();
    expect(parseToolCall("[Tool:")).toBeNull();
  });
  it("parses tool name only", () => {
    const r = parseToolCall("[Tool: list_dir]");
    expect(r).toEqual({ toolName: "list_dir", args: {} });
  });
  it("parses path=value", () => {
    const r = parseToolCall("[Tool: read_file path=/tmp/foo.ts]");
    expect(r).toEqual({ toolName: "read_file", args: { path: "/tmp/foo.ts" } });
  });
  it("parses multiple key=value args", () => {
    const r = parseToolCall("[Tool: search_replace path=src/a.ts old_string=foo new_string=bar]");
    expect(r?.toolName).toBe("search_replace");
    expect(r?.args.path).toBe("src/a.ts");
    expect(r?.args.old_string).toBe("foo");
    expect(r?.args.new_string).toBe("bar");
  });
  it("parses quoted values with spaces", () => {
    const r = parseToolCall('[Tool: run_terminal_cmd command="npm run build"]');
    expect(r).toEqual({ toolName: "run_terminal_cmd", args: { command: "npm run build" } });
  });
  it("parses file_path alias", () => {
    const r = parseToolCall("[Tool: write file_path=dist/index.js]");
    expect(r?.args.file_path).toBe("dist/index.js");
  });
  it("returns null for malformed tool text", () => {
    expect(parseToolCall("[Tool:")).toBeNull();
    expect(parseToolCall("Tool: read_file]")).toBeNull();
    expect(parseToolCall("[Tool")).toBeNull();
  });
});

describe("extractActivityInfo", () => {
  it("returns label + details for read_file with path", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      message: { content: [{ text: "[Tool: read_file path=/tmp/foo.ts]" }] },
    });
    expect(info.label).toBe("Read file");
    expect(info.details).toBe("path: /tmp/foo.ts");
  });
  it("returns label + details for search_replace", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      message: { content: [{ text: "[Tool: search_replace path=src/x.ts old_string=foo new_string=bar]" }] },
    });
    expect(info.label).toBe("Edit");
    expect(info.details).toContain("path: src/x.ts");
    expect(info.details).toContain("old: foo");
  });
  it("returns label + details for run_terminal_cmd", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      message: { content: [{ text: '[Tool: run_terminal_cmd command="npm test"]' }] },
    });
    expect(info.label).toBe("Terminal");
    expect(info.details).toBe('cmd: npm test');
  });
  it("returns label + details for edit with diff", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      message: { content: [{ text: '[Tool: edit path=src/a.ts diff="-old+new"]' }] },
    });
    expect(info.label).toBe("Edit");
    expect(info.details).toContain("path: src/a.ts");
    expect(info.details).toContain("diff:");
  });
  it("extracts from OpenAI-style function content (name + arguments JSON)", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      message: {
        content: [{ type: "function", name: "read_file", arguments: '{"path":"/tmp/foo.ts"}' }],
      },
    });
    expect(info.label).toBe("Read file");
    expect(info.details).toBe("path: /tmp/foo.ts");
  });
  it("extracts from tool_use content with input object", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      message: {
        content: [{ type: "tool_use", name: "search_replace", input: { path: "src/a.ts", old_string: "x" } }],
      },
    });
    expect(info.label).toBe("Edit");
    expect(info.details).toContain("path: src/a.ts");
  });
  it("extracts from Cursor CLI tool_call.shellToolCall format", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      tool_call: {
        shellToolCall: { args: { command: "ls -la /tmp", workingDirectory: "" } },
      },
    } as Parameters<typeof extractActivityInfo>[0]);
    expect(info.label).toBe("Terminal");
    expect(info.details).toBe("cmd: ls -la /tmp");
    expect(info.toolName).toBe("run_terminal_cmd");
    expect(info.args).toEqual({ command: "ls -la /tmp", workingDirectory: "" });
  });
  it("normalizes camelCase args (oldString->old_string) for diff view", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      tool_call: {
        searchReplaceToolCall: {
          args: { path: "src/foo.ts", oldString: "foo", newString: "bar" },
        },
      },
    } as Parameters<typeof extractActivityInfo>[0]);
    expect(info.toolName).toBe("search_replace");
    expect(info.args).toEqual({
      path: "src/foo.ts",
      oldString: "foo",
      newString: "bar",
      old_string: "foo",
      new_string: "bar",
    });
  });

  it("extracts output from tool_result for run_terminal_cmd", () => {
    const info = extractActivityInfo({
      type: "tool_result",
      tool_call: {
        shellToolCall: { args: { command: "npm run build", workingDirectory: "/tmp/proj" } },
      },
      result: "> proj@1.0.0 build\n> tsc\n✓ Build completed",
    } as Parameters<typeof extractActivityInfo>[0]);
    expect(info.label).toBe("Terminal");
    expect(info.toolName).toBe("run_terminal_cmd");
    expect(info.args).toEqual({ command: "npm run build", workingDirectory: "/tmp/proj" });
    expect(info.output).toBe("> proj@1.0.0 build\n> tsc\n✓ Build completed");
  });
  it("extracts from Cursor CLI tool_call.readToolCall format", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      tool_call: {
        readToolCall: { args: { path: "/home/user/app/package.json", limit: 5 } },
      },
    } as Parameters<typeof extractActivityInfo>[0]);
    expect(info.label).toBe("Read file");
    expect(info.details).toBe("path: /home/user/app/package.json");
  });
  it("extracts from Cursor CLI tool_call.grepToolCall format", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      tool_call: {
        grepToolCall: { args: { pattern: "TODO", path: "/home/user/proj" } },
      },
    } as Parameters<typeof extractActivityInfo>[0]);
    expect(info.label).toBe("Grep");
    expect(info.details).toContain("pattern: TODO");
    expect(info.details).toContain("path:");
  });
  it("extracts from unknown tool key (fallback)", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      tool_call: {
        customToolCall: { args: { path: "src/foo.ts" } },
      },
    } as Parameters<typeof extractActivityInfo>[0]);
    expect(info.label).toBe("custom");
    expect(info.details).toBe("path: src/foo.ts");
  });
  it("extracts from Cursor CLI tool_call.editToolCall format", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      tool_call: {
        editToolCall: { args: { path: "src/foo.ts", streamContent: "// edit" } },
      },
    } as Parameters<typeof extractActivityInfo>[0]);
    expect(info.label).toBe("Edit");
    expect(info.details).toBe("path: src/foo.ts");
  });
  it("extracts from top-level tool_name", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      tool_name: "run_terminal_cmd",
      message: { content: [] },
    } as Parameters<typeof extractActivityInfo>[0]);
    expect(info.label).toBe("Terminal");
  });
  it("returns label only for tools without extra info", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      message: { content: [{ text: "[Tool: list_dir]" }] },
    });
    expect(info.label).toBe("List directory");
    expect(info.details).toBeUndefined();
  });
  it("returns label + details for grep with pattern and path", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      message: { content: [{ text: "[Tool: grep pattern=function path=src/]" }] },
    });
    expect(info.label).toBe("Grep");
    expect(info.details).toContain("pattern: function");
    expect(info.details).toContain("path:");
  });
  it("returns label + details for write with path", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      message: { content: [{ text: "[Tool: write path=dist/output.js]" }] },
    });
    expect(info.label).toBe("Write");
    expect(info.details).toBe("path: dist/output.js");
  });
  it("returns label + details for delete_file", () => {
    const info = extractActivityInfo({
      type: "tool_call",
      message: { content: [{ text: "[Tool: delete_file path=tmp/cache]" }] },
    });
    expect(info.label).toBe("Delete file");
    expect(info.details).toBe("path: tmp/cache");
  });
  it("truncates long details to max 80 chars", () => {
    const longPath = "/a/" + "x".repeat(100);
    const info = extractActivityInfo({
      type: "tool_call",
      message: { content: [{ text: `[Tool: read_file path=${longPath}]` }] },
    });
    expect(info.details).toHaveLength(81);
    expect(info.details).toMatch(/…$/);
  });
  it("returns Thinking… for thinking type", () => {
    const info = extractActivityInfo({ type: "thinking", message: { content: [{ text: "..." }] } });
    expect(info.label).toBe("Thinking…");
    expect(info.details).toBeUndefined();
  });
  it("truncates long non-tool text", () => {
    const long = "x".repeat(80);
    const info = extractActivityInfo({ type: "tool_result", message: { content: [{ text: long }] } });
    expect(info.label).toHaveLength(61);
    expect(info.label).toMatch(/…$/);
  });
});

describe("extractActivityLabel", () => {
  it("extracts Tool name from [Tool: name ...]", () => {
    expect(
      extractActivityLabel({ type: "tool_call", message: { content: [{ text: "[Tool: read_file path=/tmp/foo]" }] } })
    ).toBe("Read file");
  });
  it("returns Thinking… for thinking type", () => {
    expect(extractActivityLabel({ type: "thinking", message: { content: [{ text: "Let me consider..." }] } })).toBe(
      "Thinking…"
    );
  });
  it("truncates long text", () => {
    const long = "x".repeat(80);
    expect(extractActivityLabel({ type: "tool_result", message: { content: [{ text: long }] } })).toHaveLength(61);
    expect(extractActivityLabel({ type: "tool_result", message: { content: [{ text: long }] } })).toMatch(/…$/);
  });
});

describe("extractTextFromLine", () => {
  it("returns result when present", () => {
    const line = { result: "Direct result" };
    expect(extractTextFromLine(line)).toBe("Direct result");
  });

  it("extracts text from message content array", () => {
    const line = {
      message: {
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "world" },
        ],
      },
    };
    expect(extractTextFromLine(line)).toBe("Hello world");
  });

  it("returns empty string when no content", () => {
    expect(extractTextFromLine({})).toBe("");
    expect(extractTextFromLine({ message: { content: [] } })).toBe("");
  });
});

describe("createCursorSession", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  it("calls spawn with create-chat and --workspace", async () => {
    mockSpawn.mockImplementation(() => {
      const proc = {
        stdout: { on: vi.fn((_ev: string, cb: (chunk: Buffer) => void) => cb(Buffer.from("session-xyz"))) },
        stderr: { on: vi.fn() },
        on: vi.fn((ev: string, cb: (code: number) => void) => {
          if (ev === "close") setTimeout(() => cb(0), 0);
          return proc;
        }),
      };
      return proc;
    });

    const result = await createCursorSession("/home/user/project");
    expect(result).toBe("session-xyz");
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["create-chat", "--workspace", "/home/user/project"]),
      expect.any(Object)
    );
  });

  it("rejects when process exits non-zero", async () => {
    mockSpawn.mockImplementation(() => {
      const proc = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn((_ev: string, cb: (chunk: Buffer) => void) => cb(Buffer.from("Error"))) },
        on: vi.fn((ev: string, cb: (code: number) => void) => {
          if (ev === "close") setTimeout(() => cb(1), 0);
          return proc;
        }),
      };
      return proc;
    });

    await expect(createCursorSession("/tmp")).rejects.toThrow();
  });
});

describe("buildAgentStdin", () => {
  it("returns plain text when no image paths", () => {
    expect(buildAgentStdin("hello")).toBe("hello");
    expect(buildAgentStdin("hello", [])).toBe("hello");
  });

  it("appends path note when image paths present", () => {
    const result = buildAgentStdin("describe this", ["/workspace/.cursor-attachments/abc/image-0.png"]);
    expect(result).toContain("describe this");
    expect(result).toContain("Attached images are available at:");
    expect(result).toContain("/workspace/.cursor-attachments/abc/image-0.png");
    expect(result).toContain("read_file tool");
  });

  it("returns path note only when content empty but image paths present", () => {
    const result = buildAgentStdin("", ["/tmp/img.png"]);
    expect(result).toContain("Attached images are available at: /tmp/img.png");
  });
});

describe("spawnCursorAgent", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
    mockSpawn.mockImplementation(() => ({
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
    }));
  });

  it("includes --resume when resumeSessionId provided", () => {
    spawnCursorAgent("hello", {
      workspace: "/tmp",
      resumeSessionId: "session-123",
    });

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["--resume", "session-123"]),
      expect.objectContaining({ cwd: "/tmp" })
    );
  });

  it("omits --resume when resumeSessionId is null", () => {
    spawnCursorAgent("hello", {
      workspace: "/tmp",
      resumeSessionId: null,
    });

    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).not.toContain("--resume");
  });

  it("passes --workspace, --trust, and --force", () => {
    spawnCursorAgent("hello", { workspace: "/home/user/proj" });

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["--workspace", "/home/user/proj", "--trust", "--force"]),
      expect.objectContaining({ cwd: "/home/user/proj" })
    );
  });

  it("writes message to stdin", () => {
    const mockWrite = vi.fn();
    const mockEnd = vi.fn();
    mockSpawn.mockImplementation(() => ({
      stdin: { write: mockWrite, end: mockEnd },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
    }));

    spawnCursorAgent("my prompt", { workspace: "/tmp" });

    expect(mockWrite).toHaveBeenCalledWith("my prompt", "utf-8");
    expect(mockEnd).toHaveBeenCalled();
  });
});
