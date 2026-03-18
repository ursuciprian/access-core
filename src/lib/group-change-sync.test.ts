vi.mock('@/lib/prisma', () => ({
  prisma: {
    vpnUser: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('./features', () => ({
  isServerManagementEnabled: vi.fn(),
}))

vi.mock('./transport', () => ({
  getTransport: vi.fn(),
}))

vi.mock('./ccd-generator', () => ({
  buildCcdWriteCommand: vi.fn(() => 'write-ccd'),
  generateCcdForUser: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { markUsersAffectedByGroupChangePending } from './temporary-access'

describe('markUsersAffectedByGroupChangePending', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks permanent and temporary-access users as pending without duplicates', async () => {
    vi.mocked(prisma.vpnUser.findMany).mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
      { id: 'user-1' },
    ] as never)
    vi.mocked(prisma.vpnUser.update).mockResolvedValue({} as never)

    const result = await markUsersAffectedByGroupChangePending('group-1')

    expect(prisma.vpnUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      })
    )
    expect(prisma.vpnUser.update).toHaveBeenCalledTimes(2)
    expect(prisma.vpnUser.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { ccdSyncStatus: 'PENDING' },
    })
    expect(prisma.vpnUser.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { ccdSyncStatus: 'PENDING' },
    })
    expect(result).toEqual({
      userIds: ['user-1', 'user-2'],
      pendingCount: 2,
    })
  })
})
