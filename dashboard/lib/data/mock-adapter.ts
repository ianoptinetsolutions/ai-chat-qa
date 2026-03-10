import type {
  DataAdapter, AnalysisResult, Ticket, AlertLog, AccuracyLog,
  MonthlyReport, OverviewMetrics, TrendData, ConversationFilters,
  TicketFilters, FeedbackValue
} from './types'

const AGENTS = ['Sofia Reyes', 'Marcus Webb', 'Priya Nair', 'James Okonkwo', 'Elena Vasquez', 'Tom Brandt']
const LEADERS: Record<string, string> = {
  'Sofia Reyes': 'Hannah Cross', 'Marcus Webb': 'Hannah Cross',
  'Priya Nair': 'David Park', 'James Okonkwo': 'David Park',
  'Elena Vasquez': 'Hannah Cross', 'Tom Brandt': 'David Park'
}
const CATEGORIES = [
  'Payment/Withdrawal', 'Game Bug', 'Login/Account', 'Bonus/Promotion',
  'Technical Error', 'Slow Response', 'Inappropriate Communication', 'Other'
] as const
const SEVERITIES = ['Low', 'Low', 'Low', 'Medium', 'Medium', 'High', 'Critical'] as const
const RESOLUTIONS = ['Resolved', 'Resolved', 'Partially Resolved', 'Unresolved'] as const

function randFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function dateStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}
function dtStr(daysAgo: number, hourOffset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(6 + hourOffset, Math.floor(Math.random() * 59), 0)
  return d.toISOString()
}

const SUMMARIES: Record<string, string[]> = {
  'Payment/Withdrawal': [
    'Player requested withdrawal of €1,200 but funds have not arrived after 5 business days. Agent confirmed processing but could not provide a clear timeline.',
    'Customer reported missing deposit despite payment showing as complete on their banking app. Agent initiated investigation but left player without resolution.',
    'VIP player escalated delayed withdrawal over €3,500. Agent acknowledged delay but failed to expedite with payments team.'
  ],
  'Game Bug': [
    'Player lost connection mid-spin on Starburst and bet of €50 was deducted with no payout recorded. Agent issued courtesy bonus instead of investigating.',
    'Jackpot game froze during a winning combination. Player claims €200 win was not credited. Agent escalated to technical team.',
    'Live roulette table disconnected during high-stakes bet. Agent processed refund but took 40 minutes to respond.'
  ],
  'Login/Account': [
    'Player locked out of account after 3 failed login attempts. Reset email not received. Agent reset manually after 25-minute wait.',
    'Customer reports unauthorized account access and suspicious transactions. Agent escalated to security team and applied temporary freeze.',
    'Two-factor authentication not working on mobile app. Player unable to access account for 2 days. Agent provided workaround.'
  ],
  'Bonus/Promotion': [
    'Welcome bonus wagering requirements not clearly explained. Player feels misled about 40x rollover on €100 bonus.',
    'Free spins from promotional email not credited to account. Agent confirmed eligibility but could not apply them immediately.',
    'Player disputed cashback calculation, claiming €45 shortfall. Agent unable to verify calculation during session.'
  ],
  'Technical Error': [
    'Mobile app crashing consistently on iOS 17 when loading live casino section. Multiple players affected per agent.',
    'Player unable to complete payment as card verification screen loops indefinitely. Agent provided alternative payment method.',
    'Sports betting slip not processing — error code 503 displayed. Agent confirmed backend outage affecting multiple users.'
  ],
  'Slow Response': [
    'Player waited 47 minutes before agent connected. Initial response was generic and did not address the specific complaint.',
    'Chat escalated twice without resolution. Total contact time 1 hour 15 minutes for a simple bonus inquiry.',
    'Player contacted support three times in one week about same issue with no follow-through between sessions.'
  ],
  'Inappropriate Communication': [
    'Agent used dismissive language when player raised a legitimate complaint about delayed withdrawals. Player felt patronized.',
    'Support agent provided conflicting information about terms and conditions, creating confusion and mistrust.',
    'Agent ended chat prematurely without confirming resolution, leaving player\'s issue unaddressed.'
  ],
  'Other': [
    'Player requesting self-exclusion. Agent processed correctly and provided problem gambling resources.',
    'Customer asking about responsible gambling tools. Agent correctly directed to self-exclusion and deposit limit features.',
    'Player requesting account upgrade to VIP status. Agent correctly escalated to VIP management team.'
  ]
}

