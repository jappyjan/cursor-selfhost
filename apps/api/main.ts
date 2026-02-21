import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, ".env") });

async function main() {
  const { app } = await import("./app");
  const { runMigrations, ensureAppConfigDefaults } = await import("@cursor-selfhost/db");

  runMigrations();
  await ensureAppConfigDefaults();
  const port = parseInt(process.env.PORT ?? "3001", 10);
  console.log(`API listening on http://localhost:${port}`);

  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port });
}

main();
