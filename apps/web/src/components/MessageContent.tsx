import { CodeBlock } from "./CodeBlock";

interface Part {
  type: "text" | "code";
  content: string;
  lang?: string;
}

const MAX_CONTENT_LENGTH = 1_000_000;

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
}

export function MessageContent({ content, className }: MessageContentProps) {
  const parts = parseContent(content);

  return (
    <div className={className}>
      {parts.map((part, i) =>
        part.type === "text" ? (
          <div
            key={i}
            className="whitespace-pre-wrap break-words font-mono text-sm [&_p]:my-2"
          >
            {part.content}
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
