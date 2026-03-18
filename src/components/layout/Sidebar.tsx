'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

const viewerNav = [
  { href: '/', label: 'Dashboard', icon: DashboardIcon, exact: true },
  { href: '/my-access', label: 'My VPN', icon: DownloadNavIcon, exact: true },
  { href: '/request-access', label: 'Request Access', icon: RequestAccessNavIcon, exact: true },
]

const adminSections = [
  {
    key: 'access',
    label: 'Access',
    icon: UsersNavIcon,
    items: [
      { href: '/users', label: 'Users', icon: UsersNavIcon },
      { href: '/groups', label: 'Groups', icon: GroupsNavIcon },
      { href: '/access-requests', label: 'VPN Requests', icon: RequestsNavIcon, hasBadge: true },
      { href: '/admin', label: 'Portal Access', icon: AdminNavIcon, exact: true },
    ],
  },
  {
    key: 'infrastructure',
    label: 'Infrastructure',
    icon: ServersNavIcon,
    items: [
      { href: '/servers', label: 'Servers', icon: ServersNavIcon },
    ],
  },
]

const adminStandaloneNav = [
  {
    href: '/analytics',
    label: 'Control Center',
    icon: ControlCenterNavIcon,
    isActive: (pathname: string) =>
      pathname.startsWith('/analytics')
      || pathname.startsWith('/sync')
      || pathname.startsWith('/flagged')
      || pathname.startsWith('/audit'),
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
  const [pendingCount, setPendingCount] = useState(0)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    access: true,
    infrastructure: true,
  })

  const userEmail = session?.user?.email ?? ''
  const userRole = ((session?.user as Record<string, unknown>)?.role as string | undefined) ?? 'VIEWER'
  const initial = (userEmail || 'U')[0].toUpperCase()
  const effectiveCollapsed = mobile ? false : collapsed

  useEffect(() => {
    if (userRole !== 'ADMIN') return

    const fetchCount = () => {
      fetch('/api/access-requests/pending-count')
        .then((response) => response.json())
        .then((data) => setPendingCount(data.count || 0))
        .catch(() => {})
    }

    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [userRole])

  useEffect(() => {
    if (userRole !== 'ADMIN') return

    setOpenSections((current) => {
      const next = { ...current }
      for (const section of adminSections) {
        if (section.items.some((item) => isActive(pathname, item.href, Boolean(item.exact)))) {
          next[section.key] = true
        }
      }
      return next
    })
  }, [pathname, userRole])

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
        width: mobile ? 'min(320px, calc(100vw - 24px))' : effectiveCollapsed ? '80px' : '248px',
        background: 'rgba(10,10,10,0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '2px 0 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
        padding: effectiveCollapsed ? '10px 8px' : '12px',
        zIndex: 40,
        transition: mobile
          ? 'transform 180ms ease, opacity 180ms ease'
          : 'width 160ms ease, padding 160ms ease',
        transform: mobile ? (mobileOpen ? 'translateX(0)' : 'translateX(calc(-100% - 24px))') : 'none',
        opacity: mobile ? (mobileOpen ? 1 : 0) : 1,
        pointerEvents: mobile ? (mobileOpen ? 'auto' : 'none') : 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: effectiveCollapsed ? 'center' : 'space-between', gap: '10px', marginBottom: '10px' }}>
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
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#F0F0F0' }}>AccessCore</div>
              <div style={{ fontSize: '11px', color: '#555555', marginTop: '2px' }}>Management portal</div>
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
            borderRadius: '8px',
            border: '1px solid #232323',
            background: '#111111',
            color: '#888888',
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

      <div style={{ width: '100%', height: '1px', background: 'var(--border)', marginBottom: '12px', flexShrink: 0 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0, overflowY: 'auto', paddingRight: effectiveCollapsed ? 0 : '2px' }}>
        {userRole === 'ADMIN' ? (
          <>
            <NavItem
              href="/"
              label="Dashboard"
              icon={<DashboardIcon size={18} />}
              active={isActive(pathname, '/', true)}
              collapsed={effectiveCollapsed}
              onNavigate={mobile ? onCloseMobile : undefined}
            />

            {adminSections.map((section) => (
              <div key={section.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <SectionButton
                  label={section.label}
                  icon={<section.icon size={16} />}
                  collapsed={effectiveCollapsed}
                  open={openSections[section.key]}
                  active={section.items.some((item) => isActive(pathname, item.href, Boolean(item.exact)))}
                  onClick={() => setOpenSections((current) => ({ ...current, [section.key]: !current[section.key] }))}
                />
                {openSections[section.key] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {section.items.map((item) => (
                      <NavItem
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={<item.icon size={18} />}
                        active={isActive(pathname, item.href, Boolean(item.exact))}
                        collapsed={effectiveCollapsed}
                        nested
                        badge={item.hasBadge ? pendingCount : undefined}
                        onNavigate={mobile ? onCloseMobile : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {adminStandaloneNav.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<item.icon size={18} />}
                active={item.isActive(pathname)}
                collapsed={effectiveCollapsed}
                onNavigate={mobile ? onCloseMobile : undefined}
              />
            ))}
          </>
        ) : (
          <>
            {viewerNav.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<item.icon size={18} />}
                active={isActive(pathname, item.href, Boolean(item.exact))}
                collapsed={effectiveCollapsed}
                onNavigate={mobile ? onCloseMobile : undefined}
              />
            ))}
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {userRole === 'ADMIN' && (
        <div style={{ marginTop: '12px', marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <NavItem
            href="/my-access"
            label="My VPN"
            icon={<DownloadNavIcon size={18} />}
            active={isActive(pathname, '/my-access', true)}
            collapsed={effectiveCollapsed}
            onNavigate={mobile ? onCloseMobile : undefined}
          />
          <NavItem
            href="/admin/settings"
            label="Settings"
            icon={<SettingsNavIcon size={18} />}
            active={isActive(pathname, '/admin/settings', true)}
            collapsed={effectiveCollapsed}
            onNavigate={mobile ? onCloseMobile : undefined}
          />
        </div>
      )}

      <div style={{ width: '100%', height: '1px', background: 'var(--border)', marginBottom: '10px', flexShrink: 0 }} />

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
            padding: effectiveCollapsed ? '10px 8px' : '10px 12px',
            background: profileOpen ? 'var(--elevated)' : 'transparent',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <TooltipAnchor label="Account" enabled={effectiveCollapsed}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: 'var(--radius-full)',
                  background: 'linear-gradient(135deg, rgba(234,126,32,0.25), rgba(234,126,32,0.08))',
                  border: '1px solid rgba(234,126,32,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: '#EA7E20',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initial}
              </div>
              {!effectiveCollapsed && (
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#F0F0F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userEmail}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666666', marginTop: '2px' }}>{userRole}</div>
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
                background: 'var(--elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-lg)',
                padding: '6px',
                zIndex: 100,
                boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
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

function SectionButton({
  label,
  icon,
  collapsed,
  open,
  active,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  collapsed: boolean
  open: boolean
  active: boolean
  onClick: () => void
}) {
  return (
    <TooltipAnchor label={label} enabled={collapsed}>
      <button
        onClick={onClick}
        title={collapsed ? label : undefined}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: '10px',
          padding: collapsed ? '10px 8px' : '10px 12px',
          border: 'none',
          borderRadius: '12px',
          background: active ? 'rgba(234,126,32,0.08)' : '#111111',
          color: active ? '#EA7E20' : '#888888',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {icon}
          {!collapsed && (
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {label}
            </span>
          )}
        </div>
        {!collapsed && <ChevronIcon open={open} />}
      </button>
    </TooltipAnchor>
  )
}

function NavItem({
  href,
  label,
  icon,
  active,
  collapsed,
  nested = false,
  badge,
  onNavigate,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
  collapsed: boolean
  nested?: boolean
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
          padding: collapsed ? '10px 8px' : nested ? '10px 12px 10px 20px' : '10px 12px',
          borderRadius: '12px',
          textDecoration: 'none',
          color: active ? '#EA7E20' : '#C4C4C4',
          background: active ? 'rgba(234,126,32,0.12)' : 'transparent',
          border: active ? '1px solid rgba(234,126,32,0.16)' : '1px solid transparent',
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
              background: '#EA7E20',
            }}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
          {!collapsed && (
            <span style={{ fontSize: '13px', fontWeight: active ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
  children: React.ReactNode
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
            color: '#F0F0F0',
            border: '1px solid #2A2A2A',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: 500,
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
  const style: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 12px',
    background: 'transparent',
    textDecoration: 'none',
    borderRadius: '10px',
    border: 'none',
    color: danger ? '#EF4444' : 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: 500,
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
          borderRadius: 'var(--radius-lg)',
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
        <rect x="11" y="15" width="10" height="8" rx="2" fill="#EA7E20" opacity="0.9" />
        <path
          d="M13 15v-3a3 3 0 0 1 6 0v3"
          stroke="#EA7E20"
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

function DashboardIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function UsersNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function GroupsNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ServersNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="7" rx="2" />
      <rect x="2" y="14" width="20" height="7" rx="2" />
      <line x1="6" y1="7" x2="6.01" y2="7" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  )
}

function SyncNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10" />
      <path d="M20.49 15A9 9 0 0 1 6.36 18.36L1 14" />
    </svg>
  )
}

function AnalyticsNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="6" y="11" width="3" height="6" rx="1" />
      <rect x="11" y="7" width="3" height="10" rx="1" />
      <rect x="16" y="4" width="3" height="13" rx="1" />
    </svg>
  )
}

function FlaggedNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

function AuditNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  )
}

function DownloadNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function RequestsNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="13" y2="13" />
    </svg>
  )
}

function AdminNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" />
      <path d="M9.5 12.5l1.5 1.5 3.5-4" />
    </svg>
  )
}

function SettingsNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function ControlCenterNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  )
}

function RequestAccessNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}
