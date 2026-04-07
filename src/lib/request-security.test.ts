import { NextRequest } from 'next/server'
import {
  enforceTrustedOriginForMutation,
  isMutationMethod,
} from './request-security'

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init)
}

describe('isMutationMethod', () => {
  it('recognizes mutating HTTP methods', () => {
    expect(isMutationMethod('POST')).toBe(true)
    expect(isMutationMethod('put')).toBe(true)
    expect(isMutationMethod('PATCH')).toBe(true)
    expect(isMutationMethod('DELETE')).toBe(true)
    expect(isMutationMethod('GET')).toBe(false)
  })
})

describe('enforceTrustedOriginForMutation', () => {
  const originalNextAuthUrl = process.env.NEXTAUTH_URL
  const originalTrustedOrigins = process.env.CSRF_TRUSTED_ORIGINS

  beforeEach(() => {
    process.env.NEXTAUTH_URL = 'https://portal.example.com'
    delete process.env.CSRF_TRUSTED_ORIGINS
  })

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalNextAuthUrl
    process.env.CSRF_TRUSTED_ORIGINS = originalTrustedOrigins
  })

  it('allows safe methods without origin checks', () => {
    const response = enforceTrustedOriginForMutation(
      makeRequest('https://portal.example.com/api/profile')
    )

    expect(response).toBeNull()
  })

  it('allows mutation requests from the request origin', () => {
    const response = enforceTrustedOriginForMutation(
      makeRequest('http://localhost:3000/api/profile', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
        },
      })
    )

    expect(response).toBeNull()
  })

  it('allows mutation requests from the referer origin when origin is missing', () => {
    const response = enforceTrustedOriginForMutation(
      makeRequest('https://portal.example.com/api/profile', {
        method: 'POST',
        headers: {
          referer: 'https://portal.example.com/settings/profile',
        },
      })
    )

    expect(response).toBeNull()
  })

  it('allows configured extra trusted origins', () => {
    process.env.CSRF_TRUSTED_ORIGINS = 'https://admin.example.com, https://support.example.com'

    const response = enforceTrustedOriginForMutation(
      makeRequest('https://portal.example.com/api/profile', {
        method: 'DELETE',
        headers: {
          origin: 'https://admin.example.com',
        },
      })
    )

    expect(response).toBeNull()
  })

  it('blocks cross-site mutation requests', async () => {
    const response = enforceTrustedOriginForMutation(
      makeRequest('https://portal.example.com/api/profile', {
        method: 'POST',
        headers: {
          origin: 'https://attacker.example.com',
        },
      })
    )

    expect(response?.status).toBe(403)
    await expect(response?.json()).resolves.toEqual({
      error: 'Forbidden: cross-site request blocked',
    })
  })

  it('blocks mutation requests when both origin and referer are missing', async () => {
    const response = enforceTrustedOriginForMutation(
      makeRequest('https://portal.example.com/api/profile', {
        method: 'PATCH',
      })
    )

    expect(response?.status).toBe(403)
    await expect(response?.json()).resolves.toEqual({
      error: 'Forbidden: cross-site request blocked',
    })
  })
})
