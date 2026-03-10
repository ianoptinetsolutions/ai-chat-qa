"""
run_live_test.py - Full end-to-end live test:
  Intercom -> Claude AI -> Slack -> Google Sheet
"""
import json, urllib.request, urllib.error, os, re, time, datetime

BASE = os.path.dirname(os.path.abspath(__file__))

def load_env():
    env = {}
    with open(os.path.join(BASE, ".env"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

ENV = load_env()
INTERCOM_TOKEN = ENV["INTERCOM_API_TOKEN"]
ANTHROPIC_KEY  = ENV["ANTHROPIC_API_KEY"]
SLACK_TOKEN    = ENV["SLACK_BOT_TOKEN"]
N8N_URL        = ENV["N8N_CLOUD_URL"].rstrip("/")
N8N_KEY        = ENV["N8N_API_KEY"]
SHEET_ID       = ENV["GOOGLE_SHEET_ID"]
CRED_ID        = "tNxhzmaZZCSZ5fGe"
CRED_NAME      = "Google Sheets account 4"

def http_json(method, url, headers, body=None):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:400]}")

def slack_post(body):
    return http_json("POST", "https://slack.com/api/chat.postMessage",
        {"Authorization": f"Bearer {SLACK_TOKEN}", "Content-Type": "application/json"}, body)

def n8n_req(method, path, body=None):
    return http_json(method, f"{N8N_URL}/api/v1{path}",
        {"X-N8N-API-KEY": N8N_KEY, "Content-Type": "application/json", "Accept": "application/json"}, body)

# --- STEP 1: Fetch real Intercom conversation ---
print("STEP 1: Fetching Intercom conversations...")
conv_resp = http_json("GET", "https://api.intercom.io/conversations?state=closed&per_page=10",
    {"Authorization": f"Bearer {INTERCOM_TOKEN}", "Accept": "application/json"})

convs = conv_resp.get("conversations", [])
print(f"  Found {len(convs)} conversations")

def build_transcript(conv):
    parts = []
    src_body = re.sub(r"<[^>]+>", "", (conv.get("source") or {}).get("body", "") or "").strip()
    if src_body:
        parts.append(f"Customer: {src_body}")
    for part in (conv.get("conversation_parts") or {}).get("conversation_parts", []):
        if part.get("part_type") in ("comment", "note"):
            author = part.get("author", {})
            author_type = author.get("type", "")
            author_name2 = author.get("name") or ("Customer" if author_type == "user" else "Agent")
            body = re.sub(r"<[^>]+>", "", part.get("body", "") or "").strip()
            if body and len(body) > 5:
                parts.append(f"{author_name2}: {body}")
    return "\n".join(parts[:20]) if parts else ""

# Select the richest conversation (longest combined transcript, min 100 chars)
selected = None
for conv in convs:
    t = build_transcript(conv)
    if len(t) >= 100:
        selected = conv
        break

if not selected and convs:
    selected = convs[0]

if not selected:
    print("  No conversations found!")
    exit(1)

conv_id    = selected["id"]
player_id  = (selected.get("source") or {}).get("author", {}).get("id", "unknown")
assignee   = selected.get("assignee") or {}
agent_name = selected.get("assignee", {}).get("name") or "Support Agent"

parts = build_transcript(selected).splitlines()
transcript = "\n".join(parts)
def safe_print(s): print(s.encode(sys.stdout.encoding or "utf-8", errors="replace").decode(sys.stdout.encoding or "utf-8", errors="replace"))
import sys
safe_print(f"  Conv ID: {conv_id}, Agent: {agent_name}, Parts: {len(parts)}")
safe_print(f"  Preview: {transcript[:120]}...")

# --- STEP 2: Claude AI Analysis ---
print("\nSTEP 2: Running Claude AI analysis...")

