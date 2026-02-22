/**
 * Tests that each chat has its own loading state.
 * - Unit tests in chatStreamingState.test.ts verify the isStreaming logic per chat.
 * - These tests verify ChatView shows loading only when sending from the current chat.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeaderProvider } from "@/contexts/HeaderContext";
import { ChatView } from "./ChatView";
import * as api from "@/lib/api";
import type { StreamChunk } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    fetchConfig: vi.fn().mockResolvedValue({ configured: true }),
    fetchChat: vi.fn().mockImplementation((id: string) =>
      Promise.resolve({
        id,
        projectId: "proj-1",
        title: "Chat",
        sessionId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ),
    fetchProjectBySlug: vi.fn().mockResolvedValue({
      id: "proj-1",
      slug: "proj",
      name: "Project",
      path: "/tmp/proj",
      sourceType: "local",
      gitUrl: null,
      gitBranch: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    fetchMessages: vi.fn().mockResolvedValue([]),
    fetchCursorStatus: vi.fn().mockResolvedValue({ ok: true }),
    uploadImages: vi.fn().mockResolvedValue({ paths: [] }),
    sendMessageStreaming: vi.fn().mockImplementation(() => new Promise(() => {})),
  };
});

function renderChatAt(chatId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HeaderProvider>
        <MemoryRouter initialEntries={[`/p/proj/c/${chatId}`]}>
          <Routes>
            <Route path="p/:slug/c/:chatId" element={<ChatView />} />
          </Routes>
        </MemoryRouter>
      </HeaderProvider>
    </QueryClientProvider>
  );
}

describe("ChatView per-chat loading state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chat B does not show loading when switching from chat A that is streaming (fresh instance)", async () => {
    const { unmount } = renderChatAt("chat-a");

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Send a message/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Send a message/);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sending/i })).toBeInTheDocument();
    });

    unmount();
    renderChatAt("chat-b");

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Send a message/)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Send message/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sending/i })).not.toBeInTheDocument();
  });

  it("shows loading when sending from the current chat", async () => {
    renderChatAt("chat-a");

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Send a message/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Send a message/);
    fireEvent.change(input, { target: { value: "Hi" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sending/i })).toBeInTheDocument();
    });
  });

  it("invalidates chat and chats queries when title chunk received", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    let onChunk: ((chunk: StreamChunk) => void) | null = null;
    vi.mocked(api.sendMessageStreaming).mockImplementation((_chatId, _content, cb) => {
      onChunk = cb;
      return Promise.resolve();
    });

    render(
      <QueryClientProvider client={queryClient}>
        <HeaderProvider>
          <MemoryRouter initialEntries={["/p/proj/c/chat-1"]}>
            <Routes>
              <Route path="p/:slug/c/:chatId" element={<ChatView />} />
            </Routes>
          </MemoryRouter>
        </HeaderProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Send a message/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Send a message/);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(onChunk).toBeTruthy();
    });

    onChunk!({ type: "title", title: "Fix auth bug" });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["chat", "chat-1"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["chats"] });
  });

  it("displays error when sendMessageStreaming throws", async () => {
    vi.mocked(api.sendMessageStreaming).mockRejectedValue(new Error("Chat not found"));

    renderChatAt("chat-1");

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Send a message/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Send a message/);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText("Chat not found")).toBeInTheDocument();
    });
  });

  it("displays error when stream emits error chunk", async () => {
    let onChunk: ((chunk: StreamChunk) => void) | null = null;
    vi.mocked(api.sendMessageStreaming).mockImplementation((_chatId, _content, cb) => {
      onChunk = cb;
      return Promise.resolve();
    });

    renderChatAt("chat-1");

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Send a message/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Send a message/);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(onChunk).toBeTruthy();
    });

    await act(() => {
      onChunk!({ type: "error", error: "Cursor CLI exited with code 1" });
    });

    expect(screen.getByText("Cursor CLI exited with code 1")).toBeInTheDocument();
  });

  it("shows streaming blocks instead of last assistant from DB when streaming (avoids duplication)", async () => {
    const userMsg = {
      id: "msg-1",
      chatId: "chat-1",
      role: "user" as const,
      content: "Hello",
      createdAt: new Date().toISOString(),
    };
    const assistantMsg = {
      id: "msg-2",
      chatId: "chat-1",
      role: "assistant" as const,
      content: "Partial",
      createdAt: new Date().toISOString(),
      blocks: JSON.stringify([{ type: "text" as const, content: "Partial" }]),
    };

    vi.mocked(api.fetchMessages).mockResolvedValue([userMsg, assistantMsg]);

    let onChunk: ((chunk: StreamChunk) => void) | null = null;
    vi.mocked(api.sendMessageStreaming).mockImplementation((_chatId, _content, cb) => {
      onChunk = cb;
      return new Promise(() => {});
    });

    renderChatAt("chat-1");

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Send a message/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Send a message/);
    fireEvent.change(input, { target: { value: "Hi" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(onChunk).toBeTruthy();
    });

    await act(() => {
      onChunk!({ type: "block", block: { type: "text", content: "Streaming " } });
      onChunk!({ type: "block", block: { type: "text", content: "content" } });
    });

    expect(screen.getByText(/Streaming content/)).toBeInTheDocument();
    expect(screen.queryByText(/^Partial$/)).not.toBeInTheDocument();
  });

  it("loads all messages from fetchMessages and displays them", async () => {
    const messages = [
      {
        id: "msg-1",
        chatId: "chat-1",
        role: "user" as const,
        content: "Hello",
        createdAt: new Date().toISOString(),
      },
      {
        id: "msg-2",
        chatId: "chat-1",
        role: "assistant" as const,
        content: "Hi there!",
        createdAt: new Date().toISOString(),
      },
    ];
    vi.mocked(api.fetchMessages).mockResolvedValue(messages);

    renderChatAt("chat-1");

    await waitFor(() => {
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });
});
