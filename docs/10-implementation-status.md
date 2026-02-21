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
| 5.1 React Router | ⬜ | |
| 5.2 App shell | ⬜ | |
| 5.3 Sidebar | ⬜ | |
| 5.4 Theme (dark/light) | ⬜ | |
| 5.5 Fonts (Fira Code) | ⬜ | |

---

## Phase 6: Frontend — First-Run & Setup

| Task | Status | Notes |
|------|--------|-------|
| 6.1 First-run redirect | ⬜ | |
| 6.2 Setup page | ⬜ | |

---

## Phase 7: Frontend — Create Project

| Task | Status | Notes |
|------|--------|-------|
| 7.1 Create wizard | ⬜ | |
| 7.2 FolderPicker (local) | ⬜ | |
| 7.3 Git clone flow | ⬜ | |
| 7.4 Name + slug | ⬜ | |
| 7.5 Redirect on create | ⬜ | |

---

## Phase 8: Frontend — Chat View

| Task | Status | Notes |
|------|--------|-------|
| 8.1 Chat view layout | ⬜ | |
| 8.2 Message blocks | ⬜ | |
| 8.3 Code blocks (Shiki) | ⬜ | |
| 8.4 Diff view | ⬜ | |
| 8.5 Input area | ⬜ | |
| 8.6 Header + menu | ⬜ | |

---

## Phase 9: Frontend — Streaming & Integration

| Task | Status | Notes |
|------|--------|-------|
| 9.1 Send message + stream | ⬜ | |
| 9.2 Append chunks | ⬜ | |
| 9.3 Input disable while streaming | ⬜ | |
| 9.4 Error states | ⬜ | |
| 9.5 Auth instructions | ⬜ | |

---

## Phase 10: Polish & Edge Cases

| Task | Status | Notes |
|------|--------|-------|
| 10.1 Empty state | ⬜ | |
| 10.2 Chat title | ⬜ | |
| 10.3 Mobile sidebar | ⬜ | |
| 10.4 Send shortcut config | ⬜ | |
| 10.5 E2E smoke test | ⬜ | |

---

## Implemented Features (Summary)

*Copy to planning docs when referencing what exists.*

- Phase 1: Monorepo, API (Node/tsx), Vite web, Drizzle + better-sqlite3
- Phase 2: Schema, migrations, app_config defaults
- Phase 3: Config, browse, projects, chats, messages API
- Phase 4: Cursor CLI integration, streaming, session isolation
- Tests: API integration tests, Cursor CLI unit tests, DB unit tests (see docs/12-testing.md)

---

## File / Component Reference

*Link to key files once implemented.*

| Area | Path | Purpose |
|------|------|---------|
| API entry | `apps/api/main.ts` | Node/tsx + Hono (Bun fallback when sqlite supported) |
| Web entry | `apps/web/` | Vite + React |
| DB schema | `packages/db/src/schema.ts` | Drizzle + better-sqlite3 |
| Cursor service | `apps/api/src/cursor-cli.ts` | spawn, create-chat, parse NDJSON |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-02 | Phase 1–3 complete; tests; Vite host:true for LAN/Tailscale; API uses Node (better-sqlite3) |
| 2025-02 | Phase 4 complete; Cursor CLI unit tests; session isolation integration tests; docs updated |
| — | Initial implementation plan and status doc created |
