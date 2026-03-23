/**
 * WF1 — Format Transcript
 *
 * Takes a full Intercom conversation object (with conversation_parts) and
 * extracts a clean, formatted transcript. Replaces attachment-only messages
 * with [Image attached] or [File attached]. Bot messages are included with
 * role label 'BOT' so Claude has full context for dissatisfaction analysis.
 *
 * Also maps all 35 extended Intercom fields added in the 2026-03-19 migration
 * to qa_conversations and qa_bot_conversations.
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

  // Extract player contact
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

  // Counters for derived fields
  let teammateReplies = 0;
  let userReplies = 0;
  let firstClosedBy = null;
  let lastClosedBy = null;

  // Process conversation parts (reuse allParts from above)
  for (const part of allParts) {
    const authorType = part.author?.type;

    // Determine role label — include BOT messages for full conversation context
    let role;
    if (authorType === 'admin' || authorType === 'team') {
      role = 'AGENT';
      teammateReplies++;
      // Capture first agent name
      if (agentName === 'Unknown' && part.author?.name) {
        agentName = part.author.name;
      }
    } else if (authorType === 'bot' || authorType === 'operator') {
      role = 'BOT';
    } else {
      role = 'PLAYER';
      userReplies++;
    }

    // Track close actions
    if (part.part_type === 'close' || part.action === 'close') {
      const closerName = part.author?.name || part.author?.id || null;
      if (!firstClosedBy) firstClosedBy = closerName;
      lastClosedBy = closerName;
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

  // ── Extended Intercom fields (2026-03-19 migration) ──────────────────────

  // Source / channel
  const channel        = convo.source?.type || null;
  const sourceUrl      = convo.source?.url  || null;
  const initiatorType  = convo.source?.author?.type || null;
  const startedBy      = convo.source?.author?.name || convo.source?.author?.type || null;

  // Team & priority
  const teamAssigned   = convo.team_assignee?.name || null;
  const priority       = convo.priority || null;

  // Statistics timestamps (Intercom returns Unix seconds)
  const stats = convo.statistics || {};
  const tsOrNull = (unix) => unix ? new Date(unix * 1000).toISOString() : null;

  const firstClosedAt  = tsOrNull(stats.first_close_at);
  const lastClosedAt   = tsOrNull(stats.last_close_at);
  const firstRepliedAt = tsOrNull(stats.first_admin_reply_at);

  // Conversation rating
  const rating = convo.conversation_rating || {};
  const lastRatingUpdatedAt         = tsOrNull(rating.created_at);
  const lastTeammateRating          = rating.rating  || null;
  const lastTeammateRatingRemark    = rating.remark  || null;

  // AI / bot rating
  const aiAgent = convo.ai_agent || {};
  const finAiRatingUpdatedAt        = tsOrNull(aiAgent.rating_updated_at);
  // last_chatbot_rating_updated_at uses the same source field — kept for schema compatibility
  const lastChatbotRatingUpdatedAt  = finAiRatingUpdatedAt;
  const lastChatbotRating           = aiAgent.rating  || null;
  const lastChatbotRatingRemark     = aiAgent.remark  || null;
  const lastChatbotRated            = aiAgent.rated_teammate?.name || null;

  // Numeric statistics
  const firstResponseTimeSeconds          = stats.time_to_admin_reply                              || null;
  const timeToFirstAssignmentSeconds      = stats.first_assignment_to_first_admin_reply_time        || null;
  const numberOfReassignments             = stats.count_assignments                                 || 0;
  const handlingTimeSeconds               = stats.median_time_to_reply                              || null;

  // Derived: time to close in seconds
  const lastCloseUnix = stats.last_close_at || null;
  const timeToCloseSeconds = (lastCloseUnix && convo.created_at)
    ? lastCloseUnix - convo.created_at
    : null;

  // Derived reply counts
  const repliesToClose = teammateReplies + userReplies;

  // Derived: who the teammate replied to (player display name or id)
  const teammateRepliedTo = contact?.name || contact?.external_id || contact?.id || null;

  // Contact location
  const country   = contact?.location?.country        || null;
  const continent = contact?.location?.continent_code || null;

  // Contact profile
  const userType  = contact?.type  || null;
  const userName  = contact?.name  || null;
  const userEmail = contact?.email || null;

  // Custom attributes
  const customAttrs         = convo.custom_attributes || {};
  const cxScoreRating       = customAttrs['CX Score']             ?? null;
  const cxScoreExplanation  = customAttrs['CX Score explanation'] ?? null;
  const copilotUsed         = customAttrs['Copilot used']         ?? false;

  return [{
    json: {
      // Core fields
      conversation_id:  conversationId,
      player_id:        playerId,
      agent_name:       agentName,
      transcript,
      tags,
      created_at:       createdAt,
      collected_at:     collectedAt,
      status,
      intercom_link:    intercomLink,
      is_bot_handled:   isBotHandled,

      // ── Extended Intercom fields ──────────────────────────────────────────
      channel,
      source_url:                       sourceUrl,
      initiator_type:                   initiatorType,
      started_by:                       startedBy,
      team_assigned:                    teamAssigned,
      priority,
      first_closed_at:                  firstClosedAt,
      last_closed_at:                   lastClosedAt,
      first_replied_at:                 firstRepliedAt,
      last_rating_updated_at:           lastRatingUpdatedAt,
      fin_ai_rating_updated_at:         finAiRatingUpdatedAt,
      last_teammate_rating:             lastTeammateRating,
      last_teammate_rating_remark:      lastTeammateRatingRemark,
      first_response_time_seconds:      firstResponseTimeSeconds,
      time_to_first_assignment_seconds: timeToFirstAssignmentSeconds,
      number_of_reassignments:          numberOfReassignments,
      handling_time_seconds:            handlingTimeSeconds,
      time_to_close_seconds:            timeToCloseSeconds,
      teammate_replies:                 teammateReplies,
      user_replies:                     userReplies,
      replies_to_close:                 repliesToClose,
      first_closed_by:                  firstClosedBy,
      last_closed_by:                   lastClosedBy,
      teammate_replied_to:              teammateRepliedTo,
      country,
      continent,
      user_type:                        userType,
      user_name:                        userName,
      user_email:                       userEmail,
      cx_score_rating:                  cxScoreRating,
      cx_score_explanation:             cxScoreExplanation,
      copilot_used:                     copilotUsed,
      last_chatbot_rating_updated_at:   lastChatbotRatingUpdatedAt,
      last_chatbot_rating:              lastChatbotRating,
      last_chatbot_rating_remark:       lastChatbotRatingRemark,
      last_chatbot_rated:               lastChatbotRated,
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
