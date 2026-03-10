/**
 * WF4 — Build Ticket
 *
 * Generates a ticket_id (UUID), formats the ticket title, and assembles
 * the full ticket row for the Tickets Google Sheet plus the Slack DM payload.
 *
 * Input:  $input.first().json — analysis result item (from WF2 Execute Workflow call)
 * Output: single item with ticket row fields + slack DM content
 */

const data = $input.first().json;

/**
 * Generate a UUID v4.
 * @returns {string}
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const ticketId = generateUUID();
const now = new Date();
const dateStr = now.toISOString().split('T')[0];
const createdAt = now.toISOString();

const severity       = data.severity       || data._severity       || 'Medium';
const issueCategory  = data.issue_category || data._issue_category || 'Other';
const playerId       = data.player_id      || data._player_id      || 'unknown';
const agentName      = data.agent_name     || data._agent_name     || 'Unknown';
const conversationId = data.conversation_id || '';
const summary        = data.summary        || '';
const keyQuotes      = data.key_quotes     || '[]';
const recommendedAction = data.recommended_action || '';
const intercomLink   = data.intercom_link  || data._intercom_link  || '';
const isBotHandled   = data.is_bot_handled === true;

// Ticket title format: [SEVERITY] Issue Category — Player player_id
const ticketTitle = `[${severity.toUpperCase()}] ${issueCategory} — Player ${playerId}`;

// For bot-handled conversations there is no human agent; route to escalation queue
// The agent lookup node downstream should skip the qa_agent_map query when assigned_to is pre-set
const assignedTo = isBotHandled ? 'Bot Escalation Queue' : '';  // '' = filled by agent lookup node

// Slack DM message (will be sent to team leader or escalation queue)
const agentLine = isBotHandled
  ? `:robot_face: *Handled by:* Bot (no human agent)`
  : `:bust_in_silhouette: *Agent:* ${agentName}`;

const slackDmText = `*New QA Ticket: ${ticketTitle}*${isBotHandled ? ' _(Bot Escalation)_' : ''}

:identification_card: *Ticket ID:* ${ticketId}
${agentLine}
:warning: *Severity:* ${severity}
:label: *Category:* ${issueCategory}

*Summary:*
${summary}

*Recommended Action:*
${recommendedAction}

*Conversation:* <${intercomLink}|View in Intercom>

_Please review and update the Tickets sheet with your feedback (Agree/Disagree)._`;

return [{
  json: {
    // Ticket sheet columns
    ticket_id:          ticketId,
    date:               dateStr,
    conversation_id:    conversationId,
    player_id:          playerId,
    agent_name:         agentName,
    severity:           severity,
    issue_category:     issueCategory,
    summary:            summary,
    key_quotes:         keyQuotes,
    recommended_action: recommendedAction,
    assigned_to:        assignedTo,   // Pre-set for bot convos; '' filled by agent lookup for human convos
    status:             'Open',
    feedback:           '',
    feedback_processed: false,
    intercom_link:      intercomLink,
    created_at:         createdAt,

    // Internal fields for downstream nodes
    _ticket_title:      ticketTitle,
    _slack_dm_text:     slackDmText,
    _severity:          severity,
    _is_bot_handled:    isBotHandled,  // Downstream agent lookup node: skip if true
  }
}];
