'use client'

import type { CSSProperties, ReactNode } from 'react'
import {
  Activity,
  DoorOpen,
  Key,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import {
  ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT,
  PORTAL_ACCESS_PENDING_COUNT_CHANGED_EVENT,
} from '@/lib/access-request-events'

type NavItemConfig = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  badgeKey?: 'accessRequests' | 'portalUsers'
  isActive?: (pathname: string) => boolean
}

const viewerNav: NavItemConfig[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/my-access', label: 'My VPN', icon: ShieldCheck, exact: true },
  { href: '/request-access', label: 'Request Access', icon: Key, exact: true },
]

const adminOperationsNav: NavItemConfig[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  {
    href: '/analytics',
    label: 'Activity',
    icon: Activity,
    isActive: (pathname: string) =>
      pathname.startsWith('/analytics')
      || pathname.startsWith('/sync')
      || pathname.startsWith('/flagged')
      || pathname.startsWith('/audit'),
  },
]

const adminSections: Array<{
  key: string
  label: string
  items: NavItemConfig[]
}> = [
  {
    key: 'access',
    label: 'Access',
    items: [
      { href: '/access-requests', label: 'VPN Requests', icon: Key, badgeKey: 'accessRequests' },
      { href: '/users', label: 'Users', icon: Users },
      { href: '/groups', label: 'Groups', icon: Layers },
      { href: '/admin', label: 'Portal Access', icon: DoorOpen, exact: true, badgeKey: 'portalUsers' },
    ],
  },
  {
    key: 'infrastructure',
    label: 'Infrastructure',
    items: [
      { href: '/servers', label: 'Servers', icon: Server },
    ],
  },
]

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobile = false,
  mobileOpen = false,
  onCloseMobile,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  mobile?: boolean
  mobileOpen?: boolean
  onCloseMobile?: () => void
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [profileOpen, setProfileOpen] = useState(false)
  const [pendingCounts, setPendingCounts] = useState({
    accessRequests: 0,
    portalUsers: 0,
  })

  const userEmail = session?.user?.email ?? ''
  const userRole = ((session?.user as Record<string, unknown>)?.role as string | undefined) ?? 'VIEWER'
  const initial = (userEmail || 'U')[0].toUpperCase()
  const effectiveCollapsed = mobile ? false : collapsed

  useEffect(() => {
    if (userRole !== 'ADMIN') return

    const fetchCount = () => {
      Promise.all([
        fetch('/api/access-requests/pending-count').then((response) => response.json()),
        fetch('/api/admin/users/pending-count').then((response) => response.json()),
      ])
        .then(([accessRequests, portalUsers]) => {
          setPendingCounts({
            accessRequests: accessRequests.count || 0,
            portalUsers: portalUsers.count || 0,
          })
        })
        .catch(() => {})
    }

    fetchCount()
    window.addEventListener(ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT, fetchCount)
    window.addEventListener(PORTAL_ACCESS_PENDING_COUNT_CHANGED_EVENT, fetchCount)
    const interval = setInterval(fetchCount, 30000)
    return () => {
      clearInterval(interval)
      window.removeEventListener(ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT, fetchCount)
      window.removeEventListener(PORTAL_ACCESS_PENDING_COUNT_CHANGED_EVENT, fetchCount)
    }
  }, [userRole])

  useEffect(() => {
    if (!mobile || !mobileOpen) return
    setProfileOpen(false)
    onCloseMobile?.()
  }, [pathname, mobile, mobileOpen, onCloseMobile])

  const closeOrCollapseLabel = mobile ? 'Close navigation' : effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'

  const nav = (
    <nav
      style={{
        position: 'fixed',
        left: mobile ? '12px' : '8px',
        top: mobile ? '12px' : '8px',
        bottom: mobile ? '12px' : '8px',
        width: mobile ? 'min(320px, calc(100vw - 24px))' : effectiveCollapsed ? '84px' : '256px',
        background: 'linear-gradient(180deg, rgba(9,9,11,0.97) 0%, rgba(5,5,5,0.99) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '28px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
        padding: effectiveCollapsed ? '14px 10px' : '16px 14px 14px',
        zIndex: 40,
        transition: mobile
          ? 'transform 180ms ease, opacity 180ms ease'
          : 'width 160ms ease, padding 160ms ease',
        transform: mobile ? (mobileOpen ? 'translateX(0)' : 'translateX(calc(-100% - 24px))') : 'none',
        opacity: mobile ? (mobileOpen ? 1 : 0) : 1,
        pointerEvents: mobile ? (mobileOpen ? 'auto' : 'none') : 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: effectiveCollapsed ? 'center' : 'space-between', gap: '10px', marginBottom: '12px' }}>
        <Link
          href="/"
          onClick={() => mobile && onCloseMobile?.()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            color: 'inherit',
            minWidth: 0,
          }}
        >
          <LogoMark />
          {!effectiveCollapsed && (
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '19px',
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                  fontFamily: 'var(--font-display)',
                }}
              >
                AccessCore
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginTop: '3px',
                  letterSpacing: '0.01em',
                  fontWeight: 600,
                }}
              >
                Management portal
              </div>
            </div>
          )}
        </Link>
        <button
          onClick={mobile ? onCloseMobile : onToggleCollapse}
          title={closeOrCollapseLabel}
          aria-label={closeOrCollapseLabel}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(18,18,18,0.92)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {mobile ? <CloseIcon /> : <SidebarToggleIcon collapsed={effectiveCollapsed} />}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, overflowY: 'auto', paddingRight: effectiveCollapsed ? 0 : '2px' }}>
        {userRole === 'ADMIN' ? (
          <>
            {!effectiveCollapsed && <SectionLabel label="Operations" />}
            {adminOperationsNav.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<item.icon size={18} strokeWidth={1.85} />}
                active={item.isActive ? item.isActive(pathname) : isActive(pathname, item.href, Boolean(item.exact))}
                collapsed={effectiveCollapsed}
                onNavigate={mobile ? onCloseMobile : undefined}
              />
            ))}

            {adminSections.map((section) => (
              <div key={section.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {!effectiveCollapsed && <SectionLabel label={section.label} />}
                {section.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={<item.icon size={18} strokeWidth={1.85} />}
                    active={isActive(pathname, item.href, Boolean(item.exact))}
                    collapsed={effectiveCollapsed}
                    badge={item.badgeKey ? pendingCounts[item.badgeKey] : undefined}
                    onNavigate={mobile ? onCloseMobile : undefined}
                  />
                ))}
              </div>
            ))}
          </>
        ) : (
          <>
            {!effectiveCollapsed && <SectionLabel label="Operations" />}
            {viewerNav.map((item) => (
              item.href === '/' ? (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={<item.icon size={18} strokeWidth={1.85} />}
                  active={isActive(pathname, item.href, Boolean(item.exact))}
                  collapsed={effectiveCollapsed}
                  onNavigate={mobile ? onCloseMobile : undefined}
                />
              ) : null
            ))}
            {!effectiveCollapsed && <SectionLabel label="Access" />}
            {viewerNav.map((item) => (
              item.href !== '/' ? (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={<item.icon size={18} strokeWidth={1.85} />}
                  active={isActive(pathname, item.href, Boolean(item.exact))}
                  collapsed={effectiveCollapsed}
                  onNavigate={mobile ? onCloseMobile : undefined}
                />
              ) : null
            ))}
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {userRole === 'ADMIN' && (
        <div style={{ marginTop: '12px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {!effectiveCollapsed && <SectionLabel label="System" />}
          <NavItem
            href="/my-access"
            label="My VPN"
            icon={<ShieldCheck size={18} strokeWidth={1.85} />}
            active={isActive(pathname, '/my-access', true)}
            collapsed={effectiveCollapsed}
            onNavigate={mobile ? onCloseMobile : undefined}
          />
          <NavItem
            href="/admin/settings"
            label="Settings"
            icon={<SettingsIcon size={18} strokeWidth={1.85} />}
            active={isActive(pathname, '/admin/settings', true)}
            collapsed={effectiveCollapsed}
            onNavigate={mobile ? onCloseMobile : undefined}
          />
        </div>
      )}

      <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '10px', flexShrink: 0 }} />

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setProfileOpen((current) => !current)}
          title={effectiveCollapsed ? 'Account' : undefined}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: effectiveCollapsed ? 'center' : 'space-between',
            gap: '10px',
            padding: effectiveCollapsed ? '10px 8px' : '12px',
            background: profileOpen ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '18px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <TooltipAnchor label="Account" enabled={effectiveCollapsed}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(234,126,32,0.25), rgba(234,126,32,0.08))',
                  border: '1px solid rgba(234,126,32,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initial}
              </div>
              {!effectiveCollapsed && (
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userEmail}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666666', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700 }}>{userRole}</div>
                </div>
              )}
            </div>
          </TooltipAnchor>
          {!effectiveCollapsed && <ChevronIcon open={profileOpen} />}
        </button>

        {profileOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setProfileOpen(false)} />
            <div
              style={{
                position: 'absolute',
                left: effectiveCollapsed ? 'calc(100% + 10px)' : 0,
                bottom: 'calc(100% + 8px)',
                width: effectiveCollapsed ? '220px' : '100%',
                background: 'rgba(18,18,18,0.98)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '18px',
                padding: '6px',
                zIndex: 100,
                boxShadow: '0 18px 48px rgba(0,0,0,0.45)',
              }}
            >
              <ProfileAction href="/profile" label="Profile" onClick={() => {
                setProfileOpen(false)
                onCloseMobile?.()
              }} />
              <ProfileAction
                label="Sign out"
                danger
                onClick={() => {
                  setProfileOpen(false)
                  onCloseMobile?.()
                  signOut({ callbackUrl: '/login' })
                }}
              />
            </div>
          </>
        )}
      </div>
    </nav>
  )

  if (!mobile) return nav

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(2px)',
            zIndex: 35,
          }}
        />
      )}
      {nav}
    </>
  )
}

