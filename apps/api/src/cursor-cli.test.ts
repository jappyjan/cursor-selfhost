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
