# Chat QA Automation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all code artifacts, validate them, and produce a deployment guide so all 8 n8n workflows import and run correctly on a fresh n8n cloud instance using Claude claude-sonnet-4-6.

**Architecture:** n8n cloud orchestrates 8 workflows — daily Intercom data pull → Claude AI analysis → Google Sheets storage → Slack/Gmail reporting → ticket creation → pattern detection → monthly reports. WF2 (AI analysis) was partially migrated from OpenAI to Claude and has broken connections and wrong request format. All fixes must be applied to both workflow JSON files and the canonical script files in /scripts/.

**Tech Stack:** n8n cloud, Claude claude-sonnet-4-6 via Anthropic API, Google Sheets API, Slack API, Gmail API, Intercom API, Python 3 (validation script)

---

## Task 1: Fix WF2 "Build OpenAI Request" jsCode — Claude format

**Problem:** The Code node in wf2-ai-analysis.json outputs `{ model, temperature, response_format, messages: [system_msg, user_msg] }`. The downstream HTTP node body reads `$json.system` and `$json.messages` — so `$json.system` is undefined and `$json.messages` includes the system message object, sending garbage to the Claude API.

**Files:**
- Modify: `workflows/wf2-ai-analysis.json` — node "Build OpenAI Request", field `parameters.jsCode`

**Step 1: Open the file and locate the jsCode block**

The node to update is at position ~line 74 in wf2-ai-analysis.json, named `"Build OpenAI Request"`. The `jsCode` field contains the entire JavaScript as an escaped string.

**Step 2: Replace the jsCode value**

Replace the entire `"jsCode"` string in the "Build OpenAI Request" node with this corrected code. The key changes:
- Remove `temperature`, `response_format`
- Add `max_tokens: 4096`
- Move system prompt to a top-level `system` string (not inside messages)
- `messages` array contains only the user message
- Use correct iGaming categories and field names matching the Parse node's expectations
- agent_score is 1-5 (not 1-10)
- resolution_status: Resolved | Partially Resolved | Unresolved

New jsCode (write this as the value — it will be JSON-escaped when saved):

```javascript
const item = $input.first().json;
const conversationId = item.conversation_id || item[0] || 'unknown';
const playerId       = item.player_id       || item[1] || 'unknown';
const agentName      = item.agent_name      || item[2] || 'Unknown';
const transcript     = item.transcript      || item[3] || '';
const intercomLink   = item.intercom_link   || item[8] || '';

if (!transcript || transcript.trim().length === 0) {
  throw new Error(`Empty transcript for conversation ${conversationId} — skipping`);
}

const MAX_CHARS = 60000;
const truncated = transcript.length > MAX_CHARS
  ? transcript.substring(0, MAX_CHARS) + '\n\n[Transcript truncated]'
  : transcript;

const systemPrompt = `You are an expert Quality Assurance analyst for a regulated iGaming (online casino/sports betting) customer support operation. Analyze the support conversation and return ONLY a valid JSON object — no preamble, no explanation, no markdown.

SEVERITY (severity):
- "Low"      — Minor frustration, issue fully resolved, player tone normalized
- "Medium"   — Clear dissatisfaction, partially resolved or player still uneasy
- "High"     — Strong dissatisfaction, issue unresolved, churn risk
- "Critical" — Legal/regulatory threat, VIP complaint, fraud indicators, inappropriate agent conduct

ISSUE CATEGORY (issue_category — pick exactly one):
"Payment/Withdrawal" | "Game Bug" | "Login/Account" | "Bonus/Promotion" | "Technical Error" | "Slow Response" | "Inappropriate Communication" | "Other"

RESOLUTION STATUS (resolution_status — based on player sentiment at END of conversation, NOT Intercom status):
"Resolved" | "Partially Resolved" | "Unresolved"

AGENT SCORE (agent_score — integer 1-5):
5=Exceptional, 4=Good, 3=Adequate, 2=Below Standard, 1=Poor

ALERT (is_alert = true) when ANY of:
- Player mentions legal action, regulator, lawyer
- VIP or high-value player dissatisfied
- Agent used inappropriate or discriminatory language
- Fraud indicators present

