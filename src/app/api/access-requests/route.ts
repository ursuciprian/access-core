import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { AccessRequestStatus } from '@prisma/client'
import { z } from 'zod/v4'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { reconcileAccessRequestLifecycle } from '@/lib/access-lifecycle'

export const dynamic = 'force-dynamic'

const createAccessRequestSchema = z.object({
  serverId: z.string().trim().min(1),
  groupIds: z.array(z.string().trim().min(1)).max(50).default([]),
  reason: z.string().trim().max(500).optional(),
})

// GET /api/access-requests — list requests (admins see all, viewers see own)
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/prisma')
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as Record<string, unknown>).role as string
  const { searchParams } = new URL(req.url)
  const rawStatus = searchParams.get('status')
  const status = rawStatus?.trim().toUpperCase() ?? null

  const mine = searchParams.get('mine') === 'true'
  const where: Record<string, unknown> = {}
  if (role !== 'ADMIN' || mine) {
    where.email = session.user.email
  }

  if (status) {
    if (!Object.values(AccessRequestStatus).includes(status as AccessRequestStatus)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }
    where.status = status
  }

  const requests = await prisma.accessRequest.findMany({
    where,
    include: { server: { select: { id: true, name: true, hostname: true } } },
    orderBy: { createdAt: 'desc' },
  })

  let response = requests

  if (mine) {
    const enabledAccess = await prisma.vpnUser.findMany({
      where: {
        email: session.user.email,
        isEnabled: true,
      },
      select: {
        serverId: true,
      },
    })

    const enabledServerIds = new Set(enabledAccess.map((entry) => entry.serverId))

    response = requests.filter((request) => {
      if (request.status !== 'APPROVED') {
        return true
      }

      return enabledServerIds.has(request.serverId)
    })

    response = response.filter((request, index, all) => {
      if (request.status !== 'APPROVED') {
        return true
      }

      return index === all.findIndex((candidate) => (
        candidate.status === request.status && candidate.serverId === request.serverId
      ))
    })
  }

  return NextResponse.json(response)
}

// POST /api/access-requests — create a new access request
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/prisma')
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = session.user.email as string
  await reconcileAccessRequestLifecycle({ email })

  const parsed = createAccessRequestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { serverId, groupIds, reason } = parsed.data

  const [existingRequest, existingAccess, activeRequestCount] = await Promise.all([
    prisma.accessRequest.findFirst({
      where: {
        email,
        serverId,
        status: {
          in: ['PENDING', 'PROCESSING', 'FAILED', 'APPROVED'],
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vpnUser.findFirst({
      where: {
        email,
        serverId,
        isEnabled: true,
      },
      select: {
        id: true,
      },
    }),
    prisma.accessRequest.count({
      where: {
        email,
        status: {
          in: ['PENDING', 'PROCESSING', 'FAILED'],
        },
      },
    }),
  ])

  if (existingAccess) {
    return NextResponse.json(
      { error: 'You already have VPN access for this server' },
      { status: 409 }
    )
  }

  if (existingRequest?.status === 'PENDING') {
    return NextResponse.json(
      { error: 'You already have a pending request for this server' },
      { status: 409 }
    )
  }

  if (existingRequest?.status === 'PROCESSING') {
    return NextResponse.json(
      { error: 'Your VPN access is already being provisioned for this server' },
      { status: 409 }
    )
  }

  if (existingRequest?.status === 'FAILED') {
    return NextResponse.json(
      { error: 'Your last request for this server is awaiting an administrator retry' },
      { status: 409 }
    )
  }

  if (existingRequest?.status === 'APPROVED' && existingAccess) {
    return NextResponse.json(
      { error: 'You already have an approved request for this server' },
      { status: 409 }
    )
  }

  if (activeRequestCount >= 3) {
    return NextResponse.json(
      { error: 'You already have too many active access requests. Please wait for an administrator to review them.' },
      { status: 429 }
    )
  }

  const request = await prisma.accessRequest.create({
    data: {
      email,
      name: session.user.name || undefined,
      serverId,
      groupIds: groupIds || [],
      reason: reason || undefined,
    },
    include: { server: { select: { id: true, name: true } } },
  })

  await logAudit({
    action: 'ACCESS_REQUEST_CREATED',
    actorEmail: email,
    targetType: 'ACCESS_REQUEST',
    targetId: request.id,
    details: { serverId, reason },
  })

  return NextResponse.json(request, { status: 201 })
}
