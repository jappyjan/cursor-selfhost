# Cursor Self-Host

Self-hosted wrapper around the Cursor CLI — a chat-focused web UI to run AI-assisted coding sessions on your own infrastructure.

## Status

**Phases 1–3 complete.** Monorepo, API (Node + Hono), frontend (Vite + React + shadcn/ui), Drizzle + better-sqlite3. Config, browse, projects, chats, messages API done. See [docs/10-implementation-status.md](docs/10-implementation-status.md).

## Quick Start

```bash
pnpm install
pnpm db:migrate          # Run database migrations
pnpm dev                 # Start API + web
```

**Requirements:** Node 18+

**Run individually:**
```bash
pnpm dev:api   # API on http://localhost:3001
pnpm dev:web   # Web on http://localhost:5173
pnpm test      # API + DB tests (Bun)
pnpm test:api  # API tests only
```

**Network access:** Vite binds to `0.0.0.0` — reachable via LAN/Tailscale (e.g. `http://<tailscale-ip>:5173`).

## Quick Links

- [Overall Plan](docs/01-overall-plan.md)
- [Implementation Plan](docs/09-implementation-plan.md)
- [Implementation Status](docs/10-implementation-status.md)
- [Testing](docs/12-testing.md)

## License

PolyForm Noncommercial 1.0.0 — free for noncommercial use. Commercial licenses available. See [LICENSE](LICENSE).