Return ONLY this JSON — all fields required:
{
  "summary": "1-3 sentence factual summary",
  "severity": "Low|Medium|High|Critical",
  "issue_category": "one of the 8 categories",
  "resolution_status": "Resolved|Partially Resolved|Unresolved",
  "key_quotes": "1-2 direct player quotes, comma-separated, or empty string",
  "agent_score": 3,
  "agent_notes": "specific observation about agent performance",
  "recommended_action": "specific QA action or No action required",
  "is_alert": false,
  "alert_reason": null
}`;

const userMessage = `Conversation ID: ${conversationId}\nPlayer ID: ${playerId}\nAgent: ${agentName}\n\nTranscript:\n${truncated}`;

return [{
  json: {
    conversation_id: conversationId,
    player_id:       playerId,
    agent_name:      agentName,
    intercom_link:   intercomLink,
    model:           'claude-sonnet-4-6',
    max_tokens:      4096,
    system:          systemPrompt,
    messages: [
      { role: 'user', content: userMessage }
    ]
  }
}];
```

**Step 3: Verify the JSON is still valid**

Run:
```bash
python -c "import json; json.load(open('workflows/wf2-ai-analysis.json', encoding='utf-8')); print('JSON valid')"
```
Expected: `JSON valid`

---

## Task 2: Fix WF2 Connection Map — "Call GPT-4o" → "Call Claude API"

**Problem:** The `connections` object in wf2-ai-analysis.json references `"Call GPT-4o"` as a source and target node, but the actual node is named `"Call Claude API"`. This breaks the flow: Build → HTTP → Parse.

**Files:**
- Modify: `workflows/wf2-ai-analysis.json` — `connections` object

**Step 1: Find the broken entries**

In the `connections` object (lines ~368-389), two keys/values reference the old name:
1. Key `"Build OpenAI Request"` has value pointing to `"node": "Call GPT-4o"` — change target to `"Call Claude API"`
2. Key `"Call GPT-4o"` — rename this key to `"Call Claude API"`

**Step 2: Apply the fix**

Change:
```json
"Build OpenAI Request": {
  "main": [[{ "node": "Call GPT-4o", "type": "main", "index": 0 }]]
},
"Call GPT-4o": {
  "main": [[{ "node": "Parse AI Response", "type": "main", "index": 0 }]]
},
```

To:
```json
"Build OpenAI Request": {
  "main": [[{ "node": "Call Claude API", "type": "main", "index": 0 }]]
},
"Call Claude API": {
  "main": [[{ "node": "Parse AI Response", "type": "main", "index": 0 }]]
},
```

**Step 3: Verify JSON valid and no stale GPT-4o references remain**

```bash
python -c "import json; d=json.load(open('workflows/wf2-ai-analysis.json', encoding='utf-8')); refs=[k for k in d['connections'] if 'gpt' in k.lower() or 'openai' in k.lower()]; print('Stale keys:', refs or 'none')"
```
Expected: `Stale keys: none`

---

## Task 3: Sync wf2-build-openai-request.js to match corrected workflow

**Problem:** `/scripts/wf2-build-openai-request.js` still uses OpenAI format and gpt-4o. Per README, scripts are the canonical source — they must match the workflow JSON code nodes.

**Files:**
- Modify: `scripts/wf2-build-openai-request.js`

**Step 1: Replace file contents**

Write the same logic as Task 1's jsCode but with full JSDoc header:

```javascript
/**
 * WF2 — Build Claude Request
 *
 * Constructs the Anthropic API request payload for Claude claude-sonnet-4-6.
 * Claude API requires: model, max_tokens, system (string), messages (user-only array).
 * Does NOT use: temperature, response_format (those are OpenAI-specific).
 *
 * Input:  $input.first().json — conversation row from Raw_Conversations sheet
 * Output: single item with { model, max_tokens, system, messages, conversation_id, player_id, agent_name, intercom_link }
 *
 * NOTE: This code is embedded verbatim in wf2-ai-analysis.json Code node "Build OpenAI Request".
 *       When updating, update both files.
 */

const item = $input.first().json;
const conversationId = item.conversation_id || item[0] || 'unknown';
const playerId       = item.player_id       || item[1] || 'unknown';
const agentName      = item.agent_name      || item[2] || 'Unknown';
const transcript     = item.transcript      || item[3] || '';
const intercomLink   = item.intercom_link   || item[8] || '';

if (!transcript || transcript.trim().length === 0) {
  throw new Error(`Empty transcript for conversation ${conversationId} — skipping`);
}

const MAX_CHARS = 60000;
const truncated = transcript.length > MAX_CHARS
  ? transcript.substring(0, MAX_CHARS) + '\n\n[Transcript truncated]'
  : transcript;

const systemPrompt = `You are an expert Quality Assurance analyst for a regulated iGaming (online casino/sports betting) customer support operation. Analyze the support conversation and return ONLY a valid JSON object — no preamble, no explanation, no markdown.

