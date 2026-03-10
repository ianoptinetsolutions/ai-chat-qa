/**
 * WF1 — Filter Conversations
 *
 * Receives a list of Intercom conversations from the HTTP Request node.
 * All conversations are passed through (including bot-only ones).
 * Bot-only conversations are flagged with _is_bot_handled = true so
 * downstream nodes can handle them appropriately (skip agent scoring, etc.).
 *
 * Input:  $input.all() — array of Intercom conversation objects
 * Output: all conversations, each with _is_bot_handled flag added
 */

const conversations = $input.all();
const filtered = [];

for (const item of conversations) {
  try {
    const convo = item.json;

    // conversation_parts contains all messages after the first
    const parts = convo.conversation_parts?.conversation_parts || [];

    // Check if any part was authored by a human agent (not bot, not user)
    const hasHumanReply = parts.some(part => {
      const authorType = part.author?.type;
      // Intercom agent types: 'admin', 'team' — bots are 'bot' or 'operator'
      return authorType === 'admin' || authorType === 'team';
    });

    // Include all conversations; flag bot-only ones for downstream handling
    filtered.push({ json: { ...convo, _is_bot_handled: !hasHumanReply } });
  } catch (err) {
    // Skip malformed items silently — don't fail the whole batch
    console.error('Filter error on item:', err.message);
  }
}

return filtered;
