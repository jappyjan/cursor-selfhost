import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createChat, fetchProjectBySlug } from "@/lib/api";

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
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      navigate(`/p/${slug}/c/${chat.id}`, { replace: true });
    },
    onError: () => {
      // Stay on page to show error
    },
  });

  useEffect(() => {
    if (slug && mutation.isIdle) {
      mutation.mutate();
    }
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