SEVERITY (severity):
- "Low"      — Minor frustration, issue fully resolved, player tone normalized
- "Medium"   — Clear dissatisfaction, partially resolved or player still uneasy
- "High"     — Strong dissatisfaction, issue unresolved, churn risk
- "Critical" — Legal/regulatory threat, VIP complaint, fraud indicators, inappropriate agent conduct

ISSUE CATEGORY (issue_category — pick exactly one):
"Payment/Withdrawal" | "Game Bug" | "Login/Account" | "Bonus/Promotion" | "Technical Error" | "Slow Response" | "Inappropriate Communication" | "Other"

RESOLUTION STATUS (resolution_status — based on player sentiment at END of conversation, NOT Intercom status):
"Resolved" | "Partially Resolved" | "Unresolved"

AGENT SCORE (agent_score — integer 1-5):
5=Exceptional, 4=Good, 3=Adequate, 2=Below Standard, 1=Poor

ALERT (is_alert = true) when ANY of:
- Player mentions legal action, regulator, lawyer
- VIP or high-value player dissatisfied
- Agent used inappropriate or discriminatory language
- Fraud indicators present

Return ONLY this JSON — all fields required:
{
  "summary": "1-3 sentence factual summary",
  "severity": "Low|Medium|High|Critical",
  "issue_category": "one of the 8 categories",
  "resolution_status": "Resolved|Partially Resolved|Unresolved",
  "key_quotes": "1-2 direct player quotes, comma-separated, or empty string",
  "agent_score": 3,
  "agent_notes": "specific observation about agent performance",
  "recommended_action": "specific QA action or No action required",
  "is_alert": false,
  "alert_reason": null
}`;

const userMessage = `Conversation ID: ${conversationId}\nPlayer ID: ${playerId}\nAgent: ${agentName}\n\nTranscript:\n${truncated}`;

return [{
  json: {
    conversation_id: conversationId,
    player_id:       playerId,
    agent_name:      agentName,
    intercom_link:   intercomLink,
    model:           'claude-sonnet-4-6',
    max_tokens:      4096,
    system:          systemPrompt,
    messages: [
      { role: 'user', content: userMessage }
    ]
  }
}];
```

---

## Task 4: Sync wf2-parse-ai-response.js to match workflow JSON

**Problem:** `scripts/wf2-parse-ai-response.js` still reads `openAiResponse.choices?.[0]?.message?.content` and references node name `$('Build OpenAI Request')`. The workflow JSON's Parse node already uses correct Claude format. Sync the script to match.

**Files:**
- Modify: `scripts/wf2-parse-ai-response.js`

**Step 1: Replace file contents**

