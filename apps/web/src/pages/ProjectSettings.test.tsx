/**
 * Tests for ProjectSettings MCP server configuration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectSettings } from "./ProjectSettings";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    fetchProjectBySlug: vi.fn().mockResolvedValue({
      id: "proj-1",
      slug: "test-proj",
      name: "Test Project",
      path: "/tmp/test",
      sourceType: "local",
      gitUrl: null,
      gitBranch: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    fetchMcpServers: vi.fn().mockResolvedValue([]),
    createMcpServer: vi.fn().mockResolvedValue({}),
    updateMcpServer: vi.fn().mockResolvedValue({}),
    deleteMcpServer: vi.fn().mockResolvedValue(undefined),
    loginMcpServer: vi.fn().mockResolvedValue({ ok: false }),
  };
});

function renderProjectSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/p/test-proj/settings"]}>
        <Routes>
          <Route path="p/:slug/settings" element={<ProjectSettings />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProjectSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchMcpServers).mockResolvedValue([]);
  });

  it("renders MCP servers section", async () => {
    renderProjectSettings();
    await waitFor(() => {
      expect(screen.getByText("MCP servers")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Add server/i })).toBeInTheDocument();
  });

  it("opens add dialog and shows transport options", async () => {
    renderProjectSettings();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Add server/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Add server/i }));
    await waitFor(() => {
      expect(screen.getByText("Add MCP server")).toBeInTheDocument();
    });
    expect(screen.getByText("Command (stdio)")).toBeInTheDocument();
    expect(screen.getByText("HTTP/URL")).toBeInTheDocument();
    expect(screen.getByText("Desktop")).toBeInTheDocument();
  });

  it("displays stdio server with command", async () => {
    vi.mocked(api.fetchMcpServers).mockResolvedValue([
      {
        id: "s1",
        projectId: "proj-1",
        name: "filesystem",
        command: "npx",
        args: '["-y","@modelcontextprotocol/server-filesystem"]',
        env: null,
        config: null,
        enabled: true,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    renderProjectSettings();
    await waitFor(() => {
      expect(screen.getByText("filesystem")).toBeInTheDocument();
    });
    expect(screen.getByText("stdio")).toBeInTheDocument();
  });

  it("displays url server", async () => {
    vi.mocked(api.fetchMcpServers).mockResolvedValue([
      {
        id: "s2",
        projectId: "proj-1",
        name: "remote",
        command: "url",
        args: "[]",
        env: null,
        config: JSON.stringify({ url: "https://example.com/mcp" }),
        enabled: true,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    renderProjectSettings();
    await waitFor(() => {
      expect(screen.getByText("remote")).toBeInTheDocument();
    });
    expect(screen.getByText("url")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/mcp")).toBeInTheDocument();
  });
});
