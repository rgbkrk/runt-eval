# AGENTS.md

## Overview

This is a Deno-based notebook automation system that executes YAML-formatted
notebooks through **reactive LiveStore coordination** with runtime agents. It's designed for
CI/CD pipelines, automated testing, infrastructure monitoring, and provides a "React version for terminal" experience with instant response times through LiveStore's event-sourcing framework.

## Architecture

- **main.ts**: Entry point with parallel startup optimization for automation client and pyodide runtime agent
- **notebook-automation.ts**: Core automation logic with reactive LiveStore coordination and automation-specific error detection
- **notebooks/**: Infrastructure monitoring templates for D1 databases and Workers
- **example.yml**: Sample notebook demonstrating the YAML format
- **Reactive coordination**: True event-driven execution with instant response to state changes

## Key Technical Details

### Reactive Execution Flow

1. Automation client and runtime agent start **in parallel** (no blocking waits)
2. Both components connect to LiveStore with the **same notebook ID**
3. Cells are executed sequentially through **reactive LiveStore subscriptions** (no polling)
4. **Instant response** to execution completion/failure events
5. Results are available at `https://app.runt.run/?notebook=${notebookId}`

### Environment Requirements

- `AUTH_TOKEN`: Required for LiveStore sync
- `NOTEBOOK_ID`: Optional, auto-generated if not provided
- `LIVESTORE_SYNC_URL`: Optional, defaults to `wss://app.runt.run/livestore`

### YAML Notebook Format

```yaml
metadata:
  title: "Example Analysis"
  runtime: "python3"

parameters:
  data_size: 100
  delay: 0.01

cells:
  - id: "setup"
    source: |
      import numpy as np
      print("Setup complete")
```

## Common Issues & Solutions

### Reactive State ✅ **IMPLEMENTED**

The `waitForExecution` method uses proper LiveStore reactive subscriptions for
immediate response to execution state changes. This provides true reactive
coordination without arbitrary timeouts - the system responds instantly when
cells complete or fail through LiveStore's event-sourcing framework.

**Implementation details:**
- Uses `queryDb` with `tables.executionQueue.select()` for reactive queries
- Subscribes to both "completed" and "failed" execution states
- Applies `setTimeout(0)` async unsubscribe workaround for LiveStore's "destroyed thunk" issue
- No polling, no artificial delays - pure event-driven execution

### Notebook ID Coordination ✅ **IMPLEMENTED**

**Critical**: Runtime agent and automation client MUST use the same notebook ID.
The verification step and main execution both use the same `NotebookAutomation`
instance to avoid multiple LiveStore connections and coordination issues.

### Parallel Startup Optimization ✅ **IMPLEMENTED**

Runtime agent and automation client now start concurrently using `Promise.all()`:
- **Before**: 10+ seconds blocking wait for runtime initialization
- **After**: True parallel startup with 2-second verification delay
- **Result**: Significantly faster startup with overlapping initialization

### BroadcastChannel Warnings

The warnings about BroadcastChannel are expected in Node.js environments and
don't affect functionality.

### Execution Timeout

Default timeout is 60 seconds per cell. Adjust via `executionTimeout` in config.
Should rarely be hit due to reactive coordination.

## CI Usage

```bash
# Run automation with runtime agent
deno task automate:ci

# Run standalone automation (requires separate runtime)
deno run --env-file=.env --allow-all --unstable-broadcast-channel notebook-automation.ts example.yml
```

## Development Notes

- Uses `--unstable-broadcast-channel` flag for LiveStore coordination
- **True reactive execution**: LiveStore subscriptions with immediate response to state changes
- **Parallel startup optimization**: Runtime and automation initialize concurrently 
- **Single LiveStore connection**: Reuses NotebookAutomation instance for verification and execution
- **No artificial delays**: Cells execute immediately when previous cell completes (removed 500ms delays)
- **Linear execution flow**: Sequential cell execution like traditional notebooks
- **Async unsubscribe workaround**: Uses `setTimeout(0)` to avoid LiveStore "destroyed thunk" errors
- **Clean process termination**: Explicit exit handling prevents hanging
- Runtime agent handles Python execution via Pyodide

## Future Improvements

### Current Status: Production Ready ✅

**Completed Optimizations:**
- ✅ True reactive LiveStore coordination (no polling/timeouts)
- ✅ Parallel startup optimization (runtime + automation concurrent)
- ✅ Streamlined LiveStore connections (2 instead of 3)
- ✅ Removed all artificial delays between cells
- ✅ Clean process termination
- ✅ **Structure Prefill**: Create complete notebook structure before runtime is ready
- ✅ **Automation-Specific Error Detection**: Python exceptions stop execution in automation mode
- ✅ **Infrastructure Monitoring**: Comprehensive monitoring templates for D1 and Workers

**Advanced Performance Improvements Achieved:**

1. **✅ Structure Prefill**: 
   - Complete notebook structure created before runtime is ready
   - Maximum parallelization of structure creation and runtime startup
   - **Result**: Faster startup with overlapping initialization

2. **✅ Automation-Specific Error Detection**: 
   - Detects Python exceptions by checking error outputs after execution
   - Stops execution in automation mode while preserving interactive notebook behavior
   - **Result**: Reliable automation workflows with proper error handling

3. **✅ Infrastructure Monitoring**: 
   - Built-in monitoring templates for Cloudflare D1 databases and Workers
   - Configurable alert thresholds and health scoring
   - **Result**: Production-ready meta automation for infrastructure monitoring

**Performance Summary:**
- **Cell execution**: 150-650ms typical response times
- **Total execution**: 2-4 seconds for typical notebooks
- **Error handling**: Instant detection and stopping on Python exceptions
- **Infrastructure monitoring**: 10-30 seconds for full Cloudflare analytics

**Future Optimizations to Explore:**

1. **Advanced Parallel Execution**: Cell-level dependency analysis and parallel execution
2. **Cell-level timeout configuration** for complex computations
3. **Conditional cell execution** based on previous results
4. **Retry mechanisms** for failed executions
5. **Single LiveStore connection** across runtime agent and automation client

## Infrastructure Monitoring

### Built-in Monitoring Capabilities

The system includes comprehensive monitoring templates:

- **`simple-health-check.yml`**: Basic health monitoring with no external dependencies
- **`daily-health-check.yml`**: Daily monitoring with Cloudflare Analytics integration
- **`infrastructure-monitoring.yml`**: Full dashboard with D1 and Workers analytics

### Monitoring Features

**D1 Database Monitoring:**
- Query volume (read/write operations)
- Query latency and performance metrics
- Storage usage and growth trends
- Database-specific health scoring

**Workers Performance:**
- Request rates and error rates
- CPU time metrics (P50, P99)
- Script-level performance analysis
- Alert thresholds for critical metrics

**Automation Integration:**
- Configurable alert thresholds
- Slack webhook notifications
- Scheduled execution ready
- Real-time health scoring

### Usage

```bash
# Daily health monitoring
deno task health:daily

# Full infrastructure dashboard
deno task health:full

# Simple health check (no dependencies)
deno task health:simple
```

## Error Handling

### Automation-Specific Error Detection

The system provides different error handling for automation vs interactive use:

**Automation Mode:**
- Python exceptions detected by checking error outputs
- Execution stops when `stopOnError: true` and Python errors occur
- Proper error reporting with failed cell counts
- No changes to runtime agent (preserves interactive behavior)

**Interactive Mode:**
- Python exceptions displayed but execution continues
- Standard notebook behavior maintained
- No impact on runtime agent functionality

**Implementation:**
```typescript
// Check for error outputs after execution completion
const errorOutputs = this.store.query(
  tables.outputs.select().where({
    cellId,
    outputType: "error",
  }),
);

if (errorOutputs.length > 0) {
  // Treat as execution failure in automation mode
  reject(new Error(`Python exception occurred in cell ${cellId}`));
}
```

This approach provides reliable automation workflows while maintaining compatibility with interactive notebooks.

## Technical Implementation

### Reactive Execution Coordination

The system achieves "React version for terminal" experience through:

```typescript
// Create reactive queries for execution completion
const completedQuery$ = queryDb(
  tables.executionQueue.select().where({
    id: queueId,
    status: "completed",
  }),
  { label: `execution-completed-${queueId}`, deps: [queueId] }
);

// Subscribe with immediate response
const completedSub = this.store.subscribe(completedQuery$, {
  onUpdate: (entries: readonly ExecutionQueueData[]) => {
    if (entries.length > 0) {
      // Immediate response - no polling delay
      resolve();
    }
  },
});
```

### LiveStore Workaround

To avoid "attempted to compute destroyed thunk" errors:

```typescript
// Use setTimeout(0) for async cleanup
setTimeout(() => {
  try {
    completedSub();
    failedSub();
  } catch (_error) {
    // Ignore cleanup errors during shutdown
  }
}, 0);
```

This provides instant reactive coordination while working around LiveStore's
internal subscription cleanup timing issues.

## Performance Characteristics

### Current Performance ✅

- **Cell execution**: 150-650ms typical response times
- **Total execution**: 2-4 seconds for typical notebooks
- **Startup time**: True parallel initialization with structure prefill
- **Execution flow**: Sequential execution with proper error handling
- **Process cleanup**: Clean termination without hanging
- **LiveStore connections**: Optimized to 2 connections (automation + runtime)

### Optimization Results

**Structure Prefill + Reactive Coordination Performance**:
1. **Notebook structure**: Created immediately while runtime starts in parallel
2. **Reactive execution**: Instant response to completion/failure events
3. **Error detection**: Automation-specific Python exception handling
4. **Sequential reliability**: Maintains execution order with proper error handling

**Infrastructure Monitoring Performance**:
- **Simple health check**: 2-4 seconds (no external dependencies)
- **Daily monitoring**: 10-15 seconds (Cloudflare API calls)
- **Full dashboard**: 30-45 seconds (comprehensive analytics)

**Remaining Constraints**:
- **Pyodide bootstrap**: Still ~2-3 seconds for Python runtime + package imports
- **Computational cells**: Individual cell complexity (visualization takes longest)
- **Sequential execution**: Maintains notebook order for reliability
- **External APIs**: Cloudflare Analytics queries add latency for monitoring

**Architecture achieved production-ready performance** with reliable error handling and comprehensive monitoring capabilities.