```javascript
/**
 * WF2 — Parse Claude Response
 *
 * Parses and validates the Claude API JSON response. Merges with conversation
 * metadata to produce the final Analysis_Results row.
 *
 * Input:
 *   - $input.first().json           — raw Anthropic API response
 *   - $('Build OpenAI Request').first().json — conversation metadata
 *
 * Output: single item ready to write to Analysis_Results Google Sheet
 *
 * Claude response format: { content: [{ type: "text", text: "<json string>" }] }
 *
 * NOTE: This code is embedded verbatim in wf2-ai-analysis.json Code node "Parse AI Response".
 *       When updating, update both files.
 */

const response    = $input.first().json;
const buildNode   = $('Build OpenAI Request').first().json;

const VALID_SEVERITIES  = ['Low', 'Medium', 'High', 'Critical'];
const VALID_CATEGORIES  = [
  'Payment/Withdrawal', 'Game Bug', 'Login/Account', 'Bonus/Promotion',
  'Technical Error', 'Slow Response', 'Inappropriate Communication', 'Other'
];
const VALID_RESOLUTIONS = ['Resolved', 'Unresolved', 'Partially Resolved'];

try {
  // Claude response format: content[0].text
  const rawContent = response.content?.[0]?.text;
  if (!rawContent) {
    throw new Error('No content in Claude response');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (parseErr) {
    throw new Error(`Failed to parse AI JSON: ${parseErr.message}. Raw: ${rawContent.substring(0, 200)}`);
  }

  const severity   = VALID_SEVERITIES.includes(parsed.severity)   ? parsed.severity   : 'Low';
  const category   = VALID_CATEGORIES.includes(parsed.issue_category) ? parsed.issue_category : 'Other';
  const resolution = VALID_RESOLUTIONS.includes(parsed.resolution_status) ? parsed.resolution_status : 'Unresolved';

  const agentScore = Number.isInteger(parsed.agent_score) && parsed.agent_score >= 1 && parsed.agent_score <= 5
    ? parsed.agent_score : 3;

  const isAlert = parsed.is_alert === true;

  return [{
    json: {
      conversation_id:    buildNode.conversation_id || 'unknown',
      player_id:          buildNode.player_id || '',
      agent_name:         buildNode.agent_name || '',
      intercom_link:      buildNode.intercom_link || '',
      summary:            parsed.summary || '',
      severity,
      issue_category:     category,
      resolution_status:  resolution,
      key_quotes:         parsed.key_quotes || '',
      agent_score:        agentScore,
      agent_notes:        parsed.agent_notes || '',
      recommended_action: parsed.recommended_action || '',
      is_alert:           isAlert,
      alert_reason:       isAlert ? (parsed.alert_reason || 'Alert flagged by AI') : '',
      analyzed_at:        new Date().toISOString(),
    }
  }];

} catch (err) {
  // Degraded result — workflow continues, manual review flagged
  console.error(`Parse error for ${buildNode?.conversation_id}: ${err.message}`);
  return [{
    json: {
      conversation_id:    buildNode?.conversation_id || 'UNKNOWN',
      player_id:          buildNode?.player_id || '',
      agent_name:         buildNode?.agent_name || '',
      intercom_link:      buildNode?.intercom_link || '',
      summary:            `[PARSE ERROR] ${err.message}`,
      severity:           'Low',
      issue_category:     'Other',
      resolution_status:  'Unresolved',
      key_quotes:         '',
      agent_score:        3,
      agent_notes:        '',
      recommended_action: 'Manual review required — AI parse failed',
      is_alert:           false,
      alert_reason:       '',
      analyzed_at:        new Date().toISOString(),
    }
  }];
}
```

---

## Task 5: Verify WF6 and WF8 script alignment

**Problem:** WF6 and WF8 workflow JSONs were already migrated to Claude by update_to_claude.py. Need to confirm the script files match.

**Files:**
- Read: `workflows/wf6-pattern-detection.json`
- Read: `workflows/wf8-monthly-report.json`

**Step 1: Check WF6 parse code node**

Grep for the Claude response parse pattern in wf6:
```bash
python -c "
import json
wf = json.load(open('workflows/wf6-pattern-detection.json', encoding='utf-8'))
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.code':
        js = n['parameters'].get('jsCode', '')
        print(f'Node: {n[\"name\"]}')
        if 'choices' in js:
            print('  PROBLEM: still uses OpenAI choices format')
        if 'content?.[0]?.text' in js or 'content[0].text' in js:
            print('  OK: uses Claude format')
        if 'openai' in js.lower():
            print('  PROBLEM: mentions openai')
"
```
Expected: all Code nodes in WF6 show OK or have no AI parsing at all.

**Step 2: Check WF8 parse code node** (same command, change wf6 to wf8)

**Step 3: If any node shows PROBLEM** — read the full jsCode and fix it to use `response.content?.[0]?.text` (same pattern as Task 4).

---

## Task 6: Scan all workflows for remaining placeholders

**Step 1: Run placeholder scan**

```bash
python -c "
import os, json, re

wf_dir = 'workflows'
placeholders = re.compile(r'YOUR_[A-Z_]+|placeholder|REPLACE_ME', re.IGNORECASE)

for fname in sorted(os.listdir(wf_dir)):
    if not fname.endswith('.json'):
        continue
    text = open(os.path.join(wf_dir, fname), encoding='utf-8').read()
    matches = placeholders.findall(text)
    if matches:
        print(f'{fname}: {set(matches)}')
    else:
        print(f'{fname}: OK')
"
```
Expected: all files print `OK`. If any show matches, read the specific workflow and replace the placeholder with the correct value from `.env`.

