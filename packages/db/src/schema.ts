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
});

export const appConfig = sqliteTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
