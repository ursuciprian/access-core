'use client'

import Providers from './providers'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import ApprovalGate from '@/components/layout/ApprovalGate'
import { ToastProvider } from '@/components/ui/ToastProvider'
import SearchOverlay from '@/components/layout/SearchOverlay'
import { useState, useEffect } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('sidebar:collapsed')
    setSidebarCollapsed(saved === 'true')
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)')
    const sync = () => {
      setIsMobile(media.matches)
      if (!media.matches) {
        setMobileNavOpen(false)
      }
    }

    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    fetch('/api/system/status')
      .then((response) => response.json())
      .then((data) => {
        setMaintenanceMode(Boolean((data as Record<string, unknown>).maintenanceMode))
      })
      .catch(() => {
        setMaintenanceMode(false)
      })

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ maintenanceMode?: boolean }>
      setMaintenanceMode(Boolean(customEvent.detail?.maintenanceMode))
    }

    window.addEventListener('settings:updated', handler)
    return () => window.removeEventListener('settings:updated', handler)
  }, [])

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current
      window.localStorage.setItem('sidebar:collapsed', String(next))
      return next
    })
  }

  return (
    <Providers>
      <ApprovalGate>
        <ToastProvider>
          <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebar}
              mobile={isMobile}
              mobileOpen={mobileNavOpen}
              onCloseMobile={() => setMobileNavOpen(false)}
            />
            <main
              style={{
                marginLeft: isMobile ? 0 : sidebarCollapsed ? '104px' : '272px',
                padding: isMobile ? '16px' : '24px',
                minHeight: '100vh',
                transition: 'margin-left 160ms ease',
              }}
            >
              <div style={{ width: '100%', maxWidth: '1360px', margin: '0 auto' }}>
                <Topbar
                  onSearchOpen={() => setSearchOpen(true)}
                  onNavOpen={() => setMobileNavOpen(true)}
                  isMobile={isMobile}
                />
                {maintenanceMode && (
                  <div style={{
                    marginBottom: '20px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(245,158,11,0.28)',
                    background: 'rgba(245,158,11,0.12)',
                    color: '#FBBF24',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}>
                    Maintenance mode is enabled. Expect configuration changes and temporary instability.
                  </div>
                )}
                {children}
              </div>
            </main>
            <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
          </div>
        </ToastProvider>
      </ApprovalGate>
    </Providers>
  )
}