---

## Task 7: Write validate_workflows.py

**Files:**
- Create: `validate_workflows.py`

**Step 1: Create the validation script**

```python
"""
validate_workflows.py
Run from project root: python validate_workflows.py
Checks all 8 workflow JSONs for correctness before importing into n8n.
"""
import os
import json
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
WF_DIR = os.path.join(BASE, "workflows")

# Load .env into a dict for reference checks
def load_env(path):
    env = {}
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return env

ENV = load_env(os.path.join(BASE, ".env"))

EXPECTED_CREDENTIALS = {
    "httpHeaderAuth": ["anthropic_api", "intercom_api"],
    "googleSheetsOAuth2Api": ["google_sheets_oauth"],
    "gmailOAuth2": ["gmail_oauth"],
    "slackApi": ["slack_api"],
}

PLACEHOLDER_PATTERN = re.compile(r'YOUR_[A-Z_]+|REPLACE_ME', re.IGNORECASE)
ENV_VAR_PATTERN = re.compile(r'\$env\.([A-Z_]+)')

ERRORS = []
WARNINGS = []

def err(wf_name, msg):
    ERRORS.append(f"  [FAIL] {wf_name}: {msg}")

def warn(wf_name, msg):
    WARNINGS.append(f"  [WARN] {wf_name}: {msg}")

def check_workflow(wf_path):
    wf_name = os.path.basename(wf_path)

    # 1. Valid JSON
    try:
        with open(wf_path, encoding="utf-8") as f:
            wf = json.load(f)
    except json.JSONDecodeError as e:
        err(wf_name, f"Invalid JSON: {e}")
        return

    text = open(wf_path, encoding="utf-8").read()
    nodes = wf.get("nodes", [])
    connections = wf.get("connections", {})
    node_names = {n["name"] for n in nodes}

    # 2. No OpenAI API references
    if "openai.com" in text.lower():
        err(wf_name, "Contains openai.com URL")
    if "gpt-4o" in text.lower():
        err(wf_name, "Contains gpt-4o model reference")
    if "choices?.[0]?.message?.content" in text or 'choices[0].message.content' in text:
        err(wf_name, "Contains OpenAI choices[0].message.content response format")
    if '"response_format"' in text and '"type": "json_object"' in text:
        err(wf_name, "Contains OpenAI response_format json_object")

    # 3. No unreplaced placeholders
    matches = PLACEHOLDER_PATTERN.findall(text)
    if matches:
        err(wf_name, f"Unreplaced placeholders: {set(matches)}")

    # 4. Node connection integrity
    for src_node, conn_data in connections.items():
        if src_node not in node_names:
            err(wf_name, f"Connection source '{src_node}' not found in nodes")
        for output_list in conn_data.get("main", []):
            for target in output_list:
                tname = target.get("node", "")
                if tname and tname not in node_names:
                    err(wf_name, f"Connection target '{tname}' (from '{src_node}') not found in nodes")

    # 5. Credential names match expected set
    for node in nodes:
        for cred_type, cred_info in node.get("credentials", {}).items():
            cred_id = cred_info.get("id", "")
            expected_ids = EXPECTED_CREDENTIALS.get(cred_type, [])
            if expected_ids and cred_id not in expected_ids:
                warn(wf_name, f"Node '{node['name']}': credential id '{cred_id}' not in expected {expected_ids}")

    # 6. All $env.VARIABLE references have matching .env keys
    env_refs = ENV_VAR_PATTERN.findall(text)
    for var in set(env_refs):
        if var not in ENV:
            warn(wf_name, f"$env.{var} referenced but not found in .env")

    # 7. Anthropic HTTP nodes have anthropic-version header
    for node in nodes:
        if node["type"] == "n8n-nodes-base.httpRequest":
            url = node.get("parameters", {}).get("url", "")
            if "anthropic.com" in url:
                headers = node.get("parameters", {}).get("options", {}).get("headers", {}).get("parameters", [])
                has_version = any(h.get("name") == "anthropic-version" for h in headers)
                if not has_version:
                    err(wf_name, f"Node '{node['name']}': Anthropic HTTP node missing 'anthropic-version' header")

def main():
    wf_files = sorted(f for f in os.listdir(WF_DIR) if f.endswith(".json"))
    if not wf_files:
        print("No workflow JSON files found in ./workflows/")
        sys.exit(1)

    print(f"Validating {len(wf_files)} workflows...\n")

    for fname in wf_files:
        check_workflow(os.path.join(WF_DIR, fname))

    if WARNINGS:
        print("WARNINGS:")
        for w in WARNINGS:
            print(w)
        print()

    if ERRORS:
        print("ERRORS:")
        for e in ERRORS:
            print(e)
        print(f"\n{len(ERRORS)} error(s) found. Fix before importing into n8n.")
        sys.exit(1)
    else:
        print(f"All {len(wf_files)} workflows passed validation.")
        if WARNINGS:
            print(f"({len(WARNINGS)} warning(s) — review above)")
        sys.exit(0)

if __name__ == "__main__":
    main()
```

