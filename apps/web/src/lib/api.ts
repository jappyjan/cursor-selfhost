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
