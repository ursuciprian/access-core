'use client'

import {
  AdminSettingsShell,
  PageGrid,
  ToggleField,
  cardStyle,
  inputStyle,
  labelStyle,
  useAdminSettings,
} from '../settings-shared'

export default function AdminAccessSettingsPage() {
  const { form, setForm, loading, saving, saveSettings } = useAdminSettings()

  return (
    <AdminSettingsShell
      title="Access Settings"
      description="Default approval behavior and the initial VPN server selection for new users."
      loading={loading}
      saving={saving}
      onSave={saveSettings}
    >
      <PageGrid>
        <section style={cardStyle}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
            New User Defaults
          </p>
          <div style={{ display: 'grid', gap: '16px' }}>
            <ToggleField
              label="Auto-Approve Users"
              description="Newly created AccessCore users are approved immediately instead of waiting for manual approval."
              checked={form.autoApproveUsers}
              onChange={(checked) => setForm((current) => ({ ...current, autoApproveUsers: checked }))}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Default Role</label>
                <select
                  value={form.defaultUserRole}
                  onChange={(event) => setForm((current) => ({ ...current, defaultUserRole: event.target.value as 'ADMIN' | 'VIEWER' }))}
                  style={inputStyle}
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Default VPN Server</label>
                <select
                  value={form.defaultVpnServerId ?? ''}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    defaultVpnServerId: event.target.value || null,
                  }))}
                  style={inputStyle}
                >
                  <option value="">First active server</option>
                  {form.availableVpnServers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name} ({server.hostname})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            First Login Behavior
          </p>
          <p style={{ fontSize: '13px', color: '#888888', margin: 0, lineHeight: 1.6 }}>
            When a non-admin user signs in for the first time, AccessCore auto-creates an access request against the selected default VPN server.
            If no default server is selected, the first active server is used as fallback.
          </p>
        </section>
      </PageGrid>
    </AdminSettingsShell>
  )
}
