#!/usr/bin/env node
/**
 * Mock Cursor agent for integration tests.
 * Simulates NDJSON output: system, user echo, tool_call, assistant, result.
 * Use via CURSOR_CLI_PATH="node apps/api/scripts/mock-cursor-agent.js"
 *
 * Supports:
 *   --workspace <path>
 *   --resume <sessionId> — when provided, uses that session; otherwise generates new one
 *
 * Reads user message from stdin, outputs NDJSON to stdout.
 */
function ndjson(obj) {
  return JSON.stringify(obj) + "\n";
}

function main() {
  const args = process.argv.slice(2);
  let workspace = "/tmp";
  let resumeSessionId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--workspace" && args[i + 1]) workspace = args[++i];
    else if (args[i] === "--resume" && args[i + 1]) resumeSessionId = args[++i];
  }
  // When used as CURSOR_CLI_PATH (replacing "cursor"), we get: node mock.js agent --print ...
  // When used as agent binary (CURSOR_CLI_PATH ends with "agent"), we get: node mock.js --print ...

  const sessionId = resumeSessionId || `mock-session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let input = "";

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });
  process.stdin.on("end", () => {
    const userPrompt = input.trim() || "(empty)";

    // 1. System init with session_id
    process.stdout.write(ndjson({ type: "system", subtype: "init", session_id: sessionId }));

    // 2. User echo (should NOT be streamed to chat — would mix user prompt into assistant)
    process.stdout.write(
      ndjson({
        type: "user",
        message: { content: [{ type: "text", text: userPrompt }] },
        session_id: sessionId,
      })
    );

    // 3. Thinking (activity — emitted for UI, not streamed as content)
    process.stdout.write(
      ndjson({
        type: "thinking",
        message: { content: [{ type: "text", text: "Considering the request..." }] },
        session_id: sessionId,
      })
    );

    // 4. Tool call (activity — emitted for UI, not streamed as content)
    process.stdout.write(
      ndjson({
        type: "tool_call",
        message: {
          content: [{ type: "text", text: "[Tool: read_file path=/tmp/foo.ts]" }],
        },
        session_id: sessionId,
      })
    );

    // 5. First assistant text chunk
    const part1 = `[ASSISTANT_REPLY] First part. `;
    process.stdout.write(
      ndjson({
        type: "assistant",
        message: { content: [{ type: "text", text: part1 }] },
        session_id: sessionId,
      })
    );

    // 6. Another tool call (interleaved)
    process.stdout.write(
      ndjson({
        type: "tool_call",
        message: {
          content: [{ type: "text", text: "[Tool: search path=/tmp]" }],
        },
        session_id: sessionId,
      })
    );

    // 7. Second assistant text chunk
    const part2 = `Second part. Response to your message.`;
    process.stdout.write(
      ndjson({
        type: "assistant",
        message: { content: [{ type: "text", text: part2 }] },
        session_id: sessionId,
      })
    );

    // 8. Final result (do NOT stream — duplicates assistant content; use only for done/session_id)
    process.stdout.write(
      ndjson({ type: "result", result: part1 + part2, session_id: sessionId })
    );

    process.exit(0);
  });
}

main();
