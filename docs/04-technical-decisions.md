# Technical Decisions

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web UI        │────▶│   Backend API   │────▶│   Cursor CLI    │
│   (React)       │     │   (Deno/Hono)   │     │   (Subprocess)  │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
        │                        │
        │                        ▼
        │                ┌─────────────────┐
        │                │   SQLite DB     │
        └────────────────│   (Drizzle)     │
                         └─────────────────┘
```

## Monorepo Structure

**Decision**: Use monorepo to keep frontend, backend, and shared code together.

```
cursor-selfhost/
├── apps/
│   ├── web/          # Frontend (React + Vite + shadcn/ui)
│   └── api/          # Backend (Deno + TypeScript)
├── packages/
│   ├── db/           # Drizzle schema, migrations (shared or Deno)
│   └── shared/       # Shared types, constants
├── docs/
└── deno.json + package.json (or pnpm-workspace)
```

**Rationale**: Single repo simplifies development; packages can be extracted later if needed.

## Tech Stack

### Backend

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Runtime | **Deno** | TypeScript-native, secure, modern tooling |
| Framework | **Hono** | Lightweight, streaming support, Deno-compatible |
| ORM | **Drizzle** | Migration support, SQLite via libsql, works with Deno |
| Database | **SQLite** (libsql `file:`) | Simple, file-based, no separate server |

### Frontend

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | **React** | Industry standard, ecosystem |
| Components | **shadcn/ui** | Mobile-optimized, comprehensive, Radix-based, MIT |
| Build | **Vite** | Fast, simple |
| Streaming | **fetch + ReadableStream** | Native; no extra deps |
| State | **TanStack Query** | Server state, caching |
| Routing | **React Router** | Projects by slug, chats by nanoid in URL |

### Cursor CLI Integration

- **Interface**: **stdio** — `cursor agent --print` accepts message on stdin, outputs NDJSON on stdout
- **Streaming**: Use `--output-format stream-json --stream-partial-output` for real-time chunks
- **Session resume**: `--resume <sessionId>` — Cursor CLI supports this natively
- **Process management**: `Deno.Command` to spawn; capture stdout for streaming
- **Reference**: [cursor-agent-a2a](https://github.com/jeffkit/cursor-agent-a2a) implements this pattern

## Streaming Strategy

1. **Backend**: Spawn Cursor CLI with `--output-format stream-json`; pipe stdout to HTTP response stream
2. **Transport**: Chunked `Transfer-Encoding` or SSE — `fetch` with `response.body.getReader()`
3. **Frontend**: `fetch` + `ReadableStream`; append chunks to DOM as they arrive
4. **Format**: NDJSON from Cursor; parse `{"type":"result","result":"..."}` or `{"type":"assistant",...}` per line

## Session & Project Model

- **Project**: Folder on disk (local path or cloned from git); user-facing concept
- **Chat**: One conversation; belongs to one project; many chats per project
- **Session**: Cursor CLI session ID; stored per chat for `--resume`

**Lifecycle**:
- Create chat → Pick existing project or create new (local path or git clone) → Launch CLI session → Attach chat
- Resume chat → Look up session ID → Use `--resume <sessionId>` in same project path

## Git Integration

- **Clone**: Use `git clone` via child process; support `git@...` (SSH) and `https://...`
- **Branch**: Optional; default `main` or `master`
- **Auth**: SSH keys from host `~/.ssh`; HTTPS may need credential helper
- **Base dir**: Single configured root; all paths (local + git) must be within it. Security: no filesystem exposure outside.
- **Base dir config**: Full-page setup screen on first run; env var `PROJECTS_BASE_PATH` can pre-fill; persisted
- **Path**: Git clones to `<base>/<repo-slug>-<id>` or user-picked subdir; local projects: path under base dir

## Security Considerations

- **Path traversal**: All paths must be under configured base dir; validate before use; no exposure of filesystem outside base dir
- **Command injection**: Sanitize git URLs; use exec with array args
- **No auth in MVP**: Assume trusted environment; add later

## Configuration

- **Env vars**: `CURSOR_CLI_PATH`, `CURSOR_API_KEY` (or use `cursor agent login`), `DATABASE_PATH`
- **Base path for git clones**: Picked in UI on first run; persisted. Env var `PROJECTS_BASE_PATH` can override default suggestion.
- **Config file**: Optional `config.json` or `config.yaml` for overrides

## Deployment & Runtime

- **Host**: Typically a remote machine; can also run locally for development
- **Primary interaction**: Web dashboard/chat UI
- **CLI direct use**: Out of scope for MVP — if someone SSHs in and runs `cursor agent` separately, we don't sync; ignore edge-case conflicts
- **MVP**: Single API process; SQLite file on host; projects (folders) on host filesystem
- **Future (out of scope)**: Webhooks, service integrations

## Routing & URLs

- **Projects**: Slug in URL (e.g. `/p/my-app`) — user-friendly, shareable, typable
- **Chats**: Nanoid in URL (e.g. `/p/my-app/c/abc123`) — short, stable
- **React Router** for client-side routing

## ORM Priority

- **ORM with migrations** is more important than Deno vs Node
- **Prefer Deno** if Drizzle + libsql works; **fallback to Node** if ORM is problematic

## Open Questions

- [ ] Deno + Drizzle + libsql: Verify; if not, switch to Node + Drizzle + better-sqlite3
- [ ] Monorepo: Separate `deno.json` for api vs `package.json` for web, or unified setup
- [ ] Chat title generation: Use Cursor CLI with "summarize" prompt, or separate lightweight model?
