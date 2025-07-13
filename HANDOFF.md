# Runt-Eval: Notebook Automation via LiveStore

## Project Goal

Create a **papermill-like automation system** for the runt.run platform that can execute notebooks programmatically while leveraging the real-time collaborative features of LiveStore.

This project acts as a **LiveStore client** that orchestrates notebook execution by:
1. Creating notebooks with code cells
2. Submitting execution requests through the event system
3. Coordinating with runtime agents (like pyodide) for actual code execution
4. Providing live, shareable notebook URLs for human inspection

## Key Design Principles

### 1. Real LiveStore Client
- Uses actual `@runt/schema` events and tables
- Connects to the same LiveStore infrastructure as runtime agents
- No simulation - real event-driven coordination

### 2. Terminal-Based Automation
- Command-line interface similar to papermill
- Supports parameter injection for reproducible runs
- Generates unique notebook IDs automatically

### 3. Queue-Based Execution
- Submits execution requests via `executionRequested` events
- Monitors `executionQueue` table for completion
- Doesn't need to read outputs - those are handled by runtime agents

### 4. Live Collaboration
- Every automation run creates a shareable notebook at `https://app.runt.run/?notebook={id}`
- Humans can watch execution in real-time
- Full execution history and outputs preserved in LiveStore

## Architecture

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

## Current Implementation

### Core Files
- **`notebook-automation.ts`**: Main automation client
- **`example.json`**: Sample notebook document for testing
- **`parameters.json`**: Parameter injection example
- **`.env.example`**: Environment configuration template

### Event Flow
1. **Notebook Creation**: `notebookInitialized` → creates notebook metadata
2. **Cell Setup**: `cellCreated` + `cellSourceChanged` → adds executable cells
3. **Execution**: `executionRequested` → queues cell for runtime agent
4. **Monitoring**: Poll `executionQueue` table until status = `completed`

### Usage
```bash
# Basic automation with auto-generated notebook ID
AUTH_TOKEN=your-token deno task automate example.json

# With parameters
AUTH_TOKEN=your-token deno task automate:with-params

# Custom notebook ID
NOTEBOOK_ID=my-experiment AUTH_TOKEN=your-token deno task automate example.json
```

## What Works

✅ **LiveStore Integration**: Real schema events and table queries  
✅ **Notebook ID Generation**: Unique IDs like `automation-{timestamp}-{random}`  
✅ **Parameter Injection**: Automatic parameter cell creation  
✅ **Queue Coordination**: Submits execution requests and monitors completion  
✅ **Live URL Generation**: Provides shareable notebook links  
✅ **Environment Configuration**: `.env` file support built into tasks  

## What's Next

### Immediate Tasks
1. **Test with Real Runtime Agent**: Connect a pyodide agent to same notebook ID
2. **Error Handling**: Improve failure scenarios and timeout handling
3. **Output Validation**: Verify execution results through LiveStore queries

### Future Enhancements
1. **Concurrent Execution**: Execute multiple cells in parallel where possible
2. **Execution Dependencies**: Support for cell execution ordering/dependencies
3. **Result Export**: Export executed notebooks in standard formats
4. **Batch Processing**: Process multiple notebooks in sequence
5. **Integration Testing**: End-to-end tests with runtime agents

## Environment Setup

Required environment variables:
- `AUTH_TOKEN`: Authentication for LiveStore sync (required)
- `LIVESTORE_SYNC_URL`: Sync endpoint (optional, defaults to app.runt.run)
- `NOTEBOOK_ID`: Target notebook (optional, auto-generated if not set)

## Success Criteria

The automation is successful when:
1. **Notebooks execute completely** without manual intervention
2. **Results are accessible** via the generated notebook URL
3. **Multiple users can collaborate** on the same automation run
4. **Parameter injection works** for reproducible experiments
5. **Error handling is robust** for production use

This creates a bridge between programmatic automation and human-readable notebooks, enabling both automated workflows and collaborative data science on the runt.run platform.