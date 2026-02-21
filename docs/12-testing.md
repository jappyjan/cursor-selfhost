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

**Requirements**: Node.js (API and DB tests use Vitest).

**Database isolation**: Tests use `DATABASE_PATH=:memory:` (in-memory SQLite) via `test-setup.ts`. They never touch dev/prod database files.

---

## Test Structure

| Package | Test file(s) | What's tested |
|---------|--------------|----------------|
| `apps/api` | `app.test.ts` | Health, config GET/PUT, browse, projects CRUD, chats CRUD (incl. session isolation), messages, POST messages validation, cursor status |
| `apps/api` | `src/cursor-cli.test.ts` | `parseCursorLine`, `extractTextFromLine`, `createCursorSession`, `spawnCursorAgent` (mocked spawn) |
| `packages/db` | `client.test.ts` | Migrations, ensureAppConfigDefaults |

---

## Coverage

| Area | Status |
|------|--------|
| API: health | ✅ |
| API: config GET/PUT | ✅ |
| API: browse | ✅ (path validation) |
| API: projects CRUD | ✅ |
| API: chats CRUD | ✅ (incl. session isolation, Cursor failure fallback) |
| API: messages list | ✅ |
| API: POST messages (validation) | ✅ |
| API: cursor status | ✅ |
| Cursor CLI: parseCursorLine, extractTextFromLine | ✅ |
| Cursor CLI: createCursorSession, spawnCursorAgent | ✅ (mocked spawn) |
| DB: migrations | ✅ |
| DB: ensureAppConfigDefaults | ✅ |
| Frontend | ⬜ (Phase 5+) |
| E2E | ⬜ (Phase 10.5) |

---

## Adding Tests

1. **API**: Add cases to `apps/api/app.test.ts`. Use `app.fetch(new Request(...))` — no server needed.
2. **DB**: Add cases to `packages/db/client.test.ts` or new `*.test.ts` files.
3. **In-memory DB**: Set `process.env.DATABASE_PATH = ":memory:"` before any imports that load the db package.
4. **Cursor CLI**: Unit tests in `apps/api/src/cursor-cli.test.ts` mock `child_process.spawn`. App tests mock `createCursorSession` so no agent binary is required.

---

## Changelog

| Date | Change |
|------|--------|
| 2025-02 | Initial testing policy; API and DB tests added |
| 2025-02 | Cursor CLI unit tests (`cursor-cli.test.ts`); session isolation integration tests; mock `createCursorSession` in app tests |