const KEY_QUOTES: Record<string, string[][]> = {
  'Payment/Withdrawal': [
    ['"I\'ve been waiting 5 days and nobody can tell me where my money is."', '"This is completely unacceptable."'],
    ['"The money left my account but never arrived."', '"I need this resolved today."'],
    ['"Is this how you treat VIP players?"', '"I want to speak to a manager."']
  ],
  'Game Bug': [
    ['"The game crashed and took my €50 bet."', '"I want my money back, not a bonus."'],
    ['"I clearly won that spin and it wasn\'t credited."'],
    ['"This keeps happening. I\'ve reported it before."']
  ],
  'Login/Account': [
    ['"I can\'t get into my account and my balance is there."', '"Why is the reset email not working?"'],
    ['"Someone accessed my account without my permission."', '"I need you to freeze it now."'],
    ['"I\'ve been locked out for 2 days now."']
  ],
  'Bonus/Promotion': [
    ['"You never told me about a 40x rollover requirement."', '"I feel completely misled."'],
    ['"The email said free spins. Where are they?"'],
    ['"The cashback I received is €45 less than it should be."']
  ],
  'Technical Error': [
    ['"The app crashes every time I try to load live casino."', '"This has been going on for 3 days."'],
    ['"Your payment page is broken."', '"I can\'t deposit."'],
    ['"Error 503 again. Is your site down?"']
  ],
  'Slow Response': [
    ['"I waited 47 minutes for someone to reply."', '"This is terrible service."'],
    ['"I\'ve contacted you three times and nobody follows up."'],
    ['"Your live chat said 2 minutes. It was 45."']
  ],
  'Inappropriate Communication': [
    ['"Your agent was incredibly rude to me."', '"I\'m seriously considering leaving."'],
    ['"The agent told me two completely different things."'],
    ['"They just ended the chat while I was still typing."']
  ],
  'Other': [
    ['"I want to take a break from gambling."'],
    ['"How do I set a deposit limit?"'],
    ['"When will I be considered for VIP status?"']
  ]
}

const RECOMMENDED_ACTIONS: Record<string, string> = {
  'Payment/Withdrawal': 'Escalate to payments team lead. Follow up with player within 24h. Coach agent on withdrawal timeline communication.',
  'Game Bug': 'Log ticket with technical team. Credit player account if confirmed bug. Review game crash logs.',
  'Login/Account': 'Verify account security protocols followed. Ensure 2FA alternatives provided. Flag for security review if unauthorized access suspected.',
  'Bonus/Promotion': 'Review bonus terms communication. Coach agent on T&C explanation. Consider revising promotional copy for clarity.',
  'Technical Error': 'Escalate to tech team with error code. Notify affected players proactively. Monitor for pattern across sessions.',
  'Slow Response': 'Review agent scheduling and queue management. Set response time KPI targets. Coach team lead on queue monitoring.',
  'Inappropriate Communication': 'Urgent coaching session required. Review full transcript with team leader. Consider formal warning if breach of conduct policy.',
  'Other': 'Confirm correct procedure was followed. No escalation required unless player follow-up needed.'
}

const ALERT_REASONS = [
  'Player mentioned consulting a lawyer regarding delayed withdrawal',
  'VIP player (lifetime value >€50k) reported strong dissatisfaction',
  'Suspected fraud indicators: multiple accounts query from same IP',
  'Agent used inappropriate and dismissive language with player',
  'Player threatened to report to Malta Gaming Authority',
  'High-value player (€3,500 withdrawal) threatening churn',
  'Repeat complainer: 4th contact in 7 days, unresolved payment issue'
]

