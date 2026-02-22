# Overall Plan: Cursor Self-Host

## Vision

Build a self-hosted wrapper around the Cursor CLI that replicates the experience of Cursor Cloud Runners—allowing developers to run AI-assisted coding sessions on their own infrastructure, with full control over data and execution environment.

## Goals

- **Self-hosted** — No dependency on Cursor's cloud; runs entirely on user's infrastructure
- **Chat-focused** — Primary interface is conversational, similar to Cursor's chat UX
- **Session persistence** — Resume or open any existing chat/session
- **Workspace flexibility** — Support local directories or git repositories (SSH/HTTP)
- **Real-time feedback** — Streaming output so users see responses as they arrive

## Phases

### Phase 1: MVP (Complete)

- [x] Web UI with chat interface
- [x] Create new chat / open existing chat
- [x] Workspace setup: local directory or git checkout
- [x] Cursor CLI session management (launch, resume, track by session ID)
- [x] SQLite + ORM with migrations
- [x] Streaming chat output
- [x] Monorepo structure (apps/web, apps/api, packages/db)

### Phase 2: Post-MVP

- [ ] Multi-user support (optional)
- [ ] Session history search
- [ ] Workspace templates
- [ ] Resource limits / sandboxing
- [ ] Logs and debugging tools

### Phase 3: Advanced

- [ ] Team collaboration
- [ ] Custom runner configurations
- [ ] Integration with CI/CD
- [ ] Metrics and observability

## Success Criteria (MVP)

1. User can start a new chat and see streaming responses from Cursor CLI
2. User can open an existing chat and continue the conversation
3. User can choose a local path or git URL for workspace
4. Sessions are persisted and resumable
5. All data stored locally (SQLite)

## Out of Scope (MVP)

- User authentication (single-user / local use assumed)
- Cursor API key management UI (assume env/config)
- Mobile/responsive optimization
- Offline mode

## Dependencies & Assumptions

- Cursor CLI is installed and available on the host
- Host has git installed for repository checkout
- Web server runs on same machine or has access to host filesystem
- Single primary user for MVP
