# Local Development Setup

This guide explains how to run runt-eval using your local development versions of anode, livestore, and runt instead of the published packages.

## 🏗️ Prerequisites

Ensure you have the following repositories cloned in your development directory:

```
runtimed/
├── anode/          # UI and LiveStore backend
├── runt/           # Runtime packages and agents
└── runt-eval/      # This automation project
```

## 🚀 Quick Setup

1. **Run the setup script**:
   ```bash
   ./setup-local-dev.sh
   ```

2. **Set your AUTH_TOKEN** in the `.env` file:
   ```bash
   # Edit .env and set your token
   AUTH_TOKEN=your-actual-auth-token
   ```

3. **Start anode** (if not already running):
   ```bash
   cd ../anode
   pnpm dev
   ```

4. **Run the mount demo with local packages**:
   ```bash
   deno task demo:mount:local
   ```

## 📁 Configuration Files

### deno.dev.json
This file contains the local import mappings:

```json
{
  "imports": {
    "@runt/lib": "../runt/packages/lib/mod.ts",
    "@runt/pyodide-runtime-agent": "../runt/packages/pyodide-runtime-agent/src/mod.ts",
    "@runt/schema": "../runt/packages/schema/mod.ts",
    "@runt/ai": "../runt/packages/ai/mod.ts"
  }
}
```

### .env
Your environment configuration:

```bash
AUTH_TOKEN=your-auth-token-here
DEV_MODE=true
# Optional: LIVESTORE_SYNC_URL=wss://localhost:8787
```

## 🎯 Available Commands

### Local Development Commands
```bash
# Run mount demo with local packages
deno task demo:mount:local

# Run automation with local packages
deno run --env-file=.env --allow-all --unstable-broadcast-channel --config deno.dev.json main.ts notebooks/example.yml

# Run celltypes demo with local packages
deno run --env-file=.env --allow-all --unstable-broadcast-channel --config deno.dev.json main.ts notebooks/celltypes-demo.yml

# Run with mounting features
deno run --env-file=.env --allow-all --unstable-broadcast-channel --config deno.dev.json main.ts notebooks/mount-demo.yml --mount ./data --mount-readonly --output-dir ./outputs
```

### Production Commands (JSR packages)
```bash
# Run mount demo with published packages
deno task demo:mount

# Run automation with published packages
deno task automate
```

## 🔧 Development Workflow

### 1. Making Changes to Runt Packages

When you modify code in the `../runt` repository:

1. **Test your changes** in the runt repository first
2. **Run runt-eval** with local packages to test integration:
   ```bash
   deno task demo:mount:local
   ```

### 2. Making Changes to Anode

When you modify the anode UI or backend:

1. **Restart anode** if needed:
   ```bash
   cd ../anode
   pnpm dev
   ```
2. **Test the integration** with runt-eval:
   ```bash
   deno task demo:mount:local
   ```

### 3. Testing LiveStore Changes

If you're working on LiveStore:

1. **Update the sync URL** in `.env` if using a local LiveStore instance
2. **Test the connection** with runt-eval

## 🐛 Troubleshooting

### Common Issues

**"Module not found" errors**:
```bash
# Check that local packages exist
ls ../runt/packages/lib/mod.ts
ls ../runt/packages/schema/mod.ts
```

**Authentication errors**:
```bash
# Verify your AUTH_TOKEN is set
echo $AUTH_TOKEN
```

**Anode connection issues**:
```bash
# Check if anode is running
curl http://localhost:5173
```

**Mounting not working**:
```bash
# Check that data directory exists
ls -la data/
```

### Debug Mode

Run with verbose logging:
```bash
RUNT_LOG_LEVEL=DEBUG deno task demo:mount:local
```

## 🔄 Switching Between Local and Production

### Use Local Packages
```bash
deno run --config deno.dev.json main.ts notebooks/mount-demo.yml
```

### Use Production Packages
```bash
deno run main.ts notebooks/mount-demo.yml
```

## 🆕 New Features

### Cell Types Support

The YAML notebook format now supports different cell types:

```yaml
cells:
  - id: "code-example"
    celltype: "code"  # Executes Python code (default)
    source: |
      import pandas as pd
      print("Hello from Python!")

  - id: "ai-example"
    celltype: "ai"    # Uses AI for analysis and insights
    source: |
      Analyze this dataset and provide insights about the patterns.

  - id: "default-example"
    source: |         # No celltype specified - defaults to "code"
      print("This defaults to code cell type")
```

**Supported cell types**:
- `code` (default): Python code execution
- `ai`: AI-powered analysis and insights
- `markdown`: Documentation and text
- `sql`: Database queries
- `raw`: Raw content display

**Testing cell types**:
```bash
# Test with local packages
deno run --config deno.dev.json main.ts notebooks/celltypes-demo.yml

# Test with production packages
deno run main.ts notebooks/celltypes-demo.yml

# Test with unique notebook IDs (useful for multiple runs)
deno run main.ts notebooks/celltypes-demo.yml --unique

# Test with custom notebook ID
deno run main.ts notebooks/celltypes-demo.yml --notebook-id my-test-run
```

#### Notebook ID Behavior

The notebook ID generation follows this priority order:

1. **`--notebook-id` flag**: Explicitly specified notebook ID
2. **`--unique` flag**: Force unique ID for each run (overrides environment variable)
3. **`NOTEBOOK_ID` environment variable**: Custom ID from environment
4. **Auto-generated**: Timestamp-based ID (reproducible for same YAML file)

This allows for flexible notebook management:
- **Reproducible runs**: Same YAML = same notebook ID (default)
- **Unique runs**: `--unique` flag for testing/CI
- **Named experiments**: `--notebook-id` for organized workflows

## 📊 Example: Full Development Workflow

1. **Start development environment**:
   ```bash
   # Terminal 1: Start anode
   cd ../anode && pnpm dev
   
   # Terminal 2: Run runt-eval with local packages
   cd runt-eval && deno task demo:mount:local
   ```

2. **Make changes to runt packages**:
   ```bash
   # Edit ../runt/packages/lib/src/runtime-agent.ts
   # Test changes
   deno task demo:mount:local
   ```

3. **Make changes to anode**:
   ```bash
   # Edit ../anode/src/components/notebook/NotebookViewer.tsx
   # Changes auto-reload in anode
   # Test integration with runt-eval
   ```

4. **Test with production packages**:
   ```bash
   # Compare with published versions
   deno task demo:mount
   ```

## 🎉 Benefits of Local Development

- **Instant feedback**: See changes immediately without publishing
- **Full integration testing**: Test anode + runt + livestore together
- **Debugging**: Easier to debug issues across the stack
- **Development speed**: No need to publish packages for testing

## 📚 Related Documentation

- [Anode Development Guide](../anode/CONTRIBUTING.md)
- [Runt Development Guide](../runt/README.md)
- [LiveStore Documentation](https://docs.livestore.dev)
