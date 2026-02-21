import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchChat,
  fetchMessages,
  fetchProjectBySlug,
  sendMessageStreaming,
  updateChat,
  deleteChat,
  fetchCursorStatus,
} from "@/lib/api";
import { MessageContent } from "@/components/MessageContent";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  Bot,
  MoreVertical,
  Send,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatView() {
  const { slug, chatId } = useParams<{ slug: string; chatId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingActivities, setStreamingActivities] = useState<{ kind: string; label: string }[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const lastSentRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendingToChatIdRef = useRef<string | null>(null);

  const { data: chat, error } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => fetchChat(chatId!),
    enabled: !!chatId,
  });
  const { data: project } = useQuery({
    queryKey: ["project", slug],
    queryFn: () => fetchProjectBySlug(slug!),
    enabled: !!slug,
  });
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => fetchMessages(chatId!),
    enabled: !!chatId,
  });
  const { data: cursorStatus } = useQuery({
    queryKey: ["cursorStatus"],
    queryFn: fetchCursorStatus,
  });

  const sendMutation = useMutation({
    mutationFn: async ({ content, targetChatId }: { content: string; targetChatId: string }) => {
      setSendError(null);
      setStreamingContent("");
      setStreamingActivities([]);
      await sendMessageStreaming(targetChatId, content, (chunk) => {
        if (chunk.type === "chunk") {
          setStreamingContent((prev) => prev + chunk.content);
        }
        if (chunk.type === "activity") {
          setStreamingActivities((prev) => [...prev, { kind: chunk.kind, label: chunk.label }]);
        }
        if (chunk.type === "error") {
          setSendError(chunk.error);
        }
      });
    },
    onSuccess: (_data, { targetChatId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", targetChatId] });
      queryClient.invalidateQueries({ queryKey: ["chat", targetChatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      setStreamingContent("");
      setStreamingActivities([]);
      if (sendingToChatIdRef.current === targetChatId) sendingToChatIdRef.current = null;
    },
    onError: (err, { targetChatId }) => {
      setSendError((err as Error).message);
      setStreamingContent("");
      setStreamingActivities([]);
      if (sendingToChatIdRef.current === targetChatId) sendingToChatIdRef.current = null;
    },
  });

  const isStreaming = sendMutation.isPending;
  const isCursorLoggedIn = cursorStatus?.ok === true;

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming || !chatId) return;
    lastSentRef.current = text;
    sendingToChatIdRef.current = chatId;
    sendMutation.mutate({ content: text, targetChatId: chatId });
    setInput("");
  }, [input, isStreaming, sendMutation, chatId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const openRenameDialog = useCallback(() => {
    setRenameTitle(chat?.title ?? "New chat");
    setRenameOpen(true);
  }, [chat?.title]);

  const submitRename = useCallback(() => {
    const title = renameTitle.trim();
    if (!title) return;
    updateChat(chatId!, { title }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      setRenameOpen(false);
    });
  }, [renameTitle, chatId, queryClient]);

  const confirmDelete = useCallback(() => {
    deleteChat(chatId!)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["chats"] });
        navigate(`/p/${slug}`, { replace: true });
      })
      .catch((err) => {
        setSendError((err as Error).message);
      });
  }, [chatId, slug, navigate, queryClient]);

  const displayMessages = [...messages];
  const isViewingSendingChat = chatId && sendingToChatIdRef.current === chatId;
  // Only show streaming/optimistic UI when viewing the chat that initiated the send
  if (isViewingSendingChat && isStreaming && lastSentRef.current) {
    const lastSent = lastSentRef.current;
    const alreadyHasUserMessage = messages.some(
      (m) => m.role === "user" && m.content === lastSent
    );
    if (!alreadyHasUserMessage) {
      displayMessages.push({
        id: "__pending_user__",
        chatId: chatId!,
        role: "user",
        content: lastSent,
        createdAt: new Date().toISOString(),
      });
    }
  }
  const showStreamingActivities = isViewingSendingChat && isStreaming && streamingActivities.length > 0;
  if (isViewingSendingChat && (streamingContent || showStreamingActivities)) {
    displayMessages.push({
      id: "__streaming__",
      chatId: chatId!,
      role: "assistant",
      content: streamingContent || "",
      createdAt: new Date().toISOString(),
    });
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent, isStreaming]);

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
      {/* Chat header: Project › Chat with menu */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <h2 className="font-mono text-sm font-medium">
          {project?.name ?? slug} › {chat.title ?? "New chat"}
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={openRenameDialog}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {!isCursorLoggedIn && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Cursor not logged in
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Set <code className="rounded bg-muted px-1 font-mono">CURSOR_API_KEY</code> in the API env, or run{" "}
                    <code className="rounded bg-muted px-1 font-mono">agent login</code> in the same terminal where the API runs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {displayMessages.length === 0 && !streamingContent ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">
                No messages yet. Send a message to start the conversation.
              </p>
            </div>
          ) : (
            <>
              {displayMessages.map((m) => (
                <div key={m.id}>
                  {showStreamingActivities && m.id === "__streaming__" && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {streamingActivities.map((a, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded px-2 py-0.5 text-xs text-muted-foreground/80"
                          title={a.kind}
                        >
                          {a.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-lg p-4",
                      m.role === "user"
                        ? "border-l-4 border-primary/50 bg-accent/50"
                        : "bg-muted/30",
                      m.id === "__streaming__" && !m.content && "animate-pulse"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {m.role === "user" ? (
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <p className="text-sm font-medium text-muted-foreground">
                        {m.role === "user" ? "You" : "Assistant"}
                      </p>
                    </div>
                    <div className="mt-2">
                      {m.content ? (
                        <MessageContent content={m.content} />
                      ) : m.id === "__streaming__" ? (
                        <span className="text-muted-foreground">Processing…</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error block with retry */}
      {sendError && (
        <div className="shrink-0 border-t border-border bg-destructive/10 px-6 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <p className="text-sm text-destructive">{sendError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSendError(null);
                const toRetry = lastSentRef.current || input.trim();
                if (toRetry && chatId) {
                  lastSentRef.current = toRetry;
                  sendMutation.mutate({ content: toRetry, targetChatId: chatId });
                }
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-border p-4">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Textarea
            placeholder="Send a message… (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            className="min-h-[60px] resize-none font-mono text-sm"
            rows={3}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="self-end"
            aria-label={isStreaming ? "Sending…" : "Send message"}
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Send</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            placeholder="Chat title"
            onKeyDown={(e) => e.key === "Enter" && submitRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={!renameTitle.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All messages in this chat will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                confirmDelete();
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
