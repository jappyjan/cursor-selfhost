import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchProjectBySlug, fetchChats } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";

export function ProjectView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: project, error } = useQuery({
    queryKey: ["project", slug],
    queryFn: () => fetchProjectBySlug(slug!),
    enabled: !!slug,
  });
  const { data: chats = [] } = useQuery({
    queryKey: ["chats", project?.id],
    queryFn: () => fetchChats(project!.id),
    enabled: !!project?.id,
  });

  if (error || !project) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">
          {error ? (error as Error).message : "Project not found"}
        </p>
      </div>
    );
  }

  if (chats.length > 0) {
    navigate(`/p/${slug}/c/${chats[0].id}`, { replace: true });
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <p className="text-muted-foreground">No chats yet</p>
      <Link to={`/p/${slug}/new`}>
        <Button>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          New chat
        </Button>
      </Link>
    </div>
  );
}
