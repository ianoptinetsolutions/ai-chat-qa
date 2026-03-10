"""
validate_workflows.py
Run from project root: python validate_workflows.py
Checks all 8 workflow JSONs for correctness before importing into n8n.

Checks per workflow:
  1. Valid JSON
  2. No OpenAI API references (gpt-4o, openai.com, choices[0].message.content)
  3. No unreplaced placeholders (YOUR_*, REPLACE_ME)
  4. Node connection integrity (every source and target name exists in nodes)
  5. Credential names match expected set
  6. All $env.VARIABLE references have a matching key in .env
  7. Anthropic HTTP nodes have the required anthropic-version header

Exit code 0 = all pass. Exit code 1 = errors found.
"""
import os
import json
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
WF_DIR = os.path.join(BASE, "workflows")

# ---------------------------------------------------------------------------
# Load .env
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# Expected credential IDs per type
# ---------------------------------------------------------------------------
EXPECTED_CREDENTIALS = {
    "googleSheetsOAuth2Api": ["google_sheets_oauth"],
    "gmailOAuth2": ["gmail_oauth"],
    "slackApi": ["slack_api"],
    "httpHeaderAuth": ["anthropic_api", "intercom_api"],
}

PLACEHOLDER_RE = re.compile(r'YOUR_[A-Z_]+|REPLACE_ME', re.IGNORECASE)
ENV_VAR_RE     = re.compile(r'\$env\.([A-Z_a-z][A-Z_a-z0-9]*)')

ERRORS   = []
WARNINGS = []

def err(wf_name, msg):
    ERRORS.append(f"  [FAIL] {wf_name}: {msg}")

def warn(wf_name, msg):
    WARNINGS.append(f"  [WARN] {wf_name}: {msg}")

# ---------------------------------------------------------------------------
# Per-workflow checks
# ---------------------------------------------------------------------------
def check_workflow(wf_path):
    wf_name = os.path.basename(wf_path)

    # 1. Valid JSON
    try:
        with open(wf_path, encoding="utf-8") as f:
            wf = json.load(f)
    except json.JSONDecodeError as e:
        err(wf_name, f"Invalid JSON: {e}")
        return

    raw = open(wf_path, encoding="utf-8").read()
    nodes       = wf.get("nodes", [])
    connections = wf.get("connections", {})
    node_names  = {n["name"] for n in nodes}

    # 2. No OpenAI references
    if "openai.com" in raw.lower():
        err(wf_name, "Contains openai.com URL")
    if "gpt-4o" in raw.lower():
        err(wf_name, "Contains gpt-4o model reference")
    if "choices?.[0]?.message?.content" in raw or "choices[0].message.content" in raw:
        err(wf_name, "Contains OpenAI choices[0].message.content response format")
    if '"response_format"' in raw and '"json_object"' in raw:
        err(wf_name, "Contains OpenAI response_format json_object")

    # 3. No unreplaced placeholders
    placeholders = set(PLACEHOLDER_RE.findall(raw))
    if placeholders:
        err(wf_name, f"Unreplaced placeholders: {placeholders}")

    # 4. Connection integrity
    for src, conn_data in connections.items():
        if src not in node_names:
            err(wf_name, f"Connection source '{src}' not found in nodes")
        for output_list in conn_data.get("main", []):
            for target in output_list:
                tname = target.get("node", "")
                if tname and tname not in node_names:
                    err(wf_name, f"Connection target '{tname}' (from '{src}') not in nodes")

    # 5. Credential name validation
    for node in nodes:
        for cred_type, cred_info in node.get("credentials", {}).items():
            cred_id = cred_info.get("id", "")
            allowed = EXPECTED_CREDENTIALS.get(cred_type)
            if allowed and cred_id not in allowed:
                warn(wf_name, f"Node '{node['name']}': credential id '{cred_id}' not in expected {allowed}")

    # 6. $env.VAR references must exist in .env
    for var in set(ENV_VAR_RE.findall(raw)):
        if var not in ENV:
            warn(wf_name, f"$env.{var} referenced but not found in .env")

    # 7. Anthropic HTTP nodes must have anthropic-version header
    for node in nodes:
        if node["type"] == "n8n-nodes-base.httpRequest":
            url = node.get("parameters", {}).get("url", "")
            if "anthropic.com" in url:
                params_list = (
                    node.get("parameters", {})
                        .get("options", {})
                        .get("headers", {})
                        .get("parameters", [])
                )
                if not any(h.get("name") == "anthropic-version" for h in params_list):
                    err(wf_name, f"Node '{node['name']}': Anthropic HTTP node missing 'anthropic-version' header")

    # 8. Hardcoded email addresses (should use $env variables)
    EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
    for node in nodes:
        params_str = json.dumps(node.get("parameters", {}))
        for email in EMAIL_RE.findall(params_str):
            # Skip version-string false positives and template expressions
            if "@" in email and "env." not in email and "$" not in email:
                warn(wf_name, f"Node '{node['name']}': hardcoded email '{email}' — use $env.GMAIL_DISTRIBUTION_LIST / STAKEHOLDERS_EMAIL / QA_MANAGER_EMAIL")

    # 9. Hardcoded Slack channel names and User IDs (should use $env variables)
    SLACK_USER_ID_RE = re.compile(r'^U[A-Z0-9]{8,}$')
    for node in nodes:
        if node.get("type") == "n8n-nodes-base.slack":
            channel_val = node.get("parameters", {}).get("channel", {})
            if isinstance(channel_val, dict):
                val = channel_val.get("value", "")
            else:
                val = str(channel_val)
            if val.startswith("#") and "env." not in val and "{{" not in val:
                warn(wf_name, f"Node '{node['name']}': hardcoded Slack channel '{val}' — use $env.SLACK_CHANNEL_*")
            if SLACK_USER_ID_RE.match(val):
                warn(wf_name, f"Node '{node['name']}': hardcoded Slack User ID '{val}' — use $env.QA_MANAGER_SLACK_ID")

    # 10. Execute Workflow nodes must not have placeholder IDs
    for node in nodes:
        if node.get("type") == "n8n-nodes-base.executeWorkflow":
            wf_id_param = node.get("parameters", {}).get("workflowId", {})
            if isinstance(wf_id_param, dict):
                id_val = wf_id_param.get("value", "")
            else:
                id_val = str(wf_id_param)
            if id_val.startswith("wf") or id_val in ("", "REPLACE_ME"):
                err(wf_name, f"Node '{node['name']}': Execute Workflow has placeholder workflowId '{id_val}' — must be real n8n ID after deployment")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    wf_files = sorted(f for f in os.listdir(WF_DIR) if f.endswith(".json"))
    if not wf_files:
        print("No workflow JSON files found in ./workflows/")
        sys.exit(1)

    print(f"Validating {len(wf_files)} workflow(s) in {WF_DIR}\n")

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

    print(f"All {len(wf_files)} workflow(s) passed validation.")
    if WARNINGS:
        print(f"({len(WARNINGS)} warning(s) — review above)")

if __name__ == "__main__":
    main()
