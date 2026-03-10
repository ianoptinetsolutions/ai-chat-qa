"""
Switch all AI calls from OpenAI GPT-4o to Claude claude-sonnet-4-6.
Updates: .env, wf2, wf6, wf8 workflow JSONs.
"""
import os
import json

base = r"c:\Users\windows 11\Desktop\Folders\Ai Projects\AI Chat QA"
wf_base = os.path.join(base, "workflows")


# ── 1. Update .env ──────────────────────────────────────────────────────────

env_path = os.path.join(base, ".env")
with open(env_path, "r", encoding="utf-8") as f:
    env = f.read()

env = env.replace(
    "# Your OpenAI API key for GPT-4o analysis.\n"
    "# Get it from: platform.openai.com → API keys\n"
    "OPENAI_API_KEY=sk-your_openai_api_key_here",
    "# Your Anthropic API key for Claude.\n"
    "# Get it from: console.anthropic.com → API Keys\n"
    "ANTHROPIC_API_KEY=sk-ant-your_anthropic_api_key_here"
)
# Update credential name hint in comment
env = env.replace("openai_api", "anthropic_api")

with open(env_path, "w", encoding="utf-8") as f:
    f.write(env)
print("✓ .env updated")


# ── Helper ───────────────────────────────────────────────────────────────────

def add_anthropic_header(params):
    """Add anthropic-version header to node options."""
    options = params.get("options", {})
    headers = options.get("headers", {})
    params_list = headers.get("parameters", [])
    if not any(p.get("name") == "anthropic-version" for p in params_list):
        params_list.append({"name": "anthropic-version", "value": "2023-06-01"})
    headers["parameters"] = params_list
    options["headers"] = headers
    params["options"] = options
    return params


def update_cred(node):
    node["credentials"] = {
        "httpHeaderAuth": {"id": "anthropic_api", "name": "Anthropic API"}
    }


# ── 2. WF2 — AI Analysis ────────────────────────────────────────────────────

wf2_path = os.path.join(wf_base, "wf2-ai-analysis.json")
with open(wf2_path, "r", encoding="utf-8") as f:
    wf2 = json.load(f)

for node in wf2["nodes"]:
    params = node.get("parameters", {})

    # HTTP Request node (OpenAI call)
    if (node["type"] == "n8n-nodes-base.httpRequest"
            and "openai" in params.get("url", "").lower()):
        node["name"] = "Call Claude API"
        params["url"] = "https://api.anthropic.com/v1/messages"
        # Body: switch from OpenAI format to Claude format
        params["body"] = (
            "={{ JSON.stringify({ "
            "model: $json.model, "
            "max_tokens: $json.max_tokens, "
            "system: $json.system, "
            "messages: $json.messages "
            "}) }}"
        )
        update_cred(node)
        params = add_anthropic_header(params)
        node["parameters"] = params

    # Code node: Build Request (for wf2 the code node builds the payload)
    if node["type"] == "n8n-nodes-base.code" and "build" in node["name"].lower():
        js = params.get("jsCode", "")
        # Switch model and format to Claude
        js = js.replace("model: 'gpt-4o'", "model: 'claude-sonnet-4-6'")
        js = js.replace("temperature: 0.1,", "max_tokens: 4096,")
        js = js.replace("response_format: { type: 'json_object' },\n        ", "")
        # Claude uses a top-level 'system' field, not a system role in messages.
        # Replace the system message entry with a plain 'system' property.
        old_system_block = (
            "messages: [\n"
            "      {\n"
            "        role: 'system',\n"
            "        content: `You are an expert Quality Assurance analyst"
        )
        if old_system_block in js:
            # Find the end of the system content backtick
            idx_start = js.find(old_system_block)
            # Find the closing of the system message object
            # Locate the user message start
            user_start = js.find("role: 'user'", idx_start)
            # Find the opening brace before it
            obj_open = js.rfind("{", idx_start, user_start)
            # Extract system content (between the two backticks in content: `...`)
            bt1 = js.find("`", idx_start) + 1
            bt2 = js.find("`", bt1)
            system_content = js[bt1:bt2]
            # Reconstruct: system: `...`, messages: [user_msg]
            user_block_start = js.find("{", user_start - 5)
            # Find end of messages array
            msg_close = js.find("]", user_start)
            user_obj = js[user_block_start:msg_close]
            replacement = (
                "system: `" + system_content + "`,\n"
                "      messages: [\n"
                "      " + user_obj + "\n"
                "      ]"
            )
            js = js[:idx_start] + replacement + js[msg_close + 1:]

        params["jsCode"] = js
        node["parameters"] = params

    # Code node: Parse AI Response
    if node["type"] == "n8n-nodes-base.code" and "parse" in node["name"].lower():
        js = params.get("jsCode", "")
        js = js.replace(
            "const content = openAiResponse.choices?.[0]?.message?.content;",
            "const content = openAiResponse.content?.[0]?.text;"
        )
        params["jsCode"] = js
        node["parameters"] = params

with open(wf2_path, "w", encoding="utf-8") as f:
    json.dump(wf2, f, indent=2, ensure_ascii=False)
print("✓ wf2-ai-analysis.json updated")


# ── 3. WF6 — Pattern Detection ──────────────────────────────────────────────

