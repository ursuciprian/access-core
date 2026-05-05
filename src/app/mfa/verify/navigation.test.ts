import { getPostVerifyDestination, getSafeCallbackUrl } from './navigation'

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

  it('sanitizes unsafe callback urls before redirecting approved users', () => {
    expect(getPostVerifyDestination({
      callbackUrl: '//evil.example',
      isApproved: true,
    })).toBe('/')
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

describe('getSafeCallbackUrl', () => {
  it('keeps internal callback paths', () => {
    expect(getSafeCallbackUrl('/analytics')).toBe('/analytics')
  })

  it('rejects absolute external callback urls', () => {
    expect(getSafeCallbackUrl('https://evil.example')).toBe('/')
  })

  it('rejects protocol-relative callback urls', () => {
    expect(getSafeCallbackUrl('//evil.example')).toBe('/')
  })

  it('rejects backslash and control-character callback urls', () => {
    expect(getSafeCallbackUrl('/\\evil.example')).toBe('/')
    expect(getSafeCallbackUrl('/\nadmin')).toBe('/')
  })
})
