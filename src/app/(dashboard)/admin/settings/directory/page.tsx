'use client'

import {
  AdminSettingsShell,
  PageGrid,
  ReadonlyField,
  actionButtonStyle,
  cardStyle,
  inputStyle,
  useAdminSettings,
} from '../settings-shared'

export default function AdminDirectorySettingsPage() {
  const {
    form,
    loading,
    saving,
    saveSettings,
    testingLdap,
    ldapLookup,
    setLdapLookup,
    ldapDiagnostic,
    runLdapDiagnostic,
  } = useAdminSettings()

  return (
    <AdminSettingsShell
      title="Directory Settings"
      description="LDAP configuration, role mapping visibility, and connection diagnostics."
      loading={loading}
      saving={saving}
      onSave={saveSettings}
    >
      <PageGrid>
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                LDAP Configuration
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Environment-driven LDAP settings, role mapping, and diagnostics.
              </p>
            </div>
            <div style={{ fontSize: '12px', color: form.ldap.enabled ? '#22C55E' : 'var(--text-secondary)', fontWeight: 600 }}>
              {form.ldap.enabled ? 'Enabled via env' : 'Disabled via env'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <ReadonlyField label="LDAP URL" value={form.ldap.url ?? 'Not configured'} />
            <ReadonlyField label="Base DN" value={form.ldap.baseDn ?? 'Not configured'} />
            <ReadonlyField label="Bind DN" value={form.ldap.bindDn ?? 'Not configured'} />
            <ReadonlyField label="User Filter" value={form.ldap.userFilter ?? 'Not configured'} />
            <ReadonlyField label="Email Attribute" value={form.ldap.emailAttribute ?? 'Not configured'} />
            <ReadonlyField label="Display Name Attribute" value={form.ldap.displayNameAttribute ?? 'Not configured'} />
            <ReadonlyField label="Group Attribute" value={form.ldap.groupAttribute ?? 'Not configured'} />
            <ReadonlyField label="Role Sync" value={form.ldap.syncRoles ? 'Enabled' : 'Disabled'} />
            <ReadonlyField label="StartTLS" value={form.ldap.startTls ? 'Enabled' : 'Disabled'} />
            <ReadonlyField label="TLS Verification" value={form.ldap.tlsRejectUnauthorized ? 'Enabled' : 'Disabled'} />
            <ReadonlyField label="Admin Groups" value={form.ldap.adminGroups.length ? form.ldap.adminGroups.join(', ') : 'No admin mappings'} />
            <ReadonlyField label="Viewer Groups" value={form.ldap.viewerGroups.length ? form.ldap.viewerGroups.join(', ') : 'No viewer mappings'} />
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: ldapDiagnostic ? '16px' : 0 }}>
            <button
              onClick={() => runLdapDiagnostic('connectivity')}
              disabled={testingLdap || !form.ldap.enabled}
              style={actionButtonStyle(testingLdap || !form.ldap.enabled)}
            >
              {testingLdap ? 'Testing...' : 'Test LDAP Connectivity'}
            </button>
            <input
              type="text"
              value={ldapLookup}
              onChange={(event) => setLdapLookup(event.target.value)}
              placeholder="user@example.com"
              disabled={!form.ldap.enabled}
              style={{ ...inputStyle, maxWidth: '300px', opacity: form.ldap.enabled ? 1 : 0.5 }}
            />
            <button
              onClick={() => runLdapDiagnostic('lookup')}
              disabled={testingLdap || !form.ldap.enabled || !ldapLookup.trim()}
              style={actionButtonStyle(testingLdap || !form.ldap.enabled || !ldapLookup.trim())}
            >
              Preview LDAP User
            </button>
          </div>

          {ldapDiagnostic && (
            <div style={{
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: '#151515',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {'error' in ldapDiagnostic ? (
                <div style={{ fontSize: '13px', color: '#EF4444' }}>{String(ldapDiagnostic.error)}</div>
              ) : (
                <>
                  {'message' in ldapDiagnostic && (
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{String(ldapDiagnostic.message)}</div>
                  )}
                  {'identity' in ldapDiagnostic && ldapDiagnostic.identity && typeof ldapDiagnostic.identity === 'object' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <ReadonlyField label="DN" value={String((ldapDiagnostic.identity as Record<string, unknown>).dn ?? 'Unknown')} />
                      <ReadonlyField label="Email" value={String((ldapDiagnostic.identity as Record<string, unknown>).email ?? 'Unknown')} />
                      <ReadonlyField label="Display Name" value={String((ldapDiagnostic.identity as Record<string, unknown>).displayName ?? 'Unknown')} />
                      <ReadonlyField label="Mapped Role" value={String((ldapDiagnostic.identity as Record<string, unknown>).mappedRole ?? 'No mapping')} />
                      <ReadonlyField
                        label="Groups"
                        value={Array.isArray((ldapDiagnostic.identity as Record<string, unknown>).groups)
                          ? ((ldapDiagnostic.identity as Record<string, unknown>).groups as string[]).join(', ') || 'No groups'
                          : 'No groups'}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      </PageGrid>
    </AdminSettingsShell>
  )
}
