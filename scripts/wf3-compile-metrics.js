/**
 * WF3 — Compile Daily Metrics
 *
 * Reads all Analysis_Results rows for today and computes the metrics
 * needed for the daily summary report.
 *
 * Input:  $input.all() — all Analysis_Results rows for today
 * Output: single item with compiled metrics object
 */

const rows = $input.all().map(item => item.json);
const today = new Date().toISOString().split('T')[0];

// Count by severity
const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
const categoryMap = {};
const criticalHighItems = [];
const agentScores = {};

for (const row of rows) {
  const severity = row.severity || row[4] || 'Low';
  const category = row.issue_category || row[5] || 'Other';
  const agentName = row.agent_name || row[2] || 'Unknown';
  const agentScore = parseInt(row.agent_score || row[8] || 3, 10);
  const convId = row.conversation_id || row[0];
  const summary = row.summary || row[3] || '';
  const recommendedAction = row.recommended_action || row[10] || '';
  const intercomLink = row.intercom_link || row[14] || '';

  // Severity counts
  if (counts.hasOwnProperty(severity)) {
    counts[severity]++;
  }

  // Category frequency
  categoryMap[category] = (categoryMap[category] || 0) + 1;

  // Collect Critical and High items for table
  if (severity === 'Critical' || severity === 'High') {
    criticalHighItems.push({
      conversation_id: convId,
      agent_name: agentName,
      issue_category: category,
      severity,
      summary,
      recommended_action: recommendedAction,
      intercom_link: intercomLink,
    });
  }

  // Agent score tracking
  if (!agentScores[agentName]) {
    agentScores[agentName] = { total: 0, count: 0 };
  }
  agentScores[agentName].total += agentScore;
  agentScores[agentName].count++;
}

const total = rows.length;

// Satisfaction rate = percentage of Low (fully satisfied) conversations
const satisfactionRate = total > 0
  ? Math.round((counts.Low / total) * 1000) / 10  // 1 decimal place
  : 0;

// Top 5 issue categories by frequency
const topIssues = Object.entries(categoryMap)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([category, count]) => ({ category, count }));

// Flag agents with average score <= 2
const agentFlags = Object.entries(agentScores)
  .map(([name, data]) => ({
    agent_name: name,
    avg_score: Math.round((data.total / data.count) * 10) / 10,
    conversation_count: data.count,
  }))
  .filter(a => a.avg_score <= 2)
  .sort((a, b) => a.avg_score - b.avg_score);

return [{
  json: {
    date: today,
    total_analyzed: total,
    critical_count: counts.Critical,
    high_count: counts.High,
    medium_count: counts.Medium,
    low_count: counts.Low,
    satisfaction_rate: satisfactionRate,
    top_issues: topIssues,
    critical_high_items: criticalHighItems,
    agent_flags: agentFlags,
    generated_at: new Date().toISOString(),
  }
}];
