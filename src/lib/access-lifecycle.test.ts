const { prismaMock, logAuditMock, reconcileExpiredTemporaryAccessMock } = vi.hoisted(() => ({
  prismaMock: {
    accessRequest: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    vpnUser: {
      findMany: vi.fn(),
    },
  },
  logAuditMock: vi.fn(),
  reconcileExpiredTemporaryAccessMock: vi.fn(),
}))

vi.mock('./prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('./audit', () => ({
  logAudit: logAuditMock,
}))

vi.mock('./temporary-access', () => ({
  reconcileExpiredTemporaryAccess: reconcileExpiredTemporaryAccessMock,
}))

import {
  ACCESS_LIFECYCLE_AUTOMATION_INTERVAL_MS,
  reconcileAccessRequestLifecycle,
  resetAccessLifecycleAutomationStateForTests,
  runAccessLifecycleAutomation,
} from './access-lifecycle'

describe('access lifecycle automation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAccessLifecycleAutomationStateForTests()
    vi.useRealTimers()
  })

  it('expires orphaned approved, stale pending, and stale failed requests', async () => {
    prismaMock.accessRequest.findMany
      .mockResolvedValueOnce([
        { id: 'approved-1', email: 'alice@example.com', serverId: 'server-1' },
      ])
      .mockResolvedValueOnce([
        { id: 'pending-1', email: 'alice@example.com', serverId: 'server-1' },
      ])
      .mockResolvedValueOnce([
        { id: 'failed-1', email: 'bob@example.com', serverId: 'server-2' },
      ])
    prismaMock.vpnUser.findMany.mockResolvedValue([])
    prismaMock.accessRequest.updateMany.mockResolvedValue({ count: 1 })

    const result = await reconcileAccessRequestLifecycle()

    expect(result).toEqual({
      expiredOrphanedApprovedCount: 1,
      expiredStalePendingCount: 1,
      expiredStaleFailedCount: 1,
    })
    expect(prismaMock.accessRequest.updateMany).toHaveBeenCalledTimes(3)
    expect(logAuditMock).toHaveBeenCalledTimes(3)
  })

  it('keeps approved requests active when enabled VPN access exists', async () => {
    prismaMock.accessRequest.findMany
      .mockResolvedValueOnce([
        { id: 'approved-1', email: 'alice@example.com', serverId: 'server-1' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    prismaMock.vpnUser.findMany.mockResolvedValue([
      { email: 'alice@example.com', serverId: 'server-1' },
    ])

    const result = await reconcileAccessRequestLifecycle({ email: 'alice@example.com' })

    expect(result.expiredOrphanedApprovedCount).toBe(0)
    expect(prismaMock.accessRequest.updateMany).not.toHaveBeenCalled()
  })

  it('caches automation runs within the cooldown window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T12:00:00.000Z'))
    reconcileExpiredTemporaryAccessMock.mockResolvedValue({ expiredCount: 2, failedCount: 1 })
    prismaMock.accessRequest.findMany.mockResolvedValue([])
    prismaMock.vpnUser.findMany.mockResolvedValue([])

    const first = await runAccessLifecycleAutomation()
    const second = await runAccessLifecycleAutomation()

    expect(first.skipped).toBe(false)
    expect(second.skipped).toBe(true)
    expect(reconcileExpiredTemporaryAccessMock).toHaveBeenCalledTimes(1)
    expect(logAuditMock).not.toHaveBeenCalled()

    vi.setSystemTime(new Date('2026-03-21T12:00:00.000Z').getTime() + ACCESS_LIFECYCLE_AUTOMATION_INTERVAL_MS + 1)
    await runAccessLifecycleAutomation()

    expect(reconcileExpiredTemporaryAccessMock).toHaveBeenCalledTimes(2)
  })
})
