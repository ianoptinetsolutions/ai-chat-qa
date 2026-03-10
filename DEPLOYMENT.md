# Deployment Guide — Chat QA Automation

Complete setup instructions for deploying all 8 workflows to a fresh n8n cloud instance at `https://automateoptinet.app.n8n.cloud/`.

Before you start, run the validator to confirm all files are clean:
```
python validate_workflows.py
```
Expected: `All 8 workflow(s) passed validation.`

---

## Step 1: Create the Google Sheets Database

1. Go to https://sheets.google.com and create a new spreadsheet
2. Name it: **Chat QA Database**
3. Create **9 tabs** with exactly these names (case-sensitive):

| Tab Name | Purpose |
|----------|---------|
| Raw_Conversations | Intercom conversation transcripts |
| Analysis_Results | Claude AI analysis output per conversation |
| Report_Log | Daily summary report log |
| Agent_Team_Mapping | Agent → team leader mapping |
| Tickets | Auto-created tickets for Medium/High/Critical issues |
| Alert_Log | Real-time critical alert log |
| Weekly_Trends | 7-day rolling pattern detection results |
| Accuracy_Log | AI accuracy feedback tracking |
| Monthly_Reports | Monthly HTML report drafts |

4. Add column headers to each tab (Row 1). Use the definitions in `/schemas/` — one schema file per tab.

5. Your Sheet ID is already set in all workflow files:
   `1QoCwPRGPBjHXfCA_Pa3A-WpC9Qf1J6DKfiVJEW0sFXo`

---

## Step 2: Create n8n Credentials

In n8n: **Settings → Credentials → Add Credential**

Create these 5 credentials with **exactly** these names and IDs:

### Credential 1 — Google Sheets OAuth2
- Type: **Google Sheets OAuth2 API**
- Name: `Google Sheets`
- Credential ID (set manually or note after creation): `google_sheets_oauth`
- Click **Connect** and authorize with your Google account
- Required scope: `https://www.googleapis.com/auth/spreadsheets`

### Credential 2 — Gmail OAuth2
- Type: **Gmail OAuth2 API**
- Name: `Gmail`
- Credential ID: `gmail_oauth`
- Click **Connect** and authorize
- Required scope: `https://www.googleapis.com/auth/gmail.send`

### Credential 3 — Slack API
- Type: **Slack API**
- Name: `Slack`
- Credential ID: `slack_api`
- Bot Token: `YOUR_SLACK_BOT_TOKEN`

### Credential 4 — Anthropic API (HTTP Header Auth)
- Type: **Header Auth**
- Name: `Anthropic API`
- Credential ID: `anthropic_api`
- Header Name: `x-api-key`
- Header Value: `YOUR_ANTHROPIC_API_KEY`

### Credential 5 — Intercom API (HTTP Header Auth)
- Type: **Header Auth**
- Name: `Intercom API`
- Credential ID: `intercom_api`
- Header Name: `Authorization`
- Header Value: `Bearer YOUR_INTERCOM_API_TOKEN`

> **Note:** n8n assigns its own internal credential IDs after creation. The IDs listed above (`google_sheets_oauth`, `anthropic_api`, etc.) are the values referenced inside the workflow JSON files. When you import a workflow, n8n will prompt you to map credential references — select the matching credential you just created.

---

## Step 3: Import Workflows

In n8n: **Workflows → Import from file**

Import in this exact order. **Do not activate yet.**

| Order | File | Trigger type |
|-------|------|-------------|
| 1 | `workflows/wf4-auto-ticket-creation.json` | Called by WF2 |
| 2 | `workflows/wf5-critical-alerts.json` | Called by WF2 |
| 3 | `workflows/wf2-ai-analysis.json` | Called by WF1 |
| 4 | `workflows/wf1-daily-data-collection.json` | Schedule 06:00 UTC |
| 5 | `workflows/wf3-daily-summary-report.json` | Schedule 07:30 UTC |
| 6 | `workflows/wf6-pattern-detection.json` | Schedule 08:00 UTC |
| 7 | `workflows/wf7-feedback-loop.json` | Every 6 hours |
| 8 | `workflows/wf8-monthly-report.json` | 1st of month 08:00 UTC |

> Import sub-workflows (WF4, WF5) first so they exist before WF2 references them.

---

## Step 4: Update Execute Workflow IDs (REQUIRED)

After import, n8n assigns each workflow a numeric ID visible in the URL:
`https://automateoptinet.app.n8n.cloud/workflow/**{ID}**/edit`

Three nodes use placeholder workflow IDs that must be updated:

| Workflow to edit | Node name | Field | Set to |
|-----------------|-----------|-------|--------|
| WF1 | Trigger WF2 | workflowId | WF2's actual n8n ID |
| WF2 | Trigger WF4 Ticket | workflowId | WF4's actual n8n ID |
| WF2 | Trigger WF5 Alert | workflowId | WF5's actual n8n ID |

Update these directly in the n8n editor:
1. Open the workflow
2. Click the Execute Workflow node
3. In the workflowId field, select the correct workflow from the dropdown (or enter the numeric ID)
4. Save

---

## Step 5: Populate Agent Team Mapping

Open your Google Sheet → **Agent_Team_Mapping** tab.

Add one row per support agent:

| agent_name | agent_email | team_leader_name | team_leader_slack_id |
|------------|-------------|-----------------|---------------------|
| John Smith | john@company.com | Sarah Lee | U012AB3CD |

