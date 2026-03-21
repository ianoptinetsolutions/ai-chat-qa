'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, Unlock, Play, CheckCircle, XCircle, Eye, EyeOff, RefreshCw } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
type Status = { type: 'success' | 'error'; msg: string } | null

// ── Timezone data ─────────────────────────────────────────────────────────────
const TZ_GROUPS = [
  { label: 'Universal', zones: [{ display: 'UTC', iana: 'UTC', abbr: '+00:00' }] },
  { label: 'Americas', zones: [
    { display: 'New York',    iana: 'America/New_York',    abbr: 'EST/EDT' },
    { display: 'Chicago',     iana: 'America/Chicago',     abbr: 'CST/CDT' },
    { display: 'Denver',      iana: 'America/Denver',      abbr: 'MST/MDT' },
    { display: 'Los Angeles', iana: 'America/Los_Angeles', abbr: 'PST/PDT' },
    { display: 'São Paulo',   iana: 'America/Sao_Paulo',   abbr: 'BRT'     },
  ]},
  { label: 'Europe', zones: [
    { display: 'London',   iana: 'Europe/London',   abbr: 'GMT/BST'  },
    { display: 'Paris',    iana: 'Europe/Paris',    abbr: 'CET/CEST' },
    { display: 'Helsinki', iana: 'Europe/Helsinki', abbr: 'EET/EEST' },
  ]},
  { label: 'Middle East & Africa', zones: [
    { display: 'Dubai',         iana: 'Asia/Dubai',             abbr: 'GST'  },
    { display: 'Johannesburg',  iana: 'Africa/Johannesburg',    abbr: 'SAST' },
  ]},
  { label: 'Asia Pacific', zones: [
    { display: 'India',     iana: 'Asia/Kolkata',       abbr: 'IST'       },
    { display: 'Singapore', iana: 'Asia/Singapore',     abbr: 'SGT'       },
    { display: 'Tokyo',     iana: 'Asia/Tokyo',         abbr: 'JST'       },
    { display: 'Sydney',    iana: 'Australia/Sydney',   abbr: 'AEST/AEDT' },
  ]},
]

// ── Timezone conversion helpers ───────────────────────────────────────────────
function toUTC(localTime: string, iana: string): string {
  if (iana === 'UTC') return localTime
  const [h, m] = localTime.split(':').map(Number)
  // Build a date string in the target timezone, then read its UTC equivalent
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: iana }) // YYYY-MM-DD
  const localDate = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
  // localDate is parsed as local browser time, but we need it in the given tz.
  // Use Intl to get the offset of the target tz at that moment
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: iana, hour: 'numeric', minute: 'numeric', hour12: false,
  })
  const parts = formatter.formatToParts(localDate)
  const tzH = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const tzM = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  const diffMin = (h * 60 + m) - (tzH * 60 + tzM)
  const utcMin = ((h * 60 + m) + diffMin + 1440) % 1440
  return `${String(Math.floor(utcMin / 60)).padStart(2,'0')}:${String(utcMin % 60).padStart(2,'0')}`
}

function fromUTC(utcTime: string, iana: string): string {
  if (iana === 'UTC') return utcTime
  const [h, m] = utcTime.split(':').map(Number)
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'UTC' })
  const utcDate = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`)
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: iana, hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = formatter.formatToParts(utcDate)
  const lh = parts.find(p => p.type === 'hour')?.value ?? '00'
  const lm = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${lh}:${lm}`
}

