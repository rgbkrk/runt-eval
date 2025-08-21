# GitHub Actions Setup for Runt-Eval

This directory contains GitHub Actions workflows for automated notebook
execution.

## 🕐 Hourly Automation Workflow

The `hourly-automation.yml` workflow automatically runs YAML notebook automation
every hour, creating live collaborative notebooks on the runt.run platform.

### Setup Instructions

#### 1. Add Repository Secret

You need to add your runt.run authentication token as a GitHub repository
secret:

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Enter:
   - **Name**: `RUNT_API_KEY` (preferred)
   - **Value**: Your runt.run API key
   
   Or as fallback:
   - **Name**: `AUTH_TOKEN`
   - **Value**: Your runt.run authentication token

#### 2. Workflow Configuration

The workflow is already configured in `.github/workflows/hourly-automation.yml`
and will:

- **Run automatically** every hour at minute 37 (1:37, 2:37, 3:37, etc.)
- **Execute** the YAML notebook with real Python code
- **Create** a live notebook at `https://app.runt.run/?notebook=automation-{id}`
- **Show complete logs** in GitHub Actions (no URL extraction needed)
- **Clean up** gracefully after completion

#### 3. Manual Triggering

You can also trigger the workflow manually:

1. Go to **Actions** tab in your repository
2. Select **"Hourly Notebook Automation"**
3. Click **"Run workflow"**

### Workflow Output

Each successful run will show complete automation logs including:

```
🚀 Starting hourly automation at Mon Jan 15 14:37:00 UTC 2024
📔 Using notebook ID: automation-abc123-def456
🚀 Starting notebook automation via LiveStore
📖 Cells to execute: 5
✅ Cell setup completed in 2045ms
✅ Cell data-generation completed in 2056ms
...
🌐 View live notebook: https://app.runt.run/?notebook=automation-abc123-def456
✅ Automation completed at Mon Jan 15 14:37:30 UTC 2024
```

### Customization

To modify the automation:

1. **Change schedule**: Edit the `cron` expression in the workflow file
2. **Different notebook**: Replace `example.yml` with your own YAML notebook
3. **Custom parameters**: Edit the YAML notebook's `parameters` section
4. **Add notifications**: Extend workflow to post to Slack, email, etc.

### Example Custom Workflow

```yaml
- name: Run custom data analysis
  run: |
    deno task automate:runtime my-analysis.yml

- name: Post to Slack
  uses: 8398a7/action-slack@v3
  with:
    status: success
    text: "📊 Daily report ready: Check GitHub Actions logs for notebook URL"
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Troubleshooting

**Workflow fails with authentication error:**

- Verify `RUNT_API_KEY` or `AUTH_TOKEN` secret is set correctly
- Check that the token is valid and has proper permissions

**Automation runs but cells stay queued:**

- This indicates the runtime agent couldn't start properly
- Check the workflow logs for Deno/Pyodide initialization errors

**Can't find notebook URL:**

- Look for "View live notebook:" in the complete automation logs
- The URL is printed at the end of successful executions

### Monitoring

- View all workflow runs in the **Actions** tab
- Each run shows execution time and success/failure status
- Click on individual runs to see detailed logs
- Live notebooks remain accessible at app.runt.run indefinitely

This setup enables fully automated, scheduled data science workflows with live,
shareable results!
