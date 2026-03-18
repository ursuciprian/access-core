'use client'

import {
  AdminSettingsShell,
  PageGrid,
  ReadonlyFlag,
  cardStyle,
  inputStyle,
  labelStyle,
  useAdminSettings,
} from '../settings-shared'

export default function AdminSecuritySettingsPage() {
  const { form, setForm, loading, saving, saveSettings } = useAdminSettings()

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
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
            Session & Certificate Policy
          </p>
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
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
            MFA Policy
          </p>
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
      </PageGrid>
    </AdminSettingsShell>
  )
}
