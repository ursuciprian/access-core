const { withAuthMock } = vi.hoisted(() => ({
  withAuthMock: vi.fn((handler) => handler),
}))

vi.mock('next-auth/middleware', () => ({
  withAuth: withAuthMock,
}))

vi.mock('@/lib/features', () => ({
  isMfaOnboardingRequired: vi.fn(() => true),
}))

import middleware, { config } from './middleware'
import { isMfaOnboardingRequired } from '@/lib/features'

const isMfaOnboardingRequiredMock = vi.mocked(isMfaOnboardingRequired)

describe('middleware matcher', () => {
  beforeEach(() => {
    isMfaOnboardingRequiredMock.mockReturnValue(true)
  })

  it('does not exclude the access-requests API subtree from auth', () => {
    expect(config.matcher[0]).not.toContain('api/access-requests')
  })

  it('keeps the public server list excluded from auth', () => {
    expect(config.matcher[0]).toContain('api/servers/public')
  })

  it('redirects unapproved users away from protected dashboard routes', () => {
    const response = middleware({
      nextauth: { token: { isApproved: false } },
      nextUrl: { pathname: '/dashboard' },
      url: 'http://localhost/dashboard',
    } as never)

    expect(response.headers.get('location')).toBe('http://localhost/pending-approval')
  })

  it('allows unapproved users to keep using pending approval and access request routes', () => {
    const pendingApprovalResponse = middleware({
      nextauth: { token: { isApproved: false } },
      nextUrl: { pathname: '/pending-approval' },
      url: 'http://localhost/pending-approval',
    } as never)
    const accessRequestsResponse = middleware({
      nextauth: { token: { isApproved: false } },
      nextUrl: { pathname: '/api/access-requests' },
      url: 'http://localhost/api/access-requests',
    } as never)

    expect(pendingApprovalResponse.headers.get('location')).toBeNull()
    expect(accessRequestsResponse.headers.get('location')).toBeNull()
  })

  it('redirects MFA-enabled users to verification until the second factor is completed', () => {
    const response = middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: true, mfaVerified: false } },
      nextUrl: { pathname: '/profile' },
      url: 'http://localhost/profile',
    } as never)

    expect(response.headers.get('location')).toBe('http://localhost/mfa/verify')
  })

  it('returns 403 for protected API calls when MFA is required', async () => {
    const response = middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: true, mfaVerified: false } },
      nextUrl: { pathname: '/api/profile' },
      url: 'http://localhost/api/profile',
    } as never)

    expect(response.status).toBe(403)
  })

  it('redirects approved users without MFA enrolled to the setup screen', () => {
    const response = middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: false, mfaVerified: true } },
      nextUrl: { pathname: '/', search: '' },
      url: 'http://localhost/',
    } as never)

    expect(response.headers.get('location')).toBe('http://localhost/mfa/setup?callbackUrl=%2F')
  })

  it('returns 403 for protected API calls until MFA setup is completed', () => {
    const response = middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: false, mfaVerified: true } },
      nextUrl: { pathname: '/api/profile', search: '' },
      url: 'http://localhost/api/profile',
    } as never)

    expect(response.status).toBe(403)
  })

  it('allows the MFA setup route while enrollment is pending', () => {
    const response = middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: false, mfaVerified: true } },
      nextUrl: { pathname: '/mfa/setup', search: '' },
      url: 'http://localhost/mfa/setup',
    } as never)

    expect(response.headers.get('location')).toBeNull()
  })
})
