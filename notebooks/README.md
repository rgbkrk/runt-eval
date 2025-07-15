# Infrastructure Monitoring Notebooks

This directory contains automated monitoring notebooks for infrastructure health checks and analytics.

## 📊 Available Notebooks

### `simple-health-check.yml`
**Purpose**: Basic health monitoring without external dependencies  
**Runtime**: ~30 seconds  
**Features**:
- Mock system component status checks
- Performance metrics simulation
- Alert detection and recommendations
- Health scoring algorithm
- No external API dependencies (works immediately)

**Usage**:
```bash
deno task health:simple
```

### `daily-health-check.yml`
**Purpose**: Daily infrastructure monitoring with Cloudflare Analytics  
**Runtime**: ~10 seconds  
**Features**:
- Workers performance monitoring (requests, errors, CPU time)
- D1 database health checks (queries, latency, storage)
- Configurable alert thresholds
- Optional Slack webhook notifications
- Focused daily reporting format

**Requirements**:
- `CLOUDFLARE_API_TOKEN` environment variable
- `CLOUDFLARE_ACCOUNT_ID` environment variable
- Optional: `SLACK_WEBHOOK_URL` for notifications

**Usage**:
```bash
deno task health:daily
```

### `infrastructure-monitoring.yml`
**Purpose**: Comprehensive infrastructure analytics dashboard  
**Runtime**: ~45 seconds  
**Features**:
- Full Cloudflare GraphQL Analytics integration
- D1 database metrics with visualizations
- Workers performance analysis
- Real-time dashboards with matplotlib
- Detailed alert system with health scoring
- Historical trend analysis

**Requirements**:
- `CLOUDFLARE_API_TOKEN` environment variable
- `CLOUDFLARE_ACCOUNT_ID` environment variable

**Usage**:
```bash
deno task health:full
```

### `error-test.yml`
**Purpose**: Test error handling and stopOnError behavior  
**Runtime**: ~5 seconds (fails intentionally)  
**Features**:
- Validates sequential execution with error handling
- Tests stopOnError configuration
- Demonstrates failure detection and reporting

**Usage**:
```bash
deno task test:error
```

## 🔐 Environment Setup

Create a `.env` file in the root directory with:

```bash
# Required for LiveStore sync
AUTH_TOKEN=your-runt-auth-token

# Required for Cloudflare monitoring notebooks
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id

# Optional for Slack notifications
SLACK_WEBHOOK_URL=your-slack-webhook-url
```

## 🚀 Quick Start

1. **Test the system** (no external dependencies):
   ```bash
   deno task health:simple
   ```

2. **Set up real monitoring** (requires Cloudflare credentials):
   ```bash
   # Add credentials to .env file
   deno task health:daily
   ```

3. **Run comprehensive analysis**:
   ```bash
   deno task health:full
   ```

## 📈 Automation Schedule

These notebooks are designed for automated execution:

- **Daily**: `daily-health-check.yml` - Quick health status
- **Weekly**: `infrastructure-monitoring.yml` - Comprehensive analysis
- **On-demand**: `simple-health-check.yml` - Testing and demos

## 🔧 Customization

### Alert Thresholds

Modify parameters in the notebook files:

```yaml
parameters:
  critical_error_rate: 10.0    # Percent
  warning_error_rate: 5.0      # Percent
  high_latency_ms: 2000        # Milliseconds
```

### Time Ranges

Adjust monitoring periods:

```yaml
parameters:
  hours_back: 24              # Hours to analyze
```

### Slack Integration

Configure webhook notifications:

```yaml
parameters:
  slack_webhook: "${SLACK_WEBHOOK_URL}"
```

## 📊 Output

All notebooks generate:
- **Console logs**: Real-time execution status
- **Live notebooks**: Interactive results at `https://app.runt.run/?notebook={id}`
- **Health reports**: Structured status summaries
- **Recommendations**: Actionable insights

## 🐛 Troubleshooting

**Runtime session timeout**: 
- Check AUTH_TOKEN is valid
- Verify network connectivity

**Cloudflare API errors**:
- Validate CLOUDFLARE_API_TOKEN permissions
- Confirm CLOUDFLARE_ACCOUNT_ID is correct

**Error handling issues**:
- Run `deno task test:error` to validate system behavior
- Check that stopOnError is working correctly

## 🔮 Future Enhancements

- [ ] Secret management for secure credential injection
- [ ] Custom metric collection from additional sources  
- [ ] Advanced alerting with PagerDuty/OpsGenie integration
- [ ] Trend analysis and predictive alerting
- [ ] Multi-environment monitoring (staging, production)