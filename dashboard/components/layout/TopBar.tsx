'use client'

import { Zap } from 'lucide-react'

export default function TopBar() {
  return (
    <header className="top-bar">
      <div className="top-bar__logo">
        <div className="top-bar__logo-icon">
          <Zap size={16} color="#000" fill="#000" />
        </div>
        <span className="top-bar__logo-text">Chat QA</span>
      </div>
      <div className="top-bar__status">
        <div className="top-bar__pulse" />
        <span className="top-bar__status-text">n8n · Live</span>
      </div>
    </header>
  )
}
