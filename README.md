# Runt-Eval: Reactive Notebook Automation

[![Status: Production Ready ✅](https://img.shields.io/badge/Status-Production%20Ready%20%E2%9C%85-success)](https://github.com/rgbkrk/runt-eval)

Papermill-style notebook automation for the [runt.run](https://app.runt.run)
platform with **true reactive coordination**. Creates live, collaborative notebooks from clean YAML configurations that execute Python code with instant response times through LiveStore's event-sourcing framework.

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
- **Executes Python cells** using Pyodide runtime with reactive coordination
- **Provides shareable URLs** for real-time collaboration
- **Injects parameters** for reproducible experiments
- **Runs entirely in-process** with parallel startup optimization
- **Instant reactive execution** - no polling, no artificial delays

Perfect for automated data science workflows that execute fast and provide
live results that humans can inspect and collaborate on in real-time.

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

Create a YAML notebook file:

```yaml
metadata:
  title: "My Data Analysis"
  runtime: "python3"

parameters:
  data_size: 1000
  debug_mode: true

cells:
  - id: "setup"
    source: |
      import pandas as pd
      print(f'Hello from automation! Using {data_size} rows')

  - id: "analysis"
    source: |
      df = pd.DataFrame({'x': range(data_size)})
      print(f'Created DataFrame with {len(df)} rows')
```

Then run: `deno task automate:runtime your-notebook.yml`

### Parameter Injection

Parameters can be embedded directly in YAML notebooks:

```yaml
parameters:
  experiment_name: "test_run"
  data_size: 1000
  model_type: "random_forest"

cells:
  - id: "analysis"
    source: |
      print(f'Running {experiment_name} with {data_size} samples')
      model = model_type
```

Or passed via separate JSON file for legacy support. Parameters are
automatically injected as the first cell:

```python
# Parameters injected by automation  
experiment_name = "test_run"
data_size = 1000
model_type = "random_forest"
```

## 🏗️ Architecture

### YAML Notebook Format

Clean, readable configuration format instead of verbose JSON:

```yaml
metadata:
  title: "Analysis Title"
  description: "What this notebook does"
  runtime: "python3"
  tags: ["data-science", "automation"]

parameters:
  data_size: 100
  output_format: "png"

cells:
  - id: "setup"
    source: |
      import pandas as pd
      print('Starting analysis...')
```

### Reactive LiveStore Coordination

This uses **true reactive LiveStore coordination** with instant response to execution state changes:

- **Events**: `notebookInitialized`, `cellCreated`, `executionRequested`
- **Tables**: `executionQueue`, `outputs`, `cells` with reactive subscriptions  
- **Sync**: Real-time collaboration via WebSocket
- **Reactive execution**: Immediate response when cells complete/fail (no timeouts or polling)
- **Parallel startup**: Runtime agent and automation client initialize concurrently

### Reactive Same-Process Coordination

The `main.ts` script runs both components with optimized parallel startup:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Automation      │───▶│ LiveStore Events │◀───│ Pyodide Runtime│
│ Client          │    │ & Reactive Subs  │    │ Agent          │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    Create cells          Reactive coordination    Execute Python
    Submit execution      Instant event response   Store outputs
    
Parallel Startup: ✅ No blocking waits ✅ Concurrent initialization
Reactive Flow:    ✅ No polling      ✅ Immediate cell transitions
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
  notebookId: "my-experiment", // Custom ID (optional)
  executionTimeout: 60000, // 60 second timeout
  stopOnError: false, // Continue on cell failures
  parameters: { debug: true }, // Global parameters
});
```

## 📁 Project Structure

```
runt-eval/
├── automation-with-runtime.ts    # ⭐ Combined automation + runtime
├── notebook-automation.ts        # Standalone automation client
├── example.yml                   # ⭐ YAML notebook example
├── example.json                  # Legacy Jupyter format support
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
    : `❌ Notebook failed: ${summary.notebookUrl}`,
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

This repository includes a GitHub Actions workflow that runs automation every
hour.

**Setup:**

1. **Add Repository Secret**:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `AUTH_TOKEN`
   - Value: Your runt.run authentication token

2. **Enable Workflow**:
   - The workflow at `.github/workflows/hourly-automation.yml` runs
     automatically
   - Manual trigger: Go to Actions tab → "Hourly Notebook Automation" → "Run
     workflow"

3. **Monitor Results**:
   - Check Actions tab for execution logs
   - Each run creates a new live notebook at app.runt.run
   - Perfect for scheduled data reports, monitoring dashboards, etc.

The workflow will:

- ✅ Run every hour at minute 37 (e.g., 1:37, 2:37, 3:37...)
- ✅ Execute the YAML notebook with real Python code
- ✅ Show complete execution logs in GitHub Actions
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

## 🔬 Technical Architecture

### Reactive Execution Flow

The system provides a "React version for terminal" experience through:

- **LiveStore reactive subscriptions** for execution state monitoring
- **Instant response** to completion/failure events (no timeouts)
- **Parallel initialization** of runtime and automation components  
- **Linear notebook execution** with immediate cell-to-cell transitions
- **Async cleanup workaround** for LiveStore's "destroyed thunk" issue

### Performance Characteristics

- **Cell execution**: 150-650ms typical response times
- **No artificial delays**: Pure event-driven coordination
- **Startup optimization**: Runtime and automation start concurrently
- **Clean termination**: Graceful shutdown without hanging

### Future Optimizations

**Next level performance improvements to explore:**

1. **Pre-queue all executions**: Submit entire execution plan upfront while runtime bootstraps
2. **Notebook structure prefill**: Create all cells and metadata before runtime is ready
3. **Reactive execution consumption**: Let runtime agent process queue as fast as possible
4. **Pyodide bootstrap optimization**: Investigate if package loading can be parallelized

*Note: May hit artificial roadblock from Pyodide dependency bootstrapping timing*

---

**Status**: ✅ Production-ready reactive automation system!
