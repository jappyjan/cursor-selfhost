import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeft } from "lucide-react";

interface HeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  title?: string;
  hideSidebarToggle?: boolean;
}

export function Header({ sidebarCollapsed, onToggleSidebar, title, hideSidebarToggle }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      {!hideSidebarToggle && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      )}
      <h1 className="font-mono text-lg font-semibold truncate">
        {title ?? "cursor-selfhost"}
      </h1>
    </header>
  );
}
