export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { generateCcdForUser, buildCcdWriteCommand } from '@/lib/ccd-generator'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { reconcileExpiredTemporaryAccess } from '@/lib/temporary-access'
import { getTransport } from '@/lib/transport'
import { requireAdmin } from '@/lib/rbac'
import { buildOpenVpnKillCommand } from '@/lib/shell'

export const POST = requireAdmin()(async (
  _request: NextRequest,
  session,
  context
) => {
  const actorEmail = session.user.email as string
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await (context as { params: Promise<{ id: string }> }).params
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
    await transport.executeCommand(buildOpenVpnKillCommand(user.commonName))

    const updatedUser = await prisma.vpnUser.update({
      where: { id },
      data: {
        ccdSyncStatus: 'SUCCESS',
        lastCcdPush: new Date(),
      },
    })

    await logAudit({
      action: 'CCD_PUSHED',
      actorEmail,
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
})
