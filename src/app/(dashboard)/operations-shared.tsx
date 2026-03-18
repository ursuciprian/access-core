'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const OPERATIONS_SECTIONS = [
  { href: '/analytics', label: 'Analytics' },
  { href: '/audit', label: 'Audit' },
  { href: '/sync', label: 'Sync' },
  { href: '/flagged', label: 'Flags' },
]

const shellCardStyle: React.CSSProperties = {
  background: '#111111',
  border: '1px solid #1E1E1E',
  borderRadius: '16px',
  padding: '20px',
}

export function OperationsShell({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <section style={shellCardStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#F0F0F0', margin: 0 }}>{title}</h2>
            <p style={{ fontSize: '13px', color: '#888888', margin: '6px 0 0', lineHeight: 1.5 }}>{description}</p>
          </div>
          {actions ? <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>{actions}</div> : null}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
          {OPERATIONS_SECTIONS.map((section) => {
            const active = pathname === section.href
            return (
              <Link
                key={section.href}
                href={section.href}
                style={{
                  padding: '9px 14px',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: active ? '#EA7E20' : '#888888',
                  background: active ? 'rgba(234,126,32,0.12)' : '#151515',
                  border: active ? '1px solid rgba(234,126,32,0.24)' : '1px solid #1E1E1E',
                }}
              >
                {section.label}
              </Link>
            )
          })}
        </div>
      </section>

      {children}
    </div>
  )
}
