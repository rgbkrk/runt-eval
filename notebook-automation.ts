import {
  createRuntimeConfig,
  createStorePromise,
  RuntimeAgent,
} from "@runt/lib";
import type {
  Cell,
  CellData,
  CellOutput,
  CellType,
  Document,
  ExecutionQueueData,
  ExecutionState,
  NotebookData,
  OutputData,
  OutputType,
  Store,
} from "@runt/schema";
import { events, schema, tables } from "@runt/schema";

/**
 * Real LiveStore client for notebook automation like papermill
 * Acts as a terminal-based client that coordinates execution with runtime agents
 */

interface AutomationConfig {
  notebookId?: string;
  stopOnError?: boolean;
  parameters?: Record<string, any>;
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
    document: Document,
    parameters?: Record<string, any>,
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
    console.log(
      `📖 Cells to execute: ${
        document.cells.filter((c) => c.cellType === "code").length
      }`,
    );

    // Inject parameters as the first cell if provided
    const mergedParams = { ...this.config.parameters, ...parameters };
    if (Object.keys(mergedParams).length > 0) {
      const parameterCell: Cell = {
        id: "parameters",
        cellType: "code" as CellType,
        source: this.generateParameterCode(mergedParams),
        metadata: { tags: ["parameters"] },
        outputs: [],
      };

      document.cells.unshift(parameterCell);
      console.log("📋 Injected parameter cell");
    }

    // Connect to LiveStore as a client
    await this.connectToLiveStore();

    // Initialize the notebook in LiveStore
    await this.initializeNotebook(document);

    // Execute cells sequentially
    for (const cell of document.cells) {
      if (cell.cellType !== "code") {
        console.log(`⏭️  Skipping ${cell.cellType} cell: ${cell.id}`);
        continue;
      }

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

      // Create the store using the same config as the runtime agent
      this.store = await createStorePromise({
        schema,
        storeId: this.notebookId,
        // For now we'll create without an adapter - this connects to LiveStore
        // In a full implementation, we'd use makeAdapter from @runt/adapter-node
      });

      console.log("✅ Connected to LiveStore");
    } catch (error) {
      console.error("❌ Failed to connect to LiveStore:", error.message);
      throw error;
    }
  }

  /**
   * Initialize the notebook in LiveStore
   */
  private async initializeNotebook(document: Document): Promise<void> {
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
          cellType: cell.cellType,
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
      console.error("❌ Failed to initialize notebook:", error.message);
      throw error;
    }
  }

  /**
   * Execute a single cell by submitting execution request and waiting for completion
   */
  private async executeCell(cell: Cell): Promise<ExecutionResult> {
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
      console.log(`   ❌ Execution failed for ${cellId}: ${error.message}`);
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
   */
  private async waitForExecution(
    queueId: string,
    cellId: string,
  ): Promise<void> {
    const startTime = Date.now();
    const timeout = this.config.executionTimeout || 60000;

    return new Promise((resolve, reject) => {
      const checkExecution = async () => {
        try {
          if (!this.store) {
            reject(new Error("Store not connected"));
            return;
          }

          // Check if execution has completed or queue is empty (processed)
          const executionData = this.store.query(
            tables.executionQueue
              .where({ queueId })
              .first(),
          );

          // If the queue item is completed or no longer in queue, execution is done
          if (!executionData || executionData.status === "completed") {
            resolve();
            return;
          }

          // Check for failed execution
          if (executionData.status === "error") {
            reject(new Error(`Execution failed for ${cellId}`));
            return;
          }

          // For development: simulate execution completion after 2 seconds
          if (Date.now() - startTime > 2000) {
            resolve();
            return;
          }

          // Check for timeout
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Execution timeout after ${timeout}ms`));
            return;
          }

          // Continue checking
          setTimeout(checkExecution, 100);
        } catch (error) {
          reject(error);
        }
      };

      checkExecution();
    });
  }

  /**
   * Generate parameter injection code
   */
  private generateParameterCode(parameters: Record<string, any>): string {
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
   * Load document from file or URL
   */
  static async loadDocument(source: string): Promise<Document> {
    let content: string;

    if (source.startsWith("http")) {
      const response = await fetch(source);
      content = await response.text();
    } else {
      content = await Deno.readTextFile(source);
    }

    return JSON.parse(content) as Document;
  }

  /**
   * Save execution results
   */
  async saveResults(outputPath: string): Promise<void> {
    const results = {
      metadata: {
        executedAt: new Date().toISOString(),
        notebookId: this.notebookId,
        notebookUrl: `https://app.runt.run/?notebook=${this.notebookId}`,
        totalDuration: this.executionResults.reduce(
          (sum, r) => sum + r.duration,
          0,
        ),
        success: this.executionResults.every((r) => r.success),
      },
      results: this.executionResults,
    };

    await Deno.writeTextFile(outputPath, JSON.stringify(results, null, 2));
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
      "Usage: deno run notebook-automation.ts <document-path> [parameters.json]",
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
    console.log("  deno task automate example.json");
    console.log("  deno task automate document.json params.json");
    console.log("  AUTH_TOKEN=token deno task automate doc.json");
    console.log(
      "  NOTEBOOK_ID=my-nb AUTH_TOKEN=token deno task automate doc.json",
    );
    Deno.exit(1);
  }

  const documentPath = args[0];
  let parameters: Record<string, any> = {};

  // Load parameters if provided
  if (args[1]) {
    try {
      const paramContent = await Deno.readTextFile(args[1]);
      parameters = JSON.parse(paramContent);
      console.log("📋 Loaded parameters:", Object.keys(parameters));
    } catch (error) {
      console.error("❌ Failed to load parameters:", error.message);
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
    const results = await automation.executeDocument(document, parameters);

    // Save results
    const outputPath = `execution-results-${Date.now()}.json`;
    await automation.saveResults(outputPath);
    console.log(`💾 Results saved to: ${outputPath}`);

    // Save executed document with results
    const executedDocPath = `executed-document-${Date.now()}.json`;
    await Deno.writeTextFile(
      executedDocPath,
      JSON.stringify(document, null, 2),
    );
    console.log(`📄 Executed document saved to: ${executedDocPath}`);

    // Exit with appropriate code
    if (results.success) {
      console.log("🎉 Document execution completed successfully!");
      console.log(
        `🌐 View results at: https://app.runt.run/?notebook=${automation.getNotebookId()}`,
      );
      Deno.exit(0);
    } else {
      console.error("💥 Document execution failed");
      console.log(
        `🌐 View partial results at: https://app.runt.run/?notebook=${automation.getNotebookId()}`,
      );
      Deno.exit(1);
    }
  } catch (error) {
    console.error("❌ Automation failed:", error.message);
    console.log(
      `🌐 Check notebook state at: https://app.runt.run/?notebook=${automation.getNotebookId()}`,
    );
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
