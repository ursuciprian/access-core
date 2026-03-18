export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { getTransport } from '@/lib/transport'

export async function GET(
  _request: Request,
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
}
