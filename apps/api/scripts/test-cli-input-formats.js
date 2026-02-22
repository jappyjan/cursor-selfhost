#!/usr/bin/env node
/**
 * Test what input formats the Cursor CLI agent accepts via stdin.
 * Run: node apps/api/scripts/test-cli-input-formats.js [--auth-check-only]
 *
 * Tests:
 * 1. Plain text (baseline - known to work)
 * 2. JSON with OpenAI-style content blocks (text + image_url)
 * 3. JSON with Anthropic-style content blocks
 * 4. Prompt referencing image file path in workspace
 *
 * Uses agent binary (CURSOR_CLI_PATH=agent) or cursor command.
 */
import { spawn } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const CLI = process.env.CURSOR_CLI_PATH || "agent";
const IS_AGENT_BINARY = CLI.endsWith("agent");

function runAgent(stdinContent, workspace, options = {}) {
  const args = [
    ...(IS_AGENT_BINARY ? [] : ["agent"]),
    "--print",
    "--output-format",
    "stream-json",
    "--workspace",
    workspace,
    "--trust",
    "--force",
  ];
  if (options.resume) args.push("--resume", options.resume);

  return new Promise((resolve, reject) => {
    const proc = spawn(CLI, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
      cwd: workspace,
    });

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (c) => (stdout += c.toString()));
    proc.stderr?.on("data", (c) => (stderr += c.toString()));

    proc.stdin?.write(stdinContent, "utf-8");
    proc.stdin?.end();

    proc.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    proc.on("error", reject);
  });
}

function parseNdjsonOutput(stdout) {
  const lines = stdout.split("\n").filter((l) => l.trim());
  const parsed = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      parsed.push({ _raw: line });
    }
  }
  return parsed;
}

function getResultText(output) {
  const parsed = parseNdjsonOutput(output);
  const result = parsed.find((p) => p.type === "result" && p.result);
  if (result) return result.result;
  const assistant = parsed.filter((p) => p.type === "assistant");
  return assistant
    .map((p) => (p.message?.content || []).map((c) => c.text || "").join(""))
    .join("");
}

function hasAssistantOrResult(output) {
  const parsed = parseNdjsonOutput(output);
  return parsed.some(
    (p) => p.type === "assistant" || (p.type === "result" && p.result)
  );
}

function hasError(output) {
  const parsed = parseNdjsonOutput(output);
  return parsed.some((p) => p.type === "error" || p.error);
}

// Minimal 1x1 transparent PNG (base64)
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// 16x16 solid RED PNG - model can only identify color if it actually sees the image
const RED_16x16_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mP4z8BAEmIY1TCqYfhqAACQ+f8B8u7oVwAAAABJRU5ErkJggg==";

// 32x16 striped PNG: 4 vertical stripes (red, blue, green, yellow) - 8px each
// No hint in prompt; model must actually see the image to describe stripes/colors
const STRIPED_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAQCAIAAAD4YuoOAAAAJElEQVR42mP4z8CAFeEQ/o9TGAdiGLVg1IJRC0YtGLVgKFgAAHPFfZ8Vh6OAAAAAAElFTkSuQmCC";

