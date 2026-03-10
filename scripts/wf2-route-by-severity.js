/**
 * WF2 — Route By Severity
 *
 * Determines routing output index for the Switch node in WF2.
 * This script is used as reference for configuring the Switch node rules.
 *
 * Switch Node Configuration (in n8n UI):
 *   Output 0 (label: "Medium/High/Critical → Ticket")
 *     Rule: {{ $json.severity }} is not equal to "Low"
 *   Output 1 (label: "Critical Alert → WF5")
 *     Rule: {{ $json.is_alert }} equals true
 *   Output 2 (label: "Low → Report Only")
 *     Rule: {{ $json.severity }} equals "Low"
 *
 * Note: In n8n, a single item CAN match multiple Switch outputs when
 * "Send data to all matching outputs" is enabled. This allows Critical
 * conversations to go to BOTH WF4 (ticket) and WF5 (alert).
 *
 * Routing logic:
 *   - severity = Low                          → Output 2 only (report only)
 *   - severity = Medium or High               → Output 0 only (create ticket)
 *   - severity = Critical, is_alert = false   → Output 0 (create ticket)
 *   - severity = Critical, is_alert = true    → Output 0 + Output 1 (ticket + alert)
 *
 * This code node is NOT used in the workflow directly — the Switch node
 * is configured via its UI rules. This file documents the logic.
 */

// This script runs as a passthrough — data flows to the Switch node configured above.
const item = $input.first().json;

// Add a human-readable routing_path field for debugging
let routingPath = [];

if (item.severity !== 'Low') routingPath.push('create-ticket');
if (item.is_alert === true) routingPath.push('send-alert');
if (item.severity === 'Low') routingPath.push('report-only');

return [{
  json: {
    ...item,
    _routing_path: routingPath.join(', '),
  }
}];
