import { useState, useEffect, memo } from "react";
import { codeToHtml } from "shiki";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

/** Infer Shiki language from file path extension. */
export function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    md: "markdown",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    html: "html",
    css: "css",
    scss: "scss",
    sql: "sql",
    sh: "shell",
    bash: "shell",
  };
  return map[ext] ?? "text";
}

interface DiffHighlightProps {
  oldCode: string;
  newCode: string;
  path: string;
  className?: string;
}

/** GitHub-style diff with syntax highlighting. Renders old (red) and new (green) with Shiki. */
export const DiffHighlight = memo(function DiffHighlight({ oldCode, newCode, path, className }: DiffHighlightProps) {
  const lang = langFromPath(path);
  const [oldHtml, setOldHtml] = useState<string | null>(null);
  const [newHtml, setNewHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      codeToHtml(oldCode || " ", { lang, theme: "github-dark" }),
      codeToHtml(newCode || " ", { lang, theme: "github-dark" }),
    ])
      .then(([o, n]) => {
        if (!cancelled) {
          setOldHtml(DOMPurify.sanitize(o, { ALLOWED_TAGS: ["pre", "code", "span", "div"], ALLOWED_ATTR: ["class", "style"] }));
          setNewHtml(DOMPurify.sanitize(n, { ALLOWED_TAGS: ["pre", "code", "span", "div"], ALLOWED_ATTR: ["class", "style"] }));
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [oldCode, newCode, lang]);

  if (error) {
    return (
      <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded border border-border", className)}>
        <div className="overflow-auto max-h-64 rounded-l border-r border-border bg-[#2d1818] p-2">
          <pre className="font-mono text-xs text-red-300 whitespace-pre-wrap">{oldCode || "(empty)"}</pre>
        </div>
        <div className="overflow-auto max-h-64 rounded-r bg-[#182d18] p-2">
          <pre className="font-mono text-xs text-green-300 whitespace-pre-wrap">{newCode || "(empty)"}</pre>
        </div>
      </div>
    );
  }

  if (oldHtml === null || newHtml === null) {
    return (
      <div className={cn("flex items-center justify-center h-24 rounded border border-border bg-muted/30", className)}>
        <span className="text-muted-foreground text-sm">Loading diff…</span>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded border border-border bg-[#0d1117]", className)}>
      <div className="overflow-auto max-h-64 min-w-0 rounded-l">
        <div
          className="bg-[#2d1818] [&_pre]:!m-0 [&_pre]:!p-3 [&_pre]:!text-xs [&_pre]:!rounded-none [&_pre]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: oldHtml }}
        />
      </div>
      <div className="overflow-auto max-h-64 min-w-0 rounded-r">
        <div
          className="bg-[#182d18] [&_pre]:!m-0 [&_pre]:!p-3 [&_pre]:!text-xs [&_pre]:!rounded-none [&_pre]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: newHtml }}
        />
      </div>
    </div>
  );
});

/** Unified diff view (single column) with Shiki diff highlighting. */
export const UnifiedDiffHighlight = memo(function UnifiedDiffHighlight({ diff, path: _path, className }: { diff: string; path?: string; className?: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    codeToHtml(diff, { lang: "diff", theme: "github-dark" })
      .then((result) => {
        if (!cancelled) {
          setHtml(DOMPurify.sanitize(result, { ALLOWED_TAGS: ["pre", "code", "span", "div"], ALLOWED_ATTR: ["class", "style"] }));
        }
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [diff]);

  if (html === null) {
    return (
      <pre className={cn("overflow-auto max-h-64 rounded border border-border bg-[#0d1117] p-3 font-mono text-xs text-[#c9d1d9]", className)}>
        {diff}
      </pre>
    );
  }

  return (
    <div
      className={cn("overflow-auto max-h-64 rounded border border-border bg-[#0d1117] [&_pre]:!m-0 [&_pre]:!p-3 [&_pre]:!text-xs", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
