import { getTransport } from '@/lib/transport'

interface Connection {
  commonName: string
  realAddress: string
  vpnAddress: string
  bytesIn: number
  bytesOut: number
  connectedSince: string
}

export async function parseStatusLog(serverId: string): Promise<Connection[]> {
  const { prisma } = await import('@/lib/prisma')

  const server = await prisma.vpnServer.findUnique({ where: { id: serverId } })
  if (!server) {
    return []
  }

  try {
    const transport = getTransport(server)
    const result = await transport.executeCommand('cat /var/log/openvpn-status.log')

    if (!result.stdout) {
      return []
    }

    const lines = result.stdout.split('\n')
    const connections: Connection[] = []
    let section = ''

    // First pass: parse client list
    const clientMap = new Map<string, { realAddress: string; bytesIn: number; bytesOut: number; connectedSince: string }>()
    // Second pass: parse routing table for VPN addresses
    const vpnMap = new Map<string, string>()

    for (const line of lines) {
      if (line.startsWith('Common Name,Real Address,')) {
        section = 'clients'
        continue
      }
      if (line.startsWith('Virtual Address,Common Name,')) {
        section = 'routing'
        continue
      }
      if (line.startsWith('ROUTING TABLE') || line.startsWith('GLOBAL STATS') || line.startsWith('END')) {
        section = ''
        continue
      }

      if (section === 'clients' && line.trim()) {
        const parts = line.split(',')
        if (parts.length >= 5) {
          clientMap.set(parts[0], {
            realAddress: parts[1],
            bytesIn: parseInt(parts[2], 10) || 0,
            bytesOut: parseInt(parts[3], 10) || 0,
            connectedSince: parts[4],
          })
        }
      }

      if (section === 'routing' && line.trim()) {
        const parts = line.split(',')
        if (parts.length >= 2) {
          vpnMap.set(parts[1], parts[0])
        }
      }
    }

    for (const [commonName, client] of clientMap) {
      connections.push({
        commonName,
        realAddress: client.realAddress,
        vpnAddress: vpnMap.get(commonName) || '',
        bytesIn: client.bytesIn,
        bytesOut: client.bytesOut,
        connectedSince: client.connectedSince,
      })
    }

    return connections
  } catch {
    return []
  }
}
