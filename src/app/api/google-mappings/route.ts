export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/rbac'

export const GET = requireAdmin()(async (request: NextRequest) => {
  const { prisma } = await import('@/lib/prisma')
  const { searchParams } = new URL(request.url)
  const vpnGroupId = searchParams.get('vpnGroupId')
  const serverId = searchParams.get('serverId')

  const mappings = await prisma.googleGroupMapping.findMany({
    where: {
      ...(vpnGroupId ? { vpnGroupId } : {}),
      ...(serverId ? { vpnGroup: { serverId } } : {}),
    },
    include: {
      vpnGroup: {
        select: { id: true, name: true, serverId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(mappings)
})

const createMappingSchema = z.object({
  googleGroupEmail: z.string().email(),
  googleGroupName: z.string().max(200).optional(),
  vpnGroupId: z.string().min(1),
})

export const POST = requireAdmin()(async (request: NextRequest, session) => {
  const actorEmail = session.user.email as string
  const body = await request.json()
  const parsed = createMappingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { prisma } = await import('@/lib/prisma')

  const vpnGroup = await prisma.vpnGroup.findUnique({ where: { id: parsed.data.vpnGroupId } })
  if (!vpnGroup) {
    return NextResponse.json({ error: 'VPN group not found' }, { status: 404 })
  }

  const existing = await prisma.googleGroupMapping.findUnique({
    where: {
      googleGroupEmail_vpnGroupId: {
        googleGroupEmail: parsed.data.googleGroupEmail,
        vpnGroupId: parsed.data.vpnGroupId,
      },
    },
  })
  if (existing) {
    return NextResponse.json({ error: 'Mapping already exists for this Google group and VPN group' }, { status: 409 })
  }

  const mapping = await prisma.googleGroupMapping.create({
    data: {
      googleGroupEmail: parsed.data.googleGroupEmail,
      googleGroupName: parsed.data.googleGroupName,
      vpnGroupId: parsed.data.vpnGroupId,
    },
    include: {
      vpnGroup: {
        select: { id: true, name: true, serverId: true },
      },
    },
  })

  await logAudit({
    action: 'GROUP_UPDATED',
    actorEmail,
    targetType: 'GROUP',
    targetId: parsed.data.vpnGroupId,
    details: {
      action: 'GOOGLE_MAPPING_ADDED',
      googleGroupEmail: parsed.data.googleGroupEmail,
      mappingId: mapping.id,
    },
  })

  return NextResponse.json(mapping, { status: 201 })
})
