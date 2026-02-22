import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchProjectBySlug,
  fetchMcpServers,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  type McpServer,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Settings, Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";

export function ProjectSettings() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<McpServer | null>(null);

  const { data: project, error } = useQuery({
    queryKey: ["project", slug],
    queryFn: () => fetchProjectBySlug(slug!),
    enabled: !!slug,
  });
  const { data: servers = [] } = useQuery({
    queryKey: ["mcp-servers", project?.id],
    queryFn: () => fetchMcpServers(project!.id),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; command: string; args: string[]; env?: Record<string, string> }) =>
      createMcpServer(project!.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers", project?.id] });
      setAddOpen(false);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      serverId,
      body,
    }: {
      serverId: string;
      body: { name?: string; command?: string; args?: string[]; env?: Record<string, string>; enabled?: boolean };
    }) => updateMcpServer(project!.id, serverId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers", project?.id] });
      setEditing(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (serverId: string) => deleteMcpServer(project!.id, serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers", project?.id] });
      setDeleteTarget(null);
    },
  });

  if (error || !project) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">
          {(error as Error)?.message ?? "Project not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to={`/p/${slug}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <div className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 font-mono text-xl font-semibold">
            <Settings className="h-5 w-5" />
            Project settings
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure MCP (Model Context Protocol) servers for this project. They will be available when chatting.
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">MCP servers</h3>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add server
            </Button>
          </div>
          {servers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              No MCP servers configured. Add one to extend the agent with tools like filesystem access, web search, or custom integrations.
            </div>
          ) : (
            <ul className="space-y-2">
              {servers.map((s) => (
                <McpServerRow
                  key={s.id}
                  server={s}
                  onEdit={() => setEditing(s)}
                  onDelete={() => setDeleteTarget(s)}
                  onToggleEnabled={(enabled) =>
                    updateMutation.mutate({ serverId: s.id, body: { enabled } })
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <McpServerForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={(body) => createMutation.mutate(body)}
        isPending={createMutation.isPending}
        error={createMutation.error}
      />
      {editing && (
        <McpServerForm
          open={!!editing}
          onClose={() => setEditing(null)}
          server={editing}
          onSubmit={(body) =>
            updateMutation.mutate({
              serverId: editing.id,
              body: { name: body.name, command: body.command, args: body.args, env: body.env },
            })
          }
          isPending={updateMutation.isPending}
          error={updateMutation.error}
        />
      )}
      {deleteTarget && (
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove MCP server</AlertDialogTitle>
              <AlertDialogDescription>
                Remove &quot;{deleteTarget.name}&quot;? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                Remove
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function McpServerRow({
  server,
  onEdit,
  onDelete,
  onToggleEnabled,
}: {
  server: McpServer;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}) {
  let args: string[] = [];
  try {
    args = JSON.parse(server.args) as string[];
  } catch {
    /* ignore */
  }
  const cmdDisplay = [server.command, ...args].join(" ");

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{server.name}</span>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={server.enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-xs text-muted-foreground">Enabled</span>
          </label>
        </div>
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{cmdDisplay}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </li>
  );
}

function McpServerForm({
  open,
  onClose,
  server,
  onSubmit,
  isPending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  server?: McpServer;
  onSubmit: (body: { name: string; command: string; args: string[]; env?: Record<string, string> }) => void;
  isPending: boolean;
  error: Error | null;
}) {
  const [name, setName] = useState(server?.name ?? "");
  const [command, setCommand] = useState(server?.command ?? "npx");
  const [argsStr, setArgsStr] = useState(
    server?.args ? JSON.stringify(JSON.parse(server.args) as string[], null, 0) : '["-y", "@modelcontextprotocol/server-filesystem"]'
  );
  const [envStr, setEnvStr] = useState(() => {
    if (!server?.env) return "";
    try {
      const env = JSON.parse(server.env) as Record<string, string>;
      return Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
    } catch {
      return "";
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let args: string[] = [];
    if (argsStr.trim()) {
      try {
        args = JSON.parse(argsStr) as string[];
        if (!Array.isArray(args)) args = [];
      } catch {
        args = argsStr.trim().split(/\s+/);
      }
    }
    let env: Record<string, string> | undefined;
    if (envStr.trim()) {
      env = {};
      for (const line of envStr.split("\n")) {
        const eqIdx = line.indexOf("=");
        if (eqIdx > 0) {
          env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
        }
      }
      if (Object.keys(env).length === 0) env = undefined;
    }
    onSubmit({ name: name.trim(), command: command.trim(), args, env });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{server ? "Edit MCP server" : "Add MCP server"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. filesystem"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Command</label>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g. npx or node"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Arguments (JSON array)</label>
            <Input
              value={argsStr}
              onChange={(e) => setArgsStr(e.target.value)}
              placeholder='["-y", "@modelcontextprotocol/server-filesystem", "/path"]'
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Environment (one KEY=value per line, for API keys)</label>
            <textarea
              value={envStr}
              onChange={(e) => setEnvStr(e.target.value)}
              placeholder={"API_KEY=xxx\nANOTHER_SECRET=yyy"}
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : server ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
