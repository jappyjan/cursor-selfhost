# API Outline

*Preliminary API design for backend. Refine as implementation progresses.*

## REST Endpoints

### Projects

| Method | Path | Description |
|--------|------|-------------|
| POST | `/projects` | Create project (local path or git clone) |
| GET | `/projects` | List projects |
| GET | `/projects/:id` | Get project by ID |
| GET | `/projects/by-slug/:slug` | Get project by slug (for URL resolution) |

**POST /projects** body:
```json
{
  "sourceType": "local" | "git",
  "path": "/absolute/path",           // if local
  "gitUrl": "https://...",            // if git
  "gitBranch": "main",                // optional
  "name": "my-project",               // user-editable; default from path/git, suffix if duplicate
  "slug": "my-project"                // URL-safe; default from name, unique; used in /p/:slug
}
```

### Chats

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chats` | Create chat (requires project_id) |
| GET | `/chats` | List chats (optional: project_id filter) |
| GET | `/chats/:id` | Get chat with messages |
| PATCH | `/chats/:id` | Update chat (e.g. title, session_id). Title is AI-generated from first message but user-editable. |

### Browse (folder picker)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/browse?path=/some/path` | List directories under base dir only; `path` must be within `PROJECTS_BASE_PATH`; used by folder picker |

### Messages

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chats/:id/messages` | Send message; returns SSE stream for response |
| GET | `/chats/:id/messages` | List messages (for history) |

**POST /chats/:id/messages** body:
```json
{
  "content": "User message text"
}
```

**Response**: SSE stream or `Transfer-Encoding: chunked` with NDJSON/text chunks.

## Streaming

### Option A: SSE (Server-Sent Events)

```
GET /chats/:id/messages/stream?message=...
```

- `Content-Type: text/event-stream`
- Events: `chunk`, `done`, `error`

### Option B: POST with chunked response

```
POST /chats/:id/messages
Content-Type: application/json
Body: { "content": "..." }

Response: Transfer-Encoding: chunked
```

- Stream response body directly
- Frontend uses `fetch` + `response.body.getReader()`

## WebSocket (Alternative)

If bidirectional needed (e.g. interrupt, multi-turn in single connection):

```
WS /chats/:id/stream
```

- Client sends: `{ "type": "message", "content": "..." }`
- Server sends: `{ "type": "chunk", "content": "..." }`, `{ "type": "done" }`

*Recommendation for MVP: SSE or chunked POST — simpler.*
