/**
 * Tests for API layer, including stream chunk parsing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessageStreaming } from "./api";

describe("sendMessageStreaming", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("passes title chunk to onChunk when stream contains title event", async () => {
    const chunks: { type: string; title?: string }[] = [];
    const onChunk = (chunk: { type: string; title?: string }) => {
      if (chunk.type === "title") chunks.push(chunk);
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"type":"block","block":{"type":"text","content":"Hi"}}\n'));
            controller.enqueue(new TextEncoder().encode('{"type":"title","title":"Fix auth bug"}\n'));
            controller.enqueue(new TextEncoder().encode('{"type":"done","sessionId":"sess-1"}\n'));
            controller.close();
          },
        }),
      })
    );

    await sendMessageStreaming("chat-1", "Hello", onChunk);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ type: "title", title: "Fix auth bug" });
  });

  it("calls onChunk for block, done, and title in correct order", async () => {
    const received: { type: string }[] = [];
    const onChunk = (chunk: { type: string }) => {
      received.push(chunk);
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"type":"block","block":{"type":"text","content":"A"}}\n'));
            controller.enqueue(new TextEncoder().encode('{"type":"title","title":"Chat title"}\n'));
            controller.enqueue(new TextEncoder().encode('{"type":"done","sessionId":"x"}\n'));
            controller.close();
          },
        }),
      })
    );

    await sendMessageStreaming("chat-1", "Hi", onChunk);

    const types = received.map((r) => r.type);
    expect(types).toContain("block");
    expect(types).toContain("title");
    expect(types).toContain("done");
    const titleChunk = received.find((r) => (r as { type: string; title?: string }).type === "title" && (r as { title?: string }).title);
    expect(titleChunk).toEqual({ type: "title", title: "Chat title" });
  });

  it("passes error chunk to onChunk when stream contains error event", async () => {
    const errors: { type: string; error?: string }[] = [];
    const onChunk = (chunk: { type: string; error?: string }) => {
      if (chunk.type === "error") errors.push(chunk);
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"type":"error","error":"Cursor CLI exited with code 1"}\n'));
            controller.enqueue(new TextEncoder().encode('{"type":"done","sessionId":null}\n'));
            controller.close();
          },
        }),
      })
    );

    await sendMessageStreaming("chat-1", "Hi", onChunk);

    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe("Cursor CLI exited with code 1");
  });

  it("throws with error message when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Chat not found" }),
      })
    );

    await expect(sendMessageStreaming("chat-1", "Hi", () => {})).rejects.toThrow("Chat not found");
  });

  it("throws generic message when response is not ok and body has no error field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      })
    );

    await expect(sendMessageStreaming("chat-1", "Hi", () => {})).rejects.toThrow("Failed to send message");
  });

  it("passes all chunk types to onChunk (block, done, title, error)", async () => {
    const received: { type: string }[] = [];
    const onChunk = (chunk: { type: string }) => {
      received.push(chunk);
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"type":"block","block":{"type":"activity","kind":"thinking","label":"Thinking…"}}\n'));
            controller.enqueue(new TextEncoder().encode('{"type":"block","block":{"type":"text","content":"Hello"}}\n'));
            controller.enqueue(new TextEncoder().encode('{"type":"done","sessionId":"sess-1"}\n'));
            controller.enqueue(new TextEncoder().encode('{"type":"title","title":"Chat title"}\n'));
            controller.close();
          },
        }),
      })
    );

    await sendMessageStreaming("chat-1", "Hi", onChunk);

    const types = received.map((r) => r.type);
    expect(types).toContain("block");
    expect(types).toContain("done");
    expect(types).toContain("title");
    expect(received.filter((r) => r.type === "block")).toHaveLength(2);
  });
});
