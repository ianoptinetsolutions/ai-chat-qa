'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/data'
import type { AccuracyLog } from '@/lib/data/types'
import { formatDate } from '@/lib/utils'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { Target, CheckCircle, XCircle, TrendingUp } from 'lucide-react'

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: p.color, marginBottom: '2px' }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
            {p.name === 'Accuracy' ? `${(p.value * 100).toFixed(1)}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function AccuracyGauge({ pct }: { pct: number }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ * 0.75
  const color = pct >= 85 ? 'var(--green)' : pct >= 70 ? 'var(--medium)' : 'var(--critical)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
      <svg viewBox="0 0 140 110" style={{ width: '100%', maxWidth: '140px', height: 'auto' }}>
        <circle cx="70" cy="80" r={r} fill="none" stroke="var(--border)" strokeWidth="10"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round"
        />
        <circle cx="70" cy="80" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="70" y="78" textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, fill: color }}>
          {pct.toFixed(0)}%
        </text>
        <text x="70" y="100" textAnchor="middle"
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', fill: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          AI Accuracy
        </text>
      </svg>
    </div>
  )
}

export default function AccuracyPage() {
  const [logs, setLogs] = useState<AccuracyLog[]>([])

  useEffect(() => {
    db.getAccuracyMetrics().then(setLogs)
  }, [])

  if (!logs.length) return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Accuracy</h1>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              AI analysis accuracy · Based on team feedback
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
        Loading accuracy data…
      </div>
    </>
  )

  // Only use global rows (language='all' or no language) for summary stats and trend chart
  // to avoid double-counting with per-language rows from the same batch
  const globalLogs = logs.filter(l => !l.language || l.language === 'all')

  const totalReviewed = globalLogs.reduce((s, l) => s + l.total_reviewed, 0)
  const totalAgreed = globalLogs.reduce((s, l) => s + l.agreed, 0)
  const totalDisagreed = globalLogs.reduce((s, l) => s + l.disagreed, 0)
  const overallAcc = totalReviewed > 0 ? (totalAgreed / totalReviewed) * 100 : 0

  const recent7 = globalLogs.slice(0, 7)
  const avg7d = recent7.length > 0 ? recent7.reduce((s, l) => s + l.accuracy_rate, 0) / recent7.length * 100 : 0

  // Category accuracy from worst_category field (global rows only)
  const categoryCounts: Record<string, { disagree: number; total: number }> = {}
  globalLogs.forEach(l => {
    if (!categoryCounts[l.worst_category]) categoryCounts[l.worst_category] = { disagree: 0, total: 0 }
    categoryCounts[l.worst_category].disagree += l.disagreed
    categoryCounts[l.worst_category].total += l.total_reviewed
  })
  const categoryData = Object.entries(categoryCounts).map(([cat, { disagree, total }]) => ({
    category: cat.split('/')[0],
    accuracy: Math.max(50, 100 - (disagree / Math.max(total, 1)) * 100 * 3),
    disagree
  })).sort((a, b) => a.accuracy - b.accuracy)

  const chartData = [...globalLogs].reverse().map(l => ({
    date: formatDate(l.date),
    'Accuracy': l.accuracy_rate,
    'Agreed': l.agreed,
    'Disagreed': l.disagreed,
  }))

  // Per-language accuracy from per-language rows (language !== 'all' and language is set)
  const LANGUAGE_NAMES: Record<string, string> = {
    ar: 'Arabic', de: 'German', el: 'Greek', en: 'English',
    fi: 'Finnish', fr: 'French', it: 'Italian', no: 'Norwegian', pt: 'Portuguese'
  }
  const langAccMap: Record<string, { agreed: number; total: number }> = {}
  logs.forEach(l => {
    if (l.language && l.language !== 'all') {
      if (!langAccMap[l.language]) langAccMap[l.language] = { agreed: 0, total: 0 }
      langAccMap[l.language].agreed += l.agreed
      langAccMap[l.language].total += l.total_reviewed
    }
  })
  const languageAccData = Object.entries(langAccMap)
    .filter(([, d]) => d.total > 0)
    .map(([code, d]) => ({
      language: LANGUAGE_NAMES[code] ?? code.toUpperCase(),
      accuracy: Math.round((d.agreed / d.total) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy)

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Accuracy</h1>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              AI analysis accuracy · Based on team feedback
            </div>
          </div>
        </div>
      </div>

      <div className="page-content fade-up">
        {/* Top row: gauge + stats */}
        <div className="accuracy-top-grid" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '16px', marginBottom: '24px', alignItems: 'stretch' }}>
          {/* Gauge */}
          <div className="card" style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AccuracyGauge pct={overallAcc} />
          </div>

          {[
            { label: 'Total Reviewed', value: totalReviewed, icon: Target, color: 'var(--text-primary)' },
            { label: 'AI Agreed', value: totalAgreed, icon: CheckCircle, color: 'var(--green)' },
            { label: 'Flagged Wrong', value: totalDisagreed, icon: XCircle, color: 'var(--critical)' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Icon size={13} color="var(--accent)" />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {label}
                </span>
              </div>
              <div className="stat-value" style={{ color }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="chart-split-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px', marginBottom: '20px' }}>
          {/* Accuracy trend */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <TrendingUp size={14} color="var(--accent)" />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>
                Accuracy Trend
              </span>
              <div style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)' }}>
                7d avg: <span style={{ color: avg7d >= 85 ? 'var(--green)' : 'var(--medium)' }}>{avg7d.toFixed(1)}%</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0.5, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
                <ReferenceLine y={0.85} stroke="var(--green)" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Accuracy" stroke="var(--accent)" strokeWidth={2.5} dot={{ fill: 'var(--accent)', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", marginTop: '8px' }}>
              — Green dashed line = 85% target threshold
            </div>
          </div>

          {/* Accuracy by category */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px', marginBottom: '20px' }}>
              Accuracy by Category
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[50, 100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
                <YAxis dataKey="category" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} width={80} />
                <ReferenceLine x={85} stroke="var(--green)" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="accuracy" fill="var(--accent)" radius={[0, 4, 4, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Per-language accuracy */}
        {languageAccData.length > 0 && (
          <div className="card" style={{ padding: '22px 24px', marginBottom: '20px' }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px', marginBottom: '20px' }}>
              Accuracy by Language
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={languageAccData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
                <YAxis dataKey="language" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} width={70} />
                <ReferenceLine x={85} stroke="var(--green)" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Tooltip formatter={(v) => [`${Number(v)}%`, 'Accuracy']} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="accuracy" fill="var(--accent)" radius={[0, 4, 4, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Log table */}
        <div className="card">
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>
            Accuracy Log
          </div>
          <div className="table-scroll-hint" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Lang</th>
                  <th>Reviewed</th>
                  <th>Agreed</th>
                  <th>Disagreed</th>
                  <th>Accuracy</th>
                  <th>Accuracy Bar</th>
                  <th>Worst Category</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => {
                  const acc = l.accuracy_rate * 100
                  const accColor = acc >= 85 ? 'var(--green)' : acc >= 70 ? 'var(--medium)' : 'var(--critical)'
                  return (
                    <tr key={i}>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>{formatDate(l.date)}</td>
                      <td>
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 600,
                          padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.05em',
                          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                          color: 'var(--text-secondary)', textTransform: 'uppercase'
                        }}>
                          {l.language ?? 'all'}
                        </span>
                      </td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{l.total_reviewed}</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--green)' }}>{l.agreed}</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", color: l.disagreed > 0 ? 'var(--critical)' : 'var(--text-secondary)' }}>{l.disagreed}</td>
                      <td>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: accColor, fontWeight: 600 }}>
                          {acc.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <div style={{ width: '80px', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${acc}%`, height: '100%', background: accColor, borderRadius: '2px' }} />
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-primary)', fontSize: '12px' }}>{l.worst_category}</td>
                      <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {l.notes}
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