async function main() {
  const authCheckOnly = process.argv.includes("--auth-check-only");
  const workspace = mkdtempSync(join(tmpdir(), "cursor-cli-test-"));

  console.log("=== Cursor CLI Input Format Tests ===\n");
  console.log("CLI:", CLI);
  console.log("Workspace:", workspace);
  console.log("");

  // Auth check
  const statusProc = spawn(
    CLI,
    IS_AGENT_BINARY ? ["status"] : ["agent", "status"],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  const statusResult = await new Promise((resolve) => {
    let out = "";
    let err = "";
    statusProc.stdout?.on("data", (c) => (out += c.toString()));
    statusProc.stderr?.on("data", (c) => (err += c.toString()));
    statusProc.on("close", (code) => resolve({ code, out, err }));
  });

  if (statusResult.code !== 0) {
    console.error("⚠ Auth check failed. Run: agent login");
    console.error("stderr:", statusResult.err || statusResult.out);
    process.exit(1);
  }
  console.log("✓ Auth OK\n");

  if (authCheckOnly) {
    console.log("--auth-check-only: skipping input format tests");
    process.exit(0);
  }

  const results = [];

  // Test 1: Plain text (baseline)
  console.log("Test 1: Plain text input");
  const t1 = await runAgent(
    "Reply with exactly: PLAIN_OK",
    workspace
  );
  const t1Text = getResultText(t1.stdout);
  const t1Ok =
    hasAssistantOrResult(t1.stdout) &&
    !hasError(t1.stdout) &&
    t1Text.includes("PLAIN_OK");
  results.push({ name: "Plain text", ok: t1Ok, code: t1.code });
  console.log(t1Ok ? "  ✓ Accepted (response verified)" : "  ✗ Failed");
  if (!t1Ok) console.log("    Response:", t1Text?.slice(0, 100) || "(none)");
  console.log("");

  // Test 2: JSON with OpenAI-style content (text + image_url)
  console.log("Test 2: JSON input (OpenAI content blocks with image_url)");
  const openaiContent = JSON.stringify({
    content: [
      {
        type: "text",
        text: "This is a 1x1 pixel image. Describe what you see in one word, then reply with exactly: JSON_IMAGE_OK",
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${TINY_PNG_B64}`,
        },
      },
    ],
  });
  const t2 = await runAgent(openaiContent, workspace);
  const t2Text = getResultText(t2.stdout);
  const t2Ok = hasAssistantOrResult(t2.stdout) && !hasError(t2.stdout);
  const t2SawImage = t2Text && t2Text.includes("JSON_IMAGE_OK");
  results.push({
    name: "JSON OpenAI (text+image)",
    ok: t2Ok && t2SawImage,
    code: t2.code,
  });
  console.log(
    t2Ok && t2SawImage
      ? "  ✓ Accepted (response contains JSON_IMAGE_OK)"
      : "  ✗ Failed or no expected response"
  );
  if (t2Ok && t2Text)
    console.log(
      "    Response preview:",
      t2Text.slice(0, 120) + (t2Text.length > 120 ? "..." : "")
    );
  if (!t2Ok && t2.stderr) console.log("  stderr:", t2.stderr.slice(0, 300));
  console.log("");

  // Test 3: JSON with simple text content block
  console.log("Test 3: JSON input (single text block)");
  const simpleJson = JSON.stringify({
    content: [{ type: "text", text: "Reply with exactly: JSON_TEXT_OK" }],
  });
  const t3 = await runAgent(simpleJson, workspace);
  const t3Text = getResultText(t3.stdout);
  const t3Ok =
    hasAssistantOrResult(t3.stdout) &&
    !hasError(t3.stdout) &&
    t3Text.includes("JSON_TEXT_OK");
  results.push({ name: "JSON text only", ok: t3Ok, code: t3.code });
  console.log(t3Ok ? "  ✓ Accepted (response verified)" : "  ✗ Failed");
  if (!t3Ok) console.log("    Response:", t3Text?.slice(0, 100) || "(none)");
  console.log("");

  // Test 4: Prompt referencing image file in workspace
  console.log("Test 4: Text prompt referencing image file path");
  const imgPath = join(workspace, "test.png");
  writeFileSync(imgPath, Buffer.from(TINY_PNG_B64, "base64"));
  const t4 = await runAgent(
    `There is an image at ${imgPath}. Reply with exactly: FILE_REF_OK`,
    workspace
  );
  const t4Text = getResultText(t4.stdout);
  const t4Ok =
    hasAssistantOrResult(t4.stdout) &&
    !hasError(t4.stdout) &&
    t4Text.includes("FILE_REF_OK");
  results.push({ name: "Text + file path ref", ok: t4Ok, code: t4.code });
  console.log(t4Ok ? "  ✓ Accepted (response verified)" : "  ✗ Failed");
  if (!t4Ok) console.log("    Response:", t4Text?.slice(0, 100) || "(none)");
  console.log("");

  // Test 5: Vision verification - striped image, no hints (model must see it)
  console.log("Test 5: Vision verification (striped image, no hints)");
  const visionContent = JSON.stringify({
    content: [
      {
        type: "text",
        text: "What do you see in this image? Describe it briefly, then reply with exactly: STRIPED_OK",
      },
      {
        type: "image_url",
        image_url: { url: `data:image/png;base64,${STRIPED_B64}` },
      },
    ],
  });
  const t5 = await runAgent(visionContent, workspace);
  const t5Text = getResultText(t5.stdout);
  const t5Ok = hasAssistantOrResult(t5.stdout) && !hasError(t5.stdout);
  // Must mention stripes/bands/pattern OR at least 2 of the 4 colors (red, blue, green, yellow)
  const hasPattern = /\b(stripe|band|bar|vertical)\b/i.test(t5Text);
  const colorMatches = (t5Text.match(/\b(red|blue|green|yellow)\b/gi) || []);
  const uniqueColors = new Set(colorMatches.map((c) => c.toLowerCase())).size;
  const t5SawImage =
    t5Text &&
    t5Text.includes("STRIPED_OK") &&
    (hasPattern || uniqueColors >= 2);
  results.push({
    name: "Vision: striped image (no hints)",
    ok: t5Ok && t5SawImage,
    code: t5.code,
  });
  console.log(
    t5Ok && t5SawImage
      ? "  ✓ Model described stripes/colors (vision works)"
      : "  ✗ Failed or did not describe image content"
  );
  if (t5Ok && t5Text)
    console.log(
      "    Response preview:",
      t5Text.slice(0, 200) + (t5Text.length > 200 ? "..." : "")
    );
  if (!t5Ok && t5.stderr) console.log("  stderr:", t5.stderr.slice(0, 300));
  console.log("");

  // Summary
  console.log("=== Summary ===");
  const passed = results.filter((r) => r.ok).length;
  console.log(`${passed}/${results.length} tests passed`);
  results.forEach((r) => console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}`));

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
