'use client'

import {
  ProfileShell,
  PageGrid,
  cardStyle,
  listCardStyle,
  ListRows,
  StatusBadge,
  formatDate,
  useProfileData,
} from '../profile-shared'

export default function ProfileAccessPage() {
  const { loading, profile } = useProfileData()

  return (
    <ProfileShell
      title="Profile"
      description="Review approved VPN access, certificate readiness, and server-by-server account state."
      loading={loading}
    >
      {!profile ? (
        <div style={{ color: 'var(--text-secondary)' }}>Unable to load your profile.</div>
      ) : (
        <PageGrid minWidth={420}>
          <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>VPN Access</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                Approved servers, certificate state, and account readiness.
              </p>
            </div>
            {profile.access.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>No approved VPN access has been granted yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {profile.access.map((entry) => (
                  <div key={entry.id} style={listCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{entry.server.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>{entry.server.hostname}</div>
                      </div>
                      <StatusBadge value={entry.certStatus} />
                    </div>
                    <ListRows
                      rows={[
                        { label: 'Approved', value: formatDate(entry.approvedAt) },
                        { label: 'Certificate Expiry', value: formatDate(entry.certExpiresAt) },
                        { label: 'Account Status', value: entry.isEnabled ? 'Enabled' : 'Disabled' },
                      ]}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </PageGrid>
      )}
    </ProfileShell>
  )
}
