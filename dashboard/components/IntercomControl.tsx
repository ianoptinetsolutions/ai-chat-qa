'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, Unlock, Clock, Play, CheckCircle, XCircle, RefreshCw, Eye, EyeOff, ShieldAlert } from 'lucide-react'

type Status = { type: 'success' | 'error'; msg: string } | null

export default function IntercomControl() {
  const [unlocked, setUnlocked]       = useState(false)
  const [pin, setPin]                 = useState('')
  const [showPin, setShowPin]         = useState(false)
  const [pinError, setPinError]       = useState(false)
  const [unlocking, setUnlocking]     = useState(false)

  const [scheduleTime, setScheduleTime] = useState('06:00')
  const [saving, setSaving]           = useState(false)
  const [triggering, setTriggering]   = useState(false)
  const [status, setStatus]           = useState<Status>(null)
  const [scanLine, setScanLine]       = useState(false)

  const pinRef = useRef<HTMLInputElement>(null)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('manager_pin')
    if (saved) {
      setPin(saved)
      setUnlocked(true)
      loadSchedule()
    }
  }, [])

  function showStatus(type: 'success' | 'error', msg: string) {
    setStatus({ type, msg })
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus(null), 4000)
  }

  async function loadSchedule() {
    try {
      const res = await fetch('/api/intercom/schedule')
      if (res.ok) {
        const data = await res.json()
        setScheduleTime(data.time ?? '06:00')
      }
    } catch { /* silent */ }
  }

  async function handleUnlock() {
    if (!pin.trim()) { pinRef.current?.focus(); return }
    setUnlocking(true)
    setPinError(false)
    setScanLine(true)
    try {
      const res = await fetch('/api/intercom/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) {
        setPinError(true)
        setUnlocking(false)
        setScanLine(false)
        return
      }
      sessionStorage.setItem('manager_pin', pin)
      setUnlocked(true)
      await loadSchedule()
    } catch {
      setPinError(true)
      setScanLine(false)
    } finally {
      setUnlocking(false)
    }
  }

  function handleLock() {
    setUnlocked(false)
    setPin('')
    setScanLine(false)
    sessionStorage.removeItem('manager_pin')
    setStatus(null)
  }

  async function apiPost(url: string, body: object): Promise<{ ok: boolean; msg: string }> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      let data: Record<string, unknown> = {}
      const text = await res.text()
      try { data = JSON.parse(text) } catch { /* HTML error page */ }
      if (!res.ok) {
        return { ok: false, msg: (data.error as string) ?? `Server error ${res.status}` }
      }
      return { ok: true, msg: (data as Record<string, unknown>).executionId
        ? `Started — execution #${data.executionId}`
        : '' }
    } catch (e) {
      return { ok: false, msg: `Network error: ${e}` }
    }
  }

  async function handleSaveSchedule() {
    setSaving(true)
    setStatus(null)
    const { ok, msg } = await apiPost('/api/intercom/schedule', { pin, time: scheduleTime })
    if (ok) {
      showStatus('success', `Schedule updated — WF1 will run daily at ${scheduleTime} UTC`)
    } else {
      showStatus('error', msg)
    }
    setSaving(false)
  }

  async function handleTriggerNow() {
    setTriggering(true)
    setStatus(null)
    const { ok, msg } = await apiPost('/api/intercom/trigger', { pin })
    if (ok) {
      showStatus('success', msg || 'Fetch triggered successfully')
    } else {
      showStatus('error', msg)
    }
    setTriggering(false)
  }

  return (
    <div className="ic-wrap">
      {/* Top stripe accent */}
      <div className="ic-stripe" />

      {/* Header row */}
      <div className="ic-header">
        <div className="ic-header-left">
          <div className={`ic-icon-ring ${unlocked ? 'ic-icon-ring--open' : ''}`}>
            {unlocked
              ? <Unlock size={14} className="ic-icon" />
              : <Lock size={14} className="ic-icon" />
            }
          </div>
          <span className="ic-title">Intercom Fetch Control</span>
          <span className={`ic-badge ${unlocked ? 'ic-badge--open' : 'ic-badge--locked'}`}>
            {unlocked ? 'Manager' : 'Locked'}
          </span>
        </div>

        {unlocked && (
          <button className="ic-lock-btn" onClick={handleLock}>
            <ShieldAlert size={11} />
            Lock
          </button>
        )}
      </div>

      {/* PIN Gate */}
      {!unlocked && (
        <div className={`ic-pin-zone ${pinError ? 'ic-pin-zone--error' : ''} ${scanLine ? 'ic-pin-zone--scanning' : ''}`}>
          <div className="ic-pin-label">AUTHENTICATION REQUIRED</div>
          <div className="ic-pin-row">
            <div className="ic-pin-field-wrap">
              <input
                ref={pinRef}
                type={showPin ? 'text' : 'password'}
                placeholder="Enter manager PIN"
                value={pin}
                onChange={e => { setPin(e.target.value); setPinError(false) }}
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                className={`ic-pin-input ${pinError ? 'ic-pin-input--error' : ''}`}
              />
              <button className="ic-pin-eye" onClick={() => setShowPin(v => !v)}>
                {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>

            <button
              onClick={handleUnlock}
              disabled={unlocking}
              className="ic-unlock-btn"
            >
              {unlocking
                ? <><RefreshCw size={12} className="ic-spin" /> Verifying…</>
                : <><Lock size={12} /> Unlock</>
              }
            </button>
          </div>

          {pinError && (
            <div className="ic-pin-error">
              <XCircle size={11} />
              Invalid PIN — access denied
            </div>
          )}
        </div>
      )}

      {/* Controls (unlocked) */}
      {unlocked && (
        <div className="ic-controls">
          {/* Schedule */}
          <div className="ic-control-group">
            <div className="ic-control-label">
              <Clock size={9} />
              Daily Fetch Time (UTC)
            </div>
            <div className="ic-control-row">
              <input
                type="time"
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
                className="ic-time-input"
              />
              <button
                onClick={handleSaveSchedule}
                disabled={saving}
                className="ic-save-btn"
              >
                {saving
                  ? <><RefreshCw size={11} className="ic-spin" /> Saving…</>
                  : 'Save Schedule'
                }
              </button>
            </div>
          </div>

          <div className="ic-divider" />

          {/* Trigger */}
          <div className="ic-control-group">
            <div className="ic-control-label">
              <Play size={9} />
              Manual Trigger
            </div>
            <button
              onClick={handleTriggerNow}
              disabled={triggering}
              className={`ic-trigger-btn ${triggering ? 'ic-trigger-btn--running' : ''}`}
            >
              {triggering
                ? <><RefreshCw size={12} className="ic-spin" /> Running…</>
                : <><Play size={12} fill="var(--green)" /> Fetch Now</>
              }
            </button>
          </div>

          {/* Status */}
          {status && (
            <div className={`ic-status ic-status--${status.type}`}>
              {status.type === 'success'
                ? <CheckCircle size={12} />
                : <XCircle size={12} />
              }
              <span>{status.msg}</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        /* ── Container ── */
        .ic-wrap {
          position: relative;
          background: var(--bg-elevated);
          border: 1px solid var(--border-bright);
          border-radius: 10px;
          overflow: hidden;
          padding: 0 20px 18px;
          transition: border-color 0.3s;
        }
        .ic-wrap:hover {
          border-color: rgba(245,158,11,0.25);
        }

        /* ── Top stripe ── */
        .ic-stripe {
          height: 2px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(245,158,11,0.6) 30%,
            rgba(245,158,11,0.9) 50%,
            rgba(245,158,11,0.6) 70%,
            transparent 100%
          );
          margin: 0 -20px 16px;
        }

        /* ── Header ── */
        .ic-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .ic-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ic-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: -0.01em;
          color: var(--text-primary);
        }

        /* ── Lock icon ring ── */
        .ic-icon-ring {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.3);
          box-shadow: 0 0 8px rgba(245,158,11,0.15), inset 0 0 6px rgba(245,158,11,0.06);
          transition: background 0.4s, border-color 0.4s, box-shadow 0.4s;
          animation: ic-pulse-amber 2.4s ease-in-out infinite;
        }
        .ic-icon-ring--open {
          background: rgba(16,185,129,0.1);
          border-color: rgba(16,185,129,0.35);
          box-shadow: 0 0 8px rgba(16,185,129,0.2), inset 0 0 6px rgba(16,185,129,0.06);
          animation: ic-pulse-green 3s ease-in-out infinite;
        }
        .ic-icon {
          color: var(--accent);
          transition: color 0.4s;
        }
        .ic-icon-ring--open .ic-icon {
          color: var(--green);
        }

        /* ── Badge ── */
        .ic-badge {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 2px 7px;
          border-radius: 4px;
          transition: all 0.3s;
        }
        .ic-badge--locked {
          background: rgba(245,158,11,0.1);
          color: var(--accent);
          border: 1px solid rgba(245,158,11,0.22);
        }
        .ic-badge--open {
          background: rgba(16,185,129,0.1);
          color: var(--green);
          border: 1px solid rgba(16,185,129,0.25);
        }

        /* ── Lock button ── */
        .ic-lock-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: none;
          border: 1px solid var(--border);
          cursor: pointer;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          color: var(--text-muted);
          padding: 3px 9px;
          border-radius: 5px;
          transition: color 0.15s, border-color 0.15s;
        }
        .ic-lock-btn:hover {
          color: var(--critical);
          border-color: rgba(244,63,94,0.35);
        }

        /* ── PIN zone ── */
        .ic-pin-zone {
          position: relative;
          background: rgba(19,23,32,0.7);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 14px 16px 14px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .ic-pin-zone--error {
          border-color: rgba(244,63,94,0.4);
          box-shadow: 0 0 12px rgba(244,63,94,0.08);
        }
        .ic-pin-zone--scanning::after {
          content: '';
          position: absolute;
          top: -4px; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          animation: ic-scan 0.8s ease-in-out forwards;
        }

        .ic-pin-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          color: var(--text-muted);
          margin-bottom: 10px;
        }
        .ic-pin-row {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .ic-pin-field-wrap {
          position: relative;
          flex: 0 0 auto;
        }
        .ic-pin-input {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          padding: 8px 34px 8px 12px;
          border: 1px solid var(--border-bright);
          border-radius: 6px;
          background: var(--bg-base);
          color: var(--text-primary);
          outline: none;
          width: 210px;
          letter-spacing: 0.05em;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ic-pin-input:focus {
          border-color: rgba(245,158,11,0.5);
          box-shadow: 0 0 0 2px rgba(245,158,11,0.08);
        }
        .ic-pin-input--error {
          border-color: rgba(244,63,94,0.5) !important;
          box-shadow: 0 0 0 2px rgba(244,63,94,0.08) !important;
        }
        .ic-pin-eye {
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          padding: 2px;
          line-height: 0;
          transition: color 0.15s;
        }
        .ic-pin-eye:hover { color: var(--text-secondary); }

        /* ── Unlock button ── */
        .ic-unlock-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          font-size: 12px;
          padding: 8px 18px;
          border-radius: 6px;
          border: 1px solid rgba(245,158,11,0.45);
          background: rgba(245,158,11,0.1);
          color: var(--accent);
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
          position: relative;
          overflow: hidden;
        }
        .ic-unlock-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(245,158,11,0.12) 50%, transparent 60%);
          transform: translateX(-100%);
          transition: transform 0.5s;
        }
        .ic-unlock-btn:hover::before { transform: translateX(100%); }
        .ic-unlock-btn:hover {
          background: rgba(245,158,11,0.16);
          box-shadow: 0 0 14px rgba(245,158,11,0.18);
        }
        .ic-unlock-btn:active { transform: scale(0.98); }
        .ic-unlock-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ic-unlock-btn:disabled::before { display: none; }

        .ic-pin-error {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 10px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: var(--critical);
          animation: ic-shake 0.35s ease;
        }

        /* ── Unlocked controls ── */
        .ic-controls {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          align-items: flex-end;
        }
        .ic-control-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .ic-control-label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .ic-control-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .ic-time-input {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          padding: 7px 12px;
          border: 1px solid var(--border-bright);
          border-radius: 6px;
          background: var(--bg-base);
          color: var(--text-primary);
          outline: none;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ic-time-input:focus {
          border-color: rgba(245,158,11,0.45);
          box-shadow: 0 0 0 2px rgba(245,158,11,0.07);
        }

        /* ── Save button ── */
        .ic-save-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          font-size: 12px;
          padding: 7px 14px;
          border-radius: 6px;
          border: 1px solid rgba(245,158,11,0.35);
          background: rgba(245,158,11,0.08);
          color: var(--accent);
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .ic-save-btn:hover {
          background: rgba(245,158,11,0.14);
          box-shadow: 0 0 10px rgba(245,158,11,0.12);
        }
        .ic-save-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ── Divider ── */
        .ic-divider {
          width: 1px;
          height: 42px;
          background: linear-gradient(to bottom, transparent, var(--border-bright), transparent);
          align-self: flex-end;
          margin-bottom: 4px;
        }

        /* ── Trigger button ── */
        .ic-trigger-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          font-size: 12px;
          padding: 7px 16px;
          border-radius: 6px;
          border: 1px solid rgba(16,185,129,0.3);
          background: rgba(16,185,129,0.08);
          color: var(--green);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
        }
        .ic-trigger-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(16,185,129,0.14) 50%, transparent 60%);
          transform: translateX(-100%);
          transition: transform 0.5s;
        }
        .ic-trigger-btn:hover::before { transform: translateX(100%); }
        .ic-trigger-btn:hover {
          background: rgba(16,185,129,0.14);
          box-shadow: 0 0 14px rgba(16,185,129,0.18);
        }
        .ic-trigger-btn:active { transform: scale(0.98); }
        .ic-trigger-btn--running {
          background: var(--bg-elevated);
          color: var(--text-muted);
          border-color: var(--border);
          cursor: not-allowed;
        }
        .ic-trigger-btn--running::before { display: none; }
        .ic-trigger-btn:disabled { cursor: not-allowed; }

        /* ── Status toast ── */
        .ic-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          padding: 5px 10px;
          border-radius: 5px;
          align-self: flex-end;
          margin-bottom: 2px;
          animation: ic-fade-in 0.2s ease;
        }
        .ic-status--success {
          color: var(--green);
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
        }
        .ic-status--error {
          color: var(--critical);
          background: rgba(244,63,94,0.08);
          border: 1px solid rgba(244,63,94,0.2);
        }

        /* ── Animations ── */
        @keyframes spin { to { transform: rotate(360deg); } }
        .ic-spin { animation: spin 0.9s linear infinite; }

        @keyframes ic-pulse-amber {
          0%, 100% { box-shadow: 0 0 6px rgba(245,158,11,0.12), inset 0 0 4px rgba(245,158,11,0.04); }
          50%       { box-shadow: 0 0 14px rgba(245,158,11,0.28), inset 0 0 8px rgba(245,158,11,0.1); }
        }
        @keyframes ic-pulse-green {
          0%, 100% { box-shadow: 0 0 6px rgba(16,185,129,0.15), inset 0 0 4px rgba(16,185,129,0.05); }
          50%       { box-shadow: 0 0 16px rgba(16,185,129,0.32), inset 0 0 8px rgba(16,185,129,0.12); }
        }
        @keyframes ic-scan {
          0%   { top: 0%; opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes ic-shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-4px); }
          40%       { transform: translateX(4px); }
          60%       { transform: translateX(-3px); }
          80%       { transform: translateX(3px); }
        }
        @keyframes ic-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
