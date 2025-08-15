import { createRuntimeConfig } from "@runt/lib";
import {
  createStorePromise,
  makeSchema,
  queryDb,
  State,
  Store as LiveStore,
} from "@livestore/livestore";
import { makeAdapter } from "@livestore/adapter-node";
import { makeCfSync } from "@livestore/sync-cf";
import { parse as parseYaml } from "@std/yaml";
import type { CellType, ExecutionQueueData } from "@runt/schema";
import {
  events,
  fractionalIndexBetween,
  initialFractionalIndex,
  materializers,
  tables,
} from "@runt/schema";

// Create the store schema manually for 0.7.1+
const state = State.SQLite.makeState({ tables, materializers });
const schema = makeSchema({ events, state });
export type Store = LiveStore<typeof schema>;

// YAML notebook format - the canonical format
interface NotebookDocument {
  metadata?: {
    title?: string;
    description?: string;
    runtime?: string;
    tags?: string[];
  };
  parameters?: Record<string, unknown>;
  cells: Array<{
    id: string;
    source: string;
    celltype?: CellType; // Optional: defaults to "code" if not specified
  }>;
}

/**
 * Real LiveStore client for notebook automation like papermill
 * Acts as a terminal-based client that coordinates execution with runtime agents
 */

interface AutomationConfig {
  notebookId?: string;
  stopOnError?: boolean;
  parameters?: Record<string, unknown>;
  executionTimeout?: number;
}

interface ExecutionResult {
  success: boolean;
  cellId: string;
  queueId: string;
  duration: number;
  error?: string;
}

class NotebookAutomation {
  private config: AutomationConfig;
  private notebookId: string;
  private clientId: string = "automation-client";
  private store?: Store;
  private executionResults: ExecutionResult[] = [];
  private activeSubscriptions: Array<() => void> = [];

  constructor(config: AutomationConfig = {}) {
    this.config = {
      stopOnError: true,
      executionTimeout: 60000, // 60 seconds default
      ...config,
    };

    // Generate unique notebook ID for this automation run
    this.notebookId = config.notebookId || this.generateNotebookId();
    console.log(`📔 Using notebook ID: ${this.notebookId}`);
  }

  getNotebookId(): string {
    return this.notebookId;
  }

