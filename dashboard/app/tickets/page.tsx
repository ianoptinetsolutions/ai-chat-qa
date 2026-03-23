'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/data'
import type { Ticket, TicketFilters, FeedbackValue } from '@/lib/data/types'
import { severityBadgeClass, statusBadgeClass, formatDateTime, truncate } from '@/lib/utils'
import { ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react'

const LEADERS = ['Hannah Cross', 'David Park', 'QA-Inbox']

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filters, setFilters] = useState<TicketFilters>({})
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({})

  useEffect(() => {
    setLoading(true)
    db.getTickets(filters)
      .then(data => {
        setTickets(data)
        const init: Record<string, FeedbackValue> = {}
        data.forEach(t => { init[t.ticket_id] = t.feedback })
        setFeedback(init)
        setLoading(false)
      })
      .catch(() => { setTickets([]); setLoading(false) })
  }, [filters])

  async function handleFeedback(ticketId: string, value: FeedbackValue) {
    setFeedback(f => ({ ...f, [ticketId]: value }))
    await db.updateTicketFeedback(ticketId, value)
  }

  const setFilter = (key: keyof TicketFilters, value: string) => {
    setFilters(f => ({ ...f, [key]: value || undefined }))
  }

  const open = tickets.filter(t => t.status === 'Open').length
  const pending = tickets.filter(t => !t.feedback).length

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Tickets</h1>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {tickets.length} tickets · {open} open · {pending} awaiting feedback
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Summary chips */}
        <div className="summary-chips" style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            { label: 'Open', count: open, color: 'var(--critical)' },
            { label: 'In Review', count: tickets.filter(t => t.status === 'In Review').length, color: 'var(--medium)' },
            { label: 'Closed', count: tickets.filter(t => t.status === 'Closed').length, color: 'var(--green)' },
            { label: 'Pending Feedback', count: pending, color: 'var(--accent)' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '10px 18px',
              display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color }}>
                {count}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="filter-bar" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <select value={filters.severity ?? ''} onChange={e => setFilter('severity', e.target.value)} style={{ minWidth: '130px' }}>
            <option value="">All Severities</option>
            {['Critical', 'High', 'Medium'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.status ?? ''} onChange={e => setFilter('status', e.target.value)} style={{ minWidth: '130px' }}>
            <option value="">All Statuses</option>
            {['Open', 'In Review', 'Closed'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.assigned_to ?? ''} onChange={e => setFilter('assigned_to', e.target.value)} style={{ minWidth: '150px' }}>
            <option value="">All Leaders</option>
            {LEADERS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {Object.keys(filters).length > 0 && (
            <button className="btn-ghost" onClick={() => setFilters({})}>Clear filters</button>
          )}
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll-hint" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Severity</th>
                  <th>Category</th>
                  <th>Agent</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  <th>Summary</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'center' }}>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading…</td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No tickets match filters</td></tr>
                ) : (
                  tickets.map(t => {
                    const fb = feedback[t.ticket_id]
                    return (
                      <tr key={t.ticket_id} onClick={e => e.stopPropagation()}>
                        <td>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)' }}>{t.ticket_id}</div>
                        </td>
                        <td><span className={severityBadgeClass(t.severity)}>{t.severity}</span></td>
                        <td style={{ maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                          {t.issue_category}
                        </td>
                        <td>{t.agent_name}</td>
                        <td style={{ color: 'var(--text-primary)' }}>{t.assigned_to}</td>
                        <td><span className={statusBadgeClass(t.status)}>{t.status}</span></td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {truncate(t.summary, 60)}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>
                          {formatDateTime(t.created_at)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                            {fb === 'Agree' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--green)', fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" }}>
                                <CheckCircle size={12} /> Agree
                              </div>
                            ) : fb === 'Disagree' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--critical)', fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" }}>
                                <XCircle size={12} /> Disagree
                              </div>
                            ) : (
                              <>
                                <button className="btn-agree" onClick={() => handleFeedback(t.ticket_id, 'Agree')}>
                                  Agree
                                </button>
                                <button className="btn-disagree" onClick={() => handleFeedback(t.ticket_id, 'Disagree')}>
                                  Disagree
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <Clock size={11} />
            Feedback is sent to AI accuracy tracking (WF7, runs every 6h)
          </div>
          <a href="/accuracy" style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: "'IBM Plex Mono', monospace", textDecoration: 'none' }}>
            View accuracy →
          </a>
        </div>
      </div>
    </>
  )
}
