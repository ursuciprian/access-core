const { withAuthMock } = vi.hoisted(() => ({
  withAuthMock: vi.fn((handler) => handler),
}))

const fetchMock = vi.fn()

vi.mock('next-auth/middleware', () => ({
  withAuth: withAuthMock,
}))

vi.mock('@/lib/features', () => ({
  isMfaOnboardingRequired: vi.fn(() => true),
}))

vi.mock('@/lib/mfa-cookie', () => ({
  MFA_VERIFICATION_COOKIE: 'accesscore_mfa_verified',
  isValidMfaVerificationCookie: vi.fn(),
}))

import middleware, { config } from './middleware'
import { isMfaOnboardingRequired } from '@/lib/features'
import { isValidMfaVerificationCookie } from '@/lib/mfa-cookie'

const isMfaOnboardingRequiredMock = vi.mocked(isMfaOnboardingRequired)
const isValidMfaVerificationCookieMock = vi.mocked(isValidMfaVerificationCookie)

describe('middleware matcher', () => {
  beforeEach(() => {
    isMfaOnboardingRequiredMock.mockReturnValue(true)
    isValidMfaVerificationCookieMock.mockReset()
    isValidMfaVerificationCookieMock.mockResolvedValue(false)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('does not exclude the access-requests API subtree from auth', () => {
    expect(config.matcher[0]).not.toContain('api/access-requests')
  })

  it('protects the public server list with auth now that it no longer exposes hostnames', () => {
    expect(config.matcher[0]).not.toContain('api/servers/public')
  })

  it('redirects unapproved users away from protected dashboard routes', async () => {
    const response = await middleware({
      nextauth: { token: { isApproved: false } },
      nextUrl: { pathname: '/dashboard' },
      cookies: { get: vi.fn() },
      url: 'http://localhost/dashboard',
    } as never)

    expect(response.headers.get('location')).toBe('http://localhost/pending-approval')
  })

  it('allows unapproved users to keep using pending approval, access request, and server list routes', async () => {
    const pendingApprovalResponse = await middleware({
      nextauth: { token: { isApproved: false } },
      nextUrl: { pathname: '/pending-approval' },
      cookies: { get: vi.fn() },
      url: 'http://localhost/pending-approval',
    } as never)
    const accessRequestsResponse = await middleware({
      nextauth: { token: { isApproved: false } },
      nextUrl: { pathname: '/api/access-requests' },
      cookies: { get: vi.fn() },
      url: 'http://localhost/api/access-requests',
    } as never)
    const serversResponse = await middleware({
      nextauth: { token: { isApproved: false } },
      nextUrl: { pathname: '/api/servers/public' },
      cookies: { get: vi.fn() },
      url: 'http://localhost/api/servers/public',
    } as never)

    expect(pendingApprovalResponse.headers.get('location')).toBeNull()
    expect(accessRequestsResponse.headers.get('location')).toBeNull()
    expect(serversResponse.headers.get('location')).toBeNull()
  })

  it('redirects MFA-enabled users to verification until the second factor is completed', async () => {
    const response = await middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: true, mfaVerified: false, userId: 'u1', authSessionId: 's1' } },
      nextUrl: { pathname: '/profile' },
      cookies: { get: vi.fn(() => undefined) },
      url: 'http://localhost/profile',
    } as never)

    expect(response.headers.get('location')).toBe('http://localhost/mfa/verify')
  })

  it('returns 403 for protected API calls when MFA is required', async () => {
    const response = await middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: true, mfaVerified: false, userId: 'u1', authSessionId: 's1' } },
      nextUrl: { pathname: '/api/profile' },
      cookies: { get: vi.fn(() => undefined) },
      url: 'http://localhost/api/profile',
    } as never)

    expect(response.status).toBe(403)
  })

  it('does not bypass MFA when the JWT claims mfaVerified=true without a valid server-issued cookie (F-01 regression)', async () => {
    // Attempted bypass: client called update({ mfaVerified: true }) but never
    // completed TOTP, so the signed MFA cookie is absent / invalid.
    isValidMfaVerificationCookieMock.mockResolvedValue(false)

    const response = await middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: true, mfaVerified: true, userId: 'u1', authSessionId: 's1' } },
      nextUrl: { pathname: '/dashboard', search: '' },
      cookies: { get: vi.fn(() => undefined) },
      url: 'http://localhost/dashboard',
    } as never)

    expect(response.headers.get('location')).toBe('http://localhost/mfa/verify')
  })

  it('redirects already-verified users away from the MFA verify screen when the cookie is valid', async () => {
    isValidMfaVerificationCookieMock.mockResolvedValue(true)

    const response = await middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: true, mfaVerified: false, userId: 'u1', authSessionId: 's1' } },
      nextUrl: {
        pathname: '/mfa/verify',
        search: '?callbackUrl=%2Fanalytics',
        searchParams: new URLSearchParams('callbackUrl=%2Fanalytics'),
      },
      cookies: { get: vi.fn(() => ({ value: 'signed-cookie' })) },
      url: 'http://localhost/mfa/verify?callbackUrl=%2Fanalytics',
    } as never)

    expect(response.headers.get('location')).toBe('http://localhost/analytics')
  })

  it('does not redirect already-verified users to protocol-relative callback URLs', async () => {
    isValidMfaVerificationCookieMock.mockResolvedValue(true)

    const response = await middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: true, mfaVerified: false, userId: 'u1', authSessionId: 's1' } },
      nextUrl: {
        pathname: '/mfa/verify',
        search: '?callbackUrl=%2F%2Fevil.example',
        searchParams: new URLSearchParams('callbackUrl=%2F%2Fevil.example'),
      },
      cookies: { get: vi.fn(() => ({ value: 'signed-cookie' })) },
      url: 'http://localhost/mfa/verify?callbackUrl=%2F%2Fevil.example',
    } as never)

    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('redirects approved users without MFA enrolled to the setup screen', async () => {
    const response = await middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: false, mfaVerified: true } },
      nextUrl: { pathname: '/', search: '' },
      cookies: { get: vi.fn() },
      url: 'http://localhost/',
    } as never)

    expect(response.headers.get('location')).toBe('http://localhost/mfa/setup?callbackUrl=%2F')
  })

  it('returns 403 for protected API calls until MFA setup is completed', async () => {
    const response = await middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: false, mfaVerified: true } },
      nextUrl: { pathname: '/api/profile', search: '' },
      cookies: { get: vi.fn() },
      url: 'http://localhost/api/profile',
    } as never)

    expect(response.status).toBe(403)
  })

  it('allows the MFA setup route while enrollment is pending', async () => {
    const response = await middleware({
      nextauth: { token: { isApproved: true, mfaEnabled: false, mfaVerified: true } },
      nextUrl: { pathname: '/mfa/setup', search: '' },
      cookies: { get: vi.fn() },
      url: 'http://localhost/mfa/setup',
    } as never)

    expect(response.headers.get('location')).toBeNull()
  })

  it('rejects TRACE requests with 405', async () => {
    const response = await middleware({
      method: 'TRACE',
      nextauth: { token: { isApproved: true, mfaEnabled: false, mfaVerified: true } },
      nextUrl: { pathname: '/', search: '' },
      cookies: { get: vi.fn() },
      url: 'http://localhost/',
    } as never)

    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toContain('GET')
  })
})
