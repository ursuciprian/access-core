import { requireApprovedUser, requireAuth, requireRole } from './rbac'
import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('./auth', () => ({
  authOptions: {},
}))

import { getServerSession } from 'next-auth'

function makeRequest(url = 'http://localhost/api/test'): NextRequest {
  return new NextRequest(url)
}

function makeMutatingRequest(
  url = 'http://localhost/api/test',
  init?: RequestInit
): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
}

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const handler = vi.fn()
    const wrapped = requireAuth()(handler)
    const response = await wrapped(makeRequest())

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 401 when session exists but has no email', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: 'No Email' } } as never)

    const handler = vi.fn()
    const wrapped = requireAuth()(handler)
    const response = await wrapped(makeRequest())

    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('calls the handler when session has an email', async () => {
    const session = { user: { email: 'admin@example.com', role: UserRole.ADMIN } }
    vi.mocked(getServerSession).mockResolvedValue(session as never)

    const mockResponse = NextResponse.json({ ok: true })
    const handler = vi.fn().mockResolvedValue(mockResponse)
    const wrapped = requireAuth()(handler)
    const req = makeRequest()
    const response = await wrapped(req)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(req, session, undefined)
    expect(response.status).toBe(200)
  })

  it('passes context through to the handler', async () => {
    const session = { user: { email: 'admin@example.com' } }
    vi.mocked(getServerSession).mockResolvedValue(session as never)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({}))
    const wrapped = requireAuth()(handler)
    const req = makeRequest()
    const ctx = { params: { id: '42' } }
    await wrapped(req, ctx)

    expect(handler).toHaveBeenCalledWith(req, session, ctx)
  })

  it('allows unapproved users through for explicitly auth-only routes', async () => {
    const session = { user: { email: 'viewer@example.com', role: UserRole.VIEWER, isApproved: false } }
    vi.mocked(getServerSession).mockResolvedValue(session as never)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = requireAuth()(handler)
    const response = await wrapped(makeRequest())

    expect(handler).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
  })

  it('blocks cross-site mutation requests before session handling', async () => {
    const handler = vi.fn()
    const wrapped = requireAuth()(handler)
    const response = await wrapped(new NextRequest('http://localhost/api/test', {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example.com',
      },
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Forbidden: cross-site request blocked',
    })
    expect(getServerSession).not.toHaveBeenCalled()
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('requireRole(ADMIN)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const handler = vi.fn()
    const wrapped = requireRole(UserRole.ADMIN)(handler)
    const response = await wrapped(makeRequest())

    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 403 when the user has VIEWER role', async () => {
    const session = { user: { email: 'viewer@example.com', role: UserRole.VIEWER } }
    vi.mocked(getServerSession).mockResolvedValue(session as never)

    const handler = vi.fn()
    const wrapped = requireRole(UserRole.ADMIN)(handler)
    const response = await wrapped(makeRequest())

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'Forbidden: Admin access required' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 403 when the admin account is not approved', async () => {
    const session = { user: { email: 'admin@example.com', role: UserRole.ADMIN, isApproved: false } }
    vi.mocked(getServerSession).mockResolvedValue(session as never)

    const handler = vi.fn()
    const wrapped = requireRole(UserRole.ADMIN)(handler)
    const response = await wrapped(makeRequest())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Forbidden: Account approval required',
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('calls the handler when the user has ADMIN role', async () => {
    const session = { user: { email: 'admin@example.com', role: UserRole.ADMIN } }
    vi.mocked(getServerSession).mockResolvedValue(session as never)

    const mockResponse = NextResponse.json({ ok: true })
    const handler = vi.fn().mockResolvedValue(mockResponse)
    const wrapped = requireRole(UserRole.ADMIN)(handler)
    const req = makeRequest()
    const response = await wrapped(req)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(req, session, undefined)
    expect(response.status).toBe(200)
  })

  it('allows same-origin mutation requests through to admin handlers', async () => {
    const session = { user: { email: 'admin@example.com', role: UserRole.ADMIN } }
    vi.mocked(getServerSession).mockResolvedValue(session as never)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = requireRole(UserRole.ADMIN)(handler)
    const response = await wrapped(makeMutatingRequest())

    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
  })
})

describe('requireRole(VIEWER)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows VIEWER role through when role is VIEWER', async () => {
    const session = { user: { email: 'viewer@example.com', role: UserRole.VIEWER } }
    vi.mocked(getServerSession).mockResolvedValue(session as never)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = requireRole(UserRole.VIEWER)(handler)
    const response = await wrapped(makeRequest())

    expect(handler).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
  })

  it('allows ADMIN role through when role is VIEWER (admin can do everything)', async () => {
    const session = { user: { email: 'admin@example.com', role: UserRole.ADMIN } }
    vi.mocked(getServerSession).mockResolvedValue(session as never)

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = requireRole(UserRole.VIEWER)(handler)
    await wrapped(makeRequest())

    expect(handler).toHaveBeenCalledOnce()
  })
})

describe('requireApprovedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for unapproved users', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'viewer@example.com', role: UserRole.VIEWER, isApproved: false },
    } as never)

    const handler = vi.fn()
    const wrapped = requireApprovedUser()(handler)
    const response = await wrapped(makeRequest())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Forbidden: Account approval required',
    })
    expect(handler).not.toHaveBeenCalled()
  })
})
