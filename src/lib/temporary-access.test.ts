vi.mock('@/lib/prisma', () => ({
  prisma: {
    temporaryAccess: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    vpnUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('./audit', () => ({
  logAudit: vi.fn(),
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
import { logAudit } from './audit'
import { isServerManagementEnabled } from './features'
import { getTransport } from './transport'
import { generateCcdForUser } from './ccd-generator'
import { reconcileExpiredTemporaryAccess, syncUserCcdAfterAccessChange } from './temporary-access'

describe('temporary access helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pushes an updated CCD after access changes when server management is enabled', async () => {
    vi.mocked(prisma.vpnUser.findUnique).mockResolvedValue({
      id: 'user-1',
      commonName: 'alice',
      isEnabled: true,
      server: { ccdPath: '/etc/openvpn/ccd' },
    } as never)
    vi.mocked(isServerManagementEnabled).mockReturnValue(true)
    vi.mocked(generateCcdForUser).mockResolvedValue('push "route 10.0.1.0 255.255.255.0"')
    vi.mocked(getTransport).mockReturnValue({
      executeCommand: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' }),
    } as never)

    await syncUserCcdAfterAccessChange('user-1')

    expect(prisma.vpnUser.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'user-1' },
      data: { ccdSyncStatus: 'PENDING' },
    })
    expect(prisma.vpnUser.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'user-1' },
      data: expect.objectContaining({
        ccdSyncStatus: 'SUCCESS',
      }),
    })
  })

  it('does not mark expiry successful when server management is disabled and CCD changes cannot be applied', async () => {
    vi.mocked(prisma.temporaryAccess.findMany).mockResolvedValue([
      {
        id: 'grant-1',
        userId: 'user-1',
        expiresAt: new Date('2026-03-17T10:00:00.000Z'),
        group: { id: 'group-1', name: 'Finance' },
        user: { id: 'user-1', email: 'alice@example.com' },
      },
    ] as never)
    vi.mocked(prisma.vpnUser.findUnique).mockResolvedValue({
      id: 'user-1',
      commonName: 'alice',
      isEnabled: false,
      server: { ccdPath: '/etc/openvpn/ccd' },
    } as never)
    vi.mocked(isServerManagementEnabled).mockReturnValue(false)

    const result = await reconcileExpiredTemporaryAccess({ userId: 'user-1' })

    expect(result).toEqual({ expiredCount: 0, failedCount: 1 })
    expect(prisma.vpnUser.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { ccdSyncStatus: 'PENDING' },
    })
    expect(prisma.temporaryAccess.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'grant-1' },
      data: expect.objectContaining({
        isActive: false,
        revokedBy: 'system',
      }),
    })
    expect(prisma.temporaryAccess.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'grant-1' },
      data: {
        isActive: true,
        revokedAt: null,
        revokedBy: null,
      },
    })
    expect(logAudit).not.toHaveBeenCalled()
  })
})
