import { buildCcdWriteCommand, generateCcdForUser } from './ccd-generator'
import { isServerManagementEnabled } from './features'
import { logAudit } from './audit'
import { getTransport } from './transport'

async function markCcdPending(userId: string) {
  const { prisma } = await import('@/lib/prisma')

  await prisma.vpnUser.update({
    where: { id: userId },
    data: { ccdSyncStatus: 'PENDING' },
  })
}

export async function syncUserCcdAfterAccessChange(userId: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma')

  const user = await prisma.vpnUser.findUnique({
    where: { id: userId },
    include: { server: true },
  })

  if (!user) {
    return
  }

  await markCcdPending(userId)

  if (!isServerManagementEnabled()) {
    throw new Error('Server management is disabled; CCD changes cannot be applied')
  }

  if (!user.isEnabled) {
    return
  }

  const ccdContent = await generateCcdForUser(userId)
  const transport = getTransport(user.server)
  const command = buildCcdWriteCommand(user.server.ccdPath, user.commonName, ccdContent)
  const writeResult = await transport.executeCommand(command)

  if (writeResult.exitCode !== 0) {
    await prisma.vpnUser.update({
      where: { id: userId },
      data: { ccdSyncStatus: 'FAILED' },
    })
    throw new Error('Failed to push updated CCD after access change')
  }

  await transport.executeCommand(
    `echo "kill ${user.commonName}" | nc -w 1 127.0.0.1 7505 2>/dev/null || true`
  )

  await prisma.vpnUser.update({
    where: { id: userId },
    data: {
      ccdSyncStatus: 'SUCCESS',
      lastCcdPush: new Date(),
    },
  })
}

export async function reconcileExpiredTemporaryAccess(filter?: {
  userId?: string
  serverId?: string
}) {
  const { prisma } = await import('@/lib/prisma')
  const now = new Date()

  const expiredGrants = await prisma.temporaryAccess.findMany({
    where: {
      isActive: true,
      expiresAt: { lte: now },
      ...(filter?.userId ? { userId: filter.userId } : {}),
      ...(filter?.serverId ? { serverId: filter.serverId } : {}),
    },
    include: {
      group: { select: { id: true, name: true } },
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: { expiresAt: 'asc' },
  })

  if (expiredGrants.length === 0) {
    return { expiredCount: 0 }
  }

  const expiredAt = new Date()
  const syncedExpiredGrantIds: string[] = []
  const failedGrantIds: string[] = []

  for (const grant of expiredGrants) {
    await prisma.temporaryAccess.update({
      where: { id: grant.id },
      data: {
        isActive: false,
        revokedAt: expiredAt,
        revokedBy: 'system',
      },
    })

    try {
      await syncUserCcdAfterAccessChange(grant.userId)

      await logAudit({
        action: 'TEMP_ACCESS_EXPIRED',
        actorEmail: 'system',
        targetType: 'USER',
        targetId: grant.userId,
        userId: grant.userId,
        details: {
          email: grant.user.email,
          grantId: grant.id,
          groupId: grant.group.id,
          groupName: grant.group.name,
          expiredAt: grant.expiresAt.toISOString(),
        },
      })

      syncedExpiredGrantIds.push(grant.id)
    } catch {
      failedGrantIds.push(grant.id)

      await prisma.temporaryAccess.update({
        where: { id: grant.id },
        data: {
          isActive: true,
          revokedAt: null,
          revokedBy: null,
        },
      })
    }
  }

  return {
    expiredCount: syncedExpiredGrantIds.length,
    failedCount: failedGrantIds.length,
  }
}

export async function markUsersAffectedByGroupChangePending(groupId: string) {
  const { prisma } = await import('@/lib/prisma')
  const now = new Date()

  const users = await prisma.vpnUser.findMany({
    where: {
      OR: [
        {
          groups: {
            some: {
              groupId,
            },
          },
        },
        {
          temporaryAccess: {
            some: {
              groupId,
              isActive: true,
              expiresAt: { gt: now },
            },
          },
        },
      ],
    },
    select: { id: true },
  })

  const userIds = [...new Set(users.map((user) => user.id))]

  for (const userId of userIds) {
    await markCcdPending(userId)
  }

  return {
    userIds,
    pendingCount: userIds.length,
  }
}

export async function syncUsersAffectedByGroupChange(groupId: string) {
  const { prisma } = await import('@/lib/prisma')
  const now = new Date()

  const users = await prisma.vpnUser.findMany({
    where: {
      OR: [
        {
          groups: {
            some: {
              groupId,
            },
          },
        },
        {
          temporaryAccess: {
            some: {
              groupId,
              isActive: true,
              expiresAt: { gt: now },
            },
          },
        },
      ],
    },
    select: { id: true },
  })

  const userIds = [...new Set(users.map((user) => user.id))]
  const failedUserIds: string[] = []

  for (const userId of userIds) {
    try {
      await syncUserCcdAfterAccessChange(userId)
    } catch {
      failedUserIds.push(userId)
    }
  }

  return {
    userIds,
    syncedCount: userIds.length - failedUserIds.length,
    failedUserIds,
  }
}
