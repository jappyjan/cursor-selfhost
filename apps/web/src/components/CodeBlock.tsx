import { useState, useEffect } from "react";
import { codeToHtml } from "shiki";
import DOMPurify from "dompurify";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language = "text", className }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang: language,
      theme: "github-dark",
    })
      .then((result) => {
        if (!cancelled) setHtml(DOMPurify.sanitize(result, { ALLOWED_TAGS: ["pre", "code", "span", "div"], ALLOWED_ATTR: ["class", "style"] }));
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[CodeBlock] Shiki highlight failed:", err);
          setHtml(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (html === null) {
    return (
      <pre className={cn("overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm", className)}>
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div className={cn("group relative", className)}>
      <div className="flex items-center justify-between gap-2 rounded-t-lg border border-b-0 border-border bg-muted/50 px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{language}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      <div
        className="overflow-x-auto rounded-b-lg border border-border [&_pre]:!m-0 [&_pre]:!rounded-t-none [&_pre]:!p-4 [&_pre]:!text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
