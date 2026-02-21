/**
 * API tests — run with: pnpm test
 * Uses in-memory SQLite (DATABASE_PATH=:memory:) for isolation.
 * Mocks cursor-cli to avoid requiring the Cursor agent binary.
 */
import { describe, expect, it, beforeAll, vi, beforeEach } from "vitest";

const mockCreateCursorSession = vi.fn();
vi.mock("./src/cursor-cli", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./src/cursor-cli")>();
  return {
    ...actual,
    createCursorSession: (...args: unknown[]) => mockCreateCursorSession(...args),
  };
});

import { app } from "./app";
import { runMigrations, ensureAppConfigDefaults } from "@cursor-selfhost/db";

beforeAll(async () => {
  runMigrations();
  await ensureAppConfigDefaults();
});

beforeEach(() => {
  mockCreateCursorSession.mockResolvedValue("test-session-123");
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

  describe("Chats CRUD", () => {
    let projectId: string;

    beforeAll(async () => {
      const res = await fetch("/api/projects");
      const projects = await res.json();
      projectId = projects[0]?.id ?? "";
    });

    it("POST /api/projects/:id/chats creates chat with session isolation", async () => {
      const res = await fetch(`/api/projects/${projectId}/chats`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.projectId).toBe(projectId);
      expect(json.id).toBeDefined();
      expect(json.sessionId).toBe("test-session-123");
      expect(mockCreateCursorSession).toHaveBeenCalledWith(expect.any(String));
    });

    it("POST /api/projects/:id/chats creates chat with null sessionId when Cursor fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockCreateCursorSession.mockRejectedValueOnce(new Error("ENOENT"));
      const res = await fetch(`/api/projects/${projectId}/chats`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.sessionId).toBeNull();
      consoleSpy.mockRestore();
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
      const getRes = await fetch(`/api/chats/${chatId}`);
      expect(getRes.status).toBe(404);
    });

    it("DELETE /api/chats/:id returns 404 for unknown chat", async () => {
      const res = await fetch("/api/chats/unknown-chat-id", { method: "DELETE" });
      expect(res.status).toBe(404);
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

    it("POST /api/chats/:id/messages returns 400 when content missing", async () => {
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
      expect(json.error).toContain("content");
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
