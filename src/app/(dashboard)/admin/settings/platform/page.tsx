'use client'

import {
  AdminSettingsShell,
  PageGrid,
  ReadonlyFlag,
  SettingsInfoRow,
  ToggleField,
  cardStyle,
  useAdminSettings,
} from '../settings-shared'

export default function AdminPlatformSettingsPage() {
  const { form, setForm, loading, saving, saveSettings } = useAdminSettings()

  return (
    <AdminSettingsShell
      title="Platform Settings"
      description="Platform-level controls, maintenance posture, and environment-driven capabilities."
      loading={loading}
      saving={saving}
      onSave={saveSettings}
    >
      <PageGrid>
        <section style={cardStyle}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
            Platform
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SettingsInfoRow label="Portal" value="AccessCore" />
            <SettingsInfoRow label="Settings Model" value="Database-backed with environment overrides" />
            <SettingsInfoRow label="Authentication" value="Credentials, Google OAuth, OIDC SSO, optional LDAP" />
            <SettingsInfoRow label="MFA" value={form.featureFlags.totpMfaEnabled ? 'TOTP enabled' : 'Disabled'} />
            <SettingsInfoRow label="Server Ops" value={form.featureFlags.serverManagementEnabled ? 'Enabled' : 'Disabled'} />
          </div>
        </section>

        <section style={cardStyle}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
            Portal State
          </p>
          <ToggleField
            label="Maintenance Mode"
            description="Show a maintenance banner and clearly signal that AccessCore is under maintenance."
            checked={form.maintenanceMode}
            onChange={(checked) => setForm((current) => ({ ...current, maintenanceMode: checked }))}
          />
        </section>

        <section style={cardStyle}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
            Environment Flags
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <ReadonlyFlag
              label="Server Management"
              description="Enables server edits, imports, logs, drift detection, and operational controls."
              enabled={form.featureFlags.serverManagementEnabled}
              source="Environment"
            />
            <ReadonlyFlag
              label="LDAP Authentication"
              description="Allows LDAP sign-in and LDAP-based role mapping through the credentials form."
              enabled={form.featureFlags.ldapEnabled}
              source="Environment"
            />
            <ReadonlyFlag
              label="OIDC SSO"
              description="Allows OpenID Connect single sign-on through an external identity provider."
              enabled={form.featureFlags.oidcSsoEnabled}
              source="Environment"
            />
            <ReadonlyFlag
              label="TOTP MFA"
              description="Makes TOTP MFA available for AccessCore accounts."
              enabled={form.featureFlags.totpMfaEnabled}
              source="Environment"
            />
            <ReadonlyFlag
              label="Mandatory MFA Onboarding"
              description="Requires newly approved users to complete MFA setup before using AccessCore."
              enabled={form.featureFlags.mfaOnboardingRequired}
              source="Environment"
            />
          </div>
        </section>
      </PageGrid>
    </AdminSettingsShell>
  )
}
