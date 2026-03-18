export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { validateCidr } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/rbac'
import { markUsersAffectedByGroupChangePending } from '@/lib/temporary-access'

export const GET = requireAdmin()(async (
  _request: NextRequest,
  _session,
  context
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')
  const now = new Date()

  const group = await prisma.vpnGroup.findUnique({
    where: { id },
    include: {
      cidrBlocks: true,
      server: { select: { id: true, name: true } },
      users: {
        include: {
          user: true,
        },
      },
      temporaryAccess: {
        where: {
          isActive: true,
          expiresAt: { gt: now },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              commonName: true,
            },
          },
        },
        orderBy: { expiresAt: 'asc' },
      },
    },
  })

  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  return NextResponse.json(group)
})

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  cidrBlocks: z
    .array(
      z.object({
        id: z.string().optional(),
        cidr: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
})

export const PUT = requireAdmin()(async (
  request: NextRequest,
  session,
  context
) => {
  const actorEmail = session.user.email as string
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const body = await request.json()
  const parsed = updateGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  if (parsed.data.cidrBlocks) {
    for (const block of parsed.data.cidrBlocks) {
      const cidrResult = validateCidr(block.cidr)
      if (!cidrResult.success) {
        return NextResponse.json(
          { error: `Invalid CIDR: ${block.cidr}`, details: cidrResult.error.issues },
          { status: 400 }
        )
      }
    }
  }

  const { prisma } = await import('@/lib/prisma')

  const existing = await prisma.vpnGroup.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  const group = await prisma.$transaction(async (tx) => {
    if (parsed.data.cidrBlocks) {
      await tx.cidrBlock.deleteMany({ where: { groupId: id } })
      await tx.cidrBlock.createMany({
        data: parsed.data.cidrBlocks.map((b) => ({
          cidr: b.cidr,
          description: b.description,
          groupId: id,
        })),
      })
    }

    return tx.vpnGroup.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
      },
      include: { cidrBlocks: true },
    })
  })

  await logAudit({
    action: 'GROUP_UPDATED',
    actorEmail,
    targetType: 'GROUP',
    targetId: id,
    details: parsed.data,
  })

  if (parsed.data.cidrBlocks) {
    await markUsersAffectedByGroupChangePending(id)
  }

  return NextResponse.json(group)
})

export const DELETE = requireAdmin()(async (
  _request: NextRequest,
  session,
  context
) => {
  const actorEmail = session.user.email as string
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')

  const group = await prisma.vpnGroup.findUnique({ where: { id } })
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  await prisma.vpnGroup.delete({ where: { id } })

  await logAudit({
    action: 'GROUP_DELETED',
    actorEmail,
    targetType: 'GROUP',
    targetId: id,
    details: { name: group.name },
  })

  return NextResponse.json({ success: true })
})
