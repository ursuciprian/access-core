export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { generateCcdForUser, buildCcdWriteCommand } from '@/lib/ccd-generator'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { reconcileExpiredTemporaryAccess } from '@/lib/temporary-access'
import { getTransport } from '@/lib/transport'
import { requireAdmin } from '@/lib/rbac'

export const POST = requireAdmin()(async (
  _request: NextRequest,
  session,
  context
) => {
  const actorEmail = session.user.email as string
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')
  await reconcileExpiredTemporaryAccess({ serverId: id })

  const server = await prisma.vpnServer.findUnique({ where: { id } })
  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  const users = await prisma.vpnUser.findMany({
    where: { serverId: id, isEnabled: true },
  })

  const syncJob = await prisma.syncJob.create({
    data: {
      type: 'CCD_PUSH',
      status: 'IN_PROGRESS',
      serverId: id,
      triggeredBy: actorEmail,
      startedAt: new Date(),
      details: { totalUsers: users.length },
    },
  })

  await logAudit({
    action: 'SYNC_STARTED',
    actorEmail,
    targetType: 'SERVER',
    targetId: id,
    details: { syncJobId: syncJob.id, totalUsers: users.length },
  })

  const results: { userId: string; commonName: string; status: string; error?: string }[] = []
  const transport = getTransport(server)

  for (const user of users) {
    try {
      const ccdContent = await generateCcdForUser(user.id)
      const command = buildCcdWriteCommand(
        server.ccdPath,
        user.commonName,
        ccdContent
      )
      await transport.executeCommand(command)

      await prisma.vpnUser.update({
        where: { id: user.id },
        data: { ccdSyncStatus: 'SUCCESS', lastCcdPush: new Date() },
      })

      results.push({
        userId: user.id,
        commonName: user.commonName,
        status: 'SUCCESS',
      })
    } catch (error) {
      await prisma.vpnUser.update({
        where: { id: user.id },
        data: { ccdSyncStatus: 'FAILED' },
      })

      results.push({
        userId: user.id,
        commonName: user.commonName,
        status: 'FAILED',
        error: String(error),
      })
    }
  }

  const failedCount = results.filter((r) => r.status === 'FAILED').length
  const finalStatus = failedCount === 0 ? 'SUCCESS' : 'FAILED'

  const updatedJob = await prisma.syncJob.update({
    where: { id: syncJob.id },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      details: {
        totalUsers: users.length,
        successCount: users.length - failedCount,
        failedCount,
        results,
      },
      error: failedCount > 0 ? `${failedCount} of ${users.length} users failed` : null,
    },
  })

  await logAudit({
    action: 'SYNC_COMPLETED',
    actorEmail,
    targetType: 'SERVER',
    targetId: id,
    details: {
      syncJobId: syncJob.id,
      status: finalStatus,
      totalUsers: users.length,
      failedCount,
    },
  })

  return NextResponse.json(updatedJob)
})
