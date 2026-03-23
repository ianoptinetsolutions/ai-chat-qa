/**
 * WF8 — Compile Monthly Metrics
 *
 * Aggregates data from multiple Supabase tables for the previous month
 * into a single metrics object for the Claude monthly report generator.
 *
 * Input:
 *   - $('Read Analysis Results').all()   — Analysis_Results rows for prev month
 *   - $('Read Report Log').all()         — Report_Log rows for prev month
 *   - $('Read Accuracy Log').all()       — Accuracy_Log rows for prev month
 *   - $('Read Alert Log').all()          — Alert_Log rows for prev month
 *   - $('Read Weekly Trends').all()      — Weekly_Trends rows for prev month
 *
 * Output: single item with { month, metrics_json } for Claude prompt
 */

// Get previous month boundaries
const now = new Date();
const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const month = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = prevMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// Read all input data
const analysisRows  = $('Read Analysis Results').all().map(i => i.json);
const reportRows    = $('Read Report Log').all().map(i => i.json);
const accuracyRows  = $('Read Accuracy Log').all().map(i => i.json);
const alertRows     = $('Read Alert Log').all().map(i => i.json);
const trendRows     = $('Read Weekly Trends').all().map(i => i.json);

// --- Analysis Results Metrics ---
const totalConversations = analysisRows.length;
const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
const categoryCounts = {};
const agentScores = {};
const resolutionCounts = { Resolved: 0, Unresolved: 0, 'Partially Resolved': 0 };

for (const row of analysisRows) {
  const severity      = row.severity       || row[4]  || 'Low';
  const category      = row.issue_category || row[5]  || 'Other';
  const resolution    = row.resolution_status || row[6] || 'Unresolved';
  const agentName     = row.agent_name     || row[2]  || 'Unknown';
  const agentScore    = parseInt(row.agent_score || row[8] || 3, 10);

  if (severityCounts.hasOwnProperty(severity)) severityCounts[severity]++;
  categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  if (resolutionCounts.hasOwnProperty(resolution)) resolutionCounts[resolution]++;

  if (!agentScores[agentName]) agentScores[agentName] = { total: 0, count: 0 };
  agentScores[agentName].total += agentScore;
  agentScores[agentName].count++;
}

const satisfactionRate = totalConversations > 0
  ? Math.round((severityCounts.Low / totalConversations) * 1000) / 10
  : 0;

const resolutionRate = totalConversations > 0
  ? Math.round((resolutionCounts.Resolved / totalConversations) * 1000) / 10
  : 0;

// Top 10 issue categories
const topIssues = Object.entries(categoryCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([category, count]) => ({
    category,
    count,
    pct_of_total: totalConversations > 0 ? Math.round((count / totalConversations) * 1000) / 10 : 0
  }));

// Agent rankings
const agentRankings = Object.entries(agentScores)
  .map(([name, data]) => ({
    agent_name: name,
    avg_score: Math.round((data.total / data.count) * 10) / 10,
    conversation_count: data.count,
  }))
  .sort((a, b) => b.avg_score - a.avg_score);

// --- Daily Report Log Metrics ---
const avgDailySatisfaction = reportRows.length > 0
  ? Math.round(reportRows.reduce((sum, r) => sum + parseFloat(r.satisfaction_rate || r[6] || 0), 0) / reportRows.length * 10) / 10
  : satisfactionRate;

// --- Accuracy Metrics ---
const totalAccuracyRows = accuracyRows.length;
const avgAccuracy = totalAccuracyRows > 0
  ? Math.round(accuracyRows.reduce((sum, r) => sum + parseFloat(r.accuracy_rate || r[4] || 0), 0) / totalAccuracyRows * 1000) / 1000
  : null;

// Worst performing category across all accuracy logs
const catDisagreements = {};
for (const row of accuracyRows) {
  const cat = row.worst_category || row[5] || '';
  if (cat && cat !== 'N/A') {
    catDisagreements[cat] = (catDisagreements[cat] || 0) + 1;
  }
}
const worstAccuracyCategory = Object.entries(catDisagreements).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

// --- Alert Metrics ---
const totalAlerts = alertRows.length;
const criticalAlerts = alertRows.filter(r => (r.severity || r[5]) === 'Critical').length;

// Build final metrics object
const metrics = {
  month: monthLabel,
  month_id: month,
  total_conversations: totalConversations,
  severity_breakdown: severityCounts,
  satisfaction_rate: satisfactionRate,
  resolution_rate: resolutionRate,
  top_issues: topIssues,
  agent_rankings: agentRankings,
  ai_accuracy_rate: avgAccuracy,
  worst_accuracy_category: worstAccuracyCategory,
  total_alerts: totalAlerts,
  critical_alerts: criticalAlerts,
  total_report_days: reportRows.length,
  avg_daily_satisfaction: avgDailySatisfaction,
};

return [{
  json: {
    month,
    month_label: monthLabel,
    total_conversations: totalConversations,
    satisfaction_rate: satisfactionRate,
    top_issues: JSON.stringify(topIssues),
    accuracy_rate: avgAccuracy || 0,
    metrics_json: JSON.stringify(metrics, null, 2),
  }
}];
