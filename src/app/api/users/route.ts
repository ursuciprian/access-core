export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { deriveCommonName, validateCommonName } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/rbac'

export const GET = requireAdmin()(async (request: NextRequest) => {
  const { prisma } = await import('@/lib/prisma')
  const { searchParams } = new URL(request.url)

  const search = searchParams.get('search')
  const serverId = searchParams.get('server')
  const certStatus = searchParams.get('certStatus')
  const flagged = searchParams.get('flagged')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)))

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { commonName: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (serverId) {
    where.serverId = serverId
  }

  if (certStatus && ['ACTIVE', 'REVOKED', 'NONE'].includes(certStatus)) {
    where.certStatus = certStatus
  }

  if (flagged === 'true') {
    where.isFlagged = true
  }

  const skip = (page - 1) * pageSize

  const [users, total] = await Promise.all([
    prisma.vpnUser.findMany({
      where,
      include: {
        groups: {
          include: {
            group: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.vpnUser.count({ where }),
  ])

  return NextResponse.json({ users, total, page, pageSize })
})

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().max(100).optional(),
  serverId: z.string().min(1),
  commonName: z.string().optional(),
})

export const POST = requireAdmin()(async (request: NextRequest, session) => {
  const actorEmail = session.user.email as string
  const body = await request.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const commonName = parsed.data.commonName || deriveCommonName(parsed.data.email)
  const cnValidation = validateCommonName(commonName)
  if (!cnValidation.success) {
    return NextResponse.json(
      { error: 'Invalid common name', details: cnValidation.error.issues },
      { status: 400 }
    )
  }

  const { prisma } = await import('@/lib/prisma')

  const user = await prisma.vpnUser.create({
    data: {
      email: parsed.data.email,
      commonName,
      displayName: parsed.data.displayName,
      serverId: parsed.data.serverId,
    },
    include: {
      groups: {
        include: {
          group: true,
        },
      },
    },
  })

  await logAudit({
    action: 'USER_CREATED',
    actorEmail,
    targetType: 'USER',
    targetId: user.id,
    userId: user.id,
    details: { email: user.email, commonName: user.commonName },
  })

  return NextResponse.json(user, { status: 201 })
})
