import { CodeBlock } from "./CodeBlock";

interface Part {
  type: "text" | "code";
  content: string;
  lang?: string;
}

const MAX_CONTENT_LENGTH = 1_000_000;

/** Collapse 3+ newlines to 2; trim trailing newlines. */
export function trimAgentContent(content: string): string {
  return content.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "");
}

/** When streaming: collapse 2+ newlines to 1, trim trailing. Use trailing newlines as typing signal only. */
function trimAgentContentStreaming(content: string): string {
  return content.replace(/\n{2,}/g, "\n").replace(/\n+$/, "");
}

/** Pulsing dots indicator for typing/thinking state. */
export function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground" aria-label="AI is typing">
      <span className="animate-pulse" style={{ animationDelay: "0ms" }}>.</span>
      <span className="animate-pulse" style={{ animationDelay: "200ms" }}>.</span>
      <span className="animate-pulse" style={{ animationDelay: "400ms" }}>.</span>
    </span>
  );
}

function parseContent(content: string): Part[] {
  if (content.length > MAX_CONTENT_LENGTH) {
    return [{ type: "text", content }];
  }
  const parts: Part[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, m.index) });
    }
    parts.push({
      type: "code",
      content: m[2].trimEnd(),
      lang: m[1] || "text",
    });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }
  return parts.length ? parts : [{ type: "text", content }];
}

interface MessageContentProps {
  content: string;
  className?: string;
  /** When true and content ends with newlines, show typing indicator instead of blank lines */
  isStreaming?: boolean;
}

export function MessageContent({ content, className, isStreaming }: MessageContentProps) {
  const hasTrailingNewlines = isStreaming && content.length > 0 && /\n+$/.test(content);
  const trimmed = isStreaming ? trimAgentContentStreaming(content) : trimAgentContent(content);
  const parts = parseContent(trimmed);

  return (
    <div className={className}>
      {parts.map((part, i) =>
        part.type === "text" ? (
          <div
            key={i}
            className="whitespace-pre-wrap break-words font-mono text-sm [&_p]:my-2"
          >
            {part.content}
            {i === parts.length - 1 && hasTrailingNewlines && (
              <>
                {" "}
                <TypingIndicator />
              </>
            )}
          </div>
        ) : (
          <CodeBlock
            key={i}
            code={part.content}
            language={part.lang}
            className="my-3"
          />
        )
      )}
    </div>
  );
}
