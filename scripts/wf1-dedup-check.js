/**
 * WF1 — Deduplication Check
 *
 * Compares the current conversation_id against rows already in Google Sheets.
 * Returns a flag indicating whether to append (new) or update (existing/reopened).
 *
 * Input:
 *   - $('Format Transcript').first().json — the formatted conversation
 *   - $('Read Raw Conversations').all()   — existing rows from Google Sheets
 *
 * Output: single item with action = 'append' | 'update' and all conversation fields
 */

const formatted = $('Format Transcript').first().json;
const existingRows = $('Read Raw Conversations').all();

const conversationId = formatted.conversation_id;

// Find existing row matching this conversation_id
const existing = existingRows.find(row => row.json.conversation_id === conversationId);

let action = 'append';

if (existing) {
  // Only re-process if the conversation was re-opened
  const currentStatus = formatted.status;
  if (currentStatus === 're-opened' || currentStatus === 'open') {
    action = 'update';
  } else {
    // Already processed, skip
    action = 'skip';
  }
}

return [{
  json: {
    ...formatted,
    _action: action,
    _existing_row: existing ? existing.json : null,
  }
}];
