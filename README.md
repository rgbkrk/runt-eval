# runt-eval

Notebook automation using the runt.run platform with @runt/lib and @runt/pyodide-runtime-agent.

This project demonstrates how to create automation clients that sequence operations on documents, similar to papermill for Jupyter notebooks, but using the runt.run infrastructure.

## Features

- **Document Automation**: Execute documents by sequencing code cells in order
- **Parameter Injection**: Inject parameters into documents for parameterized execution
- **Error Handling**: Configurable retry logic and error handling strategies
- **Execution Tracking**: Track execution results, timing, and outputs
- **Multiple Runtimes**: Support for TypeScript and Python (via Pyodide) execution

## Quick Start

### Prerequisites

- Deno 1.40+ installed
- Access to runt.run platform

### Installation

```bash
git clone <this-repo>
cd runt-eval
```

### Basic Usage

Execute a document:
```bash
deno task automate example.json
```

Execute with parameters:
```bash
deno task automate:with-params
```

Custom execution:
```bash
deno run --allow-read --allow-write --allow-net notebook-automation.ts my-document.json my-params.json
```

## Document Format

Documents use the runt schema format with cells containing executable code:

```json
{
  "metadata": {
    "kernelspec": { "name": "python3", "display_name": "Python 3" }
  },
  "cells": [
    {
      "id": "cell-1",
      "cell_type": "code",
      "source": "print('Hello, World!')",
      "metadata": {},
      "outputs": []
    }
  ]
}
```

## Parameter Injection

Parameters are automatically injected as a new cell at the beginning of the document:

**parameters.json**:
```json
{
  "experiment_name": "test_run",
  "data_size": 1000,
  "debug_mode": true
}
```

This generates:
```python
# Parameters injected by automation
experiment_name = "test_run"
data_size = 1000
debug_mode = True
```

## Configuration

### AutomationConfig Options

```typescript
interface AutomationConfig {
  runtimeEndpoint?: string;  // Runtime agent endpoint
  timeout?: number;          // Execution timeout (default: 30000ms)
  retries?: number;          // Retry attempts (default: 2)
  stopOnError?: boolean;     // Stop on first error (default: true)
  parameters?: Record<string, any>; // Global parameters
}
```

### Example Configuration

```typescript
const automation = new NotebookAutomation({
  timeout: 60000,        // 60 second timeout
  retries: 3,           // 3 retry attempts
  stopOnError: false,   // Continue on errors
});
```

## Runtime Agents

### TypeScript Runtime

See `anode-example.ts` for a comprehensive TypeScript runtime agent that supports:
- Console output capture
- Mathematical expressions
- Async operations
- Execution statistics
- Custom commands

### Python Runtime (Pyodide)

See `python-runtime.ts` for a Python execution environment using Pyodide:
- Full Python 3.11 compatibility
- Scientific computing libraries (NumPy, Pandas, Matplotlib)
- Package installation
- Variable state tracking

## API Reference

### NotebookAutomation Class

#### Methods

- `executeDocument(document, parameters?)`: Execute all code cells in sequence
- `saveResults(outputPath, format?)`: Save execution results to file
- `static loadDocument(source)`: Load document from file or URL
- `static connectToRuntime(endpoint?)`: Connect to runtime agent

#### Properties

- `executionResults`: Array of execution summaries
- `config`: Automation configuration

## Examples

### Basic Automation

```typescript
import { NotebookAutomation } from "./notebook-automation.ts";

const automation = new NotebookAutomation();
const document = await NotebookAutomation.loadDocument("my-notebook.json");
const results = await automation.executeDocument(document);

if (results.success) {
  console.log("✅ All cells executed successfully");
} else {
  console.log(`❌ ${results.failedCells.length} cells failed`);
}
```

### With Parameters

```typescript
const parameters = {
  dataset_path: "/data/experiment.csv",
  output_dir: "/results",
  model_type: "random_forest"
};

const results = await automation.executeDocument(document, parameters);
```

### Error Handling

```typescript
const automation = new NotebookAutomation({
  stopOnError: false,  // Continue on errors
  retries: 3,         // Retry failed cells
});

const results = await automation.executeDocument(document);

// Check individual cell results
for (const result of results.results) {
  if (!result.success) {
    console.log(`Cell ${result.cellId} failed: ${result.error}`);
  }
}
```

## Development

### Available Tasks

- `deno task dev`: Watch mode for development
- `deno task automate`: Run automation on example document
- `deno task automate:example`: Run with example document
- `deno task automate:with-params`: Run with parameters

### Testing

```bash
deno test
```

### Type Checking

```bash
deno check *.ts
```

## Architecture

The automation system consists of:

1. **Automation Client** (`notebook-automation.ts`): Orchestrates document execution
2. **Runtime Agents** (`anode-example.ts`, `python-runtime.ts`): Execute code cells
3. **Schema Types** (`@runt/schema`): Standard document and cell formats
4. **Runtime Library** (`@runt/lib`): Core runtime functionality

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Automation      │───▶│ Runtime Agent    │───▶│ Code Execution  │
│ Client          │    │ (TS/Python)      │    │ Environment     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Document        │    │ Execution        │    │ Results &       │
│ Loading         │    │ Sequencing       │    │ Outputs         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

See LICENSE file for details.