import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FolderPicker } from "@/components/FolderPicker";
import { fetchConfig } from "@/lib/api";

async function putConfig(projectsBasePath: string) {
  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectsBasePath }),
  });
  if (!res.ok) throw new Error("Failed to save config");
  return res.json();
}

export function Setup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });
  const [path, setPath] = useState("");

  useEffect(() => {
    if (config && path === "") {
      const defaultPath =
        config.projectsBasePath ||
        import.meta.env.VITE_PROJECTS_BASE_PATH ||
        config.suggestedRootPath ||
        config.suggestedBasePath ||
        "";
      setPath(defaultPath);
    }
  }, [config, path]);

  const mutation = useMutation({
    mutationFn: putConfig,
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["config"] });
      navigate("/", { replace: true });
    },
  });

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h2 className="font-mono text-2xl font-semibold">Setup</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse to select or create the base directory for your projects. All
            local and git-cloned projects will live under this path.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (path.trim()) mutation.mutate(path.trim());
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium">Base path</label>
            <FolderPicker
              value={path}
              onChange={setPath}
              rootPath={config?.suggestedRootPath}
              pickerOnly
              setupMode
            />
          </div>
          <Button type="submit" disabled={mutation.isPending || !path.trim()}>
            {mutation.isPending ? "Saving…" : "Save and continue"}
          </Button>
          {mutation.isError && (
            <p className="text-sm text-destructive">
              {(mutation.error as Error).message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
