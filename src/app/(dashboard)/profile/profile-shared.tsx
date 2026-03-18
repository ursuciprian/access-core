'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/ui/ToastProvider'
import MfaQrCode from '@/components/auth/MfaQrCode'

export interface ProfileAccess {
  id: string
  approvedAt: string
  certStatus: string
  certExpiresAt: string | null
  isEnabled: boolean
  server: {
    id: string
    name: string
    hostname: string
  }
}

export interface ProfileData {
  id: string
  email: string
  role: string
  createdAt: string
  lastLoginAt: string | null
  mfaEnabled: boolean
  mfaEnabledAt: string | null
  mfaAvailable: boolean
  mfaRequired: boolean
  authMethod: string
  hasPassword: boolean
  access: ProfileAccess[]
}

export interface LoginHistoryEntry {
  id: string
  method: string
  ip: string | null
  userAgent: string | null
  createdAt: string
}

const PROFILE_SECTIONS = [
  { href: '/profile/account', label: 'Account' },
  { href: '/profile/access', label: 'Access' },
  { href: '/profile/security', label: 'Security' },
  { href: '/profile/activity', label: 'Activity' },
]

export const cardStyle: React.CSSProperties = {
  background: '#111111',
  border: '1px solid #1E1E1E',
  borderRadius: '16px',
  padding: '20px',
}

export const listCardStyle: React.CSSProperties = {
  background: '#151515',
  border: '1px solid #1E1E1E',
  borderRadius: '14px',
  padding: '16px',
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: '#1A1A1A',
  border: '1px solid #333333',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#F0F0F0',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: '#888888',
  marginBottom: '6px',
}

export function actionButtonStyle(disabled: boolean, danger = false): React.CSSProperties {
  return {
    padding: '10px 14px',
    background: danger ? 'rgba(239,68,68,0.12)' : '#EA7E20',
    color: danger ? '#EF4444' : '#FFFFFF',
    border: danger ? '1px solid rgba(239,68,68,0.22)' : 'none',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    fontFamily: 'inherit',
  }
}

