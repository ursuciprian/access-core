export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/rbac'
import { reconcileExpiredTemporaryAccess, syncUserCcdAfterAccessChange } from '@/lib/temporary-access'

const grantSchema = z.object({
  groupId: z.string().min(1),
  expiresAt: z.string().datetime(),
  reason: z.string().max(500).optional(),
})

export const GET = requireAdmin()(async (
  _request: NextRequest,
  _session,
  context
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')
  await reconcileExpiredTemporaryAccess({ userId: id })

  const grants = await prisma.temporaryAccess.findMany({
    where: { userId: id },
    include: {
      server: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(grants)
})

export const POST = requireAdmin()(async (
  request: NextRequest,
  session,
  context
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const actorEmail = session.user.email as string

  const body = await request.json()
  const parsed = grantSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { prisma } = await import('@/lib/prisma')
  await reconcileExpiredTemporaryAccess({ userId: id })

  const user = await prisma.vpnUser.findUnique({
    where: { id },
    include: {
      groups: {
        select: { groupId: true },
      },
    },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const expiresAt = new Date(parsed.data.expiresAt)
  if (expiresAt <= new Date()) {
    return NextResponse.json({ error: 'Expiry must be in the future' }, { status: 400 })
  }

  const group = await prisma.vpnGroup.findUnique({
    where: { id: parsed.data.groupId },
    select: { id: true, name: true, serverId: true },
  })

  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  if (group.serverId !== user.serverId) {
    return NextResponse.json({ error: 'Group and user must belong to the same server' }, { status: 400 })
  }

  const permanentGroupIds = new Set(user.groups.map((membership) => membership.groupId))
  if (permanentGroupIds.has(group.id)) {
    return NextResponse.json({ error: 'User already belongs to this group' }, { status: 409 })
  }

  const existingActiveGrant = await prisma.temporaryAccess.findFirst({
    where: {
      userId: id,
      groupId: group.id,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  })

  if (existingActiveGrant) {
    return NextResponse.json({ error: 'User already has active temporary access to this group' }, { status: 409 })
  }

  // Enable user if disabled
  if (!user.isEnabled) {
    await prisma.vpnUser.update({ where: { id }, data: { isEnabled: true } })
  }

  const grant = await prisma.temporaryAccess.create({
    data: {
      userId: id,
      groupId: group.id,
      serverId: user.serverId,
      reason: parsed.data.reason || null,
      grantedBy: actorEmail,
      expiresAt,
    },
    include: {
      server: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
    },
  })

  try {
    await syncUserCcdAfterAccessChange(id)
  } catch {
    await prisma.temporaryAccess.delete({ where: { id: grant.id } })
    return NextResponse.json(
      { error: 'Temporary access could not be applied to the VPN server' },
      { status: 500 }
    )
  }

  await logAudit({
    action: 'TEMP_ACCESS_GRANTED',
    actorEmail,
    targetType: 'USER',
    targetId: id,
    details: {
      email: user.email,
      groupId: group.id,
      groupName: group.name,
      expiresAt: expiresAt.toISOString(),
      reason: parsed.data.reason,
      grantId: grant.id,
    },
  })

  return NextResponse.json(grant, { status: 201 })
})
