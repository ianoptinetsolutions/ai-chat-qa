"""
test_all_channels.py
Tests all 5 Slack channels with realistic messages matching what each workflow sends.

Channels covered:
  #chat-qa-reports      - Individual QA analysis (WF2 result)
  #critical-alerts      - Real-time alert for legal/fraud/VIP issues (WF5)
  #critical-escalations - Auto ticket for Critical severity (WF4)
  #chat-qa-trends       - 7-day pattern anomaly summary (WF6)
  #chat-qa-inbox        - Fallback ticket when no team leader mapping (WF4)

Uses a synthetic iGaming conversation with a legal threat to guarantee
Critical severity + is_alert=true without depending on live Intercom data.

Run: python test_all_channels.py
"""
import json, urllib.request, urllib.error, re, os, datetime

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
ANTHROPIC_KEY = ENV["ANTHROPIC_API_KEY"]
SLACK_TOKEN   = ENV["SLACK_BOT_TOKEN"]
SHEET_ID      = ENV["GOOGLE_SHEET_ID"]

def http_post(url, headers, body):
    r = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:400]}")

def slack_post(channel, text, blocks):
    res = http_post(
        "https://slack.com/api/chat.postMessage",
        {"Authorization": f"Bearer {SLACK_TOKEN}", "Content-Type": "application/json"},
        {"channel": channel, "text": text, "blocks": blocks},
    )
    label = "OK" if res.get("ok") else f"FAIL ({res.get('error')})"
    print(f"  {channel:<28} {label}")
    return res.get("ok", False)

# ── Synthetic conversation — guaranteed Critical + legal threat ──────────────
CONV_ID    = "TEST-ALL-CHANNELS-001"
AGENT_NAME = "Marcus Rivera"
TRANSCRIPT = """\
Customer: I have been waiting 10 days for my withdrawal of €2,000. This is completely unacceptable.
Marcus Rivera: Hello, I apologise for the delay. Let me look into this for you right away.
Marcus Rivera: I can see your withdrawal is pending a manual review. I am escalating this now.
Customer: I have sent my ID three times already. Your verification team is incompetent.
Marcus Rivera: I understand your frustration. I will mark this as urgent.
Customer: If this is not resolved today I am contacting my lawyer and filing a complaint with the Malta Gaming Authority. I have screenshots of everything.
Marcus Rivera: I completely understand. I have escalated to our compliance team and you will receive a call within 2 hours.
Customer: Two hours? I want it resolved NOW. I am also a VIP member and this is how you treat me?
Marcus Rivera: As a VIP member your case is being given highest priority. Reference: ESC-2024-5521."""

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
    "Severity: Critical=fraud/legal threat/VIP, High=major unresolved, Medium=partial, Low=minor/resolved. "
    "is_alert=true for: fraud, legal threat, regulatory threat, abusive behavior, VIP dissatisfied, Critical+unresolved."
)

# ── STEP 1: Claude AI analysis ───────────────────────────────────────────────
print("=" * 60)
print("  ALL-CHANNELS TEST — Chat QA System")
print("=" * 60)
print(f"\nConversation : {CONV_ID}")
print(f"Agent        : {AGENT_NAME}")
print(f"Transcript   : {len(TRANSCRIPT.splitlines())} lines\n")

