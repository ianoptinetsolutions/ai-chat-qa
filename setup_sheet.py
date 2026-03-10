"""
setup_sheet.py  –  Creates all 9 tabs + headers in the Google Sheet.
Uses a temporary n8n scheduled workflow with HTTP Request nodes.
"""
import json, urllib.request, urllib.error, os, time

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

ENV       = load_env()
N8N_URL   = ENV["N8N_CLOUD_URL"].rstrip("/")
API_KEY   = ENV["N8N_API_KEY"]
SHEET_ID  = ENV["GOOGLE_SHEET_ID"]
CRED_ID   = "tNxhzmaZZCSZ5fGe"
CRED_NAME = "Google Sheets account 4"

def req(method, path, body=None):
    url  = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    r    = urllib.request.Request(url, data=data, method=method,
               headers={"X-N8N-API-KEY": API_KEY,
                        "Content-Type":  "application/json",
                        "Accept":        "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:600]}")

HEADERS = {
    "Raw_Conversations":  ["conversation_id","player_id","agent_name","transcript",
                           "tags","created_at","collected_at","status","intercom_link"],
    "Analysis_Results":   ["conversation_id","player_id","agent_name","summary","severity",
                           "issue_category","resolution_status","key_quotes","agent_score",
                           "agent_notes","recommended_action","is_alert","alert_reason",
                           "analyzed_at","intercom_link"],
    "Report_Log":         ["date","total_analyzed","critical_count","high_count",
                           "medium_count","low_count","satisfaction_rate","sent_at"],
    "Agent_Team_Mapping": ["agent_name","agent_email","team_leader_name","team_leader_slack_id"],
    "Tickets":            ["ticket_id","date","conversation_id","player_id","agent_name",
                           "severity","issue_category","summary","key_quotes",
                           "recommended_action","assigned_to","status","feedback",
                           "feedback_processed","intercom_link","created_at"],
    "Alert_Log":          ["alert_id","date","conversation_id","player_id","alert_reason",
                           "severity","notified_to","responded","response_time"],
    "Weekly_Trends":      ["week_start","week_end","top_issues_json","anomalies_json",
                           "repeat_complainers","trend_summary","recommendations"],
    "Accuracy_Log":       ["date","total_reviewed","agreed","disagreed","accuracy_rate",
                           "worst_category","notes"],
    "Monthly_Reports":    ["month","total_conversations","satisfaction_rate","top_issues",
                           "accuracy_rate","report_html","status","generated_at"],
}

# Pre-compute the two JSON bodies we need to POST
adds = [{"addSheet": {"properties": {"title": name}}} for name in HEADERS]
batch_update_body = json.dumps({"requests": adds})

vals = [{"range": f"{name}!A1", "values": [cols]} for name, cols in HEADERS.items()]
values_update_body = json.dumps({"valueInputOption": "RAW", "data": vals})

JS_CODE = (
    "// Just pass the pre-computed bodies through\n"
    "return [{ json: {\n"
    f"  batchBody:  {json.dumps(batch_update_body)},\n"
    f"  valuesBody: {json.dumps(values_update_body)}\n"
    "}}];\n"
)

def http_node(name, method, url, body_expr, pos_x, cred=True):
    params = {
        "method": method,
        "url": url,
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "googleSheetsOAuth2Api",
        "sendBody": True,
        "contentType": "raw",
        "rawContentType": "application/json",
        "body": body_expr,
    }
    node = {
        "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [pos_x, 300],
        "parameters": params,
    }
    if cred:
        node["credentials"] = {"googleSheetsOAuth2Api": {"id": CRED_ID, "name": CRED_NAME}}
    return node

WF = {
    "name": "Sheet Setup Temp",
    "nodes": [
        {
            "name": "Schedule",
            "type": "n8n-nodes-base.scheduleTrigger",
            "typeVersion": 1.2,
            "position": [0, 300],
            "parameters": {"rule": {"interval": [{"field": "seconds", "secondsInterval": 30}]}},
        },
        {
            "name": "Build Data",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [250, 300],
            "parameters": {"jsCode": JS_CODE},
        },
        http_node("Create Tabs",
                  "POST",
                  f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}:batchUpdate",
                  "={{ $json.batchBody }}",
                  500),
        http_node("Write Headers",
                  "POST",
                  f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values:batchUpdate",
                  "={{ $('Build Data').first().json.valuesBody }}",
                  750),
    ],
    "connections": {
        "Schedule":   {"main": [[{"node": "Build Data",    "type": "main", "index": 0}]]},
        "Build Data": {"main": [[{"node": "Create Tabs",   "type": "main", "index": 0}]]},
        "Create Tabs":{"main": [[{"node": "Write Headers", "type": "main", "index": 0}]]},
    },
    "settings": {"executionOrder": "v1"},
}

wf_id = None
try:
    print("Creating workflow...")
    created = req("POST", "/workflows", WF)
    wf_id   = created["id"]
    print(f"  ID: {wf_id}")

    print("Activating (fires within 30s)...")
    req("POST", f"/workflows/{wf_id}/activate")

    print("Waiting for execution", end="", flush=True)
    for _ in range(18):
        time.sleep(5)
        print(".", end="", flush=True)
        execs = req("GET", f"/executions?workflowId={wf_id}&limit=1&includeData=true")
        if execs.get("data"):
            ex = execs["data"][0]
            if ex.get("status") in ("success", "error", "crashed"):
                print(f"\n  Status: {ex['status']}")
                run_data = (ex.get("data") or {}).get("resultData", {}).get("runData", {})
                for node_name, runs in run_data.items():
                    for run in runs:
                        err = run.get("error")
                        out = (run.get("data") or {}).get("main", [[]])
                        if err:
                            msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
                            print(f"  [{node_name}] ERROR: {msg[:300]}")
                        elif out and out[0]:
                            sample = out[0][0].get("json", {}) if out[0] else {}
                            keys = list(sample.keys())[:6]
                            print(f"  [{node_name}] OK  keys={keys}")
                break
    else:
        print("\n  Timed out waiting for execution.")

finally:
    if wf_id:
        print("Cleaning up...")
        try:
            req("POST", f"/workflows/{wf_id}/deactivate")
        except Exception:
            pass
        try:
            req("DELETE", f"/workflows/{wf_id}")
            print("  Removed.")
        except Exception as e:
            print(f"  Could not delete: {e}")

print()
print("Open the sheet to check tabs:")
print(f"  https://docs.google.com/spreadsheets/d/{SHEET_ID}")
