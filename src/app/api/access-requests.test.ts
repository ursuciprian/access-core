import { NextRequest } from 'next/server'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    accessRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    vpnUser: {
      findFirst: vi.fn(),
    },
  },
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

import { getServerSession } from 'next-auth'
import { GET, POST } from '@/app/api/access-requests/route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/access-requests', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/access-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.accessRequest.count.mockResolvedValue(0)
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
})

describe('GET /api/access-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
