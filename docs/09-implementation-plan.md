# Implementation Plan — MVP

Ordered tasks for the first MVP. Work through in sequence; some items can be parallelized.

---

## Phase 1: Project Setup

- [x] **1.1** Create monorepo structure
  - [x] `apps/web/` (React + Vite)
  - [x] `apps/api/` (Node)
  - [x] `packages/db/` (Drizzle schema)
  - [x] `packages/shared/` (types, constants)
  - [x] Root `pnpm-workspace.yaml` or equivalent
- [x] **1.2** Backend: Node, Hono app skeleton, env config
- [x] **1.3** Frontend: Vite + React, Tailwind, shadcn/ui init
- [x] **1.4** Verify Deno + Drizzle + libsql; if not, switch to Node + better-sqlite3
  - Switched to Node + Drizzle + better-sqlite3 (libsql file: not supported in Deno).

---

## Phase 2: Database

- [x] **2.1** Define schema: `projects`, `chats`, `messages`, `app_config`
- [x] **2.2** Create initial migration
- [x] **2.3** Run migrations on API startup (or CLI)
- [x] **2.4** Seed or default `app_config` if needed

---

## Phase 3: Backend API — Core

- [x] **3.1** First-run check: `GET /api/config`
- [x] **3.2** Set base dir: `PUT /api/config`
- [x] **3.3** Browse: `GET /api/browse?path=...`
- [x] **3.4** Projects CRUD
- [x] **3.5** Chats CRUD
- [x] **3.6** Messages list

---

## Phase 4: Backend API — Cursor CLI

- [x] **4.1** Cursor CLI service: spawn `cursor agent --print`, stdin/stdout, `--output-format stream-json`
- [x] **4.2** Auth check: detect if Cursor is logged in (e.g. try `cursor agent status` or handle error)
- [x] **4.3** Streaming endpoint: `POST /api/chats/:id/messages` — send message, stream response
  - Spawn CLI with `--workspace <project.path>`, `--resume <sessionId>` if chat has one
  - Pipe stdout to response stream (chunked or SSE)
  - Persist session_id from CLI output to chat
- [x] **4.4** Persist user message and assistant response to DB after stream completes

---

## Phase 5: Frontend — Shell & Routing

- [x] **5.1** React Router: `/`, `/setup`, `/p/:slug`, `/p/:slug/c/:chatId`, `/p/:slug/new`
- [x] **5.2** App shell: Header, Sidebar (collapsible, resizable), MainContent
- [x] **5.3** Sidebar: [+ Create], SearchInput, ProjectTree (expand/collapse, [+] per project)
- [x] **5.4** Theme: Tailwind dark/light via `prefers-color-scheme`
- [x] **5.5** Fonts: Fira Code for code/paths; configure in Tailwind

---

## Phase 6: Frontend — First-Run & Setup

- [x] **6.1** First-run: if base dir not set, redirect to `/setup`
- [x] **6.2** Setup page: full-page form; base dir input; persist via API; redirect to main app

---

## Phase 7: Frontend — Create Project

- [x] **7.1** Create wizard: inline in main area; step 1: Local vs Git
- [x] **7.2** Local: FolderPicker (browse API + manual path); restricted to base dir
- [x] **7.3** Git: URL + branch input; clone progress indicator
- [x] **7.4** Project name + slug inputs (auto from path/git, suffix if duplicate); user-editable
- [x] **7.5** On create: call API; redirect to `/p/:slug/c/:chatId` (new chat)

---

## Phase 8: Frontend — Chat View

- [x] **8.1** Chat view: load messages; full-width message blocks
- [x] **8.2** User messages: accent bar + tint; agent: neutral; icons
- [x] **8.3** Code blocks: Shiki syntax highlight, copy button, language label
- [ ] **8.4** Diff view: when applicable (e.g. file change blocks)
- [x] **8.5** Input: multi-line textarea, send button inside; configurable shortcut (Enter/Shift+Enter/Ctrl+Enter)
- [x] **8.6** Header: "Project › Chat"; three-dot menu (rename, delete)

---

## Phase 9: Frontend — Streaming & Integration

- [x] **9.1** Send message: POST to streaming endpoint; use `fetch` + `ReadableStream`
- [x] **9.2** Append chunks to assistant message block in real time
- [x] **9.3** Disable input while streaming; re-enable when done
- [x] **9.4** Error states: inline error block with Retry; toast for transient errors
- [x] **9.5** Auth instructions: inline block when not logged in

---

## Phase 10: Polish & Edge Cases

- [x] **10.1** Empty state: Home redirects to /create when no projects; "No messages yet" in chat
- [x] **10.2** Chat title: placeholder "New chat"; user-editable via Rename in menu
- [x] **10.3** Mobile: sidebar collapsible via Header toggle; desktop-first
- [ ] **10.4** Send shortcut: API supports `send_shortcut`; UI currently uses Enter
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
- `pnpm test` — run tests (API + DB)

## Testing

- **Policy**: All new code must have tests. See [docs/12-testing.md](12-testing.md).
- **API**: `pnpm test` in apps/api (Vitest, integration tests via app.fetch)
- **DB**: `pnpm test` in packages/db (Vitest)
- **E2E**: Phase 10.5
