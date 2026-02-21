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
  createCursorSession,
  spawnCursorAgent,
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

describe("extractActivityLabel", () => {
  it("extracts Tool name from [Tool: name ...]", () => {
    expect(
      extractActivityLabel({ type: "tool_call", message: { content: [{ text: "[Tool: read_file path=/tmp/foo]" }] } })
    ).toBe("Tool: read_file");
  });
  it("returns Thinking… for thinking type", () => {
    expect(extractActivityLabel({ type: "thinking", message: { content: [{ text: "Let me consider..." }] } })).toBe(
      "Thinking…"
    );
  });
  it("truncates long text", () => {
    const long = "x".repeat(80);
    expect(extractActivityLabel({ type: "tool_result", message: { content: [{ text: long }] } })).toHaveLength(63);
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

  it("passes --workspace and --trust", () => {
    spawnCursorAgent("hello", { workspace: "/home/user/proj" });

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["--workspace", "/home/user/proj", "--trust"]),
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
