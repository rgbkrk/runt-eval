#!/usr/bin/env -S deno run --env-file --allow-all

/**
 * Test script to run automation with a real pyodide runtime agent
 * This script will:
 * 1. Generate a unique notebook ID
 * 2. Start a pyodide runtime agent in the background
 * 3. Run the automation
 * 4. Clean up the runtime agent
 */

import { NotebookAutomation } from "./notebook-automation.ts";

async function runWithRuntime() {
  // Generate unique notebook ID for this test
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const notebookId = `test-runtime-${timestamp}-${random}`;

  console.log("🧪 Starting automation + runtime test");
  console.log(`📔 Notebook ID: ${notebookId}`);
  console.log(
    `🌐 Will be available at: https://app.runt.run/?notebook=${notebookId}`,
  );

  // Check if we have AUTH_TOKEN
  const authToken = Deno.env.get("AUTH_TOKEN");
  if (!authToken) {
    console.error("❌ AUTH_TOKEN environment variable is required");
    console.error("   Set AUTH_TOKEN in your .env file or environment");
    Deno.exit(1);
  }

  let runtimeProcess: Deno.ChildProcess | undefined;

  try {
    // Start pyodide runtime agent in background
    console.log("🐍 Starting pyodide runtime agent...");

    runtimeProcess = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-all",
        "--unstable-broadcast-channel",
        "../runt/packages/pyodide-runtime-agent/src/mod.ts",
        "--notebook",
        notebookId,
        "--auth-token",
        authToken,
      ],
      stdout: "piped",
      stderr: "piped",
    }).spawn();

    // Give runtime agent time to start
    console.log("⏳ Waiting for runtime agent to initialize...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Run the automation
    console.log("🚀 Starting automation...");

    const automation = new NotebookAutomation({
      notebookId,
      stopOnError: false,
      executionTimeout: 30000, // 30 seconds for real execution
    });

    // Load and execute the example document
    const document = await NotebookAutomation.loadDocument("example.json");
    const results = await automation.executeDocument(document);

    // Save results
    const outputPath = `test-results-${notebookId}.json`;
    await automation.saveResults(outputPath);

    console.log("\n📊 Test Results:");
    console.log(`   Total duration: ${results.totalDuration}ms`);
    console.log(
      `   Successful cells: ${results.results.filter((r) => r.success).length}`,
    );
    console.log(`   Failed cells: ${results.failedCells.length}`);
    console.log(`   Results saved: ${outputPath}`);

    if (results.success) {
      console.log("\n🎉 Test completed successfully!");
    } else {
      console.log("\n⚠️  Test completed with errors");
    }

    console.log(
      `\n🌐 View live notebook: https://app.runt.run/?notebook=${notebookId}`,
    );

    await automation.cleanup();
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    Deno.exit(1);
  } finally {
    // Clean up runtime process
    if (runtimeProcess) {
      console.log("\n🧹 Cleaning up runtime agent...");
      try {
        runtimeProcess.kill("SIGTERM");
        await runtimeProcess.status;
      } catch {
        // Process might already be dead
      }
    }
  }
}

// Run the test if this file is executed directly
if (import.meta.main) {
  await runWithRuntime();
}

export { runWithRuntime };
