'use client'

import { useEffect, useState } from 'react'
import { SectionHeader, StatusBadge } from '@/components/ui/Primitives'
import {
  AdminSettingsShell,
  PageGrid,
  ReadonlyFlag,
  cardStyle,
  inputStyle,
  labelStyle,
  useAdminSettings,
} from '../settings-shared'

interface DeploymentSecurityIssue {
  id: string
  severity: 'critical' | 'warning'
  message: string
}

export default function AdminSecuritySettingsPage() {
  const { form, setForm, loading, saving, saveSettings } = useAdminSettings()
  const [deploymentIssues, setDeploymentIssues] = useState<DeploymentSecurityIssue[] | null>(null)

  useEffect(() => {
    fetch('/api/health/deep')
      .then((response) => response.json())
      .then((data) => {
        const issues = data?.deploymentSecurity?.issues
        setDeploymentIssues(Array.isArray(issues) ? issues : [])
      })
      .catch(() => setDeploymentIssues(null))
  }, [])

  return (
    <AdminSettingsShell
      title="Security Settings"
      description="Session boundaries, certificate warning policy, and MFA posture for AccessCore."
      loading={loading}
      saving={saving}
      onSave={saveSettings}
    >
      <PageGrid>
        <section style={cardStyle}>
          <SectionHeader
            eyebrow="Policy"
            title="Session & Certificate Policy"
            description="Control session lifetime and how early expiring certificates enter the renewal queue."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Session Max Age (hours)</label>
              <input
                type="number"
                min={1}
                max={24 * 30}
                value={form.sessionMaxAgeHours}
                onChange={(event) => setForm((current) => ({ ...current, sessionMaxAgeHours: Number(event.target.value) }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Certificate Expiry Warning (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={form.certExpiryWarnDays}
                onChange={(event) => setForm((current) => ({ ...current, certExpiryWarnDays: Number(event.target.value) }))}
                style={inputStyle}
              />
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <SectionHeader
            eyebrow="Identity"
            title="MFA Policy"
            description="Environment-controlled MFA posture for portal users."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <ReadonlyFlag
              label="TOTP MFA"
              description="Controls whether TOTP-based MFA can be enrolled for AccessCore users."
              enabled={form.featureFlags.totpMfaEnabled}
              source="Environment"
            />
            <ReadonlyFlag
              label="Mandatory MFA Onboarding"
              description="Redirects newly approved users into MFA setup before they can continue using AccessCore."
              enabled={form.featureFlags.mfaOnboardingRequired}
              source="Environment"
            />
          </div>
        </section>

        <section style={cardStyle}>
          <SectionHeader
            eyebrow="Production Readiness"
            title="Security Checklist"
            description="Admin-only deployment checks for secrets, CSP posture, and database defaults."
            action={
              deploymentIssues === null
                ? <StatusBadge tone="muted">Unavailable</StatusBadge>
                : deploymentIssues.length === 0
                  ? <StatusBadge tone="success">Clear</StatusBadge>
                  : <StatusBadge tone="warning">{deploymentIssues.length} item{deploymentIssues.length === 1 ? '' : 's'}</StatusBadge>
            }
          />

          {deploymentIssues === null ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Deep health checks are unavailable right now. Try again after server health is restored.
            </div>
          ) : deploymentIssues.length === 0 ? (
            <div style={{
              padding: '14px',
              borderRadius: '14px',
              border: '1px solid rgba(34,197,94,0.22)',
              background: 'rgba(34,197,94,0.08)',
              color: '#22C55E',
              fontSize: '13px',
              fontWeight: 700,
            }}>
              Production security checks are clear for the current environment.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {deploymentIssues.map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    padding: '13px 14px',
                    borderRadius: '14px',
                    border: `1px solid ${issue.severity === 'critical' ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.22)'}`,
                    background: issue.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 800 }}>{issue.id}</span>
                    <StatusBadge tone={issue.severity === 'critical' ? 'danger' : 'warning'}>
                      {issue.severity}
                    </StatusBadge>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.55 }}>
                    {issue.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </PageGrid>
    </AdminSettingsShell>
  )
}
