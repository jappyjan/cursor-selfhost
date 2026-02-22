#!/usr/bin/env node
/**
 * Dump raw Cursor CLI NDJSON output to a file for debugging tool call format.
 * Run: node apps/api/scripts/dump-cursor-cli-output.js [output.jsonl]
 *
 * Requires: cursor agent login, real Cursor CLI (unset CURSOR_CLI_PATH)
 * Creates a temp project, sends a prompt that triggers file edits, captures all NDJSON.
 */
import { spawn } from "child_process";
import { mkdtempSync, createWriteStream } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const outputPath = process.argv[2] || "cursor-cli-dump.jsonl";
const workspace = mkdtempSync(join(tmpdir(), "cursor-dump-"));

const prompt = `Create a file named DIAGNOSTIC_TEST.txt in this directory with the exact content "original". Then change the word "original" to "modified" in that file. Reply with "Done" when finished.`;

console.error("Workspace:", workspace);
console.error("Prompt:", prompt);
console.error("Output:", outputPath);

const proc = spawn("cursor", ["agent", "--print", "--output-format", "stream-json", "--workspace", workspace, "--trust", "--force"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env },
  cwd: workspace,
});

const out = createWriteStream(outputPath, { flags: "w" });
let lineCount = 0;
let toolCallCount = 0;

proc.stdin.write(prompt, "utf-8");
proc.stdin.end();

proc.stdout.on("data", (chunk) => {
  const text = chunk.toString("utf-8");
  const lines = text.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    out.write(line + "\n");
    lineCount++;
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === "tool_call" || parsed.type === "tool_result") {
        toolCallCount++;
        console.error(`\n--- ${parsed.type} #${toolCallCount} ---`);
        console.error(JSON.stringify(parsed, null, 2));
      }
    } catch {
      // skip
    }
  }
});

proc.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

proc.on("close", (code) => {
  out.end();
  console.error(`\nWrote ${lineCount} lines to ${outputPath}`);
  console.error(`Found ${toolCallCount} tool_call/tool_result events`);
  console.error("Exit code:", code);
});
