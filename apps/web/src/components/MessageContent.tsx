import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

export const MessageContent = memo(function MessageContent({ content, className, isStreaming }: MessageContentProps) {
  const hasTrailingNewlines = isStreaming && content.length > 0 && /\n+$/.test(content);
  const trimmed = isStreaming ? trimAgentContentStreaming(content) : trimAgentContent(content);
  const parts = parseContent(trimmed);

  return (
    <div className={className}>
      {parts.map((part, i) =>
        part.type === "text" ? (
          <div key={i} className="markdown-content break-words text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="my-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="my-2 list-disc pl-6 [&>li]:my-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="my-2 list-decimal pl-6 [&>li]:my-0.5">{children}</ol>,
                li: ({ children }) => <li className="break-words">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ className, children }) =>
                  className ? (
                    <code className={className}>{children}</code>
                  ) : (
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
                  ),
                pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-sm">{children}</pre>,
                blockquote: ({ children }) => (
                  <blockquote className="my-2 border-l-2 border-muted-foreground/30 pl-4 text-muted-foreground">
                    {children}
                  </blockquote>
                ),
                h1: ({ children }) => <h1 className="mt-4 mb-2 text-lg font-semibold">{children}</h1>,
                h2: ({ children }) => <h2 className="mt-3 mb-1.5 text-base font-semibold">{children}</h2>,
                h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-semibold">{children}</h3>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                    {children}
                  </a>
                ),
                hr: () => <hr className="my-3 border-border" />,
                table: ({ children }) => (
                  <div className="my-2 overflow-x-auto">
                    <table className="min-w-full border-collapse border border-border">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border bg-muted/50 px-3 py-1.5 text-left font-medium">{children}</th>
                ),
                td: ({ children }) => <td className="border border-border px-3 py-1.5">{children}</td>,
              }}
            >
              {part.content}
            </ReactMarkdown>
            {i === parts.length - 1 && hasTrailingNewlines && (
              <span className="inline-flex items-center">
                {" "}
                <TypingIndicator />
              </span>
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
});
