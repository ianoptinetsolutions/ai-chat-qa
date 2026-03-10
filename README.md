# Chat Monitoring & Analysis System

Automated daily QA system that pulls closed Intercom conversations, analyzes them with Claude, generates summary reports, creates tickets, sends critical alerts, detects patterns, and produces monthly reports.

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Orchestration | n8n (self-hosted or cloud) |
| AI Analysis | Claude (claude-sonnet-4-6, temperature 0.1, JSON mode) |
| Database | Supabase (9 tables) |
| Notifications | Slack (channels + DMs) |
| Email | Gmail (HTML reports) |
| Data Source | Intercom API (conversations) |

---

## Quick Start

### 1. Set Up Supabase

Create a new Supabase project and run the SQL in `supabase_setup.sql` to create all required tables. Column definitions are also available in `/schemas/`:

| Table Name | Schema File |
|------------|-------------|
| raw_conversations | schemas/raw-conversations.json |
| analysis_results | schemas/analysis-results.json |
| report_log | schemas/report-log.json |
| agent_team_mapping | schemas/agent-team-mapping.json |
| tickets | schemas/tickets.json |
| alert_log | schemas/alert-log.json |
| weekly_trends | schemas/weekly-trends.json |
| accuracy_log | schemas/accuracy-log.json |
| monthly_reports | schemas/monthly-reports.json |

Copy your **Project URL** and **anon/service_role API key** from Supabase → Project Settings → API.

### 2. Create n8n Credentials

In n8n Settings → Credentials, create these credentials with exactly these names:

| Credential Name | Type | Notes |
|-----------------|------|-------|
| `supabase_api` | Supabase API | Project URL + service_role key |
| `gmail_oauth` | Gmail OAuth2 | Needs send scope |
| `slack_api` | Slack API | Bot token with chat:write |
| `anthropic_api` | HTTP Header Auth | Header: `Authorization`, Value: `Bearer sk-ant-...` |
| `intercom_api` | HTTP Header Auth | Header: `Authorization`, Value: `Bearer YOUR_TOKEN` |

### 3. Set Environment Variables

In n8n Settings → Environment Variables, set all of the following before importing workflows:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://xyz.supabase.co`) |
| `SUPABASE_API_KEY` | Your Supabase service_role API key |
| `SLACK_CHANNEL_REPORTS` | Channel ID for `#chat-qa-reports` |
| `SLACK_CHANNEL_ALERTS` | Channel ID for `#critical-alerts` |
| `SLACK_CHANNEL_ESCALATIONS` | Channel ID for `#critical-escalations` |
| `SLACK_CHANNEL_TRENDS` | Channel ID for `#chat-qa-trends` |
| `GMAIL_DISTRIBUTION_LIST` | QA team email list (comma-separated) |
| `STAKEHOLDERS_EMAIL` | Stakeholders email list for critical alerts |
| `QA_MANAGER_EMAIL` | QA Manager email for monthly reports |
| `QA_MANAGER_SLACK_ID` | QA Manager Slack user ID (e.g. `U012AB3CD`) |
| `WF4_WORKFLOW_ID` | n8n ID of WF4 — set AFTER importing workflows (see Step 5) |
| `WF5_WORKFLOW_ID` | n8n ID of WF5 — set AFTER importing workflows (see Step 5) |

> **Note on Slack channel IDs:** Right-click any channel in Slack → View channel details → Copy the channel ID at the bottom (starts with `C`).

### 4. Import Workflows

In n8n, go to **Workflows → Import** and import each JSON file from `/workflows/` **in order**:

1. `wf1-daily-data-collection.json`
2. `wf2-ai-analysis.json`
3. `wf3-daily-summary-report.json`
4. `wf4-auto-ticket-creation.json`
5. `wf5-critical-alerts.json`
6. `wf6-pattern-detection.json`
7. `wf7-feedback-loop.json`
8. `wf8-monthly-report.json`

### 5. Set WF4 and WF5 Workflow IDs

After importing, WF2 triggers WF4 and WF5 via their n8n workflow IDs. You must set these after import:

1. Open WF4 in n8n → copy the workflow ID from the URL (e.g. `https://your-n8n.com/workflow/abc123` → ID is `abc123`)
2. Set `WF4_WORKFLOW_ID=abc123` in n8n environment variables
3. Repeat for WF5 → set `WF5_WORKFLOW_ID=...`

### 6. Populate Agent Team Mapping

Add rows to the `agent_team_mapping` Supabase table:

```
agent_name | agent_email | team_leader_name | team_leader_slack_id
John Smith | john@co.com | Sarah Lee         | U012AB3CD
```

Agent names must match exactly what Intercom returns as the admin name.

### 7. Activate Workflows

Activate workflows in this order. Test each before activating the next.

---

## Workflow Overview

### WF1 — Daily Data Collection
- **Trigger**: 06:00 UTC daily
- Fetches closed Intercom conversations from last 24h
- Filters bot-only conversations
- Formats transcripts (replaces attachments with `[Image attached]`)
- Deduplicates against raw_conversations table
- WF2 polls every 30 min for new `pending` records and processes them

### WF2 — AI Analysis
- **Trigger**: Every 30 minutes (polls for `analysis_status = pending`)
- Sends each conversation to Claude (JSON mode)
- Stores analysis in analysis_results table
- On parse error: writes `[PARSE ERROR]` row, marks conversation `analysis_status = error`
- Routes: `is_alert = true` → triggers WF5 first, then checks severity; Medium/High/Critical → triggers WF4; Low → report only

