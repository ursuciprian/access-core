export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod/v4'
import { logAudit } from '@/lib/audit'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { prisma } = await import('@/lib/prisma')

  const mapping = await prisma.googleGroupMapping.findUnique({
    where: { id },
    include: {
      vpnGroup: {
        select: { id: true, name: true, serverId: true },
      },
    },
  })

  if (!mapping) {
    return NextResponse.json({ error: 'Mapping not found' }, { status: 404 })
  }

  return NextResponse.json(mapping)
}

const updateMappingSchema = z.object({
  googleGroupName: z.string().max(200).optional(),
})

export async function PUT(
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
  const parsed = updateMappingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { prisma } = await import('@/lib/prisma')

  const existing = await prisma.googleGroupMapping.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Mapping not found' }, { status: 404 })
  }

  const mapping = await prisma.googleGroupMapping.update({
    where: { id },
    data: { googleGroupName: parsed.data.googleGroupName },
    include: {
      vpnGroup: {
        select: { id: true, name: true, serverId: true },
      },
    },
  })

  await logAudit({
    action: 'GROUP_UPDATED',
    actorEmail: session.user.email,
    targetType: 'GROUP',
    targetId: existing.vpnGroupId,
    details: { action: 'GOOGLE_MAPPING_UPDATED', mappingId: id, ...parsed.data },
  })

  return NextResponse.json(mapping)
}

export async function DELETE(
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

  const { id } = await params
  const { prisma } = await import('@/lib/prisma')

  const existing = await prisma.googleGroupMapping.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Mapping not found' }, { status: 404 })
  }

  await prisma.googleGroupMapping.delete({ where: { id } })

  await logAudit({
    action: 'GROUP_UPDATED',
    actorEmail: session.user.email,
    targetType: 'GROUP',
    targetId: existing.vpnGroupId,
    details: {
      action: 'GOOGLE_MAPPING_REMOVED',
      mappingId: id,
      googleGroupEmail: existing.googleGroupEmail,
    },
  })

  return NextResponse.json({ success: true })
}
