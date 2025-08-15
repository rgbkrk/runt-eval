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
