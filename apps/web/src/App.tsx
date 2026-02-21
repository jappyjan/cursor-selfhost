import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
  const { data: config, isLoading } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!config?.configured && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
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
              <Route path="p/:slug/c/:chatId" element={<ChatView />} />
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
