export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { generateCcdForUser, buildCcdWriteCommand } from '@/lib/ccd-generator'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { reconcileExpiredTemporaryAccess } from '@/lib/temporary-access'
import { getTransport } from '@/lib/transport'

export async function POST(
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
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await params
  const { prisma } = await import('@/lib/prisma')
  await reconcileExpiredTemporaryAccess({ userId: id })

  const user = await prisma.vpnUser.findUnique({
    where: { id },
    include: { server: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    const ccdContent = await generateCcdForUser(user.id)
    const transport = getTransport(user.server)
    const command = buildCcdWriteCommand(
      user.server.ccdPath,
      user.commonName,
      ccdContent
    )
    await transport.executeCommand(command)

    // Kill the client's active connection via the management interface
    // so OpenVPN re-reads the CCD on reconnect (Tunnelblick auto-reconnects)
    await transport.executeCommand(
      `echo "kill ${user.commonName}" | nc -w 1 127.0.0.1 7505 2>/dev/null || true`
    )

    const updatedUser = await prisma.vpnUser.update({
      where: { id },
      data: {
        ccdSyncStatus: 'SUCCESS',
        lastCcdPush: new Date(),
      },
    })

    await logAudit({
      action: 'CCD_PUSHED',
      actorEmail: session.user.email,
      targetType: 'USER',
      targetId: id,
      userId: id,
      details: { commonName: user.commonName, serverId: user.serverId },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    await prisma.vpnUser.update({
      where: { id },
      data: { ccdSyncStatus: 'FAILED' },
    })

    console.error('Failed to push CCD', { userId: id, error })
    return NextResponse.json(
      { error: 'Failed to push CCD' },
      { status: 500 }
    )
  }
}
