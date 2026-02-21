/**
 * Task 1.4: Verify Drizzle + libsql (Node).
 * Run: node packages/db/verify.mjs
 *
 * If libsql fails, we can switch to better-sqlite3.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

async function verify() {
  // Use in-memory DB for verification (no file I/O); file: works for real DBs
  const url = process.env.DATABASE_PATH
    ? `file:${process.env.DATABASE_PATH}`
    : "file:memory";

  console.log("Verifying Drizzle + libsql (Node)...");
  console.log("Database URL:", url);

  try {
    const client = createClient({ url });
    const db = drizzle(client);

    // Raw query via client (libsql native API)
    const result = await client.execute("SELECT 1 as ok");
    console.log("Query result:", result);

    if (result.rows && result.rows.length > 0) {
      console.log("✅ Drizzle + libsql: VERIFIED (Node)");
      process.exit(0);
    }
  } catch (err) {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  }

  console.log("❌ Unexpected result");
  process.exit(1);
}

verify();
