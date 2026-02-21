import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [path, setPath] = useState(
    import.meta.env.VITE_PROJECTS_BASE_PATH ?? ""
  );

  const mutation = useMutation({
    mutationFn: putConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      navigate("/", { replace: true });
    },
  });

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h2 className="font-mono text-2xl font-semibold">Setup</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Set the base directory for your projects. All local and git-cloned
            projects will live under this path.
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
            <label htmlFor="base-path" className="block text-sm font-medium">
              Base path
            </label>
            <Input
              id="base-path"
              type="text"
              placeholder="/home/user/projects"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="mt-1.5 font-mono"
              required
            />
          </div>
          <Button type="submit" disabled={mutation.isPending}>
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
