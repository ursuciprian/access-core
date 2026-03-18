export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { reconcileExpiredTemporaryAccess, syncUserCcdAfterAccessChange } from '@/lib/temporary-access'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; grantId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, grantId } = await params
  const { prisma } = await import('@/lib/prisma')
  await reconcileExpiredTemporaryAccess({ userId: id })

  const grant = await prisma.temporaryAccess.findUnique({
    where: { id: grantId },
    include: {
      user: { select: { email: true } },
      group: { select: { id: true, name: true } },
    },
  })
  if (!grant || grant.userId !== id) {
    return NextResponse.json({ error: 'Grant not found' }, { status: 404 })
  }

  await prisma.temporaryAccess.update({
    where: { id: grantId },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedBy: session.user.email,
    },
  })

  try {
    await syncUserCcdAfterAccessChange(id)
  } catch {
    await prisma.temporaryAccess.update({
      where: { id: grantId },
      data: {
        isActive: grant.isActive,
        revokedAt: grant.revokedAt,
        revokedBy: grant.revokedBy,
      },
    })

    return NextResponse.json(
      { error: 'Temporary access could not be removed from the VPN server' },
      { status: 500 }
    )
  }

  await logAudit({
    action: 'TEMP_ACCESS_REVOKED',
    actorEmail: session.user.email,
    targetType: 'USER',
    targetId: id,
    details: {
      email: grant.user.email,
      grantId,
      groupId: grant.group.id,
      groupName: grant.group.name,
      originalExpiry: grant.expiresAt.toISOString(),
    },
  })

  return NextResponse.json({ success: true })
}
