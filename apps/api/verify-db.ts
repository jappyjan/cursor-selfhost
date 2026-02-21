/**
 * Task 1.4: Verify Deno + Drizzle + libsql compatibility.
 * Run: deno run --allow-env --allow-read --allow-write apps/api/verify-db.ts
 *
 * If this fails, we fall back to Node + better-sqlite3 for the API.
 */

import { createClient } from "npm:@libsql/client@^0.14.0";
import { drizzle } from "npm:drizzle-orm@^0.38.3/libsql";

async function verify() {
  const dbPath = Deno.env.get("DATABASE_PATH") ?? "./data/test-verify.sqlite";
  const url = dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`;

  console.log("Verifying Deno + Drizzle + libsql...");
  console.log("Database URL:", url);

  try {
    const client = createClient({ url });
    const db = drizzle(client);

    // Simple query to verify connection
    const result = await db.execute("SELECT 1 as ok");
    console.log("Query result:", result);

    if (result.rows && result.rows.length > 0) {
      console.log("✅ Deno + Drizzle + libsql: VERIFIED");
      return true;
    }
  } catch (err) {
    console.error("❌ Verification failed:", err);
    return false;
  }

  console.log("❌ Unexpected result");
  return false;
}

verify();
