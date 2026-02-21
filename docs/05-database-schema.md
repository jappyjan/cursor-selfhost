# Database Schema

## Overview

- **Database**: SQLite (via better-sqlite3)
- **ORM**: Drizzle ORM
- **Migrations**: drizzle-kit; version-controlled migration files

## Entity Relationship

```
Project ──┬──< Chat >──< Message
          │
          └── Session (Cursor CLI)
```

- **Project**: Folder on disk (local path or cloned from git). User-facing term; one project = one folder. Multiple projects can clone the same git repo to different paths.
- **Chat**: A conversation; belongs to one project
- **Message**: User or assistant message; belongs to one chat
- **Session**: Cursor CLI session ID; stored per chat for resume

## Tables

### `projects`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT/UUID | PK | Unique identifier |
| slug | TEXT | NOT NULL, UNIQUE | URL-safe slug (e.g. "my-app"); used in URLs for shareable links |
| name | TEXT | NOT NULL | User-facing name; default from path/git, suffix if duplicate, user-editable |
| path | TEXT | NOT NULL, UNIQUE | Absolute path on host |
| source_type | TEXT | NOT NULL | `local` or `git` |
| git_url | TEXT | NULL | If source_type=git |
| git_branch | TEXT | NULL | Default branch used |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update |

### `chats`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT/UUID | PK | Unique identifier |
| project_id | TEXT | FK → projects | Project (folder) for this chat |
| title | TEXT | NULL | AI-generated from first message; user-editable |
| session_id | TEXT | NULL | Cursor CLI session ID (if resumable) |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last activity |

### `messages`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT/UUID | PK | Unique identifier |
| chat_id | TEXT | FK → chats | Parent chat |
| role | TEXT | NOT NULL | `user` or `assistant` |
| content | TEXT | NOT NULL | Message body |
| created_at | DATETIME | NOT NULL | Timestamp |

### `sessions` (optional; if we track CLI sessions separately)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT/UUID | PK | Unique identifier |
| project_id | TEXT | FK → projects | Project |
| cursor_session_id | TEXT | NULL | ID from Cursor CLI |
| status | TEXT | NOT NULL | `active`, `stopped`, `error` |
| started_at | DATETIME | NOT NULL | When spawned |
| stopped_at | DATETIME | NULL | When ended |

**Note**: Cursor CLI returns `session_id` in JSON output; we persist it in `chats.session_id` for resume via `--resume <sessionId>`.

## Indexes

- `chats.project_id` — List chats by project
- `chats.updated_at` — Sort chats by recency
- `messages.chat_id` — Load messages for a chat
- `messages.created_at` — Order messages

## Migration Strategy

1. Create `migrations/` directory in `packages/db`
2. Initial migration: Create all tables above
3. Naming: `0001_initial.sql`, `0002_add_session_tracking.sql`, etc.
4. Run migrations on app startup (or via CLI)

## ORM Model Examples (Pseudocode)

### Drizzle (Bun + better-sqlite3)

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
  projectId: text("project_id").notNull().references(() => projects.id),
  title: text("title"),
  sessionId: text("session_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull().references(() => chats.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

## App Config (for persisted settings)

Store base path for git clones (picked in UI on first run):

| Key | Type | Description |
|-----|------|-------------|
| projects_base_path | TEXT | Root for all paths; env var or first-run UI; all pickers restricted to it |
| send_shortcut | TEXT | `enter` \| `shift_enter` \| `ctrl_enter` — which key sends message |

*Store in SQLite `app_config` table or JSON config file.*

## Open Questions

- [ ] Do we need a separate `sessions` table or fold into `chats`?
- [ ] Soft delete for chats/messages?
- [ ] Full-text search on messages (future)?
