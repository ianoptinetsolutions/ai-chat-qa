'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, Ticket, TrendingUp,
  FileText, Target, Zap
} from 'lucide-react'

const navItems = [
  { href: '/',               label: 'Overview',      icon: LayoutDashboard },
  { href: '/conversations',  label: 'Conversations', icon: MessageSquare },
  { href: '/tickets',        label: 'Tickets',       icon: Ticket },
  { href: '/trends',         label: 'Trends',        icon: TrendingUp },
  { href: '/reports',        label: 'Reports',       icon: FileText },
  { href: '/accuracy',       label: 'Accuracy',      icon: Target },
]

export default function Sidebar() {
  const rawPathname = usePathname()
  const pathname = rawPathname !== '/' && rawPathname.endsWith('/') ? rawPathname.slice(0, -1) : rawPathname

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '20px 18px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '18px' }}>
          <div style={{
            width: 32, height: 32,
            background: 'var(--accent)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Zap size={16} color="#000" fill="#000" />
          </div>
          <div>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em'
            }}>Chat QA</div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px',
              color: 'var(--text-muted)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}>iGaming Ops</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          padding: '0 8px 8px'
        }}>Navigation</div>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item${isActive ? ' active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 10px',
                borderRadius: '7px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-hover)' : 'transparent',
                textDecoration: 'none',
                fontSize: '13px',
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: '2px',
                transition: 'all 0.15s',
              }}
            >
              <Icon
                size={15}
                color={isActive ? 'var(--accent)' : 'var(--text-muted)'}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '14px 18px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--green)',
            boxShadow: '0 0 6px var(--green)',
            flexShrink: 0
          }} />
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--text-secondary)' }}>
              n8n · Live
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'var(--text-muted)' }}>
              06:00 UTC daily
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
