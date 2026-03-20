'use client'

import {
  ProfileShell,
  PageGrid,
  cardStyle,
  listCardStyle,
  ListRows,
  useProfileData,
  formatDate,
  formatMethod,
  summarizeUserAgent,
} from '../profile-shared'

function methodColors(method: string) {
  if (method === 'google') {
    return { background: 'rgba(59,130,246,0.12)', color: '#60A5FA' }
  }
  if (method === 'ldap') {
    return { background: 'rgba(34,197,94,0.12)', color: '#4ADE80' }
  }
  if (method === 'sso' || method === 'oidc') {
    return { background: 'rgba(168,85,247,0.12)', color: '#C084FC' }
  }

  return { background: 'rgba(234,126,32,0.12)', color: 'var(--accent)' }
}

export default function ProfileActivityPage() {
  const { loading, profile, sessions, recentLogin } = useProfileData()

  return (
    <ProfileShell
      title="Profile"
      description="Review recent sign-in events, methods, and origin details for your AccessCore account."
      loading={loading}
    >
      {!profile ? (
        <div style={{ color: 'var(--text-secondary)' }}>Unable to load your profile.</div>
      ) : (
        <PageGrid minWidth={420}>
          <section style={cardStyle}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Recent Login Activity</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                Review the latest sign-ins, their method, and device context.
              </p>
            </div>

            {recentLogin ? (
              <div style={{ ...listCardStyle, marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(recentLogin.createdAt)}</div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 9px',
                    borderRadius: '9999px',
                    ...methodColors(recentLogin.method),
                  }}>
                    {formatMethod(recentLogin.method)}
                  </span>
                </div>
                <ListRows
                  rows={[
                    { label: 'IP Address', value: recentLogin.ip ?? 'Unknown' },
                    { label: 'Client', value: recentLogin.userAgent ? summarizeUserAgent(recentLogin.userAgent) : 'Unknown' },
                  ]}
                />
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>No login activity has been recorded yet.</p>
            )}

            {sessions.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sessions.slice(1).map((session) => (
                  <div key={session.id} style={listCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(session.createdAt)}</div>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 9px',
                        borderRadius: '9999px',
                        ...methodColors(session.method),
                      }}>
                        {formatMethod(session.method)}
                      </span>
                    </div>
                    <ListRows
                      rows={[
                        { label: 'IP Address', value: session.ip ?? 'Unknown' },
                        { label: 'Client', value: session.userAgent ? summarizeUserAgent(session.userAgent) : 'Unknown' },
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
