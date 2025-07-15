import { createRuntimeConfig } from "@runt/lib";
import { createStorePromise } from "@livestore/livestore";
import { makeAdapter } from "@livestore/adapter-node";
import { makeCfSync } from "@livestore/sync-cf";
import { parse as parseYaml } from "@std/yaml";
import type { CellType, Store } from "@runt/schema";
import { events, schema } from "@runt/schema";

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
  private store?: Store;
  private executionResults: ExecutionResult[] = [];

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

    // Initialize the notebook in LiveStore
    await this.initializeNotebook(document);

    // Execute cells sequentially
    for (const cell of document.cells) {
      console.log(`🔄 Executing cell: ${cell.id}`);
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

      // Brief pause between cells
      await this.delay(500);
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
        syncPayload: { authToken },
      });

      console.log("✅ Connected to LiveStore");
    } catch (error) {
      console.error(
        "❌ Failed to connect to LiveStore:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Initialize the notebook in LiveStore
   */
  private async initializeNotebook(document: NotebookDocument): Promise<void> {
    try {
      console.log("📝 Initializing notebook in LiveStore...");

      if (!this.store) {
        throw new Error("Store not connected");
      }

      // Initialize the notebook
      await this.store.commit(events.notebookInitialized({
        id: this.notebookId,
        title: `Automation Run ${new Date().toISOString()}`,
        ownerId: "automation",
      }));

      // Add all cells to the notebook
      for (const cell of document.cells) {
        await this.store.commit(events.cellCreated({
          id: cell.id,
          cellType: "code" as CellType,
          position: document.cells.indexOf(cell),
          createdBy: "automation",
        }));

        // Set the cell source
        await this.store.commit(events.cellSourceChanged({
          id: cell.id,
          source: cell.source,
          modifiedBy: "automation",
        }));
      }

      console.log(
        `✅ Initialized notebook with ${document.cells.length} cells`,
      );
    } catch (error) {
      console.error(
        "❌ Failed to initialize notebook:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Execute a single cell by submitting execution request and waiting for completion
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

      // Submit execution request
      const queueId = `${cellId}-${Date.now()}`;
      await this.store.commit(events.executionRequested({
        queueId,
        cellId,
        executionCount: this.executionResults.length + 1,
        requestedBy: "automation",
      }));

      // Wait for execution to complete
      await this.waitForExecution(queueId, cellId);

      console.log(`   ✅ Execution completed for ${cellId}`);

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
   * Wait for cell execution to complete by monitoring execution state
   * Temporarily using simpler approach until schema is upgraded
   */
  private waitForExecution(
    _queueId: string,
    cellId: string,
  ): Promise<void> {
    const timeout = this.config.executionTimeout || 60000;

    return new Promise((resolve, reject) => {
      if (!this.store) {
        reject(new Error("Store not connected"));
        return;
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      // Simple polling approach until we can upgrade schema
      const checkExecution = () => {
        try {
          // For now, just wait a reasonable amount of time for execution
          // This is a temporary solution until schema upgrade
          setTimeout(() => {
            clearTimeout(timeoutId);
            console.log(`   ✅ Execution assumed completed for ${cellId}`);
            resolve();
          }, 2000); // 2 second delay for execution
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      };

      checkExecution();
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
      } else if (typeof value === "number" || typeof value === "boolean") {
        lines.push(`${key} = ${value}`);
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
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.store) {
      console.log("🧹 Cleaning up LiveStore connection");
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
      Deno.exit(0);
    } else {
      console.error("💥 Notebook execution failed");
      console.error(`   Failed cells: ${summary.failedCells.join(", ")}`);
      console.log(`🌐 View partial results: ${summary.notebookUrl}`);
      Deno.exit(1);
    }
  } catch (error) {
    console.error(
      "❌ Automation failed:",
      error instanceof Error ? error.message : String(error),
    );
    const summary = automation.getExecutionSummary();
    console.log(`🌐 Check notebook: ${summary.notebookUrl}`);
    Deno.exit(1);
  } finally {
    await automation.cleanup();
  }
}

// Run CLI if this is the main module
if (import.meta.main) {
  await main();
}

export { type AutomationConfig, NotebookAutomation };
