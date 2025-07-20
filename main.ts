#!/usr/bin/env -S deno run --env-file=.env --allow-all --unstable-broadcast-channel

/**
 * Combined automation + runtime agent script
 *
 * This script runs both the notebook automation client and a pyodide runtime agent
 * in the same process, coordinating execution through LiveStore events.
 */

import { PyodideRuntimeAgent } from "@runt/pyodide-runtime-agent";
import { NotebookAutomation } from "./notebook-automation.ts";

interface CombinedConfig {
  notebookId?: string;
  documentPath: string;
  parametersPath?: string;
  executionTimeout?: number;
  stopOnError?: boolean;
}

/**
 * Run automation with embedded runtime agent
 */
async function runAutomationWithRuntime(
  config: CombinedConfig,
): Promise<{ success: boolean; summary?: object; error?: unknown }> {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const notebookId = config.notebookId || `automation-${timestamp}-${random}`;

  console.log("🚀 Starting combined automation + runtime");
  console.log(`📔 Notebook ID: ${notebookId}`);
  console.log(`🌐 Live URL: https://app.runt.run/?notebook=${notebookId}`);

  // Set notebook ID in environment for both components
  const originalNotebookId = Deno.env.get("NOTEBOOK_ID");
  Deno.env.set("NOTEBOOK_ID", notebookId);

  let runtimeAgent: PyodideRuntimeAgent | undefined;
  let automation: NotebookAutomation | undefined;

  try {
    // Start automation client and runtime agent in parallel
    console.log(
      "🚀 Starting automation client and runtime agent in parallel...",
    );

    // Start automation client immediately
    automation = new NotebookAutomation({
      notebookId,
      stopOnError: config.stopOnError ?? true,
      executionTimeout: config.executionTimeout ?? 60000,
    });

    // Start pyodide runtime agent in background
    console.log("🐍 Starting pyodide runtime agent...");
    runtimeAgent = new PyodideRuntimeAgent();

    // Start runtime agent
    try {
      await runtimeAgent.start();
      console.log("✅ Runtime agent started");
      // Keep alive runs in background
      runtimeAgent.keepAlive().catch((error) => {
        console.error(
          "❌ Runtime agent error:",
          error instanceof Error ? error.message : String(error),
        );
      });
    } catch (error) {
      console.error(
        "❌ Runtime agent startup failed:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }

    // Brief delay to let runtime initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Load document
    const document = await NotebookAutomation.loadDocument(config.documentPath);

    // Load parameters if provided
    let parameters: Record<string, unknown> = {};
    if (config.parametersPath) {
      try {
        const paramContent = await Deno.readTextFile(config.parametersPath);
        parameters = JSON.parse(paramContent);
        console.log("📋 Loaded parameters:", Object.keys(parameters));
      } catch (error) {
        console.warn(
          "⚠️  Failed to load parameters:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Execute the document
    console.log("🔄 Executing document...");
    const _results = await automation.executeDocument(document, parameters);

    // Get execution summary
    const summary = automation.getExecutionSummary();

    // Report results
    console.log("\n📊 Execution Summary:");
    console.log(`   Total duration: ${summary.totalDuration}ms`);
    console.log(`   Successful cells: ${summary.successfulCells}`);
    console.log(`   Failed cells: ${summary.failedCells.length}`);

    console.log(`\n🌐 View live notebook: ${summary.notebookUrl}`);

    if (summary.success) {
      console.log("\n🎉 Automation completed successfully!");
    } else {
      console.log("\n💥 Automation failed!");
      console.log(`   Failed cells: ${summary.failedCells.join(", ")}`);
      // Don't throw here - handle in finally block
      return { success: false, summary };
    }

    return { success: true, summary };
  } catch (error) {
    console.error(
      "❌ Automation failed:",
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error };
  } finally {
    // Cleanup
    console.log("\n🧹 Cleaning up...");

    if (automation) {
      await automation.cleanup();
    }

    if (runtimeAgent) {
      try {
        console.log("🛑 Stopping runtime agent...");
        // Stop the runtime agent cleanly
        await runtimeAgent.shutdown();
        console.log("✅ Runtime agent stopped");
      } catch (error) {
        console.warn(
          "⚠️  Runtime agent cleanup warning:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Restore original notebook ID
    if (originalNotebookId) {
      Deno.env.set("NOTEBOOK_ID", originalNotebookId);
    } else {
      Deno.env.delete("NOTEBOOK_ID");
    }

    // Allow cleanup to complete
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = Deno.args;

  if (args.length < 1) {
    console.log(
      "Usage: deno run main.ts <document-path> [parameters-path]",
    );
    console.log("");
    console.log(
      "This script runs both automation and runtime agent in the same process.",
    );
    console.log("");
    console.log("Examples:");
    console.log("  deno run main.ts example.yml");
    console.log(
      "  deno run main.ts example.yml parameters.json",
    );
    console.log("");
    console.log("Environment variables:");
    console.log("  AUTH_TOKEN       - Required for LiveStore sync");
    console.log("  NOTEBOOK_ID      - Optional, auto-generated if not set");
    console.log("  LIVESTORE_SYNC_URL - Optional sync URL");
    Deno.exit(1);
  }

  const documentPath = args[0];
  const parametersPath = args[1];

  // Check for AUTH_TOKEN
  if (!Deno.env.get("AUTH_TOKEN")) {
    console.error("❌ AUTH_TOKEN environment variable is required");
    console.error("   Make sure your .env file contains AUTH_TOKEN=your-token");
    Deno.exit(1);
  }

  try {
    const result = await runAutomationWithRuntime({
      documentPath,
      parametersPath,
      notebookId: Deno.env.get("NOTEBOOK_ID"),
      executionTimeout: 60000,
      stopOnError: true,
    });

    if (result.success) {
      console.log("🎯 Process completed successfully");
      Deno.exit(0);
    } else {
      console.error("💥 Process failed - execution errors occurred");
      Deno.exit(1);
    }
  } catch (error) {
    console.error(
      "❌ Process failed:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}

// Run if this is the main module
if (import.meta.main) {
  await main();
}

export { runAutomationWithRuntime };
