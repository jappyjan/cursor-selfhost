import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ChevronRight, ChevronDown, MessageSquare, Folder, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchProjects, fetchChats, type Project, type Chat } from "@/lib/api";

interface SidebarProps {
  collapsed: boolean;
  isMobile?: boolean;
  onClose?: () => void;
  className?: string;
}

function ProjectTreeItem({ project, search }: { project: Project; search: string }) {
  const [expanded, setExpanded] = useState(true);
  const { data: chats = [] } = useQuery({
    queryKey: ["chats", project.id],
    queryFn: () => fetchChats(project.id),
  });
  const { chatId } = useParams<{ chatId: string }>();
  const matchesSearch =
    !search ||
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.slug.toLowerCase().includes(search.toLowerCase());

  if (!matchesSearch) return null;

  return (
    <div className="py-0.5">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{project.name}</span>
      </button>
      {expanded && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
          <Link
            to={`/p/${project.slug}/new`}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            New chat
          </Link>
          <Link
            to={`/p/${project.slug}/settings`}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          {chats.map((c) => (
            <ChatLink key={c.id} chat={c} projectSlug={project.slug} active={c.id === chatId} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChatLink({ chat, projectSlug, active }: { chat: Chat; projectSlug: string; active: boolean }) {
  return (
    <Link
      to={`/p/${projectSlug}/c/${chat.id}`}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent",
        active ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{chat.title ?? "New chat"}</span>
    </Link>
  );
}

export function Sidebar({ collapsed, isMobile, onClose, className }: SidebarProps) {
  const [search, setSearch] = useState("");
  const location = useLocation();
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const prevPath = useRef(location.pathname);
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      if (isMobile && onClose) onClose();
    }
  }, [location.pathname, isMobile, onClose]);

  if (collapsed) return null;

  const content = (
    <>
      <div className="flex flex-col gap-2 p-2">
        <Link to="/create">
          <Button className="w-full" size="sm">
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </Link>
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="space-y-0.5">
          {projects.map((p) => (
            <ProjectTreeItem key={p.id} project={p} search={search} />
          ))}
        </div>
      </nav>
    </>
  );

  if (isMobile) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
        <aside
          className={cn(
            "fixed left-0 top-14 bottom-0 z-50 flex w-64 flex-col border-r border-border bg-background",
            className
          )}
        >
          {content}
        </aside>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "flex w-64 shrink-0 flex-col border-r border-border bg-muted/30",
        className
      )}
    >
      {content}
    </aside>
  );
}
