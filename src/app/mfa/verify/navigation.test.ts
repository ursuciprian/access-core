import { getPostVerifyDestination } from './navigation'

describe('getPostVerifyDestination', () => {
  it('sends unapproved users to pending approval', () => {
    expect(getPostVerifyDestination({
      callbackUrl: '/analytics',
      isApproved: false,
    })).toBe('/pending-approval')
  })

  it('uses the callback url for approved users', () => {
    expect(getPostVerifyDestination({
      callbackUrl: '/analytics',
      isApproved: true,
    })).toBe('/analytics')
  })

  it('falls back to root when callback is missing', () => {
    expect(getPostVerifyDestination({
      callbackUrl: null,
      isApproved: true,
    })).toBe('/')
  })

  it('avoids redirecting back to the verify page', () => {
    expect(getPostVerifyDestination({
      callbackUrl: '/mfa/verify',
      isApproved: true,
    })).toBe('/')
  })
})