export function formatDate(value: string | null): string {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

export function formatMethod(value: string): string {
  if (value === 'google') return 'Google'
  if (value === 'ldap') return 'LDAP'
  if (value === 'sso' || value === 'oidc') return 'SSO'
  return 'Credentials'
}

export function summarizeUserAgent(value: string): string {
  if (value.includes('Chrome')) return 'Chrome browser'
  if (value.includes('Safari') && !value.includes('Chrome')) return 'Safari browser'
  if (value.includes('Firefox')) return 'Firefox browser'
  if (value.includes('Edg')) return 'Edge browser'
  return 'Browser session'
}

export function ProfileShell({
  title,
  description,
  loading,
  children,
}: {
  title: string
  description: string
  loading: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#F0F0F0', margin: 0 }}>{title}</h2>
        <p style={{ fontSize: '13px', color: '#888888', margin: '6px 0 0', lineHeight: 1.5 }}>{description}</p>
      </div>

      <div style={{ ...cardStyle, padding: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {PROFILE_SECTIONS.map((section) => {
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
      </div>

      {loading ? (
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px', color: '#555555' }}>
          Loading profile...
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export function PageGrid({ children, minWidth = 360 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minWidth}px), 1fr))`, gap: '16px', alignItems: 'stretch' }}>
      {children}
    </div>
  )
}

export function ListPanel({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return (
    <div style={{ ...listCardStyle, height: '100%' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#F0F0F0', marginBottom: '12px' }}>{title}</div>
      <ListRows rows={rows} />
    </div>
  )
}

export function ListRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '12px', color: '#666666' }}>{row.label}</div>
          <div style={{ fontSize: '13px', color: '#F0F0F0', lineHeight: 1.5, textAlign: 'right', maxWidth: '62%' }}>{row.value}</div>
        </div>
      ))}
    </div>
  )
}

export function StatusBadge({ value }: { value: string }) {
  const active = value === 'ACTIVE'
  const revoked = value === 'REVOKED'

  return (
    <span style={{
      padding: '4px 10px',
      borderRadius: '9999px',
      fontSize: '11px',
      fontWeight: 600,
      background: active ? 'rgba(34,197,94,0.15)' : revoked ? 'rgba(239,68,68,0.15)' : 'rgba(136,136,136,0.15)',
      color: active ? '#22C55E' : revoked ? '#EF4444' : '#888888',
      whiteSpace: 'nowrap',
    }}>
      {value}
    </span>
  )
}

export function useProfileData() {
  const { toast } = useToast()
  const { update } = useSession()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [sessions, setSessions] = useState<LoginHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPassword, setSavingPassword] = useState(false)
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUri: string; issuer: string } | null>(null)
  const [mfaFlow, setMfaFlow] = useState<'setup' | 'reconfigure' | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [reconfigureCurrentCode, setReconfigureCurrentCode] = useState('')
  const [disableMfaCode, setDisableMfaCode] = useState('')
  const [settingUpMfa, setSettingUpMfa] = useState(false)
  const [startingMfaReconfigure, setStartingMfaReconfigure] = useState(false)
  const [enablingMfa, setEnablingMfa] = useState(false)
  const [disablingMfa, setDisablingMfa] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then((response) => response.json()),
      fetch('/api/profile/sessions').then((response) => response.json()),
    ])
      .then(([profileData, sessionsData]) => {
        setProfile(profileData)
        setSessions(Array.isArray(sessionsData) ? sessionsData : [])
      })
      .catch(() => {
        toast('Failed to load profile', 'error')
      })
      .finally(() => setLoading(false))
  }, [toast])

  const activeAccessCount = useMemo(
    () => profile?.access.filter((entry) => entry.isEnabled).length ?? 0,
    [profile]
  )
  const activeCertCount = useMemo(
    () => profile?.access.filter((entry) => entry.certStatus === 'ACTIVE').length ?? 0,
    [profile]
  )
  const recentLogin = sessions[0] ?? null
  const approvedAccessCount = profile?.access.length ?? 0
  const vpnReadiness = activeAccessCount > 0 && activeCertCount > 0
    ? 'Ready to connect'
    : approvedAccessCount > 0
      ? 'Provisioning in progress'
      : 'No VPN access yet'

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (passwordForm.newPassword.length < 6) {
      toast('New password must be at least 6 characters', 'error')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast('New password and confirmation must match', 'error')
      return
    }

    setSavingPassword(true)
    try {
      const response = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        toast((data as Record<string, string>).error ?? 'Failed to update password', 'error')
        return
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast('Password updated', 'success')
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleStartMfaSetup() {
    setSettingUpMfa(true)
    try {
      const response = await fetch('/api/profile/mfa/setup', { method: 'POST' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast((data as Record<string, string>).error ?? 'Failed to start MFA setup', 'error')
        return
      }

      setMfaSetup(data as { secret: string; otpauthUri: string; issuer: string })
      setMfaFlow('setup')
      setMfaCode('')
      toast('Authenticator secret generated', 'success')
    } finally {
      setSettingUpMfa(false)
    }
  }

  async function handleStartMfaReconfigure(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStartingMfaReconfigure(true)
    try {
      const response = await fetch('/api/profile/mfa/reconfigure/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentCode: reconfigureCurrentCode }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast((data as Record<string, string>).error ?? 'Failed to start MFA reconfiguration', 'error')
        return
      }

      setMfaSetup(data as { secret: string; otpauthUri: string; issuer: string })
      setMfaFlow('reconfigure')
      setMfaCode('')
      setReconfigureCurrentCode('')
      toast('New authenticator setup is ready', 'success')
    } finally {
      setStartingMfaReconfigure(false)
    }
  }

  async function handleEnableMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEnablingMfa(true)
    try {
      const endpoint = mfaFlow === 'reconfigure' ? '/api/profile/mfa/reconfigure/confirm' : '/api/profile/mfa/enable'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast((data as Record<string, string>).error ?? 'Failed to enable MFA', 'error')
        return
      }

      setProfile((current) => current ? { ...current, mfaEnabled: true, mfaEnabledAt: new Date().toISOString() } : current)
      setMfaSetup(null)
      setMfaFlow(null)
      setMfaCode('')
      await update({ mfaEnabled: true, mfaVerified: true })
      toast(mfaFlow === 'reconfigure' ? 'Authenticator updated' : 'Multi-factor authentication enabled', 'success')
    } finally {
      setEnablingMfa(false)
    }
  }

  async function handleDisableMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDisablingMfa(true)
    try {
      const response = await fetch('/api/profile/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: disableMfaCode }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast((data as Record<string, string>).error ?? 'Failed to disable MFA', 'error')
        return
      }

      setProfile((current) => current ? { ...current, mfaEnabled: false, mfaEnabledAt: null } : current)
      setDisableMfaCode('')
      setMfaSetup(null)
      setMfaFlow(null)
      await update({ mfaEnabled: false, mfaVerified: true })
      toast('Multi-factor authentication disabled', 'success')
    } finally {
      setDisablingMfa(false)
    }
  }

  return {
    loading,
    profile,
    sessions,
    recentLogin,
    activeAccessCount,
    activeCertCount,
    vpnReadiness,
    passwordForm,
    setPasswordForm,
    savingPassword,
    handlePasswordUpdate,
    mfaSetup,
    mfaFlow,
    mfaCode,
    setMfaCode,
    reconfigureCurrentCode,
    setReconfigureCurrentCode,
    disableMfaCode,
    setDisableMfaCode,
    settingUpMfa,
    startingMfaReconfigure,
    enablingMfa,
    disablingMfa,
    handleStartMfaSetup,
    handleStartMfaReconfigure,
    handleEnableMfa,
    handleDisableMfa,
  }
}

export function MfaSetupCard({
  setup,
  code,
  onCodeChange,
  onSubmit,
  submitting,
  label,
  description,
}: {
  setup: { secret: string; otpauthUri: string; issuer: string }
  code: string
  onCodeChange: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  submitting: boolean
  label: string
  description: string
}) {
  return (
    <form onSubmit={onSubmit} style={{ ...listCardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: '#888888', lineHeight: 1.6 }}>{description}</div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <MfaQrCode value={setup.otpauthUri} size={168} />
      </div>
      <ListRows
        rows={[
          { label: 'Issuer', value: setup.issuer },
          { label: 'Manual Key', value: setup.secret },
        ]}
      />
      <div>
        <label style={labelStyle}>{label}</label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.2em', textAlign: 'center' }}
          required
        />
      </div>
      <button type="submit" disabled={submitting || code.length !== 6} style={actionButtonStyle(submitting || code.length !== 6)}>
        {submitting ? 'Saving...' : 'Confirm MFA'}
      </button>
    </form>
  )
}
