import { Hono } from "hono";
import { cors } from "hono/cors";
import { eq, desc } from "drizzle-orm";
import path from "path";
import { db } from "@cursor-selfhost/db";
import * as schema from "@cursor-selfhost/db/schema";
import { nanoid } from "nanoid";
import {
  spawnCursorAgent,
  parseCursorLine,
  extractTextFromLine,
} from "./src/cursor-cli";
import {
  createProjectSchema,
  isPathUnderBase,
  isValidGitUrl,
} from "./src/validation";

export const app = new Hono();

// CORS for frontend
app.use("/api/*", cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));

// Health check
app.get("/api/health", (c) => c.json({ ok: true }));

// Config: GET (first-run check) and PUT (set base dir)
app.get("/api/config", async (c) => {
  const rows = await db.select().from(schema.appConfig);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const projectsBasePath = map.projects_base_path ?? process.env.PROJECTS_BASE_PATH ?? "";
  return c.json({
    projectsBasePath: projectsBasePath || null,
    configured: !!projectsBasePath,
    sendShortcut: map.send_shortcut ?? "enter",
  });
});

app.put("/api/config", async (c) => {
  const body = await c.req.json<{ projectsBasePath?: string; sendShortcut?: string }>();
  if (body.projectsBasePath !== undefined) {
    await db
      .insert(schema.appConfig)
      .values({ key: "projects_base_path", value: body.projectsBasePath })
      .onConflictDoUpdate({
        target: schema.appConfig.key,
        set: { value: body.projectsBasePath },
      });
  }
  if (body.sendShortcut !== undefined) {
    await db
      .insert(schema.appConfig)
      .values({ key: "send_shortcut", value: body.sendShortcut })
      .onConflictDoUpdate({
        target: schema.appConfig.key,
        set: { value: body.sendShortcut },
      });
  }
  return c.json({ ok: true });
});

