/**
 * WF2 — Build Claude Request
 *
 * Constructs the Anthropic API request payload for Claude claude-sonnet-4-6.
 * Claude API format: { model, max_tokens, system (top-level string), messages (user-only array) }
 * Does NOT use: temperature, response_format (OpenAI-specific fields).
 *
 * Input:  $input.first().json — conversation row from Raw_Conversations sheet
 *         Columns: conversation_id(0), player_id(1), agent_name(2), transcript(3),
 *                  created_at(4), closed_at(5), tags(6), channel(7), intercom_link(8)
 *
 * Output: { model, max_tokens, system, messages, conversation_id, player_id, agent_name, intercom_link }
 *         system = iGaming QA system prompt (string)
 *         messages = [{ role: 'user', content: <transcript> }]
 *
 * NOTE: This logic is embedded verbatim in wf2-ai-analysis.json node "Build OpenAI Request".
 *       When updating, update BOTH this file AND the workflow JSON.
 */
const item = $input.first().json;
const conversationId = item.conversation_id || item[0] || 'unknown';
const playerId       = item.player_id       || item[1] || 'unknown';
const agentName      = item.agent_name      || item[2] || 'Unknown';
const transcript     = String(item.transcript ?? item[3] ?? '');
const intercomLink   = item.intercom_link   || item[8] || ''; // col 8 in Raw_Conversations sheet
const isBotHandled   = item.is_bot_handled === true;

if (!transcript || transcript.trim().length === 0) {
  throw new Error(`Empty transcript for conversation ${conversationId} — skipping`);
}

const MAX_CHARS = 60000;
const truncated = transcript.length > MAX_CHARS
  ? transcript.substring(0, MAX_CHARS) + '\n\n[Transcript truncated]'
  : transcript;

const systemPrompt = `You are an expert Quality Assurance analyst for a regulated iGaming (online casino/sports betting) customer support operation. Analyze the support conversation and return ONLY a valid JSON object — no preamble, no explanation, no markdown.

SEVERITY (dissatisfaction_severity):
- "Low"      — Minor frustration, issue fully resolved, player tone normalized
- "Medium"   — Clear dissatisfaction, partially resolved or player still uneasy
- "High"     — Strong dissatisfaction, issue unresolved, churn risk
- "Critical" — Legal/regulatory threat, VIP complaint, fraud indicators, inappropriate agent conduct

ISSUE CATEGORY (issue_category — pick exactly one):
"Payment/Withdrawal" | "Game Bug" | "Login/Account" | "Bonus/Promotion" | "Technical Error" | "Slow Response" | "Inappropriate Communication" | "Other"

RESOLUTION STATUS (resolution_status — based on player sentiment at END of conversation, NOT Intercom status):
"Resolved" | "Partially Resolved" | "Unresolved"

AGENT PERFORMANCE SCORE (agent_performance_score):
- If Is Bot Handled is true: set agent_performance_score to null and agent_performance_notes to "N/A — conversation handled by bot"
- 5=Exceptional, 4=Good, 3=Adequate, 2=Below Standard, 1=Poor

ALERT (is_alert_worthy = true) when ANY of:
- Player mentions legal action, regulator, lawyer
- VIP or high-value player dissatisfied
- Agent used inappropriate or discriminatory language
- Fraud indicators present

Return ONLY this JSON — all fields required:
{
  "summary": "1-3 sentence factual summary",
  "dissatisfaction_severity": "Low|Medium|High|Critical",
  "issue_category": "one of the 8 categories",
  "resolution_status": "Resolved|Partially Resolved|Unresolved",
  "key_quotes": "1-2 direct player quotes, comma-separated, or empty string",
  "agent_performance_score": null,
  "agent_performance_notes": "specific observation about agent performance, or N/A — conversation handled by bot",
  "recommended_action": "specific QA action or No action required",
  "is_alert_worthy": false,
  "alert_reason": null
}`;

const userMessage = `Conversation ID: ${conversationId}\nPlayer ID: ${playerId}\nAgent: ${agentName}\nIs Bot Handled: ${isBotHandled}\n\nTranscript:\n${truncated}`;

return [{
  json: {
    conversation_id: conversationId,
    player_id:       playerId,
    agent_name:      agentName,
    intercom_link:   intercomLink,
    is_bot_handled:  isBotHandled,
    model:           'claude-sonnet-4-6',
    max_tokens:      4096,
    system:          systemPrompt,
    messages: [
      { role: 'user', content: userMessage }
    ]
  }
}];