// --- Generate conversations ---
const conversations: AnalysisResult[] = Array.from({ length: 60 }, (_, i) => {
  const cat = randFrom(CATEGORIES)
  const sev = randFrom(SEVERITIES)
  const agent = randFrom(AGENTS)
  const res = randFrom(RESOLUTIONS)
  const isAlert = sev === 'Critical' || (sev === 'High' && Math.random() < 0.3)
  const daysAgo = Math.floor(i / 8)
  const summaries = SUMMARIES[cat]
  const quotes = KEY_QUOTES[cat]

  return {
    conversation_id: `IC-${100200 + i}`,
    player_id: `PLR-${4000 + Math.floor(Math.random() * 3000)}`,
    agent_name: agent,
    summary: summaries[Math.floor(Math.random() * summaries.length)],
    severity: sev,
    issue_category: cat,
    resolution_status: res,
    key_quotes: quotes[Math.floor(Math.random() * quotes.length)],
    agent_score: sev === 'Critical' ? Math.floor(Math.random() * 2) + 1 :
                 sev === 'High' ? Math.floor(Math.random() * 2) + 2 :
                 Math.floor(Math.random() * 3) + 3,
    agent_notes: sev === 'Critical' || sev === 'High'
      ? 'Agent failed to follow escalation protocol. Response time exceeded SLA by 18 minutes. Tone was defensive.'
      : sev === 'Medium'
      ? 'Agent resolved core issue but missed opportunity to offer proactive follow-up.'
      : 'Agent handled interaction professionally and efficiently. Player expressed satisfaction.',
    recommended_action: RECOMMENDED_ACTIONS[cat],
    is_alert: isAlert,
    alert_reason: isAlert ? ALERT_REASONS[Math.floor(Math.random() * ALERT_REASONS.length)] : null,
    analyzed_at: dtStr(daysAgo, i % 3),
    intercom_link: `https://app.intercom.com/conversations/IC-${100200 + i}`
  }
})

// --- Generate tickets (Medium/High/Critical only) ---
const ticketableConvos = conversations.filter(c => c.severity !== 'Low')
const tickets: Ticket[] = ticketableConvos.slice(0, 28).map((c, i) => {
  const feedbackOptions: FeedbackValue[] = ['Agree', 'Agree', 'Agree', 'Disagree', '']
  const feedback = feedbackOptions[i % feedbackOptions.length]
  const statusOptions: Array<Ticket['status']> = ['Open', 'Open', 'In Review', 'Closed', 'Closed']

  return {
    ticket_id: `TKT-${2000 + i}`,
    date: dateStr(Math.floor(i / 4)),
    conversation_id: c.conversation_id,
    player_id: c.player_id,
    agent_name: c.agent_name,
    severity: c.severity,
    issue_category: c.issue_category,
    summary: c.summary,
    key_quotes: c.key_quotes,
    recommended_action: c.recommended_action,
    assigned_to: LEADERS[c.agent_name] || 'QA-Inbox',
    status: statusOptions[i % statusOptions.length],
    feedback,
    feedback_processed: feedback !== '' && i < 15,
    intercom_link: c.intercom_link,
    created_at: c.analyzed_at
  }
})

// --- Generate alert log ---
const alertConvos = conversations.filter(c => c.is_alert)
const alerts: AlertLog[] = alertConvos.slice(0, 12).map((c, i) => ({
  alert_id: `ALT-${3000 + i}`,
  date: dateStr(Math.floor(i / 2)),
  conversation_id: c.conversation_id,
  player_id: c.player_id,
  alert_reason: c.alert_reason!,
  severity: c.severity,
  notified_to: '#critical-alerts, QA Manager, Hannah Cross',
  responded: i < 8,
  response_time: i < 8 ? `${Math.floor(Math.random() * 25) + 3} minutes` : ''
}))

