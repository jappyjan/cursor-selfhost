# MVP Scope

## Feature Breakdown

### 1. Project Management

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| New chat in project | Start chat in existing project | Click [+] next to project in sidebar; new chat created |
| New project (local) | Create project from existing folder | Folder picker; name + slug auto from path (suffix if duplicate); project + chat created |
| New project (git) | Create project by cloning repo | URL (+ branch); clone to base dir; name + slug auto from repo (suffix if duplicate); project + chat created |
| Base dir | Root for all paths | Full-page setup screen on first run; env var can pre-fill; all paths restricted to it; security: no filesystem exposure outside |
| Folder picker | Select path for local project / git subdir | Browse under base dir via API or type path manually; restricted to base dir; not native (browser may be remote) |
| Git clone (SSH) | Clone via `git@...` URL | Uses host SSH keys |
| Branch selection | Optional branch for git | Default `main`; user can override |

### 2. Chat Management

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| New chat | Start fresh conversation | [+] next to project → Chat view; or [+ Create] → new project + first chat |
| Open chat | Resume existing conversation | Click chat → Load messages → Ready for input |
| URLs | Shareable, typable | Projects: /p/:slug; Chats: /p/:slug/c/:chatId (nanoid) |
| Chat actions | Rename, delete, etc. | Three-dot menu in header (right side); "Project › Chat" on left |
| Chat list | See all chats | Sidebar shows chats sorted by updated_at |
| Chat title | Identify chats | AI-generated summary of first message; user can edit |

### 3. Cursor CLI Integration

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| Launch session | Spawn Cursor CLI for project | Process starts; stdout/stderr captured |
| Auth / not logged in | Cursor API key missing | UI shows instructions: set `CURSOR_API_KEY` or run `cursor agent login` |
| Session tracking | Store session ID | Session ID persisted in DB (if CLI provides one) |
| Resume session | Reattach to existing session | If possible, reuse; else spawn new |
| Send message | Pass user input to CLI | Input sent; response streamed back |

### 4. Streaming Chat UI

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| Error handling | Cursor CLI failures | Toast for transient errors; inline in chat for response-level errors; retry where applicable |
| Stream response | Show output as it arrives | Chunks appear in real-time; no full-buffer wait |
| Message history | Persist and display messages | Full-width layout; user: accent bar + tint; agent: neutral; icons for both |
| Code blocks | Display code in messages | Copy button, syntax highlighting, language label; diff view when applicable |
| Input | Send new message | Multi-line textarea, send button inside; shortcut configurable (Enter/Shift+Enter/Ctrl+Enter); message appears; response streams |

### 5. Data Persistence

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| SQLite | All data in SQLite | Single file; no external DB |
| ORM | Type-safe access | Models for Project, Chat, Message |
| Migrations | Schema versioning | Migration files; run on deploy/start |

### 6. Sidebar (Tree View)

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| Project tree | Projects with nested chats | Expand/collapse; [+] per project for new chat |
| Sidebar | Collapsible, resizable | Collapsed by default on mobile/small screens |
| Create project | [+ Create] button | Opens wizard inline in main area (replaces chat view); local path or git; creates project + first chat |
| Empty state | No projects yet | Main area: centered "Create your first project" CTA |
| Search | Filter projects | By name or path |

### 7. Monorepo

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| Structure | apps/ + packages/ | `apps/web`, `apps/api`, `packages/db` |
| Shared code | Reuse types/schema | `packages/shared` or `packages/db` exports |

## Out of Scope (MVP)

- Storing API key in app (env var only; UI shows setup instructions when not logged in)
- User authentication
- Multi-user
- Search across chats
- Export/import
- Custom themes
- Mobile layout (shadcn is responsive; MVP is desktop-first with mobile support)
- Interrupt generation
- Edit/delete messages

## Dependencies to Verify

- [x] Cursor CLI: `cursor agent --print` with stdin/stdout, NDJSON output
- [x] Cursor CLI session resume: `--resume <sessionId>` supported
- [ ] Deno + libsql + Drizzle: local file connection

## MVP Deliverables

1. **Runnable app**: Single command to start (e.g. `pnpm dev` or `docker compose up`)
2. **Web UI**: Accessible at `http://localhost:3000` (or configurable)
3. **E2E flow**: [+ Create] → Git clone → Project + chat → Send message → See streamed response
4. **Persistence**: Restart app → Open existing chat → See history
