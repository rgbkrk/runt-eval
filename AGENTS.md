# AGENTS.md

## Overview

This is a Deno-based notebook automation system that executes YAML-formatted notebooks through LiveStore coordination with runtime agents. It's designed for CI/CD pipelines and automated testing.

## Architecture

- **main.ts**: Entry point that runs both automation client and pyodide runtime agent
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
The `waitForExecution` method uses a simplified 2-second coordination approach. This was implemented to work around schema version compatibility issues. When the schema is upgraded, this should be replaced with proper LiveStore reactive subscriptions.

### BroadcastChannel Warnings
The warnings about BroadcastChannel are expected in Node.js environments and don't affect functionality.

### Execution Timeout
Default timeout is 60 seconds per cell. Adjust via `executionTimeout` in config.

## CI Usage

```bash
# Run automation with runtime agent
deno task automate:ci

# Run standalone automation (requires separate runtime)
deno run --env-file=.env --allow-all --unstable-broadcast-channel notebook-automation.ts example.yml
```

## Development Notes

- Uses `--unstable-broadcast-channel` flag for LiveStore coordination
- Temporary execution tracking until schema upgrade
- All cells execute sequentially with parameter injection
- Runtime agent handles Python execution via Pyodide

## Future Improvements

1. Upgrade to latest @runt/schema version for proper reactive subscriptions
2. Add support for cell-level timeout configuration
3. Implement proper execution status tracking
4. Add support for conditional cell execution