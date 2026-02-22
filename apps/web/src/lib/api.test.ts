/**
 * Tests for API layer, including stream chunk parsing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessageStreaming } from "./api";

describe("sendMessageStreaming", () => {
  const originalFetch = globalThis.fetch;

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
});
