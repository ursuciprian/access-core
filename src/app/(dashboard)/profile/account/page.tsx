'use client'

import {
  ProfileShell,
  PageGrid,
  cardStyle,
  ListPanel,
  formatDate,
  formatMethod,
  useProfileData,
} from '../profile-shared'

export default function ProfileAccountPage() {
  const {
    loading,
    profile,
    activeAccessCount,
    activeCertCount,
    vpnReadiness,
  } = useProfileData()

  return (
    <ProfileShell
      title="Profile"
      description="Manage your account details, sign-in posture, and personal access overview."
      loading={loading}
    >
      {!profile ? (
        <div style={{ color: '#888888' }}>Unable to load your profile.</div>
      ) : (
        <PageGrid minWidth={420}>
          <section style={{ ...cardStyle, background: 'linear-gradient(180deg, rgba(234,126,32,0.08) 0%, #111111 54%)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '18px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#EA7E20', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  AccessCore Account
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#F0F0F0', margin: 0 }}>{profile.email}</h3>
                <p style={{ fontSize: '13px', color: '#888888', margin: '8px 0 0', lineHeight: 1.6 }}>
                  Account details, role, and sign-in method for your AccessCore account.
                </p>
              </div>
              <div style={{
                padding: '8px 12px',
                borderRadius: '9999px',
                background: 'rgba(234,126,32,0.12)',
                border: '1px solid rgba(234,126,32,0.22)',
                color: '#EA7E20',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                {profile.role}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '12px' }}>
              <ListPanel
                title="Account Details"
                rows={[
                  { label: 'Sign-in Method', value: formatMethod(profile.authMethod) },
                  { label: 'Member Since', value: new Date(profile.createdAt).toLocaleDateString() },
                  { label: 'Last Login', value: formatDate(profile.lastLoginAt) },
                ]}
              />
              <ListPanel
                title="Access Summary"
                rows={[
                  { label: 'Enabled Access', value: String(activeAccessCount) },
                  { label: 'Active Certificates', value: String(activeCertCount) },
                  { label: 'VPN Readiness', value: vpnReadiness },
                ]}
              />
            </div>
          </section>
        </PageGrid>
      )}
    </ProfileShell>
  )
}
