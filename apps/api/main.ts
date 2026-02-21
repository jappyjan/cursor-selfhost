import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, ".env") });

// Pin database to absolute path so dev/restart/nohup all use the same file
const projectRoot = path.resolve(__dirname, "..", "..");
if (!process.env.DATABASE_PATH || process.env.DATABASE_PATH === ":memory:") {
  const dbDir = path.join(projectRoot, "packages", "db", "data");
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dbDir, "cursor-selfhost.sqlite");
}

async function main() {
  // Run migrations before loading app so schema is ready
  const { runMigrations, ensureAppConfigDefaults } = await import("@cursor-selfhost/db");
  runMigrations();
  await ensureAppConfigDefaults();

  const { app } = await import("./app");
  const port = parseInt(process.env.PORT ?? "3001", 10);

  const { createAdaptorServer } = await import("@hono/node-server");
  const server = createAdaptorServer({ fetch: app.fetch });

  await new Promise<void>((resolve, reject) => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Kill the other process or set PORT=...`);
      }
      reject(err);
    });
    server.listen(port, () => resolve());
  }).catch((err) => {
    console.error("Failed to start API server:", err);
    process.exit(1);
  });

  console.log(`API listening on http://localhost:${port}`);
}

main();