**Step 2: Run the validator**

```bash
python validate_workflows.py
```
Expected: `All 8 workflows passed validation.`

If errors appear, fix each one before proceeding.

---

## Task 8: Fix any errors found by validator

**This task is conditional** — only needed if Task 7's validator run produced errors.

Work through each error in order:

- `Contains gpt-4o` in wf6 or wf8 → read the Code node jsCode, replace `gpt-4o` with `claude-sonnet-4-6`
- `Connection target X not found` → fix the connections object in that workflow JSON
- `Missing anthropic-version header` → add `{ "name": "anthropic-version", "value": "2023-06-01" }` to the node's options.headers.parameters array
- `Unreplaced placeholders` → substitute with correct value from .env

Re-run validator after each fix until all errors clear.

---

## Task 9: Write DEPLOYMENT.md

**Files:**
- Create: `DEPLOYMENT.md`

**Step 1: Write the deployment guide**

```markdown
# Deployment Guide — Chat QA Automation

Complete setup instructions for deploying all 8 workflows to a fresh n8n cloud instance.

---

## Prerequisites

- n8n cloud account at https://automateoptinet.app.n8n.cloud/
- Google account with access to create/edit Google Sheets
- Slack workspace with bot permissions
- Intercom account with API access
- Anthropic API key (in .env as ANTHROPIC_API_KEY)

---

## Step 1: Create Google Sheets Database

1. Go to https://sheets.google.com and create a new spreadsheet
2. Name it: **Chat QA Database**
3. Create 9 tabs with EXACTLY these names (case-sensitive):

| Tab Name | Columns (add as row 1 headers) |
|----------|-------------------------------|
| Raw_Conversations | conversation_id, player_id, agent_name, transcript, created_at, closed_at, tags, channel, intercom_link, analyzed |
| Analysis_Results | conversation_id, player_id, agent_name, summary, severity, issue_category, resolution_status, key_quotes, agent_score, agent_notes, recommended_action, is_alert, alert_reason, analyzed_at, intercom_link |
| Report_Log | report_date, total_analyzed, critical_count, high_count, medium_count, low_count, satisfaction_rate, top_issues, generated_at |
| Agent_Team_Mapping | agent_name, agent_email, team_leader_name, team_leader_slack_id |
| Tickets | ticket_id, conversation_id, player_id, agent_name, severity, issue_category, summary, recommended_action, created_at, status, intercom_link, feedback, feedback_processed |
| Alert_Log | alert_id, conversation_id, player_id, agent_name, severity, issue_category, alert_reason, alerted_at, intercom_link |
| Weekly_Trends | week_start, week_end, top_issues_json, anomalies_json, repeat_complainers, agent_flags_json, trend_summary, recommendations, generated_at |
| Accuracy_Log | log_date, total_feedback, agree_count, disagree_count, accuracy_rate, worst_category, generated_at |
| Monthly_Reports | month, total_conversations, satisfaction_rate, report_html, generated_at, status |

4. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**YOUR_SHEET_ID**/edit`

   Your Sheet ID is: `1QoCwPRGPBjHXfCA_Pa3A-WpC9Qf1J6DKfiVJEW0sFXo`
   (Already substituted in all workflow JSONs)

---

