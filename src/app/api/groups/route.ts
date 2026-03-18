export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { validateCidr } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/rbac'

export const GET = requireAdmin()(async (request: NextRequest) => {
  const { prisma } = await import('@/lib/prisma')
  const { searchParams } = new URL(request.url)
  const serverId = searchParams.get('serverId')
  const now = new Date()

  const groups = await prisma.vpnGroup.findMany({
    where: serverId ? { serverId } : undefined,
    include: {
      cidrBlocks: true,
      server: { select: { id: true, name: true } },
      temporaryAccess: {
        where: {
          isActive: true,
          expiresAt: { gt: now },
        },
        select: { id: true },
      },
      _count: { select: { users: true, cidrBlocks: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    groups.map((group) => ({
      ...group,
      temporaryMemberCount: group.temporaryAccess.length,
    }))
  )
})

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  serverId: z.string().min(1),
  cidrBlocks: z
    .array(
      z.object({
        cidr: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
})

export const POST = requireAdmin()(async (request: NextRequest, session) => {
  const actorEmail = session.user.email as string
  const body = await request.json()
  const parsed = createGroupSchema.safeParse(body)
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

  const group = await prisma.vpnGroup.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      serverId: parsed.data.serverId,
      cidrBlocks: parsed.data.cidrBlocks
        ? { create: parsed.data.cidrBlocks }
        : undefined,
    },
    include: { cidrBlocks: true },
  })

  await logAudit({
    action: 'GROUP_CREATED',
    actorEmail,
    targetType: 'GROUP',
    targetId: group.id,
    details: { name: group.name, serverId: group.serverId },
  })

  return NextResponse.json(group, { status: 201 })
})
