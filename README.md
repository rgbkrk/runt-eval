# Runt-Eval: Live Notebook Automation

[![Status: Working ✅](https://img.shields.io/badge/Status-Working%20%E2%9C%85-success)](https://github.com/rgbkrk/runt-eval)

Papermill-style notebook automation for the [runt.run](https://app.runt.run) platform. Creates live, collaborative notebooks that execute Python code in real-time.

## 🚀 Quick Start

```bash
# Clone and enter directory
git clone <this-repo>
cd runt-eval

# Run automation with embedded Python runtime
deno task automate:runtime:example
```

**Output**: Live notebook at `https://app.runt.run/?notebook=automation-{id}`

## ✨ What This Does

- **Creates live notebooks** with auto-generated IDs
- **Executes Python cells** using Pyodide runtime  
- **Provides shareable URLs** for real-time collaboration
- **Injects parameters** for reproducible experiments
- **Runs entirely in-process** - no external services needed

Perfect for automated data science workflows that humans can inspect and collaborate on.

## 🎯 Use Cases

- **Automated reporting**: Run scheduled data analysis notebooks
- **Parameter sweeps**: Execute experiments with different configurations  
- **CI/CD data validation**: Automated notebook-based testing
- **Collaborative automation**: Share live results with team members

## 📋 Prerequisites

- [Deno 1.40+](https://deno.land/manual/getting_started/installation)
- AUTH_TOKEN in `.env` file (for LiveStore sync)

## 🛠️ Usage

### Available Commands

```bash
# Combined automation + runtime (recommended)
deno task automate:runtime:example              # Run example notebook
deno task automate:runtime:with-params          # Run with parameters

# Automation only (requires separate runtime)  
deno task automate example.json                 # Basic execution
deno task automate:with-params                  # With parameter injection
```

### Custom Notebooks

Create a Jupyter-format JSON file:

```json
{
  "cells": [
    {
      "id": "cell-1", 
      "cell_type": "code",
      "source": "import pandas as pd\nprint('Hello from automation!')",
      "metadata": {},
      "outputs": []
    }
  ]
}
```

Then run: `deno task automate:runtime your-notebook.json`

### Parameter Injection

Create `parameters.json`:

```json
{
  "experiment_name": "test_run",
  "data_size": 1000,
  "model_type": "random_forest"
}
```

Parameters are automatically injected as the first cell:

```python
# Parameters injected by automation  
experiment_name = "test_run"
data_size = 1000
model_type = "random_forest"
```

## 🏗️ Architecture

### Real LiveStore Client

This is a genuine LiveStore client that uses the actual runt.run infrastructure:

- **Events**: `notebookInitialized`, `cellCreated`, `executionRequested`
- **Tables**: `executionQueue`, `outputs`, `cells`
- **Sync**: Real-time collaboration via WebSocket

### Same-Process Coordination

The `automation-with-runtime.ts` script runs both components together:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Automation      │───▶│ LiveStore Events │◀───│ Pyodide Runtime│
│ Client          │    │ & Tables         │    │ Agent          │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    Create cells          Event coordination        Execute Python
    Queue execution       Real-time sync           Store outputs
```

## 🔧 Configuration

### Environment Variables

Required in `.env` file:

```bash
AUTH_TOKEN=your-auth-token              # Required for LiveStore sync
LIVESTORE_SYNC_URL=wss://app.runt.run   # Optional, defaults correctly  
NOTEBOOK_ID=custom-id                   # Optional, auto-generated
```

### Automation Options

```typescript
const automation = new NotebookAutomation({
  notebookId: "my-experiment",     // Custom ID (optional)
  executionTimeout: 60000,         // 60 second timeout  
  stopOnError: false,              // Continue on cell failures
  parameters: { debug: true }      // Global parameters
});
```

## 📁 Project Structure

```
runt-eval/
├── automation-with-runtime.ts    # ⭐ Combined automation + runtime
├── notebook-automation.ts        # Standalone automation client
├── example.json                  # Sample notebook for testing
├── parameters.json               # Parameter injection example
└── .env                         # AUTH_TOKEN configuration
```

## 🔍 Debugging

### Common Issues

**Cells stuck "Queued for execution"**
- Runtime agent not connected to same notebook ID
- Check AUTH_TOKEN in `.env` file

**Import/module errors**  
- Ensure all `@runt/*` dependencies in `deno.json`
- Use `--unstable-broadcast-channel` flag

**LiveStore connection issues**
- Verify `AUTH_TOKEN` is valid
- Check internet connection for sync

### Verification

Working system should show:
- ✅ Notebook creation with unique ID
- ✅ Cell execution completing (not just queued)
- ✅ Live URL accessible in browser
- ✅ Python outputs visible online

## 🚀 Integration

### Slack Notifications (Future)

```typescript
// After automation completes
const summary = automation.getExecutionSummary();
await slackWebhook({
  text: summary.success 
    ? `✅ Notebook completed: ${summary.notebookUrl}`
    : `❌ Notebook failed: ${summary.notebookUrl}`
});
```

### CI/CD Integration

```bash
# In GitHub Actions
- name: Run Data Validation
  run: |
    echo "AUTH_TOKEN=${{ secrets.AUTH_TOKEN }}" > .env
    deno task automate:runtime validation-notebook.json
```

### GitHub Actions Hourly Automation

This repository includes a GitHub Actions workflow that runs automation every hour.

**Setup:**

1. **Add Repository Secret**:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `AUTH_TOKEN`
   - Value: Your runt.run authentication token

2. **Enable Workflow**:
   - The workflow at `.github/workflows/hourly-automation.yml` runs automatically
   - Manual trigger: Go to Actions tab → "Hourly Notebook Automation" → "Run workflow"

3. **Monitor Results**:
   - Check Actions tab for execution logs
   - Each run creates a new live notebook at app.runt.run
   - Perfect for scheduled data reports, monitoring dashboards, etc.

The workflow will:
- ✅ Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00...)
- ✅ Execute the example notebook with real Python code
- ✅ Output the live notebook URL for inspection
- ✅ Clean up gracefully after completion

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`  
3. Test changes: `deno task automate:runtime:example`
4. Ensure no TypeScript errors: `deno check *.ts`
5. Submit pull request

## 📚 Related

- [runt.run Platform](https://app.runt.run) - Live collaborative notebooks
- [LiveStore Docs](https://docs.livestore.dev) - Event-sourcing framework
- [Pyodide](https://pyodide.org) - Python in WebAssembly

## 📜 License

See LICENSE file for details.

---

**Status**: ✅ Working system ready for production use!