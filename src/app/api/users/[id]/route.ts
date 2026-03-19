export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/rbac'
import { isCertRevokedOrMissing, revokeCert } from '@/lib/cert-service'
import { buildCcdDeleteCommand } from '@/lib/ccd-generator'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { getTransport } from '@/lib/transport'
import { buildOpenVpnKillCommand } from '@/lib/shell'

export const GET = requireAdmin()(async (
  _request: NextRequest,
  _session,
  context
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')

  const user = await prisma.vpnUser.findUnique({
    where: { id },
    include: {
      server: { select: { id: true, name: true, hostname: true } },
      groups: {
        include: {
          group: true,
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(user)
})

const updateUserSchema = z.object({
  displayName: z.string().max(100).optional(),
  isEnabled: z.boolean().optional(),
  isFlagged: z.boolean().optional(),
  flagReason: z.string().max(500).optional(),
  staticIp: z.string().max(45).nullable().optional(),
  allowInternet: z.boolean().optional(),
  maxConnections: z.number().int().min(1).max(10).optional(),
  require2fa: z.boolean().optional(),
  allowedSourceIps: z.array(z.string().max(45)).optional(),
})

export const PUT = requireAdmin()(async (
  request: NextRequest,
  session,
  context
) => {
  const actorEmail = session.user.email as string
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const body = await request.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { prisma } = await import('@/lib/prisma')

  const existing = await prisma.vpnUser.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.isFlagged === true && !existing.isFlagged) {
    data.flaggedAt = new Date()
  } else if (parsed.data.isFlagged === false) {
    data.flaggedAt = null
    data.flagReason = null
  }

  const user = await prisma.vpnUser.update({
    where: { id },
    data,
    include: {
      groups: {
        include: {
          group: true,
        },
      },
    },
  })

  await logAudit({
    action: 'USER_UPDATED',
    actorEmail,
    targetType: 'USER',
    targetId: id,
    userId: id,
    details: parsed.data,
  })

  return NextResponse.json(user)
})

export const DELETE = requireAdmin()(async (
  _request: NextRequest,
  session,
  context
) => {
  const actorEmail = session.user.email as string
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')

  const user = await prisma.vpnUser.findUnique({
    where: { id },
    include: { server: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (!isServerManagementEnabled()) {
    return NextResponse.json(
      { error: SERVER_MANAGEMENT_DISABLED_MESSAGE },
      { status: 409 }
    )
  }

  try {
    const transport = getTransport(user.server)

    if (user.certStatus === 'ACTIVE') {
      try {
        await revokeCert(user.server, user.commonName)
      } catch (error) {
        const safeToContinue = await isCertRevokedOrMissing(user.server, user.commonName).catch(() => false)
        if (!safeToContinue) {
          throw error
        }
      }
    }

    await transport.executeCommand(
      buildCcdDeleteCommand(user.server.ccdPath, user.commonName)
    )

    await transport.executeCommand(
      buildOpenVpnKillCommand(user.commonName)
    )
  } catch (error) {
    console.error('Failed to clean up VPN user before deletion', {
      userId: id,
      error,
    })
    return NextResponse.json(
      { error: 'Failed to remove VPN access from server before deleting user' },
      { status: 500 }
    )
  }

  await prisma.vpnUser.delete({ where: { id } })

  await logAudit({
    action: 'USER_DELETED',
    actorEmail,
    targetType: 'USER',
    targetId: id,
    details: { userId: id, email: user.email, commonName: user.commonName },
  })

  return NextResponse.json({ success: true })
})
