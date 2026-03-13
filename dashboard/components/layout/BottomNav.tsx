'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, MessageSquare, Ticket, TrendingUp, FileText, Target } from 'lucide-react'

const navItems = [
  { href: '/',              label: 'Overview', icon: LayoutDashboard },
  { href: '/conversations', label: 'Convos',   icon: MessageSquare },
  { href: '/tickets',       label: 'Tickets',  icon: Ticket },
  { href: '/trends',        label: 'Trends',   icon: TrendingUp },
  { href: '/reports',       label: 'Reports',  icon: FileText },
  { href: '/accuracy',      label: 'Accuracy', icon: Target },
]

export default function BottomNav() {
  const raw = usePathname()
  const pathname = raw !== '/' && raw.endsWith('/') ? raw.slice(0, -1) : raw
  const [active, setActive] = useState(pathname)

  // Sync back once navigation settles (handles browser back/forward)
  useEffect(() => { setActive(pathname) }, [pathname])

  return (
    <nav className="bottom-nav">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => { setActive(href); window.scrollTo(0, 0) }}
          className={`bottom-nav-item${active === href ? ' bottom-nav-item--active' : ''}`}
        >
          <Icon size={20} />
          <span className="bottom-nav-item__label">{label}</span>
        </Link>
      ))}
    </nav>
  )
}
