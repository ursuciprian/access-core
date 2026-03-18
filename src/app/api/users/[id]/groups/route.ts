export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod/v4'
import { logAudit } from '@/lib/audit'

const addToGroupSchema = z.object({
  groupId: z.string().min(1),
  source: z.enum(['MANUAL', 'GOOGLE_SYNC']).default('MANUAL'),
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
  const parsed = addToGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { prisma } = await import('@/lib/prisma')

  const user = await prisma.vpnUser.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const group = await prisma.vpnGroup.findUnique({ where: { id: parsed.data.groupId } })
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  if (user.serverId !== group.serverId) {
    return NextResponse.json({ error: 'User and group must belong to the same server' }, { status: 400 })
  }

  const membership = await prisma.vpnUserGroup.create({
    data: {
      userId: id,
      groupId: parsed.data.groupId,
      source: parsed.data.source,
    },
    include: {
      group: true,
      user: true,
    },
  })

  await logAudit({
    action: 'GROUP_MEMBER_ADDED',
    actorEmail: session.user.email,
    targetType: 'GROUP',
    targetId: parsed.data.groupId,
    userId: id,
    details: { groupName: group.name, userEmail: user.email },
  })

  return NextResponse.json(membership, { status: 201 })
}

const removeFromGroupSchema = z.object({
  groupId: z.string().min(1),
})

export async function DELETE(
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
  const parsed = removeFromGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { prisma } = await import('@/lib/prisma')

  const membership = await prisma.vpnUserGroup.findUnique({
    where: { userId_groupId: { userId: id, groupId: parsed.data.groupId } },
    include: { group: true, user: true },
  })
  if (!membership) {
    return NextResponse.json({ error: 'User is not a member of this group' }, { status: 404 })
  }

  await prisma.vpnUserGroup.delete({
    where: { userId_groupId: { userId: id, groupId: parsed.data.groupId } },
  })

  await logAudit({
    action: 'GROUP_MEMBER_REMOVED',
    actorEmail: session.user.email,
    targetType: 'GROUP',
    targetId: parsed.data.groupId,
    userId: id,
    details: { groupName: membership.group.name, userEmail: membership.user.email },
  })

  return NextResponse.json({ success: true })
}
