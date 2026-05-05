import { validateDeploymentSecurityConfig } from './deployment-security'

describe('validateDeploymentSecurityConfig', () => {
  it('rejects production default secrets and relaxed CSP', () => {
    expect(validateDeploymentSecurityConfig({
      NODE_ENV: 'production',
      NEXTAUTH_SECRET: 'change-me-in-production',
      ALLOW_UNSAFE_INLINE_CSP: 'true',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/openvpn_gui',
    })).toEqual([
      expect.objectContaining({ id: 'default-nextauth-secret', severity: 'critical' }),
      expect.objectContaining({ id: 'relaxed-production-csp', severity: 'critical' }),
      expect.objectContaining({ id: 'local-production-database', severity: 'warning' }),
    ])
  })

  it('accepts strict production settings', () => {
    expect(validateDeploymentSecurityConfig({
      NODE_ENV: 'production',
      NEXTAUTH_SECRET: 'a-strong-random-secret-that-is-not-the-default',
      ALLOW_UNSAFE_INLINE_CSP: 'false',
      DATABASE_URL: 'postgresql://accesscore:secret@db.internal:5432/accesscore',
    })).toEqual([])
  })

  it('does not block local development defaults', () => {
    expect(validateDeploymentSecurityConfig({
      NODE_ENV: 'development',
      NEXTAUTH_SECRET: 'change-me-in-production',
      ALLOW_UNSAFE_INLINE_CSP: 'true',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/openvpn_gui',
    })).toEqual([])
  })
})
