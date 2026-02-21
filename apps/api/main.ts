import { app } from "./app";
import { runMigrations, ensureAppConfigDefaults } from "@cursor-selfhost/db";

async function main() {
  runMigrations();
  await ensureAppConfigDefaults();
  const port = parseInt(process.env.PORT ?? "3001", 10);
  console.log(`API listening on http://localhost:${port}`);

  if (typeof Bun !== "undefined") {
    Bun.serve({ fetch: app.fetch, port });
  } else {
    const { serve } = await import("@hono/node-server");
    serve({ fetch: app.fetch, port });
  }
}

main();
