const API_BASE = "/api";

export type ApiConfig = {
  projectsBasePath: string | null;
  configured: boolean;
  sendShortcut: string;
  suggestedBasePath?: string;
  suggestedRootPath?: string;
  filesystemRoot?: string;
};

export type Project = {
  id: string;
  slug: string;
  name: string;
  path: string;
  sourceType: string;
  gitUrl: string | null;
  gitBranch: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Chat = {
  id: string;
  projectId: string;
  title: string | null;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** Parsed from JSON; API may return string (legacy) */
  activities?: { kind: string; label: string }[] | string | null;
  /** Parsed from JSON; ordered blocks for interleaved text + activities */
  blocks?: MessageBlock[] | string | null;
  /** Image URLs for user messages (served from attachments) */
  imageUrls?: string[];
};

export type CursorStatus = { ok: boolean; error?: string };

/** Stdio config: { command, args?, env? } */
export type McpStdioConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

/** HTTP/Streamable config: { url, headers? } */
export type McpUrlConfig = {
  url: string;
  headers?: Record<string, string>;
};

/** Desktop config: { desktop: { command } } */
export type McpDesktopConfig = {
  desktop: { command: string };
};

export type McpServerConfig = McpStdioConfig | McpUrlConfig | McpDesktopConfig;

export type McpServer = {
  id: string;
  projectId: string;
  name: string;
  command: string;
  args: string;
  env: string | null;
  config: string | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export async function fetchConfig(): Promise<ApiConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function fetchProjectBySlug(slug: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/by-slug/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch project");
  return res.json();
}

export async function fetchChats(projectId: string): Promise<Chat[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/chats`);
  if (!res.ok) throw new Error("Failed to fetch chats");
  return res.json();
}

export async function fetchChat(chatId: string): Promise<Chat> {
  const res = await fetch(`${API_BASE}/chats/${chatId}`);
  if (!res.ok) throw new Error("Failed to fetch chat");
  return res.json();
}

export async function fetchMessages(chatId: string): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/chats/${chatId}/messages`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function fetchCursorStatus(): Promise<CursorStatus> {
  const res = await fetch(`${API_BASE}/cursor/status`);
  if (!res.ok) throw new Error("Failed to fetch cursor status");
  return res.json();
}

export async function fetchMcpServers(projectId: string): Promise<McpServer[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/mcp-servers`);
  if (!res.ok) throw new Error("Failed to fetch MCP servers");
  return res.json();
}

export type CreateMcpServerBody =
  | { name: string; config: McpServerConfig; enabled?: boolean }
  | { name: string; command: string; args?: string[]; env?: Record<string, string>; enabled?: boolean };

export async function createMcpServer(
  projectId: string,
  body: CreateMcpServerBody
): Promise<McpServer> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/mcp-servers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to create MCP server");
  }
  return res.json();
}

export type UpdateMcpServerBody = {
  name?: string;
  config?: McpServerConfig;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
};

export async function updateMcpServer(
  projectId: string,
  serverId: string,
  body: UpdateMcpServerBody
): Promise<McpServer> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/mcp-servers/${serverId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to update MCP server");
  }
  return res.json();
}

export async function deleteMcpServer(projectId: string, serverId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/mcp-servers/${serverId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to delete MCP server");
  }
}

export type McpStatusEntry = { identifier: string; status: string; message?: string };

export async function fetchMcpStatus(projectId: string): Promise<{
  entries: McpStatusEntry[];
  cliAvailable: boolean;
}> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/mcp-servers/status`);
  if (!res.ok) throw new Error("Failed to fetch MCP status");
  return res.json();
}

export type McpLoginResult = { ok: boolean; authUrl?: string; error?: string };

export async function loginMcpServer(
  projectId: string,
  serverId: string,
  callbackUrl?: string
): Promise<McpLoginResult> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/mcp-servers/${serverId}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callbackUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Login failed");
  }
  return data as McpLoginResult;
}

export async function createChat(projectId: string): Promise<Chat> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to create chat");
  return res.json();
}

export type BrowseEntry = { name: string; isDir: boolean };

export async function createFolder(
  parentPath: string,
  name: string,
  setup?: boolean
): Promise<{ path: string }> {
  const res = await fetch(`${API_BASE}/browse/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentPath, name, setup }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to create folder");
  }
  return res.json();
}

export async function fetchBrowse(path?: string, setup?: boolean): Promise<{ entries: BrowseEntry[] }> {
  const params = new URLSearchParams();
  if (path) params.set("path", path);
  if (setup) params.set("setup", "1");
  const url = `${API_BASE}/browse${params.toString() ? `?${params}` : ""}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Failed to browse");
    }
    return res.json();
  } catch (e) {
    clearTimeout(timeout);
    if ((e as Error).name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw e;
  }
}

