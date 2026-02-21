# Design

## Design Principles

1. **Chat-first** — The chat interface is the primary surface; everything else supports it
2. **Minimal friction** — Few steps to start a new chat or resume an existing one
3. **Real-time feedback** — User always sees what's happening (streaming, loading, errors)
4. **Clarity over decoration** — Functional, readable UI; avoid visual noise

## UX Principles

- **Progressive disclosure** — Show workspace setup only when needed
- **Immediate feedback** — Streaming responses, loading states, error toasts
- **Recoverable errors** — Clear error messages with actionable next steps
- **Editable metadata** — Chat titles are AI-generated but user-editable
- **Persistent context** — Header shows "Project › Chat" on left; three-dot menu on right for rename, delete, etc.

## Visual Direction

- **Theme**: Dark and light mode; auto-switch based on system preference
- **Typography**: Fira Code (monospace, ligatures) for code, paths, and developer-facing text; sans-serif for general UI
- **Nerd Fonts**: Use where it makes sense (icons in sidebar, file types, etc.)
- **Color**: Accent for interactive elements; muted for secondary info
- **Density**: Compact but readable; developers feel at home

## Key UX Flows

### Creating a New Project ([+ Create])

1. User clicks "[+ Create]" above project tree
2. Wizard: "Local folder" or "Git repository"
3. If local: Folder picker (browse under base dir or type path; restricted to base dir). If git: URL (+ branch) → clone to base dir
4. Project name: Auto-suggest from path (last segment) or git (repo name); suffix if duplicate (e.g. my-app-2); user can edit
5. On success: Project + first chat created; redirect to chat view
6. On error: Inline error, allow retry

### Starting a New Chat in Existing Project ([+] next to project)

1. User clicks [+] next to project in sidebar
2. New chat created immediately; chat view loads

### Sending a Message

1. User types and hits Send button or configured shortcut (Enter / Shift+Enter / Ctrl+Enter — user-configurable)
2. Message appears immediately in chat (user bubble)
3. Assistant response streams in below (token-by-token or chunk-by-chunk)
4. When complete: Input re-enabled, scroll to bottom

### Opening Existing Chat

1. User clicks chat in sidebar
2. Chat view loads with message history
3. If session resumable: Re-attach to CLI session
4. If not: New CLI session in same workspace (or prompt user)

## Streaming Behavior

- **Chunk display**: Append each chunk to the response area as received
- **No "typing" delay**: Show real content; avoid artificial delays
- **Code blocks**: Stream into code block; syntax highlight when complete (or incrementally)
- **Scroll**: Auto-scroll to bottom while streaming
- **Interrupt**: (Future) Ability to stop generation

## Code Blocks in Messages

- **Copy button**: One-click copy to clipboard
- **Syntax highlighting**: Per-language highlighting
- **Language label**: Show language (e.g. "typescript", "python") in block header
- **Diff view**: When applicable (e.g. file changes with before/after), render as diff (additions/removals)

## Empty State

- **No projects**: Main content area blank; centered "Create your first project" CTA (links to [+ Create] / wizard)

## First-Run Setup

- **Presentation**: Full-page setup screen before main app; blocks until base dir is configured
- **Flow**: User sets base dir (text input or env var pre-filled) → persist → redirect to main app

## Create Project Wizard

- **Presentation**: Inline in main content area; replaces chat view when open (not modal or slide-in)

## Error States

| Scenario | Display |
|----------|---------|
| Clone failed | Inline error in project creation; retry button |
| Not logged in / no API key | UI instructions: Set `CURSOR_API_KEY` env var or run `cursor agent login` |
| CLI not found | **Toast** + instructions to install Cursor CLI |
| Network error | **Toast** with retry option |
| Response-level (CLI crash, timeout, auth mid-chat) | **Inline** in chat where response would be; retry button |
| Session lost | **Inline** in chat: "Session disconnected. Start new message to reconnect." |

**Strategy**: Toast for transient/system errors; inline for errors tied to a specific message/response.

## Sidebar UX

- Collapsible sidebar with toggle
- Resizable via drag handle
- Collapsed by default on mobile/small screens; overlay or slide-in when opened

## Accessibility (MVP)

- Keyboard navigation for primary actions
- Focus management when opening modals / new chat
- Sufficient contrast (WCAG AA target)

## Message Layout (Full-Width)

- Both user and agent messages use full width of chat area
- **User**: Accent bar on left + light background tint
- **Agent**: No accent; neutral background; small icon/avatar to differentiate
- Small avatar/icon on left for both (user icon vs AI/agent icon)

## Chat Input

- Multi-line textarea; grows with content
- Send button inside textarea (bottom-right corner)
- Send shortcut configurable: Enter, Shift+Enter, or Ctrl+Enter (user setting)

## Design Tokens (Placeholder)

**Dark theme:**
```
--bg-primary: #1a1a1a
--bg-secondary: #252525
--text-primary: #e0e0e0
--text-muted: #888
--accent: #0078d4
--error: #e74c3c
--success: #2ecc71
```

**Light theme:** TBD (inverted / adjusted)

**Fonts:**
- UI: System sans or Inter
- Code / paths / dev text: Fira Code (ligatures enabled)
- Icons: Nerd Fonts where applicable

*Use `prefers-color-scheme` for auto theme switching.*
