"""
test_pipeline.py
Tests the full WF2 AI analysis pipeline using a synthetic iGaming conversation.
Run: python test_pipeline.py
"""
import json, urllib.request, urllib.error, re, os

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

def http_post(url, headers, body):
    r = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:400]}")

# Realistic iGaming withdrawal complaint with legal threat
AGENT_NAME = "Sarah Mitchell"
TRANSCRIPT = """\
Customer: Hi, I requested a withdrawal of 500 USD 5 days ago and it still hasn't arrived. This is urgent.
Sarah Mitchell: Hello! I can see your withdrawal request from March 4th. Let me check the status for you.
Sarah Mitchell: I can see there was a verification hold placed on your account. Can you confirm your ID was submitted?
Customer: Yes I submitted my passport and utility bill 2 weeks ago. Why is it still on hold?
Sarah Mitchell: I apologize for the delay. The documents were received but the verification team has not processed them yet. I will escalate this now.
Customer: This is the second time this has happened. I want my money and I am considering reporting this to the gaming commission.
Sarah Mitchell: I completely understand your frustration. I have escalated your verification to priority status. You should receive confirmation within 24 hours and the withdrawal will process immediately after.
Customer: OK but if I don't hear back by tomorrow I am filing a formal complaint.
Sarah Mitchell: I have made a note of that and added a priority flag to your account. Ticket reference: WD-2024-8847."""

SYSTEM_PROMPT = (
    "You are an expert QA analyst for iGaming customer support. "
    "Analyze the conversation and return ONLY valid JSON — no markdown, no explanation — "
    "with exactly these fields:\n"
    '{"summary":"<2-3 sentence summary>","severity":"<Low|Medium|High|Critical>",'
    '"issue_category":"<Payment/Withdrawal|Game Bug|Login/Account|Bonus/Promotion|Technical Error|Slow Response|Inappropriate Communication|Other>",'
    '"resolution_status":"<Resolved|Partially Resolved|Unresolved>",'
    '"key_quotes":"<most important quote from conversation>",'
    '"agent_score":<integer 1-5>,'
    '"agent_notes":"<specific feedback for the agent>",'
    '"recommended_action":"<what should happen next>",'
    '"is_alert":<true|false>,'
    '"alert_reason":"<reason if is_alert is true, else empty string>"}\n'
    "Severity guide: Critical=fraud/data breach/legal threat, "
    "High=major issue unresolved, Medium=partially resolved, Low=minor/fully resolved. "
    "is_alert=true only for: fraud suspicion, data breach, legal threat, "
    "abusive behavior, or Critical+unresolved."
)

print("Testing WF2 AI Analysis pipeline...")
print(f"Agent: {AGENT_NAME}")
print(f"Transcript: {len(TRANSCRIPT.splitlines())} lines")
print()

resp = http_post(
    "https://api.anthropic.com/v1/messages",
    {
        "x-api-key": ENV["ANTHROPIC_API_KEY"],
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    },
    {
        "model": "claude-sonnet-4-6",
        "max_tokens": 1024,
        "system": SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": (
                    f"Analyze this iGaming support conversation:\n\n"
                    f"Agent: {AGENT_NAME}\n\n"
                    f"Transcript:\n{TRANSCRIPT}"
                ),
            }
        ],
    },
)

raw = resp.get("content", [{}])[0].get("text", "").strip()
print(f"Claude raw response ({len(raw)} chars):")
print(raw[:300])
print()

# Strip markdown fences if present
raw = re.sub(r"^```[a-z]*\s*", "", raw)
raw = re.sub(r"\s*```$", "", raw)

parsed = json.loads(raw)

VALID_SEVERITIES  = ["Low", "Medium", "High", "Critical"]
VALID_CATEGORIES  = ["Payment/Withdrawal", "Game Bug", "Login/Account", "Bonus/Promotion",
                     "Technical Error", "Slow Response", "Inappropriate Communication", "Other"]
VALID_RESOLUTIONS = ["Resolved", "Partially Resolved", "Unresolved"]

severity   = parsed["severity"]          if parsed["severity"]          in VALID_SEVERITIES  else "Low"
category   = parsed["issue_category"]    if parsed["issue_category"]    in VALID_CATEGORIES  else "Other"
resolution = parsed["resolution_status"] if parsed["resolution_status"] in VALID_RESOLUTIONS else "Unresolved"

print("=" * 55)
print("  ANALYSIS RESULT")
print("=" * 55)
print(f"  Agent           : {AGENT_NAME}")
print(f"  Severity        : {severity}")
print(f"  Category        : {category}")
print(f"  Resolution      : {resolution}")
print(f"  Agent Score     : {parsed.get('agent_score', '?')}/5")
print(f"  Is Alert        : {parsed.get('is_alert', False)}")
if parsed.get("is_alert"):
    print(f"  Alert Reason    : {parsed.get('alert_reason', '')}")
print(f"  Summary         : {parsed.get('summary', '')}")
print(f"  Key Quote       : {parsed.get('key_quotes', '')}")
print(f"  Agent Notes     : {parsed.get('agent_notes', '')}")
print(f"  Recommended     : {parsed.get('recommended_action', '')}")
print()
print("PASS - Claude AI pipeline producing correct structured output.")
