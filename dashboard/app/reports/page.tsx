'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/data'
import type { MonthlyReport } from '@/lib/data/types'
import { formatDateTime } from '@/lib/utils'
import { CheckCircle, Clock, Eye, Download, FileText, X } from 'lucide-react'

function ReportPreviewModal({ report, onClose, onApprove }: {
  report: MonthlyReport
  onClose: () => void
  onApprove: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: '90vw', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={15} color="var(--accent)" />
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>
                Monthly QA Report — {new Date(report.month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Generated {formatDateTime(report.generated_at)} · {report.total_conversations} conversations
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {report.status === 'draft' && (
              <button className="btn-primary" onClick={onApprove}>
                Approve Report
              </button>
            )}
            <button
              onClick={() => {
                const blob = new Blob([report.report_html], { type: 'text/html' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `qa-report-${report.month}.html`; a.click()
                URL.revokeObjectURL(url)
              }}
              className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={12} /> Download
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
              <X size={16} />
            </button>
          </div>
        </div>
        {/* HTML preview */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <iframe
            srcDoc={report.report_html}
            style={{ width: '100%', height: '600px', border: 'none', background: '#fff' }}
            title={`Report ${report.month}`}
          />
        </div>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [reports, setReports] = useState<MonthlyReport[]>([])
  const [preview, setPreview] = useState<MonthlyReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.getReports().then(data => {
      setReports(data)
      setLoading(false)
    })
  }, [])

  async function handleApprove(month: string) {
    await db.approveReport(month)
    setReports(rs => rs.map(r => r.month === month ? { ...r, status: 'approved' } : r))
    if (preview?.month === month) setPreview(p => p ? { ...p, status: 'approved' } : null)
  }

  const drafts = reports.filter(r => r.status === 'draft')
  const approved = reports.filter(r => r.status === 'approved')

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Monthly Reports</h1>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {approved.length} approved · {drafts.length} draft
            </div>
          </div>
        </div>
      </div>

      <div className="page-content fade-up">
        {/* Draft reports alert */}
        {drafts.length > 0 && (
          <div style={{
            background: 'var(--accent-dim)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: '10px', padding: '14px 20px', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <Clock size={16} color="var(--accent)" />
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', color: 'var(--accent)' }}>
                {drafts.length} report{drafts.length !== 1 ? 's' : ''} awaiting your approval
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Review the draft{drafts.length !== 1 ? 's' : ''} below and click Approve to publish for distribution.
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
            Loading reports…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reports.map(r => {
              const monthLabel = new Date(r.month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
              const isDraft = r.status === 'draft'
              return (
                <div key={r.month} className="card" style={{ padding: '20px 24px' }}>
                  <div className="report-card-layout" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: 44, height: 44,
                        background: isDraft ? 'var(--accent-dim)' : 'var(--green-dim)',
                        border: `1px solid ${isDraft ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`,
                        borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isDraft
                          ? <Clock size={20} color="var(--accent)" />
                          : <CheckCircle size={20} color="var(--green)" />
                        }
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                          {monthLabel}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          {[
                            [`${r.total_conversations} conversations`],
                            [`${r.satisfaction_rate.toFixed(1)}% satisfaction`],
                            [`${(r.accuracy_rate * 100).toFixed(1)}% AI accuracy`],
                          ].map(([v]) => (
                            <span key={v} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-muted)' }}>
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className={`badge ${isDraft ? 'badge-amber' : 'badge-green'}`}>
                        {isDraft ? 'Draft' : 'Approved'}
                      </span>
                      <button
                        className="btn-ghost"
                        onClick={() => setPreview(r)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Eye size={12} /> Preview
                      </button>
                      {isDraft && (
                        <button className="btn-primary" onClick={() => handleApprove(r.month)}>
                          Approve
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Top issues mini */}
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {r.top_issues.slice(0, 5).map(issue => (
                      <div key={issue.category} style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        borderRadius: '5px', padding: '4px 10px',
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                        color: 'var(--text-secondary)'
                      }}>
                        {issue.category} <span style={{ color: 'var(--accent)' }}>{issue.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {preview && (
        <ReportPreviewModal
          report={preview}
          onClose={() => setPreview(null)}
          onApprove={() => handleApprove(preview.month)}
        />
      )}
    </>
  )
}
