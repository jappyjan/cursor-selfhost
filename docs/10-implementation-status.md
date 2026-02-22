# Implementation Status

Track what's implemented for the MVP. Update as work progresses. Use for planning and reference.

---

## Legend

| Status | Meaning |
|--------|---------|
| ⬜ Not started | Not implemented |
| 🟡 In progress | Partially done |
| ✅ Done | Implemented and working |

---

## Phase 1: Project Setup

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Monorepo structure | ✅ | apps/web, apps/api, packages/db, packages/shared |
| 1.2 Backend skeleton | ✅ | Node/tsx (Bun: better-sqlite3 unsupported), Hono, env config |
| 1.3 Frontend skeleton | ✅ | Vite + React, Tailwind, shadcn/ui |
| 1.4 Deno vs Node decision | ✅ | Switched to Bun + Drizzle + better-sqlite3. |

---

## Phase 2: Database

| Task | Status | Notes |
|------|--------|-------|
| 2.1 Schema defined | ✅ | packages/db/src/schema.ts |
| 2.2 Initial migration | ✅ | migrations/0000_*.sql |
| 2.3 Migrations on startup | ✅ | runMigrations() in main.ts |
| 2.4 app_config defaults | ✅ | ensureAppConfigDefaults() |

---

## Phase 3: Backend API — Core

| Task | Status | Notes |
|------|--------|-------|
| 3.1 First-run check | ✅ | GET /api/config |
| 3.2 Set base dir | ✅ | PUT /api/config |
| 3.3 Browse endpoint | ✅ | GET /api/browse |
| 3.4 Projects CRUD | ✅ | POST, GET, by-slug |
| 3.5 Chats CRUD | ✅ | POST, GET, PATCH |
| 3.6 Messages list | ✅ | GET /api/chats/:id/messages |

---

## Phase 4: Backend API — Cursor CLI

| Task | Status | Notes |
|------|--------|-------|
| 4.1 Cursor CLI service | ✅ | spawnCursorAgent, createCursorSession, parseCursorLine, extractTextFromLine |
| 4.2 Auth check | ✅ | checkCursorAuth, CURSOR_API_KEY / CURSOR_CLI_PATH |
| 4.3 Streaming endpoint | ✅ | POST /api/chats/:id/messages, NDJSON stream |
| 4.4 Persist messages | ✅ | User + assistant messages, session_id on chat |

---

## Phase 5: Frontend — Shell & Routing

| Task | Status | Notes |
|------|--------|-------|
| 5.1 React Router | ✅ | BrowserRouter, Routes, /p/:slug, /p/:slug/c/:chatId, /create, /setup |
| 5.2 App shell | ✅ | AppShell, Header, Sidebar, Outlet |
| 5.3 Sidebar | ✅ | Project tree, expand/collapse, chat list, search filter |
| 5.4 Theme (dark/light) | ✅ | shadcn/ui + Tailwind |
| 5.5 Fonts (Fira Code) | 🟡 | System fonts; Fira Code optional |

---

## Phase 6: Frontend — First-Run & Setup

| Task | Status | Notes |
|------|--------|-------|
| 6.1 First-run redirect | ✅ | FirstRunGuard, redirect to /setup when not configured |
| 6.2 Setup page | ✅ | FolderPicker, base dir config, redirect on success |

---

## Phase 7: Frontend — Create Project

| Task | Status | Notes |
|------|--------|-------|
| 7.1 Create wizard | ✅ | Multi-step: source type → path/git → name+slug |
| 7.2 FolderPicker (local) | ✅ | Browse API, create folder, setup mode |
| 7.3 Git clone flow | ✅ | Git URL + branch, clone via API |
| 7.4 Name + slug | ✅ | Auto from path/repo, slug suffix on duplicate |
| 7.5 Redirect on create | ✅ | Creates project + chat, redirects to chat view |

---

## Phase 8: Frontend — Chat View

| Task | Status | Notes |
|------|--------|-------|
| 8.1 Chat view layout | ✅ | Header, messages area, input at bottom |
| 8.2 Message blocks | ✅ | User/assistant, activities (thinking, tool_call) |
| 8.3 Code blocks (Shiki) | ✅ | CodeBlock component, syntax highlighting, copy |
| 8.4 Diff view | ⬜ | Not implemented |
| 8.5 Input area | ✅ | Textarea, send button, Enter to send |
| 8.6 Header + menu | ✅ | Rename, delete chat |

---

## Phase 9: Frontend — Streaming & Integration

| Task | Status | Notes |
|------|--------|-------|
| 9.1 Send message + stream | ✅ | sendMessageStreaming, NDJSON stream |
| 9.2 Append chunks | ✅ | streamingBlocks state, collapse thinking |
| 9.3 Input disable while streaming | ✅ | isStreaming disables send |
| 9.4 Error states | ✅ | sendError, inline error banner |
| 9.5 Auth instructions | ✅ | Cursor not logged in banner with CURSOR_API_KEY / agent login |

---

## Phase 10: Polish & Edge Cases

| Task | Status | Notes |
|------|--------|-------|
| 10.1 Empty state | ✅ | "No messages yet" in chat; Home redirects to create |
| 10.2 Chat title | ✅ | Rename dialog, display in header |
| 10.3 Mobile sidebar | 🟡 | Collapsible via Header; desktop-first |
| 10.4 Send shortcut config | 🟡 | API/config supports send_shortcut; UI uses Enter |
| 10.5 E2E smoke test | ⬜ | Not implemented |

---

## Implemented Features (Summary)

*Copy to planning docs when referencing what exists.*

- Phase 1: Monorepo, API (Node/tsx), Vite web, Drizzle + better-sqlite3
- Phase 2: Schema, migrations, app_config defaults
- Phase 3: Config, browse, projects, chats, messages API
- Phase 4: Cursor CLI integration, streaming, session isolation
- Phase 5: React Router, AppShell, Sidebar, theme
- Phase 6: First-run redirect, Setup page
- Phase 7: Create project wizard (local + git), FolderPicker
- Phase 8: Chat view, message blocks, CodeBlock (Shiki), input, header menu
- Phase 9: Streaming send, chunk append, auth instructions, error states
- Phase 10: Empty state, chat title (rename), mobile sidebar (collapsible)
- Tests: API integration tests, Cursor CLI unit tests, DB unit tests (see docs/12-testing.md)

---

## File / Component Reference

*Link to key files once implemented.*

| Area | Path | Purpose |
|------|------|---------|
| API entry | `apps/api/main.ts` | Node/tsx + Hono (Bun fallback when sqlite supported) |
| Web entry | `apps/web/` | Vite + React |
| App shell | `apps/web/src/components/AppShell.tsx` | Layout, Header, Sidebar |
| Chat view | `apps/web/src/pages/ChatView.tsx` | Messages, streaming, input |
| Create project | `apps/web/src/pages/CreateProject.tsx` | Wizard (local/git) |
| DB schema | `packages/db/src/schema.ts` | Drizzle + better-sqlite3 |
| Cursor service | `apps/api/src/cursor-cli.ts` | spawn, create-chat, parse NDJSON |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-02 | Phase 1–3 complete; tests; Vite host:true for LAN/Tailscale; API uses Node (better-sqlite3) |
| 2025-02 | Phase 4 complete; Cursor CLI unit tests; session isolation integration tests; docs updated |
| 2025-02 | Phases 5–10 complete; full web UI (setup, create project, chat, streaming, code blocks, auth banner) |
| — | Initial implementation plan and status doc created |
