import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Home } from "@/pages/Home";
import { Setup } from "@/pages/Setup";
import { ProjectView } from "@/pages/ProjectView";
import { ChatView } from "@/pages/ChatView";
import NewChatView from "@/pages/NewChatView";
import { CreateProject } from "@/pages/CreateProject";
import { fetchConfig } from "@/lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
  },
});

function FirstRunGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: config, isLoading, isError, error } = useQuery({
    queryKey: ["config"],
    queryFn: fetchConfig,
    retry: 2,
    retryDelay: 1000,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-8">
        <p className="text-center font-medium text-destructive">Backend not available</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Failed to connect to the API."} Make sure the API is running
          (e.g. <code className="rounded bg-muted px-1 font-mono">pnpm dev:api</code>).
        </p>
      </div>
    );
  }

  if (!config?.configured && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

/** Renders ChatView with key=chatId so each chat gets its own instance and loading state. */
function ChatRoute() {
  const { chatId } = useParams<{ chatId: string }>();
  return <ChatView key={chatId} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FirstRunGuard>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="setup" element={<Setup />} />
              <Route path="create" element={<CreateProject />} />
              <Route path="p/:slug" element={<ProjectView />} />
              <Route path="p/:slug/c/:chatId" element={<ChatRoute />} />
              <Route path="p/:slug/new" element={<NewChatView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </FirstRunGuard>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
