# Changelog

## [Unreleased]

### Added

- **Full MVP web UI** (Phases 5–10)
  - React Router, AppShell, collapsible Sidebar with project tree and chat list
  - First-run Setup page with FolderPicker for base directory
  - Create project wizard: local path or git clone (URL + branch)
  - Chat view: message history, streaming, code blocks (Shiki), auth instructions banner
  - Rename/delete chat, empty states, error handling

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
- **docs/10-implementation-status.md**: Phases 5–10 marked complete; frontend component reference
- **docs/01-overall-plan.md**: Phase 1 MVP checklist marked complete
- **docs/README.md**: Added 12-testing.md to document index
