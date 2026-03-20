'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface ServerSectionNavProps {
  serverId: string
  serverManagementEnabled?: boolean
}

const containerStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '20px',
  padding: '18px 20px',
}

const descriptionStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-muted)',
  margin: '6px 0 0',
  lineHeight: 1.5,
}

function navItemStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '10px',
    border: active ? '1px solid rgba(255,183,125,0.24)' : '1px solid var(--border-strong)',
    background: active ? 'rgba(255,183,125,0.12)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
  }
}

export default function ServerSectionNav({
  serverId,
  serverManagementEnabled = true,
}: ServerSectionNavProps) {
  const pathname = usePathname()

  const items = [
    {
      label: 'Connections',
      href: `/servers/${serverId}/connections`,
      active: pathname?.startsWith(`/servers/${serverId}/connections`) ?? false,
      visible: true,
    },
    {
      label: 'Network',
      href: `/servers/${serverId}/network`,
      active: pathname === `/servers/${serverId}/network`,
      visible: serverManagementEnabled,
    },
    {
      label: 'Drift Detection',
      href: `/servers/${serverId}/drift`,
      active: pathname === `/servers/${serverId}/drift`,
      visible: serverManagementEnabled,
    },
    {
      label: 'Import Users',
      href: `/servers/${serverId}/import`,
      active: pathname === `/servers/${serverId}/import`,
      visible: serverManagementEnabled,
    },
    {
      label: 'Logs',
      href: `/servers/${serverId}/logs`,
      active: pathname === `/servers/${serverId}/logs`,
      visible: serverManagementEnabled,
    },
  ].filter((item) => item.visible)

  return (
    <section style={containerStyle}>
      <div style={{ marginBottom: '14px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Operations</h3>
        <p style={descriptionStyle}>
          Open the server tools for sessions, routing, logs, drift checks, and imports.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {items.map((item) => (
          <Link key={item.href} href={item.href} style={navItemStyle(item.active)}>
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  )
}
