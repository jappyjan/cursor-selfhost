#!/usr/bin/env node
/**
 * Slow mock Cursor agent for stop/resume E2E tests.
 * Emits NDJSON incrementally with delays so the client can abort mid-stream.
 * Supports --workspace and --resume like mock-cursor-agent.js.
 */
function ndjson(obj) {
  return JSON.stringify(obj) + "\n";
}

function writeAfter(ms, fn) {
  return new Promise((r) => setTimeout(() => {
    fn();
    r();
  }, ms));
}

async function main() {
  const args = process.argv.slice(2);
  let workspace = "/tmp";
  let resumeSessionId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--workspace" && args[i + 1]) workspace = args[++i];
    else if (args[i] === "--resume" && args[i + 1]) resumeSessionId = args[++i];
  }

  const sessionId = resumeSessionId || `mock-session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let input = "";

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });

  process.stdin.on("end", async () => {
    const userPrompt = input.trim() || "(empty)";

    process.stdout.write(ndjson({ type: "system", subtype: "init", session_id: sessionId }));
    await writeAfter(50, () => {});

    process.stdout.write(
      ndjson({
        type: "user",
        message: { content: [{ type: "text", text: userPrompt }] },
        session_id: sessionId,
      })
    );
    await writeAfter(80, () => {});

    process.stdout.write(
      ndjson({
        type: "thinking",
        message: { content: [{ type: "text", text: "Considering..." }] },
        session_id: sessionId,
      })
    );
    await writeAfter(100, () => {});

    process.stdout.write(
      ndjson({
        type: "assistant",
        message: { content: [{ type: "text", text: "[PART1] " }] },
        session_id: sessionId,
      })
    );
    await writeAfter(150, () => {});

    process.stdout.write(
      ndjson({
        type: "assistant",
        message: { content: [{ type: "text", text: "[PART2] " }] },
        session_id: sessionId,
      })
    );
    await writeAfter(200, () => {});

    process.stdout.write(
      ndjson({
        type: "assistant",
        message: { content: [{ type: "text", text: "[PART3] Done." }] },
        session_id: sessionId,
      })
    );
    await writeAfter(50, () => {});

    process.stdout.write(ndjson({ type: "result", result: "[PART1] [PART2] [PART3] Done.", session_id: sessionId }));
    process.exit(0);
  });
}

main();
