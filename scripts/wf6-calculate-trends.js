/**
 * WF6 — Calculate 7-Day Rolling Trends
 *
 * Analyzes 7 days of Analysis_Results to:
 * 1. Compute issue category frequencies per day
 * 2. Flag categories spiking >150% above their 7-day average
 * 3. Identify repeat complainers (players with 3+ complaints)
 * 4. Calculate per-agent flag rates (% of conversations scoring <= 2)
 *
 * Input:  $input.all() — all Analysis_Results rows from the last 7 days
 * Output: single item with trend data ready for Claude prompt + Weekly_Trends sheet
 */

const rows = $input.all().map(item => item.json);
const today = new Date();
const todayStr = today.toISOString().split('T')[0];
const weekStartDate = new Date(today);
weekStartDate.setDate(today.getDate() - 6);
const weekStartStr = weekStartDate.toISOString().split('T')[0];

// Group by date and category
const byDateCategory = {};
const playerComplaints = {};
const agentScores = {};

for (const row of rows) {
  const analyzedAt = row.analyzed_at || row[13] || '';
  const date = analyzedAt.split('T')[0];
  const category = row.issue_category || row[5] || 'Other';
  const severity = row.severity || row[4] || 'Low';
  const playerId = row.player_id || row[1] || '';
  const agentName = row.agent_name || row[2] || '';
  const agentScore = parseInt(row.agent_score || row[8] || 3, 10);

  // Date-category matrix
  if (!byDateCategory[date]) byDateCategory[date] = {};
  byDateCategory[date][category] = (byDateCategory[date][category] || 0) + 1;

  // Repeat complainers
  if (playerId) {
    playerComplaints[playerId] = (playerComplaints[playerId] || 0) + 1;
  }

  // Agent performance
  if (agentName) {
    if (!agentScores[agentName]) agentScores[agentName] = { total: 0, count: 0, flagged: 0 };
    agentScores[agentName].total += agentScore;
    agentScores[agentName].count++;
    if (agentScore <= 2) agentScores[agentName].flagged++;
  }
}

// Collect all categories seen
const allCategories = new Set();
Object.values(byDateCategory).forEach(dayCats => {
  Object.keys(dayCats).forEach(cat => allCategories.add(cat));
});

// Build per-category stats
const topIssues = [];
const anomalies = [];

for (const category of allCategories) {
  // Count for each of the 7 days
  const dailyCounts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    dailyCounts.push(byDateCategory[dStr]?.[category] || 0);
  }

  const total7d = dailyCounts.reduce((sum, c) => sum + c, 0);
  const avg7d = total7d / 7;
  const todayCount = dailyCounts[6]; // last element = today

  const pctChange = avg7d > 0 ? Math.round(((todayCount - avg7d) / avg7d) * 100) : 0;

  topIssues.push({
    category,
    count: total7d,
    today_count: todayCount,
    daily_avg: Math.round(avg7d * 10) / 10,
    pct_change: pctChange,
  });

  // Flag if today's count is >150% of the 7-day average (and avg > 0)
  if (avg7d > 0 && todayCount > avg7d * 1.5) {
    anomalies.push({
      category,
      today_count: todayCount,
      daily_avg: Math.round(avg7d * 10) / 10,
      spike_pct: pctChange,
    });
  }
}

// Sort by 7-day total descending
topIssues.sort((a, b) => b.count - a.count);

// Repeat complainers: players with 3+ complaints in window
const repeatComplainers = Object.entries(playerComplaints)
  .filter(([, count]) => count >= 3)
  .map(([playerId, count]) => ({ player_id: playerId, complaint_count: count }))
  .sort((a, b) => b.complaint_count - a.complaint_count);

// Agent flag rates
const agentFlags = Object.entries(agentScores)
  .map(([name, data]) => ({
    agent_name: name,
    avg_score: Math.round((data.total / data.count) * 10) / 10,
    conversation_count: data.count,
    flag_rate: Math.round((data.flagged / data.count) * 100),
  }))
  .filter(a => a.flag_rate > 20 || a.avg_score < 3)
  .sort((a, b) => a.avg_score - b.avg_score);

return [{
  json: {
    week_start:           weekStartStr,
    week_end:             todayStr,
    top_issues_json:      JSON.stringify(topIssues),
    anomalies_json:       JSON.stringify(anomalies),
    repeat_complainers:   repeatComplainers.length,
    repeat_complainers_detail: repeatComplainers,
    agent_flags_json:     JSON.stringify(agentFlags),
    has_anomalies:        anomalies.length > 0,
    total_rows_analyzed:  rows.length,
  }
}];
