import type { Metadata, Viewport } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import BottomNav from '@/components/layout/BottomNav'
import ScrollReset from '@/components/layout/ScrollReset'

export const metadata: Metadata = {
  title: 'Chat QA Dashboard',
  description: 'iGaming support quality assurance monitoring',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ScrollReset />
        <TopBar />
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
