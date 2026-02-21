import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, FolderOpen, ChevronRight, Loader2, FolderPlus } from "lucide-react";
import { fetchBrowse, fetchConfig, createFolder } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FolderPickerProps {
  value: string;
  onChange: (path: string) => void;
  className?: string;
  /** When provided (e.g. for Setup), used as browse root when projectsBasePath is not configured */
  rootPath?: string;
  /** When true, hide manual path input to enforce selection via picker only */
  pickerOnly?: boolean;
  /** When true (Setup), allow browsing any path on the system from filesystem root */
  setupMode?: boolean;
}

export function FolderPicker({ value, onChange, className, rootPath, pickerOnly, setupMode }: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState(value || "");
  const [newFolderName, setNewFolderName] = useState("");
  const queryClient = useQueryClient();
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });
  const basePath = setupMode
    ? (config?.filesystemRoot ?? rootPath ?? "")
    : (config?.projectsBasePath ?? rootPath ?? "");

  const pathToBrowse = currentPath || basePath;

  const { data, isLoading, error } = useQuery({
    queryKey: ["browse", pathToBrowse, setupMode],
    queryFn: () => fetchBrowse(pathToBrowse, setupMode),
    enabled: !!pathToBrowse || (setupMode && !!basePath),
  });

  const createMutation = useMutation({
    mutationFn: () => createFolder(pathToBrowse, newFolderName, setupMode),
    onSuccess: (result) => {
      setCurrentPath(result.path);
      onChange(result.path);
      setNewFolderName("");
      queryClient.invalidateQueries({ queryKey: ["browse"] });
    },
  });

  const entries = data?.entries ?? [];
  const baseNorm = basePath.replace(/\/+$/, "") || "/";
  const currentNorm = pathToBrowse.replace(/\/+$/, "") || "/";
  const relativePath =
    currentNorm === baseNorm || !currentNorm.startsWith(baseNorm + "/")
      ? ""
      : currentNorm.slice(baseNorm.length + 1);
  const relativeParts = relativePath ? relativePath.split("/").filter(Boolean) : [];
  const breadcrumbs = ["", ...relativeParts];

  const handleSelectDir = useCallback(
    (name: string) => {
      if (name === ".." || name === "." || name.includes("/") || name.includes("\\")) return;
      const newPath = currentNorm === "/" ? `/${name}` : `${currentNorm}/${name}`;
      setCurrentPath(newPath);
      onChange(newPath);
    },
    [currentNorm, onChange]
  );

  const handleBreadcrumb = useCallback(
    (idx: number) => {
      const newPath =
        idx === 0
          ? baseNorm
          : baseNorm === "/"
            ? "/" + relativeParts.slice(0, idx).join("/")
            : `${baseNorm}/${relativeParts.slice(0, idx).join("/")}`;
      setCurrentPath(newPath);
      onChange(newPath);
    },
    [baseNorm, relativeParts, onChange]
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
              <span className="text-muted-foreground" title={baseNorm}>
                {baseNorm.split("/").pop() || "base"}
              </span>
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
            {currentNorm !== baseNorm && (
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="New folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) {
                e.preventDefault();
                createMutation.mutate();
              }
            }}
            className="h-9 w-40 font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!newFolderName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <FolderPlus className="h-4 w-4" />
                Create
              </>
            )}
          </Button>
        </div>
        {createMutation.isError && (
          <span className="text-sm text-destructive">{(createMutation.error as Error).message}</span>
        )}
      </div>
      {!pickerOnly && (
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
      )}
      {pickerOnly && (
        <p className="text-xs text-muted-foreground font-mono">{value || "Select a folder above"}</p>
      )}
    </div>
  );
}