function isActive(pathname: string, href: string, exact = false) {
  if (href === '/') return pathname === '/'
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '0 12px',
        fontSize: '10px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.24em',
        color: '#666666',
      }}
    >
      {label}
    </div>
  )
}

function NavItem({
  href,
  label,
  icon,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  href: string
  label: string
  icon: ReactNode
  active: boolean
  collapsed: boolean
  badge?: number
  onNavigate?: () => void
}) {
  const visibleBadge = typeof badge === 'number' && badge > 0 ? (badge > 99 ? '99+' : String(badge)) : null

  return (
    <TooltipAnchor label={label} enabled={collapsed}>
      <Link
        href={href}
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: '10px',
          padding: collapsed ? '10px 8px' : '10px 12px',
          borderRadius: '14px',
          textDecoration: 'none',
          color: active ? 'var(--accent)' : 'rgba(229,226,225,0.82)',
          background: active ? 'rgba(255,255,255,0.03)' : 'transparent',
          border: active ? '1px solid rgba(255,183,125,0.18)' : '1px solid transparent',
          transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
        }}
      >
        {active && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '10px',
              bottom: '10px',
              width: '3px',
              borderRadius: '0 2px 2px 0',
              background: 'var(--accent)',
              boxShadow: '0 0 12px rgba(255,183,125,0.32)',
            }}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
          {!collapsed && (
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </span>
          )}
        </div>
        {!collapsed && visibleBadge && (
          <span
            style={{
              minWidth: '18px',
              height: '18px',
              borderRadius: '9999px',
              background: '#EF4444',
              color: '#FFFFFF',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 6px',
              flexShrink: 0,
            }}
          >
            {visibleBadge}
          </span>
        )}
        {collapsed && visibleBadge && (
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '6px',
              minWidth: '16px',
              height: '16px',
              borderRadius: '9999px',
              background: '#EF4444',
              color: '#FFFFFF',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {visibleBadge}
          </span>
        )}
      </Link>
    </TooltipAnchor>
  )
}

