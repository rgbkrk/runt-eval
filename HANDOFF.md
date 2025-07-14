# Runt-Eval: Working Notebook Automation System ✅

## 🎉 Current Status: WORKING!

The notebook automation system is **fully functional** and successfully creates live collaborative notebooks that can be viewed in real-time at `https://app.runt.run/?notebook={id}`.

## Quick Start

```bash
# Run automation with embedded runtime agent (recommended)
deno task automate:runtime:example

# Run automation only (cells will queue without execution)
deno task automate example.json
```

## What This Does

Creates a **papermill-like automation system** for runt.run that:

1. **Generates unique notebook IDs** (`automation-{timestamp}-{random}`)
2. **Creates live notebooks** with executable Python cells
3. **Coordinates execution** between automation client and pyodide runtime agent
4. **Provides shareable URLs** for real-time collaboration
5. **Runs entirely in-process** - no external dependencies needed

## Architecture: Real LiveStore Client

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Automation      │───▶│ LiveStore Events │◀───│ Runtime Agent   │
│ Client          │    │ & Tables         │    │ (Pyodide)       │
│ (Terminal)      │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ • Create cells  │    │ • notebookInit   │    │ • Execute code  │
│ • Queue execution│    │ • cellCreated    │    │ • Store outputs │
│ • Monitor queue │    │ • executionReq   │    │ • Update queue  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Key Innovation: Same-Process Coordination

The `automation-with-runtime.ts` script runs both:
- **Automation client**: Creates cells, submits execution requests
- **Pyodide runtime agent**: Picks up requests, executes Python code

Both coordinate through LiveStore's event system in the same Deno process.

## Files Overview

### Core Files
- **`automation-with-runtime.ts`** ⭐ - Combined automation + runtime (recommended)
- **`notebook-automation.ts`** - Standalone automation client  
- **`example.json`** - Sample Jupyter notebook for testing
- **`parameters.json`** - Parameter injection example
- **`.env`** - Contains AUTH_TOKEN for LiveStore sync

### Tasks Available
```bash
# Combined automation + runtime (best for testing)
deno task automate:runtime:example
deno task automate:runtime:with-params

# Automation only (needs separate runtime agent)
deno task automate example.json
deno task automate:with-params
```

## Technical Implementation

### Uses Real Runt Schema Events
- `notebookInitialized` → Create notebook metadata
- `cellCreated` + `cellSourceChanged` → Add executable cells  
- `executionRequested` → Queue cell for execution
- Monitor `executionQueue` table for completion

### LiveStore Integration
- Connects via `@livestore/adapter-node` with CF sync backend
- Uses real `@runt/schema` events and tables
- No simulation - actual event-driven coordination
- Supports parameter injection for reproducible runs

### Output: Live Notebooks Only
- **No local files generated** (cleaned up approach)
- Results viewable at `https://app.runt.run/?notebook={id}`
- Perfect for Slack integration - just send the URL
- Real-time collaboration ready

## Environment Setup

Required environment variables in `.env`:
```bash
AUTH_TOKEN=your-auth-token        # Required for LiveStore sync
LIVESTORE_SYNC_URL=wss://app.runt.run  # Optional, defaults correctly
NOTEBOOK_ID=custom-id             # Optional, auto-generated if not set
```

## For Future AI Sessions

### Essential Context to Provide
1. **Load the runt schema**: `runt/packages/schema/mod.ts` - Contains all event definitions and table schemas
2. **Check LiveStore docs**: https://docs.livestore.dev/llms-full.txt - Full LiveStore documentation  
3. **Review current codebase**: The automation is a real LiveStore client using actual schema events
4. **Test command**: `deno task automate:runtime:example` should work immediately

### Key Technical Details
- Uses `@runt/schema` events: `notebookInitialized`, `cellCreated`, `cellSourceChanged`, `executionRequested`
- Queries `executionQueue` table to monitor completion
- Converts Jupyter notebook format (`cell_type`) to runt schema format (`cellType`)
- Runtime agent and automation coordinate through shared LiveStore event log
- All execution happens via event queue - no direct communication needed

## Success Metrics

✅ **Notebooks create successfully** with unique IDs  
✅ **Cells execute in sequence** with real Python code  
✅ **Live URLs work** for human collaboration  
✅ **Parameter injection** for reproducible experiments  
✅ **Same-process execution** eliminates coordination complexity  
✅ **No local file pollution** - results live online only  

## Next Steps for Enhancement

1. **Slack Integration**: Send notebook URLs on completion/failure
2. **Batch Processing**: Execute multiple notebooks in sequence  
3. **Error Recovery**: Better handling of runtime agent failures
4. **Cell Dependencies**: Support for execution ordering constraints
5. **Result Validation**: Automated checking of execution outputs

## Debugging Tips

- **Cells stuck "Queued"**: Runtime agent not connected to same notebook ID
- **Auth errors**: Check AUTH_TOKEN in `.env` file
- **Import errors**: Ensure proper `@runt/*` package imports in `deno.json`
- **LiveStore connection**: Look for BroadcastChannel warnings (use `--unstable-broadcast-channel`)

The system bridges programmatic automation with human-readable collaborative notebooks, enabling both automated workflows and real-time data science collaboration on the runt.run platform.