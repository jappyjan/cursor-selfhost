import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchChat, fetchMessages } from "@/lib/api";

export function ChatView() {
  const { chatId } = useParams<{ chatId: string }>();
  const { data: chat, error } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => fetchChat(chatId!),
    enabled: !!chatId,
  });
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => fetchMessages(chatId!),
    enabled: !!chatId,
  });

  if (error || !chat) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">
          {error ? (error as Error).message : "Chat not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">
                No messages yet. Send a message to start the conversation.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "rounded-lg border-l-4 border-primary/50 bg-accent/50 p-4"
                    : "rounded-lg p-4"
                }
              >
                <p className="text-sm font-medium text-muted-foreground">
                  {m.role === "user" ? "You" : "Assistant"}
                </p>
                <pre className="mt-1 whitespace-pre-wrap font-mono text-sm">
                  {m.content}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
