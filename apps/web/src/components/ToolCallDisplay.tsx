import { memo } from "react";
import { cn } from "@/lib/utils";
import { DiffHighlight, UnifiedDiffHighlight, langFromPath } from "@/components/DiffHighlight";
import { CodeBlock } from "@/components/CodeBlock";

interface ToolCallDisplayProps {
  label: string;
  details?: string;
  toolName?: string;
  args?: Record<string, string>;
  output?: string;
  projectPath?: string;
  children?: React.ReactNode;
}

/** Show relative path if file is under project, else full path. */
function formatPathForDisplay(absolutePath: string, projectPath?: string): string {
  if (!absolutePath) return "—";
  if (!projectPath) return absolutePath;
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");
  const fileNorm = norm(absolutePath);
  const projNorm = norm(projectPath);
  if (fileNorm === projNorm || fileNorm.startsWith(projNorm + "/")) {
    return fileNorm.slice(projNorm.length).replace(/^\//, "") || absolutePath;
  }
  return absolutePath;
}

/** Parse unified diff format for apply_patch (e.g. -old line, +new line). */
function parseUnifiedDiff(patch: string): { removed: string[]; added: string[]; raw: string } {
  const removed: string[] = [];
  const added: string[] = [];
  const lines: string[] = [];
  for (const line of patch.split("\n")) {
    if (line.startsWith("-") && !line.startsWith("---")) {
      removed.push(line.slice(1));
      lines.push(line);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      added.push(line.slice(1));
      lines.push(line);
    } else {
      lines.push(line);
    }
  }
  return { removed, added, raw: lines.join("\n") };
}

/** Render diff view for edit tools with GitHub-style syntax highlighting. */
function EditToolDiffView({
  toolName,
  args,
  displayPath,
}: {
  toolName: string;
  args: Record<string, string>;
  displayPath: string;
}) {
  const maxPreviewLines = 50;

  if (toolName === "search_replace") {
    const oldStr = args.old_string ?? "";
    const newStr = args.new_string ?? "";
    return (
      <div className="flex flex-col gap-2">
        <div className="font-mono text-xs font-medium text-muted-foreground">{displayPath}</div>
        <DiffHighlight oldCode={oldStr} newCode={newStr} path={displayPath} />
      </div>
    );
  }

  if (toolName === "edit") {
    const diff = args.diff ?? "";
    const streamContent = args.streamContent ?? "";
    const path = args.path ?? args.file_path ?? "";
    if (diff && (diff.includes("\n-") || diff.includes("\n+"))) {
      return (
        <div className="flex flex-col gap-2">
          <div className="font-mono text-xs font-medium text-muted-foreground">{displayPath}</div>
          <UnifiedDiffHighlight diff={diff} path={path} />
        </div>
      );
    }
    const content = streamContent || diff;
    const lines = content.split("\n").slice(0, maxPreviewLines);
    const hasMore = content.split("\n").length > maxPreviewLines;
    return (
      <div className="flex flex-col gap-2">
        <div className="font-mono text-xs font-medium text-muted-foreground">{displayPath}</div>
        <CodeBlock code={lines.length ? lines.join("\n") + (hasMore ? "\n…" : "") : "(no content)"} language={path ? langFromPath(path) : "text"} />
      </div>
    );
  }

  if (toolName === "write") {
    const content = args.content ?? "";
    return (
      <div className="flex flex-col gap-1">
        <div className="font-mono text-xs font-medium text-muted-foreground">{displayPath}</div>
        {content && (
          <CodeBlock
            code={content.length > 3000 ? content.slice(0, 3000) + "\n…" : content}
            language={langFromPath(displayPath)}
          />
        )}
      </div>
    );
  }

  if (toolName === "apply_patch") {
    const patch = args.patch ?? "";
    const path = args.path ?? args.file_path ?? "";
    const { removed, added, raw } = parseUnifiedDiff(patch);
    if (removed.length > 0 || added.length > 0) {
      return (
        <div className="flex flex-col gap-2">
          <div className="font-mono text-xs font-medium text-muted-foreground">{displayPath}</div>
          <DiffHighlight
            oldCode={removed.join("\n")}
            newCode={added.join("\n")}
            path={path}
          />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <div className="font-mono text-xs font-medium text-muted-foreground">{displayPath}</div>
        <UnifiedDiffHighlight diff={raw || "(no patch)"} path={path} />
      </div>
    );
  }

  return null;
}

/** Terminal-style display for run_terminal_cmd: prompt line + scrollable output. */
function TerminalView({
  command,
  workingDirectory,
  output,
}: {
  command: string;
  workingDirectory?: string;
  output?: string;
}) {
  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-md border border-[#2d2d2d] bg-[#1a1a1a] shadow-inner">
      {/* Terminal header bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[#2d2d2d] bg-[#252525] px-3 py-1.5">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        </span>
        <span className="font-mono text-[10px] text-[#8b8b8b]">terminal</span>
      </div>
      {/* Terminal body: prompt + output */}
      <div className="min-h-[4rem] max-h-64 flex-1 overflow-y-auto overflow-x-auto p-3 font-mono text-xs">
        {/* Input / command line */}
        <div className="flex items-start gap-1">
          <span className="shrink-0 text-emerald-400/90">$</span>
          {workingDirectory && (
            <span className="shrink-0 text-amber-500/90">({workingDirectory})</span>
          )}
          <span className="text-[#e0e0e0] break-all">{command || "(no command)"}</span>
        </div>
        {/* Output */}
        {output !== undefined && output !== "" && (
          <pre className="mt-2 whitespace-pre-wrap break-words text-[#c0c0c0]">{output}</pre>
        )}
        {output === "" && <div className="mt-1 text-[#6b6b6b]">(no output)</div>}
        {output === undefined && <div className="mt-1 text-[#6b6b6b] animate-pulse">Running…</div>}
      </div>
    </div>
  );
}

export const ToolCallDisplay = memo(function ToolCallDisplay({ label, details, toolName, args, output, projectPath, children }: ToolCallDisplayProps) {
  const hasEditDiff = toolName && args && ["search_replace", "edit", "write", "apply_patch"].includes(toolName);
  const hasTerminal = toolName === "run_terminal_cmd" && args;
  const rawPath = args?.path ?? args?.file_path;
  const displayPath = formatPathForDisplay(rawPath ?? "", projectPath);

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border border-border bg-muted/20",
        "flex flex-col"
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {rawPath && !hasEditDiff && !hasTerminal && (
          <span className="truncate font-mono text-[11px] text-muted-foreground/80" title={rawPath}>
            {displayPath}
          </span>
        )}
        {details && !hasEditDiff && !hasTerminal && (
          <span className="truncate text-[11px] text-muted-foreground/60" title={details}>
            {details}
          </span>
        )}
      </div>
      {hasEditDiff && (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto px-3 py-2">
          <EditToolDiffView
            toolName={toolName}
            args={args}
            displayPath={formatPathForDisplay(args.path ?? args.file_path ?? "", projectPath)}
          />
        </div>
      )}
      {hasTerminal && (
        <div className="min-h-0 flex-1 overflow-hidden px-3 py-2">
          <TerminalView
            command={args.command ?? ""}
            workingDirectory={args.workingDirectory || undefined}
            output={output}
          />
        </div>
      )}
      {children}
    </div>
  );
});