SYSTEM_PROMPT = (
    "You are an expert QA analyst for iGaming customer support. "
    "Analyze the conversation and return ONLY valid JSON with exactly these fields:\n"
    '{"summary":"<2-3 sentence summary>","severity":"<Low|Medium|High|Critical>",'
    '"issue_category":"<Payment/Withdrawal|Game Bug|Login/Account|Bonus/Promotion|Technical Error|Slow Response|Inappropriate Communication|Other>",'
    '"resolution_status":"<Resolved|Partially Resolved|Unresolved>",'
    '"key_quotes":"<most important quote>",'
    '"agent_score":<integer 1-5>,'
    '"agent_notes":"<specific feedback>",'
    '"recommended_action":"<what should happen next>",'
    '"is_alert":<true|false>,'
    '"alert_reason":"<reason if alert, else empty string>"}\n'
    "Severity: Critical=fraud/legal threat, High=major unresolved, Medium=partial, Low=minor/resolved. "
    "is_alert=true for: fraud, legal threat, abusive behavior, Critical+unresolved."
)

ai_resp = http_json("POST", "https://api.anthropic.com/v1/messages",
    {"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
    {"model": "claude-sonnet-4-6", "max_tokens": 1024, "system": SYSTEM_PROMPT,
     "messages": [{"role": "user", "content": f"Agent: {agent_name}\n\nTranscript:\n{transcript}"}]})

raw = ai_resp.get("content", [{}])[0].get("text", "").strip()
raw = re.sub(r"^```[a-z]*\s*", "", raw)
raw = re.sub(r"\s*```$", "", raw)
if not raw:
    print("  Claude returned an empty response — transcript may be too short or bot-only.")
    print(f"  Transcript used ({len(transcript)} chars):\n  {transcript[:200]}")
    exit(1)
analysis = json.loads(raw)

VALID_SEV  = ["Low", "Medium", "High", "Critical"]
VALID_CAT  = ["Payment/Withdrawal", "Game Bug", "Login/Account", "Bonus/Promotion",
              "Technical Error", "Slow Response", "Inappropriate Communication", "Other"]
VALID_RES  = ["Resolved", "Partially Resolved", "Unresolved"]

severity   = analysis["severity"]          if analysis["severity"]          in VALID_SEV else "Low"
category   = analysis["issue_category"]    if analysis["issue_category"]    in VALID_CAT else "Other"
resolution = analysis["resolution_status"] if analysis["resolution_status"] in VALID_RES else "Unresolved"
is_alert   = bool(analysis.get("is_alert", False))
score      = analysis.get("agent_score", 3)

print(f"  Severity: {severity} | Category: {category} | Score: {score}/5 | Alert: {is_alert}")
print(f"  Summary: {analysis.get('summary','')[:120]}")

# --- STEP 3: Post to Slack ---
print("\nSTEP 3: Posting analysis to Slack...")

sev_emoji = {"Low": ":large_green_circle:", "Medium": ":large_yellow_circle:",
             "High": ":large_orange_circle:", "Critical": ":red_circle:"}
score_stars = ":star:" * score + ":star2:" * (5 - score)

msg = {
    "channel": "#chat-qa-reports",
    "text": f"QA Analysis: {conv_id}",
    "blocks": [
        {"type": "header", "text": {"type": "plain_text", "text": "QA Analysis Result"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Conversation:*\n{conv_id}"},
            {"type": "mrkdwn", "text": f"*Agent:*\n{agent_name}"},
            {"type": "mrkdwn", "text": f"*Severity:*\n{sev_emoji.get(severity, '')} {severity}"},
            {"type": "mrkdwn", "text": f"*Category:*\n{category}"},
            {"type": "mrkdwn", "text": f"*Resolution:*\n{resolution}"},
            {"type": "mrkdwn", "text": f"*Agent Score:*\n{score_stars} {score}/5"},
        ]},
        {"type": "section", "text": {"type": "mrkdwn",
            "text": f"*Summary:*\n{analysis.get('summary', '')}"}},
        {"type": "section", "text": {"type": "mrkdwn",
            "text": f"*Key Quote:*\n_{analysis.get('key_quotes', '')}_"}},
        {"type": "section", "text": {"type": "mrkdwn",
            "text": f"*Agent Notes:*\n{analysis.get('agent_notes', '')}"}},
        {"type": "section", "text": {"type": "mrkdwn",
            "text": f"*Recommended Action:*\n{analysis.get('recommended_action', '')}"}},
        {"type": "divider"},
    ]
}

slack_res = slack_post(msg)
if slack_res.get("ok"):
    print(f"  Posted to #chat-qa-reports OK (ts={slack_res.get('ts')})")
else:
    print(f"  Slack error: {slack_res.get('error')}")

if is_alert:
    alert_res = slack_post({
        "channel": "#critical-alerts",
        "text": f":rotating_light: CRITICAL ALERT: {conv_id}",
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": ":rotating_light: Critical Alert"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Conversation:*\n{conv_id}"},
                {"type": "mrkdwn", "text": f"*Agent:*\n{agent_name}"},
                {"type": "mrkdwn", "text": f"*Alert Reason:*\n{analysis.get('alert_reason', '')}"},
            ]},
        ]
    })
    print(f"  Posted to #critical-alerts: {'OK' if alert_res.get('ok') else alert_res.get('error')}")

