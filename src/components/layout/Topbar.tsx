'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT,
  PORTAL_ACCESS_PENDING_COUNT_CHANGED_EVENT,
} from '@/lib/access-request-events'

interface SecurityNotification {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  href: string
  count: number
}

const PAGE_META = [
  { match: (pathname: string) => pathname === '/', title: 'Dashboard', subtitle: 'Monitor system health, activity, and connected VPN sessions.' },
  { match: (pathname: string) => pathname.startsWith('/users'), title: 'Users', subtitle: 'Manage VPN users, certificates, and account status.' },
  { match: (pathname: string) => pathname.startsWith('/groups'), title: 'Groups', subtitle: 'Control group membership and network access policy.' },
  { match: (pathname: string) => pathname.startsWith('/servers'), title: 'Servers', subtitle: 'Review server status, logs, imports, and live connections.' },
  { match: (pathname: string) => pathname.startsWith('/access-requests'), title: 'VPN Requests', subtitle: 'Approve or reject requests for VPN access.' },
  { match: (pathname: string) => pathname.startsWith('/analytics'), title: 'Analytics', subtitle: 'Review operational trends, admin activity, and AccessCore insights.' },
  { match: (pathname: string) => pathname.startsWith('/admin/settings'), title: 'Settings', subtitle: 'Configure AccessCore defaults, sessions, and integrations.' },
  { match: (pathname: string) => pathname.startsWith('/admin'), title: 'Portal Access', subtitle: 'Manage who can sign in to the portal.' },
  { match: (pathname: string) => pathname.startsWith('/my-access'), title: 'My VPN', subtitle: 'Download configs and review your assigned VPN access.' },
  { match: (pathname: string) => pathname.startsWith('/request-access'), title: 'Request Access', subtitle: 'Request new VPN access for servers and groups.' },
  { match: (pathname: string) => pathname.startsWith('/sync'), title: 'Sync', subtitle: 'Run and inspect directory sync jobs.' },
  { match: (pathname: string) => pathname.startsWith('/flagged'), title: 'Flags', subtitle: 'Review users that need manual attention.' },
  { match: (pathname: string) => pathname.startsWith('/audit'), title: 'Audit Log', subtitle: 'Track administrative activity and system events.' },
  { match: (pathname: string) => pathname.startsWith('/profile'), title: 'Profile', subtitle: 'Manage your AccessCore account and login history.' },
]

export default function Topbar({
  onSearchOpen,
  onNavOpen,
  isMobile,
}: {
  onSearchOpen: () => void
  onNavOpen: () => void
  isMobile: boolean
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const [notifications, setNotifications] = useState<SecurityNotification[]>([])
  const meta = PAGE_META.find((item) => item.match(pathname)) ?? {
    title: 'AccessCore',
    subtitle: 'Manage VPN access, infrastructure, and the AccessCore operations workspace.',
  }
  const isAdmin = ((session?.user as Record<string, unknown> | undefined)?.role as string | undefined) === 'ADMIN'

  useEffect(() => {
    if (!isAdmin) return

    const fetchNotifications = () => {
      fetch('/api/notifications')
        .then((response) => response.json())
        .then((data) => {
          setNotificationCount(Number(data.count) || 0)
          setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
        })
        .catch(() => {})
    }

    fetchNotifications()
    window.addEventListener(ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT, fetchNotifications)
    window.addEventListener(PORTAL_ACCESS_PENDING_COUNT_CHANGED_EVENT, fetchNotifications)
    const interval = setInterval(fetchNotifications, 30000)

    return () => {
      clearInterval(interval)
      window.removeEventListener(ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT, fetchNotifications)
      window.removeEventListener(PORTAL_ACCESS_PENDING_COUNT_CHANGED_EVENT, fetchNotifications)
    }
  }, [isAdmin])

  useEffect(() => {
    setNotificationsOpen(false)
  }, [pathname])

  const openNotifications = () => {
    const next = !notificationsOpen
    setNotificationsOpen(next)
    if (next) {
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'viewed' }),
      }).catch(() => {})
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {isMobile && (
          <button
            onClick={onNavOpen}
            aria-label="Open navigation"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'rgba(18,18,18,0.92)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <MenuIcon />
          </button>
        )}
        <div>
          <h1 style={{ fontSize: isMobile ? '22px' : '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>{meta.title}</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px 0 0', maxWidth: '680px', lineHeight: 1.5 }}>{meta.subtitle}</p>
        </div>
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '10px', width: isMobile ? '100%' : 'auto', position: 'relative' }}>
          <button
            onClick={onSearchOpen}
            style={{
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? undefined : '220px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'rgba(18,18,18,0.92)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 500 }}>
              <SearchIcon />
              Search or jump...
            </span>
            {!isMobile && (
              <kbd style={{
                padding: '2px 6px',
                borderRadius: '6px',
                border: '1px solid var(--border-hover)',
                background: 'rgba(255,255,255,0.03)',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}>
                ⌘K
              </kbd>
            )}
          </button>
          <button
            onClick={openNotifications}
            aria-label="Open security notifications"
            style={{
              position: 'relative',
              width: '44px',
              minWidth: '44px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: notificationsOpen ? 'rgba(234,126,32,0.12)' : 'rgba(18,18,18,0.92)',
              color: notificationsOpen ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <BellIcon />
            {notificationCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                minWidth: '18px',
                height: '18px',
                borderRadius: '999px',
                background: '#EF4444',
                color: '#FFFFFF',
                fontSize: '10px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px',
              }}>
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 80 }} onClick={() => setNotificationsOpen(false)} />
              <div style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                width: isMobile ? 'min(360px, calc(100vw - 32px))' : '380px',
                maxHeight: '520px',
                overflowY: 'auto',
                padding: '8px',
                borderRadius: '18px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(18,18,18,0.98)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                zIndex: 90,
              }}>
                <div style={{ padding: '8px 10px 10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Security Ops</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>Actionable alerts across access, certs, sync, and DNS.</div>
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '18px 10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    No active security notifications.
                  </div>
                ) : notifications.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setNotificationsOpen(false)}
                    style={{
                      display: 'block',
                      padding: '11px 12px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.025)',
                      color: 'inherit',
                      textDecoration: 'none',
                      marginBottom: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 800 }}>{item.title}</span>
                      <span style={{ fontSize: '10px', color: severityColor(item.severity), textTransform: 'uppercase', fontWeight: 900 }}>{item.severity}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '6px' }}>{item.message}</div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function severityColor(severity: SecurityNotification['severity']) {
  if (severity === 'critical') return '#EF4444'
  if (severity === 'warning') return '#F59E0B'
  return '#60A5FA'
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