wf6_path = os.path.join(wf_base, "wf6-pattern-detection.json")
with open(wf6_path, "r", encoding="utf-8") as f:
    wf6 = json.load(f)

WF6_SYSTEM = (
    "You are a senior QA analyst for an iGaming customer support operation. "
    "Analyze 7-day rolling window data and generate a trend report.\n\n"
    "Write two sections:\n\n"
    "TREND SUMMARY\n"
    "3-5 sentences describing what is happening: significant spikes, trending "
    "categories, repeat complainers, agent issues.\n\n"
    "RECOMMENDATIONS\n"
    "1. [specific action + owner + expected outcome]\n"
    "2. [specific action]\n"
    "3. [specific action]\n\n"
    "Be specific and data-driven. No generic advice."
)

WF6_USER = (
    "Week: {{ $json.week_start }} to {{ $json.week_end }}\n\n"
    "Top Issues (7-day):\n{{ $json.top_issues_json }}\n\n"
    "Anomalies (spiking >150% of average):\n{{ $json.anomalies_json }}\n\n"
    "Repeat Complainers (3+ in 7 days): {{ $json.repeat_complainers }}\n\n"
    "Agent Flags:\n{{ $json.agent_flags_json }}"
)

for node in wf6["nodes"]:
    params = node.get("parameters", {})

    if (node["type"] == "n8n-nodes-base.httpRequest"
            and "openai" in params.get("url", "").lower()):
        node["name"] = "Generate Trend Summary (Claude)"
        params["url"] = "https://api.anthropic.com/v1/messages"
        params["jsonBody"] = json.dumps({
            "model": "claude-sonnet-4-6",
            "max_tokens": 2048,
            "system": WF6_SYSTEM,
            "messages": [{"role": "user", "content": WF6_USER}]
        }, indent=2, ensure_ascii=False)
        # n8n needs = prefix for expression
        params["jsonBody"] = "=" + params["jsonBody"].replace(
            "{{ $json.", "{{ $json."
        )
        update_cred(node)
        params = add_anthropic_header(params)
        node["parameters"] = params

    # Parse Trend Response code node
    if node["type"] == "n8n-nodes-base.code" and "parse" in node["name"].lower():
        js = params.get("jsCode", "")
        js = js.replace(
            "openAiResponse.choices?.[0]?.message?.content",
            "openAiResponse.content?.[0]?.text"
        )
        params["jsCode"] = js
        node["parameters"] = params

with open(wf6_path, "w", encoding="utf-8") as f:
    json.dump(wf6, f, indent=2, ensure_ascii=False)
print("✓ wf6-pattern-detection.json updated")


# ── 4. WF8 — Monthly Report ─────────────────────────────────────────────────

wf8_path = os.path.join(wf_base, "wf8-monthly-report.json")
with open(wf8_path, "r", encoding="utf-8") as f:
    wf8 = json.load(f)

WF8_SYSTEM = (
    "You are a senior QA analyst generating a monthly performance report for an "
    "iGaming customer support operation. Generate a complete, self-contained HTML "
    "email report with INLINE CSS ONLY (no style tags). The report must render in "
    "Gmail, Outlook, and Apple Mail. Max width 600px. Font: Arial. Include: "
    "1) Header with month/date, 2) DRAFT warning banner, 3) Executive summary "
    "(2-3 paragraphs), 4) Key metrics table (total conversations, satisfaction "
    "rate, AI accuracy, total alerts), 5) Top 10 issue categories table, "
    "6) Agent performance table (highlight score<3 red, score>=4.5 green), "
    "7) AI Accuracy section, 8) Recommendations list (3-5 numbered items), "
    "9) Footer with draft disclaimer. Return ONLY the HTML document starting "
    "with <!DOCTYPE html>."
)

WF8_USER = (
    "Generate the monthly QA report for {{ $json.month_label }}.\n\n"
    "Metrics:\n{{ $json.metrics_json }}"
)

for node in wf8["nodes"]:
    params = node.get("parameters", {})

    if (node["type"] == "n8n-nodes-base.httpRequest"
            and "openai" in params.get("url", "").lower()):
        node["name"] = "Generate Monthly Report (Claude)"
        params["url"] = "https://api.anthropic.com/v1/messages"
        params["jsonBody"] = "=" + json.dumps({
            "model": "claude-sonnet-4-6",
            "max_tokens": 4000,
            "system": WF8_SYSTEM,
            "messages": [{"role": "user", "content": WF8_USER}]
        }, indent=2, ensure_ascii=False)
        update_cred(node)
        params = add_anthropic_header(params)
        node["parameters"] = params

    # Parse Monthly Report code node
    if node["type"] == "n8n-nodes-base.code" and "parse" in node["name"].lower():
        js = params.get("jsCode", "")
        js = js.replace(
            "openAiResponse.choices?.[0]?.message?.content || '<p>Error generating report</p>'",
            "openAiResponse.content?.[0]?.text || '<p>Error generating report</p>'"
        )
        js = js.replace(
            "openAiResponse.choices?.[0]?.message?.content",
            "openAiResponse.content?.[0]?.text"
        )
        params["jsCode"] = js
        node["parameters"] = params

with open(wf8_path, "w", encoding="utf-8") as f:
    json.dump(wf8, f, indent=2, ensure_ascii=False)
print("✓ wf8-monthly-report.json updated")

print("\nAll done. Verify with: python update_to_claude.py --verify")
