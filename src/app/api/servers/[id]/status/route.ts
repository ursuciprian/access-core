export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getTransport } from '@/lib/transport'
import { requireAdmin } from '@/lib/rbac'

function parseUptimeSeconds(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.floor(parsed)
}

export const GET = requireAdmin()(async (
  _request,
  _session,
  context
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')

  const server = await prisma.vpnServer.findUnique({ where: { id } })
  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  let online = false
  let error: string | undefined
  let uptimeSeconds: number | null = null

  try {
    const transport = getTransport(server)
    online = await transport.testConnectivity()
    if (online) {
      const uptimeResult = await transport.executeCommand(
        [
          'OPENVPN_PID="$(pgrep -x openvpn | head -n 1)"',
          '[ -n "$OPENVPN_PID" ] || OPENVPN_PID="$(pidof openvpn 2>/dev/null | awk \'{print $1}\')"',
          'if [ -n "$OPENVPN_PID" ] && [ -r "/proc/$OPENVPN_PID/stat" ]; then',
          '  START_TICKS="$(awk \'{print $22}\' "/proc/$OPENVPN_PID/stat" 2>/dev/null)"',
          '  UPTIME_SECONDS="$(cut -d. -f1 /proc/uptime 2>/dev/null)"',
          '  HZ="$(getconf CLK_TCK 2>/dev/null || echo 100)"',
          '  if [ -n "$START_TICKS" ] && [ -n "$UPTIME_SECONDS" ] && [ -n "$HZ" ]; then',
          '    echo $((UPTIME_SECONDS - (START_TICKS / HZ)))',
          '  fi',
          'fi',
        ].join('\n')
      )
      uptimeSeconds = parseUptimeSeconds(uptimeResult.stdout)
    }
  } catch (err) {
    console.error('Server status check failed', { serverId: id, error: err })
    error = 'Connectivity check failed'
  }

  return NextResponse.json({ id: server.id, online, uptimeSeconds, error })
})
