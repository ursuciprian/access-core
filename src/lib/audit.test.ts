import { logAudit } from './audit'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls prisma.auditLog.create with all required fields', async () => {
    const mockEntry = { id: 'audit-1', action: 'USER_CREATED' }
    vi.mocked(prisma.auditLog.create).mockResolvedValue(mockEntry as never)

    await logAudit({
      action: 'USER_CREATED',
      actorEmail: 'admin@example.com',
      targetType: 'USER',
      targetId: 'user-123',
    })

    expect(prisma.auditLog.create).toHaveBeenCalledOnce()
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'USER_CREATED',
        actorEmail: 'admin@example.com',
        targetType: 'USER',
        targetId: 'user-123',
        userId: undefined,
        details: undefined,
      },
    })
  })

  it('includes userId when provided', async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)

    await logAudit({
      action: 'CERT_REVOKED',
      actorEmail: 'admin@example.com',
      targetType: 'USER',
      targetId: 'user-456',
      userId: 'user-456',
    })

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-456' }),
      })
    )
  })

  it('serialises details as JSON when provided', async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)

    const details = { reason: 'expired', certSerial: 42 }
    await logAudit({
      action: 'CERT_REVOKED',
      actorEmail: 'admin@example.com',
      targetType: 'USER',
      targetId: 'user-789',
      details,
    })

    const call = vi.mocked(prisma.auditLog.create).mock.calls[0][0]
    expect(call.data.details).toEqual(details)
  })

  it('sets details to undefined when not provided', async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)

    await logAudit({
      action: 'GROUP_CREATED',
      actorEmail: 'admin@example.com',
      targetType: 'GROUP',
      targetId: 'group-1',
    })

    const call = vi.mocked(prisma.auditLog.create).mock.calls[0][0]
    expect(call.data.details).toBeUndefined()
  })

  it('returns the created audit log entry', async () => {
    const mockEntry = { id: 'audit-99', action: 'SERVER_CREATED' }
    vi.mocked(prisma.auditLog.create).mockResolvedValue(mockEntry as never)

    const result = await logAudit({
      action: 'SERVER_CREATED',
      actorEmail: 'admin@example.com',
      targetType: 'SERVER',
      targetId: 'server-1',
    })

    expect(result).toEqual(mockEntry)
  })

  it('works with all supported target types', async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)

    const targetTypes = ['USER', 'GROUP', 'SERVER', 'SYNC'] as const
    for (const targetType of targetTypes) {
      await logAudit({
        action: 'SYNC_STARTED',
        actorEmail: 'admin@example.com',
        targetType,
        targetId: 'id-1',
      })
    }

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(4)
  })
})
