export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { generateCcdForUser, buildCcdWriteCommand } from '@/lib/ccd-generator'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { reconcileExpiredTemporaryAccess } from '@/lib/temporary-access'
import { getTransport } from '@/lib/transport'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await params
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
      triggeredBy: session.user.email,
      startedAt: new Date(),
      details: { totalUsers: users.length },
    },
  })

  await logAudit({
    action: 'SYNC_STARTED',
    actorEmail: session.user.email,
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
    actorEmail: session.user.email,
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
}