export type CreateProjectBody = {
  sourceType: "local" | "git";
  path?: string;
  gitUrl?: string;
  gitBranch?: string;
  name: string;
  slug: string;
};

export async function createProject(body: CreateProjectBody): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to create project");
  }
  return res.json();
}

export async function updateChat(chatId: string, updates: { title?: string }): Promise<Chat> {
  const res = await fetch(`${API_BASE}/chats/${chatId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update chat");
  return res.json();
}

export async function deleteChat(chatId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/chats/${chatId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete chat");
}

/** Explicit stop — kills CLI at current state. Call when user clicks stop (not on disconnect). */
export async function stopMessageStreaming(chatId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/chats/${chatId}/messages/stop`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to stop");
}

export type MessageBlock =
  | { type: "text"; content: string }
  | { type: "activity"; kind: string; label: string; details?: string; toolName?: string; args?: Record<string, string>; output?: string };

export type StreamChunk =
  | { type: "block"; block: MessageBlock }
  | { type: "chunk"; content: string }
  | { type: "activity"; kind: string; label: string; details?: string; toolName?: string; args?: Record<string, string>; output?: string }
  | { type: "done"; sessionId: string | null }
  | { type: "title"; title: string }
  | { type: "error"; error: string };

export async function uploadImages(chatId: string, files: File[]): Promise<{ paths: string[] }> {
  const formData = new FormData();
  for (const f of files) formData.append("files", f);
  const res = await fetch(`${API_BASE}/chats/${chatId}/uploads`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to upload images");
  }
  return res.json();
}

export async function sendMessageStreaming(
  chatId: string,
  content: string,
  onChunk: (chunk: StreamChunk) => void,
  imagePaths?: string[]
): Promise<void> {
  type ParsedChunk = {
    type: string;
    content?: string;
    kind?: string;
    label?: string;
    details?: string;
    toolName?: string;
    args?: Record<string, string>;
    output?: string;
    sessionId?: string | null;
    title?: string;
    error?: string;
    block?: MessageBlock;
  };
  const res = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, ...(imagePaths?.length && { imagePaths }) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to send message");
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as ParsedChunk;
        if (parsed.type === "block" && parsed.block) onChunk({ type: "block", block: parsed.block });
        else if (parsed.type === "chunk") onChunk({ type: "chunk", content: parsed.content ?? "" });
        else if (parsed.type === "activity") onChunk({ type: "activity", kind: parsed.kind ?? "", label: parsed.label ?? "", ...(parsed.details && { details: parsed.details }), ...(parsed.toolName && { toolName: parsed.toolName }), ...(parsed.args && { args: parsed.args }), ...(parsed.output && { output: parsed.output }) });
        else if (parsed.type === "done") onChunk({ type: "done", sessionId: parsed.sessionId ?? null });
        else if (parsed.type === "title" && parsed.title) onChunk({ type: "title", title: parsed.title });
        else if (parsed.type === "error") onChunk({ type: "error", error: parsed.error ?? "" });
      } catch (e) {
        console.warn("[sendMessageStreaming] Malformed NDJSON line:", line?.slice(0, 100), e);
      }
    }
  }
  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer) as ParsedChunk;
      if (parsed.type === "block" && parsed.block) onChunk({ type: "block", block: parsed.block });
      else if (parsed.type === "chunk") onChunk({ type: "chunk", content: parsed.content ?? "" });
      else if (parsed.type === "activity") onChunk({ type: "activity", kind: parsed.kind ?? "", label: parsed.label ?? "", ...(parsed.details && { details: parsed.details }), ...(parsed.toolName && { toolName: parsed.toolName }), ...(parsed.args && { args: parsed.args }) });
      else if (parsed.type === "done") onChunk({ type: "done", sessionId: parsed.sessionId ?? null });
      else if (parsed.type === "title" && parsed.title) onChunk({ type: "title", title: parsed.title });
      else if (parsed.type === "error") onChunk({ type: "error", error: parsed.error ?? "" });
    } catch (e) {
      console.warn("[sendMessageStreaming] Malformed NDJSON buffer:", buffer?.slice(0, 100), e);
    }
  }
}
