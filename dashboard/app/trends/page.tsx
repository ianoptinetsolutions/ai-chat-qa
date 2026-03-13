'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/data'
import type { TrendData } from '@/lib/data/types'
import { scoreColor } from '@/lib/utils'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, AlertTriangle, Users, ArrowUp, ArrowDown, Minus } from 'lucide-react'

const CHART_COLORS = {
  Critical: 'var(--critical)',
  High: 'var(--high)',
  Medium: 'var(--medium)',
  Low: 'var(--low)',
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' }}>
        {label}
      </div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: p.color, marginBottom: '2px' }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function TrendIcon({ pct }: { pct: number }) {
  if (pct > 20) return <ArrowUp size={12} color="var(--critical)" />
  if (pct < -20) return <ArrowDown size={12} color="var(--green)" />
  return <Minus size={12} color="var(--text-muted)" />
}

export default function TrendsPage() {
  const [data, setData] = useState<TrendData | null>(null)

  useEffect(() => {
    db.getTrends().then(setData)
  }, [])

  if (!data) return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Trends</h1>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            7-day rolling window · Pattern detection
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
        Loading trends…
      </div>
    </>
  )

  const chartData = data.daily_series.map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }),
  }))

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Trends</h1>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            7-day rolling window · Pattern detection
          </div>
        </div>
        {data.anomalies.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--critical-dim)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '7px', padding: '6px 12px' }}>
            <AlertTriangle size={13} color="var(--critical)" />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--critical)' }}>
              {data.anomalies.length} spike{data.anomalies.length !== 1 ? 's' : ''} detected
            </span>
          </div>
        )}
      </div>

      <div className="page-content fade-up">
        {/* Anomaly alerts */}
        {data.anomalies.length > 0 && (
          <div className="anomaly-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(data.anomalies.length, 3)}, 1fr)`, gap: '12px', marginBottom: '24px' }}>
            {data.anomalies.map((a) => (
              <div key={a.category} style={{
                background: 'var(--critical-dim)', border: '1px solid rgba(244,63,94,0.25)',
                borderRadius: '10px', padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <AlertTriangle size={20} color="var(--critical)" />
                <div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--critical)' }}>
                    {a.category}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(244,63,94,0.7)', marginTop: '2px' }}>
                    ↑ {a.pct_change > 0 ? '+' : ''}{a.pct_change}% above 7-day avg
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary stats */}
        <div className="trends-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={14} color="var(--accent)" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Top Issue
              </span>
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {data.category_breakdown[0]?.category}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {data.category_breakdown[0]?.count} conversations
            </div>
          </div>
          <div className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Users size={14} color="var(--accent)" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Repeat Complainers
              </span>
            </div>
            <div className="stat-value">{data.repeat_complainers}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              3+ contacts in 7 days
            </div>
          </div>
          <div className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertTriangle size={14} color="var(--accent)" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Spike Anomalies
              </span>
            </div>
            <div className="stat-value" style={{ color: data.anomalies.length > 0 ? 'var(--critical)' : 'var(--green)' }}>
              {data.anomalies.length}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              &gt;150% above avg
            </div>
          </div>
        </div>

        <div className="chart-split-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px', marginBottom: '20px' }}>
          {/* Severity trend line chart */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px', marginBottom: '20px' }}>
              Severity Trend (7 Days)
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                {(Object.entries(CHART_COLORS) as [string, string][]).map(([sev, color]) => (
                  <Line key={sev} type="monotone" dataKey={sev} stroke={color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Category bar chart */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px', marginBottom: '20px' }}>
              Issues by Category
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.category_breakdown.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
                <YAxis dataKey="category" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent performance */}
        <div className="card">
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>
              Agent Performance
            </span>
          </div>
          <div className="table-scroll-hint" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Conversations</th>
                  <th>Avg Score</th>
                  <th>Score Visual</th>
                  <th>Critical/High</th>
                  <th>Flag Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.agent_performance.map(a => {
                  const flagRate = a.total > 0 ? (a.flagged / a.total) * 100 : 0
                  return (
                    <tr key={a.agent_name}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{a.agent_name}</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{a.total}</td>
                      <td>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: scoreColor(a.avg_score), fontWeight: 600 }}>
                          {a.avg_score}/5
                        </span>
                      </td>
                      <td>
                        <div style={{ width: '80px', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${(a.avg_score / 5) * 100}%`, height: '100%', background: scoreColor(a.avg_score), borderRadius: '2px' }} />
                        </div>
                      </td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", color: a.flagged > 5 ? 'var(--critical)' : 'var(--text-secondary)' }}>
                        {a.flagged}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TrendIcon pct={flagRate - 20} />
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: flagRate > 40 ? 'var(--critical)' : 'var(--text-secondary)' }}>
                            {flagRate.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
