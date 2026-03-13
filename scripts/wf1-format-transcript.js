/**
 * WF1 — Format Transcript
 *
 * Takes a full Intercom conversation object (with conversation_parts) and
 * extracts a clean, formatted transcript. Replaces attachment-only messages
 * with [Image attached] or [File attached]. Bot messages are included with
 * role label 'BOT' so Claude has full context for dissatisfaction analysis.
 *
 * Input:  $input.first().json — single Intercom conversation object
 *                               (with _is_bot_handled flag from filter node)
 * Output: single item with formatted conversation data ready for Supabase
 */

const convo = $input.first().json;

try {
  const conversationId = convo.id;
  const createdAt = new Date(convo.created_at * 1000).toISOString();
  const collectedAt = new Date().toISOString();
  const status = convo.state || 'closed';
  const intercomLink = `https://app.intercom.com/a/inbox/conversation/${conversationId}`;

  // Extract player ID from contact
  const contact = convo.contacts?.contacts?.[0];
  const playerId = contact?.external_id || contact?.id || 'unknown';

  // Extract tags
  const tags = (convo.tags?.tags || []).map(t => t.name).join(', ');

  // Build transcript lines
  const lines = [];

  // First message (from player, part of the conversation body)
  const firstBody = convo.conversation_message?.body;
  if (firstBody) {
    const ts = new Date(convo.created_at * 1000).toISOString();
    const cleanBody = stripHtml(firstBody);
    lines.push(`[${ts}] PLAYER: ${cleanBody || '[Image attached]'}`);
  }

  // Detect bot-handling from full conversation parts (reliable after Get Full Conversation).
  // _is_bot_handled from Tag All Conversations is lost when Get Full Conversation fetches fresh Intercom data.
  const allParts = convo.conversation_parts?.conversation_parts || [];
  const hasHumanReply = allParts.some(p => p.author?.type === 'admin' || p.author?.type === 'team');
  const isBotHandled = !hasHumanReply;

  // Find first human agent name for the whole conversation
  let agentName = 'Unknown';

  // Process conversation parts
  const parts = convo.conversation_parts?.conversation_parts || [];
  for (const part of parts) {
    const authorType = part.author?.type;

    // Determine role label — include BOT messages for full conversation context
    let role;
    if (authorType === 'admin' || authorType === 'team') {
      role = 'AGENT';
      // Capture first agent name
      if (agentName === 'Unknown' && part.author?.name) {
        agentName = part.author.name;
      }
    } else if (authorType === 'bot' || authorType === 'operator') {
      role = 'BOT';
    } else {
      role = 'PLAYER';
    }

    const ts = new Date(part.created_at * 1000).toISOString();
    let body = part.body ? stripHtml(part.body) : '';

    // Handle attachment-only messages
    if (!body && part.attachments?.length > 0) {
      const attachment = part.attachments[0];
      const isImage = attachment.content_type?.startsWith('image/');
      body = isImage ? '[Image attached]' : '[File attached]';
    }

    if (body) {
      lines.push(`[${ts}] ${role}: ${body}`);
    }
  }

  const transcript = lines.join('\n');

  return [{
    json: {
      conversation_id: conversationId,
      player_id: playerId,
      agent_name: agentName,
      transcript,
      tags,
      created_at: createdAt,
      collected_at: collectedAt,
      status,
      intercom_link: intercomLink,
      is_bot_handled: isBotHandled,
    }
  }];

} catch (err) {
  throw new Error(`wf1-format-transcript failed for conversation ${convo?.id}: ${err.message}`);
}

/**
 * Strips HTML tags from Intercom message bodies.
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
