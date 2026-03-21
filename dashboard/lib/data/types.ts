export type Severity = 'Low' | 'Medium' | 'High' | 'Critical'
export type IssueCategory =
  | 'Payment/Withdrawal'
  | 'Game Bug'
  | 'Login/Account'
  | 'Bonus/Promotion'
  | 'Technical Error'
  | 'Website & Navigation'
  | 'Device & Compatibility'
  | 'Slow Response'
  | 'Inappropriate Communication'
  | 'Other'
export type ResolutionStatus = 'Resolved' | 'Partially Resolved' | 'Unresolved'
export type TicketStatus = 'Open' | 'In Review' | 'Closed'
export type FeedbackValue = 'Agree' | 'Disagree' | ''
export type ReportStatus = 'draft' | 'approved'

export interface AnalysisResult {
  conversation_id: string
  player_id: string
  agent_name: string
  summary: string
  severity: Severity
  issue_category: IssueCategory
  resolution_status: ResolutionStatus
  key_quotes: string[]
  agent_score: number | null
  agent_notes: string
  recommended_action: string
  is_alert: boolean
  alert_reason: string | null
  language?: string
  analyzed_at: string
  intercom_link: string
}

export interface Ticket {
  ticket_id: string
  date: string
  conversation_id: string
  player_id: string
  agent_name: string
  severity: Severity
  issue_category: IssueCategory
  summary: string
  key_quotes: string[]
  recommended_action: string
  assigned_to: string
  status: TicketStatus
  feedback: FeedbackValue
  feedback_processed: boolean
  intercom_link: string
  created_at: string
}

export interface AlertLog {
  alert_id: string
  date: string
  conversation_id: string
  player_id: string
  alert_reason: string
  severity: Severity
  notified_to: string
  responded: boolean
  response_time: string
}

export interface WeeklyTrend {
  week_start: string
  week_end: string
  top_issues: Array<{ category: string; count: number; daily_avg: number; pct_change: number }>
  anomalies: Array<{ category: string; count: number; pct_change: number }>
  repeat_complainers: number
  trend_summary: string
  recommendations: string
}

export interface AccuracyLog {
  date: string
  total_reviewed: number
  agreed: number
  disagreed: number
  accuracy_rate: number
  worst_category: string
  notes: string
  language?: string
}

export interface MonthlyReport {
  month: string
  total_conversations: number
  satisfaction_rate: number
  top_issues: Array<{ category: string; count: number }>
  accuracy_rate: number
  report_html: string
  status: ReportStatus
  generated_at: string
}

export interface OverviewMetrics {
  today_total: number
  today_critical: number
  today_high: number
  today_medium: number
  today_low: number
  open_tickets: number
  alerts_today: number
  accuracy_7d: number
  recent_alerts: AlertLog[]
  severity_breakdown: Array<{ date: string; Critical: number; High: number; Medium: number; Low: number }>
}

export interface TrendData {
  daily_series: Array<{ date: string; Critical: number; High: number; Medium: number; Low: number; total: number }>
  category_breakdown: Array<{ category: string; count: number; pct_change: number }>
  agent_performance: Array<{ agent_name: string; avg_score: number; total: number; flagged: number }>
  anomalies: Array<{ category: string; count: number; pct_change: number }>
  repeat_complainers: number
}

export interface ConversationFilters {
  dateFrom?: string
  dateTo?: string
  severity?: Severity | ''
  category?: IssueCategory | ''
  resolution?: ResolutionStatus | ''
  agent?: string
  language?: string
}

export interface TicketFilters {
  status?: TicketStatus | ''
  severity?: Severity | ''
  assigned_to?: string
}

export interface DataAdapter {
  getOverviewMetrics(): Promise<OverviewMetrics>
  getConversations(filters?: ConversationFilters): Promise<AnalysisResult[]>
  getTickets(filters?: TicketFilters): Promise<Ticket[]>
  updateTicketFeedback(ticketId: string, feedback: FeedbackValue): Promise<void>
  getTrends(): Promise<TrendData>
  getReports(): Promise<MonthlyReport[]>
  approveReport(month: string): Promise<void>
  getAccuracyMetrics(): Promise<AccuracyLog[]>
}