function TooltipAnchor({
  label,
  enabled = false,
  children,
}: {
  label: string
  enabled?: boolean
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{ position: 'relative', width: '100%' }}
      onMouseEnter={() => enabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {enabled && hovered && (
        <div
          style={{
            position: 'absolute',
            left: 'calc(100% + 10px)',
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#161616',
            color: 'var(--text-primary)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 10px 28px rgba(0,0,0,0.4)',
            zIndex: 200,
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

function ProfileAction({
  href,
  label,
  onClick,
  danger = false,
}: {
  href?: string
  label: string
  onClick: () => void
  danger?: boolean
}) {
  const style: CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 12px',
    background: 'transparent',
    textDecoration: 'none',
    borderRadius: '12px',
    border: 'none',
    color: danger ? '#EF4444' : 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  }

  if (href) {
    return (
      <Link href={href} onClick={onClick} style={style}>
        {label}
      </Link>
    )
  }

  return (
    <button onClick={onClick} style={style}>
      {label}
    </button>
  )
}

function LogoMark() {
  return (
    <div
      style={{
        width: '38px',
        height: '38px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-2px',
          borderRadius: '18px',
          background: 'radial-gradient(circle at center, rgba(234,126,32,0.12) 0%, transparent 70%)',
        }}
      />
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <path
          d="M16 2L4 7v9c0 7.73 5.12 14.12 12 16 6.88-1.88 12-8.27 12-16V7L16 2z"
          fill="url(#shieldGrad)"
          stroke="rgba(234,126,32,0.3)"
          strokeWidth="0.5"
        />
        <rect x="11" y="15" width="10" height="8" rx="2" fill="var(--accent)" opacity="0.9" />
        <path
          d="M13 15v-3a3 3 0 0 1 6 0v3"
          stroke="var(--accent)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="16" cy="19" r="1.2" fill="#0A0A0A" />
        <defs>
          <linearGradient id="shieldGrad" x1="16" y1="2" x2="16" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(234,126,32,0.18)" />
            <stop offset="100%" stopColor="rgba(234,126,32,0.04)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {collapsed ? (
        <polyline points="9 18 15 12 9 6" />
      ) : (
        <polyline points="15 18 9 12 15 6" />
      )}
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 120ms' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
