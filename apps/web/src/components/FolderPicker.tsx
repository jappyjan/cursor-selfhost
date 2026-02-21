import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, FolderOpen, ChevronRight, Loader2 } from "lucide-react";
import { fetchBrowse, fetchConfig } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FolderPickerProps {
  value: string;
  onChange: (path: string) => void;
  className?: string;
}

export function FolderPicker({ value, onChange, className }: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState(value || "");
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });
  const basePath = config?.projectsBasePath ?? "";

  const pathToBrowse = currentPath || basePath;

  const { data, isLoading, error } = useQuery({
    queryKey: ["browse", pathToBrowse],
    queryFn: () => fetchBrowse(pathToBrowse),
    enabled: !!pathToBrowse,
  });

  const entries = data?.entries ?? [];
  const pathParts = pathToBrowse.split("/").filter(Boolean);
  const breadcrumbs = pathToBrowse ? ["", ...pathParts] : [];

  const handleSelectDir = useCallback(
    (name: string) => {
      if (name === ".." || name === "." || name.includes("/") || name.includes("\\")) return;
      const newPath = pathToBrowse ? `${pathToBrowse.replace(/\/$/, "")}/${name}` : `/${name}`;
      setCurrentPath(newPath);
      onChange(newPath);
    },
    [pathToBrowse, onChange]
  );

  const handleBreadcrumb = useCallback(
    (idx: number) => {
      const newPath = idx === 0 ? basePath : "/" + pathParts.slice(0, idx).join("/");
      setCurrentPath(newPath);
      onChange(newPath);
    },
    [basePath, pathParts, onChange]
  );

  const handleUseCurrent = useCallback(() => {
    if (pathToBrowse) {
      onChange(pathToBrowse);
    }
  }, [pathToBrowse, onChange]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-1 rounded-md border border-input bg-muted/30 p-2 font-mono text-xs">
        {breadcrumbs.map((part, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleBreadcrumb(i)}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-accent"
          >
            {i === 0 ? (
              <span className="text-muted-foreground">/</span>
            ) : (
              <>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                {part}
              </>
            )}
          </button>
        ))}
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border border-input">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pathToBrowse !== basePath && (
              <li>
                <button
                  type="button"
                  onClick={() => handleBreadcrumb(0)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">.. (base)</span>
                </button>
              </li>
            )}
            {entries.map((e) => (
              <li key={e.name}>
                <button
                  type="button"
                  onClick={() => e.isDir && handleSelectDir(e.name)}
                  disabled={!e.isDir}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{e.name}</span>
                  {e.isDir && (
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/path/to/project"
          className="font-mono text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleUseCurrent}>
          Use selected
        </Button>
      </div>
    </div>
  );
}
