import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderPicker } from "@/components/FolderPicker";
import {
  createProject,
  createChat,
  fetchProjects,
  fetchConfig,
  type CreateProjectBody,
} from "@/lib/api";
import { Folder, GitBranch, Loader2, ArrowLeft, ArrowRight } from "lucide-react";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function nameFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "project";
}

function nameFromGitUrl(url: string): string {
  try {
    const match = url.match(/\/([^/]+?)(?:\.git)?$/);
    return match ? match[1] : "project";
  } catch {
    return "project";
  }
}

export function CreateProject() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState<"local" | "git">("local");
  const [path, setPath] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const { data: config } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const existingSlugs = useMemo(() => new Set(projects.map((p) => p.slug)), [projects]);

  const suggestedName = sourceType === "local" ? nameFromPath(path) : nameFromGitUrl(gitUrl);
  const suggestedSlug = slugify(suggestedName || "project");
  const finalSlug = slug || suggestedSlug;
  const slugWithSuffix = existingSlugs.has(finalSlug)
    ? `${finalSlug}-${Date.now().toString(36).slice(-4)}`
    : finalSlug;

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: CreateProjectBody = {
        sourceType,
        name: name || suggestedName || "Project",
        slug: slugify(slugWithSuffix) || "project",
      };
      if (sourceType === "local") {
        if (!path.trim()) throw new Error("Please select or enter a folder path");
        body.path = path.trim();
      } else {
        if (!gitUrl.trim()) throw new Error("Please enter a Git repository URL");
        body.gitUrl = gitUrl.trim();
        if (gitBranch.trim()) body.gitBranch = gitBranch.trim();
      }
      return createProject(body);
    },
    onSuccess: async (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      const chat = await createChat(project.id);
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      navigate(`/p/${project.slug}/c/${chat.id}`, { replace: true });
    },
  });

  const canProceedStep1 = sourceType !== null;
  const canProceedStep2Local = path.trim().length > 0;
  const canProceedStep2Git = gitUrl.trim().length > 0;
  const canProceedStep2 = sourceType === "local" ? canProceedStep2Local : canProceedStep2Git;

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-8">
        <div>
          <h2 className="font-mono text-2xl font-semibold">Create project</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Step {step} of 3 — {step === 1 ? "Choose source" : step === 2 ? "Configure" : "Name"}
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create from a local folder or clone from Git.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSourceType("local")}
                className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-colors ${
                  sourceType === "local"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                }`}
              >
                <Folder className="h-10 w-10 text-muted-foreground" />
                <span className="font-medium">Local folder</span>
                <span className="text-center text-xs text-muted-foreground">
                  Use an existing directory on disk
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType("git")}
                className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-colors ${
                  sourceType === "git"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                }`}
              >
                <GitBranch className="h-10 w-10 text-muted-foreground" />
                <span className="font-medium">Git clone</span>
                <span className="text-center text-xs text-muted-foreground">
                  Clone from a Git repository
                </span>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {sourceType === "local" ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium">Select folder</label>
                <p className="text-xs text-muted-foreground">
                  Browse within {config?.projectsBasePath ?? "base path"} or enter path manually.
                </p>
                <FolderPicker value={path} onChange={setPath} />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="git-url" className="block text-sm font-medium">
                    Git repository URL
                  </label>
                  <Input
                    id="git-url"
                    type="url"
                    placeholder="https://github.com/user/repo.git or git@github.com:user/repo.git"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    className="mt-1.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="git-branch" className="block text-sm font-medium">
                    Branch (optional)
                  </label>
                  <Input
                    id="git-branch"
                    type="text"
                    placeholder="main"
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                    className="mt-1.5 font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Cloning may take a moment. Progress will be shown when you create.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium">
                Project name
              </label>
              <Input
                id="name"
                type="text"
                placeholder={suggestedName}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <label htmlFor="slug" className="block text-sm font-medium">
                URL slug
              </label>
              <Input
                id="slug"
                type="text"
                placeholder={suggestedSlug}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-1.5 font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used in URLs: /p/{slugWithSuffix}
                {existingSlugs.has(finalSlug) && " (suffix added for uniqueness)"}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
            disabled={createMutation.isPending}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2)
              }
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {sourceType === "git" ? "Cloning…" : "Creating…"}
                </>
              ) : (
                "Create project"
              )}
            </Button>
          )}
        </div>

        {createMutation.isError && (
          <p className="text-sm text-destructive">
            {(createMutation.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}
