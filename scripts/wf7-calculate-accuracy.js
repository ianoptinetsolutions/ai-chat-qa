/**
 * WF7 — Calculate Feedback Accuracy
 *
 * Processes a batch of reviewed tickets (Agree/Disagree feedback from team leaders)
 * and computes accuracy metrics per category and overall.
 *
 * Input:  $input.all() — Tickets rows where feedback is filled and feedback_processed = false
 * Output: multiple items — first is global Accuracy_Log row (language='all') with _ticket_ids list,
 *          followed by one row per language detected in the batch (language=ISO code, _ticket_ids=[]).
 */

const reviewedTickets = $input.all().map(item => item.json);

if (reviewedTickets.length === 0) {
  return [{ json: { _skip: true, message: 'No unprocessed feedback found' } }];
}

const now = new Date();
const dateStr = now.toISOString().split('T')[0];

let agreed = 0;
let disagreed = 0;
const categoryAccuracy = {};
const severityAccuracy = {};
const languageAccuracy = {};
const ticketIdsProcessed = [];

for (const ticket of reviewedTickets) {
  // Handle both object-key and array-index formats from Google Sheets
  const feedback      = ticket.feedback       || '';
  const category      = ticket.issue_category || 'Other';
  const severity      = ticket.severity       || 'Medium';
  const language      = ticket.language       || 'en';
  const ticketId      = ticket.ticket_id      || '';

  const isAgree = feedback.toLowerCase().trim() === 'agree';
  const isDisagree = feedback.toLowerCase().trim() === 'disagree';

  if (!isAgree && !isDisagree) continue; // Skip blank or invalid feedback

  ticketIdsProcessed.push(ticketId);

  if (isAgree) agreed++;
  else disagreed++;

  // Track by category
  if (!categoryAccuracy[category]) categoryAccuracy[category] = { agreed: 0, disagreed: 0 };
  if (isAgree) categoryAccuracy[category].agreed++;
  else categoryAccuracy[category].disagreed++;

  // Track by severity
  if (!severityAccuracy[severity]) severityAccuracy[severity] = { agreed: 0, disagreed: 0 };
  if (isAgree) severityAccuracy[severity].agreed++;
  else severityAccuracy[severity].disagreed++;

  // Track by language
  if (!languageAccuracy[language]) languageAccuracy[language] = { agreed: 0, disagreed: 0 };
  if (isAgree) languageAccuracy[language].agreed++;
  else languageAccuracy[language].disagreed++;
}

const totalReviewed = agreed + disagreed;
const accuracyRate = totalReviewed > 0 ? Math.round((agreed / totalReviewed) * 1000) / 1000 : 0;

// Find category with highest disagreement rate
let worstCategory = 'N/A';
let worstDisagreementRate = 0;
for (const [cat, data] of Object.entries(categoryAccuracy)) {
  const catTotal = data.agreed + data.disagreed;
  const disagreementRate = catTotal > 0 ? data.disagreed / catTotal : 0;
  if (disagreementRate > worstDisagreementRate) {
    worstDisagreementRate = disagreementRate;
    worstCategory = cat;
  }
}

const notes = `Batch processed ${totalReviewed} tickets. `
  + `Accuracy: ${Math.round(accuracyRate * 100)}%. `
  + `Worst category: ${worstCategory} (${Math.round(worstDisagreementRate * 100)}% disagreement).`;

// Build per-language accuracy rows
const languageRows = Object.entries(languageAccuracy).map(([lang, data]) => {
  const langTotal = data.agreed + data.disagreed;
  const langRate = langTotal > 0 ? Math.round((data.agreed / langTotal) * 1000) / 1000 : 0;
  return {
    json: {
      date:            dateStr,
      total_reviewed:  langTotal,
      agreed:          data.agreed,
      disagreed:       data.disagreed,
      accuracy_rate:   langRate,
      worst_category:  worstCategory,
      notes:           `Language: ${lang}. ${langTotal} tickets reviewed. Accuracy: ${Math.round(langRate * 100)}%.`,
      language:        lang,
      _ticket_ids_processed: [],
      _skip: false,
      _is_language_row: true,
    }
  };
});

return [
  {
    json: {
      // Global Accuracy_Log row
      date:            dateStr,
      total_reviewed:  totalReviewed,
      agreed:          agreed,
      disagreed:       disagreed,
      accuracy_rate:   accuracyRate,
      worst_category:  worstCategory,
      notes:           notes,
      language:        'all',

      // Internal: list of ticket IDs to mark feedback_processed = true
      _ticket_ids: ticketIdsProcessed,
      _skip: false,
      _is_language_row: false,
    }
  },
  ...languageRows
];
