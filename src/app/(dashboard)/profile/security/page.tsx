'use client'

import {
  ProfileShell,
  PageGrid,
  cardStyle,
  listCardStyle,
  inputStyle,
  labelStyle,
  actionButtonStyle,
  ListPanel,
  useProfileData,
  formatDate,
  formatMethod,
  summarizeUserAgent,
  MfaSetupCard,
} from '../profile-shared'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy'

export default function ProfileSecurityPage() {
  const {
    loading,
    profile,
    recentLogin,
    passwordForm,
    setPasswordForm,
    savingPassword,
    handlePasswordUpdate,
    mfaSetup,
    mfaFlow,
    mfaCode,
    setMfaCode,
    reconfigureCurrentCode,
    setReconfigureCurrentCode,
    disableMfaCode,
    setDisableMfaCode,
    settingUpMfa,
    startingMfaReconfigure,
    enablingMfa,
    disablingMfa,
    handleStartMfaSetup,
    handleStartMfaReconfigure,
    handleEnableMfa,
    handleDisableMfa,
  } = useProfileData()

  return (
    <ProfileShell
      title="Profile"
      description="Manage MFA, review sign-in posture, and update account security settings."
      loading={loading}
    >
      {!profile ? (
        <div style={{ color: 'var(--text-secondary)' }}>Unable to load your profile.</div>
      ) : (
        <PageGrid minWidth={420}>
          <section style={cardStyle}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Security & Sign-in</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                Review your latest sign-in and update your password when this account supports it.
              </p>
            </div>

            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              <ListPanel
                title="Latest Sign-in"
                rows={[
                  { label: 'Method', value: recentLogin ? formatMethod(recentLogin.method) : 'No recent activity' },
                  { label: 'When', value: recentLogin ? formatDate(recentLogin.createdAt) : 'No recorded sign-ins' },
                  { label: 'IP Address', value: recentLogin?.ip ?? 'Unknown' },
                  { label: 'Client', value: recentLogin?.userAgent ? summarizeUserAgent(recentLogin.userAgent) : 'Unknown' },
                ]}
              />
            </div>

            <section style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>Multi-Factor Authentication</h4>
              {!profile.mfaAvailable ? (
                <div style={listCardStyle}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    TOTP-based MFA is disabled by environment configuration.
                  </div>
                </div>
              ) : profile.mfaEnabled ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <ListPanel
                    title="TOTP Protection"
                    rows={[
                      { label: 'Status', value: 'Enabled' },
                      { label: 'Method', value: 'Authenticator app' },
                      { label: 'Enabled On', value: formatDate(profile.mfaEnabledAt) },
                    ]}
                  />
                  <form onSubmit={handleStartMfaReconfigure} style={{ ...listCardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Reconfigure authenticator</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Changing phones? Enter a current authenticator code to generate a new QR code and move MFA to your new device.
                    </div>
                    <div>
                      <label style={labelStyle}>Current MFA Code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={reconfigureCurrentCode}
                        onChange={(event) => setReconfigureCurrentCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        style={{ ...inputStyle, fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', textAlign: 'center' }}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={startingMfaReconfigure || reconfigureCurrentCode.length !== 6}
                      style={actionButtonStyle(startingMfaReconfigure || reconfigureCurrentCode.length !== 6)}
                    >
                      {startingMfaReconfigure ? 'Preparing...' : 'Generate new QR'}
                    </button>
                  </form>

                  {mfaSetup && mfaFlow === 'reconfigure' && (
                    <MfaSetupCard
                      setup={mfaSetup}
                      code={mfaCode}
                      onCodeChange={setMfaCode}
                      onSubmit={handleEnableMfa}
                      submitting={enablingMfa}
                      label="New Device Code"
                      description="Scan this QR code with your new phone, then enter the new 6-digit code to complete the MFA transfer."
                    />
                  )}

                  {!profile.mfaRequired && (
                    <form onSubmit={handleDisableMfa} style={{ ...listCardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        Enter a current authenticator code to disable MFA for this account.
                      </div>
                      <div>
                        <label style={labelStyle}>Current MFA Code</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={disableMfaCode}
                          onChange={(event) => setDisableMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', textAlign: 'center' }}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={disablingMfa || disableMfaCode.length !== 6}
                        style={actionButtonStyle(disablingMfa || disableMfaCode.length !== 6, true)}
                      >
                        {disablingMfa ? 'Disabling...' : 'Disable MFA'}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={listCardStyle}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
                      Protect your AccessCore account with a 6-digit authenticator code after sign-in.
                    </div>
                    <button
                      type="button"
                      onClick={handleStartMfaSetup}
                      disabled={settingUpMfa}
                      style={actionButtonStyle(settingUpMfa)}
                    >
                      {settingUpMfa ? 'Preparing...' : 'Set up TOTP MFA'}
                    </button>
                  </div>

                  {mfaSetup && mfaFlow === 'setup' && (
                    <MfaSetupCard
                      setup={mfaSetup}
                      code={mfaCode}
                      onCodeChange={setMfaCode}
                      onSubmit={handleEnableMfa}
                      submitting={enablingMfa}
                      label="Verification Code"
                      description="Scan this QR code with your authenticator app, or use the manual key if you prefer setup by hand. Then enter the current 6-digit code to enable MFA."
                    />
                  )}
                </div>
              )}
            </section>

            <section>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>Change Password</h4>
              {profile.hasPassword ? (
                <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Current Password</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>New Password</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                      style={inputStyle}
                      minLength={MIN_PASSWORD_LENGTH}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                      style={inputStyle}
                      minLength={MIN_PASSWORD_LENGTH}
                      required
                    />
                  </div>
                  <button type="submit" disabled={savingPassword} style={actionButtonStyle(savingPassword)}>
                    {savingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              ) : (
                <div style={listCardStyle}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    This account signs in through {formatMethod(profile.authMethod)} only, so password changes are not available here.
                  </div>
                </div>
              )}
            </section>
          </section>
        </PageGrid>
      )}
    </ProfileShell>
  )
}
