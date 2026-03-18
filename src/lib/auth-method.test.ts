import { getAuthMethodLabel } from './auth-method'

describe('getAuthMethodLabel', () => {
  it('returns Credentials for password-only users', () => {
    expect(getAuthMethodLabel(true, ['credentials'])).toBe('Credentials')
  })

  it('returns Google for oauth-only users', () => {
    expect(getAuthMethodLabel(false, ['google'])).toBe('Google')
  })

  it('returns LDAP for ldap-only users', () => {
    expect(getAuthMethodLabel(false, ['ldap'])).toBe('LDAP')
  })

  it('returns Multiple when more than one auth method is present', () => {
    expect(getAuthMethodLabel(true, ['credentials', 'google'])).toBe('Multiple')
  })
})
