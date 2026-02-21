# Libraries and Dependencies

*Leverage existing, maintained, permissively-licensed libraries. Verify versions and maintenance status before adoption.*

## Research Summary

### Cursor CLI Interface (Resolved)

**Source**: [cursor-agent-a2a](https://github.com/jeffkit/cursor-agent-a2a) (MIT, v2.1.0, actively maintained)

The Cursor CLI uses **stdio** (stdin/stdout):

- **Invocation**: `cursor agent --print --output-format stream-json --stream-partial-output --workspace <path> --force --model <model> [--resume <sessionId>]`
- **Input**: Message text via stdin
- **Output**: NDJSON on stdout — `{"type":"result","result":"...","session_id":"..."}` or `{"type":"assistant","message":{"content":[...]}}`
- **Session resume**: `--resume <sessionId>` — Cursor CLI supports this natively
- **Install**: `curl https://cursor.com/install -fsS | bash`; auth via `cursor agent login` or `CURSOR_API_KEY`

## Backend (Deno + TypeScript)

| Package | Purpose | Version | License | Status |
|---------|---------|---------|---------|--------|
| [Deno](https://deno.land/) | Runtime | Latest | MIT | ✅ Actively maintained |
| [Hono](https://hono.dev/) | HTTP framework | Latest | MIT | ✅ Actively maintained, lightweight, streaming support |
| [drizzle-orm](https://orm.drizzle.team/) | ORM | Latest | Apache 2.0 | ✅ 32k+ stars, actively maintained |
| [@libsql/client](https://github.com/tursodatabase/libsql-client-ts) | SQLite driver (file + Turso) | Latest | Apache 2.0 | ✅ Drizzle-native; use `file:./db.sqlite` for local. *Verify Deno compatibility via `npm:` specifier* |
| [drizzle-kit](https://github.com/drizzle-team/drizzle-kit) | Migrations | Latest | Apache 2.0 | ✅ Part of Drizzle ecosystem |
| [nanoid](https://github.com/ai/nanoid) | UUIDs / IDs | v5 | MIT | ✅ Tiny, no deps |

**Alternatives considered**:
- **DenoDB**: Not actively maintained ⛔
- **Oak**: Heavier than Hono; Hono has better DX and streaming
- **better-sqlite3**: Node-native bindings; doesn't run in Deno. Use libsql instead.

## Frontend (React)

| Package | Purpose | Version | License | Status |
|---------|---------|---------|---------|--------|
| [React](https://react.dev/) | UI framework | 19.x | MIT | ✅ |
| [Vite](https://vite.dev/) | Build tool | Latest | MIT | ✅ Fast, simple |
| [shadcn/ui](https://ui.shadcn.com/) | Component library | Latest | MIT | ✅ Radix-based, copy-paste, comprehensive |
| [Tailwind CSS](https://tailwindcss.com/) | Styling | Latest | MIT | ✅ Required by shadcn |
| [Radix UI](https://www.radix-ui.com/) | Primitives (via shadcn) | Latest | MIT | ✅ Accessible, unstyled |
| [TanStack Query](https://tanstack.com/query) | Server state, caching | v5 | MIT | ✅ Industry standard |
| [lucide-react](https://lucide.dev/) | Icons | Latest | ISC | ✅ Used by shadcn |
| [Fira Code](https://github.com/tonsky/FiraCode) | Monospace font (code, paths) | Latest | OFL | Ligatures; dev-friendly |
| [React Router](https://reactrouter.com/) | Client-side routing | v7 | MIT | ✅ Projects by slug, chats by nanoid in URL |
| [Shiki](https://shiki.matsu.io/) | Code syntax highlighting | Latest | MIT | ✅ VS Code–style; language detection |
| [react-diff-viewer](https://github.com/praneshr/react-diff-viewer) or similar | Diff view for code changes | Latest | MIT | For before/after file blocks when applicable |
| Tailwind `dark:` + `darkMode: 'media'` | Theme switching | — | MIT | Auto dark/light from `prefers-color-scheme`; no extra deps. Optional: manual override later |

**Fonts & themes**:
- **Fira Code** (with ligatures) for code, paths, dev-facing text
- **lucide-react** for UI icons (shadcn default); Nerd Fonts optional for sidebar/file icons if preferred
- **Dark + light theme** with auto-switch via `prefers-color-scheme` (Tailwind `dark:`)

**Why shadcn/ui**:
- Mobile-responsive by default (Tailwind breakpoints)
- Covers our needs: Button, Input, Card, Dialog, ScrollArea, Textarea, etc.
- Copy-paste model — no lock-in, full control
- Built on Radix — accessibility (a11y) out of the box
- MIT license

**Alternatives considered**:
- **Mantine**: Good but heavier; shadcn more popular for React
- **Chakra UI**: Deprecated / in maintenance mode
- **Tamagui**: Great for React Native; overkill for web-only MVP

## Streaming

| Approach | Library | Notes |
|----------|---------|-------|
| Backend → Frontend | Native `ReadableStream` + `fetch` | No extra deps; Hono supports streaming responses |
| Format | NDJSON or plain text | Match Cursor CLI output format |

## Git Operations

| Approach | Notes |
|----------|-------|
| `Deno.Command` | Spawn `git clone`; no extra deps |
| URL validation | Use `new URL()` or simple regex for `git@` and `https://` |

## Monorepo Tooling

| Package | Purpose | License |
|---------|---------|---------|
| [pnpm](https://pnpm.io/) | Package manager, workspaces | MIT |
| [Turbo](https://turbo.build/) (optional) | Build orchestration | MIT |

*Note*: Frontend uses npm/pnpm (Vite/React); Backend uses Deno. May use separate roots or `deno.json` + `package.json` in monorepo.

## Version Pinning

- Pin major versions in config files
- Run `npm outdated` / `deno info` periodically
- Prefer `^` for minor/patch updates

## License Summary

All chosen libraries use **MIT** or **Apache 2.0** — permissive for commercial use.