// ── Custom Time Picker ────────────────────────────────────────────────────────
function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const [hStr, mStr] = value.split(':')
  const h24 = parseInt(hStr ?? '6')
  const displayH = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  const period = h24 < 12 ? 'am' : 'pm'
  const displayHStr = String(displayH).padStart(2, '0')

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function setHour(h: number) {
    const newH = String(h).padStart(2, '0')
    onChange(`${newH}:${mStr ?? '00'}`)
  }
  function setMin(m: string) {
    onChange(`${hStr ?? '06'}:${m}`)
  }
  function setPeriod(p: 'am' | 'pm') {
    let h = parseInt(hStr ?? '6')
    if (p === 'pm' && h < 12) h += 12
    if (p === 'am' && h >= 12) h -= 12
    onChange(`${String(h).padStart(2, '0')}:${mStr ?? '00'}`)
  }

  return (
    <div ref={ref} className="ic-custom-picker ic-time-picker" data-open={open ? 'true' : undefined}
      onClick={() => setOpen(o => !o)}>
      <div className="ic-picker-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <div className="ic-picker-display">
        {displayHStr}<span className="ic-colon">:</span>{mStr ?? '00'}<span className="ic-period">{period}</span>
      </div>
      <div className="ic-picker-chevron">
        <svg className="ic-chevron-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && (
        <div className="ic-picker-panel ic-time-panel" onClick={e => e.stopPropagation()}>
          {/* Hour column */}
          <div className="ic-picker-col">
            <div className="ic-picker-col-header">Hour</div>
            <div className="ic-picker-scroll">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => {
                const h24val = period === 'pm' ? (n === 12 ? 12 : n + 12) : (n === 12 ? 0 : n)
                const selected = h24val === h24
                return (
                  <div key={n} className={`ic-picker-item${selected ? ' ic-picker-item--selected' : ''}`}
                    onClick={() => setHour(h24val)}>
                    {String(n).padStart(2, '0')}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="ic-picker-col-divider" />
          {/* Minute column */}
          <div className="ic-picker-col">
            <div className="ic-picker-col-header">Min</div>
            <div className="ic-picker-scroll">
              {['00','15','30','45'].map(m => (
                <div key={m} className={`ic-picker-item${m === (mStr ?? '00') ? ' ic-picker-item--selected' : ''}`}
                  onClick={() => setMin(m)}>{m}</div>
              ))}
            </div>
          </div>
          <div className="ic-picker-col-divider" />
          {/* AM/PM column */}
          <div className="ic-picker-col ic-picker-col--period">
            <div className="ic-picker-col-header">·</div>
            {(['am','pm'] as const).map(p => (
              <div key={p} className={`ic-picker-item ic-picker-period${p === period ? ' ic-picker-item--selected' : ''}`}
                onClick={() => setPeriod(p)}>{p}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Custom Timezone Picker ────────────────────────────────────────────────────
function TimezonePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = TZ_GROUPS.flatMap(g => g.zones).find(z => z.iana === value)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <div ref={ref} className="ic-custom-picker ic-tz-picker" data-open={open ? 'true' : undefined}
      onClick={() => setOpen(o => !o)}>
      <div className="ic-picker-icon ic-tz-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </div>
      <div className="ic-picker-display ic-tz-display">{selected?.display ?? 'UTC'}</div>
      <div className="ic-picker-chevron ic-tz-chevron">
        <svg className="ic-chevron-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && (
        <div className="ic-picker-panel ic-tz-panel" onClick={e => e.stopPropagation()}>
          <div className="ic-tz-scroll">
            {TZ_GROUPS.map(group => (
              <div key={group.label}>
                <div className="ic-tz-group">{group.label}</div>
                {group.zones.map(zone => (
                  <div key={zone.iana}
                    className={`ic-tz-item${zone.iana === value ? ' ic-tz-item--selected' : ''}`}
                    onClick={() => { onChange(zone.iana); setOpen(false) }}>
                    <span className="ic-tz-name">{zone.display}</span>
                    <span className="ic-tz-abbr">{zone.abbr}</span>
                    {zone.iana === value && <span className="ic-tz-dot" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function IntercomControl() {
  const [unlocked, setUnlocked]     = useState(false)
  const [pin, setPin]               = useState('')
  const [showPin, setShowPin]       = useState(false)
  const [pinError, setPinError]     = useState(false)
  const [unlocking, setUnlocking]   = useState(false)
  const [scheduleTime, setScheduleTime] = useState('06:00')
  const [timezone, setTimezone]     = useState('UTC')
  const [saving, setSaving]         = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [status, setStatus]         = useState<Status>(null)
  const pinRef = useRef<HTMLInputElement>(null)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const savedTz = localStorage.getItem('intercom_timezone') ?? 'UTC'
    setTimezone(savedTz)
    const savedPin = sessionStorage.getItem('manager_pin')
    if (savedPin) { setPin(savedPin); setUnlocked(true); loadSchedule(savedTz) }
  }, [])

  function showStatusMsg(type: 'success' | 'error', msg: string) {
    setStatus({ type, msg })
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus(null), 4000)
  }

  async function loadSchedule(tz?: string) {
    try {
      const res = await fetch('/api/intercom/schedule')
      if (res.ok) {
        const data = await res.json()
        const utcTime = data.time ?? '06:00'
        const activeTz = tz ?? timezone
        setScheduleTime(fromUTC(utcTime, activeTz))
      }
    } catch { /* silent */ }
  }

  async function handleUnlock() {
    if (!pin.trim()) { pinRef.current?.focus(); return }
    setUnlocking(true); setPinError(false)
    try {
      const res = await fetch('/api/intercom/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) { setPinError(true); return }
      sessionStorage.setItem('manager_pin', pin)
      setUnlocked(true)
      await loadSchedule()
    } catch { setPinError(true) }
    finally { setUnlocking(false) }
  }

  function handleLock() {
    setUnlocked(false); setPin('')
    sessionStorage.removeItem('manager_pin')
  }

  async function handleSave() {
    setSaving(true)
    try {
      const utcTime = toUTC(scheduleTime, timezone)
      const res = await fetch('/api/intercom/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, time: utcTime }),
      })
      if (!res.ok) { showStatusMsg('error', 'Failed to save schedule'); return }
      localStorage.setItem('intercom_timezone', timezone)
      showStatusMsg('success', `Schedule saved — ${scheduleTime} ${timezone === 'UTC' ? 'UTC' : timezone.split('/').pop()?.replace('_',' ')}`)
    } catch { showStatusMsg('error', 'Network error') }
    finally { setSaving(false) }
  }

  async function handleTrigger() {
    setTriggering(true)
    try {
      const res = await fetch('/api/intercom/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) { showStatusMsg('error', 'Trigger failed'); return }
      showStatusMsg('success', 'Fetch triggered successfully')
    } catch { showStatusMsg('error', 'Network error') }
    finally { setTriggering(false) }
  }

  return (
    <>
      <style>{`
        /* ── Strip container ── */
        .ic-strip {
          position: relative;
          border-top: 1px solid rgba(255,255,255,0.04);
          background: var(--bg-surface);
          overflow: visible;
        }
        .ic-strip::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          pointer-events: none; z-index: 1;
        }
        .ic-strip.ic-locked::before  { background: linear-gradient(90deg, var(--accent) 0%, rgba(245,158,11,0.18) 60%, transparent 100%); }
        .ic-strip.ic-unlocked::before{ background: linear-gradient(90deg, var(--green)  0%, rgba(16,185,129,0.18)  60%, transparent 100%); }

        .ic-inner {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 22px; flex-wrap: wrap;
        }

        /* ── Icon ring ── */
        .ic-ring {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .ic-locked  .ic-ring { border: 1.5px solid rgba(245,158,11,0.4); background: rgba(245,158,11,0.08); }
        .ic-unlocked.ic-ring,
        .ic-unlocked .ic-ring { border: 1.5px solid rgba(16,185,129,0.4);  background: rgba(16,185,129,0.08); }

        /* ── Name + badge ── */
        .ic-name {
          font-family: 'Space Grotesk', sans-serif; font-weight: 600;
          font-size: 13px; white-space: nowrap; color: var(--text-primary);
        }
        .ic-badge {
          font-family: 'IBM Plex Mono', monospace; font-size: 9px;
          font-weight: 700; letter-spacing: 0.1em; border-radius: 4px;
          padding: 3px 7px; white-space: nowrap;
        }
        .ic-locked   .ic-badge { color: var(--accent); background: rgba(245,158,11,0.1);  border: 1px solid rgba(245,158,11,0.28); }
        .ic-unlocked .ic-badge { color: var(--green);  background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); }

        /* ── Divider ── */
        .ic-divider { width: 1px; height: 20px; background: var(--border); flex-shrink: 0; margin: 0 2px; }

        /* ── Field label ── */
        .ic-field-label {
          font-size: 10px; color: var(--text-secondary);
          font-family: 'IBM Plex Mono', monospace; white-space: nowrap;
        }

        /* ── Buttons ── */
        .ic-btn {
          height: 32px; border-radius: 6px; padding: 0 13px;
          font-size: 12px; line-height: 1; cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px;
          font-family: 'Space Grotesk', sans-serif; font-weight: 600;
          white-space: nowrap; transition: background 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }
        .ic-btn-unlock  { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.35); color: var(--accent); }
        .ic-btn-unlock:hover  { background: rgba(245,158,11,0.22); }
        .ic-btn-save    { background: rgba(245,158,11,0.1);  border: 1px solid rgba(245,158,11,0.3);  color: var(--accent); }
        .ic-btn-save:hover    { background: rgba(245,158,11,0.2); }
        .ic-btn-trigger { background: rgba(16,185,129,0.1);  border: 1px solid rgba(16,185,129,0.3);  color: var(--green); }
        .ic-btn-trigger:hover { background: rgba(16,185,129,0.2); }
        .ic-btn-lock    { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); margin-left: auto; }
        .ic-btn-lock:hover    { border-color: var(--border-bright); color: var(--text-primary); }
        .ic-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── PIN input ── */
        .ic-pin-wrap {
          display: inline-flex; align-items: stretch; height: 32px;
          border: 1px solid var(--border-bright); border-radius: 6px;
          background: var(--bg-base);
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .ic-pin-wrap:focus-within {
          border-color: rgba(245,158,11,0.45);
          box-shadow: 0 0 0 2.5px rgba(245,158,11,0.09);
        }
        .ic-pin-wrap.ic-pin-error { border-color: var(--critical); animation: ic-shake 0.35s ease; }
        .ic-pin-input {
          background: transparent; border: none; outline: none;
          font-family: 'IBM Plex Mono', monospace; font-size: 13px;
          color: var(--text-primary); padding: 0 10px; width: 148px;
        }
        .ic-pin-input::placeholder { color: var(--text-muted); }
        .ic-pin-eye {
          display: flex; align-items: center; padding: 0 9px;
          color: var(--text-muted); cursor: pointer; border: none;
          background: transparent; transition: color 0.15s;
        }
        .ic-pin-eye:hover { color: var(--text-secondary); }

        /* ── Custom pickers (shared) ── */
        .ic-custom-picker {
          position: relative; display: inline-flex; align-items: stretch;
          height: 32px; border: 1px solid var(--border-bright); border-radius: 6px;
          background: var(--bg-base); cursor: pointer; user-select: none;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .ic-time-picker:hover,
        .ic-time-picker[data-open] { border-color: rgba(16,185,129,0.5); }
        .ic-time-picker[data-open]  { box-shadow: 0 0 0 2.5px rgba(16,185,129,0.1); }
        .ic-tz-picker:hover,
        .ic-tz-picker[data-open]    { border-color: rgba(245,158,11,0.5); }
        .ic-tz-picker[data-open]    { box-shadow: 0 0 0 2.5px rgba(245,158,11,0.08); }

        .ic-picker-icon {
          display: flex; align-items: center; padding: 0 9px;
          border-right: 1px solid var(--border); border-radius: 5px 0 0 5px;
          pointer-events: none;
        }
        .ic-time-picker .ic-picker-icon { background: rgba(16,185,129,0.05); }
        .ic-tz-icon { background: rgba(245,158,11,0.04); }

        .ic-picker-display {
          display: flex; align-items: center; gap: 1px;
          padding: 0 8px;
          font-family: 'IBM Plex Mono', monospace; font-size: 13px;
          font-weight: 500; color: var(--text-primary); pointer-events: none;
        }
        .ic-tz-display { min-width: 82px; }
        .ic-colon  { color: var(--text-secondary); margin: 0 1px; }
        .ic-period { color: var(--text-secondary); font-size: 11px; margin-left: 5px; }

        .ic-picker-chevron {
          display: flex; align-items: center; padding: 0 8px 0 2px;
          pointer-events: none; transition: color 0.15s;
        }
        .ic-time-picker .ic-picker-chevron { color: var(--text-muted); }
        .ic-time-picker[data-open] .ic-picker-chevron { color: var(--green); }
        .ic-tz-picker   .ic-picker-chevron { color: var(--text-muted); }
        .ic-tz-picker[data-open]   .ic-picker-chevron { color: var(--accent); }

        .ic-chevron-svg {
          display: block; transition: transform 0.22s cubic-bezier(0.4,0,0.2,1);
          transform-origin: center;
        }
        .ic-custom-picker[data-open] .ic-chevron-svg { transform: rotate(180deg); }

        /* ── Time picker panel ── */
        .ic-picker-panel {
          position: absolute; top: calc(100% + 5px); left: 0;
          background: var(--bg-elevated); border: 1px solid var(--border-bright);
          border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,0.7);
          z-index: 9999;
        }
        .ic-time-panel { display: flex; min-width: 176px; }
        .ic-tz-panel   { min-width: 224px; }

        .ic-picker-col { display: flex; flex-direction: column; flex: 1; min-width: 50px; }
        .ic-picker-col--period { min-width: 40px; }
        .ic-picker-col-header {
          font-family: 'IBM Plex Mono', monospace; font-size: 9px;
          text-transform: uppercase; letter-spacing: 0.09em;
          color: var(--text-muted); padding: 8px 0 6px; text-align: center;
          border-bottom: 1px solid var(--border);
        }
        .ic-picker-col-divider { width: 1px; background: var(--border); flex-shrink: 0; }
        .ic-picker-scroll {
          max-height: 174px; overflow-y: auto;
          scrollbar-width: thin; scrollbar-color: var(--border-bright) transparent;
        }
        .ic-picker-scroll::-webkit-scrollbar { width: 3px; }
        .ic-picker-scroll::-webkit-scrollbar-thumb { background: var(--border-bright); border-radius: 2px; }

        .ic-picker-item {
          font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 500;
          color: var(--text-secondary); padding: 8px 0; text-align: center;
          cursor: pointer; transition: background 0.1s, color 0.1s;
        }
        .ic-picker-period { padding: 10px 0; font-size: 12px; font-weight: 600; }
        .ic-picker-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .ic-picker-item--selected { color: var(--green); background: rgba(16,185,129,0.1); font-weight: 700; }

        /* ── Timezone panel ── */
        .ic-tz-scroll {
          max-height: 240px; overflow-y: auto; padding: 4px 0;
          scrollbar-width: thin; scrollbar-color: var(--border-bright) transparent;
        }
        .ic-tz-scroll::-webkit-scrollbar { width: 3px; }
        .ic-tz-scroll::-webkit-scrollbar-thumb { background: var(--border-bright); border-radius: 2px; }

        .ic-tz-group {
          font-family: 'IBM Plex Mono', monospace; font-size: 9px;
          text-transform: uppercase; letter-spacing: 0.09em;
          color: var(--text-muted); padding: 10px 14px 5px;
        }
        .ic-tz-group:not(:first-child) { border-top: 1px solid var(--border); margin-top: 3px; }

        .ic-tz-item {
          display: flex; align-items: center; padding: 7px 14px 7px 18px;
          cursor: pointer; transition: background 0.1s;
        }
        .ic-tz-item:hover { background: var(--bg-hover); }
        .ic-tz-item:hover .ic-tz-name { color: var(--text-primary); }
        .ic-tz-item--selected { background: rgba(245,158,11,0.07); }
        .ic-tz-item--selected .ic-tz-name { color: var(--accent); }
        .ic-tz-item--selected .ic-tz-abbr { color: rgba(245,158,11,0.5); }

        .ic-tz-name { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--text-secondary); }
        .ic-tz-abbr { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--text-muted); margin-left: auto; padding-left: 10px; white-space: nowrap; }
        .ic-tz-dot  { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-left: 8px; }

        /* ── Status toast ── */
        .ic-status {
          display: flex; align-items: center; gap: 6px; padding: 7px 22px;
          font-family: 'IBM Plex Mono', monospace; font-size: 11px;
          border-top: 1px solid var(--border);
          animation: ic-fade-in 0.2s ease;
        }
        .ic-status-success { color: var(--green); background: rgba(16,185,129,0.06); }
        .ic-status-error   { color: var(--critical); background: rgba(244,63,94,0.06); }

        /* ── Wrapper divs (transparent on desktop) ── */
        .ic-meta, .ic-pin-row, .ic-schedule-row, .ic-action-row { display: contents; }

        /* ── Animations ── */
        @keyframes ic-shake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-4px); }
          40%,80% { transform: translateX(4px); }
        }
        @keyframes ic-fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Mobile layout ── */
        @media (max-width: 767px) {
          .ic-inner {
            flex-direction: column; align-items: stretch;
            gap: 8px; padding: 12px 14px;
          }
          .ic-meta {
            display: flex; align-items: center; gap: 8px; width: 100%;
          }
          .ic-divider { display: none; }
          .ic-field-label { display: none; }

          .ic-pin-row {
            display: flex; align-items: center; gap: 8px; width: 100%;
          }
          .ic-pin-wrap { flex: 1; }
          .ic-pin-input { width: 100%; min-width: 0; }

          .ic-schedule-row {
            display: flex; align-items: center; gap: 6px; width: 100%;
          }
          .ic-schedule-row .ic-custom-picker { flex: 1; min-width: 0; }

          .ic-action-row {
            display: flex; gap: 6px; width: 100%;
          }
          .ic-action-row .ic-btn {
            flex: 1; justify-content: center; margin-left: 0;
          }
        }
      `}</style>

      <div className={`ic-strip ${unlocked ? 'ic-unlocked' : 'ic-locked'}`}>
        <div className="ic-inner">

          {/* ── Identity row: ring + name + badge ── */}
          <div className="ic-meta">
            <div className="ic-ring">
              {unlocked
                ? <Unlock size={14} color="var(--green)"  strokeWidth={2} />
                : <Lock   size={14} color="var(--accent)" strokeWidth={2} />}
            </div>
            <span className="ic-name">Intercom Fetch Control</span>
            <span className="ic-badge">{unlocked ? 'UNLOCKED' : 'LOCKED'}</span>
          </div>

          <div className="ic-divider" />

          {/* ── LOCKED: PIN gate ── */}
          {!unlocked && (
            <div className="ic-pin-row">
              <div className={`ic-pin-wrap${pinError ? ' ic-pin-error' : ''}`}>
                <input
                  ref={pinRef}
                  className="ic-pin-input"
                  type={showPin ? 'text' : 'password'}
                  placeholder="Enter manager PIN"
                  value={pin}
                  onChange={e => { setPin(e.target.value); setPinError(false) }}
                  onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                />
                <button className="ic-pin-eye" onClick={() => setShowPin(s => !s)} type="button">
                  {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <button className="ic-btn ic-btn-unlock" onClick={handleUnlock} disabled={unlocking}>
                {unlocking
                  ? <RefreshCw size={14} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Unlock size={14} strokeWidth={2} />}
                Unlock
              </button>
            </div>
          )}

          {/* ── UNLOCKED: schedule controls ── */}
          {unlocked && (
            <>
              <div className="ic-schedule-row">
                <span className="ic-field-label">Fetch daily at</span>
                <TimePicker value={scheduleTime} onChange={setScheduleTime} />
                <TimezonePicker value={timezone} onChange={setTimezone} />
              </div>
              <div className="ic-action-row">
                <button className="ic-btn ic-btn-save" onClick={handleSave} disabled={saving}>
                  {saving
                    ? <RefreshCw size={14} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                    : <CheckCircle size={14} strokeWidth={2} />}
                  Save
                </button>
                <button className="ic-btn ic-btn-trigger" onClick={handleTrigger} disabled={triggering}>
                  {triggering
                    ? <RefreshCw size={14} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Play size={14} strokeWidth={2} />}
                  Trigger Now
                </button>
                <button className="ic-btn ic-btn-lock" onClick={handleLock}>
                  <Lock size={14} strokeWidth={2} />
                  Lock
                </button>
              </div>
            </>
          )}
        </div>

        {/* Status toast */}
        {status && (
          <div className={`ic-status ic-status-${status.type}`}>
            {status.type === 'success'
              ? <CheckCircle size={12} strokeWidth={2} />
              : <XCircle     size={12} strokeWidth={2} />}
            {status.msg}
          </div>
        )}
      </div>
    </>
  )
}
