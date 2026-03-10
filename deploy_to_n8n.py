"""
deploy_to_n8n.py
Imports all 8 workflows into your n8n cloud instance via the REST API.

Usage:
  1. Add your n8n API key to .env:  N8N_API_KEY=n8n_api_...
  2. Run: python deploy_to_n8n.py

After running, follow the printed instructions to:
  - Wire up Execute Workflow node IDs in n8n UI
  - Authorize Google Sheets + Gmail OAuth2 credentials
"""
import os
import json
import urllib.request
import urllib.error
import urllib.parse

BASE = os.path.dirname(os.path.abspath(__file__))
WF_DIR = os.path.join(BASE, "workflows")

# ── Load .env ────────────────────────────────────────────────────────────────
def load_env():
    env = {}
    env_path = os.path.join(BASE, ".env")
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

ENV = load_env()

N8N_URL    = ENV.get("N8N_CLOUD_URL", "").rstrip("/")
N8N_API_KEY = ENV.get("N8N_API_KEY", "").strip()

# ── Preflight checks ─────────────────────────────────────────────────────────
def preflight():
    if not N8N_API_KEY:
        print("ERROR: N8N_API_KEY is not set in .env")
        print("  Get it from: https://automateoptinet.app.n8n.cloud/settings/api")
        print("  Then add it to .env:  N8N_API_KEY=n8n_api_...")
        raise SystemExit(1)
    if not N8N_URL:
        print("ERROR: N8N_CLOUD_URL is not set in .env")
        raise SystemExit(1)
    print(f"n8n instance : {N8N_URL}")
    print(f"API key      : {N8N_API_KEY[:12]}...")
    print()

# ── HTTP helper ──────────────────────────────────────────────────────────────
def n8n_request(method, path, body=None):
    url = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "X-N8N-API-KEY": N8N_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        raise RuntimeError(f"HTTP {e.code} on {method} {path}: {body_text[:300]}")

# ── Import order (sub-workflows first so WF2 can reference them) ─────────────
IMPORT_ORDER = [
    "wf4-auto-ticket-creation.json",
    "wf5-critical-alerts.json",
    "wf2-ai-analysis.json",
    "wf1-daily-data-collection.json",
    "wf3-daily-summary-report.json",
    "wf6-pattern-detection.json",
    "wf7-feedback-loop.json",
    "wf8-monthly-report.json",
]

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    preflight()

    # Verify API connectivity
    try:
        me = n8n_request("GET", "/workflows?limit=1")
        print(f"Connected to n8n. Existing workflows: {me.get('count', '?')}\n")
    except Exception as e:
        print(f"ERROR: Could not connect to n8n API: {e}")
        print("  Check that your N8N_API_KEY is correct and the instance is running.")
        raise SystemExit(1)

    imported = {}   # filename -> { id, name }
    failed   = []

    for fname in IMPORT_ORDER:
        fpath = os.path.join(WF_DIR, fname)
        if not os.path.exists(fpath):
            print(f"  [SKIP] {fname} - file not found")
            continue

        with open(fpath, encoding="utf-8") as f:
            wf_data = json.load(f)

        # n8n POST /workflows rejects certain read-only / server-managed fields
        for field in ("id", "createdAt", "updatedAt", "versionId", "active"):
            wf_data.pop(field, None)

        # Check if workflow with same name already exists (idempotency)
        existing_id = None
        try:
            search = n8n_request("GET", f"/workflows?limit=50&name={urllib.parse.quote(wf_data['name'])}")
            for wf in search.get("data", []):
                if wf.get("name") == wf_data["name"]:
                    existing_id = wf["id"]
                    break
        except Exception:
            pass  # proceed with POST if search fails

        try:
            if existing_id:
                # Update existing workflow (only accepted fields)
                update_body = {k: wf_data[k] for k in ("name", "nodes", "connections", "settings") if k in wf_data}
                result = n8n_request("PUT", f"/workflows/{existing_id}", update_body)
                wf_id   = existing_id
                wf_name = result.get("name", fname)
                imported[fname] = {"id": wf_id, "name": wf_name}
                print(f"  [UPDATE] {fname}  ->  ID: {wf_id}  ({wf_name})")
            else:
                result = n8n_request("POST", "/workflows", wf_data)
                wf_id   = result.get("id", "?")
                wf_name = result.get("name", fname)
                imported[fname] = {"id": wf_id, "name": wf_name}
                print(f"  [CREATE] {fname}  ->  ID: {wf_id}  ({wf_name})")
        except RuntimeError as e:
            print(f"  [FAIL] {fname}  ->  {e}")
            failed.append(fname)

    print()

    # ── Summary ───────────────────────────────────────────────────────────────
    print("=" * 60)
    print(f"Imported: {len(imported)}/8   Failed: {len(failed)}")
    print()

    if imported:
        print("Workflow IDs assigned by n8n:")
        for fname, info in imported.items():
            print(f"  {info['id']:>6}  {info['name']}")
        print()

    # ── Required manual steps ─────────────────────────────────────────────────
    wf2_id = imported.get("wf2-ai-analysis.json", {}).get("id", "?")
    wf4_id = imported.get("wf4-auto-ticket-creation.json", {}).get("id", "?")
    wf5_id = imported.get("wf5-critical-alerts.json", {}).get("id", "?")
    wf1_id = imported.get("wf1-daily-data-collection.json", {}).get("id", "?")

    print("NEXT STEPS (do these in the n8n UI):")
    print()
    print("1. Wire Execute Workflow node IDs:")
    print(f"   WF1 (ID {wf1_id})  -> 'Trigger WF2' node  -> set workflowId = {wf2_id}")
    print(f"   WF2 (ID {wf2_id})  -> 'Trigger WF4 Ticket' node -> set workflowId = {wf4_id}")
    print(f"   WF2 (ID {wf2_id})  -> 'Trigger WF5 Alert'  node -> set workflowId = {wf5_id}")
    print()
    print("2. Create credentials in n8n Settings -> Credentials:")
    print("   - Google Sheets OAuth2  (name: 'Google Sheets',  id: google_sheets_oauth)")
    print("   - Gmail OAuth2          (name: 'Gmail',          id: gmail_oauth)")
    print("   - Slack API             (name: 'Slack',          id: slack_api)")
    print("     Token: " + ENV.get("SLACK_BOT_TOKEN", "see .env"))
    print("   - Header Auth           (name: 'Anthropic API',  id: anthropic_api)")
    print("     Header: x-api-key  |  Value: " + ENV.get("ANTHROPIC_API_KEY", "see .env")[:30] + "...")
    print("   - Header Auth           (name: 'Intercom API',   id: intercom_api)")
    print("     Header: Authorization  |  Value: Bearer " + ENV.get("INTERCOM_API_TOKEN", "see .env")[:20] + "...")
    print()
    print("3. Authorize Google Sheets + Gmail OAuth (click Connect in the credential).")
    print()
    print("4. Add rows to the Agent_Team_Mapping tab in Google Sheets.")
    print()
    print("5. Activate workflows in this order: WF4 -> WF5 -> WF2 -> WF1 -> WF3 -> WF6 -> WF7 -> WF8")
    print()
    print("See DEPLOYMENT.md for full details on each step.")

if __name__ == "__main__":
    main()
