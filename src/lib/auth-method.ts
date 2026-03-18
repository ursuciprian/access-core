export type AuthMethodLabel = 'Credentials' | 'Google' | 'LDAP' | 'SSO' | 'Multiple'

export function getAuthMethodLabel(hasPassword: boolean, loginMethods: string[]): AuthMethodLabel {
  const methods = new Set(loginMethods)
  const hasGoogle = methods.has('google')
  const hasLdap = methods.has('ldap')
  const hasSso = methods.has('sso')
  const hasCredentials = hasPassword

  const activeMethodCount = [hasCredentials, hasGoogle, hasLdap, hasSso].filter(Boolean).length
  if (activeMethodCount > 1) {
    return 'Multiple'
  }

  if (hasCredentials) {
    return 'Credentials'
  }

  if (hasLdap) {
    return 'LDAP'
  }

  if (hasSso) {
    return 'SSO'
  }

  return 'Google'
}
