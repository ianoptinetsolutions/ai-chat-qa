# Chat QA Automation — Implementation Design
Date: 2026-03-07

## Goal
Complete the Chat QA n8n automation system so all 8 workflows are import-ready, consistent, and validated before deployment to a fresh n8n cloud instance.

## Scope
Three deliverables:
1. Fixed and consistent code artifacts (scripts + workflow JSONs)
2. Local validation script
3. Deployment guide (DEPLOYMENT.md)

---

## Architecture

8 n8n workflows orchestrated in sequence:

```
WF1 (06:00 UTC) → pulls Intercom conversations → chains to WF2
WF2             → Claude analysis per conversation → routes to WF4/WF5
WF3 (07:30 UTC) → compiles daily metrics → Slack + Gmail report
WF4             → creates ticket row + Slack DM to team leader
WF5             → real-time critical alert → Slack + Gmail
WF6 (08:00 UTC) → 7-day rolling pattern detection → Claude trend summary
WF7 (every 6h)  → processes feedback from Tickets sheet → Accuracy_Log
WF8 (1st/month) → monthly HTML report → Gmail draft to QA Manager
```

AI: Claude claude-sonnet-4-6 via Anthropic API (api.anthropic.com/v1/messages)
Database: Google Sheets (9 tabs)
Notifications: Slack (4 channels) + Gmail
Data source: Intercom API

---

## Deliverable 1 — Code Artifact Fixes

### WF2 Issues (Priority: Critical)

**Problem:** Partial OpenAI→Claude migration left broken state:
- Code node name: "Build OpenAI Request" (old) — connections map references "Call GPT-4o" (old)
- `wf2-build-openai-request.js`: uses `gpt-4o`, `temperature`, `response_format`, system in messages array
- `wf2-parse-ai-response.js`: reads `choices?.[0]?.message?.content` (OpenAI)
- Workflow JSON connections broken due to node name mismatch

**Fix:**
- Update script files to Claude format
- Update workflow JSON: rename nodes, fix connections, embed updated script code
- Claude request format: `{ model, max_tokens: 4096, system: "...", messages: [{role:"user", content}] }`
- Claude response format: `content?.[0]?.text`

### WF6 + WF8 (Priority: Medium)
- HTTP nodes already point to Anthropic — verify script files match
- Check parse code nodes use Claude response format

### Placeholder Substitution (Priority: High)
Replace all placeholder values in workflow JSONs using values from .env:
- `YOUR_GOOGLE_SHEET_ID` → `1QoCwPRGPBjHXfCA_Pa3A-WpC9Qf1J6DKfiVJEW0sFXo`
- Channel IDs/names from SLACK_CHANNEL_* env vars
- Email addresses from GMAIL_DISTRIBUTION_LIST, STAKEHOLDERS_EMAIL, QA_MANAGER_EMAIL
- QA Manager Slack ID: `U0AJA0P3JP6`

---

## Deliverable 2 — Validation Script

File: `validate_workflows.py`

Checks per workflow JSON:
1. No OpenAI API references (gpt-4o, openai.com, choices[0])
2. Node connection integrity (every named connection target exists)
3. No unreplaced placeholders (YOUR_*, placeholder patterns)
4. Credential names match expected set
5. All $env.VARIABLE_NAME references have matching .env keys

Output: colored pass/fail per workflow + specific error locations.

---

## Deliverable 3 — Deployment Guide

File: `DEPLOYMENT.md`

Sections:
1. Google Sheets setup (9 tabs, column headers)
2. n8n credential creation (5 credentials, exact names)
3. n8n environment variable setup
4. Workflow import order (WF1→WF8)
5. Agent_Team_Mapping population
6. Manual test sequence per workflow
7. Activation order

---

## Data Flow Detail

### WF2 Claude Request Format
```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 4096,
  "system": "<QA analyst system prompt>",
  "messages": [{ "role": "user", "content": "Conversation ID: ...\nTranscript: ..." }]
}
```

### WF2 Claude Response Parsing
```js
const content = openAiResponse.content?.[0]?.text;
const analysis = JSON.parse(content);
```

### Severity Routing
- Critical + is_alert_worthy=true → WF5 (real-time alert)
- Medium/High/Critical → WF4 (ticket creation)
- Low → report only (WF3)

---

## Error Handling
- All HTTP nodes: retryOnFail=true, maxTries=3
- WF2 parse failures: degraded row written with [PARSE ERROR] prefix, manual review flagged
- WF3 with 0 conversations: sends "No conversations analyzed today" report
- n8n Error Workflow: configure to post to #engineering-alerts Slack channel

---

## Success Criteria
- `validate_workflows.py` passes all checks for all 8 workflows
- All 8 workflows import into n8n without errors
- WF1 → WF2 chain executes end-to-end on test data
- WF3 sends daily report email + Slack message
- WF4 creates ticket row and sends Slack DM
- WF5 fires on Critical+alert_worthy conversations