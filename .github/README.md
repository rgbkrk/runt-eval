# GitHub Actions Setup for Runt-Eval

This directory contains GitHub Actions workflows for automated notebook execution.

## 🕐 Hourly Automation Workflow

The `hourly-automation.yml` workflow automatically runs notebook automation every hour, creating live collaborative notebooks on the runt.run platform.

### Setup Instructions

#### 1. Add Repository Secret

You need to add your runt.run authentication token as a GitHub repository secret:

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Enter:
   - **Name**: `AUTH_TOKEN`
   - **Value**: Your runt.run authentication token

#### 2. Workflow Configuration

The workflow is already configured in `.github/workflows/hourly-automation.yml` and will:

- **Run automatically** every hour at minute 0 (1:00, 2:00, 3:00, etc.)
- **Execute** the example notebook with real Python code
- **Create** a live notebook at `https://app.runt.run/?notebook=automation-{id}`
- **Log** the notebook URL for easy access
- **Clean up** gracefully after completion

#### 3. Manual Triggering

You can also trigger the workflow manually:

1. Go to **Actions** tab in your repository
2. Select **"Hourly Notebook Automation"**
3. Click **"Run workflow"**

### Workflow Output

Each successful run will output:
```
✅ Hourly automation completed successfully!
📔 Notebook available at: https://app.runt.run/?notebook=automation-abc123-def456
🕐 Run time: Mon Jan 15 14:00:00 UTC 2024
```

### Customization

To modify the automation:

1. **Change schedule**: Edit the `cron` expression in the workflow file
2. **Different notebook**: Replace `example.json` with your own notebook
3. **Add parameters**: Use `automate:runtime:with-params` task instead
4. **Add notifications**: Extend workflow to post to Slack, email, etc.

### Example Custom Workflow

```yaml
- name: Run custom data analysis
  run: |
    deno task automate:runtime:with-params my-analysis.json daily-params.json

- name: Post to Slack
  uses: 8398a7/action-slack@v3
  with:
    status: success
    text: "📊 Daily report ready: ${{ steps.automation.outputs.url }}"
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Troubleshooting

**Workflow fails with authentication error:**
- Verify `AUTH_TOKEN` secret is set correctly
- Check that the token is valid and has proper permissions

**Automation runs but cells stay queued:**
- This indicates the runtime agent couldn't start properly
- Check the workflow logs for Deno/Pyodide initialization errors

**No notebook URL in output:**
- The URL extraction depends on the expected output format
- Check if the automation completed successfully in the logs

### Monitoring

- View all workflow runs in the **Actions** tab
- Each run shows execution time and success/failure status
- Click on individual runs to see detailed logs
- Live notebooks remain accessible at app.runt.run indefinitely

This setup enables fully automated, scheduled data science workflows with live, shareable results!