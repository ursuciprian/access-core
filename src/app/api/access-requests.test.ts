import { NextRequest } from 'next/server'

const { prismaMock, reconcileAccessRequestLifecycleMock } = vi.hoisted(() => ({
  prismaMock: {
    accessRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    vpnUser: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  reconcileAccessRequestLifecycleMock: vi.fn(),
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

vi.mock('@/lib/access-lifecycle', () => ({
  reconcileAccessRequestLifecycle: reconcileAccessRequestLifecycleMock,
}))

import { getServerSession } from 'next-auth'
import { GET, POST } from '@/app/api/access-requests/route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/access-requests', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost',
    },
  })
}

describe('POST /api/access-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.accessRequest.count.mockResolvedValue(0)
    prismaMock.vpnUser.findMany.mockResolvedValue([])
    reconcileAccessRequestLifecycleMock.mockResolvedValue({
      expiredOrphanedApprovedCount: 0,
      expiredStalePendingCount: 0,
      expiredStaleFailedCount: 0,
    })
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        email: 'viewer@example.com',
        name: 'Viewer',
        role: 'VIEWER',
      },
    } as never)
  })

  it('rejects duplicate pending requests for the same server', async () => {
    prismaMock.accessRequest.findFirst.mockResolvedValue({
      id: 'req-1',
      status: 'PENDING',
    })
    prismaMock.vpnUser.findFirst.mockResolvedValue(null)

    const response = await POST(makeRequest({ serverId: 'server-1', groupIds: [], reason: 'Need access' }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'You already have a pending request for this server',
    })
    expect(reconcileAccessRequestLifecycleMock).toHaveBeenCalledWith({ email: 'viewer@example.com' })
  })

  it('rejects requests when the user already has VPN access on that server', async () => {
    prismaMock.accessRequest.findFirst.mockResolvedValue(null)
    prismaMock.vpnUser.findFirst.mockResolvedValue({ id: 'vpn-user-1' })

    const response = await POST(makeRequest({ serverId: 'server-1', groupIds: [], reason: 'Need access' }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'You already have VPN access for this server',
    })
  })

  it('rate limits users with too many active requests', async () => {
    prismaMock.accessRequest.findFirst.mockResolvedValue(null)
    prismaMock.vpnUser.findFirst.mockResolvedValue(null)
    prismaMock.accessRequest.count.mockResolvedValue(3)

    const response = await POST(makeRequest({ serverId: 'server-1', groupIds: [], reason: 'Need access' }))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      error: 'You already have too many active access requests. Please wait for an administrator to review them.',
    })
  })

  it('blocks cross-site request forgery attempts', async () => {
    const response = await POST(new NextRequest('http://localhost/api/access-requests', {
      method: 'POST',
      body: JSON.stringify({ serverId: 'server-1', groupIds: [] }),
      headers: {
        'Content-Type': 'application/json',
        origin: 'https://attacker.example.com',
      },
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Forbidden: cross-site request blocked',
    })
    expect(getServerSession).not.toHaveBeenCalled()
  })
})

describe('GET /api/access-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.vpnUser.findMany.mockResolvedValue([])
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        email: 'viewer@example.com',
        name: 'Viewer',
        role: 'VIEWER',
      },
    } as never)
  })

  it('rejects invalid status filters', async () => {
    const response = await GET(new NextRequest('http://localhost/api/access-requests?status=not-real'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid status filter',
    })
    expect(prismaMock.accessRequest.findMany).not.toHaveBeenCalled()
  })

  it('filters stale approved requests out of mine=true results when VPN access no longer exists', async () => {
    prismaMock.accessRequest.findMany.mockResolvedValue([
      {
        id: 'approved-1',
        status: 'APPROVED',
        serverId: 'server-1',
        email: 'viewer@example.com',
        server: { id: 'server-1', name: 'Server 1', hostname: 'vpn-1.example.com' },
      },
      {
        id: 'pending-1',
        status: 'PENDING',
        serverId: 'server-2',
        email: 'viewer@example.com',
        server: { id: 'server-2', name: 'Server 2', hostname: 'vpn-2.example.com' },
      },
    ])
    prismaMock.vpnUser.findMany.mockResolvedValue([{ serverId: 'server-2' }])

    const response = await GET(new NextRequest('http://localhost/api/access-requests?mine=true'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: 'pending-1', status: 'PENDING' }),
    ])
  })
})

describe('POST /api/access-requests re-request flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.accessRequest.count.mockResolvedValue(0)
    prismaMock.vpnUser.findMany.mockResolvedValue([])
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        email: 'viewer@example.com',
        name: 'Viewer',
        role: 'VIEWER',
      },
    } as never)
  })

  it('allows a new request when an old approved request exists but VPN access was deleted', async () => {
    prismaMock.accessRequest.findFirst.mockResolvedValue({
      id: 'req-1',
      status: 'APPROVED',
    })
    prismaMock.vpnUser.findFirst.mockResolvedValue(null)
    prismaMock.accessRequest.create.mockResolvedValue({
      id: 'req-2',
      email: 'viewer@example.com',
      serverId: 'server-1',
      status: 'PENDING',
      server: { id: 'server-1', name: 'Server 1' },
    })

    const response = await POST(makeRequest({ serverId: 'server-1', groupIds: [], reason: 'Need access again' }))

    expect(response.status).toBe(201)
    expect(prismaMock.accessRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'viewer@example.com',
          serverId: 'server-1',
        }),
      })
    )
  })
})
