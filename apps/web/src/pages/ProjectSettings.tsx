import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchProjectBySlug,
  fetchMcpServers,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  loginMcpServer,
  type McpServer,
  type McpServerConfig,
  type CreateMcpServerBody,
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
import { Settings, Plus, Pencil, Trash2, ArrowLeft, KeyRound, Terminal, Globe, Monitor } from "lucide-react";

export function ProjectSettings() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<McpServer | null>(null);
  const [loginTarget, setLoginTarget] = useState<McpServer | null>(null);

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
    mutationFn: (body: CreateMcpServerBody) => createMcpServer(project!.id, body),
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
      body: { name?: string; config?: McpServerConfig; command?: string; args?: string[]; env?: Record<string, string>; enabled?: boolean };
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
  const loginMutation = useMutation({
    mutationFn: ({ serverId, callbackUrl }: { serverId: string; callbackUrl?: string }) =>
      loginMcpServer(project!.id, serverId, callbackUrl),
    onSuccess: (data) => {
      if (data.ok) setLoginTarget(null);
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
                  onAuthenticate={() => setLoginTarget(s)}
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
              body:
                "config" in body && body.config
                  ? { name: body.name, config: body.config }
                  : {
                      name: body.name,
                      command: (body as { command: string }).command,
                      args: (body as { args?: string[] }).args,
                      env: (body as { env?: Record<string, string> }).env,
                    },
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
      {loginTarget && (
        <McpLoginDialog
          server={loginTarget}
          onClose={() => setLoginTarget(null)}
          onLogin={(callbackUrl) =>
            loginMutation.mutate({ serverId: loginTarget.id, callbackUrl })
          }
          isPending={loginMutation.isPending}
          result={loginMutation.data}
          error={loginMutation.error}
        />
      )}
    </div>
  );
}

function getServerDisplayInfo(server: McpServer): { type: "stdio" | "url" | "desktop"; label: string } {
  if (server.config) {
    try {
      const cfg = JSON.parse(server.config) as McpServerConfig;
      if ("url" in cfg && cfg.url) {
        return { type: "url", label: cfg.url };
      }
      if ("desktop" in cfg && cfg.desktop?.command) {
        return { type: "desktop", label: cfg.desktop.command };
      }
      if ("command" in cfg && cfg.command) {
        const args = (cfg as { args?: string[] }).args ?? [];
        return { type: "stdio", label: [cfg.command, ...args].join(" ") };
      }
    } catch {
      /* fallback */
    }
  }
  let args: string[] = [];
  try {
    args = JSON.parse(server.args) as string[];
  } catch {
    /* ignore */
  }
  return { type: "stdio", label: [server.command, ...args].join(" ") };
}

function McpServerRow({
  server,
  onEdit,
  onDelete,
  onAuthenticate,
  onToggleEnabled,
}: {
  server: McpServer;
  onEdit: () => void;
  onDelete: () => void;
  onAuthenticate: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}) {
  const { type, label } = getServerDisplayInfo(server);
  const Icon = type === "url" ? Globe : type === "desktop" ? Monitor : Terminal;
  const showAuth = type === "stdio";

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{server.name}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {type}
          </span>
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
        <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-xs text-muted-foreground">
          <Icon className="h-3 w-3 shrink-0" />
          {label}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {showAuth && (
          <Button variant="ghost" size="icon" onClick={onAuthenticate} aria-label="Authenticate">
            <KeyRound className="h-4 w-4" />
          </Button>
        )}
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

function McpLoginDialog({
  server,
  onClose,
  onLogin,
  isPending,
  result,
  error,
}: {
  server: McpServer;
  onClose: () => void;
  onLogin: (callbackUrl?: string) => void;
  isPending: boolean;
  result?: { ok: boolean; authUrl?: string; error?: string };
  error: Error | null;
}) {
  const [callbackUrl, setCallbackUrl] = useState("");
  const authUrl = result?.authUrl;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Authenticate MCP server</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Authenticate &quot;{server.name}&quot;. Some MCP servers require OAuth.
          </p>
          {authUrl && (
            <div>
              <label className="block text-sm font-medium">Open this URL to authenticate</label>
              <a
                href={authUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block truncate text-sm text-primary underline"
              >
                {authUrl}
              </a>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium">
              OAuth callback URL (paste after completing auth in browser)
            </label>
            <Input
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1"
            />
          </div>
          {result?.ok && <p className="text-sm text-green-600">Authentication successful.</p>}
          {(result?.error || error) && (
            <p className="text-sm text-destructive">{result?.error ?? (error as Error)?.message}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => onLogin(callbackUrl.trim() || undefined)}
              disabled={isPending}
            >
              {isPending ? "Authenticating…" : callbackUrl.trim() ? "Submit callback" : "Start login"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type TransportType = "stdio" | "url" | "desktop";

function parseServerToForm(server?: McpServer): {
  transport: TransportType;
  name: string;
  command: string;
  argsStr: string;
  envStr: string;
  url: string;
  headersStr: string;
  desktopCommand: string;
} {
  const defaults = {
    transport: "stdio" as TransportType,
    name: "",
    command: "npx",
    argsStr: '["-y", "@modelcontextprotocol/server-filesystem"]',
    envStr: "",
    url: "",
    headersStr: "",
    desktopCommand: "",
  };
  if (!server) return defaults;
  if (server.config) {
    try {
      const cfg = JSON.parse(server.config) as McpServerConfig;
      if ("url" in cfg && cfg.url) {
        return {
          ...defaults,
          transport: "url",
          name: server.name,
          url: cfg.url,
          headersStr: cfg.headers
            ? Object.entries(cfg.headers)
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")
            : "",
        };
      }
      if ("desktop" in cfg && cfg.desktop?.command) {
        return {
          ...defaults,
          transport: "desktop",
          name: server.name,
          desktopCommand: cfg.desktop.command,
        };
      }
      if ("command" in cfg && cfg.command) {
        const c = cfg as { command: string; args?: string[]; env?: Record<string, string> };
        return {
          ...defaults,
          transport: "stdio",
          name: server.name,
          command: c.command,
          argsStr: c.args ? JSON.stringify(c.args, null, 0) : "[]",
          envStr: c.env
            ? Object.entries(c.env)
                .map(([k, v]) => `${k}=${v}`)
                .join("\n")
            : "",
        };
      }
    } catch {
      /* fallback */
    }
  }
  let args: string[] = [];
  try {
    args = JSON.parse(server.args) as string[];
  } catch {
    /* ignore */
  }
  let envStr = "";
  if (server.env) {
    try {
      const env = JSON.parse(server.env) as Record<string, string>;
      envStr = Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
    } catch {
      /* ignore */
    }
  }
  return {
    ...defaults,
    transport: "stdio",
    name: server.name,
    command: server.command,
    argsStr: JSON.stringify(args, null, 0),
    envStr,
  };
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
  onSubmit: (body: CreateMcpServerBody) => void;
  isPending: boolean;
  error: Error | null;
}) {
  const initial = parseServerToForm(server);
  const [transport, setTransport] = useState<TransportType>(initial.transport);
  const [name, setName] = useState(initial.name);
  const [command, setCommand] = useState(initial.command);
  const [argsStr, setArgsStr] = useState(initial.argsStr);
  const [envStr, setEnvStr] = useState(initial.envStr);
  const [url, setUrl] = useState(initial.url);
  const [headersStr, setHeadersStr] = useState(initial.headersStr);
  const [desktopCommand, setDesktopCommand] = useState(initial.desktopCommand);

  useEffect(() => {
    if (open) {
      const i = parseServerToForm(server);
      setTransport(i.transport);
      setName(i.name);
      setCommand(i.command);
      setArgsStr(i.argsStr);
      setEnvStr(i.envStr);
      setUrl(i.url);
      setHeadersStr(i.headersStr);
      setDesktopCommand(i.desktopCommand);
    }
  }, [open, server]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (transport === "url") {
      const headers: Record<string, string> = {};
      if (headersStr.trim()) {
        for (const line of headersStr.split("\n")) {
          const colonIdx = line.indexOf(":");
          if (colonIdx > 0) {
            headers[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
          }
        }
      }
      onSubmit({
        name: trimmedName,
        config: { url: url.trim(), ...(Object.keys(headers).length > 0 && { headers }) },
      });
      return;
    }
    if (transport === "desktop") {
      onSubmit({
        name: trimmedName,
        config: { desktop: { command: desktopCommand.trim() } },
      });
      return;
    }
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
    onSubmit({
      name: trimmedName,
      command: command.trim(),
      args,
      env,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <label className="block text-sm font-medium">Transport</label>
            <div className="mt-1.5 flex gap-2">
              {(
                [
                  { value: "stdio" as const, label: "Command (stdio)", icon: Terminal },
                  { value: "url" as const, label: "HTTP/URL", icon: Globe },
                  { value: "desktop" as const, label: "Desktop", icon: Monitor },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTransport(value)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                    transport === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {transport === "stdio" && (
            <>
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
                <label className="block text-sm font-medium">Environment (one KEY=value per line)</label>
                <textarea
                  value={envStr}
                  onChange={(e) => setEnvStr(e.target.value)}
                  placeholder={"API_KEY=xxx\nANOTHER_SECRET=yyy"}
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
            </>
          )}

          {transport === "url" && (
            <>
              <div>
                <label className="block text-sm font-medium">URL</label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/mcp"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  HTTP/Streamable MCP endpoint. Must start with http:// or https://
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium">Headers (optional)</label>
                <textarea
                  value={headersStr}
                  onChange={(e) => setHeadersStr(e.target.value)}
                  placeholder={"Authorization: Bearer xxx\nX-Custom-Header: value"}
                  className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                />
                <p className="mt-1 text-xs text-muted-foreground">One Header: value per line</p>
              </div>
            </>
          )}

          {transport === "desktop" && (
            <div>
              <label className="block text-sm font-medium">Desktop command</label>
              <Input
                value={desktopCommand}
                onChange={(e) => setDesktopCommand(e.target.value)}
                placeholder="e.g. /path/to/cursor-desktop-app"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Command for Cursor Desktop app integration
              </p>
            </div>
          )}

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
