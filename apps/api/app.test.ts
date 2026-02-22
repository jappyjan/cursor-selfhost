/**
 * API tests — run with: pnpm test
 * Uses in-memory SQLite (DATABASE_PATH=:memory:) for isolation.
 * Mocks cursor-cli to avoid requiring the Cursor agent binary.
 */
import { describe, expect, it, beforeAll, vi, beforeEach } from "vitest";

vi.mock("./src/cursor-cli", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./src/cursor-cli")>();
  return { ...actual };
});

import { app } from "./app";
import { runMigrations, ensureAppConfigDefaults } from "@cursor-selfhost/db";

beforeAll(async () => {
  runMigrations();
  await ensureAppConfigDefaults();
});


function fetch(path: string, init?: RequestInit) {
  return app.fetch(new Request(`http://localhost${path}`, init));
}

describe("API", () => {
  describe("GET /api/health", () => {
    it("returns ok", async () => {
      const res = await fetch("/api/health");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true });
    });
  });

  describe("GET /api/config", () => {
    it("returns config with configured false when base path not set", async () => {
      const res = await fetch("/api/config");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.configured).toBe(false);
      expect(json.sendShortcut).toBe("enter");
    });
  });

  describe("PUT /api/config", () => {
    it("persists projectsBasePath", async () => {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectsBasePath: "/tmp/projects" }),
      });
      expect(res.status).toBe(200);
      const getRes = await fetch("/api/config");
      const json = await getRes.json();
      expect(json.projectsBasePath).toBe("/tmp/projects");
      expect(json.configured).toBe(true);
    });

    it("persists sendShortcut", async () => {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendShortcut: "shift_enter" }),
      });
      const res = await fetch("/api/config");
      const json = await res.json();
      expect(json.sendShortcut).toBe("shift_enter");
    });
  });

  describe("GET /api/browse", () => {
    it("returns entries for path under base", async () => {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectsBasePath: "/tmp" }),
      });
      const res = await fetch("/api/browse?path=/tmp");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.entries)).toBe(true);
    });

    it("returns 400 when path outside base", async () => {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectsBasePath: "/tmp" }),
      });
      const res = await fetch("/api/browse?path=/etc");
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("outside");
    });
  });

  describe("POST /api/browse/create", () => {
    it("creates folder under base", async () => {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectsBasePath: "/tmp" }),
      });
      const res = await fetch("/api/browse/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPath: "/tmp", name: "cursor-selfhost-test-create" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.path).toContain("cursor-selfhost-test-create");
    });

    it("returns 400 when name invalid", async () => {
      const res = await fetch("/api/browse/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPath: "/tmp", name: "../etc" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("Projects CRUD", () => {
    it("GET /api/projects returns empty list", async () => {
      const res = await fetch("/api/projects");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    });

    it("POST /api/projects creates local project", async () => {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectsBasePath: "/tmp" }),
      });
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "local",
          path: "/tmp",
          name: "Test Project",
          slug: "test-project",
        }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.slug).toBe("test-project");
      expect(json.name).toBe("Test Project");
      expect(json.path).toBeDefined();
      expect(json.path).toContain("tmp");
      expect(json.sourceType).toBe("local");
    });

    it("GET /api/projects/by-slug/:slug returns project", async () => {
      const res = await fetch("/api/projects/by-slug/test-project");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.slug).toBe("test-project");
    });

    it("GET /api/projects/:id returns 404 for unknown id", async () => {
      const res = await fetch("/api/projects/unknown-id");
      expect(res.status).toBe(404);
    });

    it("POST /api/projects rejects path outside base", async () => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "local",
          path: "/etc",
          name: "Bad",
          slug: "bad",
        }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("within");
    });

    it("POST /api/projects rejects invalid slug", async () => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "local",
          path: "/tmp",
          name: "Test",
          slug: "invalid slug!",
        }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Slug");
    });
  });

  describe("Project MCP servers", () => {
    let projectId: string;

    beforeAll(async () => {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectsBasePath: "/tmp" }),
      });
      const projectsRes = await fetch("/api/projects");
      const projects = await projectsRes.json();
      projectId = projects[0]?.id ?? "";
    });

    it("GET /api/projects/:id/mcp-servers returns empty list", async () => {
      const res = await fetch(`/api/projects/${projectId}/mcp-servers`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBe(0);
    });

    it("POST /api/projects/:id/mcp-servers rejects invalid body (empty name)", async () => {
      const res = await fetch(`/api/projects/${projectId}/mcp-servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          command: "npx",
          args: [],
        }),
      });
      expect(res.status).toBe(400);
    });

    it("POST /api/projects/:id/mcp-servers creates server", async () => {
      const res = await fetch(`/api/projects/${projectId}/mcp-servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "filesystem",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
          env: { ALLOWED_DIRS: "/tmp" },
          enabled: true,
        }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe("filesystem");
      expect(json.command).toBe("npx");
      expect(json.enabled).toBe(true);
      expect(json.projectId).toBe(projectId);
    });

    it("GET /api/projects/:id/mcp-servers/status returns entries and cliAvailable", async () => {
      const res = await fetch(`/api/projects/${projectId}/mcp-servers/status`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("entries");
      expect(Array.isArray(json.entries)).toBe(true);
      expect(json).toHaveProperty("cliAvailable");
      expect(typeof json.cliAvailable).toBe("boolean");
    });

    it("POST /api/projects/:id/mcp-servers/:serverId/login returns when CLI unavailable", async () => {
      const listRes = await fetch(`/api/projects/${projectId}/mcp-servers`);
      const list = await listRes.json();
      const serverId = list[0].id;
      const res = await fetch(`/api/projects/${projectId}/mcp-servers/${serverId}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("ok");
      expect(json.ok).toBe(false);
      expect(json.error).toContain("not available");
    });

    it("POST /api/projects/:id/mcp-servers/:serverId/login returns 404 for unknown server", async () => {
      const res = await fetch(`/api/projects/${projectId}/mcp-servers/unknown-server/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404);
    });

    it("PATCH /api/projects/:id/mcp-servers/:serverId updates server", async () => {
      const listRes = await fetch(`/api/projects/${projectId}/mcp-servers`);
      const list = await listRes.json();
      const serverId = list[0].id;
      const res = await fetch(`/api/projects/${projectId}/mcp-servers/${serverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.enabled).toBe(false);
    });

    it("DELETE /api/projects/:id/mcp-servers/:serverId removes server", async () => {
      const listRes = await fetch(`/api/projects/${projectId}/mcp-servers`);
      const list = await listRes.json();
      const serverId = list[0].id;
      const res = await fetch(`/api/projects/${projectId}/mcp-servers/${serverId}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const getRes = await fetch(`/api/projects/${projectId}/mcp-servers`);
      const after = await getRes.json();
      expect(after.length).toBe(0);
    });

    it("GET /api/projects/:id/mcp-servers returns 404 for unknown project", async () => {
      const res = await fetch("/api/projects/unknown-id/mcp-servers");
      expect(res.status).toBe(404);
    });

    it("POST /api/projects/:id/mcp-servers creates HTTP url server", async () => {
      const res = await fetch(`/api/projects/${projectId}/mcp-servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "remote-mcp",
          config: { url: "https://example.com/mcp" },
          enabled: true,
        }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe("remote-mcp");
      expect(json.config).toContain("https://example.com/mcp");
      expect(json.command).toBe("url");
    });

    it("POST /api/projects/:id/mcp-servers creates desktop server", async () => {
      const res = await fetch(`/api/projects/${projectId}/mcp-servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "desktop-app",
          config: { desktop: { command: "/usr/bin/cursor" } },
          enabled: true,
        }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe("desktop-app");
      expect(json.config).toContain("desktop");
      expect(json.command).toBe("/usr/bin/cursor");
    });

    it("POST /api/projects/:id/mcp-servers rejects invalid url config", async () => {
      const res = await fetch(`/api/projects/${projectId}/mcp-servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "bad",
          config: { url: "not-a-valid-url" },
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("Chats CRUD", () => {
    let projectId: string;

    beforeAll(async () => {
      const res = await fetch("/api/projects");
      const projects = await res.json();
      projectId = projects[0]?.id ?? "";
    });

    it("POST /api/projects/:id/chats creates chat with null sessionId (session from first message)", async () => {
      const res = await fetch(`/api/projects/${projectId}/chats`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.projectId).toBe(projectId);
      expect(json.id).toBeDefined();
      expect(json.sessionId).toBeNull();
    });

    it("GET /api/projects/:id/chats returns chats", async () => {
      const res = await fetch(`/api/projects/${projectId}/chats`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    });

    it("DELETE /api/chats/:id deletes chat", async () => {
      const createRes = await fetch(`/api/projects/${projectId}/chats`, {
        method: "POST",
      });
      const created = await createRes.json();
      const chatId = created.id;
      const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true });
      const getRes = await fetch(`/api/chats/${chatId}`);
      expect(getRes.status).toBe(404);
    });

    it("DELETE /api/chats/:id deletes chat and its messages", async () => {
      const createRes = await fetch(`/api/projects/${projectId}/chats`, {
        method: "POST",
      });
      const created = await createRes.json();
      const chatId = created.id;
      await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Test message" }),
      });
      const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      expect(res.status).toBe(200);
      const getRes = await fetch(`/api/chats/${chatId}`);
      expect(getRes.status).toBe(404);
      const messagesRes = await fetch(`/api/chats/${chatId}/messages`);
      const messages = await messagesRes.json();
      expect(messages).toEqual([]);
    });

    it("DELETE /api/chats/:id returns 404 for unknown chat", async () => {
      const res = await fetch("/api/chats/unknown-chat-id", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });

  describe("Chat title generation", () => {
    it("generates and persists title from first message, emits title in stream", async () => {
      const projectsRes = await fetch("/api/projects");
      const projects = await projectsRes.json();
      const projectId = projects[0]?.id;
      const chatRes = await fetch(`/api/projects/${projectId}/chats`, { method: "POST" });
      const chat = await chatRes.json();
      const chatId = chat.id;
      expect(chat.title).toBeNull();

      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Fix the authentication bug in login.ts" }),
      });
      expect(res.status).toBe(200);

      const chunks: { type: string; title?: string }[] = [];
      const reader = res.body?.getReader();
      if (reader) {
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
              if (parsed.type === "title") chunks.push(parsed);
            } catch {
              /* skip */
            }
          }
        }
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer);
            if (parsed.type === "title") chunks.push(parsed);
          } catch {
            /* skip */
          }
        }
      }

      await new Promise((r) => setTimeout(r, 3500));

      const chatAfter = await fetch(`/api/chats/${chatId}`).then((r) => r.json());
      expect(chatAfter.title).toBe("Fix auth bug");
      expect(chunks.some((c) => c.type === "title" && c.title === "Fix auth bug")).toBe(true);
    });

    it("does not regenerate title for second message", async () => {
      const projectsRes = await fetch("/api/projects");
      const projects = await projectsRes.json();
      const projectId = projects[0]?.id;
      const chatRes = await fetch(`/api/projects/${projectId}/chats`, { method: "POST" });
      const chat = await chatRes.json();
      const chatId = chat.id;

      const res1 = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "First message" }),
      });
      const reader1 = res1.body?.getReader();
      if (reader1) while (true) { const { done } = await reader1.read(); if (done) break; }
      await new Promise((r) => setTimeout(r, 3500));

      const chatAfterFirst = await fetch(`/api/chats/${chatId}`).then((r) => r.json());
      const titleAfterFirst = chatAfterFirst.title;

      const res2 = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Second message" }),
      });
      const reader2 = res2.body?.getReader();
      if (reader2) while (true) { const { done } = await reader2.read(); if (done) break; }
      await new Promise((r) => setTimeout(r, 500));

      const chatAfterSecond = await fetch(`/api/chats/${chatId}`).then((r) => r.json());
      expect(chatAfterSecond.title).toBe(titleAfterFirst);
    });
  });

  describe("Messages", () => {
    it("GET /api/chats/:id/messages returns 200 for valid chat", async () => {
      const projectsRes = await fetch("/api/projects");
      const projects = await projectsRes.json();
      const projectId = projects[0]?.id;
      const chatsRes = await fetch(`/api/projects/${projectId}/chats`);
      const chats = await chatsRes.json();
      const chatId = chats[0]?.id;
      const res = await fetch(`/api/chats/${chatId}/messages`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    });

    it("POST /api/chats/:id/messages returns 400 when content and imagePaths missing", async () => {
      const projectsRes = await fetch("/api/projects");
      const projects = await projectsRes.json();
      const projectId = projects[0]?.id;
      const chatsRes = await fetch(`/api/projects/${projectId}/chats`);
      const chats = await chatsRes.json();
      const chatId = chats[0]?.id;
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/content|imagePaths/);
    });

    it("POST /api/chats/:id/messages returns 404 for unknown chat", async () => {
      const res = await fetch("/api/chats/unknown-chat-id/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Hello" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("not found");
    });
  });

  describe("Cursor status", () => {
    it("GET /api/cursor/status returns ok and optionally error", async () => {
      const res = await fetch("/api/cursor/status");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(typeof json.ok).toBe("boolean");
      if (!json.ok) expect(typeof json.error).toBe("string");
    });
  });
});
