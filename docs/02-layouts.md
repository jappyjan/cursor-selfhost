# Layouts

## Application Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Logo | Project › Chat (left) | ⋮ menu (right: rename, delete, etc.) │
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│  Sidebar         │  Main Content Area                           │
│  (Tree: Projects │  - Chat view OR create-project wizard      │
│   + Chats)       │    (inline, replaces chat view)              │
│                  │  ┌────────────────────────────────────────┐  │
│  [+ Create]      │  │ Messages / Streaming output            │  │
│                  │  │                                        │  │
│  ▼ Project A [+] │  │                                        │  │
│    - Chat 1      │  └────────────────────────────────────────┘  │
│    - Chat 2      │  ┌────────────────────────────────────────┐  │
│  ▶ Project B [+] │  │ Input: User message + Send              │  │
│  ▶ Project C [+] │  └────────────────────────────────────────┘  │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

- **Sidebar**: Tree view — projects at top level; chats nested under each project
- **[+ Create]**: Big button above projects → opens wizard for new project (local folder or git)
- **[+]** next to project: Start new chat in that project

## Screen Layouts

### 1. Sidebar (Tree View)

- **Purpose**: Navigate projects and chats; start new chat or new project
- **Structure**:
  - **[+ Create]** — Big button at top → opens new-project wizard
  - **Projects** — Expandable/collapsible (▼ expanded, ▶ collapsed)
  - **Per project**: **[+]** button to start new chat in that project
  - **Per project**: List of chat sessions (nested under project; titles AI-generated from first message, user-editable)
- **Ordering**: Projects grouped by recent activity; searchable by name/path
- **States**: Empty (no projects) — main area shows centered "Create your first project" CTA; populated tree
- **Create wizard**: Inline in main content area (replaces chat view when open)
- **First-run setup**: Full-page setup screen before main app; blocks until base dir is set

### 2. New Project Flow ([+ Create])

**Step 1**: Project source?
  - **Local folder** → Custom folder picker (browse under base dir OR type path manually); restricted to base dir
  - **Git repository** → URL input (+ optional branch) → Clone to base dir (or subdir picked via same picker)

**Step 2**: Project name + slug (user-editable)
  - **Name default**: From path (last segment) or from git (repo name); suffix if duplicate
  - **Slug**: URL-safe version of name (e.g. `my-app`); used in `/p/:slug`; unique
  - User can override both before creating

**Step 3**: Chat interface loads; new project + first chat created

### 2b. New Chat in Existing Project ([+] next to project)

- Click **[+]** next to project → New chat created immediately; chat view loads

### 3. Chat View (Primary)

- **Purpose**: Conversational interface with Cursor CLI
- **Layout**:
  - **Message area**: Full-width blocks; user has accent bar + tint; agent neutral (no accent); icons for both
  - **Streaming zone**: Active response streams in real-time (typing effect / token-by-token)
  - **Input area**: Multi-line textarea with send button inside (bottom-right); send shortcut configurable (Enter / Shift+Enter / Ctrl+Enter)
  - **Context bar** (optional): Show current project name/path
- **States**:
  - Idle (waiting for input)
  - Streaming (response in progress)
  - Error (display error message)

### 4. Open Existing Chat

- **Flow**: Click chat in sidebar → Load chat view with message history
- **Consideration**: May need to re-attach to Cursor CLI session if resumable

## Component Hierarchy

```
App
├── Header
│   ├── Logo / Brand
│   ├── ProjectChatBreadcrumb (when in chat): "Project › Chat"
│   └── ChatActionsMenu (⋮): rename, delete, etc.
├── Layout (split)
│   ├── Sidebar
│   │   ├── CreateProjectButton
│   │   ├── ProjectTree
│   │   │   └── ProjectNode[]
│   │   │       ├── ProjectHeader (name, [+] button)
│   │   │       └── ChatListItem[]
│   │   └── SearchInput (filter projects by name/path)
│   └── MainContent
│       ├── CreateProjectWizard (when [+ Create] clicked)
│       │   ├── Step1: LocalFolder | GitRepo
│       │   ├── Step2a: FolderPicker (if local) | GitUrlInput (if git)
│       │   │   FolderPicker: browse under base dir via API OR type path manually; all paths restricted to base dir (security)
│       │   └── Step2b: ProjectNameInput (default from path/git; suffix if duplicate; user-editable)
│       └── ChatView (when in chat)
│           ├── MessageList
│           │   └── Message[]
│           ├── StreamingMessage (active response)
│           └── ChatInput
```

## Sidebar Behavior

- **Collapsible**: Can hide/show; toggle button in header or sidebar
- **Resizable**: User can drag edge to change width
- **Mobile/small screens**: Collapsed by default; overlay or slide-in when opened

## Responsive Considerations (MVP)

- Desktop-first; sidebar collapsed by default on mobile/smaller screens
- Minimum width for chat: ~600px

## Navigation Flow & URLs

```
/                           → Home (empty state or redirect)
/setup                      → First-run setup (if base dir not set)
/p/:projectSlug             → Project view (chats list); or redirect to first chat
/p/:projectSlug/c/:chatId    → Chat view (chatId = nanoid)
/p/:projectSlug/new         → Create project wizard (inline)
```

[Sidebar: Project tree]
    → [+ Create] → [Wizard] → Project + first chat created → /p/:slug/c/:chatId
    → [+] next to project → New chat → /p/:slug/c/:newChatId
    → [Click existing chat] → /p/:slug/c/:chatId
