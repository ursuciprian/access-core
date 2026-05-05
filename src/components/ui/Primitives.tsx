'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'accent'

const toneColors: Record<Tone, string> = {
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#60A5FA',
  muted: 'var(--text-muted)',
  accent: 'var(--accent)',
}

export function toneColor(tone: Tone) {
  return toneColors[tone]
}

export function SectionCard({
  id,
  children,
  style,
  interactive = false,
}: {
  id?: string
  children: ReactNode
  style?: CSSProperties
  interactive?: boolean
}) {
  return (
    <section
      id={id}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(18,18,18,0.96), rgba(12,12,12,0.98))',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '24px',
        padding: '20px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        transition: interactive ? 'transform 140ms ease, border-color 140ms ease' : undefined,
        ...style,
      }}
    >
      {children}
    </section>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
      <div>
        {eyebrow && (
          <div style={{
            fontSize: '10px',
            fontWeight: 900,
            color: 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.22em',
            marginBottom: '7px',
          }}>
            {eyebrow}
          </div>
        )}
        <h2 style={{
          margin: 0,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
          fontWeight: 800,
          letterSpacing: '-0.04em',
        }}>
          {title}
        </h2>
        {description && (
          <p style={{ margin: '7px 0 0', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.55 }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  helper,
  tone = 'accent',
  href,
}: {
  label: string
  value: string | number
  helper?: string
  tone?: Tone
  href?: string
}) {
  const color = toneColor(tone)
  const content = (
    <div
      style={{
        minHeight: '112px',
        height: '100%',
        padding: '16px',
        borderRadius: '18px',
        border: '1px solid rgba(255,255,255,0.055)',
        background: 'rgba(5,5,5,0.45)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute',
        right: '-28px',
        bottom: '-28px',
        width: '92px',
        height: '92px',
        borderRadius: '999px',
        background: `${color}14`,
        filter: 'blur(20px)',
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
          {label}
        </div>
        <div style={{ marginTop: '12px', color, fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1 }}>
          {value}
        </div>
        {helper && (
          <div style={{ marginTop: '9px', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.45 }}>
            {helper}
          </div>
        )}
      </div>
    </div>
  )

  if (!href) return content
  return <Link href={href} style={{ color: 'inherit', textDecoration: 'none', height: '100%', display: 'block' }}>{content}</Link>
}

export function StatusBadge({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: Tone
}) {
  const color = toneColor(tone)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        minHeight: '24px',
        padding: '0 9px',
        borderRadius: '999px',
        border: `1px solid ${color}28`,
        background: `${color}14`,
        color,
        fontSize: '10px',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: color }} />
      {children}
    </span>
  )
}

export function ActionButton({
  children,
  href,
  onClick,
  disabled = false,
  tone = 'accent',
  variant = 'solid',
  type = 'button',
}: {
  children: ReactNode
  href?: string
  onClick?: () => void
  disabled?: boolean
  tone?: Tone
  variant?: 'solid' | 'soft'
  type?: 'button' | 'submit'
}) {
  const color = toneColor(tone)
  const style: CSSProperties = {
    minHeight: '38px',
    padding: '0 14px',
    borderRadius: '12px',
    border: variant === 'solid' ? 'none' : `1px solid ${color}28`,
    background: variant === 'solid' && tone === 'accent' ? 'var(--button-primary)' : `${color}14`,
    color: variant === 'solid' && tone === 'accent' ? 'var(--button-primary-text)' : color,
    fontFamily: 'inherit',
    fontSize: '12px',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
  }

  if (href) {
    return <Link href={href} style={style}>{children}</Link>
  }

  return <button type={type} onClick={onClick} disabled={disabled} style={style}>{children}</button>
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        minHeight: '180px',
        padding: '28px',
        borderRadius: '18px',
        border: '1px dashed rgba(255,255,255,0.1)',
        background: 'rgba(5,5,5,0.34)',
      }}
    >
      <div>
        <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '14px' }}>{title}</div>
        {description && <p style={{ margin: '8px auto 0', maxWidth: '460px', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.55 }}>{description}</p>}
        {action && <div style={{ marginTop: '16px' }}>{action}</div>}
      </div>
    </div>
  )
}
