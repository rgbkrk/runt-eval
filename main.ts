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
async function runAutomationWithRuntime(config: CombinedConfig) {
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
    // Start pyodide runtime agent
    console.log("🐍 Starting pyodide runtime agent...");
    runtimeAgent = new PyodideRuntimeAgent();

    // Start runtime agent in background (don't await keepAlive)
    const _runtimePromise = (async () => {
      try {
        await runtimeAgent!.start();
        console.log("✅ Runtime agent started");
        await runtimeAgent!.keepAlive();
      } catch (error) {
        console.error(
          "❌ Runtime agent error:",
          error instanceof Error ? error.message : String(error),
        );
      }
    })();

    // Give runtime more time to initialize packages in CI
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Verify packages are ready before starting automation
    console.log("🔍 Verifying package availability...");
    await verifyPackagesReady(notebookId);
    console.log("✅ Essential packages verified");

    // Start automation
    console.log("🤖 Starting automation client...");
    automation = new NotebookAutomation({
      notebookId,
      stopOnError: config.stopOnError ?? true,
      executionTimeout: config.executionTimeout ?? 60000,
    });

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

    if (summary.success) {
      console.log("\n🎉 Automation completed successfully!");
    } else {
      console.log("\n⚠️  Automation completed with errors");
      console.log(`   Failed cells: ${summary.failedCells.join(", ")}`);
    }

    console.log(`\n🌐 View live notebook: ${summary.notebookUrl}`);
  } catch (error) {
    console.error(
      "❌ Automation failed:",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
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
  }
}

/**
 * Verify essential packages are available before starting automation
 */
async function verifyPackagesReady(notebookId: string): Promise<void> {
  const testAutomation = new NotebookAutomation({
    notebookId: notebookId,
    stopOnError: true,
    executionTimeout: 30000,
  });

  try {
    await testAutomation.executeDocument({
      metadata: { title: "Package Test" },
      cells: [{
        id: "package-test",
        source: `
import sys
print(f"Python version: {sys.version}")

# Test essential packages
try:
    try:
        import numpy as np
        import pandas as pd
        import matplotlib.pyplot as plt
        print("✅ Essential packages (numpy, pandas, matplotlib) are available")
    except ImportError as e:
        print(f"❌ Package not available: {e}")
        raise
`,
      }],
    }, {});

    const summary = testAutomation.getExecutionSummary();
    if (!summary.success) {
      throw new Error(
        `Package verification failed: ${summary.failedCells.join(", ")}`,
      );
    }
  } finally {
    await testAutomation.cleanup();
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
    await runAutomationWithRuntime({
      documentPath,
      parametersPath,
      notebookId: Deno.env.get("NOTEBOOK_ID"),
      executionTimeout: 60000,
      stopOnError: true,
    });
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
