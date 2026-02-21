import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createChat, fetchProjectBySlug } from "@/lib/api";

/** Prevents duplicate chat creation when React Strict Mode double-mounts */
const creatingForSlug = new Set<string>();

export default function NewChatView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const project = await fetchProjectBySlug(slug!);
      return createChat(project.id);
    },
    onSuccess: (chat) => {
      creatingForSlug.delete(slug!);
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      navigate(`/p/${slug}/c/${chat.id}`, { replace: true });
    },
    onError: () => {
      creatingForSlug.delete(slug!);
      // Stay on page to show error
    },
  });

  useEffect(() => {
    if (!slug || creatingForSlug.has(slug)) return;
    creatingForSlug.add(slug);
    mutation.mutate();
  }, [slug]);

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">
        {mutation.isPending
          ? "Creating chat…"
          : mutation.isError
            ? (mutation.error as Error).message
            : "Loading…"}
      </p>
    </div>
  );
}