print("STEP 1: Running Claude AI analysis...")
resp = http_post(
    "https://api.anthropic.com/v1/messages",
    {"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
    {"model": "claude-sonnet-4-6", "max_tokens": 1024, "system": SYSTEM_PROMPT,
     "messages": [{"role": "user", "content": f"Agent: {AGENT_NAME}\n\nTranscript:\n{TRANSCRIPT}"}]},
)
raw = resp.get("content", [{}])[0].get("text", "").strip()
raw = re.sub(r"^```[a-z]*\s*", "", raw)
raw = re.sub(r"\s*```$", "", raw)
analysis   = json.loads(raw)

VALID_SEV  = ["Low", "Medium", "High", "Critical"]
VALID_CAT  = ["Payment/Withdrawal", "Game Bug", "Login/Account", "Bonus/Promotion",
              "Technical Error", "Slow Response", "Inappropriate Communication", "Other"]
VALID_RES  = ["Resolved", "Partially Resolved", "Unresolved"]

severity   = analysis["severity"]          if analysis["severity"]          in VALID_SEV else "Critical"
category   = analysis["issue_category"]    if analysis["issue_category"]    in VALID_CAT else "Payment/Withdrawal"
resolution = analysis["resolution_status"] if analysis["resolution_status"] in VALID_RES else "Unresolved"
is_alert   = bool(analysis.get("is_alert", True))
score      = int(analysis.get("agent_score", 3))

print(f"  Severity: {severity} | Category: {category} | Score: {score}/5 | Alert: {is_alert}")
print(f"  Summary : {analysis.get('summary', '')[:100]}...")

# ── STEP 2: Post to all Slack channels ──────────────────────────────────────
print("\nSTEP 2: Posting to all Slack channels...")

sev_emoji   = {"Low": ":large_green_circle:", "Medium": ":large_yellow_circle:",
               "High": ":large_orange_circle:", "Critical": ":red_circle:"}
score_stars = ":star:" * score + ":star2:" * (5 - score)
now_str     = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
sheet_url   = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit"

# 1. #chat-qa-reports — individual analysis card (mirrors WF2 output)
slack_post("#chat-qa-reports", f"QA Analysis: {CONV_ID}", [
    {"type": "header", "text": {"type": "plain_text", "text": "QA Analysis Result"}},
    {"type": "section", "fields": [
        {"type": "mrkdwn", "text": f"*Conversation:*\n{CONV_ID}"},
        {"type": "mrkdwn", "text": f"*Agent:*\n{AGENT_NAME}"},
        {"type": "mrkdwn", "text": f"*Severity:*\n{sev_emoji.get(severity, '')} {severity}"},
        {"type": "mrkdwn", "text": f"*Category:*\n{category}"},
        {"type": "mrkdwn", "text": f"*Resolution:*\n{resolution}"},
        {"type": "mrkdwn", "text": f"*Agent Score:*\n{score_stars} {score}/5"},
    ]},
    {"type": "section", "text": {"type": "mrkdwn", "text": f"*Summary:*\n{analysis.get('summary', '')}"}},
    {"type": "section", "text": {"type": "mrkdwn", "text": f"*Key Quote:*\n_{analysis.get('key_quotes', '')}_"}},
    {"type": "section", "text": {"type": "mrkdwn", "text": f"*Agent Notes:*\n{analysis.get('agent_notes', '')}"}},
    {"type": "section", "text": {"type": "mrkdwn", "text": f"*Recommended Action:*\n{analysis.get('recommended_action', '')}"}},
    {"type": "divider"},
])

# 2. #critical-alerts — real-time urgent alert (mirrors WF5 output)
if is_alert:
    slack_post("#critical-alerts", f":rotating_light: CRITICAL ALERT: {CONV_ID}", [
        {"type": "header", "text": {"type": "plain_text", "text": ":rotating_light: Critical Alert — Immediate Action Required"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Conversation:*\n<https://app.intercom.com/a/apps/ohcb8hau/conversations/{CONV_ID}|{CONV_ID}>"},
            {"type": "mrkdwn", "text": f"*Agent:*\n{AGENT_NAME}"},
            {"type": "mrkdwn", "text": f"*Severity:*\n{sev_emoji.get(severity, '')} {severity}"},
            {"type": "mrkdwn", "text": f"*Category:*\n{category}"},
        ]},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Alert Reason:*\n{analysis.get('alert_reason', '')}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Key Quote:*\n_{analysis.get('key_quotes', '')}_"}},
        {"type": "context", "elements": [{"type": "mrkdwn", "text": f"Triggered at {now_str}"}]},
    ])

# 3. #critical-escalations — auto ticket (mirrors WF4 output for Critical severity)
if severity in ("Medium", "High", "Critical"):
    ticket_id = f"TKT-{datetime.datetime.utcnow().strftime('%Y%m%d')}-001"
    slack_post("#critical-escalations", f":ticket: New {severity} Ticket: {ticket_id}", [
        {"type": "header", "text": {"type": "plain_text", "text": f":ticket: {severity} Ticket Created — {ticket_id}"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Ticket ID:*\n{ticket_id}"},
            {"type": "mrkdwn", "text": f"*Conversation:*\n{CONV_ID}"},
            {"type": "mrkdwn", "text": f"*Agent:*\n{AGENT_NAME}"},
            {"type": "mrkdwn", "text": f"*Severity:*\n{sev_emoji.get(severity, '')} {severity}"},
            {"type": "mrkdwn", "text": f"*Category:*\n{category}"},
            {"type": "mrkdwn", "text": f"*Resolution:*\n{resolution}"},
        ]},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Issue Summary:*\n{analysis.get('summary', '')}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Recommended Action:*\n{analysis.get('recommended_action', '')}"}},
        {"type": "section", "text": {"type": "mrkdwn",
            "text": f"*Review ticket in Google Sheets:*\n<{sheet_url}|Open Tickets Sheet>"}},
        {"type": "context", "elements": [{"type": "mrkdwn",
            "text": f"Team leader: review and enter Agree/Disagree feedback in the Tickets tab."}]},
    ])

# 4. #chat-qa-trends — 7-day pattern anomaly (mirrors WF6 output)
slack_post("#chat-qa-trends", ":bar_chart: 7-Day Trend Alert — Anomalies Detected", [
    {"type": "header", "text": {"type": "plain_text", "text": ":bar_chart: 7-Day Pattern Alert"}},
    {"type": "section", "text": {"type": "mrkdwn",
        "text": "*Anomalies detected in the last 7 days:*\n"
                "• :red_circle: *Payment/Withdrawal* complaints spiked *+210%* above 7-day average (14 vs avg 4.5)\n"
                "• :large_orange_circle: *Slow Response* issues up *+160%* (8 vs avg 3.1)\n"
                "• :rotating_light: *Repeat complainers:* 2 players with 3+ complaints this week"}},
    {"type": "section", "text": {"type": "mrkdwn",
        "text": "*AI Trend Summary:*\nWithdrawal processing times appear to be a systemic issue this week, with multiple VIP players affected. "
                "Recommend an urgent review of the verification team's queue. Slow response times correlate with peak hours (18:00–22:00 UTC)."}},
    {"type": "section", "text": {"type": "mrkdwn",
        "text": "*Recommendations:*\n1. Audit withdrawal queue — target <48h processing\n"
                "2. Add staffing during 18:00–22:00 UTC peak\n"
                "3. Proactively contact repeat complainers with resolution update"}},
    {"type": "section", "text": {"type": "mrkdwn",
        "text": f"<{sheet_url}|View Weekly_Trends in Google Sheets>"}},
    {"type": "context", "elements": [{"type": "mrkdwn", "text": f"7-day window ending {now_str}"}]},
])

# 5. #chat-qa-inbox — fallback ticket (mirrors WF4 when no team leader mapping found)
slack_post("#chat-qa-inbox", f":inbox_tray: Unassigned Ticket — No Team Leader Mapping", [
    {"type": "header", "text": {"type": "plain_text", "text": ":inbox_tray: Ticket Needs Manual Assignment"}},
    {"type": "section", "text": {"type": "mrkdwn",
        "text": f"A *{severity}* ticket was created for agent *{AGENT_NAME}* but no team leader mapping was found in the Agent_Team_Mapping sheet.\n\n"
                f"*Conversation:* {CONV_ID}\n"
                f"*Category:* {category}\n"
                f"*Summary:* {analysis.get('summary', '')[:200]}"}},
    {"type": "section", "text": {"type": "mrkdwn",
        "text": f"*Action required:*\n1. Assign this ticket to the correct team leader\n"
                f"2. Add *{AGENT_NAME}* to the <{sheet_url}|Agent_Team_Mapping tab> to prevent future fallbacks"}},
    {"type": "context", "elements": [{"type": "mrkdwn", "text": f"Posted at {now_str}"}]},
])

# ── Summary ──────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("  ALL-CHANNELS TEST COMPLETE")
print("=" * 60)
print(f"  Severity  : {severity}")
print(f"  Is Alert  : {is_alert}")
print(f"  Score     : {score}/5")
print()
print("Channels fired:")
print("  #chat-qa-reports       — QA analysis card (every conversation)")
if is_alert:
    print("  #critical-alerts       — Real-time alert (is_alert=true)")
if severity in ("Medium", "High", "Critical"):
    print(f"  #critical-escalations  — Auto ticket ({severity} severity)")
print("  #chat-qa-trends        — 7-day pattern anomaly demo")
print("  #chat-qa-inbox         — Fallback unassigned ticket demo")
print()
print("Check Slack — all channels should have received a message.")
