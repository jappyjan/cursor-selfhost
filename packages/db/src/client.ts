import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getDbPath(): string {
  const env = process.env.DATABASE_PATH;
  if (env) return env;
  const defaultPath = path.join(__dirname, "..", "data", "cursor-selfhost.sqlite");
  const dir = path.dirname(defaultPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return defaultPath;
}

const dbPath = getDbPath();
const sqlite = new Database(dbPath);
export const db = drizzle({ client: sqlite, schema });

export function runMigrations() {
  const migrationsFolder = path.join(__dirname, "..", "migrations");
  migrate(db, { migrationsFolder });
}

export async function ensureAppConfigDefaults() {
  const existing = await db
    .select()
    .from(schema.appConfig)
    .where(eq(schema.appConfig.key, "projects_base_path"));
  if (existing.length === 0) {
    const envPath = process.env.PROJECTS_BASE_PATH;
    await db.insert(schema.appConfig).values({
      key: "projects_base_path",
      value: envPath ?? "",
    });
  }
  const shortcut = await db
    .select()
    .from(schema.appConfig)
    .where(eq(schema.appConfig.key, "send_shortcut"));
  if (shortcut.length === 0) {
    await db.insert(schema.appConfig).values({
      key: "send_shortcut",
      value: "enter",
    });
  }
}
