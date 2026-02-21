const API_BASE = "/api";

export type ApiConfig = {
  projectsBasePath: string | null;
  configured: boolean;
  sendShortcut: string;
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
};

export type CursorStatus = { ok: boolean; error?: string };

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

export async function createChat(projectId: string): Promise<Chat> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to create chat");
  return res.json();
}

export type BrowseEntry = { name: string; isDir: boolean };

export async function fetchBrowse(path?: string): Promise<{ entries: BrowseEntry[] }> {
  const url = path ? `${API_BASE}/browse?path=${encodeURIComponent(path)}` : `${API_BASE}/browse`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to browse");
  }
  return res.json();
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

export type StreamChunk = { type: "chunk"; content: string } | { type: "done"; sessionId: string | null } | { type: "error"; error: string };

export async function sendMessageStreaming(
  chatId: string,
  content: string,
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const res = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
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
        const parsed = JSON.parse(line) as StreamChunk;
        onChunk(parsed);
      } catch (e) {
        console.warn("[sendMessageStreaming] Malformed NDJSON line:", line?.slice(0, 100), e);
      }
    }
  }
  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer) as StreamChunk;
      onChunk(parsed);
    } catch (e) {
      console.warn("[sendMessageStreaming] Malformed NDJSON buffer:", buffer?.slice(0, 100), e);
    }
  }
}
