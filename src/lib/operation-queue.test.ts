import { vi, beforeEach, describe, it, expect } from 'vitest'
import { SyncType, SyncStatus } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    syncJob: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { enqueueOperation, getQueueStatus } from './operation-queue'
import { prisma } from '@/lib/prisma'

const mockPrisma = prisma as unknown as {
  syncJob: {
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
}

const SERVER_ID = 'server-1'
const TRIGGERED_BY = 'admin@example.com'

function makeJob(id: string, status: SyncStatus) {
  return { id, status, serverId: SERVER_ID, type: SyncType.MANUAL, triggeredBy: TRIGGERED_BY }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.syncJob.create.mockResolvedValue(makeJob('job-new', SyncStatus.PENDING))
  mockPrisma.syncJob.findFirst.mockResolvedValue(null) // no in-progress job by default
  mockPrisma.syncJob.update.mockResolvedValue(makeJob('job-new', SyncStatus.SUCCESS))
  mockPrisma.syncJob.count.mockResolvedValue(0)
})

describe('enqueueOperation', () => {
  it('creates a SyncJob in PENDING state initially', async () => {
    mockPrisma.syncJob.update
      .mockResolvedValueOnce(makeJob('job-new', SyncStatus.IN_PROGRESS))
      .mockResolvedValueOnce(makeJob('job-new', SyncStatus.SUCCESS))

    await enqueueOperation({
      serverId: SERVER_ID,
      type: SyncType.MANUAL,
      triggeredBy: TRIGGERED_BY,
      execute: vi.fn().mockResolvedValue(null),
    })

    expect(mockPrisma.syncJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: SyncStatus.PENDING,
        serverId: SERVER_ID,
        type: SyncType.MANUAL,
        triggeredBy: TRIGGERED_BY,
      }),
    })
  })

  it('transitions job to IN_PROGRESS when no other job is running', async () => {
    mockPrisma.syncJob.findFirst.mockResolvedValue(null)
    mockPrisma.syncJob.update
      .mockResolvedValueOnce(makeJob('job-new', SyncStatus.IN_PROGRESS))
      .mockResolvedValueOnce(makeJob('job-new', SyncStatus.SUCCESS))

    await enqueueOperation({
      serverId: SERVER_ID,
      type: SyncType.MANUAL,
      triggeredBy: TRIGGERED_BY,
      execute: vi.fn().mockResolvedValue(null),
    })

    expect(mockPrisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SyncStatus.IN_PROGRESS, startedAt: expect.any(Date) }),
      })
    )
  })

  it('marks job SUCCESS on completion and returns it', async () => {
    const successJob = makeJob('job-new', SyncStatus.SUCCESS)
    mockPrisma.syncJob.update
      .mockResolvedValueOnce(makeJob('job-new', SyncStatus.IN_PROGRESS))
      .mockResolvedValueOnce(successJob)

    const result = await enqueueOperation({
      serverId: SERVER_ID,
      type: SyncType.MANUAL,
      triggeredBy: TRIGGERED_BY,
      execute: vi.fn().mockResolvedValue({ count: 5 }),
    })

    expect(result.status).toBe(SyncStatus.SUCCESS)
    const successUpdateCall = mockPrisma.syncJob.update.mock.calls.find(
      (call) => call[0].data.status === SyncStatus.SUCCESS
    )
    expect(successUpdateCall).toBeDefined()
    expect(successUpdateCall![0].data).toMatchObject({
      status: SyncStatus.SUCCESS,
      completedAt: expect.any(Date),
    })
  })

  it('marks job FAILED when execute throws and returns the failed job', async () => {
    const failedJob = makeJob('job-new', SyncStatus.FAILED)
    mockPrisma.syncJob.update
      .mockResolvedValueOnce(makeJob('job-new', SyncStatus.IN_PROGRESS))
      .mockResolvedValueOnce(failedJob)

    const result = await enqueueOperation({
      serverId: SERVER_ID,
      type: SyncType.MANUAL,
      triggeredBy: TRIGGERED_BY,
      execute: vi.fn().mockRejectedValue(new Error('Something broke')),
    })

    expect(result.status).toBe(SyncStatus.FAILED)
    const failUpdateCall = mockPrisma.syncJob.update.mock.calls.find(
      (call) => call[0].data.status === SyncStatus.FAILED
    )
    expect(failUpdateCall).toBeDefined()
    expect(failUpdateCall![0].data).toMatchObject({
      status: SyncStatus.FAILED,
      error: 'Something broke',
      completedAt: expect.any(Date),
    })
  })

  it('rejects (marks FAILED) when another job is IN_PROGRESS for same server', async () => {
    const existingJob = makeJob('job-existing', SyncStatus.IN_PROGRESS)
    mockPrisma.syncJob.findFirst.mockResolvedValue(existingJob)
    const rejectedJob = makeJob('job-new', SyncStatus.FAILED)
    mockPrisma.syncJob.update.mockResolvedValue(rejectedJob)

    const executeFn = vi.fn()
    const result = await enqueueOperation({
      serverId: SERVER_ID,
      type: SyncType.MANUAL,
      triggeredBy: TRIGGERED_BY,
      execute: executeFn,
    })

    // execute should NOT have been called
    expect(executeFn).not.toHaveBeenCalled()
    expect(result.status).toBe(SyncStatus.FAILED)
    expect(mockPrisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SyncStatus.FAILED,
          error: expect.stringContaining('job-existing'),
        }),
      })
    )
  })

  it('stores execute result in details when result is non-null', async () => {
    mockPrisma.syncJob.update
      .mockResolvedValueOnce(makeJob('job-new', SyncStatus.IN_PROGRESS))
      .mockResolvedValueOnce(makeJob('job-new', SyncStatus.SUCCESS))

    await enqueueOperation({
      serverId: SERVER_ID,
      type: SyncType.MANUAL,
      triggeredBy: TRIGGERED_BY,
      execute: vi.fn().mockResolvedValue({ usersAdded: 3 }),
    })

    const successCall = mockPrisma.syncJob.update.mock.calls.find(
      (call) => call[0].data.status === SyncStatus.SUCCESS
    )
    expect(successCall![0].data.details).toEqual({ usersAdded: 3 })
  })
})

describe('getQueueStatus', () => {
  it('returns current in-progress job', async () => {
    const inProgressJob = makeJob('job-running', SyncStatus.IN_PROGRESS)
    mockPrisma.syncJob.findFirst.mockResolvedValue(inProgressJob)
    mockPrisma.syncJob.count.mockResolvedValue(2)

    const status = await getQueueStatus(SERVER_ID)

    expect(status.currentJob).toEqual(inProgressJob)
    expect(mockPrisma.syncJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ serverId: SERVER_ID, status: SyncStatus.IN_PROGRESS }),
      })
    )
  })

  it('returns pending job count', async () => {
    mockPrisma.syncJob.findFirst.mockResolvedValue(null)
    mockPrisma.syncJob.count.mockResolvedValue(5)

    const status = await getQueueStatus(SERVER_ID)

    expect(status.pendingJobs).toBe(5)
    expect(mockPrisma.syncJob.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ serverId: SERVER_ID, status: SyncStatus.PENDING }),
      })
    )
  })

  it('returns null currentJob when no job is running', async () => {
    mockPrisma.syncJob.findFirst.mockResolvedValue(null)
    mockPrisma.syncJob.count.mockResolvedValue(0)

    const status = await getQueueStatus(SERVER_ID)

    expect(status.currentJob).toBeNull()
    expect(status.pendingJobs).toBe(0)
  })
})
