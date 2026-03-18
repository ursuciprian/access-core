'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ui/ToastProvider'

export interface SettingsFormState {
  googleSyncEnabled: boolean
  autoApproveUsers: boolean
  defaultUserRole: 'ADMIN' | 'VIEWER'
  defaultVpnServerId: string | null
  sessionMaxAgeHours: number
  certExpiryWarnDays: number
  maintenanceMode: boolean
  allowedDomain: string | null
  availableVpnServers: Array<{
    id: string
    name: string
    hostname: string
  }>
  featureFlags: {
    serverManagementEnabled: boolean
    ldapEnabled: boolean
    oidcSsoEnabled: boolean
    totpMfaEnabled: boolean
    mfaOnboardingRequired: boolean
  }
  ldap: {
    enabled: boolean
    url: string | null
    bindDn: string | null
    baseDn: string | null
    userFilter: string | null
    emailAttribute: string | null
    displayNameAttribute: string | null
    groupAttribute: string | null
    adminGroups: string[]
    viewerGroups: string[]
    syncRoles: boolean
    startTls: boolean
    tlsRejectUnauthorized: boolean
  }
}

const initialState: SettingsFormState = {
  googleSyncEnabled: false,
  autoApproveUsers: false,
  defaultUserRole: 'VIEWER',
  defaultVpnServerId: null,
  sessionMaxAgeHours: 24,
  certExpiryWarnDays: 30,
  maintenanceMode: false,
  allowedDomain: null,
  availableVpnServers: [],
  featureFlags: {
    serverManagementEnabled: true,
    ldapEnabled: false,
    oidcSsoEnabled: false,
    totpMfaEnabled: true,
    mfaOnboardingRequired: true,
  },
  ldap: {
    enabled: false,
    url: null,
    bindDn: null,
    baseDn: null,
    userFilter: null,
    emailAttribute: null,
    displayNameAttribute: null,
    groupAttribute: null,
    adminGroups: [],
    viewerGroups: [],
    syncRoles: false,
    startTls: false,
    tlsRejectUnauthorized: true,
  },
}

const SETTINGS_SECTIONS = [
  { href: '/admin/settings/platform', label: 'Platform' },
  { href: '/admin/settings/access', label: 'Access' },
  { href: '/admin/settings/security', label: 'Security' },
  { href: '/admin/settings/integrations', label: 'Integrations' },
  { href: '/admin/settings/directory', label: 'Directory' },
]

export const cardStyle: React.CSSProperties = {
  background: '#111111',
  border: '1px solid #1E1E1E',
  borderRadius: '16px',
  padding: '20px',
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: '#1A1A1A',
  border: '1px solid #333333',
  borderRadius: '10px',
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

export function actionButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 16px',
    background: '#EA7E20',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'inherit',
  }
}

export function useAdminSettings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingLdap, setTestingLdap] = useState(false)
  const [ldapLookup, setLdapLookup] = useState('')
  const [ldapDiagnostic, setLdapDiagnostic] = useState<Record<string, unknown> | null>(null)
  const [form, setForm] = useState<SettingsFormState>(initialState)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((response) => response.json())
      .then((data) => {
        setForm({
          ...initialState,
          ...data,
          featureFlags: {
            ...initialState.featureFlags,
            ...(data?.featureFlags ?? {}),
          },
        })
      })
      .catch(() => {
        toast('Failed to load settings', 'error')
      })
      .finally(() => setLoading(false))
  }, [toast])

  async function saveSettings() {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleSyncEnabled: form.googleSyncEnabled,
          autoApproveUsers: form.autoApproveUsers,
          defaultUserRole: form.defaultUserRole,
          defaultVpnServerId: form.defaultVpnServerId,
          sessionMaxAgeHours: Number(form.sessionMaxAgeHours),
          certExpiryWarnDays: Number(form.certExpiryWarnDays),
          maintenanceMode: form.maintenanceMode,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        toast((data as Record<string, string>).error ?? 'Failed to save settings', 'error')
        return false
      }

      window.dispatchEvent(new CustomEvent('settings:updated', {
        detail: { maintenanceMode: form.maintenanceMode },
      }))
      toast('Settings saved', 'success')
      return true
    } finally {
      setSaving(false)
    }
  }

  async function runLdapDiagnostic(mode: 'connectivity' | 'lookup') {
    setTestingLdap(true)
    setLdapDiagnostic(null)
    try {
      const response = await fetch('/api/admin/settings/ldap/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'lookup' ? { login: ldapLookup } : {}),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast((data as Record<string, string>).error ?? 'LDAP diagnostics failed', 'error')
        setLdapDiagnostic({ error: (data as Record<string, string>).error ?? 'LDAP diagnostics failed' })
        return
      }

      setLdapDiagnostic(data as Record<string, unknown>)
      toast(mode === 'lookup' ? 'LDAP lookup completed' : 'LDAP connectivity test passed', 'success')
    } finally {
      setTestingLdap(false)
    }
  }

  return {
    form,
    setForm,
    loading,
    saving,
    saveSettings,
    testingLdap,
    ldapLookup,
    setLdapLookup,
    ldapDiagnostic,
    runLdapDiagnostic,
  }
}

export function AdminSettingsShell({
  title,
  description,
  loading,
  saving,
  onSave,
  children,
}: {
  title: string
  description: string
  loading: boolean
  saving: boolean
  onSave: () => void
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#F0F0F0', margin: 0 }}>{title}</h2>
          <p style={{ fontSize: '13px', color: '#888888', margin: '6px 0 0', lineHeight: 1.5 }}>{description}</p>
        </div>
        <button onClick={onSave} disabled={loading || saving} style={actionButtonStyle(loading || saving)}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div style={{ ...cardStyle, padding: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {SETTINGS_SECTIONS.map((section) => {
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
          Loading settings...
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export function PageGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gap: '16px' }}>{children}</div>
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '14px 16px',
      borderRadius: '12px',
      border: '1px solid #1E1E1E',
      background: '#151515',
      cursor: 'pointer',
    }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#F0F0F0', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '12px', color: '#888888', lineHeight: 1.5 }}>{description}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

export function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="text" value={value} readOnly style={{ ...inputStyle, color: '#888888' }} />
    </div>
  )
}

export function ReadonlyFlag({
  label,
  description,
  enabled,
  source,
}: {
  label: string
  description: string
  enabled: boolean
  source: string
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '14px 16px',
      borderRadius: '12px',
      border: '1px solid #1E1E1E',
      background: '#151515',
    }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#F0F0F0', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '12px', color: '#888888', lineHeight: 1.5 }}>{description}</div>
        <div style={{ fontSize: '11px', color: '#555555', marginTop: '6px' }}>{source}</div>
      </div>
      <span style={{
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        background: enabled ? 'rgba(34,197,94,0.15)' : 'rgba(136,136,136,0.15)',
        color: enabled ? '#22C55E' : '#888888',
        whiteSpace: 'nowrap',
      }}>
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  )
}

export function SettingsInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <span style={{ fontSize: '13px', color: '#444444', width: '140px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#888888' }}>{value}</span>
    </div>
  )
}

export function useSettingsSectionMeta() {
  return useMemo(() => SETTINGS_SECTIONS, [])
}
