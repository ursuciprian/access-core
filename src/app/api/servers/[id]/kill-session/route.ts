export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { getTransport } from '@/lib/transport'
import { z } from 'zod/v4'

const killSchema = z.object({
  commonName: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .refine((value) => !value.includes('..'), 'Invalid common name'),
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
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await params
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
    await transport.executeCommand(
      `echo "kill ${commonName}" | nc -w 1 127.0.0.1 7505 2>/dev/null || true`
    )

    await logAudit({
      action: 'SESSION_KILLED',
      actorEmail: session.user.email,
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
}