## Step 2: Create n8n Credentials

In n8n: **Settings → Credentials → Add Credential**

Create these 5 credentials with EXACTLY these names:

### 1. Google Sheets OAuth2
- Type: **Google Sheets OAuth2 API**
- Name: `Google Sheets` (credential ID must be `google_sheets_oauth`)
- Scopes: `https://www.googleapis.com/auth/spreadsheets`
- Click Connect and authorize with your Google account

### 2. Gmail OAuth2
- Type: **Gmail OAuth2 API**
- Name: `Gmail` (credential ID must be `gmail_oauth`)
- Scopes: `https://www.googleapis.com/auth/gmail.send`
- Click Connect and authorize

### 3. Slack API
- Type: **Slack API**
- Name: `Slack` (credential ID must be `slack_api`)
- Bot Token: `YOUR_SLACK_BOT_TOKEN`

### 4. Anthropic API (HTTP Header Auth)
- Type: **Header Auth**
- Name: `Anthropic API` (credential ID must be `anthropic_api`)
- Header Name: `x-api-key`
- Header Value: `YOUR_ANTHROPIC_API_KEY`

### 5. Intercom API (HTTP Header Auth)
- Type: **Header Auth**
- Name: `Intercom API` (credential ID must be `intercom_api`)
- Header Name: `Authorization`
- Header Value: `Bearer YOUR_INTERCOM_API_TOKEN`

---

## Step 3: Set n8n Environment Variables

In n8n: **Settings → Environment Variables** (n8n cloud) or edit your `.env` file (self-hosted).

Add these variables:

```
INTERCOM_API_TOKEN=your_intercom_api_token
ANTHROPIC_API_KEY=your_anthropic_api_key
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_CHANNEL_REPORTS=#chat-qa-reports
SLACK_CHANNEL_ALERTS=#critical-alerts
SLACK_CHANNEL_TRENDS=#chat-qa-trends
SLACK_CHANNEL_ESCALATIONS=#critical-escalations
SLACK_CHANNEL_QA_INBOX=#chat-qa-inbox
QA_MANAGER_SLACK_ID=your_slack_user_id
GOOGLE_SHEET_ID=your_google_sheet_id
GMAIL_DISTRIBUTION_LIST=your_email@example.com
STAKEHOLDERS_EMAIL=your_email@example.com
QA_MANAGER_EMAIL=your_email@example.com
```

---

## Step 4: Import Workflows

In n8n: **Workflows → Import from file**

Import in this exact order. Test each before importing the next.

| Order | File | Trigger |
|-------|------|---------|
| 1 | `workflows/wf1-daily-data-collection.json` | Schedule: 06:00 UTC daily |
| 2 | `workflows/wf2-ai-analysis.json` | Called by WF1 |
| 3 | `workflows/wf3-daily-summary-report.json` | Schedule: 07:30 UTC daily |
| 4 | `workflows/wf4-auto-ticket-creation.json` | Called by WF2 |
| 5 | `workflows/wf5-critical-alerts.json` | Called by WF2 |
| 6 | `workflows/wf6-pattern-detection.json` | Schedule: 08:00 UTC daily |
| 7 | `workflows/wf7-feedback-loop.json` | Every 6 hours |
| 8 | `workflows/wf8-monthly-report.json` | 1st of month, 08:00 UTC |

---

## Step 5: Update Sub-Workflow IDs

After importing, n8n assigns each workflow a numeric ID. WF2 calls WF4 and WF5 by ID.

1. Note the IDs n8n assigned to WF4 and WF5 (shown in the URL when you open them)
2. Open WF2 in the n8n editor
3. Find the "Trigger WF4 Ticket" node → update workflowId to WF4's actual ID
4. Find the "Trigger WF5 Alert" node → update workflowId to WF5's actual ID
5. Similarly check WF1 for its "Execute WF2" node and update WF2's ID

---

## Step 6: Populate Agent_Team_Mapping

In the Google Sheet, open the **Agent_Team_Mapping** tab and add one row per agent:

```
agent_name       | agent_email      | team_leader_name | team_leader_slack_id
John Smith       | john@company.com | Sarah Lee        | U012AB3CD
```

Agent names MUST match exactly what Intercom returns as the admin display name.

---

## Step 7: Test Each Workflow

Test in order. Do NOT activate until tested.

