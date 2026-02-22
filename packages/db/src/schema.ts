import {
  sqliteTable,
  text,
  integer,
} from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  sourceType: text("source_type").notNull(),
  gitUrl: text("git_url"),
  gitBranch: text("git_branch"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title"),
  sessionId: text("session_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  /** JSON array of { kind, label } for tool_call, thinking, etc. (legacy) */
  activities: text("activities"),
  /** JSON array of ordered blocks: { type: "text", content } | { type: "activity", kind, label } */
  blocks: text("blocks"),
  /** JSON array of "uploadId/filename" for user message image attachments */
  imagePaths: text("image_paths"),
});

export const appConfig = sqliteTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Per-project MCP server configuration. Stored in DB, written to .cursor/mcp.json when spawning agent. */
export const projectMcpServers = sqliteTable("project_mcp_servers", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  /** Display name (e.g. "filesystem", "github") */
  name: text("name").notNull(),
  /** Command to run (e.g. "npx", "node") — used for stdio transport and backward compat */
  command: text("command").notNull(),
  /** JSON array of args (e.g. ["-y", "@modelcontextprotocol/server-filesystem"]) */
  args: text("args").notNull(),
  /** JSON object of env vars for auth (e.g. {"API_KEY": "xxx"}). Stored as-is; consider encryption for sensitive deployments. */
  env: text("env"),
  /** Full MCP server config as JSON. When set, overrides command/args/env for mcp.json. Supports stdio, url (HTTP), desktop. */
  config: text("config"),
  /** Whether this server is enabled for the project */
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  /** Order for display/merge */
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
