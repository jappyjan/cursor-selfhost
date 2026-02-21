import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchConfig } from "@/lib/api";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });
  const setupRequired = !config?.configured;

  const pathParts = location.pathname.split("/").filter(Boolean);
  let title = "cursor-selfhost";
  if (pathParts[0] === "p" && pathParts[1]) {
    title = pathParts[1];
    if (pathParts[2] === "c") title += " › Chat";
    else if (pathParts[2] === "new") title += " › New chat";
  } else if (pathParts[0] === "setup") title = "Setup";

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        title={title}
        hideSidebarToggle={setupRequired}
      />
      <div className="flex flex-1 overflow-hidden">
        {!setupRequired && <Sidebar collapsed={sidebarCollapsed} />}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
