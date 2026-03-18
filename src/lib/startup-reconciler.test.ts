import { reconcileStaleJobs } from './startup-reconciler'
import { SyncStatus } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    syncJob: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('reconcileStaleJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when there are no stale jobs', async () => {
    vi.mocked(prisma.syncJob.findMany).mockResolvedValue([])

    await reconcileStaleJobs()

    expect(prisma.syncJob.findMany).toHaveBeenCalledOnce()
    expect(prisma.syncJob.updateMany).not.toHaveBeenCalled()
  })

  it('queries for IN_PROGRESS jobs older than 5 minutes', async () => {
    vi.mocked(prisma.syncJob.findMany).mockResolvedValue([])

    const before = Date.now()
    await reconcileStaleJobs()
    const after = Date.now()

    const call = vi.mocked(prisma.syncJob.findMany).mock.calls[0][0]
    expect(call.where.status).toBe(SyncStatus.IN_PROGRESS)

    const cutoff: Date = call.where.startedAt.lt
    expect(cutoff).toBeInstanceOf(Date)
    const cutoffMs = cutoff.getTime()
    // cutoff should be roughly 5 minutes before now
    expect(before - cutoffMs).toBeGreaterThanOrEqual(5 * 60 * 1000 - 100)
    expect(after - cutoffMs).toBeLessThanOrEqual(5 * 60 * 1000 + 100)
  })

  it('marks all stale jobs as FAILED', async () => {
    const staleJobs = [
      { id: 'job-1', type: 'SYNC', serverId: 'srv-1', startedAt: new Date(Date.now() - 10 * 60 * 1000) },
      { id: 'job-2', type: 'SYNC', serverId: 'srv-2', startedAt: new Date(Date.now() - 20 * 60 * 1000) },
    ]
    vi.mocked(prisma.syncJob.findMany).mockResolvedValue(staleJobs as never)
    vi.mocked(prisma.syncJob.updateMany).mockResolvedValue({ count: 2 } as never)

    await reconcileStaleJobs()

    expect(prisma.syncJob.updateMany).toHaveBeenCalledOnce()
    const updateCall = vi.mocked(prisma.syncJob.updateMany).mock.calls[0][0]
    expect(updateCall.where.id.in).toEqual(['job-1', 'job-2'])
    expect(updateCall.data.status).toBe(SyncStatus.FAILED)
    expect(updateCall.data.error).toBe('orphaned — app restarted')
    expect(updateCall.data.completedAt).toBeInstanceOf(Date)
  })

  it('sets completedAt to a recent timestamp', async () => {
    const staleJobs = [
      { id: 'job-3', type: 'SYNC', serverId: 'srv-1', startedAt: new Date(Date.now() - 15 * 60 * 1000) },
    ]
    vi.mocked(prisma.syncJob.findMany).mockResolvedValue(staleJobs as never)
    vi.mocked(prisma.syncJob.updateMany).mockResolvedValue({ count: 1 } as never)

    const before = Date.now()
    await reconcileStaleJobs()
    const after = Date.now()

    const updateCall = vi.mocked(prisma.syncJob.updateMany).mock.calls[0][0]
    const completedAt: Date = updateCall.data.completedAt
    expect(completedAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(completedAt.getTime()).toBeLessThanOrEqual(after)
  })

  it('updates only the IDs of the found stale jobs', async () => {
    const staleJobs = [
      { id: 'only-this-one', type: 'SYNC', serverId: 'srv-1', startedAt: new Date(Date.now() - 6 * 60 * 1000) },
    ]
    vi.mocked(prisma.syncJob.findMany).mockResolvedValue(staleJobs as never)
    vi.mocked(prisma.syncJob.updateMany).mockResolvedValue({ count: 1 } as never)

    await reconcileStaleJobs()

    const updateCall = vi.mocked(prisma.syncJob.updateMany).mock.calls[0][0]
    expect(updateCall.where.id.in).toEqual(['only-this-one'])
  })
})