// --- Generate accuracy log ---
const accuracyLogs: AccuracyLog[] = Array.from({ length: 14 }, (_, i) => {
  const total = Math.floor(Math.random() * 8) + 4
  const disagreed = i < 3 ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 2)
  const agreed = total - disagreed
  return {
    date: dateStr(i),
    total_reviewed: total,
    agreed,
    disagreed,
    accuracy_rate: agreed / total,
    worst_category: i % 3 === 0 ? 'Payment/Withdrawal' : i % 3 === 1 ? 'Game Bug' : 'Bonus/Promotion',
    notes: `Batch of ${total} tickets processed. ${disagreed} disagreement(s) flagged for review.`
  }
})

// --- Generate monthly reports ---
const REPORT_HTML = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', sans-serif; background:#f8fafc; color:#1e293b; padding:40px; }
  .header { background:linear-gradient(135deg,#1e293b,#334155); color:#fff; padding:32px 40px; border-radius:12px; margin-bottom:32px; }
  h1 { font-size:28px; margin-bottom:8px; }
  .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:32px; }
  .metric { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:20px; text-align:center; }
  .metric-value { font-size:36px; font-weight:700; color:#1e293b; }
  .metric-label { font-size:12px; color:#64748b; margin-top:4px; text-transform:uppercase; letter-spacing:.05em; }
  .section { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:24px; margin-bottom:20px; }
  h2 { font-size:18px; margin-bottom:16px; color:#0f172a; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; padding:8px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; border-bottom:1px solid #e2e8f0; }
  td { padding:10px 12px; border-bottom:1px solid #f1f5f9; font-size:14px; }
  .badge { padding:3px 10px; border-radius:4px; font-size:11px; font-weight:600; }
  .critical { background:#fee2e2; color:#dc2626; }
  .high { background:#fed7aa; color:#ea580c; }
  .medium { background:#fef9c3; color:#ca8a04; }
</style>
</head>
<body>
<div class="header">
  <h1>Monthly QA Report — February 2026</h1>
  <p>AI-assisted analysis of 847 support conversations · Generated by Chat QA System</p>
</div>
<div class="grid">
  <div class="metric"><div class="metric-value">847</div><div class="metric-label">Total Conversations</div></div>
  <div class="metric"><div class="metric-value">91.4%</div><div class="metric-label">Satisfaction Rate</div></div>
  <div class="metric"><div class="metric-value">88.7%</div><div class="metric-label">AI Accuracy</div></div>
  <div class="metric"><div class="metric-value">23</div><div class="metric-label">Critical Alerts</div></div>
</div>
<div class="section">
  <h2>Top Issues by Category</h2>
  <table>
    <tr><th>Category</th><th>Count</th><th>% Total</th><th>Trend</th></tr>
    <tr><td>Payment/Withdrawal</td><td>214</td><td>25.3%</td><td>↑ +12% vs Jan</td></tr>
    <tr><td>Game Bug</td><td>187</td><td>22.1%</td><td>↓ −5% vs Jan</td></tr>
    <tr><td>Technical Error</td><td>142</td><td>16.8%</td><td>→ Stable</td></tr>
    <tr><td>Bonus/Promotion</td><td>118</td><td>13.9%</td><td>↑ +8% vs Jan</td></tr>
    <tr><td>Login/Account</td><td>91</td><td>10.7%</td><td>↓ −3% vs Jan</td></tr>
    <tr><td>Slow Response</td><td>52</td><td>6.1%</td><td>↑ +21% vs Jan</td></tr>
    <tr><td>Inappropriate Communication</td><td>28</td><td>3.3%</td><td>↓ −15% vs Jan</td></tr>
    <tr><td>Other</td><td>15</td><td>1.8%</td><td>→ Stable</td></tr>
  </table>
</div>
<div class="section">
  <h2>Agent Performance Summary</h2>
  <table>
    <tr><th>Agent</th><th>Conversations</th><th>Avg Score</th><th>Critical Issues</th></tr>
    <tr><td>Sofia Reyes</td><td>142</td><td>4.3</td><td>3</td></tr>
    <tr><td>Marcus Webb</td><td>138</td><td>3.8</td><td>6</td></tr>
    <tr><td>Priya Nair</td><td>151</td><td>4.6</td><td>1</td></tr>
    <tr><td>James Okonkwo</td><td>129</td><td>2.9</td><td>9</td></tr>
    <tr><td>Elena Vasquez</td><td>144</td><td>4.1</td><td>2</td></tr>
    <tr><td>Tom Brandt</td><td>143</td><td>3.4</td><td>5</td></tr>
  </table>
</div>
<div class="section">
  <h2>AI Recommendations</h2>
  <p>Payment/Withdrawal complaints increased 12% — recommend audit of withdrawal processing SLAs and proactive player communication when delays exceed 48h.</p>
  <p style="margin-top:12px">Slow Response issues up 21% — immediate review of live chat staffing during peak hours (18:00–22:00 UTC) is recommended.</p>
  <p style="margin-top:12px">James Okonkwo flagged for 9 critical issues — urgent coaching session recommended with team leader David Park before end of month.</p>
</div>
</body>
</html>`

const monthlyReports: MonthlyReport[] = [
  {
    month: '2026-02',
    total_conversations: 847,
    satisfaction_rate: 91.4,
    top_issues: [
      { category: 'Payment/Withdrawal', count: 214 },
      { category: 'Game Bug', count: 187 },
      { category: 'Technical Error', count: 142 }
    ],
    accuracy_rate: 0.887,
    report_html: REPORT_HTML,
    status: 'approved',
    generated_at: '2026-03-01T08:00:00Z'
  },
  {
    month: '2026-01',
    total_conversations: 792,
    satisfaction_rate: 89.2,
    top_issues: [
      { category: 'Payment/Withdrawal', count: 191 },
      { category: 'Game Bug', count: 197 },
      { category: 'Technical Error', count: 138 }
    ],
    accuracy_rate: 0.871,
    report_html: REPORT_HTML.replace('February 2026', 'January 2026').replace('847', '792'),
    status: 'approved',
    generated_at: '2026-02-01T08:00:00Z'
  },
  {
    month: '2026-03',
    total_conversations: 214,
    satisfaction_rate: 88.6,
    top_issues: [
      { category: 'Payment/Withdrawal', count: 58 },
      { category: 'Slow Response', count: 41 },
      { category: 'Game Bug', count: 39 }
    ],
    accuracy_rate: 0.894,
    report_html: REPORT_HTML.replace('February 2026', 'March 2026 (Draft)').replace('847', '214'),
    status: 'draft',
    generated_at: '2026-03-10T08:00:00Z'
  }
]

// --- Compute overview metrics ---
const todayConvos = conversations.filter(c => c.analyzed_at.startsWith(dateStr(0)))
const todayCounts = {
  Critical: todayConvos.filter(c => c.severity === 'Critical').length,
  High: todayConvos.filter(c => c.severity === 'High').length,
  Medium: todayConvos.filter(c => c.severity === 'Medium').length,
  Low: todayConvos.filter(c => c.severity === 'Low').length,
}

const severityBreakdown = Array.from({ length: 7 }, (_, i) => {
  const dayConvos = conversations.filter(c => c.analyzed_at.startsWith(dateStr(6 - i)))
  return {
    date: dateStr(6 - i),
    Critical: dayConvos.filter(c => c.severity === 'Critical').length || Math.floor(Math.random() * 4),
    High: dayConvos.filter(c => c.severity === 'High').length || Math.floor(Math.random() * 6) + 2,
    Medium: dayConvos.filter(c => c.severity === 'Medium').length || Math.floor(Math.random() * 8) + 3,
    Low: dayConvos.filter(c => c.severity === 'Low').length || Math.floor(Math.random() * 12) + 5,
  }
})

// --- Adapter implementation ---
export const mockAdapter: DataAdapter = {
  async getOverviewMetrics() {
    const acc7d = accuracyLogs.slice(0, 7)
    const avg7d = acc7d.reduce((s, r) => s + r.accuracy_rate, 0) / acc7d.length

    return {
      today_total: todayConvos.length || 8,
      today_critical: todayCounts.Critical || 2,
      today_high: todayCounts.High || 3,
      today_medium: todayCounts.Medium || 5,
      today_low: todayCounts.Low || 12,
      open_tickets: tickets.filter(t => t.status === 'Open').length,
      alerts_today: alerts.filter(a => a.date === dateStr(0)).length || 2,
      accuracy_7d: avg7d,
      recent_alerts: alerts.slice(0, 5),
      severity_breakdown: severityBreakdown
    } as OverviewMetrics
  },

  async getConversations(filters?: ConversationFilters) {
    let results = [...conversations]
    if (filters?.severity)   results = results.filter(c => c.severity === filters.severity)
    if (filters?.category)   results = results.filter(c => c.issue_category === filters.category)
    if (filters?.resolution) results = results.filter(c => c.resolution_status === filters.resolution)
    if (filters?.agent)      results = results.filter(c => c.agent_name === filters.agent)
    if (filters?.dateFrom)   results = results.filter(c => c.analyzed_at >= filters.dateFrom!)
    if (filters?.dateTo)     results = results.filter(c => c.analyzed_at <= filters.dateTo! + 'T23:59:59Z')
    return results
  },

  async getTickets(filters?: TicketFilters) {
    let results = [...tickets]
    if (filters?.severity)    results = results.filter(t => t.severity === filters.severity)
    if (filters?.status)      results = results.filter(t => t.status === filters.status)
    if (filters?.assigned_to) results = results.filter(t => t.assigned_to === filters.assigned_to)
    return results
  },

  async updateTicketFeedback(ticketId: string, feedback: FeedbackValue) {
    const ticket = tickets.find(t => t.ticket_id === ticketId)
    if (ticket) ticket.feedback = feedback
  },

  async getTrends() {
    const catCounts = CATEGORIES.map(cat => {
      const count = conversations.filter(c => c.issue_category === cat).length
      const prevCount = Math.floor(count * (0.7 + Math.random() * 0.6))
      return {
        category: cat,
        count,
        pct_change: Math.round(((count - prevCount) / Math.max(prevCount, 1)) * 100)
      }
    }).sort((a, b) => b.count - a.count)

    const agentPerf = AGENTS.map(agent => {
      const agentConvos = conversations.filter(c => c.agent_name === agent)
      const avg = agentConvos.reduce((s, c) => s + (c.agent_score ?? 0), 0) / Math.max(agentConvos.length, 1)
      return {
        agent_name: agent,
        avg_score: Math.round(avg * 10) / 10,
        total: agentConvos.length,
        flagged: agentConvos.filter(c => c.severity === 'Critical' || c.severity === 'High').length
      }
    }).sort((a, b) => b.total - a.total)

    const anomalies = catCounts.filter(c => c.pct_change > 50)

    return {
      daily_series: severityBreakdown.map(d => ({
        ...d,
        total: d.Critical + d.High + d.Medium + d.Low
      })),
      category_breakdown: catCounts,
      agent_performance: agentPerf,
      anomalies,
      repeat_complainers: 4
    } as TrendData
  },

  async getReports() {
    return monthlyReports
  },

  async approveReport(month: string) {
    const report = monthlyReports.find(r => r.month === month)
    if (report) report.status = 'approved'
  },

  async getAccuracyMetrics() {
    return accuracyLogs
  }
}
