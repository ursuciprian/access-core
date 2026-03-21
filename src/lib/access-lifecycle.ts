import { prisma } from './prisma'
import { logAudit } from './audit'
import { reconcileExpiredTemporaryAccess } from './temporary-access'

export const STALE_PENDING_ACCESS_REQUEST_DAYS = 14
export const STALE_FAILED_ACCESS_REQUEST_DAYS = 7
export const ACCESS_LIFECYCLE_AUTOMATION_INTERVAL_MS = 5 * 60 * 1000

export interface AccessRequestLifecycleSummary {
  expiredOrphanedApprovedCount: number
  expiredStalePendingCount: number
  expiredStaleFailedCount: number
}

export interface AccessLifecycleAutomationSummary extends AccessRequestLifecycleSummary {
  ranAt: string
  expiredTemporaryAccessCount: number
  failedTemporaryAccessCount: number
  skipped: boolean
}

let lastAutomationRunAt = 0
let lastAutomationSummary: AccessLifecycleAutomationSummary | null = null
let inFlightAutomationRun: Promise<AccessLifecycleAutomationSummary> | null = null

export async function reconcileAccessRequestLifecycle(filter?: { email?: string }): Promise<AccessRequestLifecycleSummary> {
  const now = new Date()
  const stalePendingCutoff = new Date(now.getTime() - STALE_PENDING_ACCESS_REQUEST_DAYS * 24 * 60 * 60 * 1000)
  const staleFailedCutoff = new Date(now.getTime() - STALE_FAILED_ACCESS_REQUEST_DAYS * 24 * 60 * 60 * 1000)

  const [orphanedApprovedRequests, stalePendingRequests, staleFailedRequests] = await Promise.all([
    findOrphanedApprovedRequests(filter),
    prisma.accessRequest.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lte: stalePendingCutoff },
        ...(filter?.email ? { email: filter.email } : {}),
      },
      select: {
        id: true,
        email: true,
        serverId: true,
      },
    }),
    prisma.accessRequest.findMany({
      where: {
        status: 'FAILED',
        updatedAt: { lte: staleFailedCutoff },
        ...(filter?.email ? { email: filter.email } : {}),
      },
      select: {
        id: true,
        email: true,
        serverId: true,
      },
    }),
  ])

  const expiredOrphanedApprovedCount = await expireRequests(
    orphanedApprovedRequests,
    'APPROVED',
    now,
    'Automatically closed because active VPN access no longer exists for this server.',
    'ACCESS_REQUEST_AUTO_EXPIRED',
    'approved_access_missing'
  )

  const expiredStalePendingCount = await expireRequests(
    stalePendingRequests,
    'PENDING',
    now,
    `Automatically expired after waiting more than ${STALE_PENDING_ACCESS_REQUEST_DAYS} days for review.`,
    'ACCESS_REQUEST_AUTO_EXPIRED',
    'pending_timeout'
  )

  const expiredStaleFailedCount = await expireRequests(
    staleFailedRequests,
    'FAILED',
    now,
    `Automatically expired after waiting more than ${STALE_FAILED_ACCESS_REQUEST_DAYS} days for a provisioning retry.`,
    'ACCESS_REQUEST_AUTO_EXPIRED',
    'failed_timeout'
  )

  return {
    expiredOrphanedApprovedCount,
    expiredStalePendingCount,
    expiredStaleFailedCount,
  }
}

export async function runAccessLifecycleAutomation(options?: {
  force?: boolean
}): Promise<AccessLifecycleAutomationSummary> {
  const now = Date.now()

  if (inFlightAutomationRun) {
    return inFlightAutomationRun
  }

  if (
    !options?.force &&
    lastAutomationSummary &&
    now - lastAutomationRunAt < ACCESS_LIFECYCLE_AUTOMATION_INTERVAL_MS
  ) {
    return {
      ...lastAutomationSummary,
      skipped: true,
    }
  }

  lastAutomationRunAt = now
  inFlightAutomationRun = (async () => {
    const temporaryAccess = await reconcileExpiredTemporaryAccess()
    const accessRequests = await reconcileAccessRequestLifecycle()

    const summary: AccessLifecycleAutomationSummary = {
      ranAt: new Date(now).toISOString(),
      expiredTemporaryAccessCount: temporaryAccess.expiredCount,
      failedTemporaryAccessCount: temporaryAccess.failedCount ?? 0,
      expiredOrphanedApprovedCount: accessRequests.expiredOrphanedApprovedCount,
      expiredStalePendingCount: accessRequests.expiredStalePendingCount,
      expiredStaleFailedCount: accessRequests.expiredStaleFailedCount,
      skipped: false,
    }

    lastAutomationSummary = summary

    return summary
  })()

  try {
    return await inFlightAutomationRun
  } finally {
    inFlightAutomationRun = null
  }
}

export function resetAccessLifecycleAutomationStateForTests() {
  lastAutomationRunAt = 0
  lastAutomationSummary = null
  inFlightAutomationRun = null
}

async function findOrphanedApprovedRequests(filter?: { email?: string }) {
  const approvedRequests = await prisma.accessRequest.findMany({
    where: {
      status: 'APPROVED',
      ...(filter?.email ? { email: filter.email } : {}),
    },
    select: {
      id: true,
      email: true,
      serverId: true,
    },
  })

  if (approvedRequests.length === 0) {
    return []
  }

  const uniquePairs = [...new Set(approvedRequests.map((request) => `${request.email}::${request.serverId}`))]
    .map((pair) => {
      const [email, serverId] = pair.split('::')
      return { email, serverId }
    })

  const enabledUsers = await prisma.vpnUser.findMany({
    where: {
      isEnabled: true,
      OR: uniquePairs,
    },
    select: {
      email: true,
      serverId: true,
    },
  })

  const enabledKeys = new Set(enabledUsers.map((user) => `${user.email}::${user.serverId}`))

  return approvedRequests.filter((request) => !enabledKeys.has(`${request.email}::${request.serverId}`))
}

async function expireRequests(
  requests: Array<{ id: string; email: string; serverId: string }>,
  expectedStatus: 'APPROVED' | 'PENDING' | 'FAILED',
  reviewedAt: Date,
  reviewNote: string,
  action: 'ACCESS_REQUEST_AUTO_EXPIRED',
  reason: string
) {
  let expiredCount = 0

  for (const request of requests) {
    const result = await prisma.accessRequest.updateMany({
      where: {
        id: request.id,
        status: expectedStatus,
      },
      data: {
        status: 'EXPIRED',
        reviewedBy: 'system',
        reviewedAt,
        reviewNote,
      },
    })

    if (result.count === 0) {
      continue
    }

    expiredCount += 1

    await logAudit({
      action,
      actorEmail: 'system',
      targetType: 'ACCESS_REQUEST',
      targetId: request.id,
      details: {
        email: request.email,
        serverId: request.serverId,
        previousStatus: expectedStatus,
        reason,
      },
    })
  }

  return expiredCount
}