**Important:** `agent_name` must exactly match the display name Intercom returns for that agent (check via the Intercom admin panel or from a raw conversation response).

---

## Step 6: Create Slack Channels

Ensure these channels exist in your Slack workspace:

| Channel | Used by |
|---------|---------|
| `#chat-qa-reports` | WF3 — daily summary |
| `#critical-alerts` | WF5 — real-time alerts |
| `#chat-qa-trends` | WF6 — pattern detection |
| `#critical-escalations` | WF4 — critical ticket escalation |
| `#chat-qa-inbox` | WF4 — fallback when no team leader mapping |

Invite the Slack bot to each channel: `/invite @your-bot-name`

---

## Step 7: Test Each Workflow Before Activating

Test in this order. **Use the n8n "Test workflow" button, not activation.**

### WF2 Test (most critical — tests the full AI pipeline)
1. Manually add a test row to **Raw_Conversations** sheet with a realistic transcript
2. Open WF2 → click **Test workflow**
3. Check **Analysis_Results** sheet for the output row
4. Verify: `severity`, `issue_category`, `agent_score`, `is_alert` are populated correctly
5. Check n8n execution log — no errors

### WF1 Test
1. Open WF1 → click **Test workflow**
2. Should fetch Intercom conversations closed in the last 24h
3. Check **Raw_Conversations** sheet for new rows
4. Confirm WF2 was triggered (check WF2's execution history)

### WF3 Test
1. Open WF3 → click **Test workflow**
2. Check inbox at `hannahporter1905@gmail.com` for the daily report email
3. Check `#chat-qa-reports` Slack channel for the summary post

### WF4 Test
1. Add a test row to **Analysis_Results** with `severity = High`, `is_alert = FALSE`
2. Open WF4 → Test workflow
3. Check **Tickets** sheet for a new row
4. Check Slack — the team leader should receive a DM

### WF5 Test
1. Add a test row to **Analysis_Results** with `is_alert = TRUE`
2. Open WF5 → Test workflow
3. Check **Alert_Log** sheet
4. Check `#critical-alerts` Slack channel
5. Check inbox for alert email

### WF6 Test
- Open WF6 → Test workflow (needs 7 days of data in Analysis_Results to be meaningful)

### WF7 Test
- Manually set `feedback = Agree` on a Tickets row
- Open WF7 → Test workflow
- Check **Accuracy_Log** for new row

### WF8 Test
- Open WF8 → Test workflow
- Check `hannahporter1905@gmail.com` inbox for the monthly draft email
- Check **Monthly_Reports** sheet for a new row with `status = draft`

---

## Step 8: Activate Workflows

Activate in this order only after all tests pass:

| Order | Workflow | Why this order |
|-------|----------|---------------|
| 1 | WF4 | Sub-workflow — must be active before WF2 calls it |
| 2 | WF5 | Sub-workflow — must be active before WF2 calls it |
| 3 | WF2 | Must be active before WF1 triggers it |
| 4 | WF1 | Starts the daily chain at 06:00 UTC |
| 5 | WF3 | Daily report at 07:30 UTC |
| 6 | WF6 | Daily pattern detection at 08:00 UTC |
| 7 | WF7 | Every 6h feedback loop |
| 8 | WF8 | Monthly — safe to activate last |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| WF2 Claude call returns 400 | Wrong request format | Check "Build OpenAI Request" node: `system` must be a string, `messages` must be user-only |
| WF2 Claude call returns 401 | Wrong API key | Re-check `anthropic_api` credential — header name must be `x-api-key` |
| WF2 Parse error `[PARSE ERROR]` | Claude returned non-JSON | Check system prompt in "Build OpenAI Request" — must end with JSON schema example |
| Google Sheets auth error | OAuth expired or wrong scope | Re-authorize `google_sheets_oauth` credential |
| Slack message not delivered | Bot not in channel | Run `/invite @bot-name` in the channel |
| WF4 Slack DM not sent | Missing agent mapping | Add the agent row to Agent_Team_Mapping sheet |
| WF1 → WF2 doesn't chain | Workflow ID not updated | Update "Trigger WF2" node workflowId (Step 4) |
| WF2 → WF4/WF5 doesn't chain | Workflow IDs not updated | Update "Trigger WF4 Ticket" and "Trigger WF5 Alert" nodes (Step 4) |
| 0 conversations fetched | Intercom token expired | Test token at: `curl -H "Authorization: Bearer TOKEN" https://api.intercom.io/me` |
| Monthly report not sending | WF8 not activated or wrong date | Check activation status; WF8 only triggers on the 1st of the month |

---

## Data Flow Summary

```
06:00 UTC  WF1 — Fetch Intercom conversations → Raw_Conversations sheet
                   ↓ (chains to)
           WF2 — Claude AI analysis per conversation
                   ↓ severity=Medium/High/Critical → WF4 (ticket + Slack DM)
                   ↓ is_alert=true               → WF5 (Slack alert + email)
                   ↓ all results                 → Analysis_Results sheet

07:30 UTC  WF3 — Compile daily metrics → email + Slack report

08:00 UTC  WF6 — 7-day pattern detection → Claude trend summary → #chat-qa-trends

Every 6h   WF7 — Process feedback from Tickets sheet → Accuracy_Log

1st/month  WF8 — Monthly report → Claude HTML generation → email draft to QA Manager
```
