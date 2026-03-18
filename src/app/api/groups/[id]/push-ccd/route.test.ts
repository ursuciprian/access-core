import { NextRequest } from 'next/server'

const {
  prismaMock,
  reconcileExpiredTemporaryAccessMock,
  syncUsersAffectedByGroupChangeMock,
  logAuditMock,
} = vi.hoisted(() => ({
  prismaMock: {
    vpnGroup: {
      findUnique: vi.fn(),
    },
  },
  reconcileExpiredTemporaryAccessMock: vi.fn(),
  syncUsersAffectedByGroupChangeMock: vi.fn(),
  logAuditMock: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  requireAdmin: () => (handler: any) => (request: any, context: any) =>
    handler(
      request,
      {
        user: {
          email: 'admin@example.com',
          role: 'ADMIN',
          isApproved: true,
        },
      },
      context
    ),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/features', () => ({
  isServerManagementEnabled: vi.fn(() => true),
  SERVER_MANAGEMENT_DISABLED_MESSAGE: 'Server management is disabled by environment configuration',
}))

vi.mock('@/lib/temporary-access', () => ({
  reconcileExpiredTemporaryAccess: reconcileExpiredTemporaryAccessMock,
  syncUsersAffectedByGroupChange: syncUsersAffectedByGroupChangeMock,
}))

vi.mock('@/lib/audit', () => ({
  logAudit: logAuditMock,
}))

import { POST } from '@/app/api/groups/[id]/push-ccd/route'

describe('POST /api/groups/[id]/push-ccd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.vpnGroup.findUnique.mockResolvedValue({
      id: 'group-1',
      name: 'DevOps',
      serverId: 'server-1',
    })
    reconcileExpiredTemporaryAccessMock.mockResolvedValue({ expiredCount: 0, failedCount: 0 })
    syncUsersAffectedByGroupChangeMock.mockResolvedValue({
      userIds: ['user-1', 'user-2'],
      syncedCount: 2,
      failedUserIds: [],
    })
    logAuditMock.mockResolvedValue(undefined)
  })

  it('syncs CCD for permanent and temporary-access users of a group', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/groups/group-1/push-ccd', { method: 'POST' }),
      { params: Promise.resolve({ id: 'group-1' }) } as never
    )

    expect(response.status).toBe(200)
    expect(reconcileExpiredTemporaryAccessMock).toHaveBeenCalledWith({ serverId: 'server-1' })
    expect(syncUsersAffectedByGroupChangeMock).toHaveBeenCalledWith('group-1')
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CCD_PUSHED',
        targetType: 'GROUP',
        targetId: 'group-1',
      })
    )
  })
})