### WF1 Test
- Open WF1 → click **Test workflow**
- Should fetch Intercom conversations and chain to WF2
- Check Raw_Conversations sheet for new rows
- Check Analysis_Results sheet for analyzed rows

### WF2 Test (standalone)
- Add a test row manually to Raw_Conversations with a sample transcript
- Open WF2 → Test workflow
- Check Analysis_Results for the output row
- Verify severity/issue_category/agent_score fields are populated

### WF3 Test
- Open WF3 → Test workflow
- Should send email to hannahporter1905@gmail.com
- Should post to #chat-qa-reports Slack channel

### WF4 Test
- Open WF4 → Test workflow with sample high-severity data
- Check Tickets sheet for new row
- Check Slack for DM to team leader

### WF5 Test
- Open WF5 → Test workflow with is_alert=true data
- Check Alert_Log sheet
- Check #critical-alerts Slack channel and email

### WF6/WF7/WF8
- Test manually; these can be triggered on-demand from the n8n editor

---

## Step 8: Activate Workflows

Activate in this order only after all tests pass:

1. WF4, WF5 (sub-workflows — activate first so they can receive calls)
2. WF2 (activate before WF1 so it's ready when WF1 chains to it)
3. WF1 (starts the daily chain at 06:00 UTC)
4. WF3 (daily report at 07:30 UTC)
5. WF6 (daily pattern detection at 08:00 UTC)
6. WF7 (every 6h feedback loop)
7. WF8 (monthly report — safe to activate last)

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| WF2 Claude call returns 400 | Wrong request format | Check Build Request node: system must be string, messages must be user-only |
| WF2 Parse Error | Claude returned non-JSON | Check system prompt ends with JSON structure example |
| Google Sheets auth error | OAuth expired | Re-authorize google_sheets_oauth credential |
| Slack DM not delivered | Wrong user ID format | User IDs start with U, not @ |
| WF1 → WF2 doesn't chain | Wrong workflow ID in Execute Workflow node | Update workflowId in WF1's Execute node |
| 0 conversations analyzed | Intercom token expired or wrong filter | Test Intercom API token manually |
```

---

## Task 10: Final validation run

**Step 1: Run the complete validator**

```bash
python validate_workflows.py
```
Expected output:
```
Validating 8 workflows...

All 8 workflows passed validation.
```

**Step 2: Verify script/workflow parity for WF2**

Confirm the jsCode in wf2-ai-analysis.json's "Build OpenAI Request" node matches wf2-build-openai-request.js (ignoring the JSDoc header). They should be identical.

```bash
python -c "
import json, re

wf = json.load(open('workflows/wf2-ai-analysis.json', encoding='utf-8'))
build_node = next(n for n in wf['nodes'] if n['name'] == 'Build OpenAI Request')
wf_code = build_node['parameters']['jsCode'].strip()

script = open('scripts/wf2-build-openai-request.js', encoding='utf-8').read()
# Strip JSDoc header from script
script_code = re.sub(r'/\*\*.*?\*/\s*', '', script, flags=re.DOTALL).strip()

if wf_code == script_code:
    print('Build Request: workflow JSON and script match')
else:
    print('Build Request: MISMATCH — update one to match the other')
    # Show first diff
    wf_lines = wf_code.splitlines()
    sc_lines = script_code.splitlines()
    for i, (a, b) in enumerate(zip(wf_lines, sc_lines)):
        if a != b:
            print(f'  First diff at line {i+1}:')
            print(f'  WF:     {a[:100]}')
            print(f'  Script: {b[:100]}')
            break
"
```
Expected: `Build Request: workflow JSON and script match`

If mismatch, copy the workflow JSON version into the script file (workflow JSON is source of truth after Task 2's edits).

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `workflows/wf2-ai-analysis.json` | Fix Build Request jsCode (Claude format), fix connection map |
| `scripts/wf2-build-openai-request.js` | Sync to Claude format + iGaming prompt |
| `scripts/wf2-parse-ai-response.js` | Sync to Claude response format |
| `validate_workflows.py` | New — validation script |
| `DEPLOYMENT.md` | New — deployment guide |
| `workflows/wf6-pattern-detection.json` | Fix if validator finds issues |
| `workflows/wf8-monthly-report.json` | Fix if validator finds issues |