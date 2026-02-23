import { useState, useCallback, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square, ImagePlus, X } from "lucide-react";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE_MB = 10;

interface ChatInputAreaProps {
  onSend: (content: string, files?: File[], imagePreviewUrls?: string[]) => void;
  onStop?: () => void;
  isStreaming: boolean;
}

/** Isolated input area — owns its own state so typing doesn't re-render the whole chat. */
export function ChatInputArea({ onSend, onStop, isStreaming }: ChatInputAreaProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<{ file: File; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const toAdd: { file: File; url: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) continue;
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) continue;
      toAdd.push({ file, url: URL.createObjectURL(file) });
    }
    if (toAdd.length) setAttachments((prev) => [...prev, ...toAdd]);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const next = prev.filter((_, i) => i !== index);
      URL.revokeObjectURL(prev[index].url);
      return next;
    });
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.files;
      if (items?.length) {
        addFiles(items);
        e.preventDefault();
      }
    },
    [addFiles]
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isStreaming) return;
    const files = attachments.length ? attachments.map((a) => a.file) : undefined;
    const previewUrls = attachments.length ? attachments.map((a) => a.url) : undefined;
    onSend(text, files, previewUrls);
    setInput("");
    // Delay revoke so parent can render pending message with preview URLs
    const urlsToRevoke = [...attachments.map((a) => a.url)];
    setAttachments([]);
    setTimeout(() => urlsToRevoke.forEach((u) => URL.revokeObjectURL(u)), 500);
  }, [input, attachments, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isStreaming;

  return (
    <div className="shrink-0 border-t border-border p-4">
      <div className="relative mx-auto max-w-5xl">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div
                key={i}
                className="relative inline-block h-16 w-16 overflow-hidden rounded-md border border-border"
              >
                <img
                  src={a.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-muted/90 p-0.5 hover:bg-muted"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Textarea
          placeholder="Send a message… (Enter to send, Shift+Enter for new line, paste image to attach)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isStreaming}
          className="min-h-[60px] resize-none pr-20 pb-3 font-mono text-sm"
          rows={3}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files ?? null);
            e.target.value = "";
          }}
        />
        <div className="absolute bottom-2 right-2 flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="h-8 w-8 rounded-full"
            aria-label="Attach image"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            onClick={isStreaming ? onStop : handleSend}
            disabled={!canSend && !isStreaming}
            className="h-8 w-8 rounded-full"
            aria-label={isStreaming ? "Stop" : "Send message"}
          >
            {isStreaming ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
