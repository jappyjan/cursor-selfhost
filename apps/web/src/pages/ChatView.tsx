import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useHeader } from "@/contexts/HeaderContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchChat,
  fetchMessages,
  fetchProjectBySlug,
  sendMessageStreaming,
  updateChat,
  deleteChat,
  fetchCursorStatus,
  type MessageBlock,
} from "@/lib/api";
import { MessageContent, TypingIndicator } from "@/components/MessageContent";
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
  const { setTitle, setActions } = useHeader();
  const [input, setInput] = useState("");
  const [streamingBlocks, setStreamingBlocks] = useState<MessageBlock[]>([]);
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
      setStreamingBlocks([]);
      await sendMessageStreaming(targetChatId, content, (chunk) => {
        if (chunk.type === "block") {
          setStreamingBlocks((prev) => {
            const block = chunk.block;
            if (block.type === "activity") return [...prev, block];
            if (block.type === "text") {
              const last = prev[prev.length - 1];
              if (last?.type === "text") {
                return [...prev.slice(0, -1), { type: "text" as const, content: last.content + block.content }];
              }
              return [...prev, block];
            }
            return prev;
          });
        }
        if (chunk.type === "chunk") {
          setStreamingBlocks((prev) => {
            const last = prev[prev.length - 1];
            if (last?.type === "text") return [...prev.slice(0, -1), { type: "text" as const, content: last.content + chunk.content }];
            return [...prev, { type: "text" as const, content: chunk.content }];
          });
        }
        if (chunk.type === "activity") {
          setStreamingBlocks((prev) => [
            ...prev,
            { type: "activity" as const, kind: chunk.kind, label: chunk.label, ...(chunk.details && { details: chunk.details }) },
          ]);
        }
        if (chunk.type === "error") setSendError(chunk.error);
      });
    },
    onSuccess: async (_data, { targetChatId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messages", targetChatId] }),
        queryClient.invalidateQueries({ queryKey: ["chat", targetChatId] }),
        queryClient.invalidateQueries({ queryKey: ["chats"] }),
      ]);
      setStreamingBlocks([]);
      if (sendingToChatIdRef.current === targetChatId) sendingToChatIdRef.current = null;
    },
    onError: (err, { targetChatId }) => {
      setSendError((err as Error).message);
      setStreamingBlocks([]);
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

  type DisplayItem =
    | { type: "user"; messageId: string; content: string }
    | { type: "assistant"; messageId: string; block: MessageBlock; isPulsing?: boolean }
    | { type: "assistant_legacy"; messageId: string; content: string; activities: { kind: string; label: string }[] | null };

  const isViewingSendingChat = chatId && sendingToChatIdRef.current === chatId;

  /** Collapse consecutive thinking blocks into one; pulse only while still receiving thinking (no next item yet). */
  function collapseThinkingItems(items: DisplayItem[]): DisplayItem[] {
    const result: DisplayItem[] = [];
    let thinkingRun: DisplayItem[] = [];

    const flushThinking = (pulsing: boolean) => {
      if (thinkingRun.length === 0) return;
      const first = thinkingRun[0];
      if (first.type === "assistant" && first.block.type === "activity") {
        result.push({ ...first, isPulsing: pulsing });
      }
      thinkingRun = [];
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isThinking =
        item.type === "assistant" &&
        item.block.type === "activity" &&
        item.block.kind === "thinking";

      if (isThinking) {
        thinkingRun.push(item);
        continue;
      }
      flushThinking(false);
      result.push(item);
    }
    flushThinking(isStreaming);
    return result;
  }

  function parseBlocks(m: (typeof messages)[0]): MessageBlock[] | null {
    if (Array.isArray(m.blocks)) return m.blocks;
    if (typeof m.blocks === "string" && m.blocks) {
      try {
        const parsed = JSON.parse(m.blocks);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  function parseActivities(m: (typeof messages)[0]): { kind: string; label: string }[] | null {
    if (Array.isArray(m.activities)) return m.activities;
    if (typeof m.activities === "string" && m.activities) {
      try {
        const parsed = JSON.parse(m.activities);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  const displayItems: DisplayItem[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      displayItems.push({ type: "user", messageId: m.id, content: m.content });
      continue;
    }
    const blocks = parseBlocks(m);
    if (blocks && blocks.length > 0) {
      for (const block of blocks) {
        displayItems.push({ type: "assistant", messageId: m.id, block });
      }
      continue;
    }
    displayItems.push({
      type: "assistant_legacy",
      messageId: m.id,
      content: m.content,
      activities: parseActivities(m),
    });
  }

  if (isViewingSendingChat && isStreaming && lastSentRef.current) {
    const lastSent = lastSentRef.current;
    const alreadyHasUserMessage = messages.some((m) => m.role === "user" && m.content === lastSent);
    if (!alreadyHasUserMessage) {
      displayItems.push({ type: "user", messageId: "__pending_user__", content: lastSent });
    }
  }

  if (isViewingSendingChat && isStreaming) {
    if (streamingBlocks.length > 0) {
      for (const block of streamingBlocks) {
        displayItems.push({ type: "assistant", messageId: "__streaming__", block });
      }
    } else {
      displayItems.push({
        type: "assistant",
        messageId: "__streaming__",
        block: { type: "text", content: "" },
      });
    }
  }

  const collapsedItems = collapseThinkingItems(displayItems);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingBlocks.length, isStreaming]);

  useEffect(() => {
    if (!chat || !project) {
      setTitle(undefined);
      setActions(null);
      return;
    }
    setTitle(`${project.name} › ${chat.title ?? "New chat"}`);
    setActions(
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
    );
    return () => {
      setTitle(undefined);
      setActions(null);
    };
  }, [chat, project, openRenameDialog, setTitle, setActions]);

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
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-3">
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

          {displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">
                No messages yet. Send a message to start the conversation.
              </p>
            </div>
          ) : (
            <>
              {collapsedItems.map((item, idx) => {
                if (item.type === "user") {
                  return (
                    <div
                      key={`${item.messageId}-${idx}`}
                      className="rounded-lg border-l-4 border-primary/50 bg-accent/50 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">You</p>
                      </div>
                      <div className="mt-2">
                        <MessageContent content={item.content} />
                      </div>
                    </div>
                  );
                }
                if (item.type === "assistant_legacy") {
                  return (
                    <div key={`${item.messageId}-${idx}`}>
                      {item.activities && item.activities.length > 0 && (
                        <div className="mb-1 space-y-0.5">
                          {item.activities.map((a, i) => (
                            <div
                              key={i}
                              className="text-xs text-muted-foreground/80"
                              title={a.kind}
                            >
                              {a.label}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="rounded-lg bg-muted/30 p-4">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <p className="text-sm font-medium text-muted-foreground">Assistant</p>
                        </div>
                        <div className="mt-2">
                          <MessageContent content={item.content} />
                        </div>
                      </div>
                    </div>
                  );
                }
                if (item.block.type === "activity") {
                  const pulsing = "isPulsing" in item && item.isPulsing;
                  const tooltip = [item.block.kind, item.block.details].filter(Boolean).join(" · ");
                  return (
                    <div
                      key={`${item.messageId}-${idx}`}
                      className="text-xs text-muted-foreground/80 py-0"
                      title={tooltip}
                    >
                      {item.block.kind === "thinking" && pulsing ? (
                        <TypingIndicator />
                      ) : (
                        <>
                          {item.block.label}
                          {item.block.details && (
                            <span className="ml-1.5 text-muted-foreground/60 truncate max-w-[200px] inline-block align-bottom" title={item.block.details}>
                              ({item.block.details})
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  );
                }
                return (
                  <div
                    key={`${item.messageId}-${idx}`}
                    className={cn(
                      "rounded-lg bg-muted/30 p-4",
                      item.messageId === "__streaming__" && !item.block.content && "animate-pulse"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Assistant</p>
                    </div>
                    <div className="mt-2">
                      {item.block.content ? (
                        <MessageContent
                          content={item.block.content}
                          isStreaming={item.messageId === "__streaming__" && isStreaming}
                        />
                      ) : item.messageId === "__streaming__" ? (
                        <span className="text-muted-foreground">Processing…</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
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
