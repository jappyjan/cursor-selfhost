# Implementation Plan — MVP

Ordered tasks for the first MVP. Work through in sequence; some items can be parallelized.

---

## Phase 1: Project Setup

- [ ] **1.1** Create monorepo structure
  - [ ] `apps/web/` (React + Vite)
  - [ ] `apps/api/` (Deno)
  - [ ] `packages/db/` (Drizzle schema; shared or Deno)
  - [ ] `packages/shared/` (types, constants)
  - [ ] Root `pnpm-workspace.yaml` or equivalent
- [ ] **1.2** Backend: `deno.json`, Hono app skeleton, env config
- [ ] **1.3** Frontend: Vite + React, Tailwind, shadcn/ui init
- [ ] **1.4** Verify Deno + Drizzle + libsql; if not, switch to Node + better-sqlite3

---

## Phase 2: Database

- [ ] **2.1** Define schema: `projects`, `chats`, `messages`, `app_config`
  - Projects: id, slug, name, path, source_type, git_url, git_branch, timestamps
  - Chats: id, project_id, title, session_id, timestamps
  - Messages: id, chat_id, role, content, created_at
  - app_config: projects_base_path, send_shortcut
- [ ] **2.2** Create initial migration
- [ ] **2.3** Run migrations on API startup (or CLI)
- [ ] **2.4** Seed or default `app_config` if needed

---

## Phase 3: Backend API — Core

- [ ] **3.1** First-run check: `GET /api/config` or similar; return whether base dir is set
- [ ] **3.2** Set base dir: `POST /api/config` or `PUT /api/config` — persist `projects_base_path`
- [ ] **3.3** Browse: `GET /api/browse?path=...` — list dirs under base path only; validate path
- [ ] **3.4** Projects CRUD: `POST /api/projects`, `GET /api/projects`, `GET /api/projects/by-slug/:slug`
  - POST: create project (local path or git clone); generate slug from name; suffix if duplicate
- [ ] **3.5** Chats: `POST /api/projects/:id/chats`, `GET /api/projects/:id/chats`, `GET /api/chats/:id`
- [ ] **3.6** Messages: `GET /api/chats/:id/messages` (history)

---

## Phase 4: Backend API — Cursor CLI

- [ ] **4.1** Cursor CLI service: spawn `cursor agent --print`, stdin/stdout, `--output-format stream-json`
- [ ] **4.2** Auth check: detect if Cursor is logged in (e.g. try `cursor agent status` or handle error)
- [ ] **4.3** Streaming endpoint: `POST /api/chats/:id/messages` — send message, stream response
  - Spawn CLI with `--workspace <project.path>`, `--resume <sessionId>` if chat has one
  - Pipe stdout to response stream (chunked or SSE)
  - Persist session_id from CLI output to chat
- [ ] **4.4** Persist user message and assistant response to DB after stream completes

---

## Phase 5: Frontend — Shell & Routing

- [ ] **5.1** React Router: `/`, `/setup`, `/p/:slug`, `/p/:slug/c/:chatId`, `/p/:slug/new`
- [ ] **5.2** App shell: Header, Sidebar (collapsible, resizable), MainContent
- [ ] **5.3** Sidebar: [+ Create], SearchInput, ProjectTree (expand/collapse, [+] per project)
- [ ] **5.4** Theme: Tailwind dark/light via `prefers-color-scheme`
- [ ] **5.5** Fonts: Fira Code for code/paths; configure in Tailwind

---

## Phase 6: Frontend — First-Run & Setup

- [ ] **6.1** First-run: if base dir not set, redirect to `/setup`
- [ ] **6.2** Setup page: full-page form; base dir input; persist via API; redirect to main app

---

## Phase 7: Frontend — Create Project

- [ ] **7.1** Create wizard: inline in main area; step 1: Local vs Git
- [ ] **7.2** Local: FolderPicker (browse API + manual path); restricted to base dir
- [ ] **7.3** Git: URL + branch input; clone progress indicator
- [ ] **7.4** Project name + slug inputs (auto from path/git, suffix if duplicate); user-editable
- [ ] **7.5** On create: call API; redirect to `/p/:slug/c/:chatId` (new chat)

---

## Phase 8: Frontend — Chat View

- [ ] **8.1** Chat view: load messages; full-width message blocks
- [ ] **8.2** User messages: accent bar + tint; agent: neutral; icons
- [ ] **8.3** Code blocks: Shiki syntax highlight, copy button, language label
- [ ] **8.4** Diff view: when applicable (e.g. file change blocks)
- [ ] **8.5** Input: multi-line textarea, send button inside; configurable shortcut (Enter/Shift+Enter/Ctrl+Enter)
- [ ] **8.6** Header: "Project › Chat"; three-dot menu (rename, delete)

---

## Phase 9: Frontend — Streaming & Integration

- [ ] **9.1** Send message: POST to streaming endpoint; use `fetch` + `ReadableStream`
- [ ] **9.2** Append chunks to assistant message block in real time
- [ ] **9.3** Disable input while streaming; re-enable when done
- [ ] **9.4** Error states: inline error block with Retry; toast for transient errors
- [ ] **9.5** Auth instructions: inline block when not logged in

---

## Phase 10: Polish & Edge Cases

- [ ] **10.1** Empty state: centered "Create your first project" CTA when no projects
- [ ] **10.2** Chat title: AI-generated from first message (or placeholder); user-editable via menu
- [ ] **10.3** Mobile: sidebar collapsed by default; overlay/slide-in when opened
- [ ] **10.4** Send shortcut: persist `send_shortcut` in app_config; apply in input
- [ ] **10.5** E2E smoke test: create project → send message → see streamed response

---

## Dependency Summary

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
                ↘ Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9 → Phase 10
```

- Phases 1–4: Backend
- Phases 5–10: Frontend (depends on 3–4 for API)

---

## Quick Start Commands (Target)

- `pnpm dev` or `pnpm run dev` — start API + web (or separate commands)
- `pnpm db:migrate` — run migrations
- `pnpm build` — build for production
