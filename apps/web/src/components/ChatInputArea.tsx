import { useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowUp, Loader2 } from "lucide-react";

interface ChatInputAreaProps {
  onSend: (content: string) => void;
  isStreaming: boolean;
}

/** Isolated input area — owns its own state so typing doesn't re-render the whole chat. */
export function ChatInputArea({ onSend, isStreaming }: ChatInputAreaProps) {
  const [input, setInput] = useState("");

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setInput("");
  }, [input, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="shrink-0 border-t border-border p-4">
      <div className="relative mx-auto max-w-5xl">
        <Textarea
          placeholder="Send a message… (Enter to send, Shift+Enter for new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          className="min-h-[60px] resize-none pr-12 pb-3 font-mono text-sm"
          rows={3}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
          aria-label={isStreaming ? "Sending…" : "Send message"}
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