# --- STEP 4: Write to Google Sheet via n8n ---
print("\nSTEP 4: Writing to Google Sheet via n8n...")

now = datetime.datetime.utcnow().isoformat() + "Z"
row = [
    conv_id, player_id, agent_name,
    analysis.get("summary", ""),
    severity, category, resolution,
    analysis.get("key_quotes", ""),
    str(score),
    analysis.get("agent_notes", ""),
    analysis.get("recommended_action", ""),
    str(is_alert).lower(),
    analysis.get("alert_reason", ""),
    now,
    f"https://app.intercom.com/a/apps/ohcb8hau/conversations/{conv_id}"
]

raw_row = [conv_id, player_id, agent_name, transcript[:5000], "", now, now, "analyzed",
           f"https://app.intercom.com/a/apps/ohcb8hau/conversations/{conv_id}"]

# Write directly to Google Sheets using append endpoint (always adds new rows, never overwrites)
def sheets_append(sheet_name, values_row):
    WF_APPEND = {
        "name": f"Sheet Append {sheet_name}",
        "nodes": [
            {"name": "Schedule", "type": "n8n-nodes-base.scheduleTrigger",
             "typeVersion": 1.2, "position": [0, 300],
             "parameters": {"rule": {"interval": [{"field": "seconds", "secondsInterval": 30}]}}},
            {"name": "Append", "type": "n8n-nodes-base.httpRequest",
             "typeVersion": 4.2, "position": [300, 300],
             "parameters": {
                 "method": "POST",
                 "url": f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{sheet_name}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS",
                 "authentication": "predefinedCredentialType",
                 "nodeCredentialType": "googleSheetsOAuth2Api",
                 "sendBody": True,
                 "contentType": "raw",
                 "rawContentType": "application/json",
                 "body": json.dumps({"values": [values_row]}),
             },
             "credentials": {"googleSheetsOAuth2Api": {"id": CRED_ID, "name": CRED_NAME}}},
        ],
        "connections": {"Schedule": {"main": [[{"node": "Append", "type": "main", "index": 0}]]}},
        "settings": {"executionOrder": "v1"},
    }
    wf_id = None
    try:
        created = n8n_req("POST", "/workflows", WF_APPEND)
        wf_id = created["id"]
        n8n_req("POST", f"/workflows/{wf_id}/activate")
        for _ in range(15):
            time.sleep(5)
            execs = n8n_req("GET", f"/executions?workflowId={wf_id}&limit=1")
            if execs.get("data"):
                ex = execs["data"][0]
                if ex.get("status") in ("success", "error", "crashed"):
                    return ex.get("status")
        return "timeout"
    finally:
        if wf_id:
            try: n8n_req("POST", f"/workflows/{wf_id}/deactivate")
            except: pass
            try: n8n_req("DELETE", f"/workflows/{wf_id}")
            except: pass

status1 = sheets_append("Analysis_Results", row)
print(f"  Analysis_Results append: {status1}")
status2 = sheets_append("Raw_Conversations", raw_row)
print(f"  Raw_Conversations append: {status2}")

print()
print("=" * 55)
print("  LIVE END-TO-END TEST COMPLETE")
print("=" * 55)
print(f"  Conv ID  : {conv_id}")
print(f"  Agent    : {agent_name}")
print(f"  Severity : {severity}")
print(f"  Category : {category}")
print(f"  Score    : {score}/5")
print(f"  Sheet    : https://docs.google.com/spreadsheets/d/{SHEET_ID}")
print()
print("Check Slack #chat-qa-reports for the analysis message!")
