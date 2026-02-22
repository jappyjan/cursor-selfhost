/**
 * Tests for message persistence and loading — ensures all messages are persisted
 * and loadable regardless of client connection. Mocks spawnCursorAgent for
 * deterministic, fast tests.
 */
import { describe, expect, it, beforeAll, vi, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const mockSpawn = vi.fn();
vi.mock("child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

import { app } from "./app";
import { runMigrations, ensureAppConfigDefaults } from "@cursor-selfhost/db";

beforeAll(async () => {
  runMigrations();
  await ensureAppConfigDefaults();
});

function fetch(path: string, init?: RequestInit) {
  return app.fetch(new Request(`http://localhost${path}`, init));
}

async function ensureConfig() {
  await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectsBasePath: "/tmp" }),
  });
}

async function setupProjectAndChat(): Promise<{ projectId: string; chatId: string }> {
  await ensureConfig();
  const uniqueDir = mkdtempSync(join(tmpdir(), "msg-persist-"));
  const slug = `persist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const projRes = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceType: "local",
      path: uniqueDir,
      name: "Persistence Test Project",
      slug,
    }),
  });
  const project = await projRes.json();
  const chatRes = await fetch(`/api/projects/${project.id}/chats`, { method: "POST" });
  const chat = await chatRes.json();
  return { projectId: project.id, chatId: chat.id };
}

/** Create a mock proc that emits NDJSON lines and closes after a delay. */
function createMockProc(lines: string[], closeDelayMs = 0) {
  const proc = {
    stdin: { write: vi.fn(), end: vi.fn() },
    stdout: { on: vi.fn((_ev: string, cb: (chunk: Buffer) => void) => {
      const data = lines.join("\n") + "\n";
      if (closeDelayMs > 0) {
        setTimeout(() => cb(Buffer.from(data)), closeDelayMs);
      } else {
        setImmediate(() => cb(Buffer.from(data)));
      }
      return proc;
    }) },
    stderr: { on: vi.fn() },
    on: vi.fn((ev: string, cb: (code?: number) => void) => {
      if (ev === "close") {
        setTimeout(() => cb(0), closeDelayMs + 10);
      }
      return proc;
    }),
  };
  return proc;
}

describe("Message persistence", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  it("persists assistant message regardless of client connection (simulated disconnect)", async () => {
    mockSpawn.mockImplementation(() => {
      const lines = [
        '{"type":"system","subtype":"init","session_id":"sess-1"}',
        '{"type":"thinking","message":{"content":[{"type":"text","text":"Thinking..."}]}',
        '{"type":"assistant","message":{"content":[{"type":"text","text":"Hello "}]}}',
        '{"type":"assistant","message":{"content":[{"type":"text","text":"world"}]}}',
        '{"type":"result","result":"Hello world","session_id":"sess-1"}',
      ];
      return createMockProc(lines);
    });

    const { chatId } = await setupProjectAndChat();

    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Hi" }),
    });
    expect(res.ok).toBe(true);

    const reader = res.body?.getReader();
    if (reader) {
      await reader.read();
      reader.cancel();
    }

    await new Promise((r) => setTimeout(r, 150));

    const messagesRes = await fetch(`/api/chats/${chatId}/messages`);
    const messages = await messagesRes.json();
    expect(messages).toHaveLength(2);
    const userMsg = messages.find((m: { role: string }) => m.role === "user");
    const assistantMsg = messages.find((m: { role: string }) => m.role === "assistant");
    expect(userMsg).toBeDefined();
    expect(userMsg.content).toBe("Hi");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.content).toBe("Hello world");
  });

  it("persists incrementally so GET returns partial content before stream ends", async () => {
    let resolveFirstChunk: () => void;
    const firstChunkReceived = new Promise<void>((r) => {
      resolveFirstChunk = r;
    });

    mockSpawn.mockImplementation(() => {
      const proc = {
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: {
          on: vi.fn((_ev: string, cb: (chunk: Buffer) => void) => {
            setImmediate(() => {
              cb(Buffer.from('{"type":"thinking","message":{"content":[{"type":"text","text":"..."}]}}\n'));
              resolveFirstChunk();
            });
            setTimeout(() => {
              cb(Buffer.from('{"type":"assistant","message":{"content":[{"type":"text","text":"Partial"}]}}\n'));
            }, 30);
            setTimeout(() => {
              cb(Buffer.from('{"type":"assistant","message":{"content":[{"type":"text","text":" content"}]}}\n'));
            }, 60);
            setTimeout(() => {
              cb(Buffer.from('{"type":"result","result":"Partial content","session_id":"s1"}\n'));
            }, 90);
            return proc;
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((ev: string, cb: (code?: number) => void) => {
          if (ev === "close") setTimeout(() => cb(0), 150);
          return proc;
        }),
      };
      return proc;
    });

    const { chatId } = await setupProjectAndChat();

    const postRes = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Test" }),
    });
    expect(postRes.ok).toBe(true);

    await firstChunkReceived;
    await new Promise((r) => setTimeout(r, 50));

    const messagesRes = await fetch(`/api/chats/${chatId}/messages`);
    const messages = await messagesRes.json();
    const assistantMsg = messages.find((m: { role: string }) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.content).toMatch(/Partial/);
  });

  it("GET /api/chats/:id/messages returns all persisted messages", async () => {
    mockSpawn.mockImplementation(() => {
      const lines = [
        '{"type":"system","session_id":"s1"}',
        '{"type":"assistant","message":{"content":[{"type":"text","text":"Reply"}]}}',
        '{"type":"result","result":"Reply","session_id":"s1"}',
      ];
      return createMockProc(lines);
    });

    const { chatId } = await setupProjectAndChat();

    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Hello" }),
    });
    expect(res.ok).toBe(true);
    const reader = res.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    const messagesRes = await fetch(`/api/chats/${chatId}/messages`);
    const messages = await messagesRes.json();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("Hello");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("Reply");
  });

  it("multiple clients get same messages when one sends", async () => {
    mockSpawn.mockImplementation(() => {
      const lines = [
        '{"type":"system","session_id":"s1"}',
        '{"type":"assistant","message":{"content":[{"type":"text","text":"Response"}]}}',
        '{"type":"result","result":"Response","session_id":"s1"}',
      ];
      return createMockProc(lines);
    });

    const { chatId } = await setupProjectAndChat();

    const clientAFirst = await fetch(`/api/chats/${chatId}/messages`);
    const initialMessages = await clientAFirst.json();
    expect(initialMessages).toHaveLength(0);

    const postRes = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "From client B" }),
    });
    expect(postRes.ok).toBe(true);
    const reader = postRes.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    const clientASecond = await fetch(`/api/chats/${chatId}/messages`);
    const afterMessages = await clientASecond.json();
    expect(afterMessages).toHaveLength(2);
    const assistantMsg = afterMessages.find((m: { role: string }) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.content).toBe("Response");
  });

  it("persists blocks with activities (tool_call, thinking)", async () => {
    mockSpawn.mockImplementation(() => {
      const lines = [
        '{"type":"system","session_id":"s1"}',
        '{"type":"thinking","message":{"content":[{"type":"text","text":"..."}]}}',
        '{"type":"tool_call","subtype":"started","tool_call":{"readToolCall":{"args":{"path":"/tmp/foo"}}}}',
        '{"type":"assistant","message":{"content":[{"type":"text","text":"Done"}]}}',
        '{"type":"result","result":"Done","session_id":"s1"}',
      ];
      return createMockProc(lines);
    });

    const { chatId } = await setupProjectAndChat();

    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Read foo" }),
    });
    expect(res.ok).toBe(true);
    const reader = res.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    const messagesRes = await fetch(`/api/chats/${chatId}/messages`);
    const messages = await messagesRes.json();
    const assistantMsg = messages.find((m: { role: string }) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.blocks).toBeDefined();
    const blocks = JSON.parse(assistantMsg.blocks);
    expect(blocks.some((b: { type: string }) => b.type === "activity")).toBe(true);
    expect(blocks.some((b: { type: string }) => b.type === "text")).toBe(true);
  });
});
