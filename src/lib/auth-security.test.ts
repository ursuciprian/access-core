import { isGoogleSignInAllowed, isOidcSignInAllowed, normalizeEmail } from './auth'

describe('auth security helpers', () => {
  it('normalizes emails to lowercase and trims spaces', () => {
    expect(normalizeEmail('  Admin@Example.com ')).toBe('admin@example.com')
  })

  it('rejects Google sign-in in production when no allowlist/domain is configured', () => {
    expect(isGoogleSignInAllowed('admin@example.com', { allowedDomain: null })).toBe(false)
  })

  it('allows Google sign-in for matching domains', () => {
    expect(isGoogleSignInAllowed('admin@example.com', { allowedDomain: 'example.com' })).toBe(true)
  })

  it('rejects Google sign-in for non-matching domains', () => {
    expect(isGoogleSignInAllowed('admin@other.com', { allowedDomain: 'example.com' })).toBe(false)
  })

  it('rejects Google sign-in when the provider says the email is unverified', () => {
    expect(isGoogleSignInAllowed('admin@example.com', {
      allowedDomain: 'example.com',
      emailVerified: false,
    })).toBe(false)
  })

  it('rejects Google sign-in without a domain restriction outside production too', () => {
    expect(isGoogleSignInAllowed('admin@other.com', { allowedDomain: null })).toBe(false)
  })

  it('rejects OIDC sign-in without a real email address', () => {
    expect(isOidcSignInAllowed({
      email: 'username-only',
      allowedDomains: ['example.com'],
      emailVerified: true,
    })).toBe(false)
  })

  it('rejects OIDC sign-in when the IdP says the email is unverified', () => {
    expect(isOidcSignInAllowed({
      email: 'admin@example.com',
      allowedDomains: ['example.com'],
      emailVerified: false,
    })).toBe(false)
  })

  it('allows OIDC sign-in for a verified user in an allowed domain', () => {
    expect(isOidcSignInAllowed({
      email: 'admin@example.com',
      allowedDomains: ['example.com'],
      emailVerified: true,
    })).toBe(true)
  })
})
