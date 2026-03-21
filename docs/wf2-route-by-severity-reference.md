# WF2 Switch Node Routing Logic — Reference

This documents the n8n Switch node configuration in WF2. This is **NOT a Code node** — the routing logic is implemented via the Switch node's UI rules, not JavaScript. The code below is illustrative only.

## Switch Node Configuration (in n8n UI)

| Output | Label | Rule |
|--------|-------|------|
| 0 | Medium/High/Critical → Ticket | `{{ $json.severity }}` is **not equal to** `"Low"` |
| 1 | Critical Alert → WF5 | `{{ $json.is_alert }}` **equals** `true` |
| 2 | Low → Report Only | `{{ $json.severity }}` **equals** `"Low"` |

**Important:** Enable "Send data to all matching outputs" on the Switch node. This allows Critical+Alert conversations to go to BOTH WF4 (ticket) and WF5 (alert) simultaneously.

## Routing Logic Summary

| Severity | is_alert | Outputs |
|----------|----------|---------|
| Low | any | Output 2 only (report only) |
| Medium or High | false | Output 0 only (create ticket) |
| Critical | false | Output 0 (create ticket) |
| Critical | true | Output 0 + Output 1 (ticket + alert) |

## Illustrative Code (for reference — not used in workflow)

```js
const item = $input.first().json;

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
```
