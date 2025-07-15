# AGENTS.md

## Overview

This is a Deno-based notebook automation system that executes YAML-formatted
notebooks through **reactive LiveStore coordination** with runtime agents. It's designed for
CI/CD pipelines, automated testing, and provides a "React version for terminal" experience with instant response times through LiveStore's event-sourcing framework.

## Architecture

- **main.ts**: Entry point with parallel startup optimization for automation client and pyodide runtime agent
- **notebook-automation.ts**: Core automation logic with reactive LiveStore coordination
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

**Next Level Performance Improvements to Explore:**

1. **Pre-queue All Executions**: Submit entire execution plan upfront while runtime bootstraps
   - Create all cells and queue all execution requests immediately
   - Let runtime agent consume queue as fast as possible when ready
   - *May hit Pyodide dependency bootstrapping timing limits*

2. **Notebook Structure Prefill**: Create complete notebook structure before runtime is ready
   - Initialize all cells, metadata, and execution queue entries
   - Runtime agent processes as soon as it comes online

3. **Advanced Parallel Execution**: Cell-level dependency analysis and parallel execution
4. **Cell-level timeout configuration** for complex computations
5. **Conditional cell execution** based on previous results
6. **Retry mechanisms** for failed executions
7. **Single LiveStore connection** across runtime agent and automation client

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
- **Startup time**: Parallel initialization (no 10-second blocking waits)
- **Execution flow**: Immediate cell-to-cell transitions (no artificial delays)
- **Process cleanup**: Clean termination without hanging
- **LiveStore connections**: Optimized to 2 connections (automation + runtime)

### Optimization Bottlenecks

**Pyodide Bootstrap Timing**: The main performance constraint is likely Pyodide's dependency loading:
1. **Python runtime loading**: ~2-3 seconds
2. **Package imports**: numpy, pandas, matplotlib take additional seconds  
3. **IPython kernel**: Rich display initialization

**Future optimization impact may be limited by these Pyodide initialization requirements**, but worth exploring to see if execution planning can be parallelized with bootstrap timing.
