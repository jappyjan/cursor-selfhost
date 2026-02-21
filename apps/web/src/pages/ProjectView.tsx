import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchProjectBySlug, fetchChats } from "@/lib/api";

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

  navigate(`/p/${slug}/new`, { replace: true });
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Loading…</p>
    </div>
  );
}
