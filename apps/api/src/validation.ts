import { z } from "zod";
import path from "path";

/** Slug: lowercase alphanumeric and hyphens, no path separators */
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

/** Git URL: https://, http://, or git@ (SSH) */
export const GIT_URL_REGEX = /^(https?:\/\/[^\s]+|git@[^\s]+)$/;

export const createProjectSchema = z
  .object({
    sourceType: z.enum(["local", "git"]),
    path: z.string().optional(),
    gitUrl: z.string().optional(),
    gitBranch: z.string().max(200).optional(),
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(100).regex(SLUG_REGEX, "Slug must be lowercase alphanumeric with hyphens only"),
  })
  .refine((d) => (d.sourceType === "git" ? !!d.gitUrl?.trim() : !!d.path?.trim()), {
    message: "path or gitUrl required",
    path: ["path", "gitUrl"],
  });

/** Check if resolvedPath is under basePath (use with realpathSync results for symlink safety) */
export function isPathUnderBase(resolvedPath: string, baseResolved: string): boolean {
  const rel = path.relative(baseResolved, resolvedPath);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function isValidGitUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes(" ") || trimmed.includes("\n") || trimmed.startsWith("-")) return false;
  return GIT_URL_REGEX.test(trimmed);
}

/** MCP server config for create/update */
export const mcpServerSchema = z.object({
  name: z.string().min(1).max(100),
  command: z.string().min(1).max(500),
  args: z.array(z.string()).max(50),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
});
