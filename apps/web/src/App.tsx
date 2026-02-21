import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Home } from "@/pages/Home";
import { Setup } from "@/pages/Setup";
import { ProjectView } from "@/pages/ProjectView";
import { ChatView } from "@/pages/ChatView";
import { NewChatView } from "@/pages/NewChatView";
import { CreateProject } from "@/pages/CreateProject";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
