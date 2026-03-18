'use client'

import {
  AdminSettingsShell,
  PageGrid,
  ToggleField,
  ReadonlyField,
  cardStyle,
  useAdminSettings,
} from '../settings-shared'

export default function AdminIntegrationsSettingsPage() {
  const { form, setForm, loading, saving, saveSettings } = useAdminSettings()

  return (
    <AdminSettingsShell
      title="Integration Settings"
      description="External identity and directory integration controls for AccessCore."
      loading={loading}
      saving={saving}
      onSave={saveSettings}
    >
      <PageGrid>
        <section style={cardStyle}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
            Google Workspace
          </p>
          <div style={{ display: 'grid', gap: '16px' }}>
            <ToggleField
              label="Google Sync"
              description="Allow Google Workspace group sync jobs to run from AccessCore."
              checked={form.googleSyncEnabled}
              onChange={(checked) => setForm((current) => ({ ...current, googleSyncEnabled: checked }))}
            />
            <ReadonlyField label="Allowed Domain" value={form.allowedDomain ?? 'Not configured'} />
          </div>
        </section>

        <section style={cardStyle}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            Identity Model
          </p>
          <p style={{ fontSize: '13px', color: '#888888', margin: 0, lineHeight: 1.6 }}>
            Google OAuth domain restrictions are environment-backed. Directory sync is controlled here, while LDAP configuration and diagnostics live in the Directory section.
          </p>
        </section>
      </PageGrid>
    </AdminSettingsShell>
  )
}
