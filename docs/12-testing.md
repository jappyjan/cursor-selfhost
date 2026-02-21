# Testing

Testing policy and coverage for cursor-selfhost.

---

## Policy

- **All new code must have tests.** Update this doc when adding test coverage.
- **API endpoints**: Integration tests via `app.fetch()` with in-memory SQLite.
- **DB layer**: Unit tests for migrations and helpers.
- **Frontend**: Component and E2E tests (Phase 10).

---

## Running Tests

```bash
pnpm test           # All packages (--if-present)
pnpm test:api       # API only
pnpm --filter db test   # DB package only
```

**Requirements**: Bun (API and DB tests use `bun test`).

---

## Test Structure

| Package | Test file(s) | What's tested |
|---------|--------------|----------------|
| `apps/api` | `app.test.ts` | Health, config GET/PUT, browse, projects CRUD, chats CRUD, messages |
| `packages/db` | `client.test.ts` | Migrations, ensureAppConfigDefaults |

---

## Coverage

| Area | Status |
|------|--------|
| API: health | ✅ |
| API: config GET/PUT | ✅ |
| API: browse | ✅ (path validation) |
| API: projects CRUD | ✅ |
| API: chats CRUD | ✅ |
| API: messages list | ✅ |
| DB: migrations | ✅ |
| DB: ensureAppConfigDefaults | ✅ |
| Frontend | ⬜ (Phase 5+) |
| E2E | ⬜ (Phase 10.5) |

---

## Adding Tests

1. **API**: Add cases to `apps/api/app.test.ts`. Use `app.fetch(new Request(...))` — no server needed.
2. **DB**: Add cases to `packages/db/client.test.ts` or new `*.test.ts` files.
3. **In-memory DB**: Set `process.env.DATABASE_PATH = ":memory:"` before any imports that load the db package.

---

## Changelog

| Date | Change |
|------|--------|
| 2025-02 | Initial testing policy; API and DB tests added |
