import { db } from '@/lib/data'
import { formatDateTime } from '@/lib/utils'
import { AlertTriangle, BarChart2, CheckCircle, Ticket, Activity } from 'lucide-react'

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
      {sub && (
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function SeverityBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace", color }}>
          {count} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px' }} />
      </div>
    </div>
  )
}

export default async function OverviewPage() {
  const m = await db.getOverviewMetrics()
  const totalToday = m.today_critical + m.today_high + m.today_medium + m.today_low
  const accPct = Math.round(m.accuracy_7d * 100)
  const now = new Date().toLocaleString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Overview</h1>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {now} UTC
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)' }}>
            System operational
          </span>
        </div>
      </div>

      <div className="page-content fade-up">
        {/* Top stats */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Conversations Today" value={totalToday} sub="Last run: 06:00 UTC" />
          <StatCard
            label="Open Tickets"
            value={m.open_tickets}
            sub="Pending team review"
            color={m.open_tickets > 5 ? 'var(--high)' : 'var(--text-primary)'}
          />
          <StatCard
            label="Alerts Today"
            value={m.alerts_today}
            sub="Critical + alert-worthy"
            color={m.alerts_today > 0 ? 'var(--critical)' : 'var(--text-primary)'}
          />
          <StatCard
            label="AI Accuracy (7d)"
            value={`${accPct}%`}
            sub="Based on team feedback"
            color={accPct >= 85 ? 'var(--green)' : accPct >= 70 ? 'var(--medium)' : 'var(--critical)'}
          />
        </div>

        <div className="overview-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Severity breakdown */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <BarChart2 size={14} color="var(--accent)" />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>
                Today&apos;s Severity Breakdown
              </span>
            </div>
            <SeverityBar label="Critical" count={m.today_critical} total={totalToday} color="var(--critical)" />
            <SeverityBar label="High"     count={m.today_high}     total={totalToday} color="var(--high)" />
            <SeverityBar label="Medium"   count={m.today_medium}   total={totalToday} color="var(--medium)" />
            <SeverityBar label="Low"      count={m.today_low}      total={totalToday} color="var(--low)" />
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)' }}>
              {totalToday} total conversations analyzed
            </div>
          </div>

          {/* 7-day bar chart */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <Activity size={14} color="var(--accent)" />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>
                7-Day Volume
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
              {m.severity_breakdown.map((d, i) => {
                const total = d.Critical + d.High + d.Medium + d.Low
                const maxTotal = Math.max(...m.severity_breakdown.map(x => x.Critical + x.High + x.Medium + x.Low))
                const height = maxTotal > 0 ? (total / maxTotal) * 80 : 10
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div title={`${total} total`} style={{ width: '100%', borderRadius: '3px 3px 0 0', overflow: 'hidden', height: `${height}px` }}>
                      <div style={{ height: `${(d.Critical / Math.max(total, 1)) * 100}%`, background: 'var(--critical)' }} />
                      <div style={{ height: `${(d.High / Math.max(total, 1)) * 100}%`, background: 'var(--high)' }} />
                      <div style={{ height: `${(d.Medium / Math.max(total, 1)) * 100}%`, background: 'var(--medium)' }} />
                      <div style={{ height: `${(d.Low / Math.max(total, 1)) * 100}%`, background: 'var(--low)' }} />
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'var(--text-muted)' }}>
                      {new Date(d.date).toLocaleDateString('en', { weekday: 'narrow' })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              {[['Critical', 'var(--critical)'], ['High', 'var(--high)'], ['Medium', 'var(--medium)'], ['Low', 'var(--low)']].map(([l, c]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c as string }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--text-muted)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent alerts */}
        <div className="card">
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="pulse-dot" />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>
              Recent Critical Alerts
            </span>
            <a href="/tickets" style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}>
              View tickets →
            </a>
          </div>
          {m.recent_alerts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No recent alerts
            </div>
          ) : (
            m.recent_alerts.map((a, i) => (
              <div key={a.alert_id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                padding: '14px 24px',
                borderBottom: i < m.recent_alerts.length - 1 ? '1px solid var(--border)' : 'none',
                gap: '12px', alignItems: 'start'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <AlertTriangle size={12} color="var(--critical)" />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)' }}>
                      {a.conversation_id}
                    </span>
                    <span className="badge badge-critical">Critical</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {a.alert_reason}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Player {a.player_id} · {formatDateTime(a.date + 'T00:00:00Z')}
                  </div>
                </div>
                <div>
                  {a.responded ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--green)' }}>
                      <CheckCircle size={11} /> Responded
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--critical)' }}>
                      <Ticket size={11} /> Pending
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
