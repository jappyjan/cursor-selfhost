/**
 * Tests that each chat has its own loading state.
 * - Unit tests in chatStreamingState.test.ts verify the isStreaming logic per chat.
 * - These tests verify ChatView shows loading only when sending from the current chat.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeaderProvider } from "@/contexts/HeaderContext";
import { ChatView } from "./ChatView";
import * as api from "@/lib/api";

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

    let onChunk: ((chunk: { type: string; title?: string }) => void) | null = null;
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
});
