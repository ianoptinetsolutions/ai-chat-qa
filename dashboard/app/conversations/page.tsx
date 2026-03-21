'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/data'
import type { AnalysisResult, ConversationFilters, Severity, IssueCategory, ResolutionStatus } from '@/lib/data/types'
import { severityBadgeClass, resolutionBadgeClass, formatDateTime, truncate, scoreColor } from '@/lib/utils'
import { X, ExternalLink, ChevronDown, Star } from 'lucide-react'

const CATEGORIES = [
  'Payment/Withdrawal', 'Game Bug', 'Login/Account', 'Bonus/Promotion',
  'Technical Error', 'Slow Response', 'Inappropriate Communication', 'Other'
]
const AGENTS = ['Sofia Reyes', 'Marcus Webb', 'Priya Nair', 'James Okonkwo', 'Elena Vasquez', 'Tom Brandt']
const LANGUAGES: Record<string, string> = {
  ar: 'Arabic', de: 'German', el: 'Greek', en: 'English',
  fi: 'Finnish', fr: 'French', it: 'Italian', no: 'Norwegian', pt: 'Portuguese'
}

function ScoreDots({ score }: { score: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <div key={n} style={{
          width: 8, height: 8, borderRadius: 2,
          background: n <= score ? scoreColor(score) : 'var(--border)',
          transition: 'background 0.2s'
        }} />
      ))}
    </div>
  )
}

function ConversationDrawer({ conv, onClose }: { conv: AnalysisResult; onClose: () => void }) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: 'var(--text-muted)' }}>
                {conv.conversation_id}
              </span>
              <span className={severityBadgeClass(conv.severity)}>{conv.severity}</span>
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {conv.issue_category}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {[
              ['Player', conv.player_id],
              ['Agent', conv.agent_name],
              ['Resolution', conv.resolution_status],
              ['Analyzed', formatDateTime(conv.analyzed_at)],
            ].map(([l, v]) => (
              <div key={l} className="card-inner" style={{ padding: '10px 14px' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '3px' }}>{l}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{ marginBottom: '20px' }}>
            <div className="section-title">AI Summary</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
              {conv.summary}
            </div>
          </div>

          {/* Key quotes */}
          {conv.key_quotes.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div className="section-title">Key Player Quotes</div>
              {conv.key_quotes.map((q, i) => (
                <div key={i} style={{
                  borderLeft: '2px solid var(--accent)',
                  paddingLeft: '12px',
                  marginBottom: '8px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  fontStyle: 'italic'
                }}>
                  {q}
                </div>
              ))}
            </div>
          )}

          {/* Agent performance */}
          <div style={{ marginBottom: '20px' }}>
            <div className="section-title">Agent Performance</div>
            <div className="card-inner" style={{ padding: '14px' }}>
              {conv.agent_score != null ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Star size={13} color={scoreColor(conv.agent_score)} fill={scoreColor(conv.agent_score)} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', color: scoreColor(conv.agent_score), fontWeight: 600 }}>
                      {conv.agent_score}/5
                    </span>
                  </div>
                  <ScoreDots score={conv.agent_score} />
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '8px' }}>
                  N/A — handled by bot
                </div>
              )}
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {conv.agent_notes}
              </div>
            </div>
          </div>

          {/* Recommended action */}
          <div style={{ marginBottom: '20px' }}>
            <div className="section-title">Recommended Action</div>
            <div style={{ fontSize: '13px', color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '12px 14px', lineHeight: '1.6' }}>
              {conv.recommended_action}
            </div>
          </div>

          {/* Alert info */}
          {conv.is_alert && conv.alert_reason && (
            <div style={{ marginBottom: '20px' }}>
              <div className="section-title">Alert Triggered</div>
              <div style={{ fontSize: '13px', color: 'var(--critical)', background: 'var(--critical-dim)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '8px', padding: '12px 14px' }}>
                {conv.alert_reason}
              </div>
            </div>
          )}

          {/* Link */}
          <a href={conv.intercom_link} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}>
            <ExternalLink size={11} /> Open in Intercom
          </a>
        </div>
      </div>
    </>
  )
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<AnalysisResult[]>([])
  const [selected, setSelected] = useState<AnalysisResult | null>(null)
  const [filters, setFilters] = useState<ConversationFilters>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.getConversations(filters).then(data => {
      setConversations(data)
      setLoading(false)
    })
  }, [filters])

  const setFilter = (key: keyof ConversationFilters, value: string) => {
    setFilters(f => ({ ...f, [key]: value || undefined }))
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Conversations</h1>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {conversations.length} records
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Filters */}
        <div className="filter-bar" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filters.severity ?? ''} onChange={e => setFilter('severity', e.target.value)} style={{ minWidth: '120px' }}>
            <option value="">All Severities</option>
            {['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.category ?? ''} onChange={e => setFilter('category', e.target.value as IssueCategory)} style={{ minWidth: '180px' }}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.resolution ?? ''} onChange={e => setFilter('resolution', e.target.value as ResolutionStatus)} style={{ minWidth: '160px' }}>
            <option value="">All Resolutions</option>
            {['Resolved', 'Partially Resolved', 'Unresolved'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filters.agent ?? ''} onChange={e => setFilter('agent', e.target.value)} style={{ minWidth: '150px' }}>
            <option value="">All Agents</option>
            {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filters.language ?? ''} onChange={e => setFilter('language', e.target.value)} style={{ minWidth: '140px' }}>
            <option value="">All Languages</option>
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          {Object.keys(filters).length > 0 && (
            <button className="btn-ghost" onClick={() => setFilters({})}>
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll-hint" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Severity</th>
                  <th>Lang</th>
                  <th>Category</th>
                  <th>Agent</th>
                  <th>Resolution</th>
                  <th>Score</th>
                  <th>Summary</th>
                  <th>Analyzed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading…</td></tr>
                ) : conversations.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No conversations match filters</td></tr>
                ) : (
                  conversations.map(c => (
                    <tr key={c.conversation_id} onClick={() => setSelected(c)}>
                      <td><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)' }}>{c.conversation_id}</span></td>
                      <td><span className={severityBadgeClass(c.severity)}>{c.severity}</span></td>
                      <td>
                        {c.language && (
                          <span style={{
                            fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 600,
                            padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.05em',
                            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                            color: 'var(--text-secondary)', textTransform: 'uppercase'
                          }}>
                            {c.language}
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-primary)', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.issue_category}</td>
                      <td>{c.agent_name}</td>
                      <td><span className={resolutionBadgeClass(c.resolution_status)}>{c.resolution_status}</span></td>
                      <td>
                        {c.agent_score != null ? (
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: scoreColor(c.agent_score), fontWeight: 600 }}>
                            {c.agent_score}/5
                          </span>
                        ) : (
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)' }}>bot</span>
                        )}
                      </td>
                      <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {truncate(c.summary, 70)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>
                        {formatDateTime(c.analyzed_at)}
                      </td>
                      <td>
                        <ChevronDown size={13} color="var(--text-muted)" style={{ transform: 'rotate(-90deg)' }} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && <ConversationDrawer conv={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
