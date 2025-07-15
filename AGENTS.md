# AGENTS.md

## Overview

This is a Deno-based notebook automation system that executes YAML-formatted
notebooks through LiveStore coordination with runtime agents. It's designed for
CI/CD pipelines and automated testing.

## Architecture

- **main.ts**: Entry point that runs both automation client and pyodide runtime
  agent
- **notebook-automation.ts**: Core automation logic with LiveStore integration
- **example.yml**: Sample notebook demonstrating the YAML format

## Key Technical Details

### Execution Flow

1. Automation client connects to LiveStore
2. Runtime agent starts in parallel and registers with LiveStore
3. Cells are executed sequentially through LiveStore event coordination
4. Results are available at `https://app.runt.run/?notebook=${notebookId}`

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

### Reactive State

The `waitForExecution` method uses proper LiveStore reactive subscriptions for
immediate response to execution state changes. This provides true reactive
coordination without arbitrary timeouts - the system responds instantly when
cells complete or fail through LiveStore's event-sourcing framework.

**Implementation details:**
- Uses `queryDb` with `tables.executionQueue.select()` for reactive queries
- Subscribes to both "completed" and "failed" execution states
- Applies `setTimeout(0)` async unsubscribe workaround for LiveStore's "destroyed thunk" issue
- No polling, no artificial delays - pure event-driven execution

### Notebook ID Coordination

**Critical**: Runtime agent and automation client MUST use the same notebook ID.
The verification step and main execution both use the same `NotebookAutomation`
instance to avoid multiple LiveStore connections and coordination issues.

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
- **Single LiveStore connection**: Reuses NotebookAutomation instance for verification and execution
- **No artificial delays**: Cells execute immediately when previous cell completes
- **Linear execution flow**: Sequential cell execution like traditional notebooks
- **Async unsubscribe workaround**: Uses `setTimeout(0)` to avoid LiveStore "destroyed thunk" errors
- Runtime agent handles Python execution via Pyodide

## Future Improvements

1. Add support for cell-level timeout configuration
2. Add support for conditional cell execution  
3. Implement parallel cell execution where dependencies allow
4. Add retry mechanisms for failed executions
5. Remove verification step entirely (may be unnecessary with reliable runtime)
6. Optimize to single LiveStore connection across runtime agent and automation client

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
