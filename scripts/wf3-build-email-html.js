/**
 * WF3 — Build Daily Report Email HTML
 *
 * Renders the daily summary HTML email from compiled metrics.
 * Output is inline-CSS HTML compatible with Gmail, Outlook, Apple Mail.
 *
 * Input:  $input.first().json — compiled metrics from wf3-compile-metrics.js
 * Output: single item with { subject, html_body, plain_text }
 */

const metrics = $input.first().json;
const {
  date, total_analyzed, critical_count, high_count,
  medium_count, low_count, satisfaction_rate,
  top_issues, critical_high_items, agent_flags, generated_at
} = metrics;

const formattedDate = new Date(date).toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// Color helper
const satColor = satisfaction_rate >= 80 ? '#16a34a' : satisfaction_rate >= 60 ? '#d97706' : '#dc2626';
const critColor = critical_count > 0 ? '#dc2626' : '#16a34a';

// Severity badge colors
const severityColors = {
  Critical: { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  High:     { bg: '#fff7ed', text: '#ea580c', border: '#fdba74' },
  Medium:   { bg: '#fefce8', text: '#ca8a04', border: '#fde047' },
  Low:      { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' },
};

function severityBadge(sev) {
  const c = severityColors[sev] || severityColors.Medium;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;background:${c.bg};color:${c.text};border:1px solid ${c.border};">${sev}</span>`;
}

// Critical & High table rows
const critHighRows = critical_high_items.slice(0, 20).map(item => `
  <tr style="border-bottom:1px solid #e5e7eb;">
    <td style="padding:8px 10px;font-size:13px;font-family:monospace;">${item.conversation_id}</td>
    <td style="padding:8px 10px;font-size:13px;">${item.agent_name}</td>
    <td style="padding:8px 10px;font-size:13px;">${item.issue_category}</td>
    <td style="padding:8px 10px;">${severityBadge(item.severity)}</td>
    <td style="padding:8px 10px;font-size:12px;color:#4b5563;">${item.recommended_action}</td>
    <td style="padding:8px 10px;"><a href="${item.intercom_link}" style="color:#2563eb;font-size:12px;text-decoration:none;">View</a></td>
  </tr>`).join('');

// Top issues rows
const maxCount = top_issues.length > 0 ? top_issues[0].count : 1;
const topIssueRows = top_issues.map((issue, idx) => {
  const barWidth = Math.round((issue.count / maxCount) * 180);
  return `
  <tr style="background:${idx % 2 === 0 ? '#fff' : '#f9fafb'};border-bottom:1px solid #e5e7eb;">
    <td style="padding:8px 10px;font-weight:bold;color:#374151;">#${idx + 1}</td>
    <td style="padding:8px 10px;font-size:13px;">${issue.category}</td>
    <td style="padding:8px 10px;text-align:center;font-weight:bold;">${issue.count}</td>
    <td style="padding:8px 10px;">
      <div style="background:#e5e7eb;border-radius:4px;height:8px;width:180px;">
        <div style="background:#2563eb;border-radius:4px;height:8px;width:${barWidth}px;"></div>
      </div>
    </td>
  </tr>`;
}).join('');

// Agent flags rows
const agentFlagRows = agent_flags.length > 0
  ? agent_flags.map(a => `
  <tr style="border-bottom:1px solid #e5e7eb;background:#fef2f2;">
    <td style="padding:8px 10px;font-size:13px;">${a.agent_name}</td>
    <td style="padding:8px 10px;text-align:center;font-weight:bold;color:#dc2626;">${a.avg_score}</td>
    <td style="padding:8px 10px;text-align:center;color:#6b7280;">${a.conversation_count}</td>
    <td style="padding:8px 10px;font-size:12px;color:#dc2626;">Coaching required</td>
  </tr>`).join('')
  : '<tr><td colspan="4" style="padding:12px 10px;text-align:center;color:#6b7280;font-style:italic;">No agent flags today</td></tr>';

const html_body = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#1a1a2e;padding:24px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:20px;">&#x1F4CA; Daily Chat QA Report</h1>
    <p style="margin:6px 0 0;color:#94a3b8;font-size:14px;">${formattedDate}</p>
  </td></tr>

  <!-- DASHBOARD STATS -->
  <tr><td style="background:#fff;padding:20px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="25%" style="text-align:center;padding:12px 6px;">
          <div style="font-size:32px;font-weight:bold;color:#1a1a2e;">${total_analyzed}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Total Analyzed</div>
        </td>
        <td width="25%" style="text-align:center;padding:12px 6px;border-left:1px solid #e5e7eb;">
          <div style="font-size:32px;font-weight:bold;color:${satColor};">${satisfaction_rate}%</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Satisfaction Rate</div>
        </td>
        <td width="25%" style="text-align:center;padding:12px 6px;border-left:1px solid #e5e7eb;">
          <div style="font-size:32px;font-weight:bold;color:${critColor};">${critical_count}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Critical</div>
        </td>
        <td width="25%" style="text-align:center;padding:12px 6px;border-left:1px solid #e5e7eb;">
          <div style="font-size:32px;font-weight:bold;color:#ea580c;">${high_count}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">High</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- SEVERITY BREAKDOWN -->
  <tr><td style="background:#f9fafb;padding:10px 28px;">
    <p style="margin:0;font-size:12px;color:#6b7280;text-align:center;">
      ${severityBadge('Critical')} ${critical_count} &nbsp;
      ${severityBadge('High')} ${high_count} &nbsp;
      ${severityBadge('Medium')} ${medium_count} &nbsp;
      ${severityBadge('Low')} ${low_count}
    </p>
  </td></tr>

  ${critical_high_items.length > 0 ? `
  <!-- CRITICAL & HIGH TABLE -->
  <tr><td style="background:#fff;padding:20px 28px;">
    <h2 style="margin:0 0 14px;font-size:16px;color:#1a1a2e;">&#x1F525; Critical &amp; High Priority (${critical_high_items.length})</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Conv ID</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Agent</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Category</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Sev.</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Action</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Link</th>
        </tr>
      </thead>
      <tbody>${critHighRows}</tbody>
    </table>
  </td></tr>` : ''}

  <!-- TOP ISSUES -->
  <tr><td style="background:#fff;padding:20px 28px;border-top:1px solid #e5e7eb;">
    <h2 style="margin:0 0 14px;font-size:16px;color:#1a1a2e;">&#x1F4CA; Top Issues Today</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;">#</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;">Category</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:#6b7280;">Count</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;">Volume</th>
        </tr>
      </thead>
      <tbody>${topIssueRows}</tbody>
    </table>
  </td></tr>

  <!-- AGENT FLAGS -->
  <tr><td style="background:#fff;padding:20px 28px;border-top:1px solid #e5e7eb;">
    <h2 style="margin:0 0 14px;font-size:16px;color:#1a1a2e;">&#x1F464; Agent Performance Flags</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;">Agent</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:#6b7280;">Avg Score</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:#6b7280;">Conversations</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;">Action</th>
        </tr>
      </thead>
      <tbody>${agentFlagRows}</tbody>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f1f5f9;padding:16px 28px;border-radius:0 0 8px 8px;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
      Generated automatically by Chat QA System &bull; ${generated_at} &bull; AI analysis — for human review
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

const subject = `[QA Report] ${formattedDate} — ${total_analyzed} conversations, ${satisfaction_rate}% satisfaction${critical_count > 0 ? `, ${critical_count} CRITICAL` : ''}`;

const plain_text = `Daily QA Report — ${formattedDate}

Total Analyzed: ${total_analyzed}
Satisfaction Rate: ${satisfaction_rate}%
Critical: ${critical_count} | High: ${high_count} | Medium: ${medium_count} | Low: ${low_count}

Top Issues: ${top_issues.map(i => `${i.category} (${i.count})`).join(', ')}

${agent_flags.length > 0 ? `Agent Flags: ${agent_flags.map(a => `${a.agent_name} (avg ${a.avg_score})`).join(', ')}` : 'No agent flags today.'}

Generated: ${generated_at}`;

return [{ json: { subject, html_body, plain_text } }];
