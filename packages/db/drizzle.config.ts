import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH
      ? `file:${process.env.DATABASE_PATH}`
      : "file:./data/cursor-selfhost.sqlite",
  },
});