  /**
   * Generate a unique notebook ID for automation
   */
  private generateNotebookId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `automation-${timestamp}-${random}`;
  }

  /**
   * Execute a document by coordinating with LiveStore and runtime agents
   */
  async executeDocument(
    document: NotebookDocument,
    parameters?: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    results: ExecutionResult[];
    totalDuration: number;
    failedCells: string[];
  }> {
    const startTime = Date.now();
    this.executionResults = [];
    const failedCells: string[] = [];

    console.log("🚀 Starting notebook automation via LiveStore");
    console.log(`📖 Cells to execute: ${document.cells.length}`);

    // Debug environment info for CI troubleshooting
    console.log("🔍 Environment debug info:");
    console.log(`   Deno version: ${Deno.version.deno}`);
    console.log(`   Platform: ${Deno.build.os}-${Deno.build.arch}`);
    console.log(`   Target: ${Deno.build.target}`);
    console.log(`   Pyodide worker startup environment check...`);

    // Inject parameters as the first cell if provided
    // Merge parameters from document, config, and arguments
    const documentParams = document.parameters || {};
    const mergedParams = {
      ...documentParams,
      ...this.config.parameters,
      ...parameters,
    };

    if (Object.keys(mergedParams).length > 0) {
      const parameterCell = {
        id: "parameters",
        source: this.generateParameterCode(mergedParams),
      };

      document.cells.unshift(parameterCell);
      console.log("📋 Injected parameter cell");
      console.log(`   Parameters: ${Object.keys(mergedParams).join(", ")}`);
    }

    // Connect to LiveStore as a client
    await this.connectToLiveStore();

    // Prefill complete notebook structure immediately
    await this.prefillNotebookStructure(document);

    console.log(
      "⚡ Structure pre-filled - executing cells sequentially with error handling",
    );

    // Execute cells sequentially with proper error handling
    for (const [index, cell] of document.cells.entries()) {
      console.log(
        `🔄 Executing cell ${index + 1}/${document.cells.length}: ${cell.id}`,
      );
      console.log(
        `   Source: ${cell.source.substring(0, 80)}${
          cell.source.length > 80 ? "..." : ""
        }`,
      );

      const result = await this.executeCell(cell);
      this.executionResults.push(result);

      if (!result.success) {
        failedCells.push(cell.id);
        console.error(`❌ Cell ${cell.id} failed: ${result.error}`);

        if (this.config.stopOnError) {
          console.log("🛑 Stopping execution due to error");
          break;
        }
      } else {
        console.log(`✅ Cell ${cell.id} completed in ${result.duration}ms`);
      }
    }

    const totalDuration = Date.now() - startTime;
    const success = failedCells.length === 0;

    console.log(`📊 Execution summary:`);
    console.log(`   Total duration: ${totalDuration}ms`);
    console.log(
      `   Successful cells: ${
        this.executionResults.filter((r) => r.success).length
      }`,
    );
    console.log(`   Failed cells: ${failedCells.length}`);
    console.log(
      `📔 Notebook available at: https://app.runt.run/?notebook=${this.notebookId}`,
    );

    return {
      success,
      results: this.executionResults,
      totalDuration,
      failedCells,
    };
  }

  /**
   * Connect to LiveStore as a client for the notebook
   */
  private async connectToLiveStore(): Promise<void> {
    try {
      // Set the notebook ID in environment for the runtime config
      const originalNotebookId = Deno.env.get("NOTEBOOK_ID");
      Deno.env.set("NOTEBOOK_ID", this.notebookId);

      const config = createRuntimeConfig(Deno.args, {
        runtimeType: "automation-client",
        capabilities: {
          canExecuteCode: false, // We coordinate execution, don't execute directly
          canExecuteSql: false,
          canExecuteAi: false,
        },
      });

      // Restore original NOTEBOOK_ID
      if (originalNotebookId) {
        Deno.env.set("NOTEBOOK_ID", originalNotebookId);
      } else {
        Deno.env.delete("NOTEBOOK_ID");
      }

      console.log("📡 Connecting to LiveStore...");
      console.log(`🔗 Sync URL: ${config.syncUrl}`);
      console.log(`📓 Notebook: ${config.notebookId}`);

      // Create adapter with sync backend if AUTH_TOKEN is available
      const authToken = Deno.env.get("AUTH_TOKEN");
      const syncUrl = config.syncUrl || "wss://app.runt.run/livestore";

      if (!authToken) {
        throw new Error(
          "AUTH_TOKEN is required for LiveStore sync in automation mode",
        );
      }

      const adapter = makeAdapter({
        storage: { type: "in-memory" }, // Use in-memory for automation client
        sync: {
          backend: makeCfSync({ url: syncUrl }),
          onSyncError: "shutdown",
        },
      });

      // Create the store
      this.store = await createStorePromise({
        schema,
        adapter,
        storeId: this.notebookId,
        syncPayload: {
          authToken,
          runtime: true,
          clientId: this.clientId,
        },
      });

      console.log("✅ Connected to LiveStore");

      // Announce presence for automation client
      console.log("📍 Announcing automation client presence...");
      try {
        this.store.commit(
          events.presenceSet({
            userId: this.clientId,
            cellId: undefined, // Automation client doesn't focus on specific cells
          }),
        );
        console.log("✅ Automation client presence announced");
      } catch (error) {
        console.error("❌ Failed to announce automation presence:", error);
      }
    } catch (error) {
      console.error(
        "❌ Failed to connect to LiveStore:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Prefill complete notebook structure immediately
   */
  private async prefillNotebookStructure(
    document: NotebookDocument,
  ): Promise<void> {
    try {
      console.log("🏗️  Prefilling notebook structure...");

      if (!this.store) {
        throw new Error("Store not connected");
      }

      // Initialize the notebook
      this.store.commit(events.notebookInitialized({
        id: this.notebookId,
        title: `Automation Run ${new Date().toISOString()}`,
        ownerId: "automation",
      }));

      // Add all cells to the notebook with fractional indexing
      let previousIndex: string | null = null;
      for (const cell of document.cells) {
        // Calculate fractional index for proper ordering
        const fractionalIndex: string = previousIndex === null
          ? initialFractionalIndex()
          : fractionalIndexBetween(previousIndex, null);

        this.store.commit(events.cellCreated2({
          id: cell.id,
          cellType: (cell.celltype || "code") as CellType,
          fractionalIndex,
          createdBy: this.clientId,
        }));

        // Set the cell source
        this.store.commit(events.cellSourceChanged({
          id: cell.id,
          source: cell.source,
          modifiedBy: this.clientId,
        }));

        previousIndex = fractionalIndex;
      }

      console.log(
        `✅ Prefilled notebook structure with ${document.cells.length} cells`,
      );

      // Brief delay to ensure cells are fully propagated through LiveStore
      await this.delay(500);
    } catch (error) {
      console.error(
        "❌ Failed to prefill notebook structure:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Execute a single cell with proper error handling
   */
  private async executeCell(
    cell: { id: string; source: string },
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const cellId = cell.id;

    try {
      if (!this.store) {
        throw new Error("Store not connected");
      }

      console.log(`   📤 Submitting execution request for ${cellId}`);

      // Quick sanity check
      const cellRecord = this.store.query(
        tables.cells.select().where({ id: cellId }),
      )[0];
      if (!cellRecord) {
        throw new Error(`Cell ${cellId} not found in store`);
      }

      // Wait for runtime sessions to be available
      await this.ensureRuntimeAvailable(cellId);

      // Submit execution request
      const queueId = `${cellId}-${Date.now()}`;
      this.store.commit(events.executionRequested({
        queueId,
        cellId,
        executionCount: this.executionResults.length + 1,
        requestedBy: this.clientId,
      }));

      // Wait for execution to complete
      await this.waitForExecution(queueId, cellId);

      return {
        success: true,
        cellId,
        queueId,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.log(
        `   ❌ Execution failed for ${cellId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        success: false,
        cellId,
        queueId: "",
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Wait for cell execution to complete by monitoring execution state reactively
   * Uses LiveStore reactive subscriptions for immediate response to state changes
   * Also checks for error outputs to detect Python exceptions in automation mode
   */
  private waitForExecution(
    queueId: string,
    cellId: string,
  ): Promise<void> {
    const timeout = this.config.executionTimeout || 60000;
    return new Promise((resolve, reject) => {
      if (!this.store) {
        reject(new Error("Store not connected"));
        return;
      }

      let isResolved = false;
      const cleanup = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          // Use setTimeout 0 to make unsubscribing async (LiveStore workaround)
          setTimeout(() => {
            try {
              completedSub();
              failedSub();
              // Remove from active subscriptions
              this.activeSubscriptions = this.activeSubscriptions.filter(
                (sub) => sub !== completedSub && sub !== failedSub,
              );
            } catch (_error) {
              // Ignore cleanup errors - store might be shutting down
            }
          }, 0);
        }
      };

      const timeoutId = setTimeout(() => {
        console.log(`   ⏰ Execution timeout for ${cellId} after ${timeout}ms`);
        cleanup();
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      // Create reactive query for this specific queue entry
      const completedQuery$ = queryDb(
        tables.executionQueue.select()
          .where({
            id: queueId,
            status: "completed",
          }),
        {
          label: `execution-completed-${queueId}`,
          deps: [queueId],
        },
      );

      const failedQuery$ = queryDb(
        tables.executionQueue.select()
          .where({
            id: queueId,
            status: "failed",
          }),
        {
          label: `execution-failed-${queueId}`,
          deps: [queueId],
        },
      );

      // Subscribe to completion
      const completedSub = this.store.subscribe(
        completedQuery$,
        {
          onUpdate: (entries: readonly ExecutionQueueData[]) => {
            if (entries.length > 0 && !isResolved) {
              // Check for error outputs in automation mode
              const errorOutputs = this.store!.query(
                tables.outputs.select().where({
                  cellId,
                  outputType: "error",
                }),
              );

              // Also check for terminal outputs that might contain errors
              const terminalOutputs = this.store!.query(
                tables.outputs.select().where({
                  cellId,
                  outputType: "terminal",
                }),
              );

              const hasErrors = errorOutputs.length > 0 ||
                terminalOutputs.some((output: { data: unknown }) =>
                  typeof output.data === "string" &&
                  (output.data.includes("Error:") ||
                    output.data.includes("Exception:") ||
                    output.data.includes("Traceback"))
                );

              if (hasErrors) {
                console.log(
                  `   ❌ Execution completed with Python errors for ${cellId}`,
                );
                cleanup();
                reject(
                  new Error(`Python exception occurred in cell ${cellId}`),
                );
              } else {
                console.log(`   ✅ Execution completed for ${cellId}`);
                cleanup();
                resolve();
              }
            }
          },
        },
      );

      // Subscribe to failures
      const failedSub = this.store.subscribe(
        failedQuery$,
        {
          onUpdate: (entries: readonly ExecutionQueueData[]) => {
            if (entries.length > 0 && !isResolved) {
              const entry = entries[0];
              cleanup();
              reject(new Error(`Execution failed for ${cellId}: ${entry.id}`));
            }
          },
        },
      );

      // Store subscriptions for cleanup
      this.activeSubscriptions.push(completedSub, failedSub);
    });
  }

  /**
   * Generate parameter injection code
   */
  private generateParameterCode(parameters: Record<string, unknown>): string {
    const lines = ["# Parameters injected by automation"];

    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === "string") {
        lines.push(`${key} = "${value}"`);
      } else if (typeof value === "number") {
        lines.push(`${key} = ${value}`);
      } else if (typeof value === "boolean") {
        lines.push(`${key} = ${value ? "True" : "False"}`);
      } else {
        lines.push(`${key} = ${JSON.stringify(value)}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Load document from file or URL (YAML format)
   */
  static async loadDocument(source: string): Promise<NotebookDocument> {
    let content: string;

    if (source.startsWith("http")) {
      const response = await fetch(source);
      content = await response.text();
    } else {
      content = await Deno.readTextFile(source);
    }

    // Parse as YAML - this is our canonical format
    return parseYaml(content) as NotebookDocument;
  }

  /**
   * Get execution summary for logging/reporting
   */
  getExecutionSummary(): {
    success: boolean;
    totalDuration: number;
    successfulCells: number;
    failedCells: string[];
    notebookUrl: string;
  } {
    return {
      success: this.executionResults.every((r) => r.success),
      totalDuration: this.executionResults.reduce(
        (sum, r) => sum + r.duration,
        0,
      ),
      successfulCells: this.executionResults.filter((r) => r.success).length,
      failedCells: this.executionResults.filter((r) => !r.success).map((r) =>
        r.cellId
      ),
      notebookUrl: `https://app.runt.run/?notebook=${this.notebookId}`,
    };
  }

  /**
   * Ensure runtime sessions are available before execution
   */
  private async ensureRuntimeAvailable(_cellId: string): Promise<void> {
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const runtimeSessions = this.store!.query(
        tables.runtimeSessions.select(),
      );
      const readySessions = runtimeSessions.filter((s: { status: string }) =>
        s.status === "ready"
      );

      if (readySessions.length > 0) {
        return;
      }

      if (Date.now() - startTime > 3000) {
        console.log(
          `   ⏳ Waiting for runtime session... (${
            Math.round((Date.now() - startTime) / 1000)
          }s)`,
        );
      }
      await this.delay(1000);
    }

    throw new Error(`No runtime sessions became available within ${maxWait}ms`);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up automation resources...");

    // Clean up any remaining subscriptions with async workaround
    if (this.activeSubscriptions.length > 0) {
      console.log(
        `   📤 Cleaning up ${this.activeSubscriptions.length} subscriptions`,
      );
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          try {
            this.activeSubscriptions.forEach((unsubscribe) => {
              try {
                unsubscribe();
              } catch (_error) {
                // Ignore individual cleanup errors
              }
            });
            this.activeSubscriptions = [];
          } catch (_error) {
            // Ignore subscription cleanup errors
          }
          resolve();
        }, 0);
      });
    }

    if (this.store) {
      console.log("   🔌 Closing LiveStore connection");
      await this.store.shutdown();
    }
  }

  /**
   * Utility delay function
   */

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * CLI interface for notebook automation
 */
async function main() {
  const args = Deno.args;

  if (args.length < 1) {
    console.log(
      "Usage: deno run --unstable-broadcast-channel notebook-automation.ts <document-path> [parameters.json]",
    );
    console.log("");
    console.log("Environment variables:");
    console.log(
      "  AUTH_TOKEN         - Authentication token (required for sync)",
    );
    console.log(
      "  LIVESTORE_SYNC_URL - LiveStore sync URL (optional, defaults to app.runt.run)",
    );
    console.log(
      "  NOTEBOOK_ID        - Target notebook ID (optional, auto-generated if not set)",
    );
    console.log("");
    console.log("Examples:");
    console.log(
      "  deno run --unstable-broadcast-channel notebook-automation.ts example.yml",
    );
    console.log(
      "  deno run --unstable-broadcast-channel notebook-automation.ts document.yml params.json",
    );
    console.log(
      "  AUTH_TOKEN=token deno run --unstable-broadcast-channel notebook-automation.ts doc.yml",
    );
    console.log(
      "  NOTEBOOK_ID=my-nb AUTH_TOKEN=token deno run --unstable-broadcast-channel notebook-automation.ts doc.yml",
    );
    Deno.exit(1);
  }

  const documentPath = args[0];
  let parameters: Record<string, unknown> = {};

  // Load parameters if provided
  if (args[1]) {
    try {
      const paramContent = await Deno.readTextFile(args[1]);
      parameters = JSON.parse(paramContent);
      console.log("📋 Loaded parameters:", Object.keys(parameters));
    } catch (error) {
      console.error(
        "❌ Failed to load parameters:",
        error instanceof Error ? error.message : String(error),
      );
      Deno.exit(1);
    }
  }

  // Check if AUTH_TOKEN is available for sync
  const authToken = Deno.env.get("AUTH_TOKEN");
  if (!authToken) {
    console.warn(
      "⚠️  No AUTH_TOKEN found - this may not work with real execution",
    );
    console.warn("   Set AUTH_TOKEN environment variable to enable sync");
  }

  const automation = new NotebookAutomation({
    stopOnError: false, // Continue on errors for full document scan
  });

  try {
    // Load document
    console.log(`📖 Loading document: ${documentPath}`);
    const document = await NotebookAutomation.loadDocument(documentPath);

    // Execute document
    const _results = await automation.executeDocument(document, parameters);
    const summary = automation.getExecutionSummary();

    // Report final results
    if (summary.success) {
      console.log("🎉 Notebook execution completed successfully!");
      console.log(`🌐 View results: ${summary.notebookUrl}`);
      await automation.cleanup();
      Deno.exit(0);
    } else {
      console.error("💥 Notebook execution failed");
      console.error(`   Failed cells: ${summary.failedCells.join(", ")}`);
      console.log(`🌐 View partial results: ${summary.notebookUrl}`);
      await automation.cleanup();
      Deno.exit(1);
    }
  } catch (error) {
    console.error(
      "❌ Automation failed:",
      error instanceof Error ? error.message : String(error),
    );
    const summary = automation.getExecutionSummary();
    console.log(`🌐 Check notebook: ${summary.notebookUrl}`);
    await automation.cleanup();
    Deno.exit(1);
  }
}

// Run CLI if this is the main module
if (import.meta.main) {
  await main();
}

export { type AutomationConfig, NotebookAutomation };
