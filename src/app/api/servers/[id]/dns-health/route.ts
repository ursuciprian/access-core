export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'
import { getTransport } from '@/lib/transport'
import { shellEscape } from '@/lib/shell'
import { validateServerNetworkSettings } from '@/lib/server-network-config'
import { logAudit } from '@/lib/audit'

interface DnsCheckResult {
  domain: string
  resolver: string
  ok: boolean
  status: 'resolved' | 'failed'
}

export const POST = requireAdmin()(async (
  _request: NextRequest,
  session,
  context
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')

  const server = await prisma.vpnServer.findUnique({ where: { id } })
  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  const validation = validateServerNetworkSettings({
    vpnNetwork: server.vpnNetwork,
    dnsServers: server.dnsServers,
    searchDomains: server.searchDomains,
    internalDomains: server.internalDomains,
    routeMode: server.routeMode as 'NAT' | 'ROUTING',
    splitTunnel: server.splitTunnel,
    compression: server.compression as 'off' | 'lzo' | 'lz4',
    protocol: server.protocol as 'udp' | 'tcp',
    port: server.port,
  })
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const checks: DnsCheckResult[] = []
  const domains = Array.from(new Set(server.internalDomains))
  const resolvers = Array.from(new Set(server.dnsServers))

  if (domains.length > 0 && resolvers.length > 0) {
    const transport = getTransport(server)

    for (const domain of domains) {
      for (const resolver of resolvers) {
        const command = [
          'if command -v nslookup >/dev/null 2>&1; then',
          `  timeout 5 nslookup ${shellEscape(domain)} ${shellEscape(resolver)} >/dev/null 2>&1`,
          'elif command -v dig >/dev/null 2>&1; then',
          `  timeout 5 dig @${shellEscape(resolver)} ${shellEscape(domain)} +time=3 +tries=1 >/dev/null 2>&1`,
          'else',
          '  exit 127',
          'fi',
        ].join('\n')
        const result = await transport.executeCommand(command, 10000)
        checks.push({
          domain,
          resolver,
          ok: result.exitCode === 0,
          status: result.exitCode === 0 ? 'resolved' : 'failed',
        })
      }
    }
  }

  await logAudit({
    action: 'DNS_HEALTH_CHECKED',
    actorEmail: session.user.email as string,
    targetType: 'SERVER',
    targetId: server.id,
    details: {
      domainCount: domains.length,
      resolverCount: resolvers.length,
      failedCount: checks.filter((check) => !check.ok).length,
    },
  })

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    checks,
  })
})
