function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback
  }

  return value === '1' || value.toLowerCase() === 'true'
}

export interface FeatureFlags {
  serverManagementEnabled: boolean
  ldapEnabled: boolean
  oidcSsoEnabled: boolean
  totpMfaEnabled: boolean
  mfaOnboardingRequired: boolean
}

export const SERVER_MANAGEMENT_DISABLED_MESSAGE = 'Server management is disabled by environment configuration'

export function getFeatureFlags(): FeatureFlags {
  return {
    serverManagementEnabled: parseBoolean(process.env.SERVER_MANAGEMENT_ENABLED, true),
    ldapEnabled: parseBoolean(process.env.LDAP_ENABLED, false),
    oidcSsoEnabled: parseBoolean(process.env.OIDC_SSO_ENABLED, false),
    totpMfaEnabled: parseBoolean(process.env.TOTP_MFA_ENABLED, true),
    mfaOnboardingRequired: parseBoolean(process.env.MFA_ONBOARDING_REQUIRED, true),
  }
}

export function isServerManagementEnabled(): boolean {
  return getFeatureFlags().serverManagementEnabled
}

export function isTotpMfaEnabled(): boolean {
  return getFeatureFlags().totpMfaEnabled
}

export function isMfaOnboardingRequired(): boolean {
  const flags = getFeatureFlags()
  return flags.totpMfaEnabled && flags.mfaOnboardingRequired
}
