/**
 * WF3 — Build Slack Summary
 *
 * Formats the daily metrics into a Slack Block Kit message
 * for posting to #chat-qa-reports.
 *
 * Input:  $input.first().json — compiled metrics from wf3-compile-metrics.js
 * Output: single item with Slack blocks array
 */

const metrics = $input.first().json;
const {
  date, total_analyzed, critical_count, high_count,
  medium_count, low_count, satisfaction_rate, top_issues,
  critical_high_items, agent_flags
} = metrics;

// Emoji indicators
const satEmoji = satisfaction_rate >= 80 ? ':white_check_mark:' :
                 satisfaction_rate >= 60 ? ':warning:' : ':red_circle:';

const critEmoji = critical_count > 0 ? ':rotating_light:' : ':white_check_mark:';

// Build top issues text
const topIssuesText = top_issues.slice(0, 5)
  .map((i, idx) => `${idx + 1}. ${i.category}: *${i.count}*`)
  .join('\n');

// Build agent flags text
const agentFlagsText = agent_flags.length > 0
  ? agent_flags.map(a => `• ${a.agent_name}: avg score *${a.avg_score}* (${a.conversation_count} convos)`).join('\n')
  : '_No agent flags today_';

// Build critical/high summary
const critHighText = critical_high_items.length > 0
  ? critical_high_items.slice(0, 5).map(i =>
      `• [${i.severity}] ${i.issue_category} — ${i.agent_name} | <${i.intercom_link}|View>`
    ).join('\n') + (critical_high_items.length > 5 ? `\n_...and ${critical_high_items.length - 5} more_` : '')
  : '_None today_';

const blocks = [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: `:bar_chart: Daily Chat QA Report — ${date}`,
      emoji: true
    }
  },
  {
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Total Analyzed*\n${total_analyzed}` },
      { type: 'mrkdwn', text: `${satEmoji} *Satisfaction Rate*\n${satisfaction_rate}%` },
      { type: 'mrkdwn', text: `${critEmoji} *Critical*\n${critical_count}` },
      { type: 'mrkdwn', text: `*High / Medium / Low*\n${high_count} / ${medium_count} / ${low_count}` },
    ]
  },
  { type: 'divider' },
  {
    type: 'section',
    text: { type: 'mrkdwn', text: `*:fire: Critical & High Priority (${critical_high_items.length})*\n${critHighText}` }
  },
  { type: 'divider' },
  {
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*:mag: Top Issues*\n${topIssuesText}` },
      { type: 'mrkdwn', text: `*:bust_in_silhouette: Agent Flags*\n${agentFlagsText}` },
    ]
  },
  {
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `Generated at ${metrics.generated_at} | Full report sent via email` }
    ]
  }
];

return [{ json: { blocks, text: `Daily QA Report — ${date}: ${total_analyzed} conversations, ${satisfaction_rate}% satisfaction, ${critical_count} critical` } }];