// Browse: list dirs under base path only
app.get("/api/browse", async (c) => {
  const pathParam = c.req.query("path");
  const rows = await db.select().from(schema.appConfig).where(eq(schema.appConfig.key, "projects_base_path"));
  const basePath = rows[0]?.value ?? process.env.PROJECTS_BASE_PATH ?? "";
  if (!basePath) return c.json({ error: "Base path not configured" }, 400);
  const requested = pathParam ?? basePath;
  const { realpathSync, readdirSync } = await import("fs");
  const entries: { name: string; isDir: boolean }[] = [];
  let resolved: string;
  try {
    resolved = realpathSync(requested);
  } catch {
    return c.json({ error: "Path does not exist" }, 400);
  }
  const baseResolved = realpathSync(basePath);
  if (!isPathUnderBase(resolved, baseResolved)) {
    return c.json({ error: "Path outside base directory" }, 400);
  }
  for (const e of readdirSync(resolved, { withFileTypes: true })) {
    if (e.isDirectory()) entries.push({ name: e.name, isDir: true });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return c.json({ entries });
});

// Projects CRUD
app.get("/api/projects", async (c) => {
  const list = await db.select().from(schema.projects).orderBy(desc(schema.projects.updatedAt));
  return c.json(list);
});

app.get("/api/projects/by-slug/:slug", async (c) => {
  const slug = c.req.param("slug");
  const rows = await db.select().from(schema.projects).where(eq(schema.projects.slug, slug));
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json(rows[0]);
});

app.get("/api/projects/:id", async (c) => {
  const id = c.req.param("id");
  const rows = await db.select().from(schema.projects).where(eq(schema.projects.id, id));
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json(rows[0]);
});

app.post("/api/projects", async (c) => {
  const raw = await c.req.json();
  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.message ?? "Validation failed";
    return c.json({ error: msg }, 400);
  }
  const body = parsed.data;
  const id = nanoid();
  const now = new Date();
  const { realpathSync } = await import("fs");

  if (body.sourceType === "git" && body.gitUrl) {
    if (!isValidGitUrl(body.gitUrl)) {
      return c.json({ error: "Invalid git URL format" }, 400);
    }
    const baseRows = await db.select().from(schema.appConfig).where(eq(schema.appConfig.key, "projects_base_path"));
    const base = baseRows[0]?.value ?? "";
    if (!base) return c.json({ error: "Base path not configured" }, 400);
    const baseResolved = realpathSync(base);
    const dir = path.join(baseResolved, `${body.slug}-${id.slice(0, 8)}`);
    if (!isPathUnderBase(dir, baseResolved)) {
      return c.json({ error: "Invalid project path" }, 400);
    }
    const { spawnSync } = await import("child_process");
    const result = spawnSync("git", ["clone", body.gitUrl.trim(), dir, ...(body.gitBranch ? ["-b", body.gitBranch] : [])], { stdio: "inherit" });
    if (result.status !== 0) return c.json({ error: "Git clone failed" }, 500);
    await db.insert(schema.projects).values({
      id,
      slug: body.slug,
      name: body.name,
      path: dir,
      sourceType: "git",
      gitUrl: body.gitUrl.trim(),
      gitBranch: body.gitBranch ?? null,
      createdAt: now,
      updatedAt: now,
    });
  } else if (body.path) {
    const pathTrimmed = body.path.trim();
    const baseRows = await db.select().from(schema.appConfig).where(eq(schema.appConfig.key, "projects_base_path"));
    const base = baseRows[0]?.value ?? process.env.PROJECTS_BASE_PATH ?? "";
    if (!base) return c.json({ error: "Base path not configured" }, 400);
    let resolvedPath: string;
    try {
      resolvedPath = realpathSync(pathTrimmed);
    } catch {
      return c.json({ error: "Path does not exist" }, 400);
    }
    const baseResolved = realpathSync(base);
    if (!isPathUnderBase(resolvedPath, baseResolved)) {
      return c.json({ error: "Path must be within the configured base directory" }, 400);
    }
    await db.insert(schema.projects).values({
      id,
      slug: body.slug,
      name: body.name,
      path: resolvedPath,
      sourceType: "local",
      gitUrl: null,
      gitBranch: null,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    return c.json({ error: "path or gitUrl required" }, 400);
  }
  const rows = await db.select().from(schema.projects).where(eq(schema.projects.id, id));
  return c.json(rows[0]);
});

// Chats
app.get("/api/projects/:projectId/chats", async (c) => {
  const projectId = c.req.param("projectId");
  const list = await db.select().from(schema.chats).where(eq(schema.chats.projectId, projectId)).orderBy(desc(schema.chats.updatedAt));
  return c.json(list);
});

app.post("/api/projects/:projectId/chats", async (c) => {
  const projectId = c.req.param("projectId");
  const id = nanoid();
  const now = new Date();
  await db.insert(schema.chats).values({
    id,
    projectId,
    title: null,
    sessionId: null,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(schema.chats).where(eq(schema.chats.id, id));
  return c.json(rows[0]);
});

app.get("/api/chats/:id", async (c) => {
  const id = c.req.param("id");
  const rows = await db.select().from(schema.chats).where(eq(schema.chats.id, id));
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json(rows[0]);
});

app.patch("/api/chats/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ title?: string; sessionId?: string }>();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.sessionId !== undefined) updates.sessionId = body.sessionId;
  await db.update(schema.chats).set(updates as Record<string, Date | string | null>).where(eq(schema.chats.id, id));
  const rows = await db.select().from(schema.chats).where(eq(schema.chats.id, id));
  return c.json(rows[0]);
});

app.delete("/api/chats/:id", async (c) => {
  const id = c.req.param("id");
  const rows = await db.select().from(schema.chats).where(eq(schema.chats.id, id));
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  await db.delete(schema.messages).where(eq(schema.messages.chatId, id));
  await db.delete(schema.chats).where(eq(schema.chats.id, id));
  return c.json({ ok: true });
});

// Messages
app.get("/api/chats/:id/messages", async (c) => {
  const id = c.req.param("id");
  const list = await db.select().from(schema.messages).where(eq(schema.messages.chatId, id)).orderBy(schema.messages.createdAt);
  return c.json(list);
});

// Cursor auth check
app.get("/api/cursor/status", async (c) => {
  const { checkCursorAuth } = await import("./src/cursor-cli");
  const result = await checkCursorAuth();
  return c.json(result);
});

// POST /api/chats/:id/messages — send message, stream response
app.post("/api/chats/:id/messages", async (c) => {
  const chatId = c.req.param("id");
  const body = await c.req.json<{ content: string }>();
  const content = body?.content?.trim();
  if (!content) return c.json({ error: "content required" }, 400);

  const chatRows = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId));
  if (chatRows.length === 0) return c.json({ error: "Chat not found" }, 404);
  const chat = chatRows[0];

  const projectRows = await db.select().from(schema.projects).where(eq(schema.projects.id, chat.projectId));
  if (projectRows.length === 0) return c.json({ error: "Project not found" }, 404);
  const project = projectRows[0];

  // Persist user message
  const userMsgId = nanoid();
  const now = new Date();
  await db.insert(schema.messages).values({
    id: userMsgId,
    chatId,
    role: "user",
    content,
    createdAt: now,
  });

  const proc = spawnCursorAgent(content, {
    workspace: project.path,
    resumeSessionId: chat.sessionId,
  });

  let sessionId: string | null = null;
  const assistantChunks: string[] = [];

  const stream = new ReadableStream({
    start(controller) {
      const onData = (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        const lines = text.split("\n").filter((l) => l.trim());
        for (const line of lines) {
          const parsed = parseCursorLine(line);
          if (!parsed) continue;
          if (parsed.session_id) sessionId = parsed.session_id;
          const extracted = extractTextFromLine(parsed);
          if (extracted) {
            assistantChunks.push(extracted);
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "chunk", content: extracted }) + "\n"));
          }
          if (parsed.type === "result" && parsed.result) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "done", sessionId: parsed.session_id ?? null }) + "\n"));
          }
          if (parsed.error) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "error", error: parsed.error }) + "\n"));
          }
        }
      };
      proc.stdout?.on("data", onData);
      proc.on("close", (code) => {
        const fullContent = assistantChunks.join("");
        // Persist assistant message and session_id (async, fire-and-forget)
        (async () => {
          try {
            if (fullContent) {
              await db.insert(schema.messages).values({
                id: nanoid(),
                chatId,
                role: "assistant",
                content: fullContent,
                createdAt: new Date(),
              });
            }
            if (sessionId) {
              await db.update(schema.chats).set({ sessionId, updatedAt: new Date() }).where(eq(schema.chats.id, chatId));
            }
          } catch (e) {
            console.error("Failed to persist assistant message:", e);
          }
        })();
        if (code !== 0 && !sessionId && assistantChunks.length === 0) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "error", error: `Cursor CLI exited with code ${code}` }) + "\n"));
        }
        controller.close();
      });
      proc.on("error", (err) => {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "error", error: err.message }) + "\n"));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
