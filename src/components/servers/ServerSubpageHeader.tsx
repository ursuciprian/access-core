'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'

interface ServerSubpageHeaderProps {
  backHref: string
  backLabel: string
  title: string
  description?: string
  rightContent?: ReactNode
}

const backLinkStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--accent)',
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: '16px',
}

const titleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  margin: 0,
}

const descriptionStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-secondary)',
  margin: '6px 0 0',
  lineHeight: 1.5,
}

export default function ServerSubpageHeader({
  backHref,
  backLabel,
  title,
  description,
  rightContent,
}: ServerSubpageHeaderProps) {
  return (
    <>
      <Link href={backHref} style={backLinkStyle}>
        {backLabel}
      </Link>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          minHeight: '38px',
          marginBottom: '24px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={titleStyle}>{title}</h2>
          {description ? <p style={descriptionStyle}>{description}</p> : null}
        </div>
        {rightContent ? <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>{rightContent}</div> : null}
      </div>
    </>
  )
}
