import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { useHeaderOptional } from "@/contexts/HeaderContext";

interface HeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  defaultTitle: string;
  hideSidebarToggle?: boolean;
}

export function Header({ sidebarCollapsed, onToggleSidebar, defaultTitle, hideSidebarToggle }: HeaderProps) {
  const headerCtx = useHeaderOptional();
  const title = headerCtx?.title ?? defaultTitle;
  const actions = headerCtx?.actions;

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
      <h1 className="min-w-0 flex-1 font-mono text-lg font-semibold truncate">
        {title}
      </h1>
      {actions && <div className="flex shrink-0 items-center">{actions}</div>}
    </header>
  );
}
