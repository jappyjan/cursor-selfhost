/**
 * Integration/E2E tests for chat message streaming and chat isolation.
 * Uses mock Cursor CLI (scripts/mock-cursor-agent.js) to verify:
 * - We correctly filter assistant content (exclude user echo, tool calls)
 * - Different chats get different sessions and don't mix messages
 *
 * Run with: pnpm test (or pnpm exec vitest run integration.test.ts)
 * CURSOR_CLI_PATH is set in test-setup.ts.
 *
 * Optional: Run with real Cursor CLI: unset CURSOR_CLI_PATH and ensure
 * `cursor agent status` succeeds. E2E tests will run if cursor is available.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { checkCursorAuth } from "./src/cursor-cli";
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
  const projRes = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceType: "local",
      path: "/tmp",
      name: "Integration Test Project",
      slug: "integration-test",
    }),
  });
  if (!projRes.ok) {
    const existing = await fetch("/api/projects").then((r) => r.json());
    const proj = existing.find((p: { slug: string }) => p.slug === "integration-test");
    if (proj) {
      const chatRes = await fetch(`/api/projects/${proj.id}/chats`, { method: "POST" });
      const chat = await chatRes.json();
      return { projectId: proj.id, chatId: chat.id };
    }
    throw new Error(`Project create failed: ${await projRes.text()}`);
  }
  const project = await projRes.json();
  const chatRes = await fetch(`/api/projects/${project.id}/chats`, { method: "POST" });
  const chat = await chatRes.json();
  return { projectId: project.id, chatId: chat.id };
}

/** Unique project for E2E isolation (path and slug must be unique) */
async function setupE2EProject(): Promise<{ projectId: string }> {
  await ensureConfig();
  const uniqueDir = mkdtempSync(join(tmpdir(), "e2e-"));
  const slug = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const projRes = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceType: "local",
      path: uniqueDir,
      name: `E2E Project ${slug}`,
      slug,
    }),
  });
  if (!projRes.ok) throw new Error(`E2E project create failed: ${await projRes.text()}`);
  const project = await projRes.json();
  return { projectId: project.id };
}

async function createChat(projectId: string): Promise<{ chatId: string }> {
  const res = await fetch(`/api/projects/${projectId}/chats`, { method: "POST" });
  if (!res.ok) throw new Error(`Create chat failed: ${await res.text()}`);
  const chat = await res.json();
  return { chatId: chat.id };
}

