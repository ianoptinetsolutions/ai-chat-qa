/**
 * WF1 — Deduplication Check (REFERENCE ONLY — not used as-is in production)
 *
 * NOTE: This file was written for the original Google Sheets version of WF1.
 * The production Supabase workflow handles deduplication via Supabase's
 * UNIQUE constraint on qa_conversations.conversation_id — any insert of
 * a duplicate conversation_id is rejected at the DB level (upsert/ON CONFLICT).
 *
 * This file is kept as documentation of the dedup logic intent.
 * The actual WF1 workflow uses an HTTP Request upsert to qa_conversations,
 * not this Code node.
 *
 * Input (legacy):
 *   - $('Format Transcript').first().json — the formatted conversation
 *   - $('Read Raw Conversations').all()   — existing rows (was Google Sheets)
 *
 * Output: single item with action = 'append' | 'update' | 'skip' and all conversation fields
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
