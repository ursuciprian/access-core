export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/rbac'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { reconcileExpiredTemporaryAccess, syncUsersAffectedByGroupChange } from '@/lib/temporary-access'

export const POST = requireAdmin()(async (
  _request: NextRequest,
  session,
  context
) => {
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const actorEmail = session.user.email as string
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')

  const group = await prisma.vpnGroup.findUnique({
    where: { id },
    select: { id: true, name: true, serverId: true },
  })

  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  await reconcileExpiredTemporaryAccess({ serverId: group.serverId })

  const result = await syncUsersAffectedByGroupChange(id)

  await logAudit({
    action: 'CCD_PUSHED',
    actorEmail,
    targetType: 'GROUP',
    targetId: id,
    details: {
      groupName: group.name,
      syncedCount: result.syncedCount,
      failedCount: result.failedUserIds.length,
      userIds: result.userIds,
    },
  })

  if (result.failedUserIds.length > 0) {
    return NextResponse.json(
      {
        error: 'Some user CCDs could not be synced for this group',
        syncedCount: result.syncedCount,
        failedUserIds: result.failedUserIds,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    syncedCount: result.syncedCount,
  })
})