### WF3 — Daily Summary Report
- **Trigger**: 07:30 UTC daily
- Compiles daily metrics from analysis_results (last 24h, filtered at DB level)
- Sends HTML email to QA team
- Posts Block Kit summary to `#chat-qa-reports` Slack channel
- Logs to report_log table

### WF4 — Auto Ticket Creation
- **Trigger**: Called by WF2 (Medium/High/Critical severity)
- Creates ticket row in tickets table
- Sends Slack DM to team leader (from agent_team_mapping)
- Posts to `#critical-escalations` for Critical severity

### WF5 — Real-Time Critical Alerts
- **Trigger**: Called by WF2 (is_alert = true)
- Posts urgent Slack message to `#critical-alerts`
- Sends high-priority HTML email to stakeholders
- Logs to alert_log table

### WF6 — 7-Day Rolling Pattern Detection
- **Trigger**: 08:00 UTC daily
- Analyzes 7-day rolling window of analysis_results (filtered at DB level)
- Flags issue categories spiking >150% above average
- Identifies repeat complainers (3+ in 7 days)
- Uses Claude to generate trend summary + recommendations
- Posts to `#chat-qa-trends` **only when anomalies are detected**
- Stores in weekly_trends table always (even when no anomalies)

### WF7 — Feedback Loop Processing
- **Trigger**: Every 6 hours
- Reads tickets where `feedback_processed = false` (filtered at DB level)
- Processes only tickets with `feedback = Agree` or `Disagree`
- Calculates accuracy rate by category
- Writes to accuracy_log
- Marks tickets as `feedback_processed = true`

### WF8 — Monthly Report Generation
- **Trigger**: 1st of month, 08:00 UTC
- Fetches previous month data from all 3 tables in parallel (filtered at DB level), merged before processing
- Claude generates full HTML report with recommendations
- Emails DRAFT to QA Manager for review
- Stores in monthly_reports table (status = draft)
- QA Manager updates status to 'approved' before wider distribution

---

## File Structure

```
/workflows/           8 n8n workflow JSON files (import into n8n)
/prompts/             3 Claude system prompts
  conversation-analysis.txt     Master analysis prompt (WF2)
  trend-summary.txt             7-day trend prompt (WF6)
  monthly-report-html.txt       Monthly HTML report prompt (WF8)
/scripts/             14 JavaScript Code Node scripts (reference)
/schemas/             9 Supabase table column definitions
/templates/           3 HTML email templates (design reference)
supabase_setup.sql    Run this in Supabase SQL editor to create all tables
```

> **Note**: The `/scripts/` files are the canonical source of JavaScript logic. The same code is embedded in the n8n workflow JSON Code nodes. When updating logic, update both the script file and the workflow JSON.

---

## AI Analysis Specifications

### Dissatisfaction Severity

| Level | Criteria |
|-------|----------|
| Low | Minor frustration, fully resolved |
| Medium | Clear dissatisfaction, partially resolved |
| High | Strong dissatisfaction, issue unresolved, churn risk |
| Critical | Legal threats, VIP player, fraud, inappropriate agent |

### Issue Categories

Payment/Withdrawal · Game Bug · Login/Account · Bonus/Promotion · Technical Error · Slow Response · Inappropriate Communication · Other

### Resolution Detection

**Content-based only** — not Intercom's conversation status. A conversation Intercom marks "closed" where the player is still angry = Unresolved.

### Agent Scoring (1–5)

| Score | Meaning |
|-------|---------|
| 5 | Exceptional — empathetic, efficient, fully resolved |
| 4 | Good — professional, minor gaps |
| 3 | Adequate — resolved, communication could improve |
| 2 | Below Standard — robotic, repetitive, unresolved |
| 1 | Poor — rude, harmful, or dishonest |

### Ticket Threshold

Only **Medium, High, and Critical** create tickets. Low appears in daily report only.

### Alert Triggers

`is_alert = true` when:
- Legal/regulatory threat detected
- VIP/high-value player dissatisfied
- Agent uses inappropriate or harmful language
- Fraud indicators present
- Same player has 3+ complaints in 7 days (WF6 detects this retroactively)

---

## Feedback Loop

Team leaders review tickets in the tickets table and enter `Agree` or `Disagree` in the **feedback** column. WF7 polls every 6 hours, computes accuracy metrics, and logs them to accuracy_log.

Use accuracy data to identify which issue categories the AI misclassifies most frequently and refine the prompt in `prompts/conversation-analysis.txt`.

---

## Error Handling

- HTTP nodes: `retryOnFail: true, maxTries: 3`
- AI parse failures: WF2 writes a degraded row with `[PARSE ERROR]` in summary and sets `analysis_status = error` — no infinite retry loop
- WF3 with 0 conversations: sends report with "No conversations analyzed today" message
- Intercom pagination: if `pages.next` is not a URL string (cursor-based API), WF1 logs a warning to n8n execution log
- Failed workflows: configure n8n Error Workflow to Slack `#engineering-alerts`

---

## Data Retention

| Table | Retention |
|-------|-----------|
| raw_conversations | 90 days (delete old rows manually or via scheduled cleanup) |
| All others | Indefinite |

---

## Monthly Report Flow

1. WF8 generates DRAFT on 1st of month
2. Email sent to QA Manager with `[DRAFT]` subject prefix
3. QA Manager reviews for accuracy
4. QA Manager updates `status` column from `draft` → `approved` in monthly_reports table
5. Distribute approved version manually to stakeholders
