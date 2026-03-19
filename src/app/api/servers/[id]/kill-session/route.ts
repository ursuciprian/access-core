export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { getTransport } from '@/lib/transport'
import { z } from 'zod/v4'
import { requireAdmin } from '@/lib/rbac'
import { buildOpenVpnKillCommand } from '@/lib/shell'

const killSchema = z.object({
  commonName: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .refine((value) => !value.includes('..'), 'Invalid common name'),
})

export const POST = requireAdmin()(async (
  request: NextRequest,
  session,
  context
) => {
  const actorEmail = session.user.email as string
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const body = await request.json()
  const parsed = killSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { commonName } = parsed.data
  const { prisma } = await import('@/lib/prisma')

  const server = await prisma.vpnServer.findUnique({ where: { id } })
  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  try {
    const transport = getTransport(server)
    await transport.executeCommand(buildOpenVpnKillCommand(commonName))

    await logAudit({
      action: 'SESSION_KILLED',
      actorEmail,
      targetType: 'USER',
      targetId: commonName,
      details: { commonName, serverId: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to kill VPN session', { serverId: id, commonName, error })
    return NextResponse.json(
      { error: 'Failed to kill session' },
      { status: 500 }
    )
  }
})
