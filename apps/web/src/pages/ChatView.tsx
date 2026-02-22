import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useHeader } from "@/contexts/HeaderContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchChat,
  fetchMessages,
  fetchProjectBySlug,
  sendMessageStreaming,
  uploadImages,
  updateChat,
  deleteChat,
  fetchCursorStatus,
  type MessageBlock,
} from "@/lib/api";
import { MessageContent, TypingIndicator } from "@/components/MessageContent";
import { ToolCallDisplay } from "@/components/ToolCallDisplay";
import { ChatInputArea } from "@/components/ChatInputArea";
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
import {
  User,
  Bot,
  MoreVertical,
  AlertCircle,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatView() {
  const { slug, chatId } = useParams<{ slug: string; chatId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setTitle, setActions } = useHeader();
  const [streamingBlocks, setStreamingBlocks] = useState<MessageBlock[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const lastSentRef = useRef<string>("");
  const lastSentImageUrlsRef = useRef<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const userAtBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const SCROLL_THRESHOLD_PX = 120;

  const checkAtBottom = useCallback((el: HTMLDivElement | null) => {
    if (!el) return true;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= SCROLL_THRESHOLD_PX;
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const atBottom = checkAtBottom(el);
    userAtBottomRef.current = atBottom;
    setShowScrollToBottom(!atBottom);
  }, [checkAtBottom]);

  const scrollToBottom = useCallback(() => {
    userAtBottomRef.current = true;
    setShowScrollToBottom(false);
    const el = messagesScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

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
    mutationFn: async ({
      content,
      files,
      targetChatId,
    }: {
      content: string;
      files?: File[];
      targetChatId: string;
    }) => {
      setSendError(null);
      setStreamingBlocks([]);
      let imagePaths: string[] | undefined;
      if (files?.length) {
        const { paths } = await uploadImages(targetChatId, files);
        imagePaths = paths;
      }
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
            {
              type: "activity" as const,
              kind: chunk.kind,
              label: chunk.label,
              ...(chunk.details && { details: chunk.details }),
              ...(chunk.toolName && { toolName: chunk.toolName }),
              ...(chunk.args && Object.keys(chunk.args).length > 0 && { args: chunk.args }),
              ...(chunk.output && { output: chunk.output }),
            },
          ]);
        }
        if (chunk.type === "error") setSendError(chunk.error);
      }, imagePaths);
    },
    onSuccess: async (_data, { targetChatId }) => {
      lastSentImageUrlsRef.current = [];
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messages", targetChatId] }),
        queryClient.invalidateQueries({ queryKey: ["chat", targetChatId] }),
        queryClient.invalidateQueries({ queryKey: ["chats"] }),
      ]);
      setStreamingBlocks([]);
    },
    onError: (err) => {
      lastSentImageUrlsRef.current = [];
      setSendError((err as Error).message);
      setStreamingBlocks([]);
    },
  });

  /** Each chat has its own ChatView instance (keyed by chatId), so loading state is naturally per chat. */
  const isStreaming = sendMutation.isPending;
  const isCursorLoggedIn = cursorStatus?.ok === true;

  const handleSend = useCallback(
    (content: string, files?: File[], imagePreviewUrls?: string[]) => {
      const text = content.trim();
      if ((!text && (!files || files.length === 0)) || isStreaming || !chatId) return;
      lastSentRef.current = text || (files?.length ? `[${files.length} image(s)]` : "");
      lastSentImageUrlsRef.current = imagePreviewUrls ?? [];
      userAtBottomRef.current = true;
      setShowScrollToBottom(false);
      sendMutation.mutate({ content: text, files, targetChatId: chatId });
    },
    [isStreaming, sendMutation, chatId]
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
    | { type: "user"; messageId: string; content: string; imageUrls?: string[] }
    | { type: "assistant"; messageId: string; block: MessageBlock; isPulsing?: boolean }
    | { type: "assistant_legacy"; messageId: string; content: string; activities: { kind: string; label: string }[] | null };

  /** With keyed ChatView, we're always viewing the chat we're sending to when sending. */
  const isViewingSendingChat = !!chatId && isStreaming;

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
      displayItems.push({
        type: "user",
        messageId: m.id,
        content: m.content,
        imageUrls: m.imageUrls,
      });
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
      displayItems.push({
        type: "user",
        messageId: "__pending_user__",
        content: lastSent,
        imageUrls: lastSentImageUrlsRef.current,
      });
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

  const lastScrollTimeRef = useRef(0);
  const SCROLL_THROTTLE_MS = 100;
  useLayoutEffect(() => {
    if (!userAtBottomRef.current) return;
    const el = messagesScrollRef.current;
    if (!el) return;
    const now = Date.now();
    if (now - lastScrollTimeRef.current < SCROLL_THROTTLE_MS && isStreaming) return;
    lastScrollTimeRef.current = now;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, streamingBlocks.length, streamingBlocks, isStreaming]);

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
      <div
        ref={messagesScrollRef}
        className="relative flex-1 overflow-y-auto p-6"
        onScroll={handleMessagesScroll}
      >
        <div className="mx-auto w-full max-w-5xl space-y-3">
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
                  const imageUrls = item.imageUrls;
                  return (
                    <div
                      key={`${item.messageId}-${idx}`}
                      className="rounded-lg border-l-4 border-primary/50 bg-accent/50 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">You</p>
                      </div>
                      <div className="mt-2 space-y-2">
                        {imageUrls && imageUrls.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {imageUrls.map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt=""
                                className="max-h-48 max-w-full rounded-md border border-border object-contain"
                              />
                            ))}
                          </div>
                        )}
                        {item.content &&
                          !(imageUrls?.length && /^\[\d+ image\(s\)( attached)?\]$/.test(item.content)) && (
                          <MessageContent content={item.content} />
                        )}
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
                  if (item.block.kind === "thinking" && pulsing) {
                    return (
                      <div key={`${item.messageId}-${idx}`} className="py-0">
                        <TypingIndicator />
                      </div>
                    );
                  }
                  return (
                    <div
                      key={`${item.messageId}-${idx}`}
                      className="w-full min-w-0 overflow-hidden"
                    >
                      <ToolCallDisplay
                        label={item.block.label}
                        details={item.block.details}
                        toolName={item.block.toolName}
                        args={item.block.args}
                        output={item.block.output}
                        projectPath={project?.path}
                      />
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
        {showScrollToBottom && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute bottom-6 right-6 h-10 w-10 rounded-full shadow-lg"
            onClick={scrollToBottom}
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Error block with retry */}
      {sendError && (
        <div className="shrink-0 border-t border-border bg-destructive/10 px-6 py-3">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <p className="text-sm text-destructive">{sendError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSendError(null);
                const toRetry = lastSentRef.current;
                if (toRetry && chatId) {
                  lastSentRef.current = toRetry;
                  sendMutation.mutate({ content: toRetry, files: undefined, targetChatId: chatId });
                }
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Input area — isolated so typing doesn't re-render the whole chat */}
      <ChatInputArea onSend={handleSend} isStreaming={isStreaming} />

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
