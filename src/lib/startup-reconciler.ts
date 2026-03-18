import { SyncStatus } from '@prisma/client'

export async function reconcileStaleJobs(): Promise<void> {
  const { prisma } = await import('@/lib/prisma')

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const staleJobs = await prisma.syncJob.findMany({
    where: {
      status: SyncStatus.IN_PROGRESS,
      startedAt: { lt: fiveMinutesAgo },
    },
  })

  if (staleJobs.length === 0) {
    return
  }

  console.log(`[startup-reconciler] Found ${staleJobs.length} stale IN_PROGRESS job(s). Marking as FAILED.`)

  await prisma.syncJob.updateMany({
    where: {
      id: { in: staleJobs.map((j) => j.id) },
    },
    data: {
      status: SyncStatus.FAILED,
      completedAt: new Date(),
      error: 'orphaned — app restarted',
    },
  })

  for (const job of staleJobs) {
    console.log(
      `[startup-reconciler] Marked stale job ${job.id} (type=${job.type}, server=${job.serverId}, startedAt=${job.startedAt?.toISOString()}) as FAILED`
    )
  }
}
