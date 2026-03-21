// SECURITY NOTE: Uses NEXT_PUBLIC_SUPABASE_ANON_KEY (browser-visible).
// RLS must be enabled on all qa_* tables — see supabase_setup.sql.
// Users must be authenticated via Supabase Auth before any data is readable.
import { createClient } from '@supabase/supabase-js'
import type {
  DataAdapter, AnalysisResult, Ticket, AlertLog, AccuracyLog,
  MonthlyReport, OverviewMetrics, TrendData, ConversationFilters,
  TicketFilters, FeedbackValue,
} from './types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// ── Parsers ──────────────────────────────────────────────────────────────────

function parseKeyQuotes(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)
  const s = String(raw).trim()
  if (s.startsWith('[')) { try { return JSON.parse(s) } catch {} }
  return s.split(/",\s*"/).map(q => q.replace(/^["']|["']$/g, '').trim()).filter(Boolean)
}

function parseTopIssues(raw: unknown): Array<{ category: string; count: number }> {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(String(raw)) } catch { return [] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

function toAnalysisResult(r: Row): AnalysisResult {
  return {
    conversation_id:    String(r.conversation_id ?? ''),
    player_id:          String(r.player_id ?? ''),
    agent_name:         String(r.agent_name ?? ''),
    summary:            String(r.summary ?? ''),
    severity:           r.severity ?? 'Low',
    issue_category:     r.issue_category ?? 'Other',
    resolution_status:  r.resolution_status ?? 'Unresolved',
    key_quotes:         parseKeyQuotes(r.key_quotes),
    agent_score:        r.agent_score != null ? Number(r.agent_score) : null,
    agent_notes:        String(r.agent_notes ?? ''),
    recommended_action: String(r.recommended_action ?? ''),
    is_alert:           Boolean(r.is_alert),
    alert_reason:       r.alert_reason ? String(r.alert_reason) : null,
    language:           r.language ? String(r.language) : undefined,
    analyzed_at:        String(r.analyzed_at ?? ''),
    intercom_link:      String(r.intercom_link ?? ''),
  }
}

function toTicket(r: Row): Ticket {
  return {
    ticket_id:          String(r.ticket_id ?? ''),
    date:               String(r.date ?? ''),
    conversation_id:    String(r.conversation_id ?? ''),
    player_id:          String(r.player_id ?? ''),
    agent_name:         String(r.agent_name ?? ''),
    severity:           r.severity ?? 'Medium',
    issue_category:     r.issue_category ?? 'Other',
    summary:            String(r.summary ?? ''),
    key_quotes:         parseKeyQuotes(r.key_quotes),
    recommended_action: String(r.recommended_action ?? ''),
    assigned_to:        String(r.assigned_to ?? ''),
    status:             r.status ?? 'Open',
    feedback:           r.feedback ?? '',
    feedback_processed: Boolean(r.feedback_processed),
    feedback_by:        r.feedback_by ? String(r.feedback_by) : undefined,
    feedback_at:        r.feedback_at ? String(r.feedback_at) : undefined,
    intercom_link:      String(r.intercom_link ?? ''),
    created_at:         String(r.created_at ?? ''),
  }
}

function toAlertLog(r: Row): AlertLog {
  return {
    alert_id:        String(r.alert_id ?? ''),
    date:            String(r.date ?? ''),
    conversation_id: String(r.conversation_id ?? ''),
    player_id:       String(r.player_id ?? ''),
    alert_reason:    String(r.alert_reason ?? ''),
    severity:        r.severity ?? 'Critical',
    notified_to:     String(r.notified_to ?? ''),
    responded:       Boolean(r.responded),
    response_time:   String(r.response_time ?? ''),
  }
}

function toAccuracyLog(r: Row): AccuracyLog {
  return {
    date:           String(r.date ?? ''),
    total_reviewed: Number(r.total_reviewed ?? 0),
    agreed:         Number(r.agreed ?? 0),
    disagreed:      Number(r.disagreed ?? 0),
    accuracy_rate:  Number(r.accuracy_rate ?? 0),
    worst_category: String(r.worst_category ?? ''),
    notes:          String(r.notes ?? ''),
    language:       r.language ? String(r.language) : undefined,
  }
}

function toMonthlyReport(r: Row): MonthlyReport {
  return {
    month:               String(r.month ?? ''),
    total_conversations: Number(r.total_conversations ?? 0),
    satisfaction_rate:   Number(r.satisfaction_rate ?? 0),
    top_issues:          parseTopIssues(r.top_issues),
    accuracy_rate:       Number(r.accuracy_rate ?? 0),
    report_html:         String(r.report_html ?? ''),
    status:              r.status ?? 'draft',
    generated_at:        String(r.generated_at ?? ''),
  }
}

function dayStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export const supabaseAdapter: DataAdapter = {

  async getConversations(filters?: ConversationFilters) {
    const page     = filters?.page     ?? 0
    const pageSize = filters?.pageSize ?? 100
    const from     = page * pageSize
    const to       = from + pageSize - 1

    let q = supabase
      .from('qa_analysis')
      .select('*')
      .order('analyzed_at', { ascending: false })
      .range(from, to)
    if (filters?.severity)   q = q.eq('severity', filters.severity)
    if (filters?.category)   q = q.eq('issue_category', filters.category)
    if (filters?.resolution) q = q.eq('resolution_status', filters.resolution)
    if (filters?.agent)      q = q.eq('agent_name', filters.agent)
    if (filters?.language)   q = q.eq('language', filters.language)
    if (filters?.dateFrom)   q = q.gte('analyzed_at', filters.dateFrom + 'T00:00:00Z')
    if (filters?.dateTo)     q = q.lte('analyzed_at', filters.dateTo + 'T23:59:59Z')
    const { data, error } = await q
    if (error) throw error
    return (data ?? []).map(toAnalysisResult)
  },

  async getTickets(filters?: TicketFilters) {
    let q = supabase
      .from('qa_tickets')
      .select('*')
      .order('created_at', { ascending: false })
    if (filters?.status)      q = q.eq('status', filters.status)
    if (filters?.severity)    q = q.eq('severity', filters.severity)
    if (filters?.assigned_to) q = q.eq('assigned_to', filters.assigned_to)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []).map(toTicket)
  },

  async updateTicketFeedback(ticketId: string, feedback: FeedbackValue) {
    const { error } = await supabase
      .from('qa_tickets')
      .update({ feedback, feedback_at: new Date().toISOString() })
      .eq('ticket_id', ticketId)
    if (error) throw error
  },

  async getAccuracyMetrics() {
    const { data, error } = await supabase
      .from('qa_accuracy')
      .select('*')
      .order('date', { ascending: false })
      .limit(90)
    if (error) throw error
    return (data ?? []).map(toAccuracyLog)
  },

  async getReports() {
    const { data, error } = await supabase
      .from('qa_monthly_reports')
      .select('*')
      .order('month', { ascending: false })
    if (error) throw error
    return (data ?? []).map(toMonthlyReport)
  },

  async approveReport(month: string) {
    const { error } = await supabase
      .from('qa_monthly_reports')
      .update({ status: 'approved' })
      .eq('month', month)
    if (error) throw error
  },

  async getOverviewMetrics(): Promise<OverviewMetrics> {
    const today        = dayStr(0)
    const sevenDaysAgo = dayStr(6)

    const [
      { data: todayRows },
      { count: openTicketCount },
      { count: alertsTodayCount },
      { data: recentAlertRows },
      { data: accuracyRows },
      { data: weekRows },
    ] = await Promise.all([
      supabase
        .from('qa_analysis')
        .select('severity')
        .gte('analyzed_at', today + 'T00:00:00Z'),
      supabase
        .from('qa_tickets')
        .select('ticket_id', { count: 'exact', head: true })
        .eq('status', 'Open'),
      supabase
        .from('qa_alerts')
        .select('alert_id', { count: 'exact', head: true })
        .eq('date', today),
      supabase
        .from('qa_alerts')
        .select('*')
        .order('date', { ascending: false })
        .limit(5),
      supabase
        .from('qa_accuracy')
        .select('date,accuracy_rate')
        .or('language.eq.all,language.is.null')
        .gte('date', sevenDaysAgo)
        .order('date', { ascending: false }),
      supabase
        .from('qa_analysis')
        .select('analyzed_at,severity')
        .gte('analyzed_at', sevenDaysAgo + 'T00:00:00Z')
        .order('analyzed_at', { ascending: false }),
    ])

    const td = todayRows ?? []
    const accuracy_7d = accuracyRows && accuracyRows.length > 0
      ? accuracyRows.reduce((s, r) => s + Number(r.accuracy_rate), 0) / accuracyRows.length
      : 0

    const severity_breakdown = Array.from({ length: 7 }, (_, i) => {
      const day     = dayStr(6 - i)
      const dayRows = (weekRows ?? []).filter(r => r.analyzed_at.startsWith(day))
      return {
        date:     day,
        Critical: dayRows.filter(r => r.severity === 'Critical').length,
        High:     dayRows.filter(r => r.severity === 'High').length,
        Medium:   dayRows.filter(r => r.severity === 'Medium').length,
        Low:      dayRows.filter(r => r.severity === 'Low').length,
      }
    })

    return {
      today_total:    td.length,
      today_critical: td.filter(r => r.severity === 'Critical').length,
      today_high:     td.filter(r => r.severity === 'High').length,
      today_medium:   td.filter(r => r.severity === 'Medium').length,
      today_low:      td.filter(r => r.severity === 'Low').length,
      open_tickets:   openTicketCount ?? 0,
      alerts_today:   alertsTodayCount ?? 0,
      accuracy_7d,
      recent_alerts:  (recentAlertRows ?? []).map(toAlertLog),
      severity_breakdown,
    }
  },

  async getTrends(): Promise<TrendData> {
    const sevenDaysAgo    = dayStr(6)
    const fourteenDaysAgo = dayStr(13)

    const { data, error } = await supabase
      .from('qa_analysis')
      .select('analyzed_at,severity,issue_category,agent_name,agent_score,player_id')
      .gte('analyzed_at', fourteenDaysAgo + 'T00:00:00Z')
      .order('analyzed_at', { ascending: false })
    if (error) throw error

    const rows     = data ?? []
    const thisWeek = rows.filter(r => r.analyzed_at >= sevenDaysAgo + 'T00:00:00Z')
    const lastWeek = rows.filter(r => r.analyzed_at  < sevenDaysAgo + 'T00:00:00Z')

    // Daily series
    const daily_series = Array.from({ length: 7 }, (_, i) => {
      const day     = dayStr(6 - i)
      const dayRows = thisWeek.filter(r => r.analyzed_at.startsWith(day))
      return {
        date:     day,
        Critical: dayRows.filter(r => r.severity === 'Critical').length,
        High:     dayRows.filter(r => r.severity === 'High').length,
        Medium:   dayRows.filter(r => r.severity === 'Medium').length,
        Low:      dayRows.filter(r => r.severity === 'Low').length,
        total:    dayRows.length,
      }
    })

    // Category breakdown with pct_change vs previous 7 days
    const CATEGORIES = [
      'Payment/Withdrawal', 'Game Bug', 'Login/Account', 'Bonus/Promotion',
      'Technical Error', 'Website & Navigation', 'Device & Compatibility',
      'Slow Response', 'Inappropriate Communication', 'Other',
    ]
    const category_breakdown = CATEGORIES.map(cat => {
      const thisCount = thisWeek.filter(r => r.issue_category === cat).length
      const lastCount = lastWeek.filter(r => r.issue_category === cat).length
      const pct_change = lastCount > 0 ? Math.round(((thisCount - lastCount) / lastCount) * 100) : 0
      return { category: cat, count: thisCount, pct_change }
    }).filter(c => c.count > 0).sort((a, b) => b.count - a.count)

    // Agent performance
    const agentMap: Record<string, { scores: number[]; total: number; flagged: number }> = {}
    for (const r of thisWeek) {
      const name = r.agent_name || 'Unknown'
      if (!agentMap[name]) agentMap[name] = { scores: [], total: 0, flagged: 0 }
      agentMap[name].total++
      if (r.agent_score != null) agentMap[name].scores.push(Number(r.agent_score))
      if (r.severity === 'Critical' || r.severity === 'High') agentMap[name].flagged++
    }
    const agent_performance = Object.entries(agentMap).map(([agent_name, d]) => ({
      agent_name,
      avg_score: d.scores.length > 0
        ? Math.round((d.scores.reduce((a, b) => a + b, 0) / d.scores.length) * 10) / 10
        : 0,
      total:   d.total,
      flagged: d.flagged,
    })).sort((a, b) => b.total - a.total)

    // Anomalies: categories with >50% increase
    const anomalies = category_breakdown.filter(c => c.pct_change > 50)

    // Repeat complainers: players with >1 convo this week
    const playerCounts: Record<string, number> = {}
    for (const r of thisWeek) {
      playerCounts[r.player_id] = (playerCounts[r.player_id] ?? 0) + 1
    }
    // Threshold: 3+ conversations this week — matches WF6 script threshold
    const repeat_complainers = Object.values(playerCounts).filter(n => n >= 3).length

    return { daily_series, category_breakdown, agent_performance, anomalies, repeat_complainers }
  },
}
