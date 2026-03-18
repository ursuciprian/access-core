import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vpnUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    vpnGroup: {
      findUnique: vi.fn(),
    },
    temporaryAccess: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

vi.mock('@/lib/temporary-access', () => ({
  reconcileExpiredTemporaryAccess: vi.fn(),
  syncUserCcdAfterAccessChange: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { reconcileExpiredTemporaryAccess, syncUserCcdAfterAccessChange } from '@/lib/temporary-access'
import { POST } from '@/app/api/users/[id]/temporary-access/route'

describe('POST /api/users/[id]/temporary-access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        email: 'admin@example.com',
        role: 'ADMIN',
        isApproved: true,
      },
    } as never)
  })

  it('creates temporary access for a specific group and refreshes the CCD', async () => {
    vi.mocked(prisma.vpnUser.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      serverId: 'server-1',
      isEnabled: true,
      groups: [],
    } as never)
    vi.mocked(prisma.vpnGroup.findUnique).mockResolvedValue({
      id: 'group-1',
      name: 'Finance',
      serverId: 'server-1',
    } as never)
    vi.mocked(prisma.temporaryAccess.findFirst).mockResolvedValue(null as never)
    vi.mocked(prisma.temporaryAccess.create).mockResolvedValue({
      id: 'grant-1',
      server: { id: 'server-1', name: 'Primary' },
      group: { id: 'group-1', name: 'Finance' },
    } as never)

    const response = await POST(
      new NextRequest('http://localhost/api/users/user-1/temporary-access', {
        method: 'POST',
        body: JSON.stringify({
          groupId: 'group-1',
          expiresAt: '2030-03-17T10:00:00.000Z',
          reason: 'after-hours support',
        }),
      }),
      { params: Promise.resolve({ id: 'user-1' }) } as never
    )

    expect(response.status).toBe(201)
    expect(reconcileExpiredTemporaryAccess).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(prisma.temporaryAccess.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupId: 'group-1',
        }),
      })
    )
    expect(syncUserCcdAfterAccessChange).toHaveBeenCalledWith('user-1')
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TEMP_ACCESS_GRANTED',
        details: expect.objectContaining({
          groupId: 'group-1',
          groupName: 'Finance',
        }),
      })
    )
  })

  it('rejects grants for groups the user already belongs to', async () => {
    vi.mocked(prisma.vpnUser.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      serverId: 'server-1',
      isEnabled: true,
      groups: [{ groupId: 'group-1' }],
    } as never)
    vi.mocked(prisma.vpnGroup.findUnique).mockResolvedValue({
      id: 'group-1',
      name: 'Finance',
      serverId: 'server-1',
    } as never)

    const response = await POST(
      new NextRequest('http://localhost/api/users/user-1/temporary-access', {
        method: 'POST',
        body: JSON.stringify({
          groupId: 'group-1',
          expiresAt: '2030-03-17T10:00:00.000Z',
        }),
      }),
      { params: Promise.resolve({ id: 'user-1' }) } as never
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'User already belongs to this group',
    })
  })
})
