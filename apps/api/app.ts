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
  isAssistantContent,
  isActivityContent,
  extractActivityInfo,
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
  const { homedir } = await import("os");
  const suggestedBasePath = path.join(homedir(), "cursor-selfhosted");
  const filesystemRoot = path.parse(homedir()).root;
  return c.json({
    projectsBasePath: projectsBasePath || null,
    configured: !!projectsBasePath,
    sendShortcut: map.send_shortcut ?? "enter",
    suggestedBasePath,
    suggestedRootPath: homedir(),
    filesystemRoot,
  });
});

app.put("/api/config", async (c) => {
  const body = await c.req.json<{ projectsBasePath?: string; sendShortcut?: string }>();
  if (body.projectsBasePath !== undefined) {
    const { homedir } = await import("os");
    const rawPath = body.projectsBasePath.trim();
    const expandedPath = rawPath.startsWith("~")
      ? path.join(homedir(), rawPath.slice(1).replace(/^\/+/, "") || ".")
      : rawPath;
    const { mkdirSync, existsSync } = await import("fs");
    if (!existsSync(expandedPath)) {
      mkdirSync(expandedPath, { recursive: true });
    }
    await db
      .insert(schema.appConfig)
      .values({ key: "projects_base_path", value: expandedPath })
      .onConflictDoUpdate({
        target: schema.appConfig.key,
        set: { value: expandedPath },
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

// Browse: list dirs under base path only (when configured), homedir (setup default), or filesystem root (setup unrestricted)
app.get("/api/browse", async (c) => {
  const pathParam = c.req.query("path");
  const setupUnrestricted = c.req.query("setup") === "1";
  const { homedir } = await import("os");
  const rows = await db.select().from(schema.appConfig).where(eq(schema.appConfig.key, "projects_base_path"));
  let basePath = rows[0]?.value ?? process.env.PROJECTS_BASE_PATH ?? "";
  if (!basePath) {
    basePath = setupUnrestricted ? path.parse(homedir()).root : homedir();
  }
  if (basePath.startsWith("~")) {
    basePath = path.join(homedir(), basePath.slice(1).replace(/^\/+/, "") || ".");
  }
  const requested = pathParam ?? basePath;
  const requestedExpanded = requested.startsWith("~")
    ? path.join(homedir(), requested.slice(1).replace(/^\/+/, "") || ".")
    : requested;
  const { realpathSync, readdirSync, existsSync } = await import("fs");
  const entries: { name: string; isDir: boolean }[] = [];
  let resolved: string;
  try {
    if (!existsSync(requestedExpanded)) {
      return c.json({ error: "Path does not exist" }, 400);
    }
    resolved = realpathSync(requestedExpanded);
  } catch (err) {
    return c.json({ error: "Path does not exist or is not accessible" }, 400);
  }
  let baseResolved: string;
  try {
    baseResolved = realpathSync(basePath);
  } catch {
    return c.json({ error: "Base path does not exist" }, 400);
  }
  if (!isPathUnderBase(resolved, baseResolved)) {
    return c.json({ error: "Path outside base directory" }, 400);
  }
  try {
    for (const e of readdirSync(resolved, { withFileTypes: true })) {
      if (e.isDirectory()) entries.push({ name: e.name, isDir: true });
    }
  } catch {
    return c.json({ error: "Cannot read directory" }, 400);
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return c.json({ entries });
});

// Create folder under base path (or homedir when not configured, or filesystem root when setup unrestricted)
app.post("/api/browse/create", async (c) => {
  const body = await c.req.json<{ parentPath: string; name: string; setup?: boolean }>();
  const setupUnrestricted = body?.setup === true;
  const parentPath = body?.parentPath?.trim();
  const name = body?.name?.trim();
  if (!parentPath || !name) return c.json({ error: "parentPath and name required" }, 400);
  if (name.includes("/") || name.includes("\\") || name === ".." || name === ".") {
    return c.json({ error: "Invalid folder name" }, 400);
  }
  const { homedir } = await import("os");
  const rows = await db.select().from(schema.appConfig).where(eq(schema.appConfig.key, "projects_base_path"));
  let basePath = rows[0]?.value ?? process.env.PROJECTS_BASE_PATH ?? "";
  if (!basePath) {
    basePath = setupUnrestricted ? path.parse(homedir()).root : homedir();
  }
  if (basePath.startsWith("~")) {
    basePath = path.join(homedir(), basePath.slice(1).replace(/^\/+/, "") || ".");
  }
  const parentExpanded = parentPath.startsWith("~")
    ? path.join(homedir(), parentPath.slice(1).replace(/^\/+/, "") || ".")
    : parentPath;
  const { realpathSync, mkdirSync, existsSync } = await import("fs");
  let parentResolved: string;
  try {
    if (!existsSync(parentExpanded)) return c.json({ error: "Parent path does not exist" }, 400);
    parentResolved = realpathSync(parentExpanded);
  } catch {
    return c.json({ error: "Parent path does not exist or is not accessible" }, 400);
  }
  let baseResolved: string;
  try {
    baseResolved = realpathSync(basePath);
  } catch {
    return c.json({ error: "Base path does not exist" }, 400);
  }
  if (!isPathUnderBase(parentResolved, baseResolved)) {
    return c.json({ error: "Path outside base directory" }, 400);
  }
  const newDir = path.join(parentResolved, name);
  if (!isPathUnderBase(newDir, baseResolved)) {
    return c.json({ error: "Path outside base directory" }, 400);
  }
  try {
    mkdirSync(newDir, { recursive: true });
  } catch (err) {
    return c.json({ error: (err as Error).message ?? "Failed to create folder" }, 400);
  }
  return c.json({ path: newDir });
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
    try {
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
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return c.json({ error: "A project with this path or slug already exists." }, 400);
      }
      throw e;
    }
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
    try {
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
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return c.json({ error: "A project with this path or slug already exists. Choose a different folder or slug." }, 400);
      }
      throw e;
    }
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
  const projectRows = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  if (projectRows.length === 0) return c.json({ error: "Project not found" }, 404);

  // Defer session creation to first message — avoids Cursor CLI potentially returning
  // the same session for the same workspace, which would mix chat histories.
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
  try {
    const rows = await db.select().from(schema.chats).where(eq(schema.chats.id, id));
    if (rows.length === 0) return c.json({ error: "Not found" }, 404);
    await db.delete(schema.messages).where(eq(schema.messages.chatId, id));
    await db.delete(schema.chats).where(eq(schema.chats.id, id));
    return c.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/chats/:id error:", err);
    return c.json({ error: "Failed to delete chat" }, 500);
  }
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
  type Block = { type: "text"; content: string } | { type: "activity"; kind: string; label: string; details?: string };
  const blocks: Block[] = [];
  let resultContent: string | null = null; // fallback when Cursor sends only result (no assistant chunks)
  let stderrBuffer = "";

  const stream = new ReadableStream({
    start(controller) {
      proc.stderr?.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString("utf-8");
      });
      const safeEnqueue = (data: Uint8Array) => {
        try {
          controller.enqueue(data);
        } catch {
          /* stream may be closed */
        }
      };
      let streamClosed = false;
      const safeClose = () => {
        if (streamClosed) return;
        streamClosed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      let ndjsonBuffer = "";
      const onData = (chunk: Buffer) => {
        ndjsonBuffer += chunk.toString("utf-8");
        const lines = ndjsonBuffer.split("\n");
        ndjsonBuffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parsed = parseCursorLine(trimmed);
          if (!parsed) continue;
          if (parsed.session_id) sessionId = parsed.session_id;
          // Activity (tool_call, thinking): add block, emit for UI
          if (isActivityContent(parsed)) {
            const { label, details } = extractActivityInfo(parsed);
            const block = { type: "activity" as const, kind: parsed.type, label, ...(details && { details }) };
            blocks.push(block);
            safeEnqueue(new TextEncoder().encode(JSON.stringify({ type: "block", block }) + "\n"));
            continue;
          }
          // Assistant chunks: append to last text block or create new one
          if (isAssistantContent(parsed)) {
            const extracted = extractTextFromLine(parsed);
            if (extracted) {
              const last = blocks[blocks.length - 1];
              if (last?.type === "text") {
                last.content += extracted;
              } else {
                blocks.push({ type: "text", content: extracted });
              }
              safeEnqueue(new TextEncoder().encode(JSON.stringify({ type: "block", block: { type: "text", content: extracted } }) + "\n"));
            }
            continue;
          }
          // Result: use for done signal; persist only if no assistant chunks (fallback)
          if (parsed.type === "result") {
            if (parsed.result) resultContent = parsed.result;
            safeEnqueue(new TextEncoder().encode(JSON.stringify({ type: "done", sessionId: parsed.session_id ?? null }) + "\n"));
            continue;
          }
          if (parsed.error) {
            safeEnqueue(new TextEncoder().encode(JSON.stringify({ type: "error", error: parsed.error }) + "\n"));
          }
        }
      };
      proc.stdout?.on("data", onData);
      proc.on("close", async (code) => {
        const trimmed = ndjsonBuffer.trim();
        if (trimmed) {
          const parsed = parseCursorLine(trimmed);
          if (parsed) {
            if (parsed.session_id) sessionId = parsed.session_id;
            if (isActivityContent(parsed)) {
              const { label, details } = extractActivityInfo(parsed);
              const block = { type: "activity" as const, kind: parsed.type, label, ...(details && { details }) };
              blocks.push(block);
              safeEnqueue(new TextEncoder().encode(JSON.stringify({ type: "block", block }) + "\n"));
            } else if (isAssistantContent(parsed)) {
              const extracted = extractTextFromLine(parsed);
              if (extracted) {
                const last = blocks[blocks.length - 1];
                if (last?.type === "text") last.content += extracted;
                else blocks.push({ type: "text", content: extracted });
                safeEnqueue(new TextEncoder().encode(JSON.stringify({ type: "block", block: { type: "text", content: extracted } }) + "\n"));
              }
            } else if (parsed.type === "result" && parsed.result) {
              resultContent = parsed.result;
            }
          }
        }
        const textBlocks = blocks.filter((b): b is { type: "text"; content: string } => b.type === "text");
        const fullContent = textBlocks.length > 0 ? textBlocks.map((b) => b.content).join("") : (resultContent ?? "");
        if (code !== 0 && !sessionId && textBlocks.length === 0) {
          const stderrTrimmed = stderrBuffer.trim();
          const detail = stderrTrimmed
            ? `Cursor CLI exited with code ${code}. stderr: ${stderrTrimmed.slice(0, 2000)}`
            : `Cursor CLI exited with code ${code}`;
          safeEnqueue(new TextEncoder().encode(JSON.stringify({ type: "error", error: detail }) + "\n"));
        }
        try {
          if (fullContent || blocks.length > 0) {
            const blocksJson = blocks.length > 0 ? JSON.stringify(blocks) : null;
            await db.insert(schema.messages).values({
              id: nanoid(),
              chatId,
              role: "assistant",
              content: fullContent || "",
              createdAt: new Date(),
              activities: null,
              blocks: blocksJson,
            });
          }
          if (sessionId) {
            await db.update(schema.chats).set({ sessionId, updatedAt: new Date() }).where(eq(schema.chats.id, chatId));
          }
        } catch (e) {
          const err = e as { code?: string };
          if (err.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
            // Chat may have been deleted before persist completed (e.g. in tests)
          } else {
            console.error("Failed to persist assistant message:", e);
          }
        }
        safeClose();
      });
      proc.on("error", (err) => {
        safeEnqueue(new TextEncoder().encode(JSON.stringify({ type: "error", error: err.message }) + "\n"));
        safeClose();
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
