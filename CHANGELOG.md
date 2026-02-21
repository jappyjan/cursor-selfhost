# Changelog

## [Unreleased]

### Added

- **Cursor CLI unit tests** (`apps/api/src/cursor-cli.test.ts`)
  - `parseCursorLine`: empty/invalid JSON, NDJSON with session_id, assistant messages
  - `extractTextFromLine`: direct result, message content array, empty content
  - `createCursorSession`: spawn args (create-chat, --workspace), non-zero exit handling
  - `spawnCursorAgent`: --resume when resumeSessionId set, --workspace/--trust, stdin write
  - Uses `vi.mock("child_process")` — no agent binary required

- **Session isolation integration tests** (`apps/api/app.test.ts`)
  - Mock `createCursorSession` so app tests run without Cursor CLI
  - Assert chat creation returns `sessionId` when Cursor succeeds
  - Assert chat creation returns `sessionId: null` when Cursor fails (graceful fallback)

### Changed

- **docs/12-testing.md**: Test structure, coverage table, changelog; added cursor-cli mocking notes
- **docs/10-implementation-status.md**: Phase 4 marked complete; Cursor service path; changelog
