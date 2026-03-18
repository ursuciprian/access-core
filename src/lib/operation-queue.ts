import { SyncJob, SyncType, SyncStatus } from '@prisma/client'

export async function enqueueOperation(params: {
  serverId: string
  type: SyncType
  triggeredBy: string
  execute: () => Promise<unknown>
}): Promise<SyncJob> {
  const { prisma } = await import('@/lib/prisma')

  // Create the job in PENDING state
  const job = await prisma.syncJob.create({
    data: {
      type: params.type,
      status: SyncStatus.PENDING,
      serverId: params.serverId,
      triggeredBy: params.triggeredBy,
    },
  })

  // Check if another job is already IN_PROGRESS for this server
  const inProgress = await prisma.syncJob.findFirst({
    where: {
      serverId: params.serverId,
      status: SyncStatus.IN_PROGRESS,
      id: { not: job.id },
    },
  })

  if (inProgress) {
    // Mark our job as FAILED — server is busy
    const rejected = await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: SyncStatus.FAILED,
        error: `Another operation is in progress (job ${inProgress.id})`,
        completedAt: new Date(),
      },
    })
    return rejected
  }

  // Transition to IN_PROGRESS
  const started = await prisma.syncJob.update({
    where: { id: job.id },
    data: {
      status: SyncStatus.IN_PROGRESS,
      startedAt: new Date(),
    },
  })

  let finalJob: SyncJob
  try {
    const result = await params.execute()
    finalJob = await prisma.syncJob.update({
      where: { id: started.id },
      data: {
        status: SyncStatus.SUCCESS,
        completedAt: new Date(),
        details: result !== undefined && result !== null
          ? JSON.parse(JSON.stringify(result))
          : undefined,
      },
    })
  } catch (err) {
    finalJob = await prisma.syncJob.update({
      where: { id: started.id },
      data: {
        status: SyncStatus.FAILED,
        completedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      },
    })
  }

  return finalJob
}

export async function getQueueStatus(serverId: string): Promise<{
  currentJob: SyncJob | null
  pendingJobs: number
}> {
  const { prisma } = await import('@/lib/prisma')

  const [currentJob, pendingJobs] = await Promise.all([
    prisma.syncJob.findFirst({
      where: { serverId, status: SyncStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.syncJob.count({
      where: { serverId, status: SyncStatus.PENDING },
    }),
  ])

  return { currentJob, pendingJobs }
}