async function sendMessageAndDrain(chatId: string, content: string): Promise<Response> {
  const res = await fetch(`/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const reader = res.body?.getReader();
  if (reader) {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  }
  return res;
}

async function waitForPersist(ms = 200) {
  await new Promise((r) => setTimeout(r, ms));
}

async function consumeStream(
  res: Response,
  onChunk: (obj: {
    type: string;
    content?: string;
    error?: string;
    sessionId?: string | null;
    kind?: string;
    label?: string;
    details?: string;
    block?: { type: string; content?: string; kind?: string; label?: string; details?: string };
  }) => void
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        onChunk(parsed);
      } catch {
        // skip malformed
      }
    }
  }
  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer);
      onChunk(parsed);
    } catch {
      /* ignore */
    }
  }
}

const useMockCli = !process.env.RUN_E2E_WITH_REAL_CURSOR;

describe("Message streaming (mock CLI)", () => {
  it.skipIf(!useMockCli)("streams only assistant content, excludes user echo and tool calls", async () => {
    const { chatId } = await setupProjectAndChat();
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "What is 2+2?" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("ndjson");

    const chunks: string[] = [];
    let doneSessionId: string | null = null;
    let hadError = false;

    await consumeStream(res, (obj) => {
      if (obj.type === "block" && obj.block?.type === "text") chunks.push(obj.block.content ?? "");
      if (obj.type === "chunk") chunks.push(obj.content ?? "");
      if (obj.type === "done") doneSessionId = obj.sessionId ?? null;
      if (obj.type === "error") hadError = true;
    });

    expect(hadError).toBe(false);
    const streamedText = chunks.join("");
    // Must NOT contain raw user echo (user type line content)
    expect(streamedText).not.toContain("What is 2+2?");
    // Must NOT contain tool call output
    expect(streamedText).not.toContain("[Tool: read_file");
    // Must contain assistant response only
    expect(streamedText).toContain("[ASSISTANT_REPLY]");
    expect(doneSessionId).toBeTruthy();
  });

  it.skipIf(!useMockCli)("does not duplicate content (assistant + result both contain same text)", async () => {
    const { chatId } = await setupProjectAndChat();
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Hello" }),
    });
    expect(res.status).toBe(200);

    const chunks: string[] = [];
    await consumeStream(res, (obj) => {
      if (obj.type === "block" && obj.block?.type === "text") chunks.push(obj.block.content ?? "");
      if (obj.type === "chunk") chunks.push(obj.content ?? "");
    });

    const streamedText = chunks.join("");
    const marker = "[ASSISTANT_REPLY]";
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (streamedText.match(new RegExp(escaped, "g")) ?? []).length;
    expect(count).toBe(1);
    expect(streamedText).not.toMatch(new RegExp(`${escaped}.*${escaped}`));
  });

  it.skipIf(!useMockCli)("emits activity events for tool_call and thinking (for UI)", async () => {
    const { chatId } = await setupProjectAndChat();
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Test" }),
    });
    expect(res.status).toBe(200);

    const activities: { kind: string; label: string; details?: string }[] = [];
    await consumeStream(res, (obj) => {
      if (obj.type === "block" && obj.block?.type === "activity")
        activities.push({
          kind: obj.block.kind ?? "",
          label: obj.block.label ?? "",
          details: obj.block.details,
        });
      if (obj.type === "activity")
        activities.push({ kind: obj.kind ?? "", label: obj.label ?? "", details: obj.details });
    });

    expect(activities.some((a) => a.kind === "thinking")).toBe(true);
    expect(activities.some((a) => a.kind === "tool_call")).toBe(true);
    expect(activities.some((a) => a.label.includes("read_file"))).toBe(true);
  });

  it.skipIf(!useMockCli)("emits tool call details (path, file) for richer display", async () => {
    const { chatId } = await setupProjectAndChat();
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Test" }),
    });
    expect(res.status).toBe(200);

    const activities: { kind: string; label: string; details?: string }[] = [];
    await consumeStream(res, (obj) => {
      if (obj.type === "block" && obj.block?.type === "activity")
        activities.push({
          kind: obj.block.kind ?? "",
          label: obj.block.label ?? "",
          details: obj.block.details,
        });
    });

    const readFile = activities.find((a) => a.label.includes("read_file"));
    expect(readFile).toBeDefined();
    expect(readFile?.details).toContain("path:");
    expect(readFile?.details).toContain("/tmp/foo.ts");

    const searchReplace = activities.find((a) => a.label.includes("search_replace"));
    expect(searchReplace).toBeDefined();
    expect(searchReplace?.details).toContain("path:");
    expect(searchReplace?.details).toContain("src/index.ts");
  });

  it.skipIf(!useMockCli)("persists content without duplication (no result echo)", async () => {
    const { chatId } = await setupProjectAndChat();
    await sendMessageAndDrain(chatId, "No duplication");
    await waitForPersist();
    const msgs = await fetch(`/api/chats/${chatId}/messages`).then((r) => r.json());
    const assistantMsg = msgs.find((m: { role: string }) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    const marker = "[ASSISTANT_REPLY]";
    const count = (assistantMsg.content.match(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    expect(count).toBe(1);
  });

  it.skipIf(!useMockCli)("persists blocks (ordered text + activities) with assistant message", async () => {
    const { chatId } = await setupProjectAndChat();
    await sendMessageAndDrain(chatId, "Test blocks");
    await waitForPersist();
    const msgs = await fetch(`/api/chats/${chatId}/messages`).then((r) => r.json());
    const assistantMsg = msgs.find((m: { role: string }) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.blocks).toBeDefined();
    const blocks = typeof assistantMsg.blocks === "string" ? JSON.parse(assistantMsg.blocks) : assistantMsg.blocks;
    expect(Array.isArray(blocks)).toBe(true);
    const activities = blocks.filter((b: { type: string }) => b.type === "activity");
    const texts = blocks.filter((b: { type: string }) => b.type === "text");
    expect(activities.some((a: { kind: string }) => a.kind === "tool_call")).toBe(true);
    expect(activities.some((a: { kind: string }) => a.kind === "thinking")).toBe(true);
    const toolActivity = activities.find((a: { kind: string }) => a.kind === "tool_call");
    expect(toolActivity?.label).toBeDefined();
    expect(toolActivity?.label).not.toBe("tool_call");
    expect(toolActivity?.details).toBeDefined();
    expect(texts.length).toBeGreaterThan(0);
    expect(texts[0].content).toContain("[ASSISTANT_REPLY]");
  });

  it.skipIf(!useMockCli)("persists only assistant content to DB, not user/tool mix", async () => {
    const { chatId } = await setupProjectAndChat();
    const userPrompt = "Explain recursion";
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: userPrompt }),
    });
    // Drain the stream so the handler completes and persists
    const reader = res.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
    await new Promise((r) => setTimeout(r, 150));

    const msgsRes = await fetch(`/api/chats/${chatId}/messages`);
    const messages = await msgsRes.json();
    const assistantMsg = messages.find((m: { role: string }) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.content).not.toContain("[Tool:");
    expect(assistantMsg.content).not.toContain("Explain recursion"); // user echo
    expect(assistantMsg.content).toContain("[ASSISTANT_REPLY]");
  });
});

describe("Chat isolation (different chats, different sessions)", () => {
  it.skipIf(!useMockCli)("each chat gets its own session and messages do not mix", async () => {
    const { projectId, chatId: chatId1 } = await setupProjectAndChat();

    // Create second chat in same project
    const chat2Res = await fetch(`/api/projects/${projectId}/chats`, { method: "POST" });
    const chat2 = await chat2Res.json();
    const chatId2 = chat2.id;

    // Send to chat 1
    const res1 = await fetch(`/api/chats/${chatId1}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Chat 1 prompt" }),
    });
    let session1: string | null = null;
    await consumeStream(res1, (obj) => {
      if (obj.type === "done") session1 = obj.sessionId ?? null;
    });

    // Send to chat 2
    const res2 = await fetch(`/api/chats/${chatId2}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Chat 2 prompt" }),
    });
    let session2: string | null = null;
    await consumeStream(res2, (obj) => {
      if (obj.type === "done") session2 = obj.sessionId ?? null;
    });

    expect(session1).toBeTruthy();
    expect(session2).toBeTruthy();
    expect(session1).not.toBe(session2);

    // Verify messages are in correct chats
    const msgs1 = await fetch(`/api/chats/${chatId1}/messages`).then((r) => r.json());
    const msgs2 = await fetch(`/api/chats/${chatId2}/messages`).then((r) => r.json());

    const user1 = msgs1.find((m: { role: string }) => m.role === "user");
    const user2 = msgs2.find((m: { role: string }) => m.role === "user");
    expect(user1?.content).toBe("Chat 1 prompt");
    expect(user2?.content).toBe("Chat 2 prompt");

    // Chat 1 must not contain Chat 2 content
    const assistant1 = msgs1.find((m: { role: string }) => m.role === "assistant");
    const assistant2 = msgs2.find((m: { role: string }) => m.role === "assistant");
    if (assistant1) expect(assistant1.content).not.toContain("Chat 2 prompt");
    if (assistant2) expect(assistant2.content).not.toContain("Chat 1 prompt");
  });

  it.skipIf(!useMockCli)("resume uses same session for same chat across messages", async () => {
    const { chatId } = await setupProjectAndChat();

    // First message
    const res1 = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "First" }),
    });
    let sessionId: string | null = null;
    await consumeStream(res1, (obj) => {
      if (obj.type === "done") sessionId = obj.sessionId ?? null;
    });
    expect(sessionId).toBeTruthy();

    // Chat should now have sessionId
    const chatRes = await fetch(`/api/chats/${chatId}`);
    const chat = await chatRes.json();
    expect(chat.sessionId).toBe(sessionId);

    // Second message should use --resume
    const res2 = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Second" }),
    });
    let sessionId2: string | null = null;
    await consumeStream(res2, (obj) => {
      if (obj.type === "done") sessionId2 = obj.sessionId ?? null;
    });
    // Mock returns same session when --resume is passed
    expect(sessionId2).toBe(sessionId);
  });
});

const E2E_TIMEOUT = 90_000;
const runE2E = process.env.RUN_E2E_WITH_REAL_CURSOR ? it : it.skip;

function requireCursorAuth() {
  return async () => {
    const { ok } = await checkCursorAuth();
    if (!ok) {
      throw new Error("Cursor CLI unavailable. Set CURSOR_CLI_PATH, run cursor agent login, or set CURSOR_API_KEY.");
    }
  };
}

describe("E2E with real Cursor CLI", () => {
  describe("Happy path: single message", () => {
    runE2E("sends message, streams response, persists to DB", { timeout: E2E_TIMEOUT }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);

      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Reply with only the word: OK" }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("ndjson");

      const chunks: string[] = [];
      let doneSessionId: string | null = null;
      let hadError = false;
      await consumeStream(res, (obj) => {
        if (obj.type === "block" && obj.block?.type === "text") chunks.push(obj.block.content ?? "");
        if (obj.type === "chunk") chunks.push(obj.content ?? "");
        if (obj.type === "done") doneSessionId = obj.sessionId ?? null;
        if (obj.type === "error") hadError = true;
      });

      expect(hadError).toBe(false);
      const text = chunks.join("");
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/\[Tool:\s/);
      expect(doneSessionId).toBeTruthy();

      await waitForPersist();
      const msgs = await fetch(`/api/chats/${chatId}/messages`).then((r) => r.json());
      expect(msgs).toHaveLength(2); // user + assistant
      expect(msgs[0].role).toBe("user");
      expect(msgs[0].content).toBe("Reply with only the word: OK");
      expect(msgs[1].role).toBe("assistant");
      expect(msgs[1].content.length).toBeGreaterThan(0);
    });

    runE2E("returns session_id in done event and persists to chat", { timeout: E2E_TIMEOUT }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);

      const res = await sendMessageAndDrain(chatId, "Say hi");
      expect(res.status).toBe(200);
      await waitForPersist();

      const chat = await fetch(`/api/chats/${chatId}`).then((r) => r.json());
      expect(chat.sessionId).toBeTruthy();
    });
  });

  describe("Happy path: multi-turn conversation", () => {
    runE2E("maintains context across multiple messages in same chat", { timeout: E2E_TIMEOUT * 2 }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);

      const res1 = await sendMessageAndDrain(chatId, "What is 2+2? Reply with only the number.");
      expect(res1.status).toBe(200);
      await waitForPersist();

      const res2 = await sendMessageAndDrain(chatId, "Double that number. Reply with only the number.");
      expect(res2.status).toBe(200);
      await waitForPersist();

      const msgs = await fetch(`/api/chats/${chatId}/messages`).then((r) => r.json());
      expect(msgs).toHaveLength(4); // user, assistant, user, assistant
      expect(msgs[0].content).toContain("2+2");
      expect(msgs[2].content).toContain("Double");
    });

    runE2E("uses same session for follow-up messages (--resume)", { timeout: E2E_TIMEOUT * 2 }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);

      const res1 = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Say one" }),
      });
      let session1: string | null = null;
      await consumeStream(res1, (o) => {
        if (o.type === "done") session1 = o.sessionId ?? null;
      });
      await waitForPersist();

      const res2 = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Say two" }),
      });
      let session2: string | null = null;
      await consumeStream(res2, (o) => {
        if (o.type === "done") session2 = o.sessionId ?? null;
      });

      expect(session1).toBeTruthy();
      expect(session2).toBe(session1);
    });
  });

  describe("Happy path: multiple chats", () => {
    runE2E("isolates messages between different chats", { timeout: E2E_TIMEOUT * 2 }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId: chatA } = await createChat(projectId);
      const { chatId: chatB } = await createChat(projectId);

      await sendMessageAndDrain(chatA, "Chat A: reply with only A");
      await waitForPersist();
      await sendMessageAndDrain(chatB, "Chat B: reply with only B");
      await waitForPersist();

      const msgsA = await fetch(`/api/chats/${chatA}/messages`).then((r) => r.json());
      const msgsB = await fetch(`/api/chats/${chatB}/messages`).then((r) => r.json());

      expect(msgsA).toHaveLength(2);
      expect(msgsB).toHaveLength(2);
      expect(msgsA[0].content).toContain("Chat A");
      expect(msgsB[0].content).toContain("Chat B");
      expect(msgsA[1].content).not.toContain("Chat B");
      expect(msgsB[1].content).not.toContain("Chat A");
    });

    runE2E("each chat gets distinct session_id", { timeout: E2E_TIMEOUT * 2 }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId: chatA } = await createChat(projectId);
      const { chatId: chatB } = await createChat(projectId);

      await sendMessageAndDrain(chatA, "Hi");
      await waitForPersist();
      await sendMessageAndDrain(chatB, "Hi");
      await waitForPersist();

      const chatARec = await fetch(`/api/chats/${chatA}`).then((r) => r.json());
      const chatBRec = await fetch(`/api/chats/${chatB}`).then((r) => r.json());
      expect(chatARec.sessionId).toBeTruthy();
      expect(chatBRec.sessionId).toBeTruthy();
      expect(chatARec.sessionId).not.toBe(chatBRec.sessionId);
    });

    runE2E("three chats with multiple messages each — no cross-contamination", {
      timeout: E2E_TIMEOUT * 3,
    }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId: c1 } = await createChat(projectId);
      const { chatId: c2 } = await createChat(projectId);
      const { chatId: c3 } = await createChat(projectId);

      await sendMessageAndDrain(c1, "Topic 1");
      await sendMessageAndDrain(c2, "Topic 2");
      await sendMessageAndDrain(c3, "Topic 3");
      await waitForPersist();

      await sendMessageAndDrain(c1, "More on 1");
      await sendMessageAndDrain(c2, "More on 2");
      await waitForPersist();

      const m1 = await fetch(`/api/chats/${c1}/messages`).then((r) => r.json());
      const m2 = await fetch(`/api/chats/${c2}/messages`).then((r) => r.json());
      const m3 = await fetch(`/api/chats/${c3}/messages`).then((r) => r.json());

      expect(m1).toHaveLength(4);
      expect(m2).toHaveLength(4);
      expect(m3).toHaveLength(2);
      const userContents1 = m1.filter((x: { role: string }) => x.role === "user").map((x: { content: string }) => x.content);
      const userContents2 = m2.filter((x: { role: string }) => x.role === "user").map((x: { content: string }) => x.content);
      const userContents3 = m3.filter((x: { role: string }) => x.role === "user").map((x: { content: string }) => x.content);
      expect(userContents1).toEqual(["Topic 1", "More on 1"]);
      expect(userContents2).toEqual(["Topic 2", "More on 2"]);
      expect(userContents3).toEqual(["Topic 3"]);
    });
  });

  describe("Streaming", () => {
    runE2E("delivers chunks incrementally (not all at once)", { timeout: E2E_TIMEOUT }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Count from 1 to 5, one number per line" }),
      });
      const chunkCounts: number[] = [];
      await consumeStream(res, (obj) => {
        const c = (obj.type === "block" && obj.block?.type === "text" ? obj.block.content : obj.content) ?? "";
        if (c) chunkCounts.push(c.length);
      });
      expect(chunkCounts.length).toBeGreaterThan(0);
    });

    runE2E("does not stream raw tool call output into chat", { timeout: E2E_TIMEOUT }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Say hello in one word" }),
      });
      const chunks: string[] = [];
      await consumeStream(res, (obj) => {
        if (obj.type === "block" && obj.block?.type === "text") chunks.push(obj.block.content ?? "");
        if (obj.type === "chunk") chunks.push(obj.content ?? "");
      });
      const text = chunks.join("");
      expect(text).not.toMatch(/\[Tool:\s/);
    });

    runE2E("emits tool call label and details for UI (real Cursor CLI format)", { timeout: E2E_TIMEOUT }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "List files in this directory" }),
      });
      expect(res.status).toBe(200);
      const activities: { kind: string; label: string; details?: string }[] = [];
      await consumeStream(res, (obj) => {
        if (obj.type === "block" && obj.block?.type === "activity") {
          activities.push({
            kind: (obj.block as { kind?: string }).kind ?? "",
            label: (obj.block as { label?: string }).label ?? "",
            details: (obj.block as { details?: string }).details,
          });
        }
      });
      const toolCalls = activities.filter((a) => a.kind === "tool_call");
      expect(toolCalls.length).toBeGreaterThan(0);
      const withLabel = toolCalls.find((a) => a.label.startsWith("Tool: ") && a.label !== "Tool: tool_call");
      expect(withLabel).toBeDefined();
      expect(withLabel!.label).not.toBe("tool_call");
      const withDetails = toolCalls.find((a) => a.details && a.details.length > 0);
      expect(withDetails).toBeDefined();
    });

    runE2E("persists tool call details to DB (GET messages returns blocks with details)", {
      timeout: E2E_TIMEOUT,
    }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);
      await sendMessageAndDrain(chatId, "List files in this directory");
      await waitForPersist();
      const msgs = await fetch(`/api/chats/${chatId}/messages`).then((r) => r.json());
      const assistantMsg = msgs.find((m: { role: string }) => m.role === "assistant");
      expect(assistantMsg).toBeDefined();
      const blocks = typeof assistantMsg.blocks === "string" ? JSON.parse(assistantMsg.blocks) : assistantMsg.blocks;
      expect(Array.isArray(blocks)).toBe(true);
      const toolActivities = blocks.filter((b: { type: string; kind?: string }) => b.type === "activity" && b.kind === "tool_call");
      expect(toolActivities.length).toBeGreaterThan(0);
      const withDetails = toolActivities.find((a: { details?: string }) => a.details && a.details.length > 0);
      expect(withDetails).toBeDefined();
      expect(withDetails!.label).not.toBe("tool_call");
    });

    runE2E("streaming data does not mix between concurrent chats", { timeout: E2E_TIMEOUT * 2 }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId: chatA } = await createChat(projectId);
      const { chatId: chatB } = await createChat(projectId);

      const [resA, resB] = await Promise.all([
        fetch(`/api/chats/${chatA}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Reply with only the word ALPHA" }),
        }),
        fetch(`/api/chats/${chatB}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Reply with only the word BETA" }),
        }),
      ]);

      const chunksA: string[] = [];
      const chunksB: string[] = [];
      await Promise.all([
        consumeStream(resA, (obj) => {
          if (obj.type === "block" && obj.block?.type === "text") chunksA.push(obj.block.content ?? "");
          if (obj.type === "chunk") chunksA.push(obj.content ?? "");
        }),
        consumeStream(resB, (obj) => {
          if (obj.type === "block" && obj.block?.type === "text") chunksB.push(obj.block.content ?? "");
          if (obj.type === "chunk") chunksB.push(obj.content ?? "");
        }),
      ]);

      const streamA = chunksA.join("");
      const streamB = chunksB.join("");
      expect(streamA.length).toBeGreaterThan(0);
      expect(streamB.length).toBeGreaterThan(0);
      expect(streamA).not.toContain("BETA");
      expect(streamB).not.toContain("ALPHA");
    });
  });

  describe("Edge cases", () => {
    runE2E("rejects empty content with 400", async () => {
      await ensureConfig();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);

      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("content");
    });

    runE2E("rejects whitespace-only content with 400", async () => {
      await ensureConfig();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);

      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "   \n\t  " }),
      });
      expect(res.status).toBe(400);
    });

    runE2E("returns 404 for unknown chat", async () => {
      const res = await fetch(`/api/chats/nonexistent-chat-id/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Hello" }),
      });
      expect(res.status).toBe(404);
    });

    runE2E("returns 400 when content missing from body", async () => {
      await ensureConfig();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);

      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    runE2E("GET messages returns correct order (chronological)", { timeout: E2E_TIMEOUT * 2 }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);

      await sendMessageAndDrain(chatId, "First");
      await waitForPersist();
      await sendMessageAndDrain(chatId, "Second");
      await waitForPersist();

      const msgs = await fetch(`/api/chats/${chatId}/messages`).then((r) => r.json());
      expect(msgs).toHaveLength(4);
      const roles = msgs.map((m: { role: string }) => m.role);
      expect(roles).toEqual(["user", "assistant", "user", "assistant"]);
      const contents = msgs.map((m: { content: string }) => m.content);
      expect(contents[0]).toBe("First");
      expect(contents[2]).toBe("Second");
    });

    runE2E("messages have required fields (id, chatId, role, content, createdAt)", {
      timeout: E2E_TIMEOUT,
    }, async () => {
      await requireCursorAuth()();
      const { projectId } = await setupE2EProject();
      const { chatId } = await createChat(projectId);
      await sendMessageAndDrain(chatId, "Hi");
      await waitForPersist();

      const msgs = await fetch(`/api/chats/${chatId}/messages`).then((r) => r.json());
      for (const m of msgs) {
        expect(m).toHaveProperty("id");
        expect(m).toHaveProperty("chatId", chatId);
        expect(m).toHaveProperty("role");
        expect(["user", "assistant"]).toContain(m.role);
        expect(m).toHaveProperty("content");
        expect(m).toHaveProperty("createdAt");
      }
    });
  });
});
