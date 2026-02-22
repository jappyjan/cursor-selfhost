import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchConfig } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { HeaderProvider } from "@/contexts/HeaderContext";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    setSidebarCollapsed(isMobile);
  }, [isMobile]);
  const location = useLocation();
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });
  const setupRequired = !config?.configured;

  const pathParts = location.pathname.split("/").filter(Boolean);
  let defaultTitle = "cursor-selfhost";
  if (pathParts[0] === "p" && pathParts[1]) {
    defaultTitle = pathParts[1];
    if (pathParts[2] === "c") defaultTitle += " › Chat";
    else if (pathParts[2] === "new") defaultTitle += " › New chat";
  } else if (pathParts[0] === "setup") defaultTitle = "Setup";

  return (
    <HeaderProvider>
      <div className="flex h-screen flex-col bg-background">
        <Header
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
          defaultTitle={defaultTitle}
          hideSidebarToggle={setupRequired}
        />
        <div className="flex flex-1 overflow-hidden">
          {!setupRequired && <Sidebar collapsed={sidebarCollapsed} isMobile={isMobile} onClose={() => setSidebarCollapsed(true)} />}
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </HeaderProvider>
  );
}
