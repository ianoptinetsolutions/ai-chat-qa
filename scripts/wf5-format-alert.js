/**
 * WF5 — Format Critical Alert
 *
 * Formats the critical alert payload for Slack #critical-alerts
 * and the high-priority Gmail notification.
 *
 * Input:  $input.first().json — analysis result with is_alert=true
 * Output: single item with { slack_blocks, slack_text, gmail_subject, gmail_html }
 */

const data = $input.first().json;

const alertId        = generateUUID();
const now            = new Date();
const timestamp      = now.toISOString();
const dateStr        = now.toISOString().split('T')[0];

const conversationId = data.conversation_id || '';
const playerId       = data.player_id       || data._player_id || '';
const agentName      = data.agent_name      || data._agent_name || '';
const severity       = data.severity        || 'Critical';
const issueCategory  = data.issue_category  || 'Other';
const summary        = data.summary         || '';
const alertReason    = data.alert_reason    || data._alert_reason || 'Critical issue detected';
const keyQuotes      = parseKeyQuotes(data.key_quotes);
const recommendedAction = data.recommended_action || '';
const intercomLink   = data.intercom_link   || data._intercom_link || '';

// Build Slack Block Kit message
const quotesText = keyQuotes.length > 0
  ? keyQuotes.map(q => `_"${q}"_`).join('\n')
  : '_No direct quotes captured_';

const slack_blocks = [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: ':rotating_light: CRITICAL ALERT — Immediate Action Required',
      emoji: true
    }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Alert Reason:* ${alertReason}\n*Conversation ID:* ${conversationId}\n*Player:* ${playerId} | *Agent:* ${agentName}`
    }
  },
  { type: 'divider' },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Summary:*\n${summary}`
    }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Player Quotes:*\n${quotesText}`
    }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Recommended Action:*\n${recommendedAction}`
    }
  },
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Conversation', emoji: true },
        url: intercomLink,
        style: 'danger'
      }
    ]
  },
  {
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `Alert ID: ${alertId} | Generated: ${timestamp}` }
    ]
  }
];

const slack_text = `:rotating_light: CRITICAL ALERT: ${alertReason} — Player ${playerId} | <${intercomLink}|View Conversation>`;

// Gmail HTML content
const gmail_subject = `[CRITICAL ALERT] ${issueCategory} — Player ${playerId} — ${dateStr}`;
const gmail_html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 22px;">&#x1F6A8; CRITICAL ALERT — Immediate Action Required</h1>
  </div>
  <div style="background: #fff5f5; border: 2px solid #dc2626; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr><td style="padding: 6px 0; font-weight: bold; width: 160px;">Alert Reason:</td><td style="padding: 6px 0; color: #dc2626; font-weight: bold;">${alertReason}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: bold;">Conversation ID:</td><td style="padding: 6px 0;">${conversationId}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: bold;">Player ID:</td><td style="padding: 6px 0;">${playerId}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: bold;">Agent:</td><td style="padding: 6px 0;">${agentName}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: bold;">Severity:</td><td style="padding: 6px 0;">${severity}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: bold;">Category:</td><td style="padding: 6px 0;">${issueCategory}</td></tr>
    </table>
    <h3 style="color: #1a1a2e; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Summary</h3>
    <p style="margin-top: 0;">${summary}</p>
    ${keyQuotes.length > 0 ? `
    <h3 style="color: #1a1a2e; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Player Quotes</h3>
    ${keyQuotes.map(q => `<blockquote style="border-left: 4px solid #dc2626; padding: 8px 16px; margin: 8px 0; background: #fff; font-style: italic;">"${q}"</blockquote>`).join('')}
    ` : ''}
    <h3 style="color: #1a1a2e; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Recommended Action</h3>
    <p style="background: #fef9c3; padding: 12px; border-radius: 4px; font-weight: bold;">${recommendedAction}</p>
    <div style="text-align: center; margin-top: 24px;">
      <a href="${intercomLink}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">View Conversation in Intercom</a>
    </div>
    <p style="color: #6b7280; font-size: 12px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 12px;">Alert ID: ${alertId} | Generated: ${timestamp}</p>
  </div>
</body>
</html>`;

return [{
  json: {
    alert_id:      alertId,
    date:          dateStr,
    conversation_id: conversationId,
    player_id:     playerId,
    alert_reason:  alertReason,
    severity:      severity,
    notified_to:   'slack:#critical-alerts, stakeholders-email',
    responded:     false,
    response_time: '',
    slack_blocks,
    slack_text,
    gmail_subject,
    gmail_html,
    timestamp,
  }
}];

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function parseKeyQuotes(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return typeof raw === 'string' ? [raw] : [];
  }
}
