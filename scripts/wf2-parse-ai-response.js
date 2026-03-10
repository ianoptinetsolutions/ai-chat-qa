/**
 * WF2 — Parse Claude Response
 *
 * Parses and validates the Anthropic Claude API JSON response. Merges with
 * conversation metadata to produce the final Analysis_Results row.
 *
 * Input:
 *   - $input.first().json                   — raw Anthropic API response
 *   - $('Build OpenAI Request').first().json — conversation metadata
 *
 * Claude response format: { content: [{ type: "text", text: "<json string>" }] }
 * Reads: response.content?.[0]?.text
 *
 * Output: single item with Analysis_Results columns:
 *   conversation_id, player_id, agent_name, intercom_link, summary, severity,
 *   issue_category, resolution_status, key_quotes, agent_score, agent_notes,
 *   recommended_action, is_alert, alert_reason, is_bot_handled, language, analyzed_at
 *
 * NOTE: This logic is embedded verbatim in wf2-ai-analysis.json node "Parse AI Response".
 *       When updating, update BOTH this file AND the workflow JSON.
 */

const response = $input.first().json;
const buildNode = $('Build Claude Request').first().json;

try {
  const rawContent = response.content?.[0]?.text;
  if (!rawContent) throw new Error('No content in Claude response');

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (parseErr) {
    throw new Error(`Failed to parse AI JSON: ${parseErr.message}. Raw: ${rawContent.substring(0, 200)}`);
  }

  const analyzedAt = new Date().toISOString();
  const isBotHandled = buildNode.is_bot_handled === true;

  const VALID_LANGUAGES   = ['ar', 'de', 'el', 'en', 'fi', 'fr', 'it', 'no', 'pt'];
  const VALID_SEVERITIES  = ['Low', 'Medium', 'High', 'Critical'];
  const VALID_CATEGORIES  = ['Payment/Withdrawal', 'Game Bug', 'Login/Account', 'Bonus/Promotion', 'Technical Error', 'Slow Response', 'Inappropriate Communication', 'Other'];
  const VALID_RESOLUTIONS = ['Resolved', 'Partially Resolved', 'Unresolved'];

  // agent_score is null for bot-handled conversations; default to 5 only for human conversations
  let agentScore;
  if (isBotHandled) {
    agentScore = null;
  } else {
    agentScore = Number.isInteger(parsed.agent_performance_score) ? parsed.agent_performance_score : 5;
  }

  return [{
    json: {
      conversation_id: buildNode.conversation_id || 'unknown',
      player_id: buildNode.player_id || 'unknown',
      agent_name: buildNode.agent_name || 'Unknown',
      intercom_link: buildNode.intercom_link || '',
      summary: parsed.summary || '',
      severity: VALID_SEVERITIES.includes(parsed.dissatisfaction_severity) ? parsed.dissatisfaction_severity : 'Medium',
      issue_category: VALID_CATEGORIES.includes(parsed.issue_category) ? parsed.issue_category : 'Other',
      resolution_status: VALID_RESOLUTIONS.includes(parsed.resolution_status) ? parsed.resolution_status : 'Unresolved',
      key_quotes: parsed.key_quotes || '',
      agent_score: agentScore,
      agent_notes: parsed.agent_performance_notes || '',
      recommended_action: parsed.recommended_action || '',
      is_alert: parsed.is_alert_worthy === true,
      alert_reason: parsed.alert_reason || '',
      is_bot_handled: isBotHandled,
      language: VALID_LANGUAGES.includes(parsed.language) ? parsed.language : 'en',
      analyzed_at: analyzedAt
    }
  }];
} catch (err) {
  throw new Error(`[PARSE ERROR] Parse AI Response failed for ${buildNode.conversation_id}: ${err.message}`);
}
