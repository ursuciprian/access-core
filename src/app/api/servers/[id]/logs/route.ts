export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { getTransport } from '@/lib/transport'
import { requireAdmin } from '@/lib/rbac'

export const GET = requireAdmin()(async (
  _request: Request,
  _session,
  context
) => {
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')

  const server = await prisma.vpnServer.findUnique({ where: { id } })
  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  try {
    const transport = getTransport(server)

    const [statusResult, openvpnResult] = await Promise.all([
      transport.executeCommand(
        'cat /var/log/openvpn-status.log 2>/dev/null || echo ""'
      ),
      transport.executeCommand(
        'tail -500 /var/log/openvpn.log 2>/dev/null || tail -200 /var/log/syslog 2>/dev/null | grep -i openvpn || echo ""'
      ),
    ])

    return NextResponse.json({
      statusLog: statusResult.stdout,
      openvpnLog: openvpnResult.stdout,
    })
  } catch (err) {
    console.error('Failed to fetch server logs', { serverId: id, error: err })
    return NextResponse.json({ error: 'Failed to fetch server logs' }, { status: 500 })
  }
})
