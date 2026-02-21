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
