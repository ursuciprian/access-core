export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod/v4'
import { logAudit } from '@/lib/audit'
import { revokeCert } from '@/lib/cert-service'
import { getTransport } from '@/lib/transport'

const resolveFlagSchema = z.object({
  action: z.enum(['revoke', 'dismiss', 'reassign']),
  note: z.string().max(1000).optional(),
  groupId: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = resolveFlagSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { prisma } = await import('@/lib/prisma')

  const user = await prisma.vpnUser.findUnique({
    where: { id },
    include: { server: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (!user.isFlagged) {
    return NextResponse.json(
      { error: 'User is not flagged' },
      { status: 400 }
    )
  }

  try {
    if (parsed.data.action === 'revoke') {
      if (user.certStatus === 'ACTIVE') {
        await revokeCert(user.server, user.commonName)
      }

      // Remove CCD file
      const transport = getTransport(user.server)
      await transport.executeCommand(
        `rm -f ${user.server.ccdPath}/${user.commonName}`
      )

      const updatedUser = await prisma.vpnUser.update({
        where: { id },
        data: {
          isFlagged: false,
          flagReason: null,
          flaggedAt: null,
          certStatus: user.certStatus === 'ACTIVE' ? 'REVOKED' : user.certStatus,
          isEnabled: false,
        },
      })

      await logAudit({
        action: 'FLAG_RESOLVED',
        actorEmail: session.user.email,
        targetType: 'USER',
        targetId: id,
        userId: id,
        details: {
          resolution: 'revoke',
          note: parsed.data.note,
          commonName: user.commonName,
        },
      })

      return NextResponse.json(updatedUser)
    }

    if (parsed.data.action === 'dismiss') {
      const updatedUser = await prisma.vpnUser.update({
        where: { id },
        data: {
          isFlagged: false,
          flagReason: null,
          flaggedAt: null,
        },
      })

      await logAudit({
        action: 'FLAG_RESOLVED',
        actorEmail: session.user.email,
        targetType: 'USER',
        targetId: id,
        userId: id,
        details: {
          resolution: 'dismiss',
          note: parsed.data.note,
          commonName: user.commonName,
        },
      })

      return NextResponse.json(updatedUser)
    }

    if (parsed.data.action === 'reassign') {
      if (!parsed.data.groupId) {
        return NextResponse.json(
          { error: 'groupId is required for reassign action' },
          { status: 400 }
        )
      }

      const group = await prisma.vpnGroup.findUnique({
        where: { id: parsed.data.groupId },
      })
      if (!group) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        )
      }

      // Remove existing group memberships and add to new group
      await prisma.vpnUserGroup.deleteMany({ where: { userId: id } })
      await prisma.vpnUserGroup.create({
        data: {
          userId: id,
          groupId: parsed.data.groupId,
          source: 'MANUAL',
        },
      })

      const updatedUser = await prisma.vpnUser.update({
        where: { id },
        data: {
          isFlagged: false,
          flagReason: null,
          flaggedAt: null,
        },
      })

      await logAudit({
        action: 'FLAG_RESOLVED',
        actorEmail: session.user.email,
        targetType: 'USER',
        targetId: id,
        userId: id,
        details: {
          resolution: 'reassign',
          note: parsed.data.note,
          newGroupId: parsed.data.groupId,
          commonName: user.commonName,
        },
      })

      return NextResponse.json(updatedUser)
    }
  } catch (error) {
    console.error('Failed to resolve flag', { userId: id, error })
    return NextResponse.json(
      { error: 'Failed to resolve flag' },
      { status: 500 }
    )
  }
}
